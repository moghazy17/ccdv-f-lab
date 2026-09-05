import { expect, test } from "@playwright/test";

const reservedRoutes = [
  "./labs/",
  "./labs/batch/",
  "./mock/",
  "./mock/report/",
  "./flashcards/",
  "./domains/01-agents-and-workflows/quiz/",
  "./claude-code/terminal/",
  "./claude-code/config/",
  "./playground/"
];

for (const route of reservedRoutes) {
  test(`reserved route ${route} is inert at the configured base path`, async ({ page }) => {
    await page.goto(route);

    await expect(page).toHaveURL(/\/ccdv-f-lab\/.+\/$/);
    await expect(page.locator(".reserved-page")).toBeVisible();
    await expect(page.getByText("It contains no interactive capability.")).toBeVisible();
    await expect(page.locator("button, input, select, textarea")).toHaveCount(0);
  });
}
