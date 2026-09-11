/**
 * Assembling a mock, keeping its clock, and bounding what a candidate's device retains.
 *
 * Nothing here computes a quota. The per-domain counts arrive from `site/src/data/mock.json`,
 * which `tools/export_mock_data.py` writes by calling the repository's own
 * `drills.engine.mock.apportion_items` (FR-024). This module only draws items to fill counts it is
 * handed, and says plainly when a domain cannot be filled rather than borrowing from another.
 *
 * The clock is wall-clock, not elapsed-on-screen: an attempt stores the absolute instant it must
 * end, so closing the tab, reloading, or restarting the browser cannot buy time (FR-027).
 */

import type { PracticeItem } from "./items";
import type { DomainScore, MockAttempt, ScoreReport, ScoreSummary } from "./storage";
import type { ScoreOutcome } from "./scoring";

/** The build-time mock contract, exactly as `tools/export_mock_data.py` emits it. */
export interface MockData {
  sourceDigest: string;
  generatedFrom: string;
  fullMockSize: number;
  timeLimitMinutes: number;
  passingScore: number;
  scaleMinimum: number;
  scaleMaximum: number;
  quotas: Record<string, number>;
}

/** How many full reports a device keeps before the oldest is reduced to a summary. */
export const MAX_RETAINED_REPORTS = 3;

/** One domain the bank cannot fill to its quota (FR-035). */
export interface DomainShortfall {
  domain: string;
  quota: number;
  available: number;
}

/** The outcome of assembling one mock from the bank. */
export interface AssembledMock {
  items: PracticeItem[];
  shortfalls: DomainShortfall[];
}

/** A source of randomness, injected so tests can assemble a mock deterministically. */
export type Random = () => number;

/**
 * Draw each domain's quota from the bank, in published domain order.
 *
 * A domain with too few items contributes everything it has and is reported as a shortfall. No
 * item is ever taken from another domain to reach the mock's size — that would silently
 * misrepresent the weighting the whole exercise is about.
 */
export function assembleMock(
  bank: readonly PracticeItem[],
  quotas: Readonly<Record<string, number>>,
  random: Random = Math.random
): AssembledMock {
  const byDomain = new Map<string, PracticeItem[]>();
  for (const item of bank) {
    const existing = byDomain.get(item.domain);
    if (existing === undefined) {
      byDomain.set(item.domain, [item]);
    } else {
      existing.push(item);
    }
  }

  const items: PracticeItem[] = [];
  const shortfalls: DomainShortfall[] = [];
  for (const [domain, quota] of Object.entries(quotas)) {
    const candidates = byDomain.get(domain) ?? [];
    const drawn = sample(candidates, Math.min(quota, candidates.length), random);
    if (drawn.length < quota) {
      shortfalls.push({ domain, quota, available: candidates.length });
    }
    items.push(...drawn);
  }
  return { items, shortfalls };
}

/**
 * Whether repeated attempts must draw the same items because no domain holds a surplus (FR-036).
 */
export function hasNoSurplus(
  available: Readonly<Record<string, number>>,
  quotas: Readonly<Record<string, number>>
): boolean {
  return Object.entries(quotas).every(([domain, quota]) => (available[domain] ?? 0) <= quota);
}

/** Start an attempt, fixing the instant it must end from the blueprint's own time limit. */
export function createAttempt(
  items: readonly PracticeItem[],
  timeLimitMinutes: number,
  now: Date,
  id: string
): MockAttempt {
  return {
    id,
    items: [...items],
    answers: {},
    startedAt: now.toISOString(),
    deadlineAt: new Date(now.getTime() + timeLimitMinutes * 60_000).toISOString(),
    submittedAt: null,
    expiryHandled: false
  };
}

/** Milliseconds left before the deadline, never negative. */
export function remainingMs(attempt: MockAttempt, now: Date): number {
  return Math.max(0, Date.parse(attempt.deadlineAt) - now.getTime());
}

/** Whether the deadline has passed. An expired attempt is never resumed or scored silently. */
export function isExpired(attempt: MockAttempt, now: Date): boolean {
  return remainingMs(attempt, now) === 0;
}

