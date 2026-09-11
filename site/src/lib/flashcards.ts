/**
 * Flashcard deck parsing and Leitner scheduling.
 *
 * The generated TSV is the source of card text and source-position identifiers. This module keeps
 * review state keyed only by the `Card:` tag, so repeated fronts never share a schedule and a deck
 * regeneration can drop only the identifiers it no longer contains.
 */

import type { FlashcardState } from "./storage";

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  domain: string;
  subSkill: string;
}

export type FlashcardOutcome = "known" | "unknown";

export const LEITNER_INTERVALS: Readonly<Record<number, number>> = {
  1: 0,
  2: 24 * 60 * 60 * 1000,
  3: 3 * 24 * 60 * 60 * 1000,
  4: 7 * 24 * 60 * 60 * 1000,
  5: 21 * 24 * 60 * 60 * 1000
};

/** Parse the two-column generated deck, rejecting incomplete or duplicated identities. */
export function parseFlashcardDeck(tsv: string): Flashcard[] {
  const cards: Flashcard[] = [];
  const identifiers = new Set<string>();

  for (const [index, row] of tsv.split(/\r?\n/).entries()) {
    if (row.length === 0) {
      continue;
    }
    const cells = row.split("\t");
    if (cells.length !== 2) {
      throw new Error(`Flashcard row ${index + 1} must have exactly two columns.`);
    }
    const front = decodeCell(cells[0]);
    const taggedBack = decodeCell(cells[1]);
    const domain = tagValue(taggedBack, "Domain", index);
    const subSkill = tagValue(taggedBack, "Sub-skill", index);
    const id = tagValue(taggedBack, "Card", index);
    if (identifiers.has(id)) {
      throw new Error(`Flashcard row ${index + 1} repeats Card: ${id}.`);
    }
    identifiers.add(id);
    cards.push({
      id,
      front,
      back: answerText(taggedBack, domain, subSkill, id, index),
      domain,
      subSkill
    });
  }
  return cards;
}

/** Return only schedule entries whose identifiers survive in the present generated deck. */
export function pruneFlashcardState(
  state: Readonly<Record<string, FlashcardState>>,
  cards: readonly Flashcard[]
): Record<string, FlashcardState> {
  const identifiers = new Set(cards.map((card) => card.id));
  return Object.fromEntries(Object.entries(state).filter(([id]) => identifiers.has(id)));
}

/** Move one card through the five-box Leitner schedule after the candidate self-grades it. */
export function reviewFlashcard(
  state: FlashcardState | undefined,
  outcome: FlashcardOutcome,
  now: Date
): FlashcardState {
  const previousBox = validBox(state?.box) ? state.box : 1;
  const box = outcome === "known" ? Math.min(previousBox + 1, 5) : 1;
  return { box, dueAt: new Date(now.getTime() + LEITNER_INTERVALS[box]).toISOString() };
}

/** Return cards due in order, with never-reviewed cards due in the same session. */
export function dueFlashcards(
  cards: readonly Flashcard[],
  state: Readonly<Record<string, FlashcardState>>,
  now: Date
): Flashcard[] {
  const time = now.getTime();
  return cards
    .map((card, index) => ({ card, index, due: dueTime(state[card.id]) }))
    .filter((entry) => entry.due === null || entry.due <= time)
    .sort(
      (left, right) =>
        (left.due ?? -Infinity) - (right.due ?? -Infinity) || left.index - right.index
    )
    .map((entry) => entry.card);
}

/** Find the earliest future review time when no card remains due. */
export function nextDueAt(
  cards: readonly Flashcard[],
  state: Readonly<Record<string, FlashcardState>>,
  now: Date
): Date | null {
  const future = cards
    .map((card) => dueTime(state[card.id]))
    .filter((time): time is number => time !== null && time > now.getTime());
  return future.length === 0 ? null : new Date(Math.min(...future));
}

function decodeCell(value: string): string {
  return value.replaceAll("<br>", "\n");
}

function tagValue(back: string, name: string, index: number): string {
  const match = new RegExp(`^${name}: (.+)$`, "m").exec(back);
  if (match === null || match[1].trim().length === 0) {
    throw new Error(`Flashcard row ${index + 1} has no ${name}: tag.`);
  }
  return match[1].trim();
}

function answerText(
  back: string,
  domain: string,
  subSkill: string,
  id: string,
  index: number
): string {
  const tagBlock = `\n\nDomain: ${domain}\nSub-skill: ${subSkill}\nCard: ${id}`;
  if (!back.endsWith(tagBlock)) {
    throw new Error(`Flashcard row ${index + 1} tags must form the final block.`);
  }
  return back.slice(0, -tagBlock.length);
}

function dueTime(state: FlashcardState | undefined): number | null {
  if (state === undefined) {
    return null;
  }
  const time = Date.parse(state.dueAt);
  return Number.isNaN(time) ? null : time;
}

function validBox(box: number | undefined): box is number {
  return box !== undefined && Number.isInteger(box) && box >= 1 && box <= 5;
}
