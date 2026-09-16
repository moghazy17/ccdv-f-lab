import { expect, test } from "@playwright/test";

/**
 * US1 end to end: a candidate opens a lab, edits it, runs it, sees real output, stops a run that
 * will not end, restores the pane, and finds their edit still there on the next visit
 * (FR-006, FR-007, FR-010, FR-011, FR-013, FR-014, FR-016).
 */

test.describe("Run the reference application (US1)", () => {
  test.slow();

  test("the catalogue lists every lab and says which run here", async ({ page }) => {
    await page.goto("./labs/");

    const rows = page.getByTestId("labs-catalogue").locator("tbody tr");
    await expect(rows).toHaveCount(13);
    await expect(page.getByTestId("labs-runnable-summary")).toContainText("12 of 13");

    // FR-009: each concept the reference application demonstrates is reachable from the index.
    for (const concept of [
      "pinned model versions",
      "adaptive thinking",
      "structured output",
      "tool use and dispatch",
      "the MCP server",
      "prompt caching",
      "the batch path",
      "guardrails",
      "the eval harness"
    ]) {
      await expect(page.getByTestId("labs-catalogue")).toContainText(concept);
    }
  });

  test("a lab links to its note and its source, and says when the note is a scaffold", async ({
    page
  }) => {
    await page.goto("./labs/router/");

    const noteLink = page.getByTestId("lab-note-link");
    await expect(noteLink).toBeVisible();
    await expect(noteLink).toHaveAttribute("href", /\/ccdv-f-lab\/domains\/[^/]+\/$/);

    const sourceLink = page.getByTestId("lab-source-link");
    await expect(sourceLink).toBeVisible();
    await expect(sourceLink).toHaveAttribute("href", /github\.com\/.+\/lab\/router\.py$/);

    // Domain 5's notes are authored, so neither qualifier belongs on this lab.
    await expect(page.getByTestId("lab-note-scaffold")).toHaveCount(0);
  });

  test("a lab whose note is still a scaffold says so instead of linking to an empty page", async ({
    page
  }) => {
    await page.goto("./labs/loop/");
    await expect(page.getByTestId("lab-note-scaffold")).toBeVisible();
  });

  test("editing, running, and reading real output", async ({ page }) => {
    await page.goto("./labs/router/");

    const source = page.locator("[data-code-pane-source]");
    const status = page.locator("[data-code-pane-status]");
    const output = page.locator("[data-code-pane-output-text]");

    await expect(source).toHaveValue(/from lab\.router import route_task/);

    await page.locator("[data-code-pane-run]").click();
    await expect(status).toContainText("Finished in", { timeout: 180_000 });

    // The output is the repository's own module talking, not a canned string.
    await expect(output).toContainText("classification:");
    await expect(output).toContainText("escalation:");
  });

  test("an uncaught exception shows its full traceback", async ({ page }) => {
    await page.goto("./labs/router/");

    await page.locator("[data-code-pane-source]").fill("raise ValueError('deliberate')");
    await page.locator("[data-code-pane-run]").click();
    await expect(page.locator("[data-code-pane-status]")).toContainText("Finished in", {
      timeout: 180_000
    });

    const output = page.locator("[data-code-pane-output-text]");
    await expect(output).toContainText("ValueError");
    await expect(output).toContainText("deliberate");
  });

  test("Stop ends a run that will not end, and the page stays responsive", async ({ page }) => {
    await page.goto("./labs/router/");

    await page.locator("[data-code-pane-source]").fill("while True:\n    pass\n");
    await page.locator("[data-code-pane-run]").click();

    const stop = page.locator("[data-code-pane-stop]");
    await expect(stop).toBeEnabled({ timeout: 180_000 });
    await stop.click();

    await expect(page.locator("[data-code-pane-status]")).toContainText("Stopped");
    // Responsive means the main thread never froze: an unrelated control still answers.
    await expect(page.locator("[data-code-pane-restore]")).toBeEnabled();
    await expect(page.locator("[data-code-pane-run]")).toBeEnabled();
  });

  test("an edit persists between visits and Restore discards it for that lab only", async ({
    page
  }) => {
    await page.goto("./labs/router/");
    const source = page.locator("[data-code-pane-source]");
    const original = await source.inputValue();

    await source.fill("print('my own experiment')");
    await page.goto("./labs/caching/");
    await page.locator("[data-code-pane-source]").fill("print('a different lab')");

    await page.goto("./labs/router/");
    await expect(source).toHaveValue("print('my own experiment')");

    await page.locator("[data-code-pane-restore]").click();
    await expect(source).toHaveValue(original);

    // Restoring one lab leaves every other lab's edit alone.
    await page.goto("./labs/caching/");
    await expect(page.locator("[data-code-pane-source]")).toHaveValue("print('a different lab')");
  });

  test("the lab the runtime cannot satisfy is a page with source and no Run control", async ({
    page
  }) => {
    await page.goto("./labs/mcp-server/");

    await expect(page.getByTestId("lab-source")).toBeVisible();
    await expect(page.getByTestId("lab-unrunnable-reason")).toContainText("mcp");
    await expect(page.locator("[data-code-pane-run]")).toHaveCount(0);
    await expect(page.getByTestId("lab-concept")).toContainText("the MCP server");
  });
});
