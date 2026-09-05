import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

import { buildCustomContentFixture, createTemporaryContentCopy } from "./domain-fixture";

const guideRoute = "/guide/eligibility/";

test("guide edits propagate without presentation edits (SC-004, FR-004)", async ({ page }) => {
  test.setTimeout(180_000);

  // Verify baseline guide page loads
  await page.goto(`.${guideRoute}`);
  await expect(page.locator(".guide-content")).toBeVisible();

  const realGuideDir = fileURLToPath(new URL("../../../guide/", import.meta.url));
  const tempCopy = await createTemporaryContentCopy(realGuideDir, "guide-propagation");

  try {
    const targetFile = join(tempCopy.path, "eligibility.md");
    const testPhrase = "This guide update propagates directly to the published guide page.";
    const existingContent = await readFile(targetFile, "utf-8");
    const updatedContent = `${existingContent}\n\n## Important candidate update\n\n${testPhrase}\n`;

    await writeFile(targetFile, updatedContent, "utf-8");

    const fixture = await buildCustomContentFixture({
      guideDir: tempCopy.path,
      label: "guide-prop"
    });

    try {
      await page.goto(`${fixture.url}${guideRoute}`);
      await expect(page.locator(".guide-content")).toContainText(testPhrase);
    } finally {
      await fixture.close();
    }
  } finally {
    await tempCopy.cleanup();
  }
});
