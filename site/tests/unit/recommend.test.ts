import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, test } from "vitest";

import { extractPlanTotals, parseStudyPlanMarkdown } from "../../src/lib/plans";
import { recommend, type DiagnosticInput } from "../../src/lib/recommend";

const studyPlansDir = resolve(__dirname, "../../../study-plans");
const planTotals = extractPlanTotals(
  (["1-week", "3-weeks", "6-weeks"] as const).map((slug) =>
    parseStudyPlanMarkdown(slug, readFileSync(join(studyPlansDir, `${slug}.md`), "utf-8"))
  )
);

describe("recommendation rule", () => {
  test("recommends 1-week plan when time budget is exactly 14 hours", () => {
    const input: DiagnosticInput = {
      experience: { "02-applications-and-integration": "some", "05-model-selection-and-optimization": "some" },
      weeksAvailable: 1,
      hoursPerWeek: 14
    };
    const result = recommend(input, planTotals, "2026-09-05T10:00:00.000Z");

    expect(result.recommendedPlan).toBe("1-week");
    expect(result.source).toBe("self-report");
    expect(result.reason).toContain("14");
    expect(result.reason).not.toMatch(/score|grade|predict|passed/i);
    expect(result.completedAt).toBe("2026-09-05T10:00:00.000Z");
  });

  test("recommends 3-weeks plan when time budget is 42 hours", () => {
    const input: DiagnosticInput = {
      experience: { "02-applications-and-integration": "some", "05-model-selection-and-optimization": "none" },
      weeksAvailable: 3,
      hoursPerWeek: 14
    };
    const result = recommend(input, planTotals, "2026-09-05T10:04:11.000Z");

    expect(result.recommendedPlan).toBe("3-weeks");
    expect(result.reason).toContain("42");
  });

  test("recommends 6-weeks plan when time budget is 84 hours", () => {
    const input: DiagnosticInput = {
      experience: { "02-applications-and-integration": "strong", "05-model-selection-and-optimization": "some" },
      weeksAvailable: 6,
      hoursPerWeek: 14
    };
    const result = recommend(input, planTotals);

    expect(result.recommendedPlan).toBe("6-weeks");
    expect(result.reason).toContain("84");
  });

  test("picks the closest plan at or below time budget", () => {
    const input: DiagnosticInput = {
      experience: { "02-applications-and-integration": "some", "05-model-selection-and-optimization": "some" },
      weeksAvailable: 4,
      hoursPerWeek: 15 // 60 hours total, between 42 (3-weeks) and 84 (6-weeks)
    };
    const result = recommend(input, planTotals);

    expect(result.recommendedPlan).toBe("3-weeks");
  });

  test("falls back to 1-week when budget is below 14 hours", () => {
    const input: DiagnosticInput = {
      experience: { "02-applications-and-integration": "some", "05-model-selection-and-optimization": "some" },
      weeksAvailable: 1,
      hoursPerWeek: 8 // 8 hours total, below 14
    };
    const result = recommend(input, planTotals);

    expect(result.recommendedPlan).toBe("1-week");
    expect(result.reason.toLowerCase()).toMatch(/starting point|fall back|closest/i);
  });

  test("biases one plan longer when experience is none in both heaviest domains", () => {
    // Heaviest domains: Domain 2 (Applications and Integration) & Domain 5 (Model Selection and Optimization)
    const base1Week: DiagnosticInput = {
      experience: {
        "02-applications-and-integration": "none",
        "05-model-selection-and-optimization": "none"
      },
      weeksAvailable: 2,
      hoursPerWeek: 10 // 20 hours -> base plan 1-week, biased to 3-weeks
    };
    const result1 = recommend(base1Week, planTotals);
    expect(result1.recommendedPlan).toBe("3-weeks");
    expect(result1.reason.toLowerCase()).toMatch(/heaviest domains|experience/i);

    const base3Weeks: DiagnosticInput = {
      experience: {
        "02-applications-and-integration": "none",
        "05-model-selection-and-optimization": "none"
      },
      weeksAvailable: 3,
      hoursPerWeek: 15 // 45 hours -> base plan 3-weeks, biased to 6-weeks
    };
    const result2 = recommend(base3Weeks, planTotals);
    expect(result2.recommendedPlan).toBe("6-weeks");

    const base6Weeks: DiagnosticInput = {
      experience: {
        "02-applications-and-integration": "none",
        "05-model-selection-and-optimization": "none"
      },
      weeksAvailable: 7,
      hoursPerWeek: 15 // 105 hours -> base plan 6-weeks, cannot bias beyond 6-weeks
    };
    const result3 = recommend(base6Weeks, planTotals);
    expect(result3.recommendedPlan).toBe("6-weeks");
  });

  test("does not bias when only one heaviest domain has none", () => {
    const input: DiagnosticInput = {
      experience: {
        "02-applications-and-integration": "none",
        "05-model-selection-and-optimization": "some"
      },
      weeksAvailable: 2,
      hoursPerWeek: 10 // 20 hours -> base plan 1-week
    };
    const result = recommend(input, planTotals);
    expect(result.recommendedPlan).toBe("1-week");
  });

  test("derives the heaviest domains from the blueprint rather than a fixed list", () => {
    const input: DiagnosticInput = {
      experience: {
        "02-applications-and-integration": "none",
        "05-model-selection-and-optimization": "none"
      },
      weeksAvailable: 2,
      hoursPerWeek: 10 // 20 hours -> base plan 1-week, biased to 3-weeks
    };
    const result = recommend(input, planTotals);
    expect(result.recommendedPlan).toBe("3-weeks");
  });

  test("names the heaviest domains from the ranked fixture in its explanation", () => {
    const changedWeights = [
      { name: "Prompt practice", slug: "prompt-practice", weight: 40 },
      { name: "Tool design", slug: "tool-design", weight: 30 },
      { name: "Other material", slug: "other-material", weight: 10 }
    ];
    const input: DiagnosticInput = {
      experience: { "prompt-practice": "none", "tool-design": "none" },
      weeksAvailable: 2,
      hoursPerWeek: 10
    };

    const result = recommend(input, planTotals, "2026-09-05T10:00:00.000Z", changedWeights);

    expect(result.reason).toContain("Prompt practice, and Tool design");
    expect(result.reason).not.toContain("Applications and Integration");
  });

  test("derives thresholds purely from the passed plan totals argument", () => {
    const customTotals = {
      "1-week": 10,
      "3-weeks": 30,
      "6-weeks": 60
    };
    const input: DiagnosticInput = {
      experience: { "02-applications-and-integration": "some", "05-model-selection-and-optimization": "some" },
      weeksAvailable: 2,
      hoursPerWeek: 16 // 32 hours total -> matches custom 3-weeks (30h) plan
    };
    const result = recommend(input, customTotals);
    expect(result.recommendedPlan).toBe("3-weeks");
    expect(result.reason).toContain("30-hour");
  });
});
