import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useConvexAuth } from "convex/react";
import LoginPage from "./routes/LoginPage";
import SignupPage from "./routes/SignupPage";
import AppShell from "./routes/AppShell";
import Home from "./routes/Home";
import JoinInvitePage from "./routes/JoinInvitePage";
import ServerLayout, { ServerIndexRedirect } from "./routes/ServerLayout";
import ChannelPage from "./routes/ChannelPage";
import VoiceChannelPage from "./routes/VoiceChannelPage";
import DirectMessagePage from "./routes/DirectMessagePage";
import DmCallPage from "./routes/DmCallPage";

// Auth-gated route wrapper (T014): redirects unauthenticated users to /login.
// `isRefreshing` (research.md §1) isn't treated as a full reload — only the
// initial `isLoading` blocks rendering, so a silent token refresh doesn't
// flash the whole app back to a loading screen.
function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center text-content-muted">
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Transient join-then-redirect page — authed, but outside the shell. */}
      <Route
        path="/invite/:code"
        element={
          <RequireAuth>
            <JoinInvitePage />
          </RequireAuth>
        }
      />

      {/* All authenticated routes render inside the persistent app shell
          (server rail + main pane), wrapped once in the auth gate. */}
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Home />} />
        <Route path="/dm/:threadId" element={<DirectMessagePage />} />
        <Route path="/dm/:threadId/call" element={<DmCallPage />} />
        <Route path="/servers/:serverId" element={<ServerLayout />}>
          <Route index element={<ServerIndexRedirect />} />
          <Route path="channels/:channelId" element={<ChannelPage />} />
          <Route path="voice/:channelId" element={<VoiceChannelPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
