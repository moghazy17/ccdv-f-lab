import { expect, test } from "@playwright/test";

test.describe("configuration builder journey", () => {
  test("generates three visible, transferable files and states the enforcement boundary", async ({ page }) => {
    await page.goto("./claude-code/config/");
    await page.getByRole("button", { name: "Generate files" }).click();
    await expect(page.getByRole("heading", { name: "Generated files" })).toBeVisible();
    await expect(page.getByText("CLAUDE.md", { exact: true })).toBeVisible();
    await expect(page.getByText(".claude/settings.json", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: ".claude/hooks/prevent-destructive-actions.py" })
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Settings read-back" })).toBeVisible();
    await expect(page.getByText("not enforced configuration")).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy CLAUDE.md" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download CLAUDE.md" })).toHaveAttribute("download", "CLAUDE.md");
    await expect(page.getByRole("button", { name: "Copy .claude/settings.json" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download .claude/settings.json" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Copy \.claude\/hooks/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Download \.claude\/hooks/ })).toBeVisible();
  });

  test("refuses malformed hook and permission combinations at the form", async ({ page }) => {
    await page.goto("./claude-code/config/");
    await page.locator("[data-config-matcher]").fill("");
    await page.getByRole("button", { name: "Generate files" }).click();
    await expect(page.getByText(/empty matcher matches nothing/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Generated files" })).toBeHidden();
  });

  test("executes the generated hook and presents denial and permission as hook output", async ({ page }) => {
    await page.goto("./claude-code/config/");
    await page.getByRole("button", { name: "Generate files" }).click();
    await page.getByRole("button", { name: "Run denial and permission proof" }).click();
    await expect(page.getByRole("heading", { name: /Destructive action: DENIED/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Ordinary action: PERMITTED/ })).toBeVisible();
    await expect(page.getByText("Evidence from the generated hook:").first()).toBeVisible();
  });

  test("keeps generated files available when the runtime cannot load", async ({ page }) => {
    await page.route("**/runtime/**", (route) => route.abort());
    await page.goto("./claude-code/config/");
    await page.getByRole("button", { name: "Generate files" }).click();
    await page.getByRole("button", { name: "Run denial and permission proof" }).click();
    await expect(page.getByText(/Execution is unavailable because the browser runtime could not load/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy CLAUDE.md" })).toBeVisible();
  });

  test("persists and discards the form draft", async ({ page }) => {
    await page.goto("./claude-code/config/");
    await page.locator("[data-config-project-name]").fill("Persistent project");
    await page.reload();
    await expect(page.locator("[data-config-project-name]")).toHaveValue("Persistent project");
    await page.getByRole("button", { name: "Discard saved draft" }).click();
    await page.reload();
    await expect(page.locator("[data-config-project-name]")).toHaveValue("My project");
  });
});
