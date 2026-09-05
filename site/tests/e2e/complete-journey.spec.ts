import { expect, test } from "@playwright/test";

test("complete account-free keyboard journey across orientation, plans, cheatsheet, export and restore (SC-005, FR-035)", async ({
  browser
}) => {
  // Context A: First browser context
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();

  const originA = "http://127.0.0.1:4321";
  const externalRequests: string[] = [];
  pageA.on("request", (req) => {
    const url = req.url();
    if (!url.startsWith(originA) && !url.startsWith("data:") && !url.startsWith("blob:")) {
      externalRequests.push(url);
    }
  });

  // 1. Orient on landing page without account or key
  await pageA.goto("./");
  await pageA.evaluate(() => localStorage.clear());
  await pageA.reload();

  // Verify no credentials, account prompt, or API key requests
  await expect(pageA.locator("input[type='password']")).toHaveCount(0);
  await expect(pageA.getByText(/sign in|log in|api key/i)).toHaveCount(0);
  await expect(pageA.getByTestId("exam-facts")).toBeVisible();

  // Keyboard navigation to Plans
  await pageA.keyboard.press("Tab"); // skip link
  await pageA.keyboard.press("Tab"); // site title
  await pageA.keyboard.press("Tab"); // blueprint link
  await pageA.keyboard.press("Tab"); // domains link
  await pageA.keyboard.press("Tab"); // plans link
  await expect(pageA.getByRole("link", { name: "Plans" })).toBeFocused();
  await pageA.keyboard.press("Enter");

  await expect(pageA).toHaveURL(/\/ccdv-f-lab\/plans\/$/);
  await expect(pageA.getByRole("heading", { level: 1, name: "Study plans" })).toBeVisible();

  // Navigate to 3-weeks plan
  await pageA.goto("./plans/3-weeks/");
  await expect(pageA.getByRole("heading", { level: 1 })).toContainText("Three-week study plan");

  // 2. Mark progress using keyboard
  const checkbox2 = pageA.getByTestId("mark-domain-2");
  await checkbox2.focus();
  await expect(checkbox2).toBeFocused();
  await pageA.keyboard.press("Space");
  await expect(checkbox2).toBeChecked();

  const checkbox5 = pageA.getByTestId("mark-domain-5");
  await checkbox5.focus();
  await expect(checkbox5).toBeFocused();
  await pageA.keyboard.press("Space");
  await expect(checkbox5).toBeChecked();

  // 3. View printable cheatsheet
  await pageA.goto("./cheatsheets/02-applications-and-integration/");
  await expect(pageA.locator(".print-button")).toBeVisible();
  await expect(pageA.locator(".cheatsheet-content")).toBeVisible();

  // 4. Export progress via keyboard
  await pageA.goto("./progress/");
  await expect(pageA.getByTestId("current-progress-summary")).toContainText("3-weeks");

  const exportButton = pageA.getByTestId("export-button");
  await exportButton.focus();
  await expect(exportButton).toBeFocused();

  const downloadPromise = pageA.waitForEvent("download");
  await pageA.keyboard.press("Enter");
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^ccdv-f-progress-\d{4}-\d{2}-\d{2}\.json$/);

  const readable = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of readable) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const exportedJson = Buffer.concat(chunks).toString("utf-8");
  const parsed = JSON.parse(exportedJson);
  expect(parsed.schemaVersion).toBe(1);
  expect(parsed.namespaces?.foundation?.planMarks?.["3-weeks"]).toEqual([2, 5]);

  // Ensure no third-party network requests occurred in Context A
  expect(externalRequests).toEqual([]);
  await contextA.close();

  // 5. Restore into second browser context B
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();

  await pageB.goto("./progress/");
  await expect(pageB.getByTestId("current-progress-summary")).toContainText(/no recorded plan marks|no plan marks/i);

  // Import file
  await pageB.getByTestId("import-input").setInputFiles({
    name: "ccdv-f-progress.json",
    mimeType: "application/json",
    buffer: Buffer.from(exportedJson, "utf-8")
  });

  await expect(pageB.getByTestId("import-confirm-dialog")).toBeVisible();
  const confirmButton = pageB.getByTestId("confirm-replace-button");
  await confirmButton.focus();
  await expect(confirmButton).toBeFocused();
  await pageB.keyboard.press("Enter");

  await expect(pageB.getByTestId("import-confirm-dialog")).toBeHidden();
  await expect(pageB.getByTestId("import-success")).toBeVisible();

  // Verify marks restored in second browser
  await pageB.goto("./plans/3-weeks/");
  await expect(pageB.getByTestId("mark-domain-2")).toBeChecked();
  await expect(pageB.getByTestId("mark-domain-5")).toBeChecked();
  await expect(pageB.getByTestId("plan-completion-summary")).toContainText("2 of 8 domains");

  await contextB.close();
});
