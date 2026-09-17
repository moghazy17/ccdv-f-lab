import { expect, test } from "@playwright/test";

const teachingTypes = ["rules", "settings", "command", "skill", "agent", "hook"];

test.describe("repository worked example", () => {
  test("shows every teaching component type and keeps other files in inventory", async ({ page }) => {
    await page.goto("./claude-code/terminal/");

    const example = page.locator("[data-worked-example]");
    for (const componentType of teachingTypes) {
      await expect(example.locator(`[data-teaching-type="${componentType}"]`)).toBeVisible();
    }
    await expect(example.locator('[data-inventory-type="documentation"]')).toBeVisible();
  });

  test("renders payload, decision, exit code, and output from the recording", async ({ page }) => {
    await page.goto("./claude-code/terminal/");

    const cases = page.locator("[data-hook-recording-case]");
    await expect(cases.first().locator("[data-recorded-payload]")).not.toBeEmpty();
    await expect(cases.first().locator("[data-recorded-decision]")).not.toBeEmpty();
    await expect(cases.first().locator("[data-recorded-exit-code]")).not.toBeEmpty();
    await expect(cases.first().locator("[data-recorded-message]")).toBeVisible();
  });

  test("shows the complete path inventory without empty source panes", async ({ page }) => {
    await page.goto("./claude-code/terminal/");

    const paths = page.locator("[data-worked-example-path]");
    expect(await paths.count()).toBeGreaterThan(teachingTypes.length);
    await expect(page.locator("[data-worked-example-contents]")).toHaveCount(teachingTypes.length);
  });

  test("links every inventory entry to its repository file and explanatory note", async ({ page }) => {
    await page.goto("./claude-code/terminal/");

    const rows = page.locator("[data-worked-example-path]");
    for (let index = 0; index < (await rows.count()); index += 1) {
      const row = rows.nth(index);
      await expect(row.locator("[data-repository-link]")).toHaveAttribute(
        "href",
        /^https:\/\/github\.com\/moghazy17\/ccdv-f-lab\/blob\/main\//
      );
      await expect(row.locator("[data-note-link]")).toHaveAttribute(
        "href",
        /^\/ccdv-f-lab\/domains\/03-claude-code\/#/
      );
    }
  });
});
