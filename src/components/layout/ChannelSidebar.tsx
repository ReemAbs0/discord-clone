import { useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useMatch, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import InviteButton from "./InviteButton";

type ChannelType = "text" | "voice";

export default function ChannelSidebar({ serverId }: { serverId: Id<"servers"> }) {
  const server = useQuery(api.servers.get, { serverId });
  const me = useQuery(api.users.getMe);
  const channels = useQuery(api.channels.listForServer, { serverId });
  const isOwner = server !== undefined && me != null && server.ownerId === me.id;

  const match = useMatch("/servers/:serverId/channels/:channelId");
  const activeChannelId = match?.params.channelId ?? null;

  const [creatingType, setCreatingType] = useState<ChannelType | null>(null);

  const textChannels = channels?.filter((c) => c.type === "text") ?? [];
  const voiceChannels = channels?.filter((c) => c.type === "voice") ?? [];

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-surface-rail">
      <div className="flex h-12 items-center border-b border-black/20 px-4">
        <span className="truncate font-semibold text-content-primary">{server?.name ?? ""}</span>
      </div>

      {isOwner && (
        <div className="border-b border-black/10 p-2">
          <InviteButton serverId={serverId} />
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto p-2">
        <ChannelSection
          label="Text Channels"
          channels={textChannels}
          isOwner={isOwner}
          serverId={serverId}
          activeChannelId={activeChannelId}
          onCreate={() => setCreatingType("text")}
        />
        <ChannelSection
          label="Voice Channels"
          channels={voiceChannels}
          isOwner={isOwner}
          serverId={serverId}
          activeChannelId={activeChannelId}
          onCreate={() => setCreatingType("voice")}
        />
      </div>

      {creatingType && (
        <CreateChannelModal
          serverId={serverId}
          type={creatingType}
          onClose={() => setCreatingType(null)}
        />
      )}
    </aside>
  );
}

function ChannelSection({
  label,
  channels,
  isOwner,
  serverId,
  activeChannelId,
  onCreate,
}: {
  label: string;
  channels: Doc<"channels">[];
  isOwner: boolean;
  serverId: Id<"servers">;
  activeChannelId: string | null;
  onCreate: () => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-bold uppercase text-content-muted">{label}</h3>
        {isOwner && (
          <button
            onClick={onCreate}
            title={`Create a ${label.toLowerCase().replace(" channels", "")} channel`}
            className="text-content-muted hover:text-content-primary"
          >
            +
          </button>
        )}
      </div>
      <ul className="mt-1">
        {channels.map((channel) => (
          <ChannelRow
            key={channel._id}
            channel={channel}
            isOwner={isOwner}
            serverId={serverId}
            isActive={channel._id === activeChannelId}
          />
        ))}
      </ul>
    </div>
  );
}

function ChannelRow({
  channel,
  isOwner,
  serverId,
  isActive,
}: {
  channel: Doc<"channels">;
  isOwner: boolean;
  serverId: Id<"servers">;
  isActive: boolean;
}) {
  const renameChannel = useMutation(api.channels.rename);
  const removeChannel = useMutation(api.channels.remove);
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(channel.name);

  const icon = channel.type === "voice" ? "🔊" : "#";

  async function saveRename() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === channel.name) {
      setEditing(false);
      return;
    }
    await renameChannel({ channelId: channel._id, name: trimmed });
    setEditing(false);
  }

  function handleRenameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void saveRename();
    } else if (event.key === "Escape") {
      setDraft(channel.name);
      setEditing(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete #${channel.name}? Its messages will be permanently removed.`)) {
      return;
    }
    await removeChannel({ channelId: channel._id });
    if (isActive) navigate(`/servers/${serverId}`, { replace: true });
  }

  if (editing) {
    return (
      <li className="px-1 py-0.5">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleRenameKeyDown}
          onBlur={() => void saveRename()}
          className="w-full rounded bg-surface-deepest px-2 py-1 text-sm text-content-primary outline-none"
        />
      </li>
    );
  }

  const rowInner = (
    <>
      <span className="text-content-faint">{icon}</span>
      <span className="truncate">{channel.name}</span>
    </>
  );

  return (
    <li className="group flex items-center gap-1">
      {channel.type === "text" ? (
        <Link
          to={`/servers/${serverId}/channels/${channel._id}`}
          className={`flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1 text-sm ${
            isActive
              ? "bg-surface-hover text-content-primary"
              : "text-content-muted hover:bg-surface-hover hover:text-content-primary"
          }`}
        >
          {rowInner}
        </Link>
      ) : (
        <span
          className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1 text-sm text-content-muted"
          title="Voice channels are joinable in a later milestone"
        >
          {rowInner}
        </span>
      )}

      {isOwner && (
        <span className="hidden shrink-0 gap-1 pr-1 text-content-muted group-hover:flex">
          <button
            onClick={() => {
              setDraft(channel.name);
              setEditing(true);
            }}
            title="Rename"
            className="hover:text-content-primary"
          >
            ✎
          </button>
          <button
            onClick={() => void handleDelete()}
            title="Delete"
            className="hover:text-danger"
          >
            ✕
          </button>
        </span>
      )}
    </li>
  );
}

function CreateChannelModal({
  serverId,
  type,
  onClose,
}: {
  serverId: Id<"servers">;
  type: ChannelType;
  onClose: () => void;
}) {
  const createChannel = useMutation(api.channels.create);
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      const channelId = await createChannel({ serverId, name: trimmed, type });
      onClose();
      if (type === "text") navigate(`/servers/${serverId}/channels/${channelId}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-80 space-y-3 rounded-lg bg-surface-base p-6"
      >
        <h2 className="text-lg font-semibold text-content-primary">
          Create {type === "voice" ? "voice" : "text"} channel
        </h2>
        <input
          autoFocus
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="new-channel"
          className="w-full rounded bg-surface-deepest px-3 py-2 text-sm text-content-primary outline-none"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
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
  );
}
