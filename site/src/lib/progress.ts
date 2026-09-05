import type { StudyPlan } from "./plans";
import type { DiagnosticResult } from "./recommend";
import {
  createProgressStorage,
  type FoundationProgress,
  type ProgressEnvelope,
  type ProgressStorage,
  type StorageResult,
  type Theme
} from "./storage";

export interface PlanCompletion {
  completedDomains: number;
  totalDomains: number;
  completedHours: number;
  totalHours: number;
  domainsPercentage: number;
  hoursPercentage: number;
}

export const STORAGE_NOTICE =
  "Your study progress is saved only in this browser on this device. No account is required.";

export const PLAN_SWITCHING_NOTICE =
  "Marks are recorded per plan. Switching plans preserves your marks for each plan separately and does not overwrite or transfer them.";

export function computePlanCompletion(
  plan: StudyPlan,
  markedDomainNumbers: readonly number[]
): PlanCompletion {
  const markedSet = new Set(markedDomainNumbers);
  const totalDomains = plan.allocations.length;
  const completedDomains = plan.allocations.filter((alloc) =>
    markedSet.has(alloc.domainNumber)
  ).length;

  const completedHoursSum = plan.allocations
    .filter((alloc) => markedSet.has(alloc.domainNumber))
    .reduce((sum, alloc) => sum + alloc.hours, 0);

  const completedHours = Number(completedHoursSum.toFixed(3));
  const totalHours = plan.totalHours;

  const domainsPercentage =
    totalDomains > 0 ? Math.round((completedDomains / totalDomains) * 100) : 0;
  const hoursPercentage =
    totalHours > 0 ? Math.round((completedHours / totalHours) * 100) : 0;

  return {
    completedDomains,
    totalDomains,
    completedHours,
    totalHours,
    domainsPercentage,
    hoursPercentage
  };
}

export function getPlanMarks(
  envelope: ProgressEnvelope | undefined | null,
  planSlug: string
): number[] {
  if (!envelope || !envelope.namespaces || !envelope.namespaces.foundation) {
    return [];
  }
  const marks = envelope.namespaces.foundation.planMarks[planSlug];
  return Array.isArray(marks) ? marks : [];
}

export function isDomainMarked(
  envelope: ProgressEnvelope | undefined | null,
  planSlug: string,
  domainNumber: number
): boolean {
  return getPlanMarks(envelope, planSlug).includes(domainNumber);
}

export function getStoredDiagnostic(
  envelope: ProgressEnvelope | undefined | null
): DiagnosticResult | null {
  if (!envelope || !envelope.namespaces || !envelope.namespaces.foundation) {
    return null;
  }
  const raw = envelope.namespaces.foundation.diagnostic;
  if (!isDiagnosticResult(raw)) {
    return null;
  }
  return raw;
}

export function getStoredTheme(
  envelope: ProgressEnvelope | undefined | null
): Theme {
  return envelope?.namespaces?.foundation?.theme ?? "system";
}

export function storageErrorMessage(result: StorageResult): string | null {
  switch (result.kind) {
    case "unavailable":
      return "Local browser storage is unavailable. Your progress cannot be saved across sessions.";
    case "write-failed":
      return "Browser storage quota exceeded. Your latest progress could not be saved.";
    case "malformed":
      return "Stored progress data is malformed and could not be read safely.";
    case "newer-version":
      return "Stored progress was written by a newer version of the study kit and cannot be modified here.";
    case "ok":
    default:
      return null;
  }
}

function isDiagnosticResult(value: unknown): value is DiagnosticResult {
  if (!value || typeof value !== "object") {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    obj.source === "self-report" &&
    typeof obj.recommendedPlan === "string" &&
    typeof obj.reason === "string" &&
    typeof obj.weeksAvailable === "number" &&
    typeof obj.hoursPerWeek === "number"
  );
}

export { createProgressStorage, type FoundationProgress, type ProgressEnvelope, type ProgressStorage };
