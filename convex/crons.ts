import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { PRESENCE_STALE_AFTER_MS, TYPING_STALE_AFTER_MS } from "./lib/constants";

const crons = cronJobs();

// research.md §2: this delete is a write, so it pushes an immediate reactive
// update to every subscriber — the "went offline" transition for a client
// that vanished without a clean sign-out is delivered the same way a message
// is, not via any client-side polling.

export const sweepStalePresence = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - PRESENCE_STALE_AFTER_MS;
    const rows = await ctx.db.query("presence").collect();
    for (const row of rows) {
      if (row.lastActiveAt < cutoff) {
        await ctx.db.delete(row._id);
      }
    }
  },
});

export const sweepStaleTyping = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - TYPING_STALE_AFTER_MS;
    const rows = await ctx.db.query("typingIndicators").collect();
    for (const row of rows) {
      if (row.lastActiveAt < cutoff) {
        await ctx.db.delete(row._id);
      }
    }
  },
});

// Safety net for signaling rows a client never acked (e.g. it crashed mid-call).
// Consumed rows are normally deleted immediately by signals.ack; anything left
// over for 5 minutes is stale and safe to drop (research.md §3).
const SIGNAL_MAX_AGE_MS = 5 * 60_000;

export const sweepOrphanedSignals = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - SIGNAL_MAX_AGE_MS;
    const rows = await ctx.db.query("signals").collect();
    for (const row of rows) {
      if (row.createdAt < cutoff) {
        await ctx.db.delete(row._id);
      }
    }
  },
});

crons.interval(
  "sweep stale presence",
  { seconds: 15 },
  internal.crons.sweepStalePresence,
  {},
);

crons.interval(
  "sweep stale typing indicators",
  { seconds: 5 },
  internal.crons.sweepStaleTyping,
  {},
);

crons.interval(
  "sweep orphaned signals",
  { seconds: 60 },
  internal.crons.sweepOrphanedSignals,
  {},
);

export default crons;
