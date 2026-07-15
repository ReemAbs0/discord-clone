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

// Owner + a second joined member sharing a server's general channel.
async function setUp(t: ReturnType<typeof makeConvexTest>) {
  const owner = await createUser(t, "Owner");
  const serverId = await owner.asUser.mutation(api.servers.create, { name: "Test Server" });
  const channelId = (
    await t.run((ctx) =>
      ctx.db
        .query("channels")
        .withIndex("by_server", (q) => q.eq("serverId", serverId))
        .collect(),
    )
  )[0]._id;
  const { code } = await owner.asUser.mutation(api.invites.getOrCreateForServer, { serverId });
  const member = await createUser(t, "Member");
  await member.asUser.mutation(api.invites.consume, { code });
  return { owner, member, serverId, channelId };
}

describe("messages edit/remove", () => {
  it("author can edit their own message and it is marked edited", async () => {
    const t = makeConvexTest();
    const { owner, channelId } = await setUp(t);
    const messageId = await owner.asUser.mutation(api.messages.send, {
      channelId,
      content: "orignal",
    });

    await owner.asUser.mutation(api.messages.edit, { messageId, content: "original" });

    const stored = await t.run((ctx) => ctx.db.get(messageId));
    expect(stored?.content).toBe("original");
    expect(stored?.editedAt).toBeTypeOf("number");
  });

  it("a non-author cannot edit someone else's message (FR-019)", async () => {
    const t = makeConvexTest();
    const { owner, member, channelId } = await setUp(t);
    const messageId = await owner.asUser.mutation(api.messages.send, {
      channelId,
      content: "owner's message",
    });

    await expect(
      member.asUser.mutation(api.messages.edit, { messageId, content: "hijacked" }),
    ).rejects.toThrow();
  });

  it("author can delete their own message", async () => {
    const t = makeConvexTest();
    const { owner, channelId } = await setUp(t);
    const messageId = await owner.asUser.mutation(api.messages.send, {
      channelId,
      content: "delete me",
    });

    await owner.asUser.mutation(api.messages.remove, { messageId });

    expect(await t.run((ctx) => ctx.db.get(messageId))).toBeNull();
  });

  it("a non-author cannot delete someone else's message (FR-019)", async () => {
    const t = makeConvexTest();
    const { owner, member, channelId } = await setUp(t);
    const messageId = await owner.asUser.mutation(api.messages.send, {
      channelId,
      content: "owner's message",
    });

    await expect(
      member.asUser.mutation(api.messages.remove, { messageId }),
    ).rejects.toThrow();
  });
});

describe("typingIndicators", () => {
  it("heartbeat upserts a single row per (channel, user)", async () => {
    const t = makeConvexTest();
    const { owner, channelId } = await setUp(t);

    await owner.asUser.mutation(api.typingIndicators.heartbeat, { channelId });
    await owner.asUser.mutation(api.typingIndicators.heartbeat, { channelId });

    const rows = await t.run((ctx) => ctx.db.query("typingIndicators").collect());
    expect(rows).toHaveLength(1);
  });

  it("listForChannel shows other typists but excludes the caller (FR-021)", async () => {
    const t = makeConvexTest();
    const { owner, member, channelId } = await setUp(t);

    await member.asUser.mutation(api.typingIndicators.heartbeat, { channelId });

    // Owner sees the member typing.
    const ownerView = await owner.asUser.query(api.typingIndicators.listForChannel, { channelId });
    expect(ownerView.map((t) => t.name)).toEqual(["Member"]);

    // The member does not see themselves.
    const memberView = await member.asUser.query(api.typingIndicators.listForChannel, {
      channelId,
    });
    expect(memberView).toHaveLength(0);
  });

  it("heartbeat requires channel membership", async () => {
    const t = makeConvexTest();
    const { channelId } = await setUp(t);
    const { asUser: asStranger } = await createUser(t, "Stranger");

    await expect(
      asStranger.mutation(api.typingIndicators.heartbeat, { channelId }),
    ).rejects.toThrow();
  });
});
