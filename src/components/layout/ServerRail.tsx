import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { uploadFile } from "../../lib/uploadFile";

export default function ServerRail() {
  const servers = useQuery(api.servers.listForMe);
  const createServer = useMutation(api.servers.create);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const navigate = useNavigate();

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const imageStorageId = imageFile
        ? await uploadFile(await generateUploadUrl({}), imageFile)
        : undefined;
      const serverId = await createServer({ name, imageStorageId });
      setCreating(false);
      setName("");
      setImageFile(null);
      navigate(`/servers/${serverId}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <nav className="flex w-[72px] flex-col items-center gap-2 bg-surface-rail p-3">
      <Link
        to="/"
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-raised text-content-primary hover:rounded-xl hover:bg-accent"
        title="Home"
      >
        🏠
      </Link>

      <div className="my-1 h-px w-8 bg-surface-hover" />

      {servers === undefined ? null : (
        <ul className="flex flex-col gap-2">
          {servers.map((server) => (
            <li key={server._id}>
              <Link
                to={`/servers/${server._id}`}
                title={server.name}
                className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-surface-raised text-content-primary hover:rounded-xl hover:bg-accent"
              >
                {server.imageUrl ? (
                  <img src={server.imageUrl} alt={server.name} className="h-full w-full object-cover" />
                ) : (
                  server.name.slice(0, 1).toUpperCase()
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => setCreating(true)}
        title="Create a server"
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-raised text-online hover:rounded-xl hover:bg-online hover:text-white"
      >
        +
      </button>

      {/* Rendered as a centered modal overlay rather than inline in the rail —
          the form is far wider than the 72px rail column. */}
      {creating && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setCreating(false)}
        >
          <form
            onSubmit={handleCreate}
            onClick={(e) => e.stopPropagation()}
            className="w-80 space-y-3 rounded-lg bg-surface-base p-6 text-left"
          >
            <h2 className="text-lg font-semibold text-content-primary">Create a server</h2>
            <div className="space-y-1">
              <label htmlFor="new-server-name" className="text-xs text-content-muted">
                Server name
              </label>
              <input
                id="new-server-name"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded bg-surface-deepest px-3 py-2 text-sm text-content-primary outline-none"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="new-server-image" className="text-xs text-content-muted">
                Server image (optional)
              </label>
              <input
                id="new-server-image"
                type="file"
                accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                className="w-full text-xs text-content-muted"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="rounded bg-surface-hover px-3 py-1.5 text-sm text-content-primary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {submitting ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}
    </nav>
  );
}
