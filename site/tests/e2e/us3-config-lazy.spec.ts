import { expect, test } from "@playwright/test";

test("configuration generation, copying, and downloading do not fetch the runtime", async ({ page }) => {
  const runtimeRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/runtime/")) runtimeRequests.push(request.url());
  });
  await page.goto("./claude-code/config/");
  await page.getByRole("button", { name: "Generate files" }).click();
  await page.getByRole("button", { name: "Copy CLAUDE.md" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download CLAUDE.md" }).click();
  await download;
  expect(runtimeRequests).toEqual([]);
  await expect(page.getByText(/runtime has not been downloaded/i)).toBeVisible();
});
