import { expect, test } from "@playwright/test";

test("terminal transcript and streamed output retain every label with forced preferences", async ({
  page
}) => {
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.goto("./claude-code/terminal/");
  const input = page.locator("[data-terminal-input]");

  await input.fill(
    'claude -p "Summarize this diff" --output-format stream-json --verbose --include-partial-messages'
  );
  await page.locator("[data-terminal-form]").press("Enter");
  await expect(page.locator("[data-terminal-output]").last()).toContainText('"type":"system"');
  await expect(page.locator("[data-terminal-output]").last()).toContainText('"type":"result"');
  await expect(page.locator("[data-terminal-complete]")).toContainText("completed");

  await input.fill("/simulate-hook-denial");
  await page.locator("[data-terminal-form]").press("Enter");
  const decision = page.locator(".terminal__turn--denied").last();
  await expect(decision.locator(".terminal__denial")).toBeVisible();
  await expect(decision).toContainText("Hook denial");
});

test("generated decisions remain explicit with forced colors and reduced motion", async ({ page }) => {
  test.slow();
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page.goto("./claude-code/config/");
  await page.getByRole("button", { name: "Generate files" }).click();
  await page.getByRole("button", { name: "Run denial and permission proof" }).click();

  const decisions = page.locator(".config-builder__decision");
  await expect(decisions.first().getByRole("heading")).toContainText("DENIED");
  await expect(decisions.last().getByRole("heading")).toContainText("PERMITTED");
});
