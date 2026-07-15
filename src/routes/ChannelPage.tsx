import { useRef } from "react";
import { useParams } from "react-router-dom";
import { insertAtTop, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import MessageList from "../components/chat/MessageList";
import MessageComposer from "../components/chat/MessageComposer";
import TypingIndicator from "../components/chat/TypingIndicator";

const TYPING_HEARTBEAT_THROTTLE_MS = 2_000;

export default function ChannelPage() {
  const { channelId } = useParams<{ channelId: Id<"channels"> }>();
  if (!channelId) return null;
  // Keyed so switching channels resets the message list's scroll/pagination.
  return <ChannelView key={channelId} channelId={channelId} />;
}

function ChannelView({ channelId }: { channelId: Id<"channels"> }) {
  const me = useQuery(api.users.getMe);
  const { results, status, loadMore } = usePaginatedQuery(
    api.messages.list,
    { channelId },
    { initialNumItems: 25 },
  );
  const edit = useMutation(api.messages.edit);
  const remove = useMutation(api.messages.remove);
  const typingHeartbeat = useMutation(api.typingIndicators.heartbeat);
  const lastTypingSentRef = useRef(0);

  // research §7: optimistic insert so the sender's own message appears instantly.
  const send = useMutation(api.messages.send).withOptimisticUpdate((localStore, args) => {
    if (!me) return;
    const now = Date.now(); // eslint-disable-line react-hooks/purity -- runs at call time, not render
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

  function handleType() {
    const now = Date.now();
    if (now - lastTypingSentRef.current >= TYPING_HEARTBEAT_THROTTLE_MS) {
      lastTypingSentRef.current = now;
      void typingHeartbeat({ channelId });
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <MessageList
          results={results}
          status={status}
          loadMore={loadMore}
          currentUserId={me?.id ?? null}
          // The id is genuinely an Id<"messages"> (it came from this channel's
          // message list) — a localized boundary cast, not an `any` escape.
          onEdit={(id, content) => edit({ messageId: id as Id<"messages">, content })}
          onDelete={(id) => remove({ messageId: id as Id<"messages"> })}
        />
      </div>
      <TypingIndicator channelId={channelId} />
      <MessageComposer
        placeholder="Message the channel"
        onSend={(content) => send({ channelId, content })}
        onType={handleType}
      />
    </div>
  );
}
