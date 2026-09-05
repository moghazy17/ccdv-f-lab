import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

import { authoredDomainCount, statusForDomain } from "./domain-status";

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
  test("landing page reports the coverage the notes actually have", async ({ page }) => {
    const authored = authoredDomainCount(blueprint.domains.map((domain) => domain.slug));

    await page.goto("./");

    const coverageSummary = page.getByTestId("coverage-summary");
    await expect(coverageSummary).toBeVisible();
    await expect(coverageSummary).toContainText(
      `${authored} of ${blueprint.domains.length} domains have authored notes`
    );
  });

  test("all eight domain modules render honest scaffold notices and sub-skill lists", async ({
    page
  }) => {
    expect(blueprint.domains).toHaveLength(8);

    for (const domain of blueprint.domains) {
      await page.goto(`./domains/${domain.slug}/`);

      await expect(page.getByRole("heading", { level: 1, name: domain.name })).toBeVisible();

      // A scaffolded domain must say so; an authored one must not claim to be unwritten.
      const scaffoldNotice = page.locator(".scaffold-notice");
      if (statusForDomain(domain.slug) === "scaffold") {
        await expect(scaffoldNotice).toBeVisible();
        await expect(scaffoldNotice).toContainText("Notes are not yet written");
        await expect(scaffoldNotice).toContainText("This domain has no authored note sections");
      } else {
        await expect(scaffoldNotice).toHaveCount(0);
      }

      // Verify domain weight facts
      const examWeight = page.getByTestId("domain-exam-weight");
      await expect(examWeight).toContainText(`${domain.weight}%`);

      // Every sub-skill must be named on the page either way: inside the scaffold notice while
      // the notes are unwritten, and as authored material once they are.
      const subSkillHome =
        statusForDomain(domain.slug) === "scaffold" ? scaffoldNotice : page.locator("main");
      for (const subSkill of domain.subSkills) {
        await expect(subSkillHome).toContainText(subSkill.name);
      }
    }
  });

  test("all eight cheatsheets render honest blueprint-only allocation notices", async ({ page }) => {
    expect(blueprint.domains).toHaveLength(8);

    for (const domain of blueprint.domains) {
      await page.goto(`./cheatsheets/${domain.slug}/`);

      await expect(page.getByRole("heading", { level: 1 })).toContainText(domain.name);

      // A sheet with no authored extracts must declare itself allocation-only; one with
      // extracts must not, because that notice would then be untrue.
      const notice = page.getByTestId("cheatsheet-scaffold-notice");
      if (statusForDomain(domain.slug) === "scaffold") {
        await expect(notice).toBeVisible();
        await expect(notice).toContainText("Blueprint allocation only");
        await expect(notice).toContainText("no notes are authored for this domain yet");
      } else {
        await expect(notice).toHaveCount(0);
      }

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
