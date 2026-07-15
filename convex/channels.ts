import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireChannelOwner, requireServerMember, requireServerOwner } from "./lib/authz";

// FR-011: every member sees the full channel list.
export const listForServer = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    await requireServerMember(ctx, serverId);
    return await ctx.db
      .query("channels")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .collect();
  },
});

// Owner-only (FR-012).
export const create = mutation({
  args: {
    serverId: v.id("servers"),
    name: v.string(),
    type: v.union(v.literal("text"), v.literal("voice")),
  },
  handler: async (ctx, { serverId, name, type }) => {
    await requireServerOwner(ctx, serverId);
    return await ctx.db.insert("channels", { serverId, name, type, createdAt: Date.now() });
  },
});

// Owner-only (FR-012).
export const rename = mutation({
  args: { channelId: v.id("channels"), name: v.string() },
  handler: async (ctx, { channelId, name }) => {
    await requireChannelOwner(ctx, channelId);
    await ctx.db.patch(channelId, { name });
  },
});

// Owner-only (FR-012/FR-013). Cascades: deletes the channel's messages (and
// ephemeral typing rows), and — for a voice channel — ends any active call so
// participants are dropped (data-model.md Channel cascade, spec Edge Cases).
export const remove = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, { channelId }) => {
    const { channel } = await requireChannelOwner(ctx, channelId);

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_channel_and_creation", (q) => q.eq("channelId", channelId))
      .collect();
    for (const message of messages) await ctx.db.delete(message._id);

    const typing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_channel", (q) => q.eq("channelId", channelId))
      .collect();
    for (const row of typing) await ctx.db.delete(row._id);

    if (channel.type === "voice") {
      const now = Date.now();
      const calls = await ctx.db
        .query("calls")
        .withIndex("by_channel", (q) => q.eq("channelId", channelId))
        .collect();
      for (const call of calls) {
        if (call.endedAt === undefined) await ctx.db.patch(call._id, { endedAt: now });
        const participants = await ctx.db
          .query("callParticipants")
          .withIndex("by_call", (q) => q.eq("callId", call._id))
          .collect();
        for (const p of participants) {
          if (p.leftAt === undefined) await ctx.db.patch(p._id, { leftAt: now });
        }
      }
    }

    await ctx.db.delete(channelId);
  },
});
