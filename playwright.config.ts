import { defineConfig, devices } from "@playwright/test";

// T007. Two-context (two simulated users) support for real-time and call
// smoke tests comes from each spec opening its own `browser.newContext()`,
// not from a Playwright project setting — see tests/e2e/send-message.spec.ts
// and tests/e2e/join-call.spec.ts.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // join-call.spec.ts (US7) needs a fake camera/mic to test WebRTC without real hardware
        launchOptions: {
          args: [
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
          ],
        },
      },
    },
  ],
});
