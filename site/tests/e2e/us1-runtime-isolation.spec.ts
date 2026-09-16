import { expect, test } from "@playwright/test";

/**
 * FR-003, FR-004, FR-005: everything the runtime loads comes from this origin, executed code
 * cannot reach the network or a key, and the live transport fails with a message naming the mock.
 *
 * Feature 001's origin check covers pages at rest. This one covers a page that is executing code,
 * which is the only state where a third-party request could plausibly originate.
 */

const ORIGIN = "http://127.0.0.1:4321";

async function runAndReadOutput(
  page: import("@playwright/test").Page,
  source: string
): Promise<string> {
  await page.locator("[data-code-pane-source]").fill(source);
  await page.locator("[data-code-pane-run]").click();
  const status = page.locator("[data-code-pane-status]");
  await expect(status).toContainText(/Finished in|Stopped/, { timeout: 180_000 });
  return (await page.locator("[data-code-pane-output-text]").textContent()) ?? "";
}

test.describe("Executing code cannot leave the origin or reach a key (FR-003, FR-004, FR-005)", () => {
  test.slow();

  test("no request leaves the origin while a lab is running", async ({ page }) => {
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (!url.startsWith(ORIGIN) && !url.startsWith("data:") && !url.startsWith("blob:")) {
        externalRequests.push(url);
      }
    });

    await page.goto("./labs/router/");
    const output = await runAndReadOutput(page, "print('ran')");

    expect(output).toContain("ran");
    expect(externalRequests, "A running lab reached a third-party origin").toEqual([]);
  });

  test("the network primitives are gone from the execution environment", async ({ page }) => {
    await page.goto("./labs/router/");

    const output = await runAndReadOutput(
      page,
      [
        "import js",
        "",
        "for name in ('fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts'):",
        "    print(f'{name}: {hasattr(js, name)}')"
      ].join("\n")
    );

    for (const name of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts"]) {
      expect(output, `${name} is still reachable from executed code`).toContain(`${name}: False`);
    }
  });

  test("no API key is reachable from the environment", async ({ page }) => {
    await page.goto("./labs/router/");

    const output = await runAndReadOutput(
      page,
      ["import os", "", "print(f\"key present: {'ANTHROPIC_API_KEY' in os.environ}\")"].join("\n")
    );

    expect(output).toContain("key present: False");
  });

  test("asking for the live transport fails with a message naming the mock transport", async ({
    page
  }) => {
    await page.goto("./labs/transport/");

    const output = await runAndReadOutput(
      page,
      [
        "from lab.secrets import resolve_anthropic_api_key",
        "",
        "try:",
        "    resolve_anthropic_api_key({})",
        "except Exception as error:",
        "    print(type(error).__name__)",
        "    print(error)"
      ].join("\n")
    );

    expect(output.toLowerCase()).toContain("mock");
  });
});
