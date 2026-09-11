import { describe, expect, it } from "vitest";

import itemsData from "../../src/data/items.json";
import mockData from "../../src/data/mock.json";
import {
  itemsForDomain,
  parseRecallPrompts,
  quizAvailability,
  quizLength
} from "../../src/lib/quiz";
import type { PracticeItem } from "../../src/lib/items";

const bank = itemsData.items as PracticeItem[];
const quotas = mockData.quotas as Record<string, number>;

describe("a domain quiz asks for that domain's share of a full mock", () => {
  it("takes its length from the exported quotas, never from a number in the site", () => {
    for (const [domain, quota] of Object.entries(quotas)) {
      expect(quizLength(quotas, domain)).toBe(quota);
    }
  });

  it("makes quizzes visibly unequal, as the exam weights are", () => {
    // These are the drill engine's own figures for a 53-item mock; the point of the assertion is
    // that the heaviest domain asks for many times what the lightest does.
    expect(quizLength(quotas, "Applications and Integration")).toBe(17);
    expect(quizLength(quotas, "Eval, Testing, and Debugging")).toBe(1);
    expect(quizLength(quotas, "Applications and Integration")).toBeGreaterThan(
      quizLength(quotas, "Claude Code")
    );
  });

  it("draws only from the domain it belongs to", () => {
    for (const domain of Object.keys(quotas)) {
      const items = itemsForDomain(bank, domain);
      expect(items.every((item) => item.domain === domain)).toBe(true);
      expect(items.length).toBeGreaterThan(0);
    }
  });

  it("reports a domain whose bank cannot fill its quiz", () => {
    const thin: PracticeItem[] = itemsForDomain(bank, "Claude Code").slice(0, 1);

    expect(quizAvailability(thin, { "Claude Code": 2 }, "Claude Code")).toEqual({
      asked: 2,
      available: 1,
      short: true
    });
    expect(quizAvailability(bank, quotas, "Claude Code").short).toBe(false);
  });

  it("reports an unknown domain as asking for nothing rather than throwing", () => {
    expect(quizAvailability(bank, quotas, "Not A Domain")).toEqual({
      asked: 0,
      available: 0,
      short: false
    });
  });
});

describe("recall prompts are read from the note, not held as a copy", () => {
  const markdown = [
    "---",
    'domain_name: "Model Selection and Optimization"',
    "---",
    "",
    "# Self-check",
    "",
    "Answer from memory before looking.",
    "",
    "## Technical Fundamentals",
    "",
    "1. Which single endpoint carries tool use, structured output, caching, thinking, and",
    "   vision?",
    "2. Name four things an official SDK gives you.",
    "",
    "## LLM Fundamentals",
    "",
    "1. What replaced `budget_tokens` on current models?"
  ].join("\n");

  it("keeps each prompt under the sub-skill heading it sits below", () => {
    const prompts = parseRecallPrompts(markdown);

    expect(prompts).toHaveLength(3);
    expect(prompts[0].subSkill).toBe("Technical Fundamentals");
    expect(prompts[2].subSkill).toBe("LLM Fundamentals");
  });

  it("rejoins a prompt the repository wrapped at 100 columns", () => {
    const prompts = parseRecallPrompts(markdown);

    expect(prompts[0].prompt).toBe(
      "Which single endpoint carries tool use, structured output, caching, thinking, and vision?"
    );
  });

  it("gives each prompt an identifier that is stable within its domain", () => {
    const prompts = parseRecallPrompts(markdown);

    expect(prompts.map((entry) => entry.id)).toEqual([
      "technical-fundamentals-1",
      "technical-fundamentals-2",
      "llm-fundamentals-1"
    ]);
    expect(new Set(prompts.map((entry) => entry.id)).size).toBe(prompts.length);
  });

  it("returns nothing for a note that has no prompts, rather than inventing one", () => {
    expect(parseRecallPrompts("# Self-check\n\nNothing here yet.\n")).toEqual([]);
    expect(parseRecallPrompts("")).toEqual([]);
  });
});
