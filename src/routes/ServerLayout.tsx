import { Navigate, Outlet, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import ChannelSidebar from "../components/layout/ChannelSidebar";
import MemberList from "../components/layout/MemberList";

// Landing on a server opens its default "general" channel (the sidebar shows
// the full channel list once inside). Empty state covers a server whose
// channels were all deleted.
export function ServerIndexRedirect() {
  const { serverId } = useParams<{ serverId: Id<"servers"> }>();
  const channels = useQuery(api.channels.listForServer, serverId ? { serverId } : "skip");

  if (channels === undefined) {
    return <div className="p-8 text-content-muted">Loading…</div>;
  }
  const firstText = channels.find((c) => c.name === "general" && c.type === "text")
    ?? channels.find((c) => c.type === "text");
  if (!firstText) {
    return <div className="p-8 text-content-muted">This server has no text channels yet.</div>;
  }
  return <Navigate to={`/servers/${serverId}/channels/${firstText._id}`} replace />;
}

// Renders inside AppShell's main pane (the server rail lives in the shell).
// Layout: channel sidebar | active channel (Outlet) | member list.
export default function ServerLayout() {
  const { serverId } = useParams<{ serverId: Id<"servers"> }>();
  if (!serverId) return null;

  return (
    <div className="flex h-full">
      <ChannelSidebar serverId={serverId} />
      <div className="flex min-w-0 flex-1">
        <div className="min-w-0 flex-1 overflow-hidden">
          <Outlet />
        </div>
        <MemberList serverId={serverId} />
      </div>
    </div>
  );
}
