import { Link, useParams } from "react-router-dom";
import { insertAtTop, useMutation, usePaginatedQuery, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import MessageList from "../components/chat/MessageList";
import MessageComposer from "../components/chat/MessageComposer";

export default function DirectMessagePage() {
  const { threadId } = useParams<{ threadId: Id<"directMessageThreads"> }>();
  if (!threadId) return null;
  return <DmView key={threadId} threadId={threadId} />;
}

function DmView({ threadId }: { threadId: Id<"directMessageThreads"> }) {
  const me = useQuery(api.users.getMe);
  const threads = useQuery(api.directMessageThreads.listForMe, {});
  const other = threads?.find((t) => t._id === threadId)?.otherUser ?? null;

  const { results, status, loadMore } = usePaginatedQuery(
    api.directMessages.list,
    { threadId },
    { initialNumItems: 25 },
  );
  const edit = useMutation(api.directMessages.edit);
  const remove = useMutation(api.directMessages.remove);

  const send = useMutation(api.directMessages.send).withOptimisticUpdate((localStore, args) => {
    if (!me) return;
    const now = Date.now(); // eslint-disable-line react-hooks/purity -- runs at call time, not render
    insertAtTop({
      paginatedQuery: api.directMessages.list,
      argsToMatch: { threadId: args.threadId },
      localQueryStore: localStore,
      item: {
        _id: crypto.randomUUID() as Id<"directMessages">,
        _creationTime: now,
        threadId: args.threadId,
        authorId: me.id,
        content: args.content,
        createdAt: now,
        authorName: me.name ?? "Unknown",
        authorAvatarUrl: me.avatarUrl,
      },
    });
  });

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-surface-hover px-4 font-semibold text-content-primary">
        <span className="text-content-faint">@</span>
        {other?.name ?? "Direct Message"}
        <Link
          to={`/dm/${threadId}/call`}
          title="Start video call"
          className="ml-auto rounded px-2 py-1 text-lg hover:bg-surface-hover"
        >
          📹
        </Link>
      </header>
      <div className="min-h-0 flex-1">
        <MessageList
          results={results}
          status={status}
          loadMore={loadMore}
          currentUserId={me?.id ?? null}
          onEdit={(id, content) => edit({ messageId: id as Id<"directMessages">, content })}
          onDelete={(id) => remove({ messageId: id as Id<"directMessages"> })}
        />
      </div>
      <MessageComposer
        placeholder={other ? `Message @${other.name}` : "Message"}
        onSend={(content) => send({ threadId, content })}
      />
    </div>
  );
}
