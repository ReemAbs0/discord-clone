import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

// FR-021: shows who else is currently composing in this channel. The query
// already excludes the current user and stale rows, so this just formats the
// live list. Fixed height so message text above it doesn't jump as it
// appears/disappears.
export default function TypingIndicator({ channelId }: { channelId: Id<"channels"> }) {
  const typists = useQuery(api.typingIndicators.listForChannel, { channelId });

  const label = formatTypists(typists?.map((t) => t.name) ?? []);

  return (
    <div className="h-5 px-4 text-xs text-content-muted">
      {label && (
        <span>
          <span className="font-semibold">{label}</span>
        </span>
      )}
    </div>
  );
}

function formatTypists(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  if (names.length === 3) return `${names[0]}, ${names[1]}, and ${names[2]} are typing…`;
  return "Several people are typing…";
}
