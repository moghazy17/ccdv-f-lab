import { describe, expect, it } from "vitest";

import fixture from "../fixtures/scoring-cases.json";
import {
  READINESS_DOMAIN_FRACTION,
  READINESS_OVERALL_FRACTION,
  isCorrect,
  scoreAttempt,
  type ScorableItem,
  type Selections
} from "../../src/lib/scoring";

/**
 * `site/src/lib/scoring.ts` is a second implementation of `drills/engine/scoring.py`, kept because
 * scoring must run in the browser on a page that carries no Python runtime. These cases and their
 * expected answers were computed by the Python engine and written by `tests/test_scoring_fixtures.py`;
 * this file replays them through the TypeScript. Neither side can change without the other failing.
 */

interface FixtureCase {
  name: string;
  mock: { items: ScorableItem[] };
  attempt: { answers: Array<{ item_id: string; selected_option_ids: string[] }> };
  expected: {
    correct: number;
    itemCount: number;
    fractionCorrect: number;
    domains: Array<{ name: string; correct: number; itemCount: number }>;
    estimatedScaledScore: number;
    scoreAnchor: number;
    scaleMinimum: number;
    scaleMaximum: number;
    unassessedDomains: string[];
    lowDomains: string[];
    ready: boolean;
  };
}

const cases = fixture.cases as FixtureCase[];
const domainNames = fixture.domainNames as string[];
const scale = {
  minimum: fixture.scale.minimum,
  maximum: fixture.scale.maximum,
  passingScore: fixture.scale.passingScore
};

function selectionsOf(testCase: FixtureCase): Selections {
  return Object.fromEntries(
    testCase.attempt.answers.map((answer) => [answer.item_id, answer.selected_option_ids])
  );
}

describe("the TypeScript scorer agrees with the repository's Python engine", () => {
  it("has fixtures generated from the engine, not written by hand", () => {
    expect(fixture.generatedFrom).toBe("drills/engine/scoring.py");
    expect(cases.length).toBeGreaterThan(0);
  });

  it("uses the same readiness bars the engine states", () => {
    expect(READINESS_OVERALL_FRACTION).toBe(fixture.readiness.overallFraction);
    expect(READINESS_DOMAIN_FRACTION).toBe(fixture.readiness.domainFraction);
  });

  for (const testCase of cases) {
    it(`scores: ${testCase.name}`, () => {
      const outcome = scoreAttempt(
        testCase.mock.items,
        selectionsOf(testCase),
        domainNames,
        scale
      );

      expect(outcome.correct).toBe(testCase.expected.correct);
      expect(outcome.itemCount).toBe(testCase.expected.itemCount);
      expect(outcome.fractionCorrect).toBeCloseTo(testCase.expected.fractionCorrect, 12);
      expect(outcome.domains).toEqual(testCase.expected.domains);
      expect(outcome.estimatedScaledScore).toBe(testCase.expected.estimatedScaledScore);
      expect(outcome.scoreAnchor).toBe(testCase.expected.scoreAnchor);
      expect(outcome.scaleMinimum).toBe(testCase.expected.scaleMinimum);
      expect(outcome.scaleMaximum).toBe(testCase.expected.scaleMaximum);
      expect(outcome.unassessedDomains).toEqual(testCase.expected.unassessedDomains);
      expect(outcome.lowDomains).toEqual(testCase.expected.lowDomains);
      expect(outcome.ready).toBe(testCase.expected.ready);
    });
  }
});

describe("exact-set matching", () => {
  const item: ScorableItem = {
    id: "multi",
    domain: domainNames[0],
    options: [
      { id: "a", correct: true },
      { id: "b", correct: false },
      { id: "c", correct: true },
      { id: "d", correct: false }
    ]
  };

  it("accepts the exact correct set in any order", () => {
    expect(isCorrect(item, ["c", "a"])).toBe(true);
  });

  it("rejects a subset, a superset, and an empty selection", () => {
    expect(isCorrect(item, ["a"])).toBe(false);
    expect(isCorrect(item, ["a", "c", "d"])).toBe(false);
    expect(isCorrect(item, [])).toBe(false);
    expect(isCorrect(item, undefined)).toBe(false);
  });

  it("rejects a selection of the right size made of wrong options", () => {
    expect(isCorrect(item, ["b", "d"])).toBe(false);
  });
});

describe("guards", () => {
  it("refuses an item whose domain is not in the blueprint", () => {
    expect(() =>
      scoreAttempt(
        [{ id: "x", domain: "Not A Domain", options: [{ id: "a", correct: true }] }],
        {},
        domainNames,
        scale
      )
    ).toThrow(/absent from the blueprint/);
  });

  it("refuses a score anchor outside the published scale", () => {
    expect(() => scoreAttempt([], {}, domainNames, scale, scale.maximum + 1)).toThrow(
      /Score anchor/
    );
  });
});
