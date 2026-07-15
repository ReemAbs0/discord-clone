import { describe, expect, it } from "vitest";
import { makeConvexTest } from "./convexTestHelper";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

async function createUser(t: ReturnType<typeof makeConvexTest>, name: string) {
  const userId: Id<"users"> = await t.run(async (ctx) => {
    return await ctx.db.insert("users", { name, email: `${name.toLowerCase()}@example.com` });
  });
  return { userId, asUser: t.withIdentity({ subject: userId }) };
}

async function setUp(t: ReturnType<typeof makeConvexTest>) {
  const owner = await createUser(t, "Owner");
  const serverId = await owner.asUser.mutation(api.servers.create, { name: "Test Server" });
  const { code } = await owner.asUser.mutation(api.invites.getOrCreateForServer, { serverId });
  const member = await createUser(t, "Member");
  await member.asUser.mutation(api.invites.consume, { code });
  return { owner, member, serverId };
}

async function generalChannelId(t: ReturnType<typeof makeConvexTest>, serverId: Id<"servers">) {
  const channels = await t.run((ctx) =>
    ctx.db
      .query("channels")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .collect(),
  );
  return channels[0]._id;
}

describe("channels.ts", () => {
  it("owner can create text and voice channels", async () => {
    const t = makeConvexTest();
    const { owner, serverId } = await setUp(t);

    await owner.asUser.mutation(api.channels.create, { serverId, name: "random", type: "text" });
    await owner.asUser.mutation(api.channels.create, { serverId, name: "Lounge", type: "voice" });

    const channels = await owner.asUser.query(api.channels.listForServer, { serverId });
    expect(channels).toHaveLength(3); // general + 2 new
    expect(channels.filter((c) => c.type === "voice")).toHaveLength(1);
  });

  it("a non-owner member cannot create/rename/delete channels (FR-012)", async () => {
    const t = makeConvexTest();
    const { member, serverId } = await setUp(t);
    const channelId = await generalChannelId(t, serverId);

    await expect(
      member.asUser.mutation(api.channels.create, { serverId, name: "nope", type: "text" }),
    ).rejects.toThrow();
    await expect(
      member.asUser.mutation(api.channels.rename, { channelId, name: "nope" }),
    ).rejects.toThrow();
    await expect(member.asUser.mutation(api.channels.remove, { channelId })).rejects.toThrow();
  });

  it("owner can rename a channel", async () => {
    const t = makeConvexTest();
    const { owner, serverId } = await setUp(t);
    const channelId = await generalChannelId(t, serverId);

    await owner.asUser.mutation(api.channels.rename, { channelId, name: "lobby" });

    const channel = await t.run((ctx) => ctx.db.get(channelId));
    expect(channel?.name).toBe("lobby");
  });

  it("deleting a channel cascades — its messages are removed too (FR-013)", async () => {
    const t = makeConvexTest();
    const { owner, serverId } = await setUp(t);
    const channelId = await generalChannelId(t, serverId);
    await owner.asUser.mutation(api.messages.send, { channelId, content: "hello" });
    await owner.asUser.mutation(api.messages.send, { channelId, content: "world" });

    await owner.asUser.mutation(api.channels.remove, { channelId });

    expect(await t.run((ctx) => ctx.db.get(channelId))).toBeNull();
    const remainingMessages = await t.run((ctx) =>
      ctx.db
        .query("messages")
        .withIndex("by_channel_and_creation", (q) => q.eq("channelId", channelId))
        .collect(),
    );
    expect(remainingMessages).toHaveLength(0);
  });

  it("deleting a voice channel ends any active call and drops participants (Edge Cases)", async () => {
    const t = makeConvexTest();
    const { owner, serverId } = await setUp(t);
    const voiceChannelId = await owner.asUser.mutation(api.channels.create, {
      serverId,
      name: "Lounge",
      type: "voice",
    });
    // Simulate an active call with a connected participant (calls UI is US7,
    // so seed the rows directly).
    const { callId, participantId } = await t.run(async (ctx) => {
      const callId = await ctx.db.insert("calls", {
        kind: "voice-channel",
        channelId: voiceChannelId,
        startedAt: Date.now(),
      });
      const participantId = await ctx.db.insert("callParticipants", {
        callId,
        userId: owner.userId,
        joinedAt: Date.now(),
        micOn: true,
        cameraOn: false,
      });
      return { callId, participantId };
    });

    await owner.asUser.mutation(api.channels.remove, { channelId: voiceChannelId });

    const call = await t.run((ctx) => ctx.db.get(callId));
    const participant = await t.run((ctx) => ctx.db.get(participantId));
    expect(call?.endedAt).toBeTypeOf("number");
    expect(participant?.leftAt).toBeTypeOf("number");
  });
});
