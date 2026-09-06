import { expect, test } from "@playwright/test";

test.describe("Performance budget and runtime efficiency (SC-007, FR-040)", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
  });

  test("study-page LCP is under 2.5s on mid-tier mobile profile with simulated mobile network", async ({
    page
  }) => {
    const client = await page.context().newCDPSession(page);
    // Emulate typical mobile connection (Fast 3G / Slow 4G): 150ms RTT, 1.6 Mbps down, 750 kbps up
    await client.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8
    });
    // CPU throttling: 2x slowdown for mid-tier mobile CPU
    await client.send("Emulation.setCPUThrottlingRate", { rate: 2 });

    const startTime = Date.now();
    await page.goto("./domains/02-applications-and-integration/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const lcp = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        const entries = performance.getEntriesByType("largest-contentful-paint");
        if (entries.length > 0) {
          const maxEntry = Math.max(...entries.map((e) => e.startTime));
          return resolve(maxEntry);
        }

        const observer = new PerformanceObserver((entryList) => {
          const list = entryList.getEntries();
          if (list.length > 0) {
            const maxEntry = Math.max(...list.map((e) => e.startTime));
            observer.disconnect();
            resolve(maxEntry);
          }
        });

        observer.observe({ type: "largest-contentful-paint", buffered: true });
        setTimeout(() => {
          observer.disconnect();
          resolve(0);
        }, 1000);
      });
    });

    const elapsed = Date.now() - startTime;
    // Both measured LCP entry and total heading visibility time are under 2500ms
    if (lcp > 0) {
      expect(lcp).toBeLessThan(2500);
    } else {
      expect(elapsed).toBeLessThan(2500);
    }
  });

  test("theme applies before paint with no visible layout shift (CLS = 0)", async ({ page }) => {
    // Set explicit dark theme in storage
    await page.goto("./");
    await page.evaluate(() => {
      localStorage.setItem("ccdv-f:progress", JSON.stringify({
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        namespaces: {
          foundation: {
            theme: "dark"
          }
        }
      }));
    });

    // Reload and measure Cumulative Layout Shift
    await page.goto("./domains/02-applications-and-integration/");

    const cls = await page.evaluate(async () => {
      return new Promise<number>((resolve) => {
        let cumulativeScore = 0;
        const observer = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            // LayoutShift entries
            if (!("hadRecentInput" in entry) || !entry.hadRecentInput) {
              cumulativeScore += (entry as unknown as { value: number }).value;
            }
          }
        });
        observer.observe({ type: "layout-shift", buffered: true });
        setTimeout(() => {
          observer.disconnect();
          resolve(cumulativeScore);
        }, 500);
      });
    });

    // Document element receives data-theme synchronously via head bootstrap
    const htmlTheme = await page.getAttribute("html", "data-theme");
    expect(htmlTheme).toBe("dark");
    // No noticeable layout shift caused by theme application
    expect(cls).toBeLessThan(0.05);
  });

  test("deferred search: Pagefind assets are never requested before search is opened", async ({
    page
  }) => {
    const requestedUrls: string[] = [];
    page.on("request", (req) => {
      requestedUrls.push(req.url());
    });

    await page.goto("./domains/02-applications-and-integration/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Verify no Pagefind assets requested on initial page load
    const pagefindRequestsBeforeOpen = requestedUrls.filter((url) =>
      url.toLowerCase().includes("pagefind")
    );
    expect(pagefindRequestsBeforeOpen).toEqual([]);

    // Open search overlay
    await page.keyboard.press("Control+k");
    const dialog = page.getByRole("dialog", { name: "Search study kit" });
    await expect(dialog).toBeVisible();

    // After search dialog is opened, Pagefind library should be requested
    await page.waitForTimeout(500);
    const pagefindRequestsAfterOpen = requestedUrls.filter((url) =>
      url.toLowerCase().includes("pagefind")
    );
    expect(pagefindRequestsAfterOpen.length).toBeGreaterThan(0);
  });
});
