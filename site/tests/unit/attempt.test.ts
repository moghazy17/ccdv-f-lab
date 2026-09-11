import { describe, expect, it } from "vitest";

import {
  MAX_RETAINED_REPORTS,
  announceRemaining,
  assembleMock,
  buildReport,
  createAttempt,
  formatRemaining,
  hasNoSurplus,
  isExpired,
  remainingMs,
  retainReports,
  summarise,
  unansweredItemIds
} from "../../src/lib/attempt";
import { scoreAttempt } from "../../src/lib/scoring";
import type { PracticeItem } from "../../src/lib/items";
import type { ScoreReport } from "../../src/lib/storage";

function item(id: string, domain: string, correctIds: string[] = ["a"]): PracticeItem {
  return {
    id,
    domain,
    subSkill: "Any sub-skill",
    difficulty: "application",
    select: correctIds.length,
    stem: `Stem for ${id}`,
    options: ["a", "b", "c", "d"].map((optionId) => ({
      id: optionId,
      text: `Option ${optionId}`,
      correct: correctIds.includes(optionId),
      rationale: `Why ${optionId} is what it is.`
    })),
    sources: [{ title: "A source", url: "https://example.invalid/", verifiedOn: "2026-09-11" }]
  };
}

/** A deterministic stand-in for `Math.random`, cycling through fixed fractions. */
function sequence(values: number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length];
}

describe("assembling a mock from published quotas", () => {
  const bank = [
    item("a1", "Alpha"),
    item("a2", "Alpha"),
    item("a3", "Alpha"),
    item("b1", "Beta"),
    item("b2", "Beta")
  ];

  it("draws exactly each domain's quota, in published domain order", () => {
    const { items, shortfalls } = assembleMock(bank, { Alpha: 2, Beta: 1 }, sequence([0]));

    expect(items).toHaveLength(3);
    expect(items.slice(0, 2).every((drawn) => drawn.domain === "Alpha")).toBe(true);
    expect(items[2].domain).toBe("Beta");
    expect(shortfalls).toEqual([]);
  });

  it("never draws the same item twice", () => {
    const { items } = assembleMock(bank, { Alpha: 3, Beta: 2 }, sequence([0.9, 0.1, 0.5]));

    expect(new Set(items.map((drawn) => drawn.id)).size).toBe(items.length);
  });

  it("reports a shortfall instead of borrowing from another domain", () => {
    const { items, shortfalls } = assembleMock(bank, { Alpha: 2, Beta: 4 }, sequence([0]));

    expect(shortfalls).toEqual([{ domain: "Beta", quota: 4, available: 2 }]);
    expect(items.filter((drawn) => drawn.domain === "Beta")).toHaveLength(2);
    expect(items.filter((drawn) => drawn.domain === "Alpha")).toHaveLength(2);
  });

  it("reports a domain the bank cannot supply at all", () => {
    const { shortfalls } = assembleMock(bank, { Alpha: 1, Gamma: 2 }, sequence([0]));

    expect(shortfalls).toEqual([{ domain: "Gamma", quota: 2, available: 0 }]);
  });

  it("says when repeated attempts must draw the same items", () => {
    expect(hasNoSurplus({ Alpha: 3, Beta: 2 }, { Alpha: 3, Beta: 2 })).toBe(true);
    expect(hasNoSurplus({ Alpha: 4, Beta: 2 }, { Alpha: 3, Beta: 2 })).toBe(false);
  });
});

