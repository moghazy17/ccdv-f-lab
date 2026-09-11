import { expect, test } from "@playwright/test";

// Feature 002 filled the lab, mock, domain-quiz, and flashcard addresses, so they are asserted as
// live pages below rather than as inert fixtures. The remaining three are still reserved.
const reservedAddressPatterns = [
  { pattern: "/claude-code/terminal/", route: "./claude-code/terminal/", label: "Terminal simulator" },
  { pattern: "/claude-code/config/", route: "./claude-code/config/", label: "Settings builder" },
  { pattern: "/playground/", route: "./playground/", label: "Playground" }
];

const establishedRoutes = [
  { name: "Landing", route: "./" },
  { name: "Blueprint", route: "./blueprint/" },
  { name: "Domain index", route: "./domains/" },
  { name: "Domain detail", route: "./domains/02-applications-and-integration/" },
  { name: "Plans index", route: "./plans/" },
  { name: "Plan detail", route: "./plans/3-weeks/" },
  { name: "Cheatsheet index", route: "./cheatsheets/" },
  { name: "Cheatsheet detail", route: "./cheatsheets/02-applications-and-integration/" },
  { name: "Diagnostic", route: "./diagnostic/" },
  { name: "Progress", route: "./progress/" }
];

test.describe("Reserved extension safety and route stability (SC-010, FR-020, FR-021)", () => {
  test("the addresses feature 001 reserved now resolve as real pages at the same paths", async ({
    page
  }) => {
    const indexResponse = await page.goto("./labs/");
    expect(indexResponse?.status()).toBe(200);
    await expect(page).toHaveURL(/\/ccdv-f-lab\/labs\/$/);
    await expect(page.getByTestId("labs-catalogue")).toBeVisible();

    const moduleResponse = await page.goto("./labs/batch/");
    expect(moduleResponse?.status()).toBe(200);
    await expect(page).toHaveURL(/\/ccdv-f-lab\/labs\/batch\/$/);
    await expect(page.getByTestId("lab-concept")).toBeVisible();

    const mockResponse = await page.goto("./mock/");
    expect(mockResponse?.status()).toBe(200);
    await expect(page).toHaveURL(/\/ccdv-f-lab\/mock\/$/);
    await expect(page.getByTestId("mock-facts")).toBeVisible();

    const reportResponse = await page.goto("./mock/report/");
    expect(reportResponse?.status()).toBe(200);
    await expect(page).toHaveURL(/\/ccdv-f-lab\/mock\/report\/$/);
    await expect(page.getByTestId("score-report-empty")).toBeVisible();

    const quizResponse = await page.goto("./domains/01-agents-and-workflows/quiz/");
    expect(quizResponse?.status()).toBe(200);
    await expect(page).toHaveURL(/\/ccdv-f-lab\/domains\/01-agents-and-workflows\/quiz\/$/);
    await expect(page.getByRole("heading", { name: "Scored quiz" })).toBeVisible();

    const flashcardsResponse = await page.goto("./flashcards/");
    expect(flashcardsResponse?.status()).toBe(200);
    await expect(page).toHaveURL(/\/ccdv-f-lab\/flashcards\/$/);
    await expect(page.getByRole("heading", { name: "Review the deck" })).toBeVisible();
  });

  test("the remaining reserved address patterns resolve at their contracted paths as inert fixtures", async ({
    page
  }) => {
    for (const item of reservedAddressPatterns) {
      const response = await page.goto(item.route);
      expect(response?.status()).toBe(200);

      // Verify URL conforms to configured base and trailing slash
      await expect(page).toHaveURL(/\/ccdv-f-lab\/.+\/$/);

      // Verify inert placeholder content
      const reservedPage = page.locator(".reserved-page");
      await expect(reservedPage).toBeVisible();
      await expect(page.getByText(/contains no interactive capability|arrives in a later feature/i)).toBeVisible();

      // Verify no interactive form controls or runtime scripts
      await expect(page.locator("form, button.action-button, input:not([type='hidden'])")).toHaveCount(0);
    }
  });

  test("domain layout contains both reserved regions (lab and practice) without shifting existing content", async ({
    page
  }) => {
    await page.goto("./domains/02-applications-and-integration/");

    const labRegion = page.getByTestId("domain-lab-region");
    const practiceRegion = page.getByTestId("domain-practice-region");

    await expect(labRegion).toBeVisible();
    await expect(labRegion.getByRole("heading", { name: /reference application/i })).toBeVisible();

    await expect(practiceRegion).toBeVisible();
    await expect(practiceRegion.getByRole("heading", { name: /practice/i })).toBeVisible();
    await expect(practiceRegion).toContainText("Only the scored quiz feeds a readiness signal");
  });

  test("all established navigation targets and addresses remain unchanged", async ({ page }) => {
    await page.goto("./");

    // Check header navigation links have exact contracted targets
    const nav = page.locator(".site-nav");
    await expect(nav.getByRole("link", { name: "Blueprint" })).toHaveAttribute("href", "/ccdv-f-lab/blueprint/");
    await expect(nav.getByRole("link", { name: "Domains" })).toHaveAttribute("href", "/ccdv-f-lab/domains/");
    await expect(nav.getByRole("link", { name: "Plans" })).toHaveAttribute("href", "/ccdv-f-lab/plans/");
    await expect(nav.getByRole("link", { name: "Diagnostic" })).toHaveAttribute("href", "/ccdv-f-lab/diagnostic/");
    await expect(nav.getByRole("link", { name: "Labs" })).toHaveAttribute("href", "/ccdv-f-lab/labs/");
    await expect(nav.getByRole("link", { name: "Mock exam" })).toHaveAttribute("href", "/ccdv-f-lab/mock/");
    await expect(nav.getByRole("link", { name: "Flashcards" })).toHaveAttribute("href", "/ccdv-f-lab/flashcards/");
    await expect(nav.getByRole("link", { name: "Playground" })).toHaveAttribute("href", "/ccdv-f-lab/playground/");

    // Check all established pages continue to resolve stably
    for (const est of establishedRoutes) {
      const resp = await page.goto(est.route);
      expect(resp?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });
});
