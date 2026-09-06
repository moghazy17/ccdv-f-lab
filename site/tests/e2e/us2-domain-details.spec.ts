import { expect, test } from "@playwright/test";

import { buildDomainFixture } from "./domain-fixture";

const absentLabDomains = [
  "01-agents-and-workflows",
  "03-claude-code",
  "08-tools-and-mcps"
];

test("decision tables retain their columns and absent lab coverage is stated", async ({ page }) => {
  test.setTimeout(300_000);
  const partial = await buildDomainFixture("partial");
  try {
    await page.goto(`${partial.url}/domains/02-applications-and-integration/`);

    const decisionTable = page.getByTestId("domain-content").getByRole("table");
    await expect(decisionTable.getByRole("columnheader", { name: "Approach" })).toBeVisible();
    await expect(
      decisionTable.getByRole("columnheader", { name: "Choose this when" })
    ).toBeVisible();
    await expect(
      decisionTable.getByRole("cell", { name: "The “fixture” condition applies." })
    ).toBeVisible();
  } finally {
    await partial.close();
  }

  for (const domainSlug of absentLabDomains) {
    await page.goto(`./domains/${domainSlug}/`);
    await expect(page.getByTestId("domain-lab-region")).toContainText(
      "The reference application does not yet demonstrate this domain."
    );
    await expect(page.getByTestId("domain-lab-region").getByRole("link")).toHaveCount(0);
  }
});
