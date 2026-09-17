import { expect, test } from "@playwright/test";

test.describe("instruction hierarchy journey", () => {
  test("composes every assigned contribution in documented order", async ({ page }) => {
    await page.goto("./claude-code/terminal/");

    const composer = page.locator("[data-scope-composer]");
    await expect(composer).toBeVisible();
    await expect(composer.locator(".scope-composer__heading p").first()).toContainText(
      "managed policy, user, project, then local"
    );
    await expect(composer.locator("[data-scope-contributions] li")).toHaveCount(4);
    await expect(composer.locator("[data-scope-pane=\"managed-policy\"]")).toContainText(
      "Use named exports"
    );
    await expect(composer.locator("[data-scope-pane=\"local\"]")).toContainText(
      "Do not run destructive shell commands"
    );
  });

  test("reports conflicts without resolving either instruction", async ({ page }) => {
    await page.goto("./claude-code/terminal/");

    const conflict = page.locator("[data-scope-conflicts]");
    await expect(conflict).toContainText("Use named exports in source modules.");
    await expect(conflict).toContainText("Use default exports in source modules.");
    await expect(conflict).toContainText("Neither file overrides the other.");
  });

  test("explains that the prohibition needs a hook or settings rule", async ({ page }) => {
    await page.goto("./claude-code/terminal/");

    await expect(page.locator("[data-scope-enforcement]")).toContainText(
      "Instruction files are context rather than enforced configuration"
    );
    await expect(page.locator("[data-scope-enforcement]")).toContainText("hook to enforce it");
  });

  test("supports keyboard assignment, persists it, and offers the dated source", async ({ page }) => {
    await page.goto("./claude-code/terminal/");

    const assignment = page.locator("[data-scope-fragment=\"managed-named-exports\"]");
    await assignment.focus();
    await page.keyboard.press("End");
    await expect(assignment).toHaveValue("local");
    await expect(page.locator("[data-scope-pane=\"local\"]")).toContainText("Use named exports");
    await expect(page.getByRole("link", { name: "Read the dated source for the load order" })).toBeVisible();

    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem("ccdv-f:progress");
      return raw === null ? null : JSON.parse(raw).namespaces.claudeCode.scopeExercise.local;
    });
    expect(stored).toContain("managed-named-exports");

    await page.setViewportSize({ width: 320, height: 720 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);
  });
});
