import type { Id } from "../../../convex/_generated/dataModel";
import { useWebRtcCall } from "../../features/calls/useWebRtcCall";
import CallGrid from "./CallGrid";
import CallControls from "./CallControls";

// The live call surface, shared by voice channels and DM calls. Owns the
// WebRTC mesh via useWebRtcCall; reads mic/camera state from the participant
// rows (Convex) so it stays in sync across peers.
export default function CallRoom({
  callId,
  myUserId,
  title,
  onLeave,
}: {
  callId: Id<"calls">;
  myUserId: Id<"users">;
  title: string;
  onLeave: () => void;
}) {
  const { participants, localStream, remoteStreams, mediaError, setMic, setCamera } = useWebRtcCall(
    callId,
    myUserId,
  );

  const me = participants?.find((p) => p.userId === myUserId);
  const micOn = me?.micOn ?? true;
  const cameraOn = me?.cameraOn ?? false;

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-surface-hover px-4 font-semibold text-content-primary">
        <span className="text-content-faint">🔊</span>
        {title}
      </header>

      {mediaError ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-danger">
          {mediaError}
        </div>
      ) : (
        <CallGrid
          participants={participants ?? []}
          localStream={localStream}
          remoteStreams={remoteStreams}
          myUserId={myUserId}
        />
      )}

      <CallControls
        micOn={micOn}
        cameraOn={cameraOn}
        onToggleMic={() => setMic(!micOn)}
        onToggleCamera={() => setCamera(!cameraOn)}
        onLeave={onLeave}
      />
    </div>
  );
}
