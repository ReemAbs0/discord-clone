import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireChannelMember } from "./lib/authz";
import { TYPING_STALE_AFTER_MS } from "./lib/constants";

// The client calls this on a throttle while composing (research.md §2). Upserts
// one row per (channel, user).
export const heartbeat = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, { channelId }) => {
    const { userId } = await requireChannelMember(ctx, channelId);
    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_channel_and_user", (q) =>
        q.eq("channelId", channelId).eq("userId", userId),
      )
      .unique();
    const lastActiveAt = Date.now();
    if (existing === null) {
      await ctx.db.insert("typingIndicators", { channelId, userId, lastActiveAt });
    } else {
      await ctx.db.patch(existing._id, { lastActiveAt });
    }
  },
});

// FR-021: show OTHER members who are currently typing — the caller is excluded.
// Rows already past the staleness window are filtered out here too, so a typist
// disappears the moment they stop even before the cron sweeps the row.
export const listForChannel = query({
  args: { channelId: v.id("channels") },
  handler: async (ctx, { channelId }) => {
    const { userId } = await requireChannelMember(ctx, channelId);
    const now = Date.now();
    const rows = await ctx.db
      .query("typingIndicators")
      .withIndex("by_channel", (q) => q.eq("channelId", channelId))
      .collect();

    const fresh = rows.filter(
      (row) => row.userId !== userId && now - row.lastActiveAt < TYPING_STALE_AFTER_MS,
    );
    return Promise.all(
      fresh.map(async (row) => {
        const user = await ctx.db.get(row.userId);
        return { userId: row.userId, name: user?.name ?? "Someone" };
      }),
    );
  },
});
