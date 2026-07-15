import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// Owner-only invite UI (FR-006). Render this only for the server owner — the
// underlying mutations require ownership and would throw otherwise.
export default function InviteButton({ serverId }: { serverId: Id<"servers"> }) {
  const getOrCreate = useMutation(api.invites.getOrCreateForServer);
  const regenerate = useMutation(api.invites.regenerate);

  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  function linkForCode(code: string) {
    return `${window.location.origin}/invite/${code}`;
  }

  async function openPanel() {
    setOpen(true);
    setCopied(false);
    setBusy(true);
    try {
      const { code } = await getOrCreate({ serverId });
      setLink(linkForCode(code));
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerate() {
    setCopied(false);
    setBusy(true);
    try {
      const { code } = await regenerate({ serverId });
      setLink(linkForCode(code));
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  return (
    <>
      <button
        onClick={() => void openPanel()}
        className="rounded bg-accent px-3 py-1 text-sm font-medium text-white hover:bg-accent-hover"
      >
        Invite people
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-96 space-y-3 rounded-lg bg-surface-base p-6"
          >
            <h2 className="text-lg font-semibold text-content-primary">Invite people</h2>
            <p className="text-sm text-content-muted">
              Share this link to invite others to the server.
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                aria-label="Invite link"
                value={busy && !link ? "Generating…" : (link ?? "")}
                className="min-w-0 flex-1 rounded bg-surface-deepest px-3 py-2 text-sm text-content-primary outline-none"
              />
              <button
                onClick={() => void handleCopy()}
                disabled={!link || busy}
                className="rounded bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="flex justify-between">
              <button
                onClick={() => void handleRegenerate()}
                disabled={busy}
                className="text-sm text-content-muted hover:text-content-primary disabled:opacity-50"
              >
                Generate a new link
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded bg-surface-hover px-3 py-1.5 text-sm text-content-primary"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
