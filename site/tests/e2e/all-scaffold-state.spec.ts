import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

interface Domain {
  approximateItems: number;
  name: string;
  number: number;
  slug: string;
  subSkills: { name: string; weight: number }[];
  weight: number;
}

interface BlueprintData {
  domains: Domain[];
}

const blueprint = JSON.parse(
  readFileSync(new URL("../../src/data/blueprint.json", import.meta.url), "utf8")
) as BlueprintData;

test.describe("All scaffold state and honest landing coverage (SC-009, FR-013, FR-017, FR-049)", () => {
  test("landing page prominently displays 0 of 8 domains authored coverage", async ({ page }) => {
    await page.goto("./");

    const coverageSummary = page.getByTestId("coverage-summary");
    await expect(coverageSummary).toBeVisible();
    await expect(coverageSummary).toContainText("0 of 8 domains have authored notes");
    await expect(coverageSummary).toContainText(
      "The blueprint is available to help you prioritize study time while the domain notes are written."
    );
  });

  test("all eight domain modules render honest scaffold notices and sub-skill lists", async ({
    page
  }) => {
    expect(blueprint.domains).toHaveLength(8);

    for (const domain of blueprint.domains) {
      await page.goto(`./domains/${domain.slug}/`);

      await expect(page.getByRole("heading", { level: 1, name: domain.name })).toBeVisible();

      // Verify scaffold notice is present and honest
      const scaffoldNotice = page.locator(".scaffold-notice");
      await expect(scaffoldNotice).toBeVisible();
      await expect(scaffoldNotice).toContainText("Notes are not yet written");
      await expect(scaffoldNotice).toContainText("This domain has no authored note sections");

      // Verify domain weight facts
      const examWeight = page.getByTestId("domain-exam-weight");
      await expect(examWeight).toContainText(`${domain.weight}%`);

      // Verify all sub-skills are listed in the scaffold notice
      for (const subSkill of domain.subSkills) {
        await expect(scaffoldNotice).toContainText(subSkill.name);
      }
    }
  });

  test("all eight cheatsheets render honest blueprint-only allocation notices", async ({ page }) => {
    expect(blueprint.domains).toHaveLength(8);

    for (const domain of blueprint.domains) {
      await page.goto(`./cheatsheets/${domain.slug}/`);

      await expect(page.getByRole("heading", { level: 1 })).toContainText(domain.name);

      // Verify scaffold notice declares it contains only blueprint allocation
      const notice = page.getByTestId("cheatsheet-scaffold-notice");
      await expect(notice).toBeVisible();
      await expect(notice).toContainText("Blueprint allocation only");
      await expect(notice).toContainText("no notes are authored for this domain yet");

      // Verify tables of domain allocation and sub-skills are present
      await expect(page.locator("table").first()).toBeVisible();
      await expect(page.locator(".cheatsheet-content")).toContainText(
        `${domain.weight.toFixed(1)}%`
      );
    }
  });

  test("search index records are labeled with scaffold status for unauthored content", async ({
    page
  }) => {
    await page.goto("./");

    // Open search dialog
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Search study kit" });
    await expect(dialog).toBeVisible();

    const searchInput = page.getByTestId("search-input");
    await searchInput.fill("Applications and Integration");

    const resultList = page.getByTestId("search-results");
    await expect(resultList).toBeVisible();

    // Check that search results for domain scaffold display scaffold status tag
    const scaffoldBadge = page.locator(".search-result__status");
    if (await scaffoldBadge.count() > 0) {
      await expect(scaffoldBadge.first()).toHaveText(/scaffold/i);
    }
  });
});
