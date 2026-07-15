import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAuthUserId, requireServerOwner } from "./lib/authz";

function generateInviteCode(): string {
  // Convex's runtime provides the Web Crypto API; a UUID (dashes stripped) is
  // a URL-safe, collision-resistant token.
  return crypto.randomUUID().replace(/-/g, "");
}

// Idempotent: returns the server's existing invite if one exists, never
// creating a second (data-model.md Invite regenerate semantics). Owner-only.
export const getOrCreateForServer = mutation({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    const { userId } = await requireServerOwner(ctx, serverId);
    const existing = await ctx.db
      .query("invites")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .first();
    if (existing !== null) return { code: existing.code };

    const code = generateInviteCode();
    await ctx.db.insert("invites", { serverId, code, createdBy: userId, createdAt: Date.now() });
    return { code };
  },
});

// Deletes the current invite(s) and issues a fresh code, invalidating the old
// link (matches "the owner can generate a new link at any time"). Owner-only.
export const regenerate = mutation({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    const { userId } = await requireServerOwner(ctx, serverId);
    const existing = await ctx.db
      .query("invites")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .collect();
    for (const invite of existing) await ctx.db.delete(invite._id);

    const code = generateInviteCode();
    await ctx.db.insert("invites", { serverId, code, createdBy: userId, createdAt: Date.now() });
    return { code };
  },
});

// Any authenticated user with a valid code joins the server. Idempotent —
// re-consuming when already a member is a no-op (FR-007).
export const consume = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await requireAuthUserId(ctx);
    const invite = await ctx.db
      .query("invites")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (invite === null) throw new Error("Invalid or expired invite link");

    const { serverId } = invite;
    const existing = await ctx.db
      .query("serverMembers")
      .withIndex("by_server_and_user", (q) => q.eq("serverId", serverId).eq("userId", userId))
      .unique();
    if (existing === null) {
      await ctx.db.insert("serverMembers", { serverId, userId, joinedAt: Date.now() });
    }
    return { serverId };
  },
});
