import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { uploadFile } from "../lib/uploadFile";

export default function SignupPage() {
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const updateProfile = useMutation(api.users.updateProfile);
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Set once signIn resolves. The avatar upload + navigation are deferred to
  // the effect below rather than run inline here: signIn resolves as soon as
  // the token is stored, but the Convex WebSocket re-authenticates
  // asynchronously afterwards. An authenticated mutation (generateUploadUrl)
  // fired synchronously right after signIn races that handshake and fails
  // "Not authenticated" — so we wait for useConvexAuth().isAuthenticated.
  const [signedUp, setSignedUp] = useState(false);
  const finishingRef = useRef(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn("password", { email, password, name, flow: "signUp" });
      setSignedUp(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (!signedUp || !isAuthenticated || finishingRef.current) return;
    finishingRef.current = true; // also guards against StrictMode double-invoke
    void (async () => {
      if (avatarFile) {
        try {
          const uploadUrl = await generateUploadUrl({});
          const avatarStorageId = await uploadFile(uploadUrl, avatarFile);
          await updateProfile({ avatarStorageId });
        } catch (err) {
          // The account already exists at this point and the avatar is
          // optional (US1 AC1) — don't strand the user on the signup page;
          // they can set an avatar later in the profile editor.
          console.error("Avatar upload during signup failed:", err);
        }
      }
      navigate("/");
    })();
  }, [signedUp, isAuthenticated, avatarFile, generateUploadUrl, updateProfile, navigate]);

  return (
    <div className="flex h-screen items-center justify-center bg-surface-deepest">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg bg-surface-base p-8"
      >
        <h1 className="text-xl font-semibold text-content-primary">Create an account</h1>

        <div className="space-y-1">
          <label htmlFor="name" className="text-xs font-bold uppercase text-content-muted">
            Display name
          </label>
          <input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded bg-surface-deepest px-3 py-2 text-content-primary outline-none"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="email" className="text-xs font-bold uppercase text-content-muted">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded bg-surface-deepest px-3 py-2 text-content-primary outline-none"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="text-xs font-bold uppercase text-content-muted">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded bg-surface-deepest px-3 py-2 text-content-primary outline-none"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="avatar" className="text-xs font-bold uppercase text-content-muted">
            Avatar (optional)
          </label>
          <input
            id="avatar"
            type="file"
            accept="image/*"
            onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
            className="w-full text-content-muted"
          />
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-accent py-2 font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Sign up"}
        </button>

        <p className="text-sm text-content-muted">
          Already have an account?{" "}
          <Link to="/login" className="text-accent hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
