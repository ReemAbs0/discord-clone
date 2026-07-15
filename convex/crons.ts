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

export default crons;
