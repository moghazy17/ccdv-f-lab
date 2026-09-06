import { expect, test } from "@playwright/test";

test.describe("US4 - Registration, exam day, and retakes", () => {
  test("registration page prominently displays and visually distinguishes the Partner Network email requirement", async ({
    page
  }) => {
    await page.goto("./guide/eligibility/");

    await expect(page.locator("h1")).toContainText(/Eligibility, registration, and retakes/i);

    // Scenario 1: Partner Network email requirement is present and visually distinguished
    const callout = page.getByTestId("partner-network-callout");
    await expect(callout).toBeVisible();
    await expect(callout).toContainText(/Partner Network organization\s+email/i);
    await expect(callout).toContainText(/Personal email addresses do not work/i);

    // Verify visual distinction (custom callout border and background)
    const borderLeftWidth = await callout.evaluate((el) => window.getComputedStyle(el).borderLeftWidth);
    expect(parseFloat(borderLeftWidth)).toBeGreaterThanOrEqual(4);

    // Registration facts findable
    const pageText = await page.textContent("body");
    expect(pageText).toContain("125");
    expect(pageText).toContain("Pearson VUE");
    expect(pageText).toContain("18");
    expect(pageText).toContain("24 hours");
  });

  test("exam-day page clearly presents prohibited items, proctoring rules, and misconduct consequences", async ({
    page
  }) => {
    await page.goto("./guide/exam-day/");

    await expect(page.locator("h1")).toContainText(/Exam day/i);

    // Scenario 2: Prohibited items, proctoring rules, and misconduct invalidation
    const pageContent = page.locator("main");
    await expect(pageContent).toContainText(/mobile phones/i);
    await expect(pageContent).toContainText(/smart watches/i);
    await expect(pageContent).toContainText(/headphones/i);
    await expect(pageContent).toContainText(/recording\s+devices/i);

    // Proctoring rules
    await expect(pageContent).toContainText(/webcam/i);
    await expect(pageContent).toContainText(/clear/i);

    // Misconduct invalidation and confidentiality
    await expect(pageContent).toContainText(/confidentiality/i);
    await expect(pageContent).toContainText(/misconduct/i);
    await expect(pageContent).toContainText(/invalidate/i);

    // Pacing facts
    await expect(pageContent).toContainText(/53 items/i);
    await expect(pageContent).toContainText(/120 minutes/i);

    // Appeals window
    await expect(pageContent).toContainText(/14 days/i);
  });

  test("retake terms (waiting periods, attempt cap, and fees) are stated together", async ({ page }) => {
    await page.goto("./guide/eligibility/");

    // Scenario 3: Retake terms read together
    const retakesSection = page.getByTestId("retakes-section");
    await expect(retakesSection).toBeVisible();

    // Waiting periods
    await expect(retakesSection).toContainText(/14 days/i);
    await expect(retakesSection).toContainText(/30 days/i);
    await expect(retakesSection).toContainText(/90 days/i);

    // Rolling attempt cap
    await expect(retakesSection).toContainText(/4 attempts/i);
    await expect(retakesSection).toContainText(/12-month/i);

    // Re-sit fee and total math
    await expect(retakesSection).toContainText(/125/i);
    await expect(retakesSection).toContainText(/500/i);
  });

  test("preserves non-ASCII typographic characters without encoding corruption", async ({ page }) => {
    await page.goto("./guide/exam-day/");

    const text = await page.locator("main").innerText();
    // Verify no mojibake double-encoding like "â€" appears
    expect(text).not.toContain("â€");
    expect(text).not.toContain("Â");
  });
});
