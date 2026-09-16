import { expect, test } from "@playwright/test";

/**
 * US3: checking one domain before moving on. Both halves of a domain's self-check exist, they are
 * visibly separate, and only one of them is scored (FR-039 to FR-042).
 */

const STORAGE_KEY = "ccdv-f:progress";

/** Domain 5 has authored notes, so it is the domain whose recall prompts actually exist. */
const AUTHORED = "05-model-selection-and-optimization";
/** Domain 4 draws a single item from a full mock, which is the shortest quiz the blueprint allows. */
const SMALLEST = "04-eval-testing-and-debugging";

test.describe("Check one domain before moving on (US3)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`./domains/${AUTHORED}/quiz/`);
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
    await page.reload();
  });

  test("the two halves are separate, and the page says which one counts", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Recall prompts" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Scored quiz" })).toBeVisible();
    await expect(page.getByText("Only the quiz feeds a readiness signal")).toBeVisible();
  });

  test("recall prompts come from the notes and are graded by the candidate", async ({ page }) => {
    const cards = page.locator("[data-recall-card]");
    await expect(cards.first()).toBeVisible();

    const first = cards.first();
    // The prompt is the note's own wording, rejoined from the 100-column wrap.
    await expect(first.locator(".recall-prompts__prompt")).toContainText("?");

    await first.locator("[data-recall-reveal]").click();
    await expect(first.locator("[data-recall-answer]")).toBeVisible();

    await first.getByRole("button", { name: "I did not" }).click();
    await expect(first.locator("[data-recall-state]")).toContainText("not known");

    // Self-grading is kept, but it lives in the recall namespace and scores nothing.
    const stored = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? "{}").namespaces.quiz,
      STORAGE_KEY
    );
    expect(Object.values(stored.recall)).toContain("unknown");
    expect(stored.results).toEqual({});
  });

  test("the quiz asks for the domain's share of a full mock", async ({ page }) => {
    await expect(page.getByTestId("quiz-length")).toContainText("9 items");
    await expect(page.getByTestId("quiz-length")).toContainText("53-item mock");

    await page.getByTestId("quiz-start").click();
    await expect(page.locator("[data-quiz-list] > li")).toHaveCount(9);
  });

  test("quiz lengths differ between domains as the weights do", async ({ page }) => {
    await page.goto(`./domains/${SMALLEST}/quiz/`);
    await expect(page.getByTestId("quiz-length")).toContainText("1 item");

    await page.goto("./domains/02-applications-and-integration/quiz/");
    await expect(page.getByTestId("quiz-length")).toContainText("17 items");
  });

  test("a scored quiz explains every wrong answer and is kept per domain", async ({ page }) => {
    await page.getByTestId("quiz-start").click();
    await expect(page.locator("[data-quiz-list] > li")).toHaveCount(9);

    // Submit with nothing selected: every item is wrong, so every item must be explained.
    await page.getByTestId("quiz-submit").click();

    await expect(page.getByTestId("quiz-score")).toContainText("0 of 9 correct");
    await expect(page.getByTestId("quiz-wrong").locator("li")).toHaveCount(9);
    await expect(page.getByTestId("quiz-all-correct")).toBeHidden();

    const results = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? "{}").namespaces.quiz.results,
      STORAGE_KEY
    );
    expect(Object.keys(results)).toEqual([AUTHORED]);
    expect(results[AUTHORED].correct).toBe(0);
    expect(results[AUTHORED].itemCount).toBe(9);
  });

  test("a domain whose notes carry no prompts says so instead of showing nothing", async ({
    page
  }) => {
    // Domain 4's notes are still a scaffold, so its recall section has a condition to state.
    await page.goto(`./domains/${SMALLEST}/quiz/`);
    await expect(page.getByTestId("recall-empty")).toBeVisible();
    // Its quiz still exists, because its bank does.
    await expect(page.getByTestId("quiz-start")).toBeVisible();
  });

  test("the domain page points at the self-check and states which half counts", async ({ page }) => {
    await page.goto(`./domains/${AUTHORED}/`);
    const region = page.getByTestId("domain-practice-region");

    await expect(region).toContainText("Only the scored quiz feeds a readiness signal");
    await expect(region.getByRole("link", { name: /self-check/i })).toHaveAttribute(
      "href",
      new RegExp(`/domains/${AUTHORED}/quiz/$`)
    );
  });

  test("quiz results appear together on the progress page and clear without touching plan marks", async ({
    page
  }) => {
    await page.getByTestId("quiz-start").click();
    await page.getByTestId("quiz-submit").click();
    await expect(page.getByTestId("quiz-score")).toBeVisible();

    await page.goto("./plans/3-weeks/");
    await page.locator('input[type="checkbox"]').first().check();

    await page.goto("./progress/");
    await expect(page.getByTestId("quiz-results")).toBeVisible();
    await expect(page.getByTestId("quiz-results")).toContainText(AUTHORED);

    await page.getByTestId("clear-practice-button").click();
    await expect(page.getByTestId("clear-practice-status")).toContainText("cleared");
    await expect(page.getByTestId("quiz-results-empty")).toBeVisible();

    const remaining = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? "{}").namespaces,
      STORAGE_KEY
    );
    expect(remaining.quiz.results).toEqual({});
    // The plan mark is foundation data and must have survived the clear.
    expect(Object.keys(remaining.foundation.planMarks).length).toBeGreaterThan(0);
  });
});
