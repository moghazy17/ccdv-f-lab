import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const blueprint = JSON.parse(
  readFileSync(new URL("../../src/data/blueprint.json", import.meta.url), "utf8")
);

test.describe("US4 - Course-to-blueprint cross-map", () => {
  test("cross-map names all eight blueprint domains using exact names from BLUEPRINT.md", async ({
    page
  }) => {
    await page.goto("./guide/course-crossmap/");

    await expect(page.locator("h1")).toContainText(/Course-to-blueprint cross-map/i);

    const mainText = await page.locator("main").innerText();

    // Verify all eight domains from BLUEPRINT.md are named byte-identically (US4 Scenario 4)
    expect(blueprint.domains).toHaveLength(8);
    for (const domain of blueprint.domains) {
      expect(mainText).toContain(domain.name);
    }

    // Verify preparation modules M1 through M5 are present
    expect(mainText).toContain("M1");
    expect(mainText).toContain("M2");
    expect(mainText).toContain("M3");
    expect(mainText).toContain("M4");
    expect(mainText).toContain("M5");

    // Verify prerequisite courses P1 through P9 are present
    for (let i = 1; i <= 9; i++) {
      expect(mainText).toContain(`P${i}:`);
    }

    // Verify coverage signals for Domains 4 and 5 are identified
    expect(mainText).toContain("Eval, Testing, and Debugging");
    expect(mainText).toContain("Model Selection and Optimization");
  });
});
