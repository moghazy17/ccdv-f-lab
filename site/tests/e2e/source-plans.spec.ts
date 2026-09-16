import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

import { buildCustomContentFixture, createTemporaryContentCopy } from "./domain-fixture";

const planRoute = "/plans/1-week/";

test("study plan edits propagate without presentation edits (SC-004, FR-004)", async ({
  page
}) => {
  // The fixture helper serializes eight full site builds behind one lock, and its own wait ceiling
  // is 12,000 attempts at 50ms - ten minutes. A spec that may legitimately be made to wait that long
  // cannot have a five-minute timeout: the ceiling has to exceed the queue it is queueing for, plus
  // its own build. This bounds a genuine hang without failing on a busy machine.
  test.setTimeout(900_000);

  // Verify baseline plan page title
  await page.goto(`.${planRoute}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("One-week study plan");

  const realPlansDir = fileURLToPath(new URL("../../../study-plans/", import.meta.url));
  const tempCopy = await createTemporaryContentCopy(realPlansDir, "plans-propagation");

  try {
    const targetFile = join(tempCopy.path, "1-week.md");
    const existingContent = await readFile(targetFile, "utf-8");
    const updatedTitle = "One-week accelerated study schedule";
    const updatedContent = existingContent.replace("# One-week study plan", `# ${updatedTitle}`);

    await writeFile(targetFile, updatedContent, "utf-8");

    const fixture = await buildCustomContentFixture({
      studyPlansDir: tempCopy.path,
      label: "plans-prop"
    });

    try {
      await page.goto(`${fixture.url}${planRoute}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(updatedTitle);
    } finally {
      await fixture.close();
    }
  } finally {
    await tempCopy.cleanup();
  }
});
