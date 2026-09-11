/**
 * The two halves of a domain's self-check: the notes' own recall prompts, and a scored quiz.
 *
 * They are deliberately separate things. Recall prompts are self-graded — the candidate decides
 * whether they knew it — and contribute nothing to readiness. The quiz is scored by the same rule
 * the mock uses and is the only half that counts (FR-041).
 *
 * A quiz's length is not chosen here. It is that domain's share of a full mock, read from
 * `site/src/data/mock.json`, which the drill engine's apportionment produced (FR-040). Quiz lengths
 * therefore differ between domains exactly as the exam weights do: seventeen items for Applications
 * and Integration, one for Eval, Testing, and Debugging.
 */

import type { PracticeItem } from "./items";

/** One prompt from a domain's `self-check.md`, kept with the sub-skill it sits under. */
export interface RecallPrompt {
  /** Stable within a domain: the sub-skill slug and the prompt's position under it. */
  id: string;
  subSkill: string;
  prompt: string;
}

const HEADING = /^##\s+(.+?)\s*$/;
const NUMBERED_PROMPT = /^(\d+)\.\s+(.*)$/;

/**
 * Read a domain's recall prompts out of its `self-check.md` body.
 *
 * The note is the source: this parses what is written there rather than holding a copy, which is
 * what keeps FR-039 and the single-source rule true at the same time. A prompt wrapped across
 * several lines is rejoined, because the repository wraps its prose at 100 columns.
 */
export function parseRecallPrompts(markdown: string): RecallPrompt[] {
  const prompts: RecallPrompt[] = [];
  let subSkill: string | null = null;
  let current: RecallPrompt | null = null;

  const flush = (): void => {
    if (current !== null) {
      prompts.push({ ...current, prompt: current.prompt.trim() });
      current = null;
    }
  };

  for (const rawLine of markdown.split(/\r?\n/)) {
    const heading = HEADING.exec(rawLine);
    if (heading !== null) {
      flush();
      subSkill = heading[1];
      continue;
    }
    if (subSkill === null) {
      continue;
    }

    const numbered = NUMBERED_PROMPT.exec(rawLine.trim());
    if (numbered !== null && !rawLine.startsWith(" ")) {
      flush();
      current = {
        id: `${slugify(subSkill)}-${numbered[1]}`,
        subSkill,
        prompt: numbered[2]
      };
      continue;
    }

    if (current !== null) {
      if (rawLine.trim().length === 0) {
        flush();
      } else {
        current.prompt = `${current.prompt} ${rawLine.trim()}`;
      }
    }
  }
  flush();
  return prompts;
}

/** How many items a domain's quiz asks for: that domain's share of a full mock (FR-040). */
export function quizLength(quotas: Readonly<Record<string, number>>, domainName: string): number {
  return quotas[domainName] ?? 0;
}

/** The bank items belonging to one domain, in the exporter's order. */
export function itemsForDomain(
  bank: readonly PracticeItem[],
  domainName: string
): PracticeItem[] {
  return bank.filter((item) => item.domain === domainName);
}

/** Why a domain's quiz cannot be offered in full, when it cannot. */
export interface QuizAvailability {
  asked: number;
  available: number;
  /** True when the bank holds fewer items than the quiz asks for (FR-042). */
  short: boolean;
}

/** Compare what a domain's quiz asks for against what its bank actually holds. */
export function quizAvailability(
  bank: readonly PracticeItem[],
  quotas: Readonly<Record<string, number>>,
  domainName: string
): QuizAvailability {
  const asked = quizLength(quotas, domainName);
  const available = itemsForDomain(bank, domainName).length;
  return { asked, available, short: available < asked };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
