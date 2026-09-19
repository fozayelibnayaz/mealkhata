import { test, expect } from "@playwright/test";
test("database-backed workspace completes a real workflow and survives reload", async ({
  page,
}) => {
  await page.goto("/workspace");
  await page.getByLabel("Your sandbox name").fill("QA Manager");
  await page
    .getByRole("button", { name: "Create isolated sandbox account" })
    .click();
  await page.getByRole("button", { name: "Create your first mess" }).click();
  await page.getByLabel("Mess name", { exact: true }).fill("QA Kitchen");
  await page.getByLabel("First accounting month").fill("2026-09");
  await page.getByRole("button", { name: "Create mess", exact: true }).click();
  await expect(page.locator("h1")).toContainText("Good to see you");
  await page.getByRole("button", { name: "Meals", exact: true }).click();
  await page.getByLabel("Meal date").fill("2026-09-19");
  await page.getByRole("button", { name: "Breakfast", exact: false }).click();
  await page.getByLabel("Correction reason").fill("Verified with member");
  await page.getByRole("button", { name: "Confirm daily meals" }).click();
  await expect(
    page.getByText("Saved to the workspace database."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Bazar", exact: true }).click();
  await page.getByRole("button", { name: "Add expense" }).click();
  await page.getByLabel("What was purchased?").fill("Rice");
  await page.getByLabel("Amount (৳)", { exact: true }).fill("100");
  await page.getByRole("button", { name: "Submit expense for review" }).click();
  await expect(page.locator("tbody")).toContainText("pending");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await page
    .getByLabel("Explanation", { exact: true })
    .fill("Receipt matches the purchase");
  await page.getByRole("button", { name: "Save review" }).click();
  await expect(page.locator("tbody")).toContainText("approved");
  await page.getByRole("button", { name: "Accounts", exact: true }).click();
  await expect(page.locator("tbody").first()).toContainText("৳100");
  await page.reload();
  await expect(page.locator("h1")).toContainText("Good to see you");
  await page.getByRole("button", { name: "Reports", exact: true }).click();
  await page
    .getByRole("button", { name: "Mark missing entries as off" })
    .click();
  await page
    .getByLabel("Reason / explanation")
    .fill("All other days confirmed away for test");
  await page.getByRole("button", { name: "Confirm action" }).click();
  await page.getByRole("button", { name: "Reconcile & close month" }).click();
  await page.getByLabel("Actual fund cash (৳)").fill("0");
  await page
    .getByLabel("Reason / explanation")
    .fill("Cash counted and verified");
  await page.getByRole("button", { name: "Confirm action" }).click();
  await expect(page.getByText("Preserved closing snapshots")).toBeVisible();
  await page.getByRole("button", { name: "Start next month" }).click();
  await page.getByRole("button", { name: "Confirm action" }).click();
  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await expect(page.getByText("nextMonth", { exact: true })).toBeVisible();
});
test("workspace mobile welcome fits viewport and discloses Google setup requirement", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/workspace");
  await expect(
    page.getByText("Google sign-in code is installed.", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("opt-in saved view is read-only during an API outage and meal drafts survive reload", async ({
  page,
}) => {
  await page.goto("/workspace");
  await page.getByLabel("Your sandbox name").fill("Offline tester");
  await page
    .getByRole("button", { name: "Create isolated sandbox account" })
    .click();
  await page.getByRole("button", { name: "Create your first mess" }).click();
  await page.getByLabel("Mess name", { exact: true }).fill("Offline Kitchen");
  await page.getByRole("button", { name: "Create mess", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("checkbox", { name: "Remember the last khata" }).check();
  await expect
    .poll(async () =>
      page.evaluate(async () => {
        return await new Promise((resolve) => {
          const req = indexedDB.open("mealkhata-device-cache", 1);
          req.onsuccess = () => {
            const get = req.result
              .transaction("snapshots")
              .objectStore("snapshots")
              .get("last");
            get.onsuccess = () => {
              resolve(!!get.result);
              req.result.close();
            };
          };
        });
      }),
    )
    .toBe(true);
  await page.route("**/api/**", (route) => route.abort());
  await page.reload();
  await page
    .getByRole("button", { name: "View saved khata read-only" })
    .click();
  await expect(page.getByText("Saved device copy — not live.")).toBeVisible();
  await page.getByRole("button", { name: "Meals", exact: true }).click();
  await page.getByRole("button", { name: "Breakfast", exact: false }).click();
  await expect(
    page.getByText("Local draft saved for this tab.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirm daily meals" }).click();
  await expect(
    page.getByText("Read-only saved view. Reconnect before sending changes.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "View saved khata read-only" })
    .click();
  await page.getByRole("button", { name: "Meals", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Breakfast", exact: false }),
  ).toHaveAttribute("aria-pressed", "true");
});
