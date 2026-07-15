import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthUserId } from "./lib/authz";

export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const user = await ctx.db.get(userId);
    if (user === null) return null;
    const avatarUrl = user.avatarStorageId ? await ctx.storage.getUrl(user.avatarStorageId) : null;
    // `id` isn't in the original contracts.md shape — added during
    // implementation once the frontend needed a way to reference "myself" in
    // other queries (e.g. presence lookups for your own online indicator).
    return { id: userId, name: user.name ?? null, email: user.email ?? null, avatarUrl };
  },
});

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    avatarStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, { name, avatarStorageId }) => {
    const userId = await requireAuthUserId(ctx);
    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (avatarStorageId !== undefined) patch.avatarStorageId = avatarStorageId;
    await ctx.db.patch(userId, patch);
  },
});
