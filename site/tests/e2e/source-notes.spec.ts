import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

import { buildCustomContentFixture, createTemporaryContentCopy } from "./domain-fixture";

const domainRoute = "/domains/02-applications-and-integration/";

test("notes edits propagate without presentation edits (SC-004, FR-004)", async ({ page }) => {
  test.setTimeout(180_000);

  // Verify baseline is in scaffold state
  await page.goto(`.${domainRoute}`);
  await expect(page.getByTestId("domain-status")).toHaveText(/Notes are not yet written/i);

  const realNotesDir = fileURLToPath(new URL("../../../notes/", import.meta.url));
  const tempCopy = await createTemporaryContentCopy(realNotesDir, "notes-propagation");

  try {
    const targetFile = join(tempCopy.path, "02-applications-and-integration", "README.md");
    const testPhrase = "This note update propagates directly to the published domain page.";
    const updatedContent = [
      "# Applications and Integration",
      "",
      "## Claude Application Design",
      "",
      testPhrase,
      ""
    ].join("\n");

    await writeFile(targetFile, updatedContent, "utf-8");

    const fixture = await buildCustomContentFixture({
      notesDir: tempCopy.path,
      label: "notes-prop"
    });

    try {
      await page.goto(`${fixture.url}${domainRoute}`);
      await expect(page.getByTestId("domain-status")).toHaveText(/Partially authored/i);
      await expect(page.getByTestId("domain-content")).toContainText(testPhrase);
    } finally {
      await fixture.close();
    }
  } finally {
    await tempCopy.cleanup();
  }
});
