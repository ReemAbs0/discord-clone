import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./lib/authz";
import type { Id } from "./_generated/dataModel";
import type { QueryCtx, MutationCtx } from "./_generated/server";

// Do the two users currently share at least one server? (FR-022)
async function shareAServer(
  ctx: QueryCtx | MutationCtx,
  a: Id<"users">,
  b: Id<"users">,
): Promise<boolean> {
  const aMemberships = await ctx.db
    .query("serverMembers")
    .withIndex("by_user", (q) => q.eq("userId", a))
    .collect();
  for (const membership of aMemberships) {
    const shared = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_and_user", (q) =>
        q.eq("serverId", membership.serverId).eq("userId", b),
      )
      .unique();
    if (shared !== null) return true;
  }
  return false;
}

// Canonical ordering: the lower Id is always userAId, so a pair maps to exactly
// one thread regardless of who opens it (data-model.md DirectMessageThread).
function orderPair(x: Id<"users">, y: Id<"users">): [Id<"users">, Id<"users">] {
  return x < y ? [x, y] : [y, x];
}

export const getOrCreateWithUser = mutation({
  args: { otherUserId: v.id("users") },
  handler: async (ctx, { otherUserId }) => {
    const userId = await requireAuthUserId(ctx);
    if (otherUserId === userId) throw new Error("Cannot open a DM with yourself");
    if (!(await shareAServer(ctx, userId, otherUserId))) {
      throw new Error("You can only message someone you share a server with");
    }

    const [userAId, userBId] = orderPair(userId, otherUserId);
    const existing = await ctx.db
      .query("directMessageThreads")
      .withIndex("by_users", (q) => q.eq("userAId", userAId).eq("userBId", userBId))
      .unique();
    if (existing !== null) return existing._id;

    return await ctx.db.insert("directMessageThreads", {
      userAId,
      userBId,
      createdAt: Date.now(),
    });
  },
});

export const listForMe = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const asA = await ctx.db
      .query("directMessageThreads")
      .withIndex("by_userA", (q) => q.eq("userAId", userId))
      .collect();
    const asB = await ctx.db
      .query("directMessageThreads")
      .withIndex("by_userB", (q) => q.eq("userBId", userId))
      .collect();

    return Promise.all(
      [...asA, ...asB].map(async (thread) => {
        const otherUserId = thread.userAId === userId ? thread.userBId : thread.userAId;
        const other = await ctx.db.get(otherUserId);
        const otherAvatarUrl = other?.avatarStorageId
          ? await ctx.storage.getUrl(other.avatarStorageId)
          : null;
        return {
          _id: thread._id,
          otherUser: {
            id: otherUserId,
            name: other?.name ?? "Unknown",
            avatarUrl: otherAvatarUrl,
          },
        };
      }),
    );
  },
});
