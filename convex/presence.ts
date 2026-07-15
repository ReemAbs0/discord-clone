import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./lib/authz";
import { PRESENCE_STALE_AFTER_MS } from "./lib/constants";

export const heartbeat = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const lastActiveAt = Date.now();
    if (existing === null) {
      await ctx.db.insert("presence", { userId, lastActiveAt });
    } else {
      await ctx.db.patch(existing._id, { lastActiveAt });
    }
  },
});

// Called from the sign-out action for the eager "offline" transition
// (research.md §2) — deletes immediately rather than waiting on the cron
// sweep, so logout is reflected to other viewers like any other write.
export const clearMine = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const existing = await ctx.db
      .query("presence")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (existing !== null) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const getForUsers = query({
  args: { userIds: v.array(v.id("users")) },
  handler: async (ctx, { userIds }) => {
    await requireAuthUserId(ctx);
    const now = Date.now();
    const results = await Promise.all(
      userIds.map(async (userId) => {
        const row = await ctx.db
          .query("presence")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .unique();
        const online = row !== null && now - row.lastActiveAt < PRESENCE_STALE_AFTER_MS;
        return { userId, online };
      }),
    );
    return results;
  },
});
