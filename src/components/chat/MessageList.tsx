import { useLayoutEffect, useRef } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import MessageItem, { type ChatMessage } from "./MessageItem";

type PaginationStatus = "LoadingFirstPage" | "CanLoadMore" | "LoadingMore" | "Exhausted";
const PAGE_SIZE = 25;

// Presentational: receives the paginated result pieces from whichever query the
// parent ran (api.messages.list or api.directMessages.list), so the scroll /
// load-older-history behaviour is written once and shared (FR-020, research §7).
export default function MessageList({
  results,
  status,
  loadMore,
  currentUserId,
  onEdit,
  onDelete,
}: {
  results: ChatMessage[];
  status: PaginationStatus;
  loadMore: (numItems: number) => void;
  currentUserId: Id<"users"> | null;
  onEdit: (id: string, content: string) => Promise<unknown> | void;
  onDelete: (id: string) => Promise<unknown> | void;
}) {
  // `results` accumulates newest-first across pages — reverse once so the chat
  // reads oldest-at-top, newest-at-bottom.
  const orderedForDisplay = [...results].reverse();

  const scrollRef = useRef<HTMLDivElement>(null);
  const restoreScrollHeightRef = useRef<number | null>(null);
  const stickToBottomRef = useRef(true);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (restoreScrollHeightRef.current !== null) {
      // Older history just prepended — keep the same content in view.
      el.scrollTop = el.scrollHeight - restoreScrollHeightRef.current;
      restoreScrollHeightRef.current = null;
    } else if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [orderedForDisplay.length]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 80 && status === "CanLoadMore") {
      restoreScrollHeightRef.current = el.scrollHeight;
      loadMore(PAGE_SIZE);
    }
  }

  if (status === "LoadingFirstPage") {
    return <div className="p-4 text-content-muted">Loading messages…</div>;
  }

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto py-2">
      {status === "LoadingMore" && (
        <p className="py-2 text-center text-xs text-content-faint">Loading older messages…</p>
      )}
      {orderedForDisplay.length === 0 && (
        <p className="px-4 py-2 text-content-muted">No messages yet — say hello!</p>
      )}
      {orderedForDisplay.map((message) => (
        <MessageItem
          key={message._id}
          message={message}
          canModify={currentUserId !== null && message.authorId === currentUserId}
          onEdit={(content) => onEdit(message._id, content)}
          onDelete={() => onDelete(message._id)}
        />
      ))}
    </div>
  );
}
