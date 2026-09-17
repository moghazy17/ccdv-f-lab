import { expect, test } from "@playwright/test";

test.describe("Claude Code terminal journey", () => {
  test("runs the bounded simulation without inventing a response", async ({ page }) => {
    await page.goto("./claude-code/terminal/");
    const input = page.locator("[data-terminal-input]");

    await input.fill("/help");
    await page.locator("[data-terminal-form]").press("Enter");
    await expect(page.locator("[data-terminal-output]").last()).toContainText("Help");
    await expect(page.getByRole("link", { name: "Read the dated source" }).first()).toBeVisible();

    await input.fill("/verify-triage");
    await page.locator("[data-terminal-form]").press("Enter");
    await expect(page.getByText(/Custom command from \.claude\/commands\/verify-triage\.md/)).toBeVisible();

    await input.fill('claude -p "Summarize this diff" --output-format json');
    await page.locator("[data-terminal-form]").press("Enter");
    await expect(page.locator("[data-terminal-output]").last()).toContainText('"result":"<response>"');

    await input.fill('claude -p "Summarize this diff" --output-format stream-json --verbose --include-partial-messages');
    await page.locator("[data-terminal-form]").press("Enter");
    await expect(page.locator("[data-terminal-output]").last()).toContainText('"type":"result"');

    await input.fill("What should I change?");
    await page.locator("[data-terminal-form]").press("Enter");
    await expect(page.getByText(/Not implemented here\. This simulator cannot run Claude Code/)).toBeVisible();
    await expect(page.getByRole("link", { name: "See the implemented set." })).toBeVisible();
  });

  test("shows clearing, compaction, a hook decision, and keyboard re-run", async ({ page }) => {
    await page.goto("./claude-code/terminal/");
    const input = page.locator("[data-terminal-input]");
    await input.fill("/help");
    await page.locator("[data-terminal-form]").press("Enter");
    await page.getByRole("button", { name: "Re-run /help" }).press("Enter");
    await expect(page.locator("[data-terminal-output]")).toHaveCount(2);

    await input.fill("/compact");
    await page.locator("[data-terminal-form]").press("Enter");
    await expect(page.getByText(/Compaction keeps a summary/)).toBeVisible();

    await input.fill("/clear");
    await page.locator("[data-terminal-form]").press("Enter");
    await expect(page.getByText(/Transcript cleared\. Clearing discards every earlier turn/)).toBeVisible();

    await input.fill("/simulate-hook-denial");
    await page.locator("[data-terminal-form]").press("Enter");
    await expect(page.getByText(/Hook denial: this is the hook's decision/)).toBeVisible();
  });
});
