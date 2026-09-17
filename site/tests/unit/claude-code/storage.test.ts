import { describe, expect, test } from "vitest";

import {
  PROGRESS_STORAGE_KEY,
  createProgressStorage,
  emptyProgress,
  type StorageLike
} from "../../../src/lib/storage";

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  failWrites = false;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) {
      throw new Error("quota exceeded");
    }
    this.values.set(key, value);
  }
}

describe("Claude Code progress storage", () => {
  test("round-trips bounded guided, scope, and draft state without a transcript", () => {
    const storage = new MemoryStorage();
    const progress = createProgressStorage(storage);

    expect(progress.setGuidedTask("help", true).kind).toBe("ok");
    expect(progress.setScopeExercise("project", ["rule-a"]).kind).toBe("ok");
    expect(progress.setConfigDraft({ selectedHook: "guard" }).kind).toBe("ok");

    expect(progress.claudeCodeProgress()).toEqual({
      guidedTasks: { help: true },
      scopeExercise: { project: ["rule-a"] },
      configDraft: { selectedHook: "guard" }
    });
    expect(JSON.stringify(progress.read().value?.namespaces.claudeCode)).not.toContain("transcript");
  });

  test("clears Claude Code progress independently", () => {
    const storage = new MemoryStorage();
    const progress = createProgressStorage(storage);
    progress.setGuidedTask("help", true);
    progress.setPlanMark("3-weeks", 2, true);
    progress.setDiagnostic({ recommendedDomainNumbers: [2] });
    progress.saveReport(
      {
        attemptId: "retained-report",
        submittedAt: "2026-09-17T00:00:00.000Z",
        correct: 0,
        itemCount: 0,
        domainScores: {},
        ready: false,
        lowDomains: [],
        unassessedDomains: [],
        items: []
      },
      (reports, summaries, report) => ({ reports: [report, ...reports], summaries: [...summaries] })
    );

    expect(progress.clearClaudeCode().kind).toBe("ok");
    expect(progress.claudeCodeProgress()).toEqual({ guidedTasks: {}, scopeExercise: {}, configDraft: null });
    expect(progress.read().value?.namespaces.foundation.planMarks).toEqual({ "3-weeks": [2] });
    expect(progress.read().value?.namespaces.foundation.diagnostic).toEqual({
      recommendedDomainNumbers: [2]
    });
    expect(progress.mockProgress()?.reports.map((report) => report.attemptId)).toEqual([
      "retained-report"
    ]);
  });

  test("does not remember data when storage is unavailable, full, or from a newer version", () => {
    expect(createProgressStorage(null).setGuidedTask("help", true).kind).toBe("unavailable");

    const full = new MemoryStorage();
    full.failWrites = true;
    expect(createProgressStorage(full).setGuidedTask("help", true).kind).toBe("write-failed");

    const future = new MemoryStorage();
    future.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({ ...emptyProgress("2026-01-01T00:00:00.000Z"), schemaVersion: 2 })
    );
    expect(createProgressStorage(future).setGuidedTask("help", true).kind).toBe("newer-version");
  });
});
