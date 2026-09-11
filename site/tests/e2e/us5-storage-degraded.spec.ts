import { expect, test } from "@playwright/test";

test.describe("US5 - practice surfaces with unavailable storage", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get: () => {
          throw new DOMException("Blocked by this browser", "SecurityError");
        }
      });
    });
  });

  test("keeps each surface usable and scores a mock already in progress", async ({ page }) => {
    await page.goto("./labs/router/");
    await page.locator("[data-code-pane-source]").fill("print('still editable')");
    await expect(page.locator("[data-code-pane-storage-notice]")).toContainText(
      "edits to this lab will not be kept"
    );
    await expect(page.getByRole("button", { name: "Run" })).toBeEnabled();

    await page.goto("./mock/");
    await expect(page.locator("[data-mock-storage-notice]")).toContainText(
      "can sit this mock and see its report"
    );
    await page.getByRole("button", { name: "Start the mock" }).click();
    await page.locator("[data-mock-item-options] input").first().check();
    await expect(page.getByTestId("mock-progress")).toContainText("1 of 53 answered");
    await page.getByTestId("mock-submit").click();
    await expect(page).toHaveURL(/\/mock\/report\/$/);
    await expect(page.getByTestId("score-overall")).toBeVisible();

    await page.goto("./domains/04-eval-testing-and-debugging/quiz/");
    await expect(page.locator("[data-quiz-storage-notice]")).toContainText(
      "answerable and scorable but its result is not kept"
    );
    await page.getByTestId("quiz-start").click();
    await page.getByTestId("quiz-submit").click();
    await expect(page.getByTestId("quiz-score")).toBeVisible();

    await page.goto("./flashcards/");
    await expect(page.locator("[data-flashcard-storage-notice]")).toContainText(
      "scheduling does not advance"
    );
    await page.getByRole("button", { name: "Reveal answer" }).click();
    await page.getByRole("button", { name: "I knew it" }).click();
    await expect(page.locator("[data-flashcard-status]")).toContainText(
      "scheduling does not advance"
    );
  });
});
