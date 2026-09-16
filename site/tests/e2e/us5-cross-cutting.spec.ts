import { expect, test } from "@playwright/test";

const practiceRoutes = [
  "./labs/",
  "./labs/batch/",
  "./labs/caching/",
  "./labs/config/",
  "./labs/context/",
  "./labs/ingest/",
  "./labs/loop/",
  "./labs/output/",
  "./labs/router/",
  "./labs/secrets/",
  "./labs/security/",
  "./labs/transport/",
  "./labs/mcp-server/",
  "./labs/evals/",
  "./mock/",
  "./mock/report/",
  "./domains/01-agents-and-workflows/quiz/",
  "./domains/02-applications-and-integration/quiz/",
  "./domains/03-claude-code/quiz/",
  "./domains/04-eval-testing-and-debugging/quiz/",
  "./domains/05-model-selection-and-optimization/quiz/",
  "./domains/06-prompt-and-context-engineering/quiz/",
  "./domains/07-security-and-safety/quiz/",
  "./domains/08-tools-and-mcps/quiz/",
  "./flashcards/"
];

async function expectNoPageOverflow(page: import("@playwright/test").Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)
    )
    .toBe(true);
}

test.describe("US5 - cross-cutting practice safeguards", () => {
  test("every practice page carries the unofficial notice and licence terms", async ({ page }) => {
    for (const route of practiceRoutes) {
      await page.goto(route);
      const footer = page.locator(".site-footer");
      await expect(footer).toContainText("unofficial and not affiliated with, endorsed by, or produced by Anthropic");
      await expect(footer).toContainText("Code is MIT; written study content is CC BY 4.0");
    }
  });

  test("reduced motion and forced colours retain timer, card, and runtime progress information", async ({
    page
  }) => {
    test.slow();
    await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });

    await page.goto("./mock/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole("button", { name: "Start the mock" }).click();
    await expect(page.getByTestId("mock-timer")).toHaveText(/\d{2}:\d{2} left/);
    await expect(page.getByTestId("mock-progress")).toContainText("answered");

    await page.goto("./flashcards/");
    await page.getByRole("button", { name: "Reveal answer" }).click();
    await expect(page.locator("[data-flashcard-back]")).toBeVisible();
    await expect(page.locator("[data-flashcard-answer]")).not.toBeEmpty();

    await page.goto("./labs/router/");
    const status = page.locator("[data-code-pane-status]");
    await expect(status).toHaveAttribute("role", "status");
    await expect(status).toHaveAttribute("aria-live", "polite");
    await page.getByRole("button", { name: "Run" }).click();
    await expect(status).not.toContainText("The runtime has not been downloaded", { timeout: 180_000 });
  });

  test("the lab, item controls, and report table do not force page-wide horizontal scrolling", async ({
    page
  }) => {
    await page.setViewportSize({ width: 360, height: 740 });

    await page.goto("./labs/router/");
    await page.locator("[data-code-pane-source]").fill("print('narrow screen')");
    await expectNoPageOverflow(page);

    await page.goto("./mock/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole("button", { name: "Start the mock" }).click();
    await page.locator("[data-mock-item-options] input").first().check();
    await expectNoPageOverflow(page);
    await page.getByTestId("mock-submit").click();
    await expect(page).toHaveURL(/\/mock\/report\/$/);
    await expect(page.getByTestId("score-domains")).toBeVisible();
    await expectNoPageOverflow(page);

    await page.goto("./domains/04-eval-testing-and-debugging/quiz/");
    await page.getByTestId("quiz-start").click();
    await page.locator("[data-quiz-list] input").first().check();
    await expectNoPageOverflow(page);
  });
});
