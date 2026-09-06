import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];

test.describe("US7 - Import safety, refusal, replacement disclosure, and accessibility", () => {
  test("malformed non-JSON file is refused with plain message and leaves stored progress untouched", async ({
    page
  }) => {
    // Setup stored progress
    await page.goto("./plans/3-weeks/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByTestId("mark-domain-3").check();

    await page.goto("./progress/");

    // Upload non-JSON file
    await page.getByTestId("import-input").setInputFiles({
      name: "invalid.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("THIS IS NOT JSON", "utf-8")
    });

    // Error message displayed
    await expect(page.getByTestId("import-error")).toBeVisible();
    await expect(page.getByTestId("import-error")).toContainText(/not valid JSON|invalid JSON/i);

    // Confirmation dialog never opened
    await expect(page.getByTestId("import-confirm-dialog")).toBeHidden();

    // Verify stored progress is untouched
    await page.goto("./plans/3-weeks/");
    await expect(page.getByTestId("mark-domain-3")).toBeChecked();
  });

  test("malformed JSON structure is refused with plain message and leaves stored progress untouched", async ({
    page
  }) => {
    await page.goto("./plans/3-weeks/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByTestId("mark-domain-4").check();

    await page.goto("./progress/");

    // Upload JSON missing envelope namespaces
    await page.getByTestId("import-input").setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ notAnEnvelope: true }), "utf-8")
    });

    await expect(page.getByTestId("import-error")).toBeVisible();
    await expect(page.getByTestId("import-error")).toContainText(/invalid|malformed|missing/i);
    await expect(page.getByTestId("import-confirm-dialog")).toBeHidden();

    // Stored progress untouched
    await page.goto("./plans/3-weeks/");
    await expect(page.getByTestId("mark-domain-4")).toBeChecked();
  });

  test("newer schemaVersion is refused with explanation and leaves stored progress untouched", async ({
    page
  }) => {
    await page.goto("./plans/3-weeks/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByTestId("mark-domain-5").check();

    await page.goto("./progress/");

    // Upload envelope with future schemaVersion: 99
    const futureEnvelope = {
      schemaVersion: 99,
      updatedAt: "2027-01-01T00:00:00.000Z",
      namespaces: {
        foundation: {
          theme: "system",
          planMarks: { "3-weeks": [1, 2, 3] },
          diagnostic: null
        }
      }
    };

    await page.getByTestId("import-input").setInputFiles({
      name: "future.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(futureEnvelope), "utf-8")
    });

    await expect(page.getByTestId("import-error")).toBeVisible();
    await expect(page.getByTestId("import-error")).toContainText(/newer version/i);
    await expect(page.getByTestId("import-confirm-dialog")).toBeHidden();

    // Stored progress untouched
    await page.goto("./plans/3-weeks/");
    await expect(page.getByTestId("mark-domain-5")).toBeChecked();
  });

  test("shows what will be replaced before replacing and cancelling leaves progress untouched", async ({
    page
  }) => {
    // Current state has domain 2 in 3-weeks plan
    await page.goto("./plans/3-weeks/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByTestId("mark-domain-2").check();

    await page.goto("./progress/");

    // Incoming file has domain 6 in 1-week plan
    const incomingEnvelope = {
      schemaVersion: 1,
      updatedAt: "2026-09-05T15:30:00.000Z",
      namespaces: {
        foundation: {
          theme: "system",
          planMarks: { "1-week": [6] },
          diagnostic: null
        }
      }
    };

    await page.getByTestId("import-input").setInputFiles({
      name: "candidate.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(incomingEnvelope), "utf-8")
    });

    // Confirmation dialog opens with disclosure of both records
    await expect(page.getByTestId("import-confirm-dialog")).toBeVisible();
    const summary = page.getByTestId("replacement-summary");
    await expect(summary).toBeVisible();
    // Mentions current record and incoming record
    await expect(summary).toContainText("3-weeks");
    await expect(summary).toContainText("1-week");

    // Cancel import
    await page.getByTestId("cancel-import-button").click();
    await expect(page.getByTestId("import-confirm-dialog")).toBeHidden();

    // Verify existing progress is completely untouched
    await page.goto("./plans/3-weeks/");
    await expect(page.getByTestId("mark-domain-2")).toBeChecked();
    await page.goto("./plans/1-week/");
    await expect(page.getByTestId("mark-domain-6")).not.toBeChecked();
  });

  test("renders imported hostile values as text without executing them", async ({ page }) => {
    const payload = '<img src=x onerror="window.importPayloadExecuted=true">';
    const incomingEnvelope = {
      schemaVersion: 1,
      updatedAt: payload,
      namespaces: {
        foundation: {
          theme: "system",
          planMarks: { [payload]: [1] },
          diagnostic: null
        }
      }
    };

    await page.goto("./progress/");
    await page.evaluate(() => {
      (window as Window & { importPayloadExecuted?: boolean }).importPayloadExecuted = false;
    });
    await page.getByTestId("import-input").setInputFiles({
      name: "hostile.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(incomingEnvelope), "utf-8")
    });

    const dialog = page.getByTestId("import-confirm-dialog");
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("replacement-summary")).toContainText(payload);
    expect(
      await page.evaluate(
        () => (window as Window & { importPayloadExecuted?: boolean }).importPayloadExecuted
      )
    ).toBe(false);

    await page.getByTestId("confirm-replace-button").click();
    await expect(page.getByTestId("current-progress-summary")).toContainText(payload);
    expect(
      await page.evaluate(
        () => (window as Window & { importPayloadExecuted?: boolean }).importPayloadExecuted
      )
    ).toBe(false);
  });

  test("ignores imported plan marks for domains outside the selected plan", async ({ page }) => {
    const incomingEnvelope = {
      schemaVersion: 1,
      updatedAt: "2026-09-05T12:00:00.000Z",
      namespaces: {
        foundation: {
          theme: "system",
          planMarks: { "3-weeks": [99] },
          diagnostic: null
        }
      }
    };

    await page.goto("./progress/");
    await page.getByTestId("import-input").setInputFiles({
      name: "unknown-domain.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(incomingEnvelope), "utf-8")
    });
    await expect(page.getByTestId("import-confirm-dialog")).toBeVisible();
    await page.getByTestId("confirm-replace-button").click();

    await page.goto("./plans/3-weeks/");
    await expect(page.getByTestId("plan-completion-summary")).toContainText("0 of 8 domains (0%)");
    await expect(page.getByTestId("mark-domain-1")).not.toBeChecked();
  });

  test("confirmation dialog satisfies modal accessibility (focus trap, Escape dismissal, return focus)", async ({
    page
  }) => {
    await page.goto("./progress/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const incomingEnvelope = {
      schemaVersion: 1,
      updatedAt: "2026-09-05T12:00:00.000Z",
      namespaces: {
        foundation: {
          theme: "system",
          planMarks: { "3-weeks": [1] },
          diagnostic: null
        }
      }
    };

    // Trigger import dialog
    const importButton = page.getByTestId("import-button");
    await importButton.focus();
    await page.getByTestId("import-input").setInputFiles({
      name: "valid.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(incomingEnvelope), "utf-8")
    });

    const dialog = page.getByTestId("import-confirm-dialog");
    await expect(dialog).toBeVisible();

    // Focus moved into dialog
    const cancelButton = page.getByTestId("cancel-import-button");
    const replaceButton = page.getByTestId("confirm-replace-button");
    await expect(cancelButton).toBeFocused();

    // Tab key wraps inside modal
    await page.keyboard.press("Tab");
    await expect(replaceButton).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(cancelButton).toBeFocused();

    // Escape closes dialog and restores focus to trigger
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(importButton).toBeFocused();
  });

  test("displays browser-only loss warning when recorded progress exists (FR-029)", async ({
    page
  }) => {
    // Clean state - no recorded progress
    await page.goto("./progress/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Now record progress
    await page.goto("./plans/3-weeks/");
    await page.getByTestId("mark-domain-1").check();

    // Revisit progress page
    await page.goto("./progress/");
    const warning = page.getByTestId("browser-only-warning");
    await expect(warning).toBeVisible();
    await expect(warning).toContainText(/browser/i);
    await expect(warning).toContainText(/lost/i);
  });

  test("progress page and open confirmation dialog have no axe violations", async ({ page }) => {
    await page.goto("./progress/");
    const axePage = page as unknown as AxePage;

    // Normal state
    let results = await new AxeBuilder({ page: axePage }).analyze();
    expect(results.violations).toEqual([]);

    // Open confirmation dialog
    const testEnvelope = {
      schemaVersion: 1,
      updatedAt: "2026-09-05T12:00:00.000Z",
      namespaces: {
        foundation: {
          theme: "system",
          planMarks: { "3-weeks": [1, 2] },
          diagnostic: null
        }
      }
    };

    await page.getByTestId("import-input").setInputFiles({
      name: "axe-test.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(testEnvelope), "utf-8")
    });

    await expect(page.getByTestId("import-confirm-dialog")).toBeVisible();

    // Modal state
    results = await new AxeBuilder({ page: axePage }).analyze();
    expect(results.violations).toEqual([]);
  });
});
