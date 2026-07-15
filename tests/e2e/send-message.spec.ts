import { test, expect, type Page } from "@playwright/test";

// Two browser contexts signed in as the *same* account (no invite flow yet —
// that's US3) exercise real-time delivery exactly as quickstart.md scenario 2
// describes: "second tab of browser A" before a second real user exists.

function uniqueEmail() {
  return `smoke-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function signUp(page: Page, email: string, password: string, name: string) {
  await page.goto("/signup");
  await page.getByLabel("Display name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /sign up/i }).click();
  await page.waitForURL("/");
}

async function logIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /log in/i }).click();
  await page.waitForURL("/");
}

test("a message sent in one session appears in real time in another (US2, constitution-mandated smoke test)", async ({
  browser,
}) => {
  const email = uniqueEmail();
  const password = "correct horse battery staple";

  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await signUp(pageA, email, password, "Smoke Tester");

  // Create a server as this account.
  await pageA.getByTitle("Create a server").click();
  await pageA.getByLabel("Server name").fill("Smoke Test Server");
  await pageA.getByRole("button", { name: "Create" }).click();
  await pageA.waitForURL(/\/servers\/.+\/channels\/.+/);
  const channelUrl = pageA.url();

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await logIn(pageB, email, password);
  await pageB.goto(channelUrl);

  const composerA = pageA.getByPlaceholder("Message the channel");
  await composerA.fill("Hello from session A");
  await composerA.press("Enter");

  await expect(pageB.getByText("Hello from session A")).toBeVisible({ timeout: 5_000 });

  await contextA.close();
  await contextB.close();
});
