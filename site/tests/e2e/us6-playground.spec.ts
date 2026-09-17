import { expect, test } from "@playwright/test";

test.describe("playground journey", () => {
  test("offers only a free-form terminal with the simulation guarantees", async ({ page }) => {
    await page.goto("./playground/");

    await expect(page.getByRole("heading", { name: "Claude Code playground" })).toBeVisible();
    await expect(page.locator("[data-simulated-terminal]")).toBeVisible();
    await expect(page.locator("[data-guided-tasks]")).toHaveCount(0);
    await expect(page.getByText(/does not run Claude Code, execute input, request a credential, or send data/i)).toBeVisible();
    await expect(page.getByText(/starts clean on every visit/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Clear transcript" })).toBeVisible();
  });

  test("links to the guided terminal and never writes progress or a transcript", async ({ page }) => {
    await page.goto("./playground/");
    const before = await page.evaluate(() => localStorage.getItem("ccdv-f:progress"));

    await page.locator("[data-terminal-input]").fill("/help");
    await page.locator("[data-terminal-form]").press("Enter");
    await expect(page.locator("[data-terminal-output]")).toContainText("Help");
    await expect(page.getByRole("link", { name: "guided Claude Code terminal" })).toHaveAttribute(
      "href",
      "/ccdv-f-lab/claude-code/terminal/"
    );
    await expect(page.getByText(/ordered task set/i)).toBeVisible();

    expect(await page.evaluate(() => localStorage.getItem("ccdv-f:progress"))).toBe(before);
  });

  test("starts clean again after a return visit", async ({ page }) => {
    await page.goto("./playground/");
    await page.locator("[data-terminal-input]").fill("/help");
    await page.locator("[data-terminal-form]").press("Enter");
    await expect(page.locator("[data-terminal-output]")).toHaveCount(1);

    await page.goto("./playground/");
    await expect(page.locator("[data-terminal-output]")).toHaveCount(0);
    await expect(page.getByText("No simulated command has run in this visit.")).toBeVisible();
  });
});
