import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];

const surfaces = [
  { name: "guided terminal", route: "./claude-code/terminal/" },
  { name: "configuration builder", route: "./claude-code/config/" },
  { name: "playground", route: "./playground/" }
];

async function tabTo(page: Page, selector: string): Promise<void> {
  const focusables = await page.locator("a, button, input, select, textarea, [tabindex='0']").count();
  for (let step = 0; step <= focusables; step += 1) {
    await page.keyboard.press("Tab");
    if (await page.evaluate((target) => document.activeElement?.matches(target) ?? false, selector)) {
      return;
    }
  }
  throw new Error(`Keyboard focus never reached ${selector}.`);
}

for (const surface of surfaces) {
  test(`${surface.name} has no critical or serious accessibility violations`, async ({ page }) => {
    await page.goto(surface.route);
    const results = await new AxeBuilder({ page: page as unknown as AxePage }).analyze();
    expect(
      results.violations.filter(
        (violation) => violation.impact === "critical" || violation.impact === "serious"
      )
    ).toEqual([]);
  });
}

test("guided terminal journey is completable by keyboard", async ({ page }) => {
  await page.goto("./claude-code/terminal/");
  await tabTo(page, "[data-terminal-input]");
  await page.keyboard.type("/help");
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-terminal-output]").last()).not.toBeEmpty();

  await tabTo(page, "[data-scope-fragment]");
  await page.keyboard.press("End");
  await expect(page.locator("[data-scope-composer-status]")).toContainText("Composed");
});

test("configuration-builder journey is completable by keyboard", async ({ page }) => {
  await page.goto("./claude-code/config/");
  await tabTo(page, "[data-config-project-name]");
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Keyboard project");
  await tabTo(page, "[data-config-generate]");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Generated files" })).toBeVisible();
});

test("playground journey is completable by keyboard", async ({ page }) => {
  await page.goto("./playground/");
  await tabTo(page, "[data-terminal-input]");
  await page.keyboard.type("/help");
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-terminal-output]").last()).not.toBeEmpty();
  await tabTo(page, "[data-terminal-clear]");
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-terminal-empty]")).toBeVisible();
});
