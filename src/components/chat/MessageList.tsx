import { useLayoutEffect, useRef } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import MessageItem from "./MessageItem";

const PAGE_SIZE = 25;

export default function MessageList({ channelId }: { channelId: Id<"channels"> }) {
  const me = useQuery(api.users.getMe);
  const { results, status, loadMore } = usePaginatedQuery(
    api.messages.list,
    { channelId },
    { initialNumItems: PAGE_SIZE },
  );

  // `results` accumulates newest-first across pages (research.md §7) — reverse
  // once so the chat reads oldest-at-top, newest-at-bottom.
  const orderedForDisplay = [...results].reverse();

  const scrollRef = useRef<HTMLDivElement>(null);
  // Set just before a loadMore so the layout effect can keep the viewport
  // anchored to the same message instead of jumping (FR-020 infinite scroll).
  const restoreScrollHeightRef = useRef<number | null>(null);
  // Whether the viewport is pinned to the bottom (so new incoming messages
  // auto-scroll, but scrolling up to read history does not get yanked down).
  const stickToBottomRef = useRef(true);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (restoreScrollHeightRef.current !== null) {
      // Older history was just prepended — keep the same content in view.
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
        <MessageItem key={message._id} message={message} currentUserId={me?.id ?? null} />
      ))}
    </div>
  );
}
