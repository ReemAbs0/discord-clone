import { useEffect, useRef } from "react";
import { useSpeakingDetection } from "../../features/calls/useSpeakingDetection";
import Avatar from "../Avatar";

// The <video> element is always mounted (so a remote peer's audio keeps playing
// even with their camera off); the avatar overlays it when cameraOn is false.
// Local tile is muted to avoid echo. Speaking ring is derived locally (FR-028).
export default function VideoTile({
  name,
  avatarUrl,
  stream,
  micOn,
  cameraOn,
  isLocal,
}: {
  name: string;
  avatarUrl: string | null;
  stream: MediaStream | null;
  micOn: boolean;
  cameraOn: boolean;
  isLocal: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isSpeaking = useSpeakingDetection(stream, micOn);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-lg bg-surface-deepest ${
        isSpeaking ? "ring-2 ring-online" : ""
      }`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`h-full w-full object-cover ${cameraOn ? "" : "hidden"}`}
      />
      {!cameraOn && <Avatar name={name} avatarUrl={avatarUrl} size={72} />}

      <div className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/50 px-2 py-0.5 text-xs text-white">
        {!micOn && <span title="Muted">🔇</span>}
        <span className="truncate">
          {name}
          {isLocal ? " (you)" : ""}
        </span>
      </div>
    </div>
  );
}
