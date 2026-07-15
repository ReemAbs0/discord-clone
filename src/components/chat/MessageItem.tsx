import { useState, type KeyboardEvent } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import Avatar from "../Avatar";

// Shared shape rendered by MessageList for both channel messages and DMs. `_id`
// is widened to string so one presentational component serves both (the parent
// owns the concretely-typed Convex hooks — see ChannelPage / DirectMessagePage).
export type ChatMessage = {
  _id: string;
  authorId: Id<"users">;
  content: string;
  createdAt: number;
  editedAt?: number;
  authorName: string;
  authorAvatarUrl: string | null;
};

function formatTimestamp(ms: number) {
  const date = new Date(ms);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? `Today at ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

// Presentational: the parent supplies `canModify` (author check) and the
// edit/delete callbacks bound to the right mutation. FR-019 is still enforced
// server-side regardless of this flag.
export default function MessageItem({
  message,
  canModify,
  onEdit,
  onDelete,
}: {
  message: ChatMessage;
  canModify: boolean;
  onEdit: (content: string) => Promise<unknown> | void;
  onDelete: () => Promise<unknown> | void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  async function saveEdit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === message.content) {
      setEditing(false);
      return;
    }
    await onEdit(trimmed);
    setEditing(false);
  }

  function handleEditKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void saveEdit();
    } else if (event.key === "Escape") {
      setEditing(false);
      setDraft(message.content);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this message?")) return;
    await onDelete();
  }

  return (
    <div className="group relative flex gap-3 px-4 py-1.5 hover:bg-surface-raised">
      <Avatar name={message.authorName} avatarUrl={message.authorAvatarUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-content-primary">{message.authorName}</span>
          <span className="text-xs text-content-faint">{formatTimestamp(message.createdAt)}</span>
          {message.editedAt !== undefined && (
            <span className="text-xs text-content-faint">(edited)</span>
          )}
        </div>

        {editing ? (
          <div className="mt-1">
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleEditKeyDown}
              rows={1}
              className="w-full resize-none rounded bg-surface-deepest px-3 py-2 text-content-primary outline-none"
            />
            <p className="mt-1 text-xs text-content-faint">
              escape to{" "}
              <button className="text-accent hover:underline" onClick={() => setEditing(false)}>
                cancel
              </button>{" "}
              • enter to{" "}
              <button className="text-accent hover:underline" onClick={() => void saveEdit()}>
                save
              </button>
            </p>
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words text-content-primary">{message.content}</p>
        )}
      </div>

      {canModify && !editing && (
        <div className="absolute right-4 top-0 hidden gap-1 rounded bg-surface-deepest p-1 group-hover:flex">
          <button
            onClick={() => {
              setDraft(message.content);
              setEditing(true);
            }}
            className="rounded px-2 py-0.5 text-xs text-content-muted hover:bg-surface-hover hover:text-content-primary"
          >
            Edit
          </button>
          <button
            onClick={() => void handleDelete()}
            className="rounded px-2 py-0.5 text-xs text-content-muted hover:bg-danger hover:text-white"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
