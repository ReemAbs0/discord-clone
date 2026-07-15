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

async function setUpServerWithGeneralChannel(t: ReturnType<typeof makeConvexTest>) {
  const owner = await createUser(t, "Owner");
  const serverId = await owner.asUser.mutation(api.servers.create, { name: "Test Server" });
  const channels = await t.run((ctx) =>
    ctx.db
      .query("channels")
      .withIndex("by_server", (q) => q.eq("serverId", serverId))
      .collect(),
  );
  const channelId = channels[0]._id;
  return { ...owner, serverId, channelId };
}

describe("messages.ts", () => {
  it("send requires the caller to be a member of the channel's server", async () => {
    const t = makeConvexTest();
    const { channelId } = await setUpServerWithGeneralChannel(t);
    const { asUser: asOutsider } = await createUser(t, "Outsider");

    await expect(
      asOutsider.mutation(api.messages.send, { channelId, content: "Hi" }),
    ).rejects.toThrow();
  });

  it("send inserts a message authored by the caller", async () => {
    const t = makeConvexTest();
    const { asUser, userId, channelId } = await setUpServerWithGeneralChannel(t);

    await asUser.mutation(api.messages.send, { channelId, content: "Hello, general!" });

    const stored = await t.run((ctx) => ctx.db.query("messages").collect());
    expect(stored).toHaveLength(1);
    expect(stored[0].content).toBe("Hello, general!");
    expect(stored[0].authorId).toBe(userId);
  });

  it("list returns messages joined with the author's name and avatar (FR-016)", async () => {
    const t = makeConvexTest();
    const { asUser, channelId } = await setUpServerWithGeneralChannel(t);

    await asUser.mutation(api.messages.send, { channelId, content: "First!" });

    const page = await asUser.query(api.messages.list, {
      channelId,
      paginationOpts: { numItems: 25, cursor: null },
    });

    expect(page.page).toHaveLength(1);
    expect(page.page[0].content).toBe("First!");
    expect(page.page[0].authorName).toBe("Owner");
    expect(page.page[0].authorAvatarUrl).toBeNull();
  });

  it("list rejects non-members", async () => {
    const t = makeConvexTest();
    const { channelId } = await setUpServerWithGeneralChannel(t);
    const { asUser: asOutsider } = await createUser(t, "Outsider");

    await expect(
      asOutsider.query(api.messages.list, {
        channelId,
        paginationOpts: { numItems: 25, cursor: null },
      }),
    ).rejects.toThrow();
  });

  it("list returns newest-first", async () => {
    const t = makeConvexTest();
    const { asUser, channelId } = await setUpServerWithGeneralChannel(t);

    await asUser.mutation(api.messages.send, { channelId, content: "one" });
    await asUser.mutation(api.messages.send, { channelId, content: "two" });

    const page = await asUser.query(api.messages.list, {
      channelId,
      paginationOpts: { numItems: 25, cursor: null },
    });

    expect(page.page.map((m) => m.content)).toEqual(["two", "one"]);
  });
});
