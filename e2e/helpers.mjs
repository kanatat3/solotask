// Shared helpers: a signed-in demo account (no cloud), external requests blocked, and an axe check (WCAG 2.1 AA).
import { expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

export const USER = { uid: "u-e2e", email: "e2e@example.com", name: "Tester" };
const day = (n) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d.toISOString(); };
const task = (id, title, extra = {}) => ({ id, title, categoryId: "cw", status: "open", recurrence: "none", note: "", createdAt: day(-10), dueAt: day(0), ...extra });

export function demoState() {
  return {
    categories: [
      { id: "cw", name: "Work", color: "#6366f1", icon: "briefcase", focus: "work", projects: [
        { id: "pa", name: "SCG Customer Satisfaction", color: "#10b981", stage: "analyst" },
        { id: "pb", name: "FMCG U&A", color: "#f59e0b", rounds: [{ id: "r1", name: "Wave 1", stage: "done" }, { id: "r2", name: "Wave 2", stage: "editclean" }] },
      ] },
      { id: "cp", name: "Personal", color: "#8b5cf6", icon: "user", focus: "personal" },
    ],
    tasks: [
      task("t1", "Build Tableau extract", { projectId: "pa", step: "analyst", dueAt: day(-1) }),
      task("t2", "Clean wave 2 data", { projectId: "pb", roundId: "r2", step: "clean", dueAt: day(2) }),
      task("t3", "Weekly team meeting"),
      task("t4", "Buy groceries", { categoryId: "cp" }),
    ],
    routines: [], routineLog: {}, checklists: [], journal: [], pets: [],
    game: { xp: 0, checkins: {}, best: 0, focus: {} }, meta: { agentCatV2: 1, setupDone: true },
  };
}

/** Seed localStorage once per test (later reloads keep what the app saved) and keep the run offline. */
export async function openApp(page, state = demoState()) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
  await page.addInitScript(([user, st]) => {
    if (sessionStorage.getItem("__e2e_seeded")) return;
    localStorage.setItem("task-studio-supabase", JSON.stringify({ off: true }));
    localStorage.setItem("task-studio-user", JSON.stringify(user));
    localStorage.setItem("task-studio-v1:" + user.uid, JSON.stringify(st));
    sessionStorage.setItem("__e2e_seeded", "1");
  }, [USER, state]);
  await page.goto("/");
  // first screen of a session asks Work / Personal / Both — pick Both like a user would
  await page.getByRole("button", { name: /^Both/ }).click();
  await expect(page.locator("#navBar")).toBeVisible();
}

export async function expectNoA11yViolations(page, label) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map(v => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map(n => n.target.join(" ")).join(" | ")}`);
  if (process.env.AXE_DUMP) for (const v of results.violations) for (const n of v.nodes) console.log(`AXE|${label}|${v.id}|${n.target.join(" ")}|${(n.any[0]?.message || n.failureSummary || "").replace(/\s+/g, " ").slice(0, 160)}`);
  expect(summary, `axe violations on ${label}`).toEqual([]);
}
