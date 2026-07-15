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

async function setUpServer(t: ReturnType<typeof makeConvexTest>) {
  const owner = await createUser(t, "Owner");
  const serverId = await owner.asUser.mutation(api.servers.create, { name: "Test Server" });
  return { owner, serverId };
}

describe("invites.ts", () => {
  it("getOrCreateForServer requires ownership", async () => {
    const t = makeConvexTest();
    const { serverId } = await setUpServer(t);
    const { asUser: asStranger } = await createUser(t, "Stranger");

    await expect(
      asStranger.mutation(api.invites.getOrCreateForServer, { serverId }),
    ).rejects.toThrow();
  });

  it("getOrCreateForServer is idempotent — same code on repeat calls", async () => {
    const t = makeConvexTest();
    const { owner, serverId } = await setUpServer(t);

    const first = await owner.asUser.mutation(api.invites.getOrCreateForServer, { serverId });
    const second = await owner.asUser.mutation(api.invites.getOrCreateForServer, { serverId });

    expect(first.code).toBe(second.code);
    const invites = await t.run((ctx) =>
      ctx.db
        .query("invites")
        .withIndex("by_server", (q) => q.eq("serverId", serverId))
        .collect(),
    );
    expect(invites).toHaveLength(1);
  });

  it("regenerate invalidates the old code and issues a new one", async () => {
    const t = makeConvexTest();
    const { owner, serverId } = await setUpServer(t);

    const { code: oldCode } = await owner.asUser.mutation(api.invites.getOrCreateForServer, {
      serverId,
    });
    const { code: newCode } = await owner.asUser.mutation(api.invites.regenerate, { serverId });

    expect(newCode).not.toBe(oldCode);

    // Old code no longer resolves.
    const { asUser: asJoiner } = await createUser(t, "Joiner");
    await expect(asJoiner.mutation(api.invites.consume, { code: oldCode })).rejects.toThrow();

    // New code works.
    const result = await asJoiner.mutation(api.invites.consume, { code: newCode });
    expect(result.serverId).toBe(serverId);
  });

  it("consume adds the caller as a member and is idempotent", async () => {
    const t = makeConvexTest();
    const { owner, serverId } = await setUpServer(t);
    const { code } = await owner.asUser.mutation(api.invites.getOrCreateForServer, { serverId });
    const { userId: joinerId, asUser: asJoiner } = await createUser(t, "Joiner");

    await asJoiner.mutation(api.invites.consume, { code });
    await asJoiner.mutation(api.invites.consume, { code }); // repeat should not duplicate

    const memberships = await t.run((ctx) =>
      ctx.db
        .query("serverMembers")
        .withIndex("by_server_and_user", (q) =>
          q.eq("serverId", serverId).eq("userId", joinerId),
        )
        .collect(),
    );
    expect(memberships).toHaveLength(1);
  });

  it("consume rejects an invalid code", async () => {
    const t = makeConvexTest();
    const { asUser } = await createUser(t, "Joiner");
    await expect(asUser.mutation(api.invites.consume, { code: "does-not-exist" })).rejects.toThrow();
  });
});

describe("serverMembers.ts", () => {
  it("listForServer returns members with presence and owner flags, rejecting non-members", async () => {
    const t = makeConvexTest();
    const { owner, serverId } = await setUpServer(t);
    const { code } = await owner.asUser.mutation(api.invites.getOrCreateForServer, { serverId });
    const { asUser: asJoiner } = await createUser(t, "Joiner");
    await asJoiner.mutation(api.invites.consume, { code });
    await asJoiner.mutation(api.presence.heartbeat, {}); // joiner online, owner not

    const members = await owner.asUser.query(api.serverMembers.listForServer, { serverId });
    expect(members).toHaveLength(2);
    const ownerRow = members.find((m) => m.name === "Owner");
    const joinerRow = members.find((m) => m.name === "Joiner");
    expect(ownerRow?.isOwner).toBe(true);
    expect(joinerRow?.isOwner).toBe(false);
    expect(joinerRow?.online).toBe(true);
    expect(ownerRow?.online).toBe(false);

    const { asUser: asStranger } = await createUser(t, "Stranger");
    await expect(asStranger.query(api.serverMembers.listForServer, { serverId })).rejects.toThrow();
  });

  it("leave removes a non-owner member", async () => {
    const t = makeConvexTest();
    const { owner, serverId } = await setUpServer(t);
    const { code } = await owner.asUser.mutation(api.invites.getOrCreateForServer, { serverId });
    const { userId: joinerId, asUser: asJoiner } = await createUser(t, "Joiner");
    await asJoiner.mutation(api.invites.consume, { code });

    await asJoiner.mutation(api.serverMembers.leave, { serverId });

    const membership = await t.run((ctx) =>
      ctx.db
        .query("serverMembers")
        .withIndex("by_server_and_user", (q) =>
          q.eq("serverId", serverId).eq("userId", joinerId),
        )
        .unique(),
    );
    expect(membership).toBeNull();
  });

  it("leave rejects the server owner (FR-033 / Assumptions)", async () => {
    const t = makeConvexTest();
    const { owner, serverId } = await setUpServer(t);

    await expect(owner.asUser.mutation(api.serverMembers.leave, { serverId })).rejects.toThrow();

    // Owner is still a member.
    const members = await owner.asUser.query(api.serverMembers.listForServer, { serverId });
    expect(members).toHaveLength(1);
  });
});
