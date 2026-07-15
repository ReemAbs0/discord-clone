import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireCallParticipant } from "./lib/authz";

// WebRTC signaling transport (research.md §3). Both peers must be active call
// participants. `payload` is an opaque JSON string (SDP or ICE candidate) — the
// one intentional untyped-at-the-edge value (plan.md Type Safety note); it is
// parsed only inside the client's RTCPeerConnection, never in app logic.
export const send = mutation({
  args: {
    callId: v.id("calls"),
    toUserId: v.id("users"),
    type: v.union(v.literal("offer"), v.literal("answer"), v.literal("ice-candidate")),
    payload: v.string(),
  },
  handler: async (ctx, { callId, toUserId, type, payload }) => {
    const { userId } = await requireCallParticipant(ctx, callId);

    // Recipient must also be an active participant.
    const recipient = await ctx.db
      .query("callParticipants")
      .withIndex("by_call_and_user", (q) => q.eq("callId", callId).eq("userId", toUserId))
      .unique();
    if (recipient === null || recipient.leftAt !== undefined) {
      throw new Error("Recipient is not an active participant in this call");
    }

    await ctx.db.insert("signals", {
      callId,
      fromUserId: userId,
      toUserId,
      type,
      payload,
      createdAt: Date.now(),
    });
  },
});

// Live subscription for inbound signaling addressed to the caller, from every
// remote peer — the client dispatches each row to the right RTCPeerConnection
// by `fromUserId`.
export const listForMe = query({
  args: { callId: v.id("calls") },
  handler: async (ctx, { callId }) => {
    const { userId } = await requireCallParticipant(ctx, callId);
    return await ctx.db
      .query("signals")
      .withIndex("by_call_and_recipient", (q) => q.eq("callId", callId).eq("toUserId", userId))
      .collect();
  },
});

// Deletes a consumed row. Called only AFTER the payload has been applied
// (research.md §3) so a failed apply leaves it for the next reactive retry.
export const ack = mutation({
  args: { signalId: v.id("signals") },
  handler: async (ctx, { signalId }) => {
    const signal = await ctx.db.get(signalId);
    if (signal === null) return; // already gone — nothing to ack
    const { userId } = await requireCallParticipant(ctx, signal.callId);
    if (signal.toUserId !== userId) {
      throw new Error("Cannot ack a signal addressed to someone else");
    }
    await ctx.db.delete(signalId);
  },
});
