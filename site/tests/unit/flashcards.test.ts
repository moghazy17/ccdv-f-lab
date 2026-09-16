import { describe, expect, it } from "vitest";

import {
  LEITNER_INTERVALS,
  dueFlashcards,
  parseFlashcardDeck,
  pruneFlashcardState,
  reviewFlashcard
} from "../../src/lib/flashcards";
import type { FlashcardState } from "../../src/lib/storage";

const now = new Date("2026-09-11T10:00:00.000Z");

describe("the five-box Leitner schedule", () => {
  it("moves known cards through all five intervals and returns an unknown card to box 1", () => {
    let state: FlashcardState | undefined;

    for (const [box, interval] of [
      [2, LEITNER_INTERVALS[2]],
      [3, LEITNER_INTERVALS[3]],
      [4, LEITNER_INTERVALS[4]],
      [5, LEITNER_INTERVALS[5]]
    ]) {
      state = reviewFlashcard(state, "known", now);
      expect(state).toEqual({ box, dueAt: new Date(now.getTime() + interval).toISOString() });
    }

    const retained = reviewFlashcard(state, "known", now);
    expect(retained).toEqual({
      box: 5,
      dueAt: new Date(now.getTime() + LEITNER_INTERVALS[5]).toISOString()
    });
    expect(reviewFlashcard(retained, "unknown", now)).toEqual({ box: 1, dueAt: now.toISOString() });
  });
});

describe("a regenerated deck", () => {
  it("drops absent identities without moving their history to a neighbouring card", () => {
    const firstDeck = parseFlashcardDeck([
      "Technical Fundamentals\tFirst card<br><br>Domain: Example<br>Sub-skill: Example" +
        "<br>Card: 05-example-one-1",
      "Technical Fundamentals\tRemoved card<br><br>Domain: Example<br>Sub-skill: Example" +
        "<br>Card: 05-example-two-1"
    ].join("\n"));
    const history = {
      "05-example-one-1": { box: 3, dueAt: "2026-09-14T10:00:00.000Z" },
      "05-example-two-1": { box: 5, dueAt: "2026-10-02T10:00:00.000Z" }
    };
    const regenerated = parseFlashcardDeck([
      "Technical Fundamentals\tRewritten first card<br><br>Domain: Example<br>Sub-skill: Example" +
        "<br>Card: 05-example-one-1",
      "Technical Fundamentals\tNeighbour card<br><br>Domain: Example<br>Sub-skill: Example" +
        "<br>Card: 05-example-three-1"
    ].join("\n"));

    const retained = pruneFlashcardState(history, regenerated);

    expect(firstDeck).toHaveLength(2);
    expect(retained).toEqual({
      "05-example-one-1": { box: 3, dueAt: "2026-09-14T10:00:00.000Z" }
    });
    expect(dueFlashcards(regenerated, retained, now).map((card) => card.id)).toEqual([
      "05-example-three-1"
    ]);
  });
});

describe("a parsed card", () => {
  it("keeps the answer separate from its generated tag block", () => {
    const [card] = parseFlashcardDeck(
      "Question\tAnswer text<br><br>Domain: Example<br>Sub-skill: Example" +
        "<br>Card: 05-example-note-1"
    );

    expect(card.back).toBe("Answer text");
    expect(card.back).not.toContain("Domain:");
    expect(card.back).not.toContain("Sub-skill:");
    expect(card.back).not.toContain("Card:");
  });
});
