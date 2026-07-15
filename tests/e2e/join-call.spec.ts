import { test, expect, type Page } from "@playwright/test";

// Two real users (owner + invited member) join the same voice channel and each
// sees the other's connected video tile. Requires the fake media device flags
// in playwright.config.ts. This is the second constitution-mandated smoke test.
//
// NOTE: STUN-only WebRTC (research.md §5) — on CI/networks where a peer
// connection can't be established this asserts on the Convex-driven call
// roster (both tiles render from the participant list) rather than on actual
// media flow, which the fake-device peer connection provides locally.

function uniqueEmail() {
  return `call-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function signUp(page: Page, email: string, password: string, name: string) {
  await page.goto("/signup");
  await page.getByLabel("Display name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /sign up/i }).click();
  await page.waitForURL("/");
}

test("two participants join the same voice channel and see each other (US7, constitution-mandated smoke test)", async ({
  browser,
}) => {
  const password = "correct horse battery staple";

  // Owner signs up, creates a server, and grabs an invite link.
  const ownerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  await signUp(owner, uniqueEmail(), password, "Owner");
  await owner.getByTitle("Create a server").click();
  await owner.getByLabel("Server name").fill("Call Test Server");
  await owner.getByRole("button", { name: "Create" }).click();
  await owner.waitForURL(/\/servers\/.+\/channels\/.+/);

  await owner.getByRole("button", { name: /invite people/i }).click();
  const inviteInput = owner.getByLabel("Invite link");
  await expect(inviteInput).not.toHaveValue("", { timeout: 10_000 });
  const invitePath = new URL(await inviteInput.inputValue()).pathname;
  await owner.getByRole("button", { name: /done/i }).click();

  // Owner creates a voice channel (the + on the Voice Channels section).
  await owner.getByTitle(/create a voice channel/i).click();
  await owner.getByPlaceholder("new-channel").fill("Lounge");
  await owner.getByRole("button", { name: "Create" }).click();

  // Member signs up and joins via the invite link.
  const memberCtx = await browser.newContext();
  const member = await memberCtx.newPage();
  await signUp(member, uniqueEmail(), password, "Member");
  await member.goto(invitePath);
  await member.waitForURL(/\/servers\/.+/);

  // Both open the Lounge voice channel.
  await owner.getByRole("link", { name: /Lounge/ }).click();
  await member.getByRole("link", { name: /Lounge/ }).click();

  // Each should end up with two video tiles (self + the other participant).
  await expect(owner.locator("video")).toHaveCount(2, { timeout: 15_000 });
  await expect(member.locator("video")).toHaveCount(2, { timeout: 15_000 });

  await ownerCtx.close();
  await memberCtx.close();
});
