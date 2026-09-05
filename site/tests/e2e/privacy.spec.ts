import { expect, test } from "@playwright/test";

const routesToAudit = [
  "./",
  "./blueprint/",
  "./domains/",
  "./domains/02-applications-and-integration/",
  "./guide/eligibility/",
  "./plans/",
  "./plans/3-weeks/",
  "./cheatsheets/",
  "./cheatsheets/02-applications-and-integration/",
  "./diagnostic/",
  "./progress/",
  "./labs/",
  "./mock/",
  "./flashcards/",
  "./playground/"
];

test.describe("Privacy, keyless operation, and third-party isolation audit (CC-003, FR-035, FR-036)", () => {
  test("no network requests leave the origin on any page", async ({ page }) => {
    const origin = "http://127.0.0.1:4321";
    const externalRequests: string[] = [];

    page.on("request", (request) => {
      const url = request.url();
      if (!url.startsWith(origin) && !url.startsWith("data:") && !url.startsWith("blob:")) {
        externalRequests.push(url);
      }
    });

    for (const route of routesToAudit) {
      await page.goto(route);
      await expect(page.locator("body")).toBeVisible();
    }

    expect(externalRequests, "Detected third-party runtime requests").toEqual([]);
  });

  test("zero cookies are set across the entire site", async ({ context, page }) => {
    for (const route of routesToAudit) {
      await page.goto(route);
    }

    const cookies = await context.cookies();
    expect(cookies, "Cookies were set by the application").toEqual([]);
  });

  test("no credential inputs, login forms, or API key requests exist", async ({ page }) => {
    for (const route of routesToAudit) {
      await page.goto(route);

      // No password inputs
      await expect(page.locator("input[type='password']")).toHaveCount(0);

      // No account authentication buttons or forms
      const authKeywords = page.locator("button, a, input").filter({
        hasText: /^(sign in|sign up|log in|register account|login)$/i
      });
      await expect(authKeywords).toHaveCount(0);

      // No API key entry fields
      const apiKeyInputs = page.locator("input[name*='key'], input[name*='token'], input[id*='key']");
      await expect(apiKeyInputs).toHaveCount(0);
    }
  });

  test("localStorage stores only the contracted progress namespace without user tracking", async ({
    page
  }) => {
    await page.goto("./plans/3-weeks/");
    await page.getByTestId("mark-domain-2").check();

    const storedKeys = await page.evaluate(() => Object.keys(localStorage));
    expect(storedKeys).toEqual(["ccdv-f:progress"]);

    const storedData = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("ccdv-f:progress") ?? "{}")
    );

    // Verify envelope schema: only schemaVersion, updatedAt, and namespaces
    expect(storedData.schemaVersion).toBe(1);
    expect(typeof storedData.updatedAt).toBe("string");
    expect(storedData.namespaces).toBeDefined();

    // Ensure no user tracking, session ID, or credential fields
    expect(storedData.userId).toBeUndefined();
    expect(storedData.sessionId).toBeUndefined();
    expect(storedData.apiKey).toBeUndefined();
  });
});
