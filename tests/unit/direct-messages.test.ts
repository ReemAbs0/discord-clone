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

// Two users who share a server (owner + invited member) plus a third who does not.
async function setUp(t: ReturnType<typeof makeConvexTest>) {
  const owner = await createUser(t, "Owner");
  const serverId = await owner.asUser.mutation(api.servers.create, { name: "Shared Server" });
  const { code } = await owner.asUser.mutation(api.invites.getOrCreateForServer, { serverId });
  const member = await createUser(t, "Member");
  await member.asUser.mutation(api.invites.consume, { code });
  const stranger = await createUser(t, "Stranger");
  return { owner, member, stranger, serverId };
}

describe("directMessageThreads.ts", () => {
  it("getOrCreateWithUser requires a shared server (FR-022)", async () => {
    const t = makeConvexTest();
    const { owner, stranger } = await setUp(t);

    await expect(
      owner.asUser.mutation(api.directMessageThreads.getOrCreateWithUser, {
        otherUserId: stranger.userId,
      }),
    ).rejects.toThrow();
  });

  it("is canonical — either participant resolves to the same single thread", async () => {
    const t = makeConvexTest();
    const { owner, member } = await setUp(t);

    const fromOwner = await owner.asUser.mutation(api.directMessageThreads.getOrCreateWithUser, {
      otherUserId: member.userId,
    });
    const fromMember = await member.asUser.mutation(api.directMessageThreads.getOrCreateWithUser, {
      otherUserId: owner.userId,
    });

    expect(fromMember).toBe(fromOwner);
    const threads = await t.run((ctx) => ctx.db.query("directMessageThreads").collect());
    expect(threads).toHaveLength(1);
  });

  it("rejects opening a DM with yourself", async () => {
    const t = makeConvexTest();
    const { owner } = await setUp(t);
    await expect(
      owner.asUser.mutation(api.directMessageThreads.getOrCreateWithUser, {
        otherUserId: owner.userId,
      }),
    ).rejects.toThrow();
  });

  it("listForMe returns the thread with the other participant's info", async () => {
    const t = makeConvexTest();
    const { owner, member } = await setUp(t);
    await owner.asUser.mutation(api.directMessageThreads.getOrCreateWithUser, {
      otherUserId: member.userId,
    });

    const ownerThreads = await owner.asUser.query(api.directMessageThreads.listForMe, {});
    expect(ownerThreads).toHaveLength(1);
    expect(ownerThreads[0].otherUser.name).toBe("Member");

    const memberThreads = await member.asUser.query(api.directMessageThreads.listForMe, {});
    expect(memberThreads[0].otherUser.name).toBe("Owner");
  });

  it("an existing DM stays accessible even after the users stop sharing a server (Assumptions)", async () => {
    const t = makeConvexTest();
    const { owner, member, serverId } = await setUp(t);
    const threadId = await owner.asUser.mutation(
      api.directMessageThreads.getOrCreateWithUser,
      { otherUserId: member.userId },
    );
    await member.asUser.mutation(api.serverMembers.leave, { serverId });

    // Member no longer shares a server, but can still use the existing thread.
    const messageId = await member.asUser.mutation(api.directMessages.send, {
      threadId,
      content: "still here",
    });
    expect(await t.run((ctx) => ctx.db.get(messageId))).not.toBeNull();
  });
});

describe("directMessages.ts", () => {
  async function setUpThread(t: ReturnType<typeof makeConvexTest>) {
    const base = await setUp(t);
    const threadId = await base.owner.asUser.mutation(
      api.directMessageThreads.getOrCreateWithUser,
      { otherUserId: base.member.userId },
    );
    return { ...base, threadId };
  }

  it("a non-participant cannot read or send in the thread", async () => {
    const t = makeConvexTest();
    const { stranger, threadId } = await setUpThread(t);

    await expect(
      stranger.asUser.query(api.directMessages.list, {
        threadId,
        paginationOpts: { numItems: 25, cursor: null },
      }),
    ).rejects.toThrow();
    await expect(
      stranger.asUser.mutation(api.directMessages.send, { threadId, content: "intruding" }),
    ).rejects.toThrow();
  });

  it("both participants can send, and list returns author-joined newest-first", async () => {
    const t = makeConvexTest();
    const { owner, member, threadId } = await setUpThread(t);

    await owner.asUser.mutation(api.directMessages.send, { threadId, content: "hi" });
    await member.asUser.mutation(api.directMessages.send, { threadId, content: "hey" });

    const page = await owner.asUser.query(api.directMessages.list, {
      threadId,
      paginationOpts: { numItems: 25, cursor: null },
    });
    expect(page.page.map((m) => m.content)).toEqual(["hey", "hi"]);
    expect(page.page[0].authorName).toBe("Member");
  });

  it("only the author can edit or delete their DM (FR-023/FR-019)", async () => {
    const t = makeConvexTest();
    const { owner, member, threadId } = await setUpThread(t);
    const messageId = await owner.asUser.mutation(api.directMessages.send, {
      threadId,
      content: "owner msg",
    });

    await expect(
      member.asUser.mutation(api.directMessages.edit, { messageId, content: "hijack" }),
    ).rejects.toThrow();
    await expect(
      member.asUser.mutation(api.directMessages.remove, { messageId }),
    ).rejects.toThrow();

    await owner.asUser.mutation(api.directMessages.edit, { messageId, content: "owner edited" });
    const stored = await t.run((ctx) => ctx.db.get(messageId));
    expect(stored?.content).toBe("owner edited");
    expect(stored?.editedAt).toBeTypeOf("number");
  });
});
