import { test, expect } from "@playwright/test";
import { openApp, expectNoA11yViolations } from "./helpers.mjs";

test("home renders and passes axe", async ({ page }) => {
  await openApp(page);
  await expect(page.getByText("Due today")).toBeVisible();
  await expect(page.getByRole("radio", { name: /Both/ })).toHaveAttribute("aria-checked", "true");
  await expectNoA11yViolations(page, "home");
});

test("add a task with the tap-first form", async ({ page }) => {
  await openApp(page);
  await page.locator("#fabBtn").click();
  await expect(page.locator("#fTitle")).toBeVisible();
  await expect(page.locator('#fDueChips [aria-pressed="true"]')).toHaveText("Today");
  await expectNoA11yViolations(page, "new task form");
  await page.locator("#fTitle").fill("Send the weekly report");
  await page.locator("#fDueChips").getByRole("button", { name: "Tomorrow" }).click();
  await page.locator("#fRecSet").getByText("Weekly", { exact: true }).click();
  const submit = page.locator("#fSubmit");
  await expect(submit).toHaveText("Add task · Tomorrow");
  await submit.click();
  await expect(page.locator("#fTitle")).toHaveCount(0);
  await page.locator("#navBar").getByRole("button", { name: "All" }).click();
  await expect(page.getByText("Send the weekly report")).toBeVisible();
});

test("Work overview, project workflow and rounds", async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => goCat("cw"));
  await expect(page.locator('.wf-stat[data-k="active"] .stat-num')).toHaveText("2");
  await expect(page.locator('.wf-proj[data-pid="pb"] .wf-rrow')).toHaveCount(2);
  await expectNoA11yViolations(page, "work overview");
  await page.getByRole("button", { name: "Open project SCG Customer Satisfaction" }).click();
  await expect(page.locator('.wf-card[aria-current="step"]')).toHaveAttribute("data-stage", "analyst");
  await page.locator('.wf-card[data-stage="report"]').click();
  await expect(page.locator('.wf-card[aria-current="step"]')).toHaveAttribute("data-stage", "report");
  await expectNoA11yViolations(page, "project workflow");
  await page.locator(".back-btn").click();
  await page.getByRole("button", { name: "Open project FMCG U&A" }).click();
  await expect(page.getByRole("tab", { name: /Wave 2/ })).toHaveAttribute("aria-selected", "true");
  await expectNoA11yViolations(page, "project with rounds");
});

for (const tab of ["Calendar", "All", "Settings"]) {
  test(`${tab} tab passes axe`, async ({ page }) => {
    await openApp(page);
    await page.locator("#navBar").getByRole("button", { name: tab }).click();
    await expect(page.locator("#navBar .nav-btn.active")).toContainText(tab);
    await expectNoA11yViolations(page, tab.toLowerCase());
  });
}
