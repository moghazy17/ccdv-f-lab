import { describe, expect, test } from "vitest";

import { parseStudyPlanMarkdown } from "../../src/lib/plans";
import {
  computePlanCompletion,
  getPlanMarks,
  getStoredDiagnostic,
  isDomainMarked,
  storageErrorMessage
} from "../../src/lib/progress";
import { emptyProgress } from "../../src/lib/storage";

describe("progress module", () => {
  const samplePlanMarkdown = `
# Three-week study plan
This schedule assumes **42.000 total hours**

| Domain | Weight | Hours |
|---|---:|---:|
| Agents and Workflows | 14.7% | 6.174 |
| Applications and Integration | 33.1% | 13.902 |
| Claude Code | 3.1% | 1.302 |
| Eval, Testing, and Debugging | 2.6% | 1.092 |
| Model Selection and Optimization | 16.8% | 7.056 |
| Prompt and Context Engineering | 11.0% | 4.620 |
| Security and Safety | 8.1% | 3.402 |
| Tools and MCPs | 10.6% | 4.452 |
| **Total** | **100%** | **42.000** |
`;
  const plan = parseStudyPlanMarkdown("3-weeks", samplePlanMarkdown);

  test("calculates plan completion totals for 0 marks", () => {
    const completion = computePlanCompletion(plan, []);
    expect(completion.completedDomains).toBe(0);
    expect(completion.totalDomains).toBe(8);
    expect(completion.completedHours).toBe(0);
    expect(completion.totalHours).toBe(42);
    expect(completion.domainsPercentage).toBe(0);
    expect(completion.hoursPercentage).toBe(0);
  });

  test("calculates plan completion totals for marked domains (domains 2 and 5)", () => {
    // Domain 2 = 13.902, Domain 5 = 7.056 -> total = 20.958
    const completion = computePlanCompletion(plan, [2, 5]);
    expect(completion.completedDomains).toBe(2);
    expect(completion.totalDomains).toBe(8);
    expect(completion.completedHours).toBe(20.958);
    expect(completion.totalHours).toBe(42);
    expect(completion.domainsPercentage).toBe(25);
    expect(completion.hoursPercentage).toBe(50);
  });

  test("reads plan marks safely from progress envelope", () => {
    const envelope = emptyProgress("2026-09-05T10:00:00.000Z");
    envelope.namespaces.foundation.planMarks["3-weeks"] = [2, 5];

    expect(getPlanMarks(envelope, "3-weeks")).toEqual([2, 5]);
    expect(getPlanMarks(envelope, "1-week")).toEqual([]);
    expect(isDomainMarked(envelope, "3-weeks", 2)).toBe(true);
    expect(isDomainMarked(envelope, "3-weeks", 1)).toBe(false);
  });

  test("returns null for absent diagnostic response", () => {
    const envelope = emptyProgress("2026-09-05T10:00:00.000Z");
    expect(getStoredDiagnostic(envelope)).toBeNull();
  });

  test("returns friendly error messages for storage states", () => {
    expect(storageErrorMessage({ kind: "unavailable" })).toMatch(/storage is unavailable/i);
    expect(storageErrorMessage({ kind: "write-failed" })).toMatch(/quota exceeded/i);
    expect(storageErrorMessage({ kind: "malformed" })).toMatch(/malformed/i);
    expect(storageErrorMessage({ kind: "newer-version" })).toMatch(/newer version/i);
    expect(storageErrorMessage({ kind: "ok" })).toBeNull();
  });
});
