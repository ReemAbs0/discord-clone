// A presence row older than this is treated as offline. Single source of
// truth shared by presence.getForUsers, serverMembers.listForServer (online
// badge), and the crons.sweepStalePresence job so the display threshold and
// the sweep threshold can never drift apart.
export const PRESENCE_STALE_AFTER_MS = 30_000;
