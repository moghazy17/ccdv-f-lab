import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];

const guidePages = [
  {
    heading: "Eligibility, registration, and retakes",
    name: "eligibility and registration page",
    route: "./guide/eligibility/"
  },
  {
    heading: "Exam day",
    name: "exam-day page",
    route: "./guide/exam-day/"
  },
  {
    heading: "Course-to-blueprint cross-map",
    name: "course cross-map page",
    route: "./guide/course-crossmap/"
  }
];

for (const guidePage of guidePages) {
  test(`${guidePage.name} has no axe accessibility violations`, async ({ page }) => {
    await page.goto(guidePage.route);

    await expect(page.getByRole("heading", { level: 1, name: guidePage.heading })).toBeVisible();
    const axePage = page as unknown as AxePage;
    const results = await new AxeBuilder({ page: axePage }).analyze();
    expect(results.violations).toEqual([]);
  });
}

test.describe("US4 - Guide pages keyboard navigation", () => {
  test("keyboard user can focus skip link and navigate guide sections", async ({ page }) => {
    await page.goto("./guide/eligibility/");

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();

    // Tab through to the guide navigation links
    await page.keyboard.press("Tab"); // Site name
    await page.keyboard.press("Tab"); // Blueprint
    await page.keyboard.press("Tab"); // Domains
    await page.keyboard.press("Tab"); // Plans
    await page.keyboard.press("Tab"); // Diagnostic
    await page.keyboard.press("Tab"); // Labs
    await page.keyboard.press("Tab"); // Mock
    await page.keyboard.press("Tab"); // Flashcards
    await page.keyboard.press("Tab"); // Playground
    await page.keyboard.press("Tab"); // Theme select
    await page.keyboard.press("Tab"); // Home breadcrumb
    await page.keyboard.press("Tab"); // First non-current guide nav link ("Exam day")

    const examDayLink = page.getByRole("link", { name: "Exam day" });
    await expect(examDayLink).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/ccdv-f-lab\/guide\/exam-day\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "Exam day" })).toBeVisible();
  });

  test("tables on guide pages are keyboard-accessible for scrolling", async ({ page }) => {
    await page.goto("./guide/course-crossmap/");

    // Check that table scroll containers exist and have tabindex="0"
    const tableScrollContainers = page.locator(".table-scroll");
    const count = await tableScrollContainers.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const container = tableScrollContainers.nth(i);
      await expect(container).toHaveAttribute("tabindex", "0");
      await expect(container).toHaveAttribute("aria-label");
    }
  });
});
