import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

import {
  allocationsOrderedByWeight,
  parseStudyPlanMarkdown,
  validateAllPlans,
  type StudyPlan
} from "../../src/lib/plans";

describe("plans parser and validator", () => {
  const root = join(__dirname, "../../../study-plans");

  test("parses and validates 1-week, 3-weeks, and 6-weeks plans from study-plans markdown", async () => {
    const plans: StudyPlan[] = [];
    for (const slug of ["1-week", "3-weeks", "6-weeks"] as const) {
      const markdown = await readFile(join(root, `${slug}.md`), "utf-8");
      const plan = parseStudyPlanMarkdown(slug, markdown);
      expect(plan.slug).toBe(slug);
      expect(plan.allocations).toHaveLength(8);
      plans.push(plan);
    }

    validateAllPlans(plans);

    expect(plans[0].totalHours).toBe(14);
    expect(plans[1].totalHours).toBe(42);
    expect(plans[2].totalHours).toBe(84);
  });

  test("orders allocations descending by weight", async () => {
    const markdown = await readFile(join(root, "3-weeks.md"), "utf-8");
    const plan = parseStudyPlanMarkdown("3-weeks", markdown);
    const ordered = allocationsOrderedByWeight(plan.allocations);

    expect(ordered[0].domainName).toBe("Applications and Integration");
    expect(ordered[0].weight).toBe(33.1);
    expect(ordered[1].domainName).toBe("Model Selection and Optimization");
    expect(ordered[1].weight).toBe(16.8);
    expect(ordered[7].domainName).toBe("Eval, Testing, and Debugging");
    expect(ordered[7].weight).toBe(2.6);
  });

  test("rejects drifted allocation hours", () => {
    const driftedMarkdown = `
# One-week study plan
This schedule assumes **14.000 total hours**

| Domain | Weight | Hours |
|---|---:|---:|
| Agents and Workflows | 14.7% | 9.999 |
| Applications and Integration | 33.1% | 4.634 |
| Claude Code | 3.1% | 0.434 |
| Eval, Testing, and Debugging | 2.6% | 0.364 |
| Model Selection and Optimization | 16.8% | 2.352 |
| Prompt and Context Engineering | 11.0% | 1.540 |
| Security and Safety | 8.1% | 1.134 |
| Tools and MCPs | 10.6% | 1.484 |
| **Total** | **100%** | **14.000** |
`;
    expect(() => parseStudyPlanMarkdown("1-week", driftedMarkdown)).toThrow(/does not match expected allocation/i);
  });

  test("rejects drifted total hours", () => {
    const driftedMarkdown = `
# One-week study plan
This schedule assumes **15.000 total hours**

| Domain | Weight | Hours |
|---|---:|---:|
| Agents and Workflows | 14.7% | 2.058 |
| Applications and Integration | 33.1% | 4.634 |
| Claude Code | 3.1% | 0.434 |
| Eval, Testing, and Debugging | 2.6% | 0.364 |
| Model Selection and Optimization | 16.8% | 2.352 |
| Prompt and Context Engineering | 11.0% | 1.540 |
| Security and Safety | 8.1% | 1.134 |
| Tools and MCPs | 10.6% | 1.484 |
| **Total** | **100%** | **14.000** |
`;
    expect(() => parseStudyPlanMarkdown("1-week", driftedMarkdown)).toThrow(/does not match expected allocation/i);
  });
});
