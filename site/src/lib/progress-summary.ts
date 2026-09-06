import type { RecordSummary } from "./transfer";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatPlanMarks(summary: RecordSummary): string {
  if (summary.plans.length === 0) {
    return "No plan marks recorded";
  }
  return summary.plans
    .map(
      (plan) =>
        `${escapeHtml(plan.planSlug)}: Domain${plan.domainNumbers.length > 1 ? "s" : ""} ${plan.domainNumbers.join(", ")} (${plan.count} of 8 domains)`
    )
    .join("; ");
}
