import { Outlet } from "react-router-dom";
import { usePresenceHeartbeat } from "../lib/usePresenceHeartbeat";
import ServerRail from "../components/layout/ServerRail";

// Persistent authenticated shell: the ServerRail is always the leftmost
// column, and the routed content (home landing or a server) fills the rest
// via <Outlet />. Wrapping every authenticated route in one shell means the
// rail is reachable everywhere, so login can land on "/" and still offer a
// way into servers/chat.
//
// The presence heartbeat lives here rather than on Home so it stays active on
// ALL authenticated routes — otherwise navigating into a server would unmount
// Home, stop the heartbeat, and make you appear offline while actively
// chatting.
export default function AppShell() {
  usePresenceHeartbeat();

  return (
    <div className="flex h-screen">
      <ServerRail />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
