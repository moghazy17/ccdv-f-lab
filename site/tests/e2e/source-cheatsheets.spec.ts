import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

import { buildCustomContentFixture, createTemporaryContentCopy } from "./domain-fixture";

const cheatsheetRoute = "/cheatsheets/02-applications-and-integration/";

test("cheatsheet edits propagate without presentation edits (SC-004, FR-004)", async ({
  page
}) => {
  test.setTimeout(180_000);

  // Verify baseline cheatsheet has the scaffold notice
  await page.goto(`.${cheatsheetRoute}`);
  await expect(page.getByTestId("cheatsheet-scaffold-notice")).toBeVisible();

  const realCheatsheetsDir = fileURLToPath(new URL("../../../cheatsheets/", import.meta.url));
  const tempCopy = await createTemporaryContentCopy(realCheatsheetsDir, "cheatsheets-propagation");

  try {
    const targetFile = join(tempCopy.path, "02-applications-and-integration.md");
    const testPhrase = "This cheatsheet update propagates directly to the published cheatsheet.";
    const existingContent = await readFile(targetFile, "utf-8");
    const updatedContent = `${existingContent}\n\n## Custom exam notes\n\n${testPhrase}\n`;

    await writeFile(targetFile, updatedContent, "utf-8");

    const fixture = await buildCustomContentFixture({
      cheatsheetsDir: tempCopy.path,
      label: "cheatsheets-prop"
    });

    try {
      await page.goto(`${fixture.url}${cheatsheetRoute}`);
      await expect(page.locator(".cheatsheet-content")).toContainText(testPhrase);
    } finally {
      await fixture.close();
    }
  } finally {
    await tempCopy.cleanup();
  }
});
