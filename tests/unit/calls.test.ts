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

// A server with a voice channel, an owner, and a helper to add more members.
async function setUp(t: ReturnType<typeof makeConvexTest>) {
  const owner = await createUser(t, "Owner");
  const serverId = await owner.asUser.mutation(api.servers.create, { name: "Test Server" });
  const { code } = await owner.asUser.mutation(api.invites.getOrCreateForServer, { serverId });
  const voiceChannelId = await owner.asUser.mutation(api.channels.create, {
    serverId,
    name: "Lounge",
    type: "voice",
  });

  async function addMember(name: string) {
    const u = await createUser(t, name);
    await u.asUser.mutation(api.invites.consume, { code });
    return u;
  }

  return { owner, serverId, voiceChannelId, addMember };
}

describe("calls.ts", () => {
  it("getOrCreateForChannel is idempotent while a call is active", async () => {
    const t = makeConvexTest();
    const { owner, voiceChannelId } = await setUp(t);

    const a = await owner.asUser.mutation(api.calls.getOrCreateForChannel, {
      channelId: voiceChannelId,
    });
    const b = await owner.asUser.mutation(api.calls.getOrCreateForChannel, {
      channelId: voiceChannelId,
    });
    expect(b).toBe(a);
  });

  it("a non-member cannot get/join the channel's call", async () => {
    const t = makeConvexTest();
    const { voiceChannelId } = await setUp(t);
    const { asUser: asStranger } = await createUser(t, "Stranger");

    await expect(
      asStranger.mutation(api.calls.getOrCreateForChannel, { channelId: voiceChannelId }),
    ).rejects.toThrow();
  });

  it("join is idempotent and reflected in listParticipants", async () => {
    const t = makeConvexTest();
    const { owner, voiceChannelId } = await setUp(t);
    const callId = await owner.asUser.mutation(api.calls.getOrCreateForChannel, {
      channelId: voiceChannelId,
    });

    await owner.asUser.mutation(api.calls.join, { callId });
    await owner.asUser.mutation(api.calls.join, { callId }); // repeat = no-op

    const participants = await owner.asUser.query(api.calls.listParticipants, { callId });
    expect(participants).toHaveLength(1);
    expect(participants[0].micOn).toBe(true);
    expect(participants[0].cameraOn).toBe(false);
  });

  it("rejects a 5th participant at the 4-cap (FR-025)", async () => {
    const t = makeConvexTest();
    const { owner, voiceChannelId, addMember } = await setUp(t);
    const callId = await owner.asUser.mutation(api.calls.getOrCreateForChannel, {
      channelId: voiceChannelId,
    });

    await owner.asUser.mutation(api.calls.join, { callId });
    const m1 = await addMember("M1");
    const m2 = await addMember("M2");
    const m3 = await addMember("M3");
    const m4 = await addMember("M4");
    await m1.asUser.mutation(api.calls.join, { callId });
    await m2.asUser.mutation(api.calls.join, { callId });
    await m3.asUser.mutation(api.calls.join, { callId }); // 4th — OK

    await expect(m4.asUser.mutation(api.calls.join, { callId })).rejects.toThrow(/full/i);
  });

  it("a freed slot lets a new participant join (leave decrements the count)", async () => {
    const t = makeConvexTest();
    const { owner, voiceChannelId, addMember } = await setUp(t);
    const callId = await owner.asUser.mutation(api.calls.getOrCreateForChannel, {
      channelId: voiceChannelId,
    });
    await owner.asUser.mutation(api.calls.join, { callId });
    const members = [];
    for (const name of ["M1", "M2", "M3"]) {
      const m = await addMember(name);
      await m.asUser.mutation(api.calls.join, { callId });
      members.push(m);
    }
    // Full (4). One leaves.
    await members[0].asUser.mutation(api.calls.leave, { callId });
    const latecomer = await addMember("Latecomer");
    await expect(
      latecomer.asUser.mutation(api.calls.join, { callId }),
    ).resolves.toBeDefined();
  });

  it("leave is idempotent — calling it again is a no-op, not an error", async () => {
    const t = makeConvexTest();
    const { owner, voiceChannelId } = await setUp(t);
    const callId = await owner.asUser.mutation(api.calls.getOrCreateForChannel, {
      channelId: voiceChannelId,
    });
    await owner.asUser.mutation(api.calls.join, { callId });
    await owner.asUser.mutation(api.calls.leave, { callId });
    // A redundant leave (e.g. explicit "Leave" + unmount cleanup) must not throw.
    await expect(owner.asUser.mutation(api.calls.leave, { callId })).resolves.toBeNull();
  });

  it("leave by the last participant ends the call", async () => {
    const t = makeConvexTest();
    const { owner, voiceChannelId } = await setUp(t);
    const callId = await owner.asUser.mutation(api.calls.getOrCreateForChannel, {
      channelId: voiceChannelId,
    });
    await owner.asUser.mutation(api.calls.join, { callId });
    await owner.asUser.mutation(api.calls.leave, { callId });

    const call = await t.run((ctx) => ctx.db.get(callId));
    expect(call?.endedAt).toBeTypeOf("number");
  });

  it("setMicCamera only updates the caller's own row", async () => {
    const t = makeConvexTest();
    const { owner, voiceChannelId } = await setUp(t);
    const callId = await owner.asUser.mutation(api.calls.getOrCreateForChannel, {
      channelId: voiceChannelId,
    });
    await owner.asUser.mutation(api.calls.join, { callId });

    await owner.asUser.mutation(api.calls.setMicCamera, { callId, micOn: false, cameraOn: true });
    const participants = await owner.asUser.query(api.calls.listParticipants, { callId });
    expect(participants[0].micOn).toBe(false);
    expect(participants[0].cameraOn).toBe(true);
  });

  it("listActiveForServer reports who's connected to each voice channel (FR-030)", async () => {
    const t = makeConvexTest();
    const { owner, serverId, voiceChannelId } = await setUp(t);
    const callId = await owner.asUser.mutation(api.calls.getOrCreateForChannel, {
      channelId: voiceChannelId,
    });
    await owner.asUser.mutation(api.calls.join, { callId });

    const active = await owner.asUser.query(api.calls.listActiveForServer, { serverId });
    expect(active).toHaveLength(1);
    expect(active[0].channelId).toBe(voiceChannelId);
    expect(active[0].participants.map((p) => p.name)).toEqual(["Owner"]);
  });

  it("signals require both parties to be active participants", async () => {
    const t = makeConvexTest();
    const { owner, voiceChannelId, addMember } = await setUp(t);
    const callId = await owner.asUser.mutation(api.calls.getOrCreateForChannel, {
      channelId: voiceChannelId,
    });
    await owner.asUser.mutation(api.calls.join, { callId });
    const other = await addMember("Other");

    // Owner is in; other has NOT joined → sending to them is rejected.
    await expect(
      owner.asUser.mutation(api.signals.send, {
        callId,
        toUserId: other.userId,
        type: "offer",
        payload: "{}",
      }),
    ).rejects.toThrow();

    // Once both are in, the signal is delivered to the recipient only.
    await other.asUser.mutation(api.calls.join, { callId });
    await owner.asUser.mutation(api.signals.send, {
      callId,
      toUserId: other.userId,
      type: "offer",
      payload: "{}",
    });
    const inbox = await other.asUser.query(api.signals.listForMe, { callId });
    expect(inbox).toHaveLength(1);
    const ownerInbox = await owner.asUser.query(api.signals.listForMe, { callId });
    expect(ownerInbox).toHaveLength(0);
  });
});
