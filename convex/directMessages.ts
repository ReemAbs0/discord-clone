import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import { requireAuthor, requireThreadParticipant } from "./lib/authz";

// Mirrors messages.ts (FR-023): same real-time delivery, author join, and
// author-only edit/delete — just scoped to a DM thread instead of a channel.
export const list = query({
  args: { threadId: v.id("directMessageThreads"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { threadId, paginationOpts }) => {
    await requireThreadParticipant(ctx, threadId);

    const page = await ctx.db
      .query("directMessages")
      .withIndex("by_thread_and_creation", (q) => q.eq("threadId", threadId))
      .order("desc")
      .paginate(paginationOpts);

    const enrichedPage = await Promise.all(
      page.page.map(async (message) => {
        const author = await ctx.db.get(message.authorId);
        const authorAvatarUrl = author?.avatarStorageId
          ? await ctx.storage.getUrl(author.avatarStorageId)
          : null;
        return { ...message, authorName: author?.name ?? "Unknown", authorAvatarUrl };
      }),
    );

    return { ...page, page: enrichedPage };
  },
});

export const send = mutation({
  args: { threadId: v.id("directMessageThreads"), content: v.string() },
  handler: async (ctx, { threadId, content }) => {
    const { userId } = await requireThreadParticipant(ctx, threadId);
    return await ctx.db.insert("directMessages", {
      threadId,
      authorId: userId,
      content,
      createdAt: Date.now(),
    });
  },
});

export const edit = mutation({
  args: { messageId: v.id("directMessages"), content: v.string() },
  handler: async (ctx, { messageId, content }) => {
    const message = await ctx.db.get(messageId);
    if (message === null) throw new Error("Message not found");
    await requireAuthor(ctx, message);
    await ctx.db.patch(messageId, { content, editedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { messageId: v.id("directMessages") },
  handler: async (ctx, { messageId }) => {
    const message = await ctx.db.get(messageId);
    if (message === null) throw new Error("Message not found");
    await requireAuthor(ctx, message);
    await ctx.db.delete(messageId);
  },
});
