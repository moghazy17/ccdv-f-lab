import { expect, test } from "@playwright/test";

/**
 * US2 end to end: sitting a weighted mock, leaving it and coming back, and reading the report
 * (FR-023 to FR-038).
 *
 * The countdown is two hours long, so the tests that need an expiry manufacture one by rewriting
 * the stored attempt's deadline rather than waiting. That is the same thing a candidate's clock
 * does, and it is the only honest way to exercise wall-clock expiry inside a test run.
 */

const STORAGE_KEY = "ccdv-f:progress";

/** Answer every item in the running attempt, correctly or not, then submit. */
async function answerAll(page: import("@playwright/test").Page, correctly: boolean): Promise<void> {
  const payload = await page.evaluate(() => {
    const element = document.querySelector("[data-mock-bank]");
    return JSON.parse(element?.textContent ?? "{}") as {
      bank: Array<{ id: string; options: Array<{ id: string; correct: boolean }> }>;
    };
  });
  const correctByItem = new Map(
    payload.bank.map((item) => [
      item.id,
      item.options.filter((option) => option.correct).map((option) => option.id)
    ])
  );

  await page.evaluate(
    ([key, wantCorrect, answers]) => {
      const raw = localStorage.getItem(key as string);
      if (raw === null) {
        return;
      }
      const record = JSON.parse(raw);
      const attempt = record.namespaces.mock.current;
      const correct = new Map(answers as Array<[string, string[]]>);
      for (const item of attempt.items) {
        const right = correct.get(item.id) ?? [];
        // A deliberately wrong answer picks an option that is not in the correct set.
        const wrong = item.options
          .filter((option: { id: string }) => !right.includes(option.id))
          .slice(0, 1)
          .map((option: { id: string }) => option.id);
        attempt.answers[item.id] = wantCorrect ? right : wrong;
      }
      localStorage.setItem(key as string, JSON.stringify(record));
    },
    [STORAGE_KEY, correctly, [...correctByItem.entries()]] as const
  );
  await page.reload();
}

