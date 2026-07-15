import type { Id } from "../../../convex/_generated/dataModel";
import type { CallParticipantView } from "../../features/calls/useWebRtcCall";
import VideoTile from "./VideoTile";

// Renders one tile per active participant: the local user's own tile uses the
// local stream, everyone else uses their received remote stream. mic/camera
// state comes from Convex (the participant rows), not the media tracks.
export default function CallGrid({
  participants,
  localStream,
  remoteStreams,
  myUserId,
}: {
  participants: CallParticipantView[];
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  myUserId: Id<"users">;
}) {
  const columns = participants.length <= 1 ? "grid-cols-1" : "grid-cols-2";

  return (
    <div className={`grid flex-1 gap-2 p-2 ${columns}`}>
      {participants.map((p) => {
        const isLocal = p.userId === myUserId;
        return (
          <VideoTile
            key={p._id}
            name={p.name}
            avatarUrl={p.avatarUrl}
            stream={isLocal ? localStream : (remoteStreams.get(p.userId) ?? null)}
            micOn={p.micOn}
            cameraOn={p.cameraOn}
            isLocal={isLocal}
          />
        );
      })}
    </div>
  );
}
