import { useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useCallLifecycle } from "../features/calls/useCallLifecycle";
import CallRoom from "../components/call/CallRoom";

export default function VoiceChannelPage() {
  const { serverId, channelId } = useParams<{ serverId: Id<"servers">; channelId: Id<"channels"> }>();
  if (!serverId || !channelId) return null;
  // Keyed so switching voice channels fully resets the call session.
  return <VoiceChannelView key={channelId} serverId={serverId} channelId={channelId} />;
}

function VoiceChannelView({
  serverId,
  channelId,
}: {
  serverId: Id<"servers">;
  channelId: Id<"channels">;
}) {
  const me = useQuery(api.users.getMe);
  const navigate = useNavigate();
  const getOrCreateForChannel = useMutation(api.calls.getOrCreateForChannel);

  const getOrCreate = useCallback(
    () => getOrCreateForChannel({ channelId }),
    [getOrCreateForChannel, channelId],
  );
  const { callId, error } = useCallLifecycle(getOrCreate);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-danger">{error}</p>
        <button
          onClick={() => navigate(`/servers/${serverId}`, { replace: true })}
          className="rounded bg-accent px-3 py-1.5 text-sm text-white hover:bg-accent-hover"
        >
          Back to server
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
      title="Voice channel"
      onLeave={() => navigate(`/servers/${serverId}`, { replace: true })}
    />
  );
}
