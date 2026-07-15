export default function CallControls({
  micOn,
  cameraOn,
  onToggleMic,
  onToggleCamera,
  onLeave,
}: {
  micOn: boolean;
  cameraOn: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onLeave: () => void;
}) {
  return (
    <div className="flex items-center justify-center gap-3 border-t border-surface-hover p-3">
      <button
        onClick={onToggleMic}
        title={micOn ? "Mute microphone" : "Unmute microphone"}
        className={`flex h-11 w-11 items-center justify-center rounded-full text-lg ${
          micOn ? "bg-surface-hover text-content-primary" : "bg-danger text-white"
        }`}
      >
        {micOn ? "🎤" : "🔇"}
      </button>
      <button
        onClick={onToggleCamera}
        title={cameraOn ? "Turn off camera" : "Turn on camera"}
        className={`flex h-11 w-11 items-center justify-center rounded-full text-lg ${
          cameraOn ? "bg-surface-hover text-content-primary" : "bg-danger text-white"
        }`}
      >
        {cameraOn ? "📹" : "🚫"}
      </button>
      <button
        onClick={onLeave}
        title="Leave call"
        className="flex h-11 items-center justify-center rounded-full bg-danger px-5 font-medium text-white hover:opacity-90"
      >
        Leave
      </button>
    </div>
  );
}
