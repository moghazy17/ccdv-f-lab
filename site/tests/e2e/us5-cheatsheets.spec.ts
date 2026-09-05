import { readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { statusForDomain } from "./domain-status";

type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];

interface SubSkill {
  approximateItems: number;
  measured: string;
  name: string;
  weight: number;
}

interface Domain {
  approximateItems: number;
  mockItems: number;
  name: string;
  number: number;
  slug: string;
  subSkills: SubSkill[];
  weight: number;
}

interface BlueprintData {
  domains: Domain[];
}

const blueprint = JSON.parse(
  readFileSync(new URL("../../src/data/blueprint.json", import.meta.url), "utf8")
) as BlueprintData;

test.describe("US5 - Scaffold cheatsheets and axe checks", () => {
  const scaffolded = blueprint.domains.filter(
    (domain) => statusForDomain(domain.slug) === "scaffold"
  );

  for (const domain of scaffolded) {
    test(`scaffold cheatsheet for ${domain.name} is honest, derived, and accessible`, async ({ page }) => {
      await page.goto(`./cheatsheets/${domain.slug}/`);

      // Page heading contains domain name
      await expect(
        page.getByRole("heading", { level: 1, name: new RegExp(`${domain.name}.*cheat sheet`, "i") })
      ).toBeVisible();

      // States that it contains blueprint allocation only because no notes are authored
      const scaffoldNotice = page.getByTestId("cheatsheet-scaffold-notice");
      await expect(scaffoldNotice).toBeVisible();
      await expect(scaffoldNotice).toContainText(/blueprint allocation only/i);
      await expect(scaffoldNotice).toContainText(/no notes are authored/i);

      // Shows derived domain name and weight
      await expect(page.getByTestId("cheatsheet-meta")).toContainText(domain.name);
      await expect(page.getByTestId("cheatsheet-meta")).toContainText(`${domain.weight}%`);

      // License and unofficial attribution appear on the page
      const attribution = page.locator(".print-attribution, .site-footer");
      await expect(attribution.first()).toContainText(/unofficial and not affiliated/i);
      await expect(attribution.first()).toContainText(/CC BY 4.0/i);

      // Blueprint allocation table rendered from markdown
      await expect(
        page.getByRole("heading", { level: 2, name: "Blueprint allocation", exact: true })
      ).toBeVisible();
      const allocationTable = page.locator("table").first();
      const allocationRow = allocationTable.getByRole("row").filter({
        hasText: new RegExp(`${domain.weight}(?:\\.0)?%`)
      });
      await expect(allocationRow).toBeVisible();
      await expect(allocationRow).toContainText(`${domain.mockItems}`);

      // Sub-skills table rendered from markdown with all sub-skills
      await expect(page.getByRole("heading", { level: 2, name: /Sub-skills/i })).toBeVisible();
      const subSkillsTable = page.locator("table").nth(1);
      for (const subSkill of domain.subSkills) {
        const subSkillRow = subSkillsTable.getByRole("row").filter({ hasText: subSkill.name });
        await expect(subSkillRow).toBeVisible();
        await expect(subSkillRow).toContainText(new RegExp(`${subSkill.weight}(?:\\.0)?%`));
      }

      // Axe accessibility check
      const axePage = page as unknown as AxePage;
      const results = await new AxeBuilder({ page: axePage }).analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test("cheatsheet index lists all domains in weight-descending order and is accessible", async ({ page }) => {
    await page.goto("./cheatsheets/");

    await expect(page.getByRole("heading", { level: 1, name: /Cheat sheets|Cheatsheets/i })).toBeVisible();

    // Verify all eight domains are listed in descending weight order
    const sortedDomains = [...blueprint.domains].sort((a, b) => b.weight - a.weight);
    const domainItems = page.getByTestId("cheatsheet-item");
    await expect(domainItems).toHaveCount(8);

    for (let i = 0; i < sortedDomains.length; i++) {
      const expectedDomain = sortedDomains[i];
      const item = domainItems.nth(i);
      await expect(item).toContainText(expectedDomain.name);
      await expect(item).toContainText(`${expectedDomain.weight}%`);

      // Link to domain cheatsheet exists
      const link = item.getByRole("link", { name: new RegExp(expectedDomain.name, "i") });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", new RegExp(`cheatsheets/${expectedDomain.slug}/$`));
    }

    // Axe accessibility check on index
    const axePage = page as unknown as AxePage;
    const results = await new AxeBuilder({ page: axePage }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("keyboard navigation on cheatsheets index has visible focus", async ({ page }) => {
    await page.goto("./cheatsheets/");

    // Press tab to focus skip link
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();

    // Tab through header nav into main content
    const firstDomainLink = page.getByTestId("cheatsheet-item").first().getByRole("link").first();
    let focused = false;
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      if (await firstDomainLink.evaluate((el) => el === document.activeElement)) {
        focused = true;
        break;
      }
    }
    expect(focused).toBe(true);
    await expect(firstDomainLink).toBeFocused();

    // Focus indicator is visible
    const outlineStyle = await firstDomainLink.evaluate((el) => window.getComputedStyle(el).outlineStyle);
    expect(outlineStyle).toBe("solid");
  });
});
