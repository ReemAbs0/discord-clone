import { useParams } from "react-router-dom";
import type { Id } from "../../convex/_generated/dataModel";
import MessageList from "../components/chat/MessageList";
import MessageComposer from "../components/chat/MessageComposer";
import TypingIndicator from "../components/chat/TypingIndicator";

export default function ChannelPage() {
  const { channelId } = useParams<{ channelId: Id<"channels"> }>();
  if (!channelId) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <MessageList channelId={channelId} />
      </div>
      <TypingIndicator channelId={channelId} />
      <MessageComposer channelId={channelId} />
    </div>
  );
}
