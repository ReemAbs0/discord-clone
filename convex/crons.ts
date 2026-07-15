import { cronJobs } from "convex/server";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// research.md §2: this delete is a write, so it pushes an immediate reactive
// update to every subscriber — the "went offline" transition for a client
// that vanished without a clean sign-out is delivered the same way a message
// is, not via any client-side polling.
const PRESENCE_STALE_AFTER_MS = 30_000;

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

crons.interval(
  "sweep stale presence",
  { seconds: 15 },
  internal.crons.sweepStalePresence,
  {},
);

export default crons;
