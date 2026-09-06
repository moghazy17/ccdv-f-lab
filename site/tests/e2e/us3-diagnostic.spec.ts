import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];

test.describe("US3 - Diagnostic self-report flow and accessibility", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./diagnostic/");
    await page.evaluate(() => localStorage.clear());
  });

  test("diagnostic explains self-report purpose and makes no score predictions", async ({ page }) => {
    await page.goto("./diagnostic/");

    await expect(page.locator("h1")).toContainText(/Diagnostic|Find your level|Study plan recommender/i);
    // Disclaims measuring knowledge or predicting score (FR-030)
    await expect(page.getByTestId("diagnostic-disclaimer")).toContainText(/self-report|does not measure|no score/i);
  });

  test("diagnostic is operable entirely by keyboard, announces recommendation, and moves focus", async ({ page }) => {
    await page.goto("./diagnostic/");

    // Fill weeks available via keyboard
    const weeksInput = page.getByLabel(/weeks available/i);
    await weeksInput.focus();
    await weeksInput.fill("3");

    // Fill hours per week via keyboard
    const hoursInput = page.getByLabel(/hours per week/i);
    await hoursInput.focus();
    await hoursInput.fill("14");

    // Submit form via keyboard (pressing Enter on submit button)
    const submitButton = page.getByRole("button", { name: /get recommendation|find my plan|submit/i });
    await submitButton.focus();
    await page.keyboard.press("Enter");

    // Focus moves to the recommendation result
    const resultRegion = page.getByTestId("diagnostic-result");
    await expect(resultRegion).toBeVisible();
    await expect(resultRegion).toBeFocused();

    // Contains live-region or status announcement
    await expect(resultRegion).toHaveAttribute("aria-live", "polite");

    // Announces 3-weeks plan recommendation and reason
    await expect(resultRegion).toContainText(/3-week/i);
    await expect(resultRegion).toContainText(/42/i);

    // Offers a direct link to the recommended plan
    const planLink = resultRegion.getByRole("link", { name: /open 3-week plan|view plan|3-week/i });
    await expect(planLink).toBeVisible();

    // Reload page to verify saved diagnostic response persists
    await page.reload();
    await expect(page.getByTestId("diagnostic-result")).toBeVisible();
    await expect(page.getByTestId("diagnostic-result")).toContainText(/3-week/i);
  });

  test("diagnostic page has no axe violations before and after submission", async ({ page }) => {
    await page.goto("./diagnostic/");

    const axePage = page as unknown as AxePage;
    const initialResults = await new AxeBuilder({ page: axePage }).analyze();
    expect(initialResults.violations).toEqual([]);

    // Fill and submit
    await page.getByLabel(/weeks available/i).fill("3");
    await page.getByLabel(/hours per week/i).fill("14");
    await page.getByRole("button", { name: /get recommendation|find my plan|submit/i }).click();

    await expect(page.getByTestId("diagnostic-result")).toBeVisible();

    const submittedResults = await new AxeBuilder({ page: axePage }).analyze();
    expect(submittedResults.violations).toEqual([]);
  });
});
