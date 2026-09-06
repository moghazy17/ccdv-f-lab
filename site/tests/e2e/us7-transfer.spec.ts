import { expect, test } from "@playwright/test";

test.describe("US7 - Progress transfer (export, clear, second-browser, and restore)", () => {
  test("export produces exact envelope as pretty-printed JSON named ccdv-f-progress-YYYY-MM-DD.json without network requests", async ({
    page
  }) => {
    // Navigate to a plan and mark domains 2 and 5
    await page.goto("./plans/3-weeks/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.getByTestId("mark-domain-2").check();
    await page.getByTestId("mark-domain-5").check();
    await expect(page.getByTestId("mark-domain-2")).toBeChecked();
    await expect(page.getByTestId("mark-domain-5")).toBeChecked();

    // Navigate to progress transfer page
    await page.goto("./progress/");
    await expect(page.getByRole("heading", { name: /study progress/i })).toBeVisible();

    // Verify current progress summary displays marks
    await expect(page.getByTestId("current-progress-summary")).toBeVisible();
    await expect(page.getByTestId("current-progress-summary")).toContainText("3-weeks");

    // Monitor network requests to assert none leave origin
    const origin = new URL(page.url()).origin;
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      const reqUrl = request.url();
      if (!reqUrl.startsWith(origin) && !reqUrl.startsWith("data:") && !reqUrl.startsWith("blob:")) {
        externalRequests.push(reqUrl);
      }
    });

    // Trigger export and catch download event
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-button").click();
    const download = await downloadPromise;

    // Assert filename matches ccdv-f-progress-YYYY-MM-DD.json
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/^ccdv-f-progress-\d{4}-\d{2}-\d{2}\.json$/);

    // Read exported content
    const readable = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const fileContent = Buffer.concat(chunks).toString("utf-8");

    // Assert envelope structure and pretty-printed format
    expect(fileContent).toContain("\n");
    const parsed = JSON.parse(fileContent);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.namespaces?.foundation?.planMarks?.["3-weeks"]).toEqual([2, 5]);
    expect(typeof parsed.updatedAt).toBe("string");

    // Assert no external network requests were made
    expect(externalRequests).toEqual([]);
  });

  test("round trip: export, clear all site data, and re-import restores exact state (SC-005)", async ({
    page
  }) => {
    // Setup progress with marks in 3-weeks and 1-week
    await page.goto("./plans/3-weeks/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.getByTestId("mark-domain-2").check();
    await page.getByTestId("mark-domain-5").check();

    await page.goto("./plans/1-week/");
    await page.getByTestId("mark-domain-1").check();

    // Export progress
    await page.goto("./progress/");
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("export-button").click();
    const download = await downloadPromise;

    const readable = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const exportedJson = Buffer.concat(chunks).toString("utf-8");

    // Fully clear site data
    await page.evaluate(() => localStorage.clear());

    // Verify progress is gone on plan pages
    await page.goto("./plans/3-weeks/");
    await expect(page.getByTestId("mark-domain-2")).not.toBeChecked();
    await expect(page.getByTestId("mark-domain-5")).not.toBeChecked();
    await expect(page.getByTestId("plan-completion-summary")).toContainText("0 of 8 domains");

    // Re-import via progress page
    await page.goto("./progress/");
    await expect(page.getByTestId("current-progress-summary")).toContainText(/no recorded plan marks|no plan marks/i);

    // Track network requests during import
    const origin = new URL(page.url()).origin;
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      const reqUrl = request.url();
      if (!reqUrl.startsWith(origin) && !reqUrl.startsWith("data:") && !reqUrl.startsWith("blob:")) {
        externalRequests.push(reqUrl);
      }
    });

    // Upload the exported JSON file
    await page.getByTestId("import-input").setInputFiles({
      name: "ccdv-f-progress-2026-09-05.json",
      mimeType: "application/json",
      buffer: Buffer.from(exportedJson, "utf-8")
    });

    // Confirmation dialog should open and show what will be replaced
    await expect(page.getByTestId("import-confirm-dialog")).toBeVisible();
    await expect(page.getByTestId("replacement-summary")).toBeVisible();
    await expect(page.getByTestId("replacement-summary")).toContainText("3-weeks");
    await expect(page.getByTestId("replacement-summary")).toContainText("1-week");

    // Confirm replacement
    await page.getByTestId("confirm-replace-button").click();
    await expect(page.getByTestId("import-confirm-dialog")).toBeHidden();
    await expect(page.getByTestId("import-success")).toBeVisible();

    // Verify state matches what it was before clearing
    await page.goto("./plans/3-weeks/");
    await expect(page.getByTestId("mark-domain-2")).toBeChecked();
    await expect(page.getByTestId("mark-domain-5")).toBeChecked();
    await expect(page.getByTestId("plan-completion-summary")).toContainText("2 of 8 domains");

    await page.goto("./plans/1-week/");
    await expect(page.getByTestId("mark-domain-1")).toBeChecked();
    await expect(page.getByTestId("plan-completion-summary")).toContainText("1 of 8 domains");

    // Assert no network requests left the origin during import
    expect(externalRequests).toEqual([]);
  });

  test("importing into a second browser context restores progress exactly", async ({
    browser
  }) => {
    // Browser Context A: mark progress and export
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();

    await pageA.goto("./plans/3-weeks/");
    await pageA.evaluate(() => localStorage.clear());
    await pageA.reload();

    await pageA.getByTestId("mark-domain-2").check();
    await pageA.getByTestId("mark-domain-7").check();

    await pageA.goto("./progress/");
    const downloadPromise = pageA.waitForEvent("download");
    await pageA.getByTestId("export-button").click();
    const download = await downloadPromise;

    const readable = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const exportedJson = Buffer.concat(chunks).toString("utf-8");
    await contextA.close();

    // Browser Context B: clean browser context with no stored state
    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();

    await pageB.goto("./progress/");
    await expect(pageB.getByTestId("current-progress-summary")).toContainText(/no recorded plan marks|no plan marks/i);

    // Import the exported file
    await pageB.getByTestId("import-input").setInputFiles({
      name: "ccdv-f-progress-2026-09-05.json",
      mimeType: "application/json",
      buffer: Buffer.from(exportedJson, "utf-8")
    });

    await expect(pageB.getByTestId("import-confirm-dialog")).toBeVisible();
    await pageB.getByTestId("confirm-replace-button").click();
    await expect(pageB.getByTestId("import-confirm-dialog")).toBeHidden();
    await expect(pageB.getByTestId("import-success")).toBeVisible();

    // Verify marks in context B
    await pageB.goto("./plans/3-weeks/");
    await expect(pageB.getByTestId("mark-domain-2")).toBeChecked();
    await expect(pageB.getByTestId("mark-domain-7")).toBeChecked();
    await expect(pageB.getByTestId("plan-completion-summary")).toContainText("2 of 8 domains");

    await contextB.close();
  });
});