/** Render remaining time as `H:MM:SS`, or `MM:SS` under an hour. */
export function formatRemaining(milliseconds: number): string {
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedSeconds = String(seconds).padStart(2, "0");
  if (hours === 0) {
    return `${minutes}:${paddedSeconds}`;
  }
  return `${hours}:${String(minutes).padStart(2, "0")}:${paddedSeconds}`;
}

/**
 * A spoken form of the remaining time, announced at intervals rather than every second (FR-025).
 * Screen-reader users get "about 45 minutes remaining", not a stream of ticking digits.
 */
export function announceRemaining(milliseconds: number): string {
  const totalMinutes = Math.floor(Math.max(0, milliseconds) / 60_000);
  if (totalMinutes < 1) {
    return "Less than a minute remaining.";
  }
  if (totalMinutes === 1) {
    return "About 1 minute remaining.";
  }
  return `About ${totalMinutes} minutes remaining.`;
}

/** Identifiers of the items with no selection yet, so a candidate can find what is left. */
export function unansweredItemIds(attempt: MockAttempt): string[] {
  return attempt.items
    .filter((item) => (attempt.answers[item.id] ?? []).length === 0)
    .map((item) => item.id);
}

/** Build the stored report for a scored attempt, keeping an explanation for every wrong answer. */
export function buildReport(
  attempt: MockAttempt,
  outcome: ScoreOutcome,
  submittedAt: Date,
  timeRanOut = false
): ScoreReport {
  const domainScores: Record<string, DomainScore> = {};
  for (const domain of outcome.domains) {
    domainScores[domain.name] = { correct: domain.correct, itemCount: domain.itemCount };
  }

  return {
    attemptId: attempt.id,
    submittedAt: submittedAt.toISOString(),
    correct: outcome.correct,
    itemCount: outcome.itemCount,
    domainScores,
    ready: outcome.ready,
    lowDomains: outcome.lowDomains,
    unassessedDomains: outcome.unassessedDomains,
    timeRanOut,
    items: attempt.items.map((item) => {
      const selected = attempt.answers[item.id] ?? [];
      const correct = item.options.filter((option) => option.correct).map((option) => option.id);
      const isCorrect =
        selected.length === correct.length && selected.every((id) => correct.includes(id));
      return {
        itemId: item.id,
        selected: [...selected],
        correct,
        isCorrect,
        // FR-032: the explanation for a wrong answer is the rationale of every option, so a
        // candidate learns why their choice failed as well as why the right one holds.
        rationale: item.options
          .map((option) => `${option.id}. ${option.rationale}`)
          .join("\n")
      };
    })
  };
}

/** Reduce a full report to the trend that outlives it (contracts/progress-record.md). */
export function summarise(report: ScoreReport): ScoreSummary {
  return {
    attemptId: report.attemptId,
    submittedAt: report.submittedAt,
    correct: report.correct,
    itemCount: report.itemCount,
    domainScores: report.domainScores,
    ready: report.ready,
    lowDomains: report.lowDomains,
    unassessedDomains: report.unassessedDomains,
    timeRanOut: report.timeRanOut,
    detailDropped: true
  };
}

/**
 * Add one report, keeping at most three in full.
 *
 * A fourth does not evict the oldest, it demotes it: the oldest full report becomes a summary and
 * joins `summaries`, so the per-domain trend survives while the ≈84 KiB item snapshot does not.
 */
export function retainReports(
  reports: readonly ScoreReport[],
  summaries: readonly ScoreSummary[],
  report: ScoreReport
): { reports: ScoreReport[]; summaries: ScoreSummary[] } {
  const nextReports = [report, ...reports];
  const nextSummaries = [...summaries];
  while (nextReports.length > MAX_RETAINED_REPORTS) {
    const demoted = nextReports.pop();
    if (demoted !== undefined) {
      nextSummaries.unshift(summarise(demoted));
    }
  }
  return { reports: nextReports, summaries: nextSummaries };
}

/** Draw `count` distinct entries using a Fisher-Yates partial shuffle over a copy. */
function sample<T>(source: readonly T[], count: number, random: Random): T[] {
  const pool = [...source];
  const drawn: T[] = [];
  for (let index = 0; index < count && pool.length > 0; index += 1) {
    const chosen = Math.floor(random() * pool.length) % pool.length;
    drawn.push(pool[chosen]);
    pool.splice(chosen, 1);
  }
  return drawn;
}
