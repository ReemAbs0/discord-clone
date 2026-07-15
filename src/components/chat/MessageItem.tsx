import Avatar from "../Avatar";

export type MessageItemData = {
  _id: string;
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

// Edit/delete controls for the author's own messages land in US4 (T045).
export default function MessageItem({ message }: { message: MessageItemData }) {
  return (
    <div className="flex gap-3 px-4 py-1.5 hover:bg-surface-raised">
      <Avatar name={message.authorName} avatarUrl={message.authorAvatarUrl} />
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold text-content-primary">{message.authorName}</span>
          <span className="text-xs text-content-faint">{formatTimestamp(message.createdAt)}</span>
          {message.editedAt !== undefined && (
            <span className="text-xs text-content-faint">(edited)</span>
          )}
        </div>
        <p className="whitespace-pre-wrap break-words text-content-primary">{message.content}</p>
      </div>
    </div>
  );
}
