import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const reports = [];
async function scan(name) {
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  reports.push({
    screen: name,
    violations: r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  });
  console.log(name, r.violations.length, "rule violations");
}
await page.goto("http://127.0.0.1:5173/workspace");
await page.getByLabel("Your sandbox name").waitFor();
await scan("Welcome");
await page.getByLabel("Your sandbox name").fill("Accessibility test");
await page
  .getByRole("button", { name: "Create isolated sandbox account" })
  .click();
await page.getByRole("button", { name: "Create your first mess" }).click();
await page
  .getByLabel("Mess name", { exact: true })
  .fill("Accessibility Kitchen");
await page.getByRole("button", { name: "Create mess", exact: true }).click();
await page
  .getByRole("heading", { name: "Good to see you, Accessibility." })
  .waitFor();
for (const name of [
  "Overview",
  "Meals",
  "Bazar",
  "Accounts",
  "Members",
  "Reports",
  "Activity",
  "Settings",
]) {
  await page.locator("nav").getByRole("button", { name, exact: true }).click();
  await scan(name);
}
fs.writeFileSync(
  "docs/accessibility-report.json",
  JSON.stringify(reports, null, 2),
);
console.log(
  JSON.stringify(
    reports.filter((x) => x.violations.length),
    null,
    2,
  ),
);
await browser.close();
if (reports.some((r) => r.violations.length)) process.exitCode = 1;
