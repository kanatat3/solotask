import { defineConfig, devices } from "@playwright/test";

// Static site: scripts/serve.mjs serves dist/ (run `npm run build` first — `npm run verify` does).
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: "http://127.0.0.1:8791",
    trace: "retain-on-failure",
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
  },
  webServer: {
    command: "node scripts/serve.mjs 8791",
    url: "http://127.0.0.1:8791/",
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    // dark theme is its own state: same flows, colors re-checked by axe
    { name: "dark", use: { ...devices["Pixel 7"], colorScheme: "dark" } },
  ],
});
