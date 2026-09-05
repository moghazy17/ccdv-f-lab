import { expect, test } from "@playwright/test";

test.describe("User Story 6: Search runtime, lazy loading, metadata, and origin", () => {
  test("Pagefind assets are loaded on demand and never on first paint", async ({ page }) => {
    const pagefindRequests: string[] = [];

    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("pagefind")) {
        pagefindRequests.push(url);
      }
    });

    // Navigate to page
    await page.goto("./");
    await page.waitForLoadState("networkidle");

    // Critical: No Pagefind assets requested on first paint
    expect(pagefindRequests).toHaveLength(0);

    // Now open search dialog
    await page.keyboard.press("Control+k");
    const searchDialog = page.getByTestId("search-dialog");
    await expect(searchDialog).toBeVisible();

    const searchInput = page.getByTestId("search-input");
    await searchInput.fill("blueprint");

    // After opening/searching, Pagefind assets should be requested on demand
    await page.waitForResponse((response) => response.url().includes("pagefind"));
    expect(pagefindRequests.length).toBeGreaterThan(0);
  });

  test("all search requests stay strictly within the origin", async ({ page }) => {
    const externalRequests: string[] = [];

    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
        externalRequests.push(request.url());
      }
    });

    await page.goto("./");
    await page.keyboard.press("Control+k");
    const searchInput = page.getByTestId("search-input");
    await searchInput.fill("adaptive thinking");

    const results = page.getByTestId("search-results");
    await expect(results).toBeVisible();

    // Verify no third-party network request was made
    expect(externalRequests).toHaveLength(0);
  });

  test("scaffold pages are indexed and labelled with status metadata", async ({ page }) => {
    await page.goto("./");

    await page.keyboard.press("Control+k");
    const searchInput = page.getByTestId("search-input");
    await searchInput.fill("context drift");

    const results = page.getByTestId("search-results").locator(".search-result-link");
    await expect(results.first()).toBeVisible();

    // Look for the result matching Prompt and Context Engineering
    const resultItem = results.filter({ hasText: /Prompt and Context Engineering/i });
    await expect(resultItem).toBeVisible();

    // The status metadata should be visible and indicate scaffold / unwritten
    const statusBadge = resultItem.locator(".search-result-status");
    await expect(statusBadge).toBeVisible();
    await expect(statusBadge).toHaveText(/scaffold/i);
  });

  test("Unicode and typographic characters are handled without double-encoding", async ({ page }) => {
    await page.goto("./");

    await page.keyboard.press("Control+k");
    const searchInput = page.getByTestId("search-input");

    // Search with typographic en-dash
    await searchInput.fill("Developer – Foundations");

    const results = page.getByTestId("search-results").locator(".search-result-link");
    await expect(results.first()).toBeVisible();

    const resultText = await results.first().textContent();
    expect(resultText).not.toContain("â€“"); // No cp1252 double-encoding
    expect(resultText).not.toContain("&ndash;");
  });
});
