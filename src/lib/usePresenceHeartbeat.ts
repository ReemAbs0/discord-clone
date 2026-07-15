import { useEffect } from "react";
import { useConvexAuth, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";

const HEARTBEAT_INTERVAL_MS = 10_000;

// Keeps this user's presence row alive while the app is open. An immediate
// heartbeat fires on mount/login so "online" appears right away, in addition
// to the recurring cadence the staleness sweep expects (research.md §2).
export function usePresenceHeartbeat() {
  const { isAuthenticated } = useConvexAuth();
  const heartbeat = useMutation(api.presence.heartbeat);

  useEffect(() => {
    if (!isAuthenticated) return;

    void heartbeat({});
    const interval = setInterval(() => {
      void heartbeat({});
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isAuthenticated, heartbeat]);
}

// Wraps sign-out so presence goes offline immediately (an eager, discrete
// transition) instead of waiting on the passive cron sweep — see research.md
// §2's reconciliation with SC-004.
export function useSignOut() {
  const { signOut } = useAuthActions();
  const clearMine = useMutation(api.presence.clearMine);

  return async () => {
    await clearMine({});
    await signOut();
  };
}
