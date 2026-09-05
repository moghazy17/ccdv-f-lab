import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];

interface PageTypeCheck {
  name: string;
  route: string;
  type: "content" | "scaffold" | "diagnostic" | "progress" | "search" | "index" | "reserved";
}

const pageTypesToCheck: PageTypeCheck[] = [
  // Index pages
  { name: "landing page", route: "./", type: "index" },
  { name: "blueprint explorer", route: "./blueprint/", type: "index" },
  { name: "domain index", route: "./domains/", type: "index" },
  { name: "plan index", route: "./plans/", type: "index" },
  { name: "cheatsheet index", route: "./cheatsheets/", type: "index" },
  { name: "labs index", route: "./labs/", type: "index" },

  // Content pages
  { name: "guide eligibility", route: "./guide/eligibility/", type: "content" },
  { name: "guide exam-day", route: "./guide/exam-day/", type: "content" },
  { name: "guide course-crossmap", route: "./guide/course-crossmap/", type: "content" },

  // Scaffold pages
  { name: "scaffold domain module", route: "./domains/02-applications-and-integration/", type: "scaffold" },
  { name: "scaffold cheatsheet", route: "./cheatsheets/02-applications-and-integration/", type: "scaffold" },

  // Plan detail
  { name: "plan detail (3-weeks)", route: "./plans/3-weeks/", type: "content" },

  // Diagnostic
  { name: "diagnostic page", route: "./diagnostic/", type: "diagnostic" },

  // Progress
  { name: "progress page", route: "./progress/", type: "progress" },

  // Reserved page types
  { name: "reserved mock exam", route: "./mock/", type: "reserved" },
  { name: "reserved mock report", route: "./mock/report/", type: "reserved" },
  { name: "reserved flashcards", route: "./flashcards/", type: "reserved" },
  { name: "reserved domain quiz", route: "./domains/01-agents-and-workflows/quiz/", type: "reserved" },
  { name: "reserved terminal", route: "./claude-code/terminal/", type: "reserved" },
  { name: "reserved config builder", route: "./claude-code/config/", type: "reserved" },
  { name: "reserved playground", route: "./playground/", type: "reserved" }
];

test.describe("Cross-cutting accessibility sweep (SC-006, FR-041)", () => {
  for (const pageCheck of pageTypesToCheck) {
    test(`${pageCheck.type}: ${pageCheck.name} has no critical or serious axe violations`, async ({
      page
    }) => {
      await page.goto(pageCheck.route);
      const axePage = page as unknown as AxePage;
      const results = await new AxeBuilder({ page: axePage }).analyze();

      const criticalOrSerious = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      );
      expect(
        criticalOrSerious,
        `Page ${pageCheck.route} has critical or serious accessibility violations`
      ).toEqual([]);
    });
  }

  test("search overlay dialog has no critical or serious axe violations", async ({ page }) => {
    await page.goto("./");
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Search study kit" });
    await expect(dialog).toBeVisible();

    const axePage = page as unknown as AxePage;
    const results = await new AxeBuilder({ page: axePage }).analyze();
    const criticalOrSerious = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(criticalOrSerious).toEqual([]);
  });
});
