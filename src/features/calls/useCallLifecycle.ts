import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// Joins the call on mount and leaves on unmount. `getOrCreate` must be stable
// (wrap it in useCallback) — it differs per surface (voice channel vs DM).
// Navigating away unmounts the page, which triggers the leave, so the UI's
// "Leave" button just needs to navigate.
//
// join/leave are serialized through a per-instance promise chain so React
// StrictMode's mount→unmount→mount double-invoke (dev) can't interleave an
// async join with its leave and strand the participant row. Combined with the
// idempotent server-side `leave`, redundant calls are harmless.
export function useCallLifecycle(getOrCreate: () => Promise<Id<"calls">>) {
  const join = useMutation(api.calls.join);
  const leave = useMutation(api.calls.leave);
  const [callId, setCallId] = useState<Id<"calls"> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chainRef = useRef<Promise<void>>(Promise.resolve());
  const joinedCallId = useRef<Id<"calls"> | null>(null);

  useEffect(() => {
    let cancelled = false;

    chainRef.current = chainRef.current.then(async () => {
      if (cancelled) return;
      try {
        const cid = await getOrCreate();
        await join({ callId: cid });
        joinedCallId.current = cid; // record so cleanup can leave exactly this call
        if (!cancelled) setCallId(cid);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not join the call");
        }
      }
    });

    return () => {
      cancelled = true;
      chainRef.current = chainRef.current.then(async () => {
        const cid = joinedCallId.current;
        if (cid === null) return;
        joinedCallId.current = null;
        setCallId(null);
        await leave({ callId: cid });
      });
    };
  }, [getOrCreate, join, leave]);

  return { callId, error };
}
