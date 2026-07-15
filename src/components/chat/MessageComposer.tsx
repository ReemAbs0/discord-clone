import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { insertAtTop, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// How often, at most, to send a typing heartbeat while composing. Well under
// the 5s staleness window so an actively-typing user never flickers off.
const TYPING_HEARTBEAT_THROTTLE_MS = 2_000;

export default function MessageComposer({ channelId }: { channelId: Id<"channels"> }) {
  const me = useQuery(api.users.getMe);
  const typingHeartbeat = useMutation(api.typingIndicators.heartbeat);
  const lastTypingSentRef = useRef(0);
  const [content, setContent] = useState("");

  function handleTyping(value: string) {
    setContent(value);
    if (value.length === 0) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current >= TYPING_HEARTBEAT_THROTTLE_MS) {
      lastTypingSentRef.current = now;
      void typingHeartbeat({ channelId });
    }
  }

  // research.md §7: insertAtTop makes the sender's own message appear
  // instantly, without waiting for the round-trip.
  const send = useMutation(api.messages.send).withOptimisticUpdate((localStore, args) => {
    if (!me) return;
    // This callback runs once, at the moment `send(...)` is called (a normal
    // event handler timing), not during render — eslint-plugin-react-hooks'
    // purity check can't tell the two apart for a callback defined inline
    // inside withOptimisticUpdate, hence the two targeted disables below.
    const now = Date.now(); // eslint-disable-line react-hooks/purity
    insertAtTop({
      paginatedQuery: api.messages.list,
      argsToMatch: { channelId: args.channelId },
      localQueryStore: localStore,
      item: {
        _id: crypto.randomUUID() as Id<"messages">,
        _creationTime: now,
        channelId: args.channelId,
        authorId: me.id,
        content: args.content,
        createdAt: now,
        authorName: me.name ?? "Unknown",
        authorAvatarUrl: me.avatarUrl,
      },
    });
  });

  async function handleSend() {
    const trimmed = content.trim();
    if (!trimmed) return;
    setContent("");
    await send({ channelId, content: trimmed });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  return (
    <form
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        void handleSend();
      }}
      className="p-4"
    >
      <textarea
        value={content}
        onChange={(e) => handleTyping(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Message #general"
        rows={1}
        className="w-full resize-none rounded-lg bg-surface-raised px-4 py-2.5 text-content-primary outline-none placeholder:text-content-faint"
      />
    </form>
  );
}
