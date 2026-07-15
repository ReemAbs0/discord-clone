import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePresenceHeartbeat, useSignOut } from "../../src/lib/usePresenceHeartbeat";

vi.mock("../../convex/_generated/api", () => ({
  api: {
    presence: { heartbeat: "presence.heartbeat", clearMine: "presence.clearMine" },
  },
}));

const heartbeatMock = vi.fn();
const clearMineMock = vi.fn();
const signOutMock = vi.fn();

const mutationsByRef: Record<string, ReturnType<typeof vi.fn>> = {
  "presence.heartbeat": heartbeatMock,
  "presence.clearMine": clearMineMock,
};

let isAuthenticated = true;

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isLoading: false, isAuthenticated }),
  useMutation: (ref: string) => mutationsByRef[ref],
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: vi.fn(), signOut: signOutMock }),
}));

describe("usePresenceHeartbeat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    isAuthenticated = true;
    heartbeatMock.mockClear();
    clearMineMock.mockClear();
    signOutMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends an immediate heartbeat on mount when authenticated", () => {
    renderHook(() => usePresenceHeartbeat());
    expect(heartbeatMock).toHaveBeenCalledTimes(1);
  });

  it("sends a recurring heartbeat every 10 seconds", () => {
    renderHook(() => usePresenceHeartbeat());
    vi.advanceTimersByTime(30_000);
    // 1 immediate call + 3 interval ticks at 10s each
    expect(heartbeatMock).toHaveBeenCalledTimes(4);
  });

  it("never heartbeats when not authenticated", () => {
    isAuthenticated = false;
    renderHook(() => usePresenceHeartbeat());
    vi.advanceTimersByTime(30_000);
    expect(heartbeatMock).not.toHaveBeenCalled();
  });
});

describe("useSignOut", () => {
  it("clears presence before signing out (eager offline transition, research.md §2)", async () => {
    const { result } = renderHook(() => useSignOut());
    await result.current();
    expect(clearMineMock).toHaveBeenCalledTimes(1);
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });
});
