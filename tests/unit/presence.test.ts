import { describe, expect, it } from "vitest";
import { makeConvexTest } from "./convexTestHelper";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

// getAuthUserId(ctx) resolves the caller as identity.subject.split("|")[0]
// (@convex-dev/auth/dist/server/implementation/index.js) — a bare userId as
// `subject` (no "|") round-trips to itself, so this is a faithful simulation
// of a real signed-in session, not a workaround.
async function createUser(t: ReturnType<typeof makeConvexTest>, name: string) {
  const userId: Id<"users"> = await t.run(async (ctx) => {
    return await ctx.db.insert("users", { name, email: `${name.toLowerCase()}@example.com` });
  });
  return { userId, asUser: t.withIdentity({ subject: userId }) };
}

describe("presence.ts", () => {
  it("heartbeat requires authentication", async () => {
    const t = makeConvexTest();
    await expect(t.mutation(api.presence.heartbeat, {})).rejects.toThrow();
  });

  it("upserts a single presence row across repeated heartbeats", async () => {
    const t = makeConvexTest();
    const { userId, asUser } = await createUser(t, "Ada");

    await asUser.mutation(api.presence.heartbeat, {});
    await asUser.mutation(api.presence.heartbeat, {});

    const rows = await t.run((ctx) => ctx.db.query("presence").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(userId);
  });

  it("clearMine deletes the caller's own presence row", async () => {
    const t = makeConvexTest();
    const { asUser } = await createUser(t, "Grace");

    await asUser.mutation(api.presence.heartbeat, {});
    await asUser.mutation(api.presence.clearMine, {});

    const rows = await t.run((ctx) => ctx.db.query("presence").collect());
    expect(rows).toHaveLength(0);
  });

  it("getForUsers reports online for a user with a fresh heartbeat", async () => {
    const t = makeConvexTest();
    const { userId, asUser } = await createUser(t, "Alan");
    await asUser.mutation(api.presence.heartbeat, {});

    const [result] = await asUser.query(api.presence.getForUsers, { userIds: [userId] });
    expect(result.online).toBe(true);
  });

  it("getForUsers reports offline for a user with no presence row", async () => {
    const t = makeConvexTest();
    const { userId: neverHeartbeat } = await createUser(t, "Offline");
    const { asUser: asObserver } = await createUser(t, "Observer");

    const [result] = await asObserver.query(api.presence.getForUsers, {
      userIds: [neverHeartbeat],
    });
    expect(result.online).toBe(false);
  });
});