describe("the countdown runs on wall-clock time", () => {
  const started = new Date("2026-09-11T09:00:00.000Z");
  const attempt = createAttempt([item("x", "Alpha")], 120, started, "attempt-1");

  it("fixes an absolute deadline from the blueprint's time limit", () => {
    expect(attempt.deadlineAt).toBe("2026-09-11T11:00:00.000Z");
    expect(attempt.startedAt).toBe(started.toISOString());
    expect(attempt.submittedAt).toBeNull();
    expect(attempt.expiryHandled).toBe(false);
  });

  it("counts down while the attempt is off screen", () => {
    // The candidate closed the tab at 09:05 and came back at 10:30; the clock did not pause.
    expect(remainingMs(attempt, new Date("2026-09-11T10:30:00.000Z"))).toBe(30 * 60_000);
  });

  it("never reports negative time, and reports expiry once the deadline passes", () => {
    const afterwards = new Date("2026-09-11T12:00:00.000Z");

    expect(remainingMs(attempt, afterwards)).toBe(0);
    expect(isExpired(attempt, afterwards)).toBe(true);
    expect(isExpired(attempt, new Date("2026-09-11T10:59:59.000Z"))).toBe(false);
  });

  it("formats the remaining time for the eye and for a screen reader", () => {
    expect(formatRemaining(2 * 60 * 60_000)).toBe("2:00:00");
    expect(formatRemaining(9 * 60_000 + 5_000)).toBe("9:05");
    expect(formatRemaining(-1)).toBe("0:00");

    // Announced at intervals rather than every second, so the timer is not a ticking stream.
    expect(announceRemaining(45 * 60_000)).toBe("About 45 minutes remaining.");
    expect(announceRemaining(60_000)).toBe("About 1 minute remaining.");
    expect(announceRemaining(5_000)).toBe("Less than a minute remaining.");
  });

  it("lists which items are still unanswered", () => {
    const resumable = createAttempt(
      [item("i1", "Alpha"), item("i2", "Alpha"), item("i3", "Beta")],
      120,
      started,
      "attempt-2"
    );
    resumable.answers = { i1: ["a"], i2: [] };

    expect(unansweredItemIds(resumable)).toEqual(["i2", "i3"]);
  });
});

describe("building and retaining reports", () => {
  const submittedAt = new Date("2026-09-11T10:00:00.000Z");
  const items = [item("q1", "Alpha", ["a"]), item("q2", "Beta", ["a", "c"])];
  const attempt = createAttempt(items, 120, new Date("2026-09-11T09:00:00.000Z"), "attempt-3");
  attempt.answers = { q1: ["a"], q2: ["a"] };

  const outcome = scoreAttempt(items, attempt.answers, ["Alpha", "Beta"], {
    minimum: 100,
    maximum: 1000,
    passingScore: 720
  });
  const report = buildReport(attempt, outcome, submittedAt);

  it("records per-domain figures and an explanation for every item", () => {
    expect(report.correct).toBe(1);
    expect(report.itemCount).toBe(2);
    expect(report.domainScores).toEqual({
      Alpha: { correct: 1, itemCount: 1 },
      Beta: { correct: 0, itemCount: 1 }
    });
    expect(report.items.map((entry) => entry.isCorrect)).toEqual([true, false]);
    // FR-032: the wrong answer carries the reasoning for every option, not just the right one.
    const wrong = report.items[1];
    expect(wrong.selected).toEqual(["a"]);
    expect(wrong.correct).toEqual(["a", "c"]);
    expect(wrong.rationale).toContain("a.");
    expect(wrong.rationale).toContain("d.");
  });

  it("keeps three full reports and demotes the fourth-oldest to a summary", () => {
    const made = (index: number): ScoreReport => ({ ...report, attemptId: `attempt-${index}` });
    let stored: { reports: ScoreReport[]; summaries: ReturnType<typeof summarise>[] } = {
      reports: [],
      summaries: []
    };
    for (let index = 1; index <= 5; index += 1) {
      stored = retainReports(stored.reports, stored.summaries, made(index));
    }

    expect(stored.reports).toHaveLength(MAX_RETAINED_REPORTS);
    expect(stored.reports.map((entry) => entry.attemptId)).toEqual([
      "attempt-5",
      "attempt-4",
      "attempt-3"
    ]);
    expect(stored.summaries.map((entry) => entry.attemptId)).toEqual(["attempt-2", "attempt-1"]);
  });

  it("a summary keeps the per-domain trend and drops the item snapshot", () => {
    const summary = summarise(report);

    expect(summary.detailDropped).toBe(true);
    expect(summary.domainScores).toEqual(report.domainScores);
    expect(summary.correct).toBe(report.correct);
    expect("items" in summary).toBe(false);
  });
});
