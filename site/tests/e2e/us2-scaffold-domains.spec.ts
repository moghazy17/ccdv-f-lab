import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

interface SubSkill {
  approximateItems: number;
  measured: string;
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
}

const blueprint = JSON.parse(
  readFileSync(new URL("../../src/data/blueprint.json", import.meta.url), "utf8")
) as BlueprintData;

test("every scaffolded domain page is useful, explicit, and complete", async ({ page }) => {
  for (const domain of blueprint.domains) {
    await page.goto(`./domains/${domain.slug}/`);

    await expect(page.getByRole("heading", { level: 1, name: domain.name })).toBeVisible();
    await expect(page.getByTestId("domain-status")).toHaveText(/Notes are not yet written/i);
    await expect(page.getByTestId("domain-exam-weight")).toContainText(`${domain.weight}%`);
    await expect(page.getByTestId("domain-exam-weight")).toContainText(
      `About ${domain.approximateItems} ${domain.approximateItems === 1 ? "item" : "items"}`
    );

    const scaffoldNotice = page.getByTestId("scaffold-notice");
    await expect(
      scaffoldNotice.getByRole("heading", { name: /What this domain covers/i })
    ).toBeVisible();
    await expect(
      scaffoldNotice.getByRole("link", { name: new RegExp(`Contribute.*${domain.name}`, "i") })
    ).toBeVisible();

    for (const subSkill of domain.subSkills) {
      const row = scaffoldNotice.getByRole("row").filter({ hasText: subSkill.name });
      await expect(row).toContainText(subSkill.name);
      await expect(row).toContainText(`${subSkill.weight}%`);
      await expect(row).toContainText(`About ${subSkill.approximateItems} items`);
      await expect(row).toContainText(subSkill.measured);
      await expect(row).toContainText("Scaffolded");
    }

    await expect(page.getByTestId("domain-content")).toHaveCount(0);
  }
});
