import { expect, test } from "@playwright/test";

test.describe("User Story 6: Search keyboard journey", () => {
  test("search opens with Ctrl+K or Cmd+K and lands focus in the input across pages", async ({ page }) => {
    const testPages = ["./", "./blueprint/", "./domains/01-agents-and-workflows/"];

    for (const testPage of testPages) {
      await page.goto(testPage);

      const searchDialog = page.getByTestId("search-dialog");
      await expect(searchDialog).toBeHidden();

      // Trigger search via keyboard shortcut
      await page.keyboard.press("Control+k");
      await expect(searchDialog).toBeVisible();

      const searchInput = page.getByTestId("search-input");
      await expect(searchInput).toBeFocused();

      // Dismiss with Escape
      await page.keyboard.press("Escape");
      await expect(searchDialog).toBeHidden();
    }
  });

  test("candidate can search, navigate results with arrow keys, and open with Enter", async ({ page }) => {
    await page.goto("./");

    // Open search
    await page.keyboard.press("Control+k");
    const searchInput = page.getByTestId("search-input");
    await expect(searchInput).toBeFocused();

    // Type a query that exists across multiple pages
    await searchInput.fill("blueprint");

    const resultsContainer = page.getByTestId("search-results");
    await expect(resultsContainer).toBeVisible();

    const resultLinks = resultsContainer.locator(".search-result-link");
    await expect(resultLinks.first()).toBeVisible();
    const count = await resultLinks.count();
    expect(count).toBeGreaterThan(0);

    // Each result names the page / record type it comes from
    const firstBadge = resultLinks.first().locator(".search-result-badge");
    await expect(firstBadge).toBeVisible();
    const badgeText = await firstBadge.textContent();
    expect(badgeText?.trim().length).toBeGreaterThan(0);

    // Navigate with ArrowDown into results
    await page.keyboard.press("ArrowDown");
    await expect(resultLinks.first()).toBeFocused();

    // If there is a second result, ArrowDown moves to it
    if (count > 1) {
      await page.keyboard.press("ArrowDown");
      await expect(resultLinks.nth(1)).toBeFocused();

      // ArrowUp moves back
      await page.keyboard.press("ArrowUp");
      await expect(resultLinks.first()).toBeFocused();
    }

    // Pressing ArrowUp from first result returns focus to search input
    await page.keyboard.press("ArrowUp");
    await expect(searchInput).toBeFocused();

    // Move back to first result and activate with Enter
    await page.keyboard.press("ArrowDown");
    await expect(resultLinks.first()).toBeFocused();

    const targetHref = await resultLinks.first().getAttribute("href");
    expect(targetHref).toBeTruthy();

    await page.keyboard.press("Enter");
    await expect(page.getByTestId("search-dialog")).toBeHidden();
  });

  test("dismissing search restores focus to the element that triggered it", async ({ page }) => {
    await page.goto("./");

    // Focus a specific link on the page
    const blueprintNavLink = page.getByRole("link", { name: "Blueprint" });
    await blueprintNavLink.focus();
    await expect(blueprintNavLink).toBeFocused();

    // Open search with keyboard shortcut
    await page.keyboard.press("Control+k");
    const searchDialog = page.getByTestId("search-dialog");
    await expect(searchDialog).toBeVisible();

    // Dismiss with Escape
    await page.keyboard.press("Escape");
    await expect(searchDialog).toBeHidden();

    // Focus must be restored to the element that had it
    await expect(blueprintNavLink).toBeFocused();

    // Now test focus restoration when opened via the search trigger button
    const searchTrigger = page.getByTestId("search-trigger");
    await searchTrigger.focus();
    await page.keyboard.press("Enter");
    await expect(searchDialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(searchDialog).toBeHidden();
    await expect(searchTrigger).toBeFocused();
  });

  test("header search trigger opens the dialog", async ({ page }) => {
    await page.goto("./");

    await page.getByTestId("search-trigger-header").click();

    await expect(page.getByTestId("search-dialog")).toBeVisible();
    await expect(page.getByTestId("search-input")).toBeFocused();
  });

  test("a query with no matches plainly displays an empty message", async ({ page }) => {
    await page.goto("./");

    await page.keyboard.press("Control+k");
    const searchInput = page.getByTestId("search-input");
    await expect(searchInput).toBeFocused();

    await searchInput.fill("xyzzy-unmatched-term-12345");

    const emptyMessage = page.getByTestId("search-empty");
    await expect(emptyMessage).toBeVisible();
    await expect(emptyMessage).toContainText("No matching material found");

    const resultsContainer = page.getByTestId("search-results");
    await expect(resultsContainer.locator(".search-result-link")).toHaveCount(0);
  });

  test("entire search journey is operable without a mouse pointer", async ({ page }) => {
    await page.goto("./");

    // Tab through page navigation until search trigger
    await page.keyboard.press("Tab"); // Skip link
    await page.keyboard.press("Tab"); // Site name
    await page.keyboard.press("Tab"); // Blueprint link

    // Open via shortcut
    await page.keyboard.press("Control+k");
    const searchDialog = page.getByTestId("search-dialog");
    await expect(searchDialog).toBeVisible();

    const searchInput = page.getByTestId("search-input");
    await expect(searchInput).toBeFocused();

    // Search for a specific concept
    await page.keyboard.type("study plan");

    const resultsContainer = page.getByTestId("search-results");
    const firstResult = resultsContainer.locator(".search-result-link").first();
    await expect(firstResult).toBeVisible();

    // Move to result and open it with Enter
    await page.keyboard.press("ArrowDown");
    await expect(firstResult).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(searchDialog).toBeHidden();
  });
});
