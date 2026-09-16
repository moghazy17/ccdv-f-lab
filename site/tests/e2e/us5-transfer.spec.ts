import { expect, test } from "@playwright/test";

async function downloadText(page: import("@playwright/test").Page): Promise<string> {
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-button").click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

test.describe("US5 - transfer every practice surface", () => {
  test("exports results from every surface and restores them in a fresh browser context", async ({
    browser
  }) => {
    const firstContext = await browser.newContext();
    const first = await firstContext.newPage();

    await first.goto("./labs/router/");
    await first.evaluate(() => localStorage.clear());
    await first.reload();
    const source = first.locator("[data-code-pane-source]");
    await source.fill("print('transferred lab edit')");
    await expect(source).toHaveValue("print('transferred lab edit')");

    await first.goto("./mock/");
    await first.getByRole("button", { name: "Start the mock" }).click();
    await first.locator("[data-mock-item-options] input").first().check();
    await first.getByTestId("mock-submit").click();
    await expect(first).toHaveURL(/\/mock\/report\/$/);
    await expect(first.getByTestId("score-overall")).toBeVisible();

    await first.goto("./domains/04-eval-testing-and-debugging/quiz/");
    await first.getByTestId("quiz-start").click();
    await first.getByTestId("quiz-submit").click();
    await expect(first.getByTestId("quiz-score")).toBeVisible();

    await first.goto("./flashcards/");
    const cardId = await first.locator("[data-flashcard-id]").textContent();
    await first.getByRole("button", { name: "Reveal answer" }).click();
    await first.getByRole("button", { name: "I did not know it" }).click();
    await expect(first.locator("[data-flashcard-status]")).toContainText("Marked not known");

    await first.goto("./progress/");
    const exported = await downloadText(first);
    const expected = JSON.parse(exported) as { namespaces: Record<string, unknown> };
    await firstContext.close();

    const secondContext = await browser.newContext();
    const second = await secondContext.newPage();
    await second.goto("./progress/");
    await second.getByTestId("import-input").setInputFiles({
      name: "ccdv-f-progress-transfer.json",
      mimeType: "application/json",
      buffer: Buffer.from(exported, "utf8")
    });
    await second.getByTestId("confirm-replace-button").click();
    await expect(second.getByTestId("import-success")).toBeVisible();

    await second.goto("./labs/router/");
    await expect(second.locator("[data-code-pane-source]")).toHaveValue("print('transferred lab edit')");

    await second.goto("./mock/report/");
    await expect(second.getByTestId("score-overall")).toBeVisible();

    await second.goto("./progress/");
    await expect(second.getByTestId("quiz-results")).toContainText("eval-testing-and-debugging");

    await second.goto("./flashcards/");
    expect(cardId).not.toBeNull();
    const restored = await second.evaluate(() => {
      const raw = localStorage.getItem("ccdv-f:progress");
      return JSON.parse(raw ?? "{}").namespaces;
    });
    expect(restored).toEqual(expected.namespaces);
    await secondContext.close();
  });
});
