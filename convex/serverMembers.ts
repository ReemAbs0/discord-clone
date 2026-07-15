import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireServerMember } from "./lib/authz";
import { PRESENCE_STALE_AFTER_MS } from "./lib/constants";

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
    await ctx.db.delete(membership._id);
  },
});
