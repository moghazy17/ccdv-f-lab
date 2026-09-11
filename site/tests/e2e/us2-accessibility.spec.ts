import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { buildDomainFixture } from "./domain-fixture";

type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];

test("scaffold and authored domain pages have no axe violations", async ({ page }) => {
  // The fixture helper serializes eight full site builds behind one lock, and its own wait ceiling
  // is 12,000 attempts at 50ms - ten minutes. A spec that may legitimately be made to wait that long
  // cannot have a five-minute timeout: the ceiling has to exceed the queue it is queueing for, plus
  // its own build. This bounds a genuine hang without failing on a busy machine.
  test.setTimeout(900_000);
  await page.goto("./domains/01-agents-and-workflows/");
  await expect(page.getByTestId("scaffold-notice")).toBeVisible();
  const scaffoldPage = page as unknown as AxePage;
  expect((await new AxeBuilder({ page: scaffoldPage }).analyze()).violations).toEqual([]);

  const contributionLink = page.getByRole("link", {
    name: /Contribute a note for Agents and Workflows/i
  });
  for (let index = 0; index < 20; index += 1) {
    await page.keyboard.press("Tab");
    if (await contributionLink.evaluate((element) => element === document.activeElement)) {
      break;
    }
  }
  await expect(contributionLink).toBeFocused();
  expect(await contributionLink.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe(
    "solid"
  );

  const authored = await buildDomainFixture("authored");
  try {
    await page.goto(`${authored.url}/domains/02-applications-and-integration/`);
    await expect(page.getByTestId("domain-content")).toBeVisible();
    const authoredPage = page as unknown as AxePage;
    expect((await new AxeBuilder({ page: authoredPage }).analyze()).violations).toEqual([]);
  } finally {
    await authored.close();
  }
});
