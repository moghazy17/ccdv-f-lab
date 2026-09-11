import { expect, test } from "@playwright/test";

const STORAGE_KEY = "ccdv-f:progress";

async function currentCardId(page: import("@playwright/test").Page): Promise<string> {
  const cardId = await page.locator("[data-flashcard-id]").textContent();
  if (cardId === null) {
    throw new Error("The current flashcard did not render an identifier.");
  }
  return cardId;
}

test.describe("Review flashcards (US4)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("./flashcards/");
    await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
    await page.reload();
  });

  test("Space activates a focused known button instead of replaying the reveal shortcut", async ({
    page
  }) => {
    const deck = page.locator("[data-flashcard-deck]");
    const cardId = await currentCardId(page);

    await deck.focus();
    await page.keyboard.press("Space");
    await expect(page.locator("[data-flashcard-back]")).toBeVisible();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "I knew it" })).toBeFocused();
    await page.keyboard.press("Space");

    const stored = await page.evaluate(
      ([key, id]) => JSON.parse(localStorage.getItem(key) ?? "{}").namespaces.flashcards.state[id],
      [STORAGE_KEY, cardId] as const
    );
    expect(stored.box).toBe(2);
    await expect(page.locator("[data-flashcard-back]")).toBeHidden();
  });

  test("documented shortcuts work from the focusable deck container", async ({ page }) => {
    const deck = page.locator("[data-flashcard-deck]");
    const cardId = await currentCardId(page);

    await deck.focus();
    await page.keyboard.press("Space");
    await expect(page.locator("[data-flashcard-back]")).toBeVisible();
    await page.keyboard.press("KeyK");

    const stored = await page.evaluate(
      ([key, id]) => JSON.parse(localStorage.getItem(key) ?? "{}").namespaces.flashcards.state[id],
      [STORAGE_KEY, cardId] as const
    );
    expect(stored.box).toBe(2);
  });

  test("a card can be revealed and graded with the keyboard alone", async ({ page }) => {
    const deck = page.locator("[data-flashcard-deck]");

    await deck.focus();
    await page.keyboard.press("Space");
    await expect(page.locator("[data-flashcard-back]")).toBeVisible();
    await page.keyboard.press("KeyU");

    await expect(page.locator("[data-flashcard-status]")).toContainText("Marked not known");
  });
});
