import { mutation } from "./_generated/server";
import { requireAuthUserId } from "./lib/authz";

// Shared by avatar uploads (users.ts) and server-image uploads (servers.ts) —
// one generic upload-URL mutation rather than two near-identical ones
// (constitution: Simplicity First).
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuthUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});
