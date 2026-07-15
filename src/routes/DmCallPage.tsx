import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useCallLifecycle } from "../features/calls/useCallLifecycle";
import CallRoom from "../components/call/CallRoom";

export default function DmCallPage() {
  const { threadId } = useParams<{ threadId: Id<"directMessageThreads"> }>();
  if (!threadId) return null;
  return <DmCallView key={threadId} threadId={threadId} />;
}

function DmCallView({ threadId }: { threadId: Id<"directMessageThreads"> }) {
  const me = useQuery(api.users.getMe);
  const threads = useQuery(api.directMessageThreads.listForMe, {});
  const other = threads?.find((t) => t._id === threadId)?.otherUser ?? null;
  const navigate = useNavigate();
  const getOrCreateForThread = useMutation(api.calls.getOrCreateForThread);

  const getOrCreate = useCallback(
    () => getOrCreateForThread({ threadId }),
    [getOrCreateForThread, threadId],
  );
  const { callId, error } = useCallLifecycle(getOrCreate);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-danger">{error}</p>
        <button
          onClick={() => navigate(`/dm/${threadId}`, { replace: true })}
          className="rounded bg-accent px-3 py-1.5 text-sm text-white hover:bg-accent-hover"
        >
          Back to conversation
        </button>
      </div>
    );
  }

  if (!callId || !me) {
    return <div className="flex h-full items-center justify-center text-content-muted">Connecting…</div>;
  }

  return (
    <CallRoom
      callId={callId}
      myUserId={me.id}
      title={other ? `Call with ${other.name}` : "Direct call"}
      onLeave={() => navigate(`/dm/${threadId}`, { replace: true })}
    />
  );
}
