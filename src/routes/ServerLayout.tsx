import { Navigate, Outlet, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import MemberList from "../components/layout/MemberList";
import InviteButton from "../components/layout/InviteButton";

// No ChannelSidebar yet (that's US5, T049) — only "general" exists this
// early, so landing on a server redirects straight into it instead of
// showing a list widget with a single item (tasks.md T029 note).
export function ServerIndexRedirect() {
  const { serverId } = useParams<{ serverId: Id<"servers"> }>();
  const channels = useQuery(api.channels.listForServer, serverId ? { serverId } : "skip");

  if (channels === undefined) {
    return <div className="p-8 text-content-muted">Loading…</div>;
  }
  const general = channels.find((c) => c.name === "general");
  if (!general) {
    return <div className="p-8 text-content-muted">This server has no channels yet.</div>;
  }
  return <Navigate to={`/servers/${serverId}/channels/${general._id}`} replace />;
}

// Renders inside AppShell's main pane (the rail lives in the shell now), so
// this is just the server-specific chrome: a header with the server name and
// an <Outlet /> for the active channel.
export default function ServerLayout() {
  const { serverId } = useParams<{ serverId: Id<"servers"> }>();
  const server = useQuery(api.servers.get, serverId ? { serverId } : "skip");
  const me = useQuery(api.users.getMe);
  const isOwner = server !== undefined && me != null && server.ownerId === me.id;

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-surface-hover px-4">
        <span className="font-semibold text-content-primary">{server?.name ?? ""}</span>
        {serverId && isOwner && <InviteButton serverId={serverId} />}
      </header>
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
        {serverId && <MemberList serverId={serverId} />}
      </div>
    </div>
  );
}
