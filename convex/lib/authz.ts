import { getAuthUserId } from "@convex-dev/auth/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;

// Every other helper below builds on this — constitution Security Basics:
// resolve identity server-side on every call, never trust the client.
export async function requireAuthUserId(ctx: Ctx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  return userId;
}

export async function requireServerMember(ctx: Ctx, serverId: Id<"servers">) {
  const userId = await requireAuthUserId(ctx);
  const membership = await ctx.db
    .query("serverMembers")
    .withIndex("by_server_and_user", (q) => q.eq("serverId", serverId).eq("userId", userId))
    .unique();
  if (membership === null) throw new Error("Not a member of this server");
  return { userId, membership };
}

export async function requireServerOwner(ctx: Ctx, serverId: Id<"servers">) {
  const userId = await requireAuthUserId(ctx);
  const server = await ctx.db.get(serverId);
  if (server === null) throw new Error("Server not found");
  if (server.ownerId !== userId) throw new Error("Only the server owner can do this");
  return { userId, server };
}

// Channels are scoped by server, not membership directly — resolve the
// channel's server first, then apply the same membership check.
export async function requireChannelMember(ctx: Ctx, channelId: Id<"channels">) {
  const channel = await ctx.db.get(channelId);
  if (channel === null) throw new Error("Channel not found");
  const { userId } = await requireServerMember(ctx, channel.serverId);
  return { userId, channel };
}

export async function requireAuthor<T extends { authorId: Id<"users"> }>(
  ctx: Ctx,
  doc: T,
): Promise<Id<"users">> {
  const userId = await requireAuthUserId(ctx);
  if (doc.authorId !== userId) throw new Error("Only the author can do this");
  return userId;
}

export async function requireCallParticipant(ctx: Ctx, callId: Id<"calls">) {
  const userId = await requireAuthUserId(ctx);
  const participant = await ctx.db
    .query("callParticipants")
    .withIndex("by_call_and_user", (q) => q.eq("callId", callId).eq("userId", userId))
    .unique();
  if (participant === null || participant.leftAt !== undefined) {
    throw new Error("Not an active participant in this call");
  }
  return { userId, participant };
}
