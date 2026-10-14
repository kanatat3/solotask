import { test, expect } from "@playwright/test";
import { expectNoA11yViolations } from "./helpers.mjs";

const TOKEN = "Tok_abcdefghijklmnopqrstuvwxyz0123";
// supabase-js from the CDN is replaced by a fake client so the page runs offline
const FAKE_SUPABASE = `window.supabase = { createClient: () => ({
  rpc: async (fn) => fn === "request_link_info" ? { data: [{ project: "Kodo", active: true }], error: null } : { data: "id1", error: null },
  storage: { from: () => ({ upload: async (path) => ({ data: { path }, error: null }) }) },
}) };`;

async function openRequest(page, hash) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => /cdn\.jsdelivr\.net\/npm\/@supabase/.test(r.request().url())
    ? r.fulfill({ contentType: "text/javascript", body: FAKE_SUPABASE }) : r.abort());
  await page.goto("/request.html" + hash);
}

test("invalid link explains itself", async ({ page }) => {
  await openRequest(page, "#t=short");
  await expect(page.getByRole("heading", { name: "Link not valid" })).toBeVisible();
  await expectNoA11yViolations(page, "request: invalid link");
});

test("send a request with a file; name is remembered", async ({ page }) => {
  await openRequest(page, "#t=" + TOKEN);
  await expect(page.getByRole("heading", { name: "What should we fix or change?" })).toBeVisible();
  const send = page.locator("#send");
  await expect(send).toBeDisabled();
  await expectNoA11yViolations(page, "request form");
  await page.getByLabel("What needs to change?").fill("The export button does nothing on my phone.");
  await page.locator("#picker").setInputFiles({ name: "note.txt", mimeType: "text/plain", buffer: Buffer.from("details") });
  await expect(send).toHaveText(/Send request · 1 file/);
  await page.getByLabel(/Your name/).fill("Nok");
  await send.click();
  await expect(page.getByRole("heading", { name: "Request sent" })).toBeVisible();
  await expectNoA11yViolations(page, "request sent");
  await page.getByRole("button", { name: "Send another request" }).click();
  await expect(page.getByLabel(/Your name/)).toHaveValue("Nok");
});

for (const p of ["privacy.html", "terms.html"]) {
  test(`${p} passes axe`, async ({ page }) => {
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await page.goto("/" + p);
    await expectNoA11yViolations(page, p);
  });
}
