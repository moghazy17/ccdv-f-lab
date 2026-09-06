import { expect, test } from "@playwright/test";

import { buildDomainFixture } from "./domain-fixture";

const domainRoute = "/domains/02-applications-and-integration/";

test(
  "a domain progresses from scaffold to partial to authored content without hiding gaps",
  async ({ page }) => {
    // Each fixture state is a full Astro build, so this test needs well above the default.
    test.setTimeout(300_000);
  await page.goto(`.${domainRoute}`);
  await expect(page.getByTestId("domain-status")).toHaveText(/Notes are not yet written/i);

  const partial = await buildDomainFixture("partial");
  try {
    await page.goto(`${partial.url}${domainRoute}`);
    await expect(page.getByTestId("domain-status")).toHaveText(/Partially authored/i);
    await expect(page.getByTestId("domain-content")).toContainText(
      "A fixture explanation is present — with typographic punctuation."
    );
    await expect(page.locator("#claude-application-design")).toBeVisible();
    await expect(page.getByTestId("sub-skill-status")).toContainText(
      "Claude Application DesignAuthored"
    );
    await expect(page.getByTestId("sub-skill-status")).toContainText(
      "Software Engineering FoundationsScaffolded"
    );
    await expect(page.getByTestId("outstanding-sub-skills")).toContainText(
      "Software Engineering Foundations"
    );
    await expect(page.getByText(/Authoring prompt:/i)).toHaveCount(0);
  } finally {
    await partial.close();
  }

  const authored = await buildDomainFixture("authored");
  try {
    await page.goto(`${authored.url}${domainRoute}`);
    await expect(page.getByTestId("domain-status")).toHaveText(/All note sections are authored/i);
    await expect(page.getByTestId("domain-content")).toContainText(
      "Every fixture sub-skill has written material."
    );
    await expect(page.getByTestId("sub-skill-status")).toContainText(
      "Claude Application DesignAuthored"
    );
    await expect(page.getByTestId("outstanding-sub-skills")).toHaveCount(0);
  } finally {
    await authored.close();
  }
  }
);
