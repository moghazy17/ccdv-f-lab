import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";

interface Domain {
  name: string;
  slug: string;
  weight: number;
}

interface BlueprintData {
  domains: Domain[];
}

const blueprint = JSON.parse(
  readFileSync(new URL("../../src/data/blueprint.json", import.meta.url), "utf8")
) as BlueprintData;
const { domains } = blueprint;

const domainsByWeight = [...domains].sort((left, right) => right.weight - left.weight);

test("every higher-weighted domain has a larger rendered weight bar across all 28 pairs", async ({
  page
}) => {
  await page.goto("./blueprint/");

  const widths = new Map<string, number>();
  for (const domain of domainsByWeight) {
    const bar = page.locator(`[data-domain-weight-bar="${domain.slug}"]`);
    await expect(bar).toBeVisible();
    const dimensions = await bar.boundingBox();
    if (dimensions === null) {
      throw new Error(`The ${domain.name} weight bar has no rendered dimensions.`);
    }
    widths.set(domain.slug, dimensions.width);
  }

  for (const [index, higher] of domainsByWeight.entries()) {
    for (const lower of domainsByWeight.slice(index + 1)) {
      const higherWidth = widths.get(higher.slug);
      const lowerWidth = widths.get(lower.slug);
      if (higherWidth === undefined || lowerWidth === undefined) {
        throw new Error("A rendered domain weight bar was not recorded.");
      }
      expect(
        higherWidth,
        `${higher.name} (${higher.weight}%) must be wider than ${lower.name} (${lower.weight}%).`
      ).toBeGreaterThan(lowerWidth);
    }
  }
});
