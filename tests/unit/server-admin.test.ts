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

// Owner + an invited member sharing a server.
async function setUp(t: ReturnType<typeof makeConvexTest>) {
  const owner = await createUser(t, "Owner");
  const serverId = await owner.asUser.mutation(api.servers.create, { name: "Test Server" });
  const { code } = await owner.asUser.mutation(api.invites.getOrCreateForServer, { serverId });
  const member = await createUser(t, "Member");
  await member.asUser.mutation(api.invites.consume, { code });
  return { owner, member, serverId };
}

async function isMember(
  t: ReturnType<typeof makeConvexTest>,
  serverId: Id<"servers">,
  userId: Id<"users">,
) {
  const row = await t.run((ctx) =>
    ctx.db
      .query("serverMembers")
      .withIndex("by_server_and_user", (q) => q.eq("serverId", serverId).eq("userId", userId))
      .unique(),
  );
  return row !== null;
}

describe("serverMembers.remove (US8)", () => {
  it("owner can remove a member, revoking their access (FR-010)", async () => {
    const t = makeConvexTest();
    const { owner, member, serverId } = await setUp(t);

    await owner.asUser.mutation(api.serverMembers.remove, { serverId, userId: member.userId });

    expect(await isMember(t, serverId, member.userId)).toBe(false);
    // Removed member can no longer read the server's channels.
    await expect(
      member.asUser.query(api.channels.listForServer, { serverId }),
    ).rejects.toThrow();
  });

  it("a non-owner cannot remove members", async () => {
    const t = makeConvexTest();
    const { owner, member, serverId } = await setUp(t);

    await expect(
      member.asUser.mutation(api.serverMembers.remove, { serverId, userId: owner.userId }),
    ).rejects.toThrow();
  });

  it("the owner cannot be removed", async () => {
    const t = makeConvexTest();
    const { owner, serverId } = await setUp(t);

    await expect(
      owner.asUser.mutation(api.serverMembers.remove, { serverId, userId: owner.userId }),
    ).rejects.toThrow();
    expect(await isMember(t, serverId, owner.userId)).toBe(true);
  });

  it("removing a member drops them from an active voice call (US8 AC2)", async () => {
    const t = makeConvexTest();
    const { owner, member, serverId } = await setUp(t);
    const voiceChannelId = await owner.asUser.mutation(api.channels.create, {
      serverId,
      name: "Lounge",
      type: "voice",
    });
    const callId = await member.asUser.mutation(api.calls.getOrCreateForChannel, {
      channelId: voiceChannelId,
    });
    const participantId = await member.asUser.mutation(api.calls.join, { callId });

    await owner.asUser.mutation(api.serverMembers.remove, { serverId, userId: member.userId });

    const participant = await t.run((ctx) => ctx.db.get(participantId));
    expect(participant?.leftAt).toBeTypeOf("number");
  });

  it("owner can rename the server (servers.rename)", async () => {
    const t = makeConvexTest();
    const { owner, member, serverId } = await setUp(t);

    await expect(
      member.asUser.mutation(api.servers.rename, { serverId, name: "Hijacked" }),
    ).rejects.toThrow();

    await owner.asUser.mutation(api.servers.rename, { serverId, name: "Renamed" });
    const server = await t.run((ctx) => ctx.db.get(serverId));
    expect(server?.name).toBe("Renamed");
  });
});
