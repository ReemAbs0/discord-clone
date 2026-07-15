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

describe("servers.ts", () => {
  it("create requires authentication", async () => {
    const t = makeConvexTest();
    await expect(t.mutation(api.servers.create, { name: "Nope" })).rejects.toThrow();
  });

  it("create atomically makes the server, the owner's membership, and a general channel", async () => {
    const t = makeConvexTest();
    const { userId, asUser } = await createUser(t, "Owner");

    const serverId = await asUser.mutation(api.servers.create, { name: "My Server" });

    const server = await t.run((ctx) => ctx.db.get(serverId));
    expect(server?.name).toBe("My Server");
    expect(server?.ownerId).toBe(userId);

    const membership = await t.run((ctx) =>
      ctx.db
        .query("serverMembers")
        .withIndex("by_server_and_user", (q) => q.eq("serverId", serverId).eq("userId", userId))
        .unique(),
    );
    expect(membership).not.toBeNull();

    const channels = await t.run((ctx) =>
      ctx.db
        .query("channels")
        .withIndex("by_server", (q) => q.eq("serverId", serverId))
        .collect(),
    );
    expect(channels).toHaveLength(1);
    expect(channels[0].name).toBe("general");
    expect(channels[0].type).toBe("text");
  });

  it("listForMe only returns servers the caller is a member of", async () => {
    const t = makeConvexTest();
    const { asUser: asOwner } = await createUser(t, "Owner");
    const { asUser: asOutsider } = await createUser(t, "Outsider");

    await asOwner.mutation(api.servers.create, { name: "Owner's Server" });

    const ownerServers = await asOwner.query(api.servers.listForMe, {});
    expect(ownerServers).toHaveLength(1);

    const outsiderServers = await asOutsider.query(api.servers.listForMe, {});
    expect(outsiderServers).toHaveLength(0);
  });

  it("get rejects non-members", async () => {
    const t = makeConvexTest();
    const { asUser: asOwner } = await createUser(t, "Owner");
    const { asUser: asOutsider } = await createUser(t, "Outsider");
    const serverId = await asOwner.mutation(api.servers.create, { name: "Private" });

    await expect(asOutsider.query(api.servers.get, { serverId })).rejects.toThrow();
  });

  it("rename requires ownership", async () => {
    const t = makeConvexTest();
    const { asUser: asOwner } = await createUser(t, "Owner");
    const { asUser: asMember } = await createUser(t, "Member");
    const serverId = await asOwner.mutation(api.servers.create, { name: "Original" });

    await expect(
      asMember.mutation(api.servers.rename, { serverId, name: "Hijacked" }),
    ).rejects.toThrow();

    await asOwner.mutation(api.servers.rename, { serverId, name: "Renamed" });
    const server = await t.run((ctx) => ctx.db.get(serverId));
    expect(server?.name).toBe("Renamed");
  });
});
