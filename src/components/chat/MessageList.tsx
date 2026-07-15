import { useEffect, useRef } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import MessageItem from "./MessageItem";

// Scroll-to-top → loadMore wiring (FR-020) lands in US4 (T046). For now this
// renders the first page reactively — new messages still appear in real
// time via the underlying live query (FR-015).
export default function MessageList({ channelId }: { channelId: Id<"channels"> }) {
  const { results, status } = usePaginatedQuery(
    api.messages.list,
    { channelId },
    { initialNumItems: 25 },
  );

  // `results` accumulates newest-first across pages (research.md §7) —
  // reverse once so the chat reads oldest-at-top, newest-at-bottom.
  const orderedForDisplay = [...results].reverse();

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [orderedForDisplay.length]);

  if (status === "LoadingFirstPage") {
    return <div className="p-4 text-content-muted">Loading messages…</div>;
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto py-2">
      {orderedForDisplay.length === 0 && (
        <p className="px-4 py-2 text-content-muted">No messages yet — say hello!</p>
      )}
      {orderedForDisplay.map((message) => (
        <MessageItem key={message._id} message={message} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
