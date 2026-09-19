import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});
test("overview renders without runtime errors and meal edits persist", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(
    page.getByRole("heading", { name: "A little less mess, Rafi." }),
  ).toBeVisible();
  const breakfast = page.getByRole("button", { name: "Toggle breakfast" });
  await expect(breakfast).toHaveAttribute("aria-pressed", "true");
  await breakfast.click();
  await expect(breakfast).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Toggle breakfast" }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(errors).toEqual([]);
});
test("personal expense increases total and personal credit but not fund cash", async ({
  page,
}) => {
  const fund = await page
    .locator(".stat")
    .filter({ hasText: "Mess fund balance" })
    .locator(".stat-value")
    .innerText();
  await page
    .getByRole("button", { name: "Add a bazar expense", exact: true })
    .click();
  await page.getByLabel("What did you buy?").fill("Test personal rice");
  await page.getByLabel("Amount (৳)").fill("100.50");
  await page
    .getByLabel("Where did the money come from?")
    .selectOption("personal");
  await page
    .getByRole("button", { name: "Add bazar expense", exact: true })
    .click();
  await expect(
    page
      .locator(".stat")
      .filter({ hasText: "Mess fund balance" })
      .locator(".stat-value"),
  ).toHaveText(fund);
  await page.getByRole("button", { name: "Explain my bill" }).click();
  await expect(page.locator(".bill-lines")).toContainText("1,950.5");
});
test("fund expense reduces fund cash and ledger remains reconciled", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Add a bazar expense", exact: true })
    .click();
  await page.getByLabel("What did you buy?").fill("Test fund rice");
  await page.getByLabel("Amount (৳)").fill("100");
  await page
    .getByRole("button", { name: "Add bazar expense", exact: true })
    .click();
  await expect(
    page.locator(".stat").filter({ hasText: "Mess fund balance" }),
  ).toContainText("৳6,080");
  await page.getByRole("button", { name: "Accounts", exact: true }).click();
  await expect(page.locator(".reconciled")).toContainText(
    "৳6,080 = mess fund ৳6,080",
  );
});
test("guest meals update bill, reset restores sample data", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Add guest meal", exact: true })
    .click();
  await page.getByRole("button", { name: "+", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add guest meal (1)" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset demo", exact: true }).click();
  await page.getByRole("button", { name: "Reset sample data" }).click();
  await expect(
    page.getByRole("button", { name: "Add guest meal", exact: true }),
  ).toBeVisible();
});
test("all screens, CSV download and honest invite state", async ({ page }) => {
  for (const name of ["Meals", "Bazar", "Accounts", "Members"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator("h1")).toHaveText(name);
  }
  await page
    .getByRole("button", { name: "Invite member", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Secure invitation links arrive",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Accounts", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  expect((await download).suggestedFilename()).toBe(
    "MealKhata-demo-September-2026.csv",
  );
});
test("mobile navigation and no page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Meals", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Today’s meal khata" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test("Bangla primary labels switch and modal focus stays contained", async ({
  page,
}) => {
  await page.getByRole("button", { name: "বাংলা" }).click();
  await expect(page.locator("h1")).toContainText("হিসাব থাকুক সহজ");
  await page.getByRole("button", { name: "English" }).click();
  await page.getByRole("button", { name: "Explain my bill" }).click();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => !!document.activeElement?.closest('[role="dialog"]'),
      ),
    ).toBeTruthy();
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("corrupted stored sample data is recovered without a crash", async ({
  page,
}) => {
  await page.evaluate(() =>
    localStorage.setItem(
      "mealkhata-prototype-v1",
      JSON.stringify({ meals: { rafi: ["bad"] }, guests: {}, expenses: [] }),
    ),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A little less mess, Rafi." }),
  ).toBeVisible();
  await expect(
    page.locator(".stat").filter({ hasText: "Total bazar" }),
  ).toContainText("৳16,870");
});

test("settlement preview includes the fund and never marks money paid", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Accounts", exact: true }).click();
  await page
    .getByRole("button", { name: "Preview settlement", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "No money is sent or marked as paid.",
  );
  await expect(page.getByRole("dialog")).toContainText(
    "Mess fund → Rafi Ahmed",
  );
  await expect(page.getByRole("dialog")).toContainText("৳3,049.41");
  await page
    .getByRole("button", { name: "Back to the khata", exact: true })
    .click();
  await expect(page.locator(".reconciled")).toContainText(
    "৳6,180 = mess fund ৳6,180",
  );
});
