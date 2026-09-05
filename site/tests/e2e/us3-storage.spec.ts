import { expect, test } from "@playwright/test";

test.describe("US3 - Storage resilience and cross-tab reconciliation", () => {
  test("degrades gracefully when localStorage is unavailable", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get: () => {
          throw new DOMException("Access denied by security policy", "SecurityError");
        }
      });
    });

    await page.goto("./plans/3-weeks/");

    // Page content remains completely readable
    await expect(page.getByTestId("plan-total-hours")).toContainText("42");
    await expect(page.getByTestId("plan-allocation-row")).toHaveCount(8);

    // Stated message that progress cannot be saved
    await expect(page.getByTestId("storage-error")).toBeVisible();
    await expect(page.getByTestId("storage-error")).toContainText(/cannot be saved|storage unavailable/i);
  });

  test("handles quota exceeded without crashing or corrupting data", async ({ page }) => {
    await page.goto("./plans/3-weeks/");
    await page.evaluate(() => localStorage.clear());

    // Mark domain 2 first successfully
    await page.getByTestId("mark-domain-2").check();
    await expect(page.getByTestId("mark-domain-2")).toBeChecked();

    // Now simulate quota exceeded on subsequent writes
    await page.evaluate(() => {
      const origSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) {
        if (key === "ccdv-f:progress") {
          throw new DOMException("Quota exceeded", "QuotaExceededError");
        }
        return origSet.call(this, key, value);
      };
    });

    // Attempt to mark domain 5
    await page.getByTestId("mark-domain-5").check();

    // Quota warning or error message is displayed
    await expect(page.getByTestId("storage-error")).toBeVisible();
    await expect(page.getByTestId("storage-error")).toContainText(/quota|storage full|could not be saved/i);
  });

  test("handles storage clearing gracefully on reload", async ({ page }) => {
    await page.goto("./plans/3-weeks/");
    await page.evaluate(() => localStorage.clear());

    await page.getByTestId("mark-domain-2").check();
    await expect(page.getByTestId("plan-completion-summary")).toContainText("1 of 8 domains");

    // Clear storage externally
    await page.evaluate(() => localStorage.clear());

    // Reload
    await page.reload();
    await expect(page.getByTestId("mark-domain-2")).not.toBeChecked();
    await expect(page.getByTestId("plan-completion-summary")).toContainText("0 of 8 domains");
  });

  test("reconciles marks across two tabs without losing either mark", async ({ context }) => {
    const pageA = await context.newPage();
    const pageB = await context.newPage();

    await pageA.goto("./plans/3-weeks/");
    await pageA.evaluate(() => localStorage.clear());
    await pageB.goto("./plans/3-weeks/");

    // Mark Domain 2 in Tab A
    await pageA.getByTestId("mark-domain-2").check();
    await expect(pageA.getByTestId("mark-domain-2")).toBeChecked();

    // Mark Domain 5 in Tab B
    await pageB.getByTestId("mark-domain-5").check();
    await expect(pageB.getByTestId("mark-domain-5")).toBeChecked();

    // Both tabs should reflect both marks through storage reconciliation
    await expect(pageA.getByTestId("mark-domain-5")).toBeChecked();
    await expect(pageB.getByTestId("mark-domain-2")).toBeChecked();

    await expect(pageA.getByTestId("plan-completion-summary")).toContainText("2 of 8 domains");
    await expect(pageB.getByTestId("plan-completion-summary")).toContainText("2 of 8 domains");
  });
});
