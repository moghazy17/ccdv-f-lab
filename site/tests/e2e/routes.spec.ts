import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

interface Domain {
  slug: string;
}

interface BlueprintData {
  domains: Domain[];
}

const blueprint = JSON.parse(
  readFileSync(new URL("../../src/data/blueprint.json", import.meta.url), "utf8")
) as BlueprintData;

const base = "/ccdv-f-lab";

const featureRoutes = [
  "",
  "blueprint/",
  "domains/",
  ...blueprint.domains.map((d) => `domains/${d.slug}/`),
  "guide/eligibility/",
  "guide/exam-day/",
  "guide/course-crossmap/",
  "plans/",
  "plans/1-week/",
  "plans/3-weeks/",
  "plans/6-weeks/",
  "cheatsheets/",
  ...blueprint.domains.map((d) => `cheatsheets/${d.slug}/`),
  "diagnostic/",
  "progress/"
];

const reservedRoutes = [
  "labs/",
  "labs/batch/",
  "mock/",
  "mock/report/",
  "flashcards/",
  ...blueprint.domains.map((d) => `domains/${d.slug}/quiz/`),
  "claude-code/terminal/",
  "claude-code/config/",
  "playground/"
];

const allContractedRoutes = [...featureRoutes, ...reservedRoutes];

test.describe("Contracted route structure, base path, and trailing slash verification (contracts/routes.md)", () => {
  for (const route of allContractedRoutes) {
    test(`route ${route || "/"} conforms to base path and trailing slash`, async ({ page }) => {
      const response = await page.goto(`./${route}`);
      expect(response?.status()).toBe(200);

      // Verify trailing slash rule: route must end with /
      const url = new URL(page.url());
      expect(url.pathname.endsWith("/")).toBe(true);

      // Verify base path: must start with configured base /ccdv-f-lab/
      expect(url.pathname.startsWith(`${base}/`)).toBe(true);

      // Verify exact expected pathname
      const expectedPathname = `${base}/${route}`;
      expect(url.pathname).toBe(expectedPathname);
    });
  }

  test("all internal links on landing page have base path and trailing slash", async ({ page }) => {
    await page.goto("./");

    const links = await page.locator("a[href]").all();
    for (const link of links) {
      const href = await link.getAttribute("href");
      if (!href) continue;

      // Skip external links, hash fragments, mailto, etc.
      if (
        href.startsWith("http:") ||
        href.startsWith("https:") ||
        href.startsWith("#") ||
        href.startsWith("mailto:")
      ) {
        continue;
      }

      // Internal link must start with base path
      expect(href.startsWith(base)).toBe(true);

      // Unless it contains a query or hash, it must end with trailing slash
      const cleanPath = href.split("?")[0].split("#")[0];
      expect(cleanPath.endsWith("/")).toBe(true);
    }
  });
});
