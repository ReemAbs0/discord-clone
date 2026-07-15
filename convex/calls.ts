import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  requireCallParticipant,
  requireChannelMember,
  requireServerMember,
  requireThreadParticipant,
} from "./lib/authz";
import { MAX_CALL_PARTICIPANTS } from "./lib/constants";

// Authorize the caller for a call via its channel/thread (used by callId-based
// functions that don't take the channel/thread directly).
async function requireCallAccess(ctx: QueryCtx | MutationCtx, callId: Id<"calls">) {
  const call = await ctx.db.get(callId);
  if (call === null) throw new Error("Call not found");
  if (call.kind === "voice-channel" && call.channelId != null) {
    const channel = await ctx.db.get(call.channelId);
    if (channel === null) throw new Error("Channel not found");
    const { userId } = await requireServerMember(ctx, channel.serverId);
    return { userId, call };
  }
  if (call.kind === "dm" && call.threadId != null) {
    const { userId } = await requireThreadParticipant(ctx, call.threadId);
    return { userId, call };
  }
  throw new Error("Malformed call");
}

async function enrichParticipant(ctx: QueryCtx | MutationCtx, p: {
  _id: Id<"callParticipants">;
  userId: Id<"users">;
  micOn: boolean;
  cameraOn: boolean;
}) {
  const user = await ctx.db.get(p.userId);
  const avatarUrl = user?.avatarStorageId ? await ctx.storage.getUrl(user.avatarStorageId) : null;
  return {
    _id: p._id,
    userId: p.userId,
    micOn: p.micOn,
    cameraOn: p.cameraOn,
    name: user?.name ?? "Unknown",
    avatarUrl,
  };
}

async function getOrCreateActiveCall(
  ctx: MutationCtx,
  kind: "voice-channel" | "dm",
  key: { channelId?: Id<"channels">; threadId?: Id<"directMessageThreads"> },
) {
  const index = kind === "voice-channel" ? "by_channel" : "by_thread";
  const existing = await ctx.db
    .query("calls")
    .withIndex(index, (q) =>
      kind === "voice-channel"
        ? q.eq("channelId", key.channelId)
        : q.eq("threadId", key.threadId),
    )
    .collect();
  const active = existing.find((c) => c.endedAt === undefined);
  if (active) return active._id;
  return await ctx.db.insert("calls", { kind, ...key, startedAt: Date.now() });
}

export const getOrCreateForChannel = mutation({
  args: { channelId: v.id("channels") },
  handler: async (ctx, { channelId }) => {
    await requireChannelMember(ctx, channelId);
    return await getOrCreateActiveCall(ctx, "voice-channel", { channelId });
  },
});

export const getOrCreateForThread = mutation({
  args: { threadId: v.id("directMessageThreads") },
  handler: async (ctx, { threadId }) => {
    await requireThreadParticipant(ctx, threadId);
    return await getOrCreateActiveCall(ctx, "dm", { threadId });
  },
});

export const join = mutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const { userId } = await requireCallAccess(ctx, callId);
    const participants = await ctx.db
      .query("callParticipants")
      .withIndex("by_call", (q) => q.eq("callId", callId))
      .collect();
    const active = participants.filter((p) => p.leftAt === undefined);
    const mine = participants.find((p) => p.userId === userId);
    if (mine && mine.leftAt === undefined) return mine._id; // already connected (idempotent)
    if (active.length >= MAX_CALL_PARTICIPANTS) {
      throw new Error("This voice channel is full (maximum 4 participants).");
    }
    const now = Date.now();
    if (mine) {
      // Re-join: reset the previous row rather than leaving a duplicate.
      await ctx.db.patch(mine._id, { leftAt: undefined, joinedAt: now, micOn: true, cameraOn: false });
      return mine._id;
    }
    return await ctx.db.insert("callParticipants", {
      callId,
      userId,
      joinedAt: now,
      micOn: true,
      cameraOn: false,
    });
  },
});

// Idempotent: leaving when you're already not an active participant is a no-op,
// not an error — the client may call this redundantly (e.g. an explicit "Leave"
// followed by the page-unmount cleanup, or React StrictMode's double-invoke in
// dev). Auth is still enforced via requireCallAccess.
export const leave = mutation({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const { userId } = await requireCallAccess(ctx, callId);
    const mine = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_and_user", (q) => q.eq("callId", callId).eq("userId", userId))
      .unique();
    if (mine === null || mine.leftAt !== undefined) return; // already out
    await ctx.db.patch(mine._id, { leftAt: Date.now() });

    const remaining = await ctx.db
      .query("callParticipants")
      .withIndex("by_call", (q) => q.eq("callId", callId))
      .collect();
    if (!remaining.some((p) => p.leftAt === undefined)) {
      const call = await ctx.db.get(callId);
      if (call !== null && call.endedAt === undefined) {
        await ctx.db.patch(callId, { endedAt: Date.now() });
      }
    }
  },
});

export const setMicCamera = mutation({
  args: { callId: v.id("calls"), micOn: v.optional(v.boolean()), cameraOn: v.optional(v.boolean()) },
  handler: async (ctx, { callId, micOn, cameraOn }) => {
    const { participant } = await requireCallParticipant(ctx, callId);
    const patch: { micOn?: boolean; cameraOn?: boolean } = {};
    if (micOn !== undefined) patch.micOn = micOn;
    if (cameraOn !== undefined) patch.cameraOn = cameraOn;
    await ctx.db.patch(participant._id, patch);
  },
});

// Active participants only (leftAt unset), enriched with name/avatar for tiles.
export const listParticipants = query({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    await requireCallAccess(ctx, callId);
    const participants = await ctx.db
      .query("callParticipants")
      .withIndex("by_call", (q) => q.eq("callId", callId))
      .collect();
    const active = participants.filter((p) => p.leftAt === undefined);
    return Promise.all(active.map((p) => enrichParticipant(ctx, p)));
  },
});

// FR-030: powers the channel-list "who's connected" indicator. Returns one
// entry per voice channel that currently has ≥1 connected participant.
export const listActiveForServer = query({
  args: { serverId: v.id("servers") },
  handler: async (ctx, { serverId }) => {
    await requireServerMember(ctx, serverId);
    const voiceChannels = await ctx.db
      .query("channels")
      .withIndex("by_server_and_type", (q) => q.eq("serverId", serverId).eq("type", "voice"))
      .collect();

    const entries = await Promise.all(
      voiceChannels.map(async (channel) => {
        const calls = await ctx.db
          .query("calls")
          .withIndex("by_channel", (q) => q.eq("channelId", channel._id))
          .collect();
        const activeCall = calls.find((c) => c.endedAt === undefined);
        if (!activeCall) return { channelId: channel._id, participants: [] };

        const participants = await ctx.db
          .query("callParticipants")
          .withIndex("by_call", (q) => q.eq("callId", activeCall._id))
          .collect();
        const connected = await Promise.all(
          participants
            .filter((p) => p.leftAt === undefined)
            .map(async (p) => {
              const user = await ctx.db.get(p.userId);
              return { userId: p.userId, name: user?.name ?? "Unknown" };
            }),
        );
        return { channelId: channel._id, participants: connected };
      }),
    );

    return entries.filter((e) => e.participants.length > 0);
  },
});
