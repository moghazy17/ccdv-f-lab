import { expect, test } from "@playwright/test";

test("terminal makes no external request and never fetches the runtime", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));

  await page.goto("./claude-code/terminal/");
  await page.locator("[data-terminal-input]").fill("/help");
  await page.locator("[data-terminal-form]").press("Enter");

  const external = requests.filter((url) => !url.startsWith("http://127.0.0.1") && !url.startsWith("http://localhost"));
  expect(external).toEqual([]);
  expect(requests.some((url) => /pyodide|runtime-worker|runtime\.ts/i.test(url))).toBe(false);
});
