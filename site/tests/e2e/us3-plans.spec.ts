import { expect, test } from "@playwright/test";

test.describe("US3 - Plans and progress tracking", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./plans/");
    await page.evaluate(() => localStorage.clear());
  });

  test("a candidate can open plans directly without using the diagnostic", async ({ page }) => {
    await page.goto("./plans/");

    await expect(page.locator("h1")).toContainText(/Study plans|Choose a plan/i);
    await expect(page.getByRole("link", { name: /1-week|one-week/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /3-weeks|three-week/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /6-weeks|six-week/i })).toBeVisible();
  });

  test("a plan page displays total hours, per-domain allocations, and weights ordered descending", async ({ page }) => {
    await page.goto("./plans/3-weeks/");

    // Total hours displayed
    await expect(page.getByTestId("plan-total-hours")).toContainText("42");

    // Heaviest domain reads first
    const domainRows = page.getByTestId("plan-allocation-row");
    await expect(domainRows).toHaveCount(8);
    await expect(domainRows.first()).toContainText("Applications and Integration");
    await expect(domainRows.first()).toContainText("33.1%");
    await expect(domainRows.first()).toContainText("13.902");

    // Lightest domain reads last
    await expect(domainRows.last()).toContainText("Eval, Testing, and Debugging");
    await expect(domainRows.last()).toContainText("2.6%");
    await expect(domainRows.last()).toContainText("1.092");
  });

  test("marking a domain allocation updates completion in both hours and domains, and survives reload", async ({ page }) => {
    await page.goto("./plans/3-weeks/");

    // Initial completion state
    const completionSummary = page.getByTestId("plan-completion-summary");
    await expect(completionSummary).toContainText("0 of 8 domains");
    await expect(completionSummary).toContainText("0");

    // Mark Domain 2 (Applications and Integration, 13.902 hours)
    const domain2Checkbox = page.getByTestId("mark-domain-2");
    await domain2Checkbox.check();

    await expect(completionSummary).toContainText("1 of 8 domains");
    await expect(completionSummary).toContainText("13.902");

    // Mark Domain 5 (Model Selection and Optimization, 7.056 hours -> 20.958 total)
    const domain5Checkbox = page.getByTestId("mark-domain-5");
    await domain5Checkbox.check();

    await expect(completionSummary).toContainText("2 of 8 domains");
    await expect(completionSummary).toContainText("20.958");

    // Reload page and confirm marks survived
    await page.reload();
    await expect(page.getByTestId("mark-domain-2")).toBeChecked();
    await expect(page.getByTestId("mark-domain-5")).toBeChecked();
    await expect(page.getByTestId("plan-completion-summary")).toContainText("2 of 8 domains");
    await expect(page.getByTestId("plan-completion-summary")).toContainText("20.958");

    // Advises that progress lives only in this browser
    await expect(page.getByTestId("storage-notice")).toContainText(/this browser/i);
  });

  test("marks are tracked per plan and switching plans does not lose or transfer marks", async ({ page }) => {
    await page.goto("./plans/3-weeks/");

    // Verify explanation of switching plans is visible
    await expect(page.getByTestId("plan-switching-notice")).toBeVisible();

    // Mark Domain 2 on 3-weeks plan
    await page.getByTestId("mark-domain-2").check();
    await expect(page.getByTestId("plan-completion-summary")).toContainText("1 of 8 domains");

    // Switch to 1-week plan
    await page.goto("./plans/1-week/");
    await expect(page.getByTestId("mark-domain-2")).not.toBeChecked();
    await expect(page.getByTestId("plan-completion-summary")).toContainText("0 of 8 domains");

    // Mark Domain 1 on 1-week plan
    await page.getByTestId("mark-domain-1").check();
    await expect(page.getByTestId("plan-completion-summary")).toContainText("1 of 8 domains");

    // Switch back to 3-weeks plan
    await page.goto("./plans/3-weeks/");
    await expect(page.getByTestId("mark-domain-2")).toBeChecked();
    await expect(page.getByTestId("mark-domain-1")).not.toBeChecked();
    await expect(page.getByTestId("plan-completion-summary")).toContainText("1 of 8 domains");
  });
});
