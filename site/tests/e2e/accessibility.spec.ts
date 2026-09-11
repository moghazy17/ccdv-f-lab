import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];

interface PageTypeCheck {
  name: string;
  route: string;
  type: "content" | "scaffold" | "diagnostic" | "progress" | "search" | "index" | "reserved" | "lab" | "mock" | "quiz" | "flashcards";
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
  { name: "reserved terminal", route: "./claude-code/terminal/", type: "reserved" },
  { name: "reserved config builder", route: "./claude-code/config/", type: "reserved" },
  { name: "reserved playground", route: "./playground/", type: "reserved" },

  // Lab page types: one that runs, and the one that shows its source instead
  { name: "runnable lab", route: "./labs/router/", type: "lab" },
  { name: "source-only lab", route: "./labs/mcp-server/", type: "lab" },

  // Mock exam surfaces, before an attempt exists
  { name: "mock exam", route: "./mock/", type: "mock" },
  { name: "empty score report", route: "./mock/report/", type: "mock" },

  // Domain self-check: one domain with authored recall prompts, one with none
  { name: "self-check with prompts", route: "./domains/05-model-selection-and-optimization/quiz/", type: "quiz" },
  { name: "self-check without prompts", route: "./domains/04-eval-testing-and-debugging/quiz/", type: "quiz" },

  // Generated flashcard deck
  { name: "flashcard review", route: "./flashcards/", type: "flashcards" }
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

  test("a lab page that has executed code has no critical or serious axe violations", async ({
    page
  }) => {
    test.slow();
    await page.goto("./labs/router/");
    await page.locator("[data-code-pane-run]").click();
    await expect(page.locator("[data-code-pane-status]")).toContainText("Finished in", {
      timeout: 180_000
    });

    const axePage = page as unknown as AxePage;
    const results = await new AxeBuilder({ page: axePage }).analyze();
    const criticalOrSerious = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );
    expect(
      criticalOrSerious,
      "A lab page with output rendered has critical or serious accessibility violations"
    ).toEqual([]);
  });

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
