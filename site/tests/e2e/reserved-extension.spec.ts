import { expect, test } from "@playwright/test";

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

    const terminalResponse = await page.goto("./claude-code/terminal/");
    expect(terminalResponse?.status()).toBe(200);
    await expect(page).toHaveURL(/\/ccdv-f-lab\/claude-code\/terminal\/$/);
    await expect(page.locator("[data-simulated-terminal]")).toBeVisible();

    const configResponse = await page.goto("./claude-code/config/");
    expect(configResponse?.status()).toBe(200);
    await expect(page).toHaveURL(/\/ccdv-f-lab\/claude-code\/config\/$/);
    await expect(page.locator("[data-config-builder]")).toBeVisible();

    const playgroundResponse = await page.goto("./playground/");
    expect(playgroundResponse?.status()).toBe(200);
    await expect(page).toHaveURL(/\/ccdv-f-lab\/playground\/$/);
    await expect(page.locator("[data-simulated-terminal]")).toBeVisible();
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