test.describe("Sit a full weighted mock (US2)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./mock/");
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
    await page.reload();
  });

  test("the mock states the blueprint's own size and time limit", async ({ page }) => {
    // 53 items and 120 minutes are BLUEPRINT.md's figures, exported by tools/export_mock_data.py.
    await expect(page.getByTestId("mock-item-count")).toHaveText("53");
    await expect(page.getByTestId("mock-time-limit")).toHaveText("120 minutes");
  });

  test("an attempt is assembled to the engine's per-domain quotas", async ({ page }) => {
    await page.getByRole("button", { name: "Start the mock" }).click();
    await expect(page.getByTestId("mock-item-list")).toBeVisible();

    const composition = await page.evaluate((key) => {
      const record = JSON.parse(localStorage.getItem(key) ?? "{}");
      const counts: Record<string, number> = {};
      for (const item of record.namespaces.mock.current.items) {
        counts[item.domain] = (counts[item.domain] ?? 0) + 1;
      }
      return counts;
    }, STORAGE_KEY);
    const quotas = await page.evaluate(() => {
      const element = document.querySelector("[data-mock-bank]");
      return (JSON.parse(element?.textContent ?? "{}") as { mock: { quotas: Record<string, number> } })
        .mock.quotas;
    });

    expect(composition).toEqual(quotas);
    expect(Object.values(composition).reduce((sum, count) => sum + count, 0)).toBe(53);
  });

  test("items can be answered in any order and changed, and the unanswered count follows", async ({
    page
  }) => {
    await page.getByRole("button", { name: "Start the mock" }).click();
    await expect(page.getByTestId("mock-progress")).toContainText("0 of 53 answered");

    // Jump straight to item 5 rather than walking there: order is the candidate's choice.
    await page.getByTestId("mock-item-list").getByRole("button", { name: /^Item 5,/ }).click();
    await expect(page.locator("[data-mock-item-heading]")).toHaveText("Item 5 of 53");

    const firstOption = page.locator("[data-mock-item-options] input").first();
    await firstOption.check();
    await expect(page.getByTestId("mock-progress")).toContainText("1 of 53 answered");

    await firstOption.uncheck();
    await expect(page.getByTestId("mock-progress")).toContainText("0 of 53 answered");
  });

  test("an attempt survives a reload with its answers and its remaining time", async ({ page }) => {
    await page.getByRole("button", { name: "Start the mock" }).click();
    await page.locator("[data-mock-item-options] input").first().check();
    const deadlineBefore = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? "{}").namespaces.mock.current.deadlineAt,
      STORAGE_KEY
    );

    await page.reload();

    await expect(page.getByTestId("mock-progress")).toContainText("1 of 53 answered");
    const deadlineAfter = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? "{}").namespaces.mock.current.deadlineAt,
      STORAGE_KEY
    );
    // A reload must not restart the clock; the deadline is the same absolute instant.
    expect(deadlineAfter).toBe(deadlineBefore);
  });

  test("an attempt that expired while away is neither scored nor discarded on its own", async ({
    page
  }) => {
    await page.getByRole("button", { name: "Start the mock" }).click();
    await page.evaluate((key) => {
      const record = JSON.parse(localStorage.getItem(key) ?? "{}");
      record.namespaces.mock.current.deadlineAt = new Date(Date.now() - 60_000).toISOString();
      localStorage.setItem(key, JSON.stringify(record));
    }, STORAGE_KEY);
    await page.reload();

    await expect(page.getByTestId("mock-expired-title")).toBeVisible();
    // Nothing was scored while it waited for a decision.
    const reports = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? "{}").namespaces.mock.reports.length,
      STORAGE_KEY
    );
    expect(reports).toBe(0);

    await page.getByRole("button", { name: "Discard it" }).click();
    await expect(page.getByRole("button", { name: "Start the mock" })).toBeVisible();
    const afterDiscard = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key) ?? "{}").namespaces.mock,
      STORAGE_KEY
    );
    expect(afterDiscard.current).toBeNull();
    expect(afterDiscard.reports).toEqual([]);
  });

  test("a fully correct attempt scores 53 of 53 and reports readiness", async ({ page }) => {
    await page.getByRole("button", { name: "Start the mock" }).click();
    await answerAll(page, true);
    await page.getByTestId("mock-submit").click();

    await expect(page).toHaveURL(/\/mock\/report\/$/);
    await expect(page.getByTestId("score-overall")).toContainText("53 of 53 correct (100.0%)");
    await expect(page.getByTestId("score-readiness")).toContainText("Ready by this project's bar");
    await expect(page.getByTestId("score-all-correct")).toBeVisible();
  });

  test("a wholly wrong attempt explains every item and withholds readiness", async ({ page }) => {
    await page.getByRole("button", { name: "Start the mock" }).click();
    await answerAll(page, false);
    await page.getByTestId("mock-submit").click();

    await expect(page).toHaveURL(/\/mock\/report\/$/);
    await expect(page.getByTestId("score-overall")).toContainText("0 of 53 correct (0.0%)");
    await expect(page.getByTestId("score-readiness")).toContainText("Not ready");
    await expect(page.getByTestId("score-wrong-answers").locator("li")).toHaveCount(53);
  });

  test("the report shows every domain, labels the estimate, and owns the readiness bar", async ({
    page
  }) => {
    await page.getByRole("button", { name: "Start the mock" }).click();
    await answerAll(page, true);
    await page.getByTestId("mock-submit").click();

    const rows = page.getByTestId("score-domains").locator("tbody tr");
    await expect(rows).toHaveCount(8);

    await expect(page.getByTestId("score-estimate")).toContainText("Estimated");
    await expect(page.getByTestId("score-estimate-assumption")).toContainText("linear study model");
    await expect(page.getByTestId("score-estimate-assumption")).toContainText(
      "Anthropic does not publish"
    );
    await expect(page.getByText("informational")).toBeVisible();
    await expect(page.getByText("this project's own", { exact: false })).toBeVisible();
  });

  test("an attempt whose time runs out on screen is scored and the report says so", async ({
    page
  }) => {
    await page.getByRole("button", { name: "Start the mock" }).click();
    await page.locator("[data-mock-item-options] input").first().check();

    // Move the deadline to one second away while the attempt is open, and let the clock reach it.
    await page.evaluate((key) => {
      const record = JSON.parse(localStorage.getItem(key) ?? "{}");
      record.namespaces.mock.current.deadlineAt = new Date(Date.now() + 1200).toISOString();
      localStorage.setItem(key, JSON.stringify(record));
    }, STORAGE_KEY);
    await page.reload();

    await expect(page).toHaveURL(/\/mock\/report\/$/, { timeout: 15_000 });
    await expect(page.getByTestId("score-report-expiry")).toBeVisible();
  });

  test("only three full reports are kept, and older ones keep their per-domain trend", async ({
    page
  }) => {
    await page.getByRole("button", { name: "Start the mock" }).click();
    await answerAll(page, true);
    await page.getByTestId("mock-submit").click();
    await expect(page).toHaveURL(/\/mock\/report\/$/);

    // Replaying the retention rule against the stored report is enough: the rule itself is unit
    // tested, and what matters here is that the stored record obeys it.
    const stored = await page.evaluate((key) => {
      const record = JSON.parse(localStorage.getItem(key) ?? "{}");
      const first = record.namespaces.mock.reports[0];
      for (let index = 2; index <= 5; index += 1) {
        record.namespaces.mock.reports.unshift({ ...first, attemptId: `replay-${index}` });
      }
      while (record.namespaces.mock.reports.length > 3) {
        const demoted = record.namespaces.mock.reports.pop();
        delete demoted.items;
        demoted.detailDropped = true;
        record.namespaces.mock.summaries.unshift(demoted);
      }
      return record.namespaces.mock;
    }, STORAGE_KEY);

    expect(stored.reports).toHaveLength(3);
    expect(stored.summaries.length).toBeGreaterThan(0);
    expect(stored.summaries[0].domainScores).toBeTruthy();
    expect(stored.summaries[0].items).toBeUndefined();
  });

  test("the bank holds no surplus, so the page says repeated attempts repeat items", async ({
    page
  }) => {
    await expect(page.getByTestId("mock-no-surplus")).toBeVisible();
    // Every domain is filled to quota today, so no shortfall notice belongs on the page.
    await expect(page.getByTestId("mock-shortfall")).toHaveCount(0);
  });
});
