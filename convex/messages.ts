import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import { requireChannelMember } from "./lib/authz";

// edit/remove land in US4 (T041) — send/list is the full US2 scope.

export const list = query({
  args: { channelId: v.id("channels"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { channelId, paginationOpts }) => {
    await requireChannelMember(ctx, channelId);

    const page = await ctx.db
      .query("messages")
      .withIndex("by_channel_and_creation", (q) => q.eq("channelId", channelId))
      .order("desc")
      .paginate(paginationOpts);

    // FR-016: every message must show the author's name/avatar. Joined at
    // read time against `users` rather than denormalized onto the message
    // document, so a later name/avatar change is reflected immediately
    // instead of the message freezing a stale copy (data-model.md Message).
    const enrichedPage = await Promise.all(
      page.page.map(async (message) => {
        const author = await ctx.db.get(message.authorId);
        const authorAvatarUrl = author?.avatarStorageId
          ? await ctx.storage.getUrl(author.avatarStorageId)
          : null;
        return {
          ...message,
          authorName: author?.name ?? "Unknown",
          authorAvatarUrl,
        };
      }),
    );

    return { ...page, page: enrichedPage };
  },
});

export const send = mutation({
  args: { channelId: v.id("channels"), content: v.string() },
  handler: async (ctx, { channelId, content }) => {
    const { userId } = await requireChannelMember(ctx, channelId);
    return await ctx.db.insert("messages", {
      channelId,
      authorId: userId,
      content,
      createdAt: Date.now(),
    });
  },
});
