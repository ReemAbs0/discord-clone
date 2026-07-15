import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useSignOut } from "../lib/usePresenceHeartbeat";
import { uploadFile } from "../lib/uploadFile";
import Avatar from "../components/Avatar";

// The home landing pane. Renders inside AppShell's main pane (the server rail
// is always to its left), so from here you can pick or create a server via the
// rail. Presence heartbeat is handled by the shell, not here.
export default function Home() {
  const signOut = useSignOut();
  const me = useQuery(api.users.getMe);
  const myPresence = useQuery(
    api.presence.getForUsers,
    me ? { userIds: [me.id] } : "skip",
  );
  const isOnline = myPresence?.[0]?.online ?? false;

  return (
    <div className="mx-auto max-w-lg space-y-6 overflow-y-auto p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-content-primary">Direct Messages</h1>
        <button
          onClick={() => void signOut()}
          className="rounded bg-surface-raised px-3 py-1.5 text-sm text-content-primary hover:bg-surface-hover"
        >
          Log out
        </button>
      </div>

      <p className="text-sm text-content-muted">
        Pick a server from the rail on the left, or create one with the + button to start chatting.
      </p>

      <DirectMessageList />

      {me === undefined ? (
        <p className="text-content-muted">Loading…</p>
      ) : me === null ? (
        <p className="text-content-muted">No profile found.</p>
      ) : (
        <ProfileCard
          name={me.name ?? "Unnamed"}
          avatarUrl={me.avatarUrl}
          isOnline={isOnline}
        />
      )}

      <ProfileEditor />
    </div>
  );
}

function DirectMessageList() {
  const threads = useQuery(api.directMessageThreads.listForMe, {});
  if (threads === undefined || threads.length === 0) return null;

  return (
    <div className="space-y-1 rounded-lg bg-surface-base p-4">
      <h2 className="mb-1 text-sm font-bold uppercase text-content-muted">Conversations</h2>
      <ul>
        {threads.map((thread) => (
          <li key={thread._id}>
            <Link
              to={`/dm/${thread._id}`}
              className="flex items-center gap-2 rounded px-2 py-1.5 text-content-primary hover:bg-surface-hover"
            >
              <Avatar name={thread.otherUser.name} avatarUrl={thread.otherUser.avatarUrl} size={28} />
              <span className="truncate">{thread.otherUser.name}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ProfileCard({
  name,
  avatarUrl,
  isOnline,
}: {
  name: string;
  avatarUrl: string | null;
  isOnline: boolean;
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg bg-surface-base p-4">
      <div className="relative">
        <Avatar name={name} avatarUrl={avatarUrl} size={48} />
        <span
          data-testid="online-indicator"
          className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-surface-base ${
            isOnline ? "bg-online" : "bg-content-faint"
          }`}
          title={isOnline ? "Online" : "Offline"}
        />
      </div>
      <div>
        <p className="font-semibold text-content-primary">{name}</p>
        <p className="text-sm text-content-muted">{isOnline ? "Online" : "Offline"}</p>
      </div>
    </div>
  );
}

// T022 (FR-002): lets a user change their display name and avatar after
// signup, not just set one initially.
function ProfileEditor() {
  const me = useQuery(api.users.getMe);
  const updateProfile = useMutation(api.users.updateProfile);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);

  const [name, setName] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const avatarStorageId = avatarFile ? await uploadFile(await generateUploadUrl({}), avatarFile) : undefined;
      await updateProfile({
        name: name.trim() ? name.trim() : undefined,
        avatarStorageId,
      });
      setName("");
      setAvatarFile(null);
      setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-lg bg-surface-base p-4">
      <h2 className="text-sm font-bold uppercase text-content-muted">Edit profile</h2>

      <div className="space-y-1">
        <label htmlFor="edit-name" className="text-xs text-content-muted">
          Display name
        </label>
        <input
          id="edit-name"
          placeholder={me?.name ?? undefined}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded bg-surface-deepest px-3 py-2 text-content-primary outline-none"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="edit-avatar" className="text-xs text-content-muted">
          New avatar
        </label>
        <input
          id="edit-avatar"
          type="file"
          accept="image/*"
          onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
          className="w-full text-content-muted"
        />
      </div>

      <button
        type="submit"
        disabled={saving || (!name.trim() && !avatarFile)}
        className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save changes"}
      </button>
      {savedAt !== null && <span className="ml-2 text-sm text-online">Saved</span>}
    </form>
  );
}
