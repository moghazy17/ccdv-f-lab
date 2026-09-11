import { expect, test } from "@playwright/test";

test.describe("User Story 6: Format demonstration exclusion from search", () => {
  const uniqueExcludedDrillTerms = [
    "format demonstration",
    "unenforceable-politeness",
    "bigger-model",
    "ticket-creation",
    "ticket creation"
  ];

  for (const term of uniqueExcludedDrillTerms) {
    test(`searching "${term}" never surfaces the excluded drill item`, async ({ page }) => {
      // These terms come from the drill bank. As study notes are authored some of them also stem
      // onto legitimate content, so the requirement is not "no results" — it is that no result is
      // ever the excluded item. Asserting emptiness would fail as soon as a note is written.
      await page.goto("./");

      await page.keyboard.press("Control+k");
      const searchInput = page.getByTestId("search-input");
      await expect(searchInput).toBeFocused();

      await searchInput.fill(term);

      const results = page.getByTestId("search-results").locator(".search-result-link");
      const count = await results.count();

      for (let i = 0; i < count; i++) {
        const item = results.nth(i);
        const text = await item.textContent();
        expect(text).not.toContain("format demonstration");
        expect(text).not.toContain("fixed intake form");
        expect(text).not.toContain("unenforceable-politeness");

        const itemType = await item.getAttribute("data-type");
        if (itemType) {
          expect(itemType).not.toBe("drill");
        }
        expect(await item.getAttribute("href")).not.toContain("/drills/");
      }
    });
  }

  test("searching overlapping terms from drill item never returns format demonstration content", async ({
    page
  }) => {
    await page.goto("./");

    await page.keyboard.press("Control+k");
    const searchInput = page.getByTestId("search-input");
    await expect(searchInput).toBeFocused();

    // "approval" appears in drill stem/options ("manager approval") and also in valid guide/note content
    await searchInput.fill("approval");

    const results = page.getByTestId("search-results").locator(".search-result-link");
    await expect(results.first()).toBeVisible();

    const count = await results.count();
    expect(count).toBeGreaterThan(0);

    // Feature 002 added its own surfaces to the index. Their item text is not indexed — it travels
    // in `data-pagefind-ignore` script payloads — so a practice item still cannot be searched.
    const allowedTypes = new Set([
      "note",
      "guide",
      "plan",
      "cheatsheet",
      "blueprint",
      "lab",
      "mock",
      "quiz",
      "flashcard"
    ]);

    for (let i = 0; i < count; i++) {
      const item = results.nth(i);
      const text = await item.textContent();

      // Format demonstration stem and option text must never leak into results
      expect(text).not.toContain("format demonstration");
      expect(text).not.toContain("fixed intake form");
      expect(text).not.toContain("manager's approval");
      expect(text).not.toContain("unenforceable-politeness");

      // Item must not be a drill record
      const itemType = await item.getAttribute("data-type");
      if (itemType) {
        expect(allowedTypes.has(itemType)).toBe(true);
        expect(itemType).not.toBe("drill");
      }

      // Result URL must not be in /drills/
      const itemHref = await item.getAttribute("href");
      expect(itemHref).not.toContain("/drills/");
    }
  });

  test("indexed search records belong only to valid study types and never format demonstrations", async ({
    page
  }) => {
    await page.goto("./");

    await page.keyboard.press("Control+k");
    const searchInput = page.getByTestId("search-input");
    await expect(searchInput).toBeFocused();

    // Search for another common term
    await searchInput.fill("workflow");

    const results = page.getByTestId("search-results").locator(".search-result-link");
    await expect(results.first()).toBeVisible();

    const count = await results.count();
    expect(count).toBeGreaterThan(0);

    // Feature 002 added its own surfaces to the index. Their item text is not indexed — it travels
    // in `data-pagefind-ignore` script payloads — so a practice item still cannot be searched.
    const allowedTypes = new Set([
      "note",
      "guide",
      "plan",
      "cheatsheet",
      "blueprint",
      "lab",
      "mock",
      "quiz",
      "flashcard"
    ]);

    for (let i = 0; i < count; i++) {
      const item = results.nth(i);
      const text = await item.textContent();
      expect(text).not.toContain("format demonstration");
      expect(text).not.toContain("fixed intake form");
      expect(text).not.toContain("unenforceable-politeness");

      const itemType = await item.getAttribute("data-type");
      if (itemType) {
        expect(allowedTypes.has(itemType)).toBe(true);
      }
    }
  });
});
