import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];

const pageTypes = [
  { heading: "CCDV-F community study kit", name: "landing page", route: "./" },
  { heading: "Blueprint explorer", name: "blueprint explorer", route: "./blueprint/" },
  { heading: "Domains by exam weight", name: "domain index", route: "./domains/" }
];

for (const pageType of pageTypes) {
  test(`${pageType.name} has no axe violations`, async ({ page }) => {
    await page.goto(pageType.route);

    await expect(page.getByRole("heading", { name: pageType.heading })).toBeVisible();
    const axePage = page as unknown as AxePage;
    const results = await new AxeBuilder({ page: axePage }).analyze();
    expect(results.violations).toEqual([]);
  });
}
