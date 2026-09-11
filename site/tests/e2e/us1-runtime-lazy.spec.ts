import { expect, test } from "@playwright/test";

/**
 * SC-002 / FR-002: the runtime is a cost the candidate chooses. No page fetches it on load, and a
 * lab page does not fetch it until Run is pressed.
 */

const RUNTIME_REQUEST = /\/runtime\/|pyodide|\.wasm(\?|$)|python_stdlib\.zip|lab-drills\.zip/i;

const pagesThatMustNotFetchTheRuntime = [
  "./",
  "./blueprint/",
  "./domains/",
  "./domains/02-applications-and-integration/",
  "./plans/",
  "./diagnostic/",
  "./progress/",
  "./mock/",
  "./flashcards/",
  "./labs/"
];

test.describe("The runtime is never fetched before it is asked for (SC-002, FR-002)", () => {
  test("no page outside a lab requests the runtime on load", async ({ page }) => {
    const runtimeRequests: string[] = [];
    page.on("request", (request) => {
      if (RUNTIME_REQUEST.test(request.url())) {
        runtimeRequests.push(request.url());
      }
    });

    for (const route of pagesThatMustNotFetchTheRuntime) {
      await page.goto(route);
      await expect(page.locator("body")).toBeVisible();
    }

    expect(runtimeRequests, "A page that runs no code fetched the runtime").toEqual([]);
  });

  test("a lab page is interactive without fetching the runtime, until Run is pressed", async ({
    page
  }) => {
    const runtimeRequests: string[] = [];
    page.on("request", (request) => {
      if (RUNTIME_REQUEST.test(request.url())) {
        runtimeRequests.push(request.url());
      }
    });

    await page.goto("./labs/router/");

    const source = page.locator("[data-code-pane-source]");
    await expect(source).toBeVisible();
    await expect(page.locator("[data-code-pane-run]")).toBeEnabled();

    // Editing is interaction, and it still must not pull the runtime in.
    await source.click();
    await source.fill("print('edited before any run')");
    await expect(page.locator("[data-code-pane-status]")).toBeVisible();

    expect(runtimeRequests, "The lab page fetched the runtime before Run was pressed").toEqual([]);

    await page.locator("[data-code-pane-run]").click();
    await expect
      .poll(() => runtimeRequests.length, {
        message: "Pressing Run did not fetch the runtime",
        timeout: 60_000
      })
      .toBeGreaterThan(0);
  });
});
