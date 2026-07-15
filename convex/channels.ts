import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireServerMember } from "./lib/authz";

// create/rename/remove land in US5 (T048) — only the read side is needed for
// US2's "general" channel to exist and be visible.
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
