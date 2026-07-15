import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

// Consumes an invite code and redirects into the joined server (FR-007).
// Routed behind RequireAuth, so an unauthenticated visitor is sent to /login
// first (the spec's tested flow has the joiner already signed in — quickstart
// scenario 3). Preserving the invite target across a login is a future
// refinement, not wired here.
export default function JoinInvitePage() {
  const { code } = useParams<{ code: string }>();
  const consume = useMutation(api.invites.consume);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!code || startedRef.current) return;
    startedRef.current = true; // guards against StrictMode double-invoke
    void (async () => {
      try {
        const { serverId } = await consume({ code });
        navigate(`/servers/${serverId}`, { replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not join server");
      }
    })();
  }, [code, consume, navigate]);

  return (
    <div className="flex h-screen items-center justify-center bg-surface-deepest text-content-primary">
      {error ? (
        <div className="space-y-3 text-center">
          <p className="text-danger">{error}</p>
          <button
            onClick={() => navigate("/", { replace: true })}
            className="rounded bg-accent px-3 py-1.5 text-sm text-white hover:bg-accent-hover"
          >
            Go home
          </button>
        </div>
      ) : (
        <p className="text-content-muted">Joining server…</p>
      )}
    </div>
  );
}
