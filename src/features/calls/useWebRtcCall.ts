import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// STUN-only (research.md §5) — no TURN in v1, so strict/symmetric NAT may fail.
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

type PeerState = {
  pc: RTCPeerConnection;
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
};

export type CallParticipantView = {
  _id: string;
  userId: Id<"users">;
  name: string;
  avatarUrl: string | null;
  micOn: boolean;
  cameraOn: boolean;
};

// Full-mesh WebRTC over Convex signaling (research.md §3). One RTCPeerConnection
// per remote participant; perfect negotiation handles glare; ICE restart (§4)
// recovers transient drops. All the RTC objects live in refs (outside React
// render); effects react to the reactive participant/signal queries.
export function useWebRtcCall(callId: Id<"calls">, myUserId: Id<"users"> | null) {
  const participants = useQuery(api.calls.listParticipants, { callId }) as
    | CallParticipantView[]
    | undefined;
  const inboundSignals = useQuery(api.signals.listForMe, { callId });
  const sendSignal = useMutation(api.signals.send);
  const ackSignal = useMutation(api.signals.ack);
  const setMicCameraMutation = useMutation(api.calls.setMicCamera);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [mediaError, setMediaError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, PeerState>>(new Map());
  const handledSignals = useRef<Set<string>>(new Set());
  const inFlightSignals = useRef<Set<string>>(new Set());

  // 1. Acquire local media once. Mic on, camera off to start (matches the
  //    CallParticipant defaults) — the video track is acquired but disabled so
  //    turning the camera on later needs no renegotiation.
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ audio: true, video: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.getVideoTracks().forEach((t) => (t.enabled = false));
        localStreamRef.current = stream;
        setLocalStream(stream);
      })
      .catch((err: unknown) => {
        setMediaError(
          err instanceof Error ? err.message : "Could not access your microphone/camera",
        );
      });
    return () => {
      cancelled = true;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const getOrCreatePeer = useCallback(
    (remoteUserId: Id<"users">): PeerState => {
      const existing = peersRef.current.get(remoteUserId);
      if (existing) return existing;

      const pc = new RTCPeerConnection(RTC_CONFIG);
      const state: PeerState = {
        pc,
        // Deterministic per-pair politeness — both sides compute the same
        // answer without an extra round-trip (research.md §3).
        polite: (myUserId ?? "") > remoteUserId,
        makingOffer: false,
        ignoreOffer: false,
        isSettingRemoteAnswerPending: false,
      };
      peersRef.current.set(remoteUserId, state);

      pc.onnegotiationneeded = async () => {
        try {
          state.makingOffer = true;
          await pc.setLocalDescription();
          const desc = pc.localDescription;
          if (desc) {
            await sendSignal({
              callId,
              toUserId: remoteUserId,
              type: desc.type === "answer" ? "answer" : "offer",
              payload: JSON.stringify(desc),
            });
          }
        } catch (err) {
          console.error("negotiation failed", err);
        } finally {
          state.makingOffer = false;
        }
      };

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          void sendSignal({
            callId,
            toUserId: remoteUserId,
            type: "ice-candidate",
            payload: JSON.stringify(candidate),
          });
        }
      };

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        if (!stream) return;
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.set(remoteUserId, stream);
          return next;
        });
      };

      // research.md §4: recover with an ICE restart rather than tearing the
      // peer connection down. "failed" is terminal → restart immediately;
      // "disconnected" is often a transient blip → debounce a few seconds and
      // only restart if it hasn't self-recovered.
      let disconnectedTimer: ReturnType<typeof setTimeout> | null = null;
      pc.addEventListener("connectionstatechange", () => {
        if (disconnectedTimer !== null) {
          clearTimeout(disconnectedTimer);
          disconnectedTimer = null;
        }
        if (pc.connectionState === "failed") {
          pc.restartIce();
        } else if (pc.connectionState === "disconnected") {
          disconnectedTimer = setTimeout(() => {
            if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
              pc.restartIce();
            }
          }, 3_000);
        }
      });

      // Add local tracks last (this is what fires onnegotiationneeded).
      const local = localStreamRef.current;
      if (local) for (const track of local.getTracks()) pc.addTrack(track, local);

      return state;
    },
    [callId, myUserId, sendSignal],
  );

  const handleSignal = useCallback(
    async (signal: {
      _id: string;
      fromUserId: Id<"users">;
      type: "offer" | "answer" | "ice-candidate";
      payload: string;
    }): Promise<boolean> => {
      const state = getOrCreatePeer(signal.fromUserId); // lazy create if signal beat the participant list
      const pc = state.pc;
      try {
        if (signal.type === "ice-candidate") {
          const candidate = JSON.parse(signal.payload) as RTCIceCandidateInit;
          try {
            await pc.addIceCandidate(candidate);
          } catch (err) {
            if (!state.ignoreOffer) throw err;
          }
        } else {
          const description = JSON.parse(signal.payload) as RTCSessionDescriptionInit;
          const readyForOffer =
            !state.makingOffer &&
            (pc.signalingState === "stable" || state.isSettingRemoteAnswerPending);
          const offerCollision = description.type === "offer" && !readyForOffer;
          state.ignoreOffer = !state.polite && offerCollision;
          if (state.ignoreOffer) {
            await ackSignal({ signalId: signal._id as Id<"signals"> });
            return true;
          }
          state.isSettingRemoteAnswerPending = description.type === "answer";
          await pc.setRemoteDescription(description);
          state.isSettingRemoteAnswerPending = false;
          if (description.type === "offer") {
            await pc.setLocalDescription();
            const answer = pc.localDescription;
            if (answer) {
              await sendSignal({
                callId,
                toUserId: signal.fromUserId,
                type: answer.type === "answer" ? "answer" : "offer",
                payload: JSON.stringify(answer),
              });
            }
          }
        }
        // Ack only after a successful apply (research.md §3).
        await ackSignal({ signalId: signal._id as Id<"signals"> });
        return true;
      } catch (err) {
        console.error("signal handling failed", err);
        return false; // leave the row for the next reactive re-delivery to retry
      }
    },
    [ackSignal, callId, getOrCreatePeer, sendSignal],
  );

  // 2. Proactively create peers for active participants; tear down departed.
  useEffect(() => {
    if (!localStream || !participants || myUserId === null) return;
    const activeIds = new Set(
      participants.map((p) => p.userId).filter((id) => id !== myUserId),
    );
    for (const id of activeIds) getOrCreatePeer(id);
    for (const [id, state] of peersRef.current) {
      if (!activeIds.has(id as Id<"users">)) {
        state.pc.close();
        peersRef.current.delete(id);
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(id);
          return next;
        });
      }
    }
  }, [participants, localStream, myUserId, getOrCreatePeer]);

  // 3. Process inbound signals (reactive/lazy peer creation happens inside).
  useEffect(() => {
    if (!localStream || !inboundSignals) return;
    for (const signal of inboundSignals) {
      if (handledSignals.current.has(signal._id) || inFlightSignals.current.has(signal._id)) {
        continue;
      }
      inFlightSignals.current.add(signal._id);
      void handleSignal(signal).then((ok) => {
        inFlightSignals.current.delete(signal._id);
        if (ok) handledSignals.current.add(signal._id);
      });
    }
  }, [inboundSignals, localStream, handleSignal]);

  // 4. Close every peer connection on unmount.
  useEffect(() => {
    const peers = peersRef.current;
    return () => {
      for (const [, state] of peers) state.pc.close();
      peers.clear();
    };
  }, []);

  const setMic = useCallback(
    (on: boolean) => {
      localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = on));
      void setMicCameraMutation({ callId, micOn: on });
    },
    [callId, setMicCameraMutation],
  );

  const setCamera = useCallback(
    (on: boolean) => {
      localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = on));
      void setMicCameraMutation({ callId, cameraOn: on });
    },
    [callId, setMicCameraMutation],
  );

  return {
    participants,
    localStream,
    remoteStreams,
    mediaError,
    setMic,
    setCamera,
  };
}
