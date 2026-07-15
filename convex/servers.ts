import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId, requireServerMember, requireServerOwner } from "./lib/authz";
import type { Doc } from "./_generated/dataModel";

async function withImageUrl(ctx: { storage: { getUrl: (id: unknown) => Promise<string | null> } }, server: Doc<"servers">) {
  const imageUrl = server.imageStorageId ? await ctx.storage.getUrl(server.imageStorageId) : null;
  return { ...server, imageUrl };
}

// Atomic: a single mutation is one Convex transaction, so the server, the
// owner's membership row, and the default "general" channel either all
// commit together or none do (FR-004, FR-005).
export const create = mutation({
  args: { name: v.string(), imageStorageId: v.optional(v.id("_storage")) },
  handler: async (ctx, { name, imageStorageId }) => {
    const userId = await requireAuthUserId(ctx);
    const now = Date.now();

    const serverId = await ctx.db.insert("servers", {
      name,
      imageStorageId,
      ownerId: userId,
      createdAt: now,
    });
    await ctx.db.insert("serverMembers", { serverId, userId, joinedAt: now });
    await ctx.db.insert("channels", {
      serverId,
      name: "general",
      type: "text",
      createdAt: now,
    });

    return serverId;
  },
});

export const listForMe = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const memberships = await ctx.db
      .query("serverMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const servers = await Promise.all(memberships.map((m) => ctx.db.get(m.serverId)));
    const found = servers.filter((s): s is Doc<"servers"> => s !== null);
    return Promise.all(found.map((s) => withImageUrl(ctx, s)));
  },
});

export const get = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    await requireServerMember(ctx, serverId);
    const server = await ctx.db.get(serverId);
    if (server === null) throw new Error("Server not found");
    return withImageUrl(ctx, server);
  },
});

export const rename = mutation({
  args: { serverId: v.id("servers"), name: v.string() },
  handler: async (ctx, { serverId, name }) => {
    await requireServerOwner(ctx, serverId);
    await ctx.db.patch(serverId, { name });
  },
});
