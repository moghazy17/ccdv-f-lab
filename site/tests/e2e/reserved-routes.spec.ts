import { expect, test } from "@playwright/test";

const liveRoutes = [
  { route: "./claude-code/config/", heading: "Configuration builder", control: "[data-config-form]" },
  { route: "./claude-code/terminal/", heading: "Claude Code terminal simulator", control: "[data-simulated-terminal] input" },
  { route: "./playground/", heading: "Claude Code playground", control: "[data-simulated-terminal] input" }
];

for (const item of liveRoutes) {
  test(`established route ${item.route} is live at its configured path`, async ({ page }) => {
    await page.goto(item.route);
    await expect(page).toHaveURL(/\/ccdv-f-lab\/.+\/$/);
    await expect(page.getByRole("heading", { name: item.heading })).toBeVisible();
    await expect(page.locator(item.control)).toBeVisible();
  });
}
