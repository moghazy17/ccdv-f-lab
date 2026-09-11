import { expect, test } from "@playwright/test";

// The lab, mock, domain-quiz, and flashcard addresses left this list when feature 002 filled them;
// the US1 through US4 specs cover them now. Every address here is still reserved and still inert.
const reservedRoutes = [
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
