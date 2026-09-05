import { expect, test } from "@playwright/test";

const mojibakePatterns = [
  "â€“", // double-encoded en-dash
  "â€”", // double-encoded em-dash
  "Ã—",  // double-encoded multiplication sign
  "â€œ", // double-encoded left double quote
  "â€",  // double-encoded right double quote
  "â€˜", // double-encoded left single quote
  "â€™", // double-encoded right single quote
  "ï»¿"  // UTF-8 BOM artifact
];

test.describe("Unicode and typographic rendering verification (FR-044)", () => {
  test("screen: pages display en-dashes, em-dashes, multiplication signs, and curly quotes without mojibake", async ({
    page
  }) => {
    // 1. Landing page contains en-dash
    await page.goto("./");
    const landingHtml = await page.content();
    for (const pattern of mojibakePatterns) {
      expect(landingHtml).not.toContain(pattern);
    }
    expect(landingHtml).toContain("–"); // en-dash
    await expect(page.getByText(/100–1000 scale/)).toBeVisible();

    // 2. Domain 05 contains em-dash from blueprint sub-skills
    await page.goto("./domains/05-model-selection-and-optimization/");
    const domainHtml = await page.content();
    for (const pattern of mojibakePatterns) {
      expect(domainHtml).not.toContain(pattern);
    }
    expect(domainHtml).toContain("—"); // em-dash

    // 3. Blueprint explorer contains middle dot separator
    await page.goto("./blueprint/");
    const blueprintHtml = await page.content();
    for (const pattern of mojibakePatterns) {
      expect(blueprintHtml).not.toContain(pattern);
    }
    expect(blueprintHtml).toContain("·"); // middle dot

    // 4. Course cross-map contains typographic quote
    await page.goto("./guide/course-crossmap/");
    const crossmapHtml = await page.content();
    for (const pattern of mojibakePatterns) {
      expect(crossmapHtml).not.toContain(pattern);
    }
    expect(crossmapHtml).toContain("’"); // right single quote / apostrophe
  });

  test("search: search results display Unicode typography cleanly without corruption", async ({
    page
  }) => {
    await page.goto("./");
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Search study kit" });
    await expect(dialog).toBeVisible();

    const searchInput = page.getByTestId("search-input");
    await searchInput.fill("Foundations");

    const resultList = page.getByTestId("search-results");
    await expect(resultList).toBeVisible();

    const resultsText = await resultList.innerText();
    for (const pattern of mojibakePatterns) {
      expect(resultsText).not.toContain(pattern);
    }
  });

  test("print: print view preserves UTF-8 characters without double encoding", async ({ page }) => {
    await page.goto("./cheatsheets/02-applications-and-integration/");
    await page.emulateMedia({ media: "print" });

    const articleText = await page.locator(".cheatsheet-content").innerText();
    for (const pattern of mojibakePatterns) {
      expect(articleText).not.toContain(pattern);
    }

    // Verify correct UTF-8 table and content
    expect(articleText.length).toBeGreaterThan(50);
  });
});
