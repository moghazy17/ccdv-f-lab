import { expect, test } from "@playwright/test";

test("the built setup route is served at the configured base path", async ({ page }) => {
  await page.goto("./");

  await expect(page.getByRole("heading", { name: "CCDV-F community study kit" })).toBeVisible();
});
