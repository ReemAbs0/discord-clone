// A presence row older than this is treated as offline. Single source of
// truth shared by presence.getForUsers, serverMembers.listForServer (online
// badge), and the crons.sweepStalePresence job so the display threshold and
// the sweep threshold can never drift apart.
export const PRESENCE_STALE_AFTER_MS = 30_000;

// A typing-indicator row older than this is treated as "stopped typing".
// Shared by typingIndicators.listForChannel (display) and the
// crons.sweepStaleTyping job (research.md §2).
export const TYPING_STALE_AFTER_MS = 5_000;
