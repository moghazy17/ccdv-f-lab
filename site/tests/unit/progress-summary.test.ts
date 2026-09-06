import { describe, expect, test } from "vitest";

import { escapeHtml, formatPlanMarks } from "../../src/lib/progress-summary";

describe("progress summary rendering", () => {
  test("renders hostile import values as inert text", () => {
    const updatedAt = '<img src=x onerror="window.importedPayloadRan=true">';
    const planSlug = '<img src=x onerror="window.importedPayloadRan=true">';
    const planMarks = formatPlanMarks({
      updatedAt,
      schemaVersion: 1,
      plans: [{ planSlug, count: 1, domainNumbers: [1] }],
      totalMarks: 1,
      hasDiagnostic: false,
      theme: "system"
    });

    expect(escapeHtml(updatedAt)).toContain("&lt;img");
    expect(escapeHtml(updatedAt)).not.toContain("<img");
    expect(planMarks).toContain("&lt;img");
    expect(planMarks).not.toContain("<img");
  });
});
