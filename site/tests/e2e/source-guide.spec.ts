import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

import { buildCustomContentFixture, createTemporaryContentCopy } from "./domain-fixture";

const guideRoute = "/guide/eligibility/";

test("guide edits propagate without presentation edits (SC-004, FR-004)", async ({ page }) => {
  // The fixture helper serializes eight full site builds behind one lock, and its own wait ceiling
  // is 12,000 attempts at 50ms - ten minutes. A spec that may legitimately be made to wait that long
  // cannot have a five-minute timeout: the ceiling has to exceed the queue it is queueing for, plus
  // its own build. This bounds a genuine hang without failing on a busy machine.
  test.setTimeout(900_000);

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
