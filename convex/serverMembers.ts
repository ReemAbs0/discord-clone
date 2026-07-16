import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireServerMember, requireServerOwner } from "./lib/authz";
import { PRESENCE_STALE_AFTER_MS } from "./lib/constants";

// When someone leaves or is removed from a server, drop them from any active
// voice call in that server (US8 AC2 / FR-033: they lose access to channels
// AND calls). Ends a call that becomes empty as a result.
async function dropFromServerCalls(
  ctx: MutationCtx,
  serverId: Id<"servers">,
  userId: Id<"users">,
) {
  const now = Date.now();
  const voiceChannels = await ctx.db
    .query("channels")
    .withIndex("by_server_and_type", (q) => q.eq("serverId", serverId).eq("type", "voice"))
    .collect();
  for (const channel of voiceChannels) {
    const calls = await ctx.db
      .query("calls")
      .withIndex("by_channel", (q) => q.eq("channelId", channel._id))
      .collect();
    for (const call of calls) {
      const mine = await ctx.db
        .query("callParticipants")
        .withIndex("by_call_and_user", (q) => q.eq("callId", call._id).eq("userId", userId))
        .unique();
      if (mine === null || mine.leftAt !== undefined) continue;
      await ctx.db.patch(mine._id, { leftAt: now });
      const remaining = await ctx.db
        .query("callParticipants")
        .withIndex("by_call", (q) => q.eq("callId", call._id))
        .collect();
      if (!remaining.some((p) => p.leftAt === undefined) && call.endedAt === undefined) {
        await ctx.db.patch(call._id, { endedAt: now });
      }
    }
  }
}

// FR-008: member sidebar listing every member with online/offline status.
// Joins each member against `users` (name/avatar) and `presence` (online).
// `isOwner` is derived from servers.ownerId (single source of truth — no role
// field) so the UI can badge the owner and decide who may leave.
export const listForServer = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    await requireServerMember(ctx, serverId);
    const server = await ctx.db.get(serverId);
    const members = await ctx.db
      .query("serverMembers")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .collect();

    const now = Date.now();
    return Promise.all(
      members.map(async (member) => {
        const user = await ctx.db.get(member.userId);
        const avatarUrl = user?.avatarStorageId
          ? await ctx.storage.getUrl(user.avatarStorageId)
          : null;
        const presence = await ctx.db
          .query("presence")
          .withIndex("by_user", (q) => q.eq("userId", member.userId))
          .unique();
        const online = presence !== null && now - presence.lastActiveAt < PRESENCE_STALE_AFTER_MS;
        return {
          _id: member._id,
          userId: member.userId,
          name: user?.name ?? "Unknown",
          avatarUrl,
          online,
          isOwner: server?.ownerId === member.userId,
        };
      }),
    );
  },
});

// FR-033: a non-owner member leaves on their own. The owner cannot leave their
// own server in v1 (ownership transfer/server deletion are out of scope —
// Assumptions).
export const leave = mutation({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    const { userId, membership } = await requireServerMember(ctx, serverId);
    const server = await ctx.db.get(serverId);
    if (server !== null && server.ownerId === userId) {
      throw new Error("The server owner cannot leave their own server");
    }
    await dropFromServerCalls(ctx, serverId, userId);
    await ctx.db.delete(membership._id);
  },
});

// FR-010: the owner removes a member (not themselves — the owner can't be
// removed). Idempotent if the target isn't a member. Also drops the removed
// user from any active call in the server (US8 AC2).
export const remove = mutation({
  args: { serverId: v.id("servers"), userId: v.id("users") },
  handler: async (ctx, { serverId, userId: targetUserId }) => {
    const { server } = await requireServerOwner(ctx, serverId);
    if (server.ownerId === targetUserId) {
      throw new Error("The server owner cannot be removed");
    }
    const membership = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_and_user", (q) =>
        q.eq("serverId", serverId).eq("userId", targetUserId),
      )
      .unique();
    if (membership === null) return; // not a member — no-op
    await dropFromServerCalls(ctx, serverId, targetUserId);
    await ctx.db.delete(membership._id);
  },
});
