import { expect, test } from "@playwright/test";

/**
 * Relative luminance per WCAG 2.1, so this file can assert that a colour is dark or light without
 * naming it. Pinning the dark theme's exact values made a palette change fail a test about print.
 */
function luminance(color: string): number {
  const [red, green, blue] = color.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number);
  const channel = (value: number) => {
    const ratio = value / 255;
    return ratio <= 0.03928 ? ratio / 12.92 : ((ratio + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

test.describe("US5 - Print stylesheet and print shell behavior", () => {
  test("forces light presentation in print even when dark theme is active", async ({ page }) => {
    await page.goto("./cheatsheets/02-applications-and-integration/");

    // Switch to dark theme
    const themeSelect = page.locator("#theme-preference");
    await themeSelect.selectOption("dark");

    // In screen media with dark theme, body background is dark and text is light
    const screenBg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
    const screenColor = await page.evaluate(() => window.getComputedStyle(document.body).color);
    expect(luminance(screenBg), `dark theme background was ${screenBg}`).toBeLessThan(0.1);
    expect(luminance(screenColor), `dark theme text was ${screenColor}`).toBeGreaterThan(0.5);

    // Emulate print media
    await page.emulateMedia({ media: "print" });

    // Under print media, background must be white and text must be black/dark
    const printBg = await page.evaluate(() => window.getComputedStyle(document.body).backgroundColor);
    const printColor = await page.evaluate(() => window.getComputedStyle(document.body).color);
    expect(printBg).toBe("rgb(255, 255, 255)");
    expect(printColor).toBe("rgb(0, 0, 0)");
  });

  test("hides navigation, theme controls, breadcrumbs, buttons, and search controls in print", async ({ page }) => {
    await page.goto("./cheatsheets/01-agents-and-workflows/");

    // On screen, navigation and controls are visible
    await expect(page.locator(".site-header")).toBeVisible();
    await expect(page.locator(".site-nav")).toBeVisible();
    await expect(page.locator(".theme-toggle")).toBeVisible();

    // Emulate print media
    await page.emulateMedia({ media: "print" });

    // In print media, controls must be hidden
    await expect(page.locator(".site-header")).toBeHidden();
    await expect(page.locator(".site-nav")).toBeHidden();
    await expect(page.locator(".theme-toggle")).toBeHidden();
    await expect(page.locator(".skip-link")).toBeHidden();
    await expect(page.locator(".breadcrumb")).toBeHidden();
    await expect(page.locator("button")).toBeHidden();

    // Verify computed display style is 'none'
    const headerDisplay = await page.locator(".site-header").evaluate((el) => window.getComputedStyle(el).display);
    const navDisplay = await page.locator(".site-nav").evaluate((el) => window.getComputedStyle(el).display);
    const toggleDisplay = await page.locator(".theme-toggle").evaluate((el) => window.getComputedStyle(el).display);
    expect(headerDisplay).toBe("none");
    expect(navDisplay).toBe("none");
    expect(toggleDisplay).toBe("none");
  });

  test("preserves intact table rows and repeats table headers across page breaks", async ({ page }) => {
    await page.goto("./cheatsheets/02-applications-and-integration/");

    // Emulate print media
    await page.emulateMedia({ media: "print" });

    // Table rows must avoid breaks inside
    const rows = page.locator("tr");
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const breakInside = await row.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.breakInside || (style as unknown as Record<string, string>)["pageBreakInside"];
      });
      expect(breakInside).toBe("avoid");
    }

    // Table headers must repeat on subsequent pages
    const headers = page.locator("thead");
    const headerCount = await headers.count();
    expect(headerCount).toBeGreaterThan(0);

    for (let i = 0; i < headerCount; i++) {
      const thead = headers.nth(i);
      const display = await thead.evaluate((el) => window.getComputedStyle(el).display);
      expect(display).toBe("table-header-group");
    }

    // Table scroll containers must not clip or overflow in print
    const tableScrollContainers = page.locator(".table-scroll");
    const containerCount = await tableScrollContainers.count();
    for (let i = 0; i < containerCount; i++) {
      const container = tableScrollContainers.nth(i);
      const overflow = await container.evaluate((el) => window.getComputedStyle(el).overflow);
      expect(overflow).toBe("visible");
    }
  });

  test("displays study content in full and shows domain name, weight, and attribution in print", async ({ page }) => {
    await page.goto("./cheatsheets/02-applications-and-integration/");

    await page.emulateMedia({ media: "print" });

    // Study content tables are visible
    await expect(page.getByRole("heading", { level: 2, name: "Blueprint allocation", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Sub-skills", exact: true })).toBeVisible();

    // Domain name and weight appear
    await expect(page.getByText("Applications and Integration").first()).toBeVisible();
    await expect(page.getByText("33.1%").first()).toBeVisible();

    // Licence and unofficial attribution appear on the printed page
    const attribution = page.locator(".print-attribution, .site-footer");
    await expect(attribution.first()).toBeVisible();
    await expect(attribution.first()).toContainText(/unofficial and not affiliated/i);
    await expect(attribution.first()).toContainText(/CC BY 4.0/i);
  });
});
