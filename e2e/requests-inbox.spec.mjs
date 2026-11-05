// Requests inbox (needs a signed-in cloud account): the all-requests page and a project's request page,
// driven against an in-page fake Supabase (same mock as kodo-tests) — real clicks + axe.
import { test, expect } from "@playwright/test";
import { mockSupabaseHead } from "./mock-supabase.mjs";
import { USER, demoState, expectNoA11yViolations, pinTheme } from "./helpers.mjs";

const TABLES = {
  request_links: [{ id: "l1", owner: USER.uid, project: "Kodo", token: "Tok_abcdefghijklmnopqrstuvwxyz0123", active: true, created_at: "2026-09-15T01:00:00Z" }],
  project_requests: [
    { id: "r1", owner: USER.uid, project: "Kodo", author: "Nok", body: "Save button hidden on iPhone", status: "new", attachments: [], created_at: "2026-09-15T03:00:00Z" },
    { id: "r2", owner: USER.uid, project: "BI Studio", author: "Ann", body: "Export to PDF", status: "progress", attachments: [], created_at: "2026-09-14T03:00:00Z" },
  ],
};

async function openCloudApp(page) {
  const state = demoState();
  state.categories.push({ id: "ck", name: "AI · Kodo", color: "#6366f1", icon: "chart" });
  const script = mockSupabaseHead({ userId: USER.uid, email: USER.email, remote: state }).replace(/^\s*<script>|<\/script>\s*$/g, "")
    + `;window.__sb.tables = ${JSON.stringify(TABLES)};`;
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await pinTheme(page);
  await page.addInitScript(script);
  await page.addInitScript(([user, st]) => {
    if (sessionStorage.getItem("__e2e_seeded")) return;
    localStorage.setItem("task-studio-user", JSON.stringify(user));
    localStorage.setItem("task-studio-v1:" + user.uid, JSON.stringify(st));
    sessionStorage.setItem("__e2e_seeded", "1");
  }, [USER, state]);
  await page.goto("/");
  await page.locator(".td-head, .focus-grid").first().waitFor();
  if (await page.locator(".focus-grid").count()) await page.getByRole("button", { name: /^Work/ }).click();
  else await page.evaluate(() => setFocus("work"));
  await expect(page.locator("#navBar")).toBeVisible();
}

test("all requests page groups by project and passes axe", async ({ page }) => {
  await openCloudApp(page);
  await page.evaluate(() => goCat(AI_HUB));
  await page.getByRole("button", { name: /^All requests/ }).click();
  await expect(page.getByRole("heading", { name: "All requests" })).toBeVisible();
  await expect(page.locator(".rq-group")).toHaveCount(2);
  await expect(page.getByRole("heading", { name: "Kodo", level: 2 })).toBeVisible();
  await expectNoA11yViolations(page, "all requests");
  await page.getByRole("button", { name: "Open the request page of Kodo" }).click();
  await expect(page.getByRole("heading", { name: "Requests" })).toBeVisible();
  await expectNoA11yViolations(page, "project requests");
  await page.getByRole("button", { name: "All requests" }).first().click();
  await expect(page.getByRole("heading", { name: "All requests" })).toBeVisible();
});
