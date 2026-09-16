import { expect, test } from "@playwright/test";

/**
 * SC-002 again, from the other side: the surface a candidate uses under time pressure never asks
 * for the 6 MiB Python runtime — not on load, not on start, and not on submission.
 *
 * This is the property research R7 bought by keeping scoring in TypeScript, so it is worth its own
 * test rather than being folded into the lazy-loading sweep.
 */

const RUNTIME_REQUEST = /\/runtime\/|pyodide|\.wasm(\?|$)|python_stdlib\.zip|lab-drills\.zip/i;
const STORAGE_KEY = "ccdv-f:progress";

test("the mock exam and its report never fetch the runtime", async ({ page }) => {
  const runtimeRequests: string[] = [];
  page.on("request", (request) => {
    if (RUNTIME_REQUEST.test(request.url())) {
      runtimeRequests.push(request.url());
    }
  });

  await page.goto("./mock/");
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await page.reload();

  await page.getByRole("button", { name: "Start the mock" }).click();
  await expect(page.getByTestId("mock-item-list")).toBeVisible();
  await page.locator("[data-mock-item-options] input").first().check();
  await page.getByTestId("mock-submit").click();

  await expect(page).toHaveURL(/\/mock\/report\/$/);
  await expect(page.getByTestId("score-overall")).toBeVisible();

  expect(runtimeRequests, "The mock exam fetched the Python runtime").toEqual([]);
});

test("no worker is constructed while the mock is assembled and answered", async ({ page }) => {
  await page.goto("./mock/");
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  await page.reload();

  // Count worker construction from before the first interaction until just before submission,
  // which is the whole window in which this page could reach for the runtime.
  await page.evaluate(() => {
    const original = window.Worker;
    const counter = { created: 0 };
    class CountingWorker extends original {
      constructor(scriptURL: string | URL, options?: WorkerOptions) {
        counter.created += 1;
        super(scriptURL, options);
      }
    }
    (window as unknown as { Worker: typeof Worker }).Worker = CountingWorker;
    (window as unknown as { __workerCounter: { created: number } }).__workerCounter = counter;
  });

  await page.getByRole("button", { name: "Start the mock" }).click();
  await expect(page.getByTestId("mock-item-list")).toBeVisible();
  await page.locator("[data-mock-item-options] input").first().check();
  await page.getByTestId("mock-item-list").getByRole("button", { name: /^Item 20,/ }).click();
  await page.locator("[data-mock-item-options] input").first().check();

  const created = await page.evaluate(
    () => (window as unknown as { __workerCounter: { created: number } }).__workerCounter.created
  );
  expect(created, "The mock exam constructed a worker").toBe(0);
});
