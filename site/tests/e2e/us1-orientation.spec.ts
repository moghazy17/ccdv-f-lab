import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

import { authoredDomainCount } from "./domain-status";

interface BlueprintFacts {
  items: number;
  timeLimitMinutes: number;
  passingScore: number;
  scaleMin: number;
  scaleMax: number;
  feeUsd: number;
}

interface SubSkill {
  approximateItems: number;
  name: string;
  weight: number;
}

interface Domain {
  approximateItems: number;
  name: string;
  slug: string;
  subSkills: SubSkill[];
  weight: number;
}

interface BlueprintData {
  domains: Domain[];
  examFacts: BlueprintFacts;
}

const blueprint = JSON.parse(
  readFileSync(new URL("../../src/data/blueprint.json", import.meta.url), "utf8")
) as BlueprintData;

test("a candidate can orient to the exam with the keyboard", async ({ page }) => {
  await page.goto("./");

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "CCDV-F community study kit" })).toBeFocused();

  await page.keyboard.press("Tab");
  const blueprintLink = page.getByRole("link", { name: "Blueprint" });
  await expect(blueprintLink).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/ccdv-f-lab\/blueprint\/$/);
  await expect(page.getByRole("heading", { name: "Blueprint explorer" })).toBeVisible();

  for (const domain of blueprint.domains) {
    const domainSection = page.locator(`#domain-${domain.slug}`);
    const itemLabel = domain.approximateItems === 1 ? "item" : "items";

    await expect(domainSection.getByRole("heading", { name: domain.name })).toBeVisible();
    await expect(domainSection).toContainText(`${domain.weight}%`);
    await expect(domainSection).toContainText(`About ${domain.approximateItems} ${itemLabel}`);

    for (const subSkill of domain.subSkills) {
      const subSkillItem = domainSection.locator(".sub-skill-list li").filter({
        hasText: subSkill.name
      });
      await expect(subSkillItem.getByText(subSkill.name, { exact: true })).toBeVisible();
      await expect(subSkillItem).toContainText(
        `${subSkill.weight}% · About ${subSkill.approximateItems} items`
      );
    }
  }

  await page.goto("./domains/");
  const listedDomains = await page.locator(".domain-navigation__item h2 a").allTextContents();
  const expectedDomainOrder = [...blueprint.domains]
    .sort((left, right) => right.weight - left.weight)
    .map((domain) => domain.name);
  expect(listedDomains).toEqual(expectedDomainOrder);

  await page.goto("./");
  await expect(page.getByRole("heading", { name: "CCDV-F community study kit" })).toBeVisible();
  await expect(page.getByTestId("exam-facts")).toContainText(`${blueprint.examFacts.items} items`);
  await expect(page.getByTestId("exam-facts")).toContainText(
    `${blueprint.examFacts.timeLimitMinutes} minutes`
  );
  await expect(page.getByTestId("exam-facts")).toContainText(
    `${blueprint.examFacts.passingScore} on a ${blueprint.examFacts.scaleMin}–${blueprint.examFacts.scaleMax} scale`
  );
  await expect(page.getByTestId("exam-facts")).toContainText(
    `$${blueprint.examFacts.feeUsd} USD`
  );
  await expect(page.getByTestId("coverage-summary")).toContainText(
    `${authoredDomainCount(blueprint.domains.map((domain) => domain.slug))} of ${blueprint.domains.length} domains have authored notes`
  );
  await expect(page.getByText(/This project offers static readiness guidance/i)).toBeVisible();
  await expect(
    page.getByText(/unofficial and not affiliated with, endorsed by, or produced by Anthropic/i)
  ).toBeVisible();
});
