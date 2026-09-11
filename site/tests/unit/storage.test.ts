import { describe, expect, test } from "vitest";

import {
  CURRENT_SCHEMA_VERSION,
  PROGRESS_STORAGE_KEY,
  checkStorageAvailability,
  createProgressStorage,
  emptyProgress,
  migrateProgress,
  themeBootstrapScript,
  type StorageLike
} from "../../src/lib/storage";

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

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe("progress storage", () => {
  test("theme bootstrap refuses future and invalid schema records", () => {
    const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
    const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    const document = { documentElement: { dataset: {} as Record<string, string> } };
    const storage = new MemoryStorage();

    Object.defineProperty(globalThis, "document", { configurable: true, value: document });
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
    try {
      for (const schemaVersion of [2, "1", undefined]) {
        storage.setItem(
          PROGRESS_STORAGE_KEY,
          JSON.stringify({ schemaVersion, namespaces: { foundation: { theme: "dark" } } })
        );
        Function(themeBootstrapScript)();
        expect(document.documentElement.dataset.theme).toBe("system");
      }
    } finally {
      if (originalDocument) {
        Object.defineProperty(globalThis, "document", originalDocument);
      } else {
        Reflect.deleteProperty(globalThis, "document");
      }
      if (originalStorage) {
        Object.defineProperty(globalThis, "localStorage", originalStorage);
      } else {
        Reflect.deleteProperty(globalThis, "localStorage");
      }
    }
  });

  test("migrates a lower version without mutating its input", () => {
    const older = {
      schemaVersion: 0,
      updatedAt: "2026-01-01T00:00:00.000Z",
      namespaces: { foundation: { theme: "dark" }, future: { retained: true } }
    };

    const result = migrateProgress(older);

    expect(result.kind).toBe("ok");
    if (result.kind === "ok" && result.value !== undefined) {
      expect(result.value.schemaVersion).toBe(1);
      expect(result.value.namespaces.future).toEqual({ retained: true });
    }
    expect(older.schemaVersion).toBe(0);
  });

  test("refuses a higher version without changing stored data", () => {
    const storage = new MemoryStorage();
    const future = { ...emptyProgress("2026-01-01T00:00:00.000Z"), schemaVersion: 2 };
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(future));
    const accessor = createProgressStorage(storage, () => "2026-01-02T00:00:00.000Z");

    expect(accessor.read().kind).toBe("newer-version");
    expect(storage.getItem(PROGRESS_STORAGE_KEY)).toBe(JSON.stringify(future));
  });

  test("preserves unknown namespaces while writing a foundation mark", () => {
    const storage = new MemoryStorage();
    const record = emptyProgress("2026-01-01T00:00:00.000Z");
    record.namespaces.future = { retained: true };
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(record));
    const accessor = createProgressStorage(storage, () => "2026-01-02T00:00:00.000Z");

    expect(accessor.setPlanMark("3-weeks", 2, true).kind).toBe("ok");
    expect(accessor.read().value?.namespaces.future).toEqual({ retained: true });
  });

  test("reports malformed JSON and unavailable storage without overwriting it", () => {
    const storage = new MemoryStorage();
    storage.setItem(PROGRESS_STORAGE_KEY, "{");

    expect(createProgressStorage(storage).read().kind).toBe("malformed");
    expect(createProgressStorage(null).read().kind).toBe("unavailable");
    expect(storage.getItem(PROGRESS_STORAGE_KEY)).toBe("{");
  });

  test("leaves the prior record intact when a write fails", () => {
    const storage = new MemoryStorage();
    const before = JSON.stringify(emptyProgress("2026-01-01T00:00:00.000Z"));
    storage.setItem(PROGRESS_STORAGE_KEY, before);
    storage.failWrites = true;

    expect(createProgressStorage(storage).setPlanMark("1-week", 1, true).kind).toBe("write-failed");
    expect(storage.getItem(PROGRESS_STORAGE_KEY)).toBe(before);
  });

  test("reconciles marks independently from the current shared record", () => {
    const storage = new MemoryStorage();
    const first = createProgressStorage(storage, () => "2026-01-01T00:00:00.000Z");
    const second = createProgressStorage(storage, () => "2026-01-02T00:00:00.000Z");

    first.setPlanMark("3-weeks", 2, true);
    second.setPlanMark("3-weeks", 5, true);

    expect(second.read().value?.namespaces.foundation.planMarks["3-weeks"]).toEqual([2, 5]);
  });

  test("replaces progress envelope wholesale while rejecting newer versions", () => {
    const storage = new MemoryStorage();
    const accessor = createProgressStorage(storage, () => "2026-01-01T00:00:00.000Z");

    const valid = emptyProgress("2026-01-01T00:00:00.000Z");
    valid.namespaces.foundation.planMarks["3-weeks"] = [1, 2];
    expect(accessor.replace(valid).kind).toBe("ok");
    expect(accessor.read().value?.namespaces.foundation.planMarks["3-weeks"]).toEqual([1, 2]);

    const newer = { ...valid, schemaVersion: 99 };
    expect(accessor.replace(newer as unknown as typeof valid).kind).toBe("newer-version");
    // Stored data still intact
    expect(accessor.read().value?.namespaces.foundation.planMarks["3-weeks"]).toEqual([1, 2]);
  });
});

describe("concurrent plan-mark writes", () => {
  test("a competing tab's clobbering write is detected and the mark is reapplied", () => {
    // Simulate the interleaving that loses a mark: this tab reads, a second tab writes its own
    // whole envelope, then this tab's write lands. The second tab's record is injected once, at
    // the moment this tab has already read but not yet written.
    class ClobberingStorage extends MemoryStorage {
      clobberOnNextWrite: string | null = null;

      setItem(key: string, value: string): void {
        super.setItem(key, value);
        if (this.clobberOnNextWrite !== null) {
          const competing = this.clobberOnNextWrite;
          this.clobberOnNextWrite = null;
          super.setItem(key, competing);
        }
      }
    }

    const storage = new ClobberingStorage();
    const competingEnvelope = emptyProgress("2026-01-01T00:00:00.000Z");
    competingEnvelope.namespaces.foundation.planMarks["3-weeks"] = [5];
    storage.clobberOnNextWrite = JSON.stringify(competingEnvelope);

    const progress = createProgressStorage(storage, () => "2026-01-02T00:00:00.000Z");
    const result = progress.setPlanMark("3-weeks", 2, true);

    expect(result.kind).toBe("ok");
    const stored = progress.read();
    expect(stored.kind).toBe("ok");
    expect(stored.value?.namespaces.foundation.planMarks["3-weeks"]).toEqual([2, 5]);
  });

  test("an uncontended write still performs a single merge", () => {
    const storage = new MemoryStorage();
    const progress = createProgressStorage(storage, () => "2026-01-02T00:00:00.000Z");

    expect(progress.setPlanMark("3-weeks", 2, true).kind).toBe("ok");
    expect(progress.setPlanMark("3-weeks", 5, true).kind).toBe("ok");
    expect(progress.setPlanMark("3-weeks", 2, false).kind).toBe("ok");

    const stored = progress.read();
    expect(stored.value?.namespaces.foundation.planMarks["3-weeks"]).toEqual([5]);
  });
});

describe("practice namespaces", () => {
  test("schema version stays one so a record here still imports into an earlier build", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
  });

  test("a feature-001 record migrates forward with the four namespaces defaulted", () => {
    const legacy = {
      schemaVersion: 1,
      updatedAt: "2026-01-01T00:00:00.000Z",
      namespaces: {
        foundation: { theme: "dark", planMarks: { "1-week": [1] }, diagnostic: null }
      }
    };

    const result = migrateProgress(legacy);

    expect(result.kind).toBe("ok");
    if (result.kind === "ok" && result.value !== undefined) {
      expect(result.value.namespaces.labs).toEqual({ edits: {} });
      expect(result.value.namespaces.mock).toEqual({ current: null, reports: [], summaries: [] });
      expect(result.value.namespaces.quiz).toEqual({ results: {}, recall: {} });
      expect(result.value.namespaces.flashcards).toEqual({ state: {} });
      // The namespace this reader already understood is untouched by the migration.
      expect(result.value.namespaces.foundation.planMarks).toEqual({ "1-week": [1] });
    }
  });

  test("a record carrying the four namespaces round-trips with their data intact", () => {
    const record = emptyProgress("2026-01-01T00:00:00.000Z");
    record.namespaces.labs.edits.transport = "print('edited')";
    record.namespaces.mock.current = {
      id: "attempt-1",
      items: [],
      answers: { "item-1": ["a"] },
      startedAt: "2026-01-01T00:00:00.000Z",
      deadlineAt: "2026-01-01T02:00:00.000Z",
      submittedAt: null,
      expiryHandled: false
    };
    record.namespaces.mock.summaries.push({
      attemptId: "attempt-0",
      submittedAt: "2025-12-31T00:00:00.000Z",
      correct: 40,
      itemCount: 53,
      domainScores: { "Claude Code": { correct: 2, itemCount: 2 } },
      ready: true,
      lowDomains: [],
      unassessedDomains: [],
      detailDropped: true
    });
    record.namespaces.quiz.results["Claude Code"] = {
      correct: 4,
      itemCount: 5,
      takenAt: "2026-01-01T00:00:00.000Z",
      wrongAnswers: []
    };
    record.namespaces.quiz.recall["prompt-1"] = "known";
    record.namespaces.flashcards.state["card-1"] = { box: 2, dueAt: "2026-01-04T00:00:00.000Z" };

    const result = migrateProgress(record);

    expect(result.kind).toBe("ok");
    if (result.kind === "ok" && result.value !== undefined) {
      expect(result.value.namespaces.labs).toEqual(record.namespaces.labs);
      expect(result.value.namespaces.mock).toEqual(record.namespaces.mock);
      expect(result.value.namespaces.quiz).toEqual(record.namespaces.quiz);
      expect(result.value.namespaces.flashcards).toEqual(record.namespaces.flashcards);
    }
  });

  test("clears every practice namespace while retaining foundation progress exactly", () => {
    const storage = new MemoryStorage();
    const record = emptyProgress("2026-01-01T00:00:00.000Z");
    record.namespaces.foundation = {
      theme: "dark",
      planMarks: { "3-weeks": [2, 5] },
      diagnostic: { recommendedPlan: "3-weeks" }
    };
    record.namespaces.labs.edits.router = "print('practice')";
    record.namespaces.mock.current = {
      id: "attempt-1",
      items: [],
      answers: {},
      startedAt: "2026-01-01T00:00:00.000Z",
      deadlineAt: "2026-01-01T02:00:00.000Z",
      submittedAt: null,
      expiryHandled: false
    };
    record.namespaces.quiz.results["claude-code"] = {
      correct: 1,
      itemCount: 2,
      takenAt: "2026-01-01T00:00:00.000Z",
      wrongAnswers: []
    };
    record.namespaces.quiz.recall["prompt-1"] = "known";
    record.namespaces.flashcards.state["card-1"] = {
      box: 2,
      dueAt: "2026-01-02T00:00:00.000Z"
    };
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(record));
    const progress = createProgressStorage(storage);

    expect(progress.clearPracticeResults().kind).toBe("ok");
    const cleared = progress.read().value?.namespaces;

    expect(cleared?.foundation).toEqual(record.namespaces.foundation);
    expect(cleared?.labs).toEqual({ edits: {} });
    expect(cleared?.mock).toEqual({ current: null, reports: [], summaries: [] });
    expect(cleared?.quiz).toEqual({ results: {}, recall: {} });
    expect(cleared?.flashcards).toEqual({ state: {} });
  });
});

describe("storage availability", () => {
  test("reports unavailable when no backing store exists", () => {
    expect(checkStorageAvailability(null)).toBe("unavailable");
  });

  test("reports available for a working store and leaves it clean", () => {
    const storage = new MemoryStorage();

    expect(checkStorageAvailability(storage)).toBe("available");
    expect(storage.values.size).toBe(0);
  });

  test("reports full without throwing when a write hits quota", () => {
    const storage = new MemoryStorage();
    storage.failWrites = true;

    expect(checkStorageAvailability(storage)).toBe("full");
  });

  test("reports unavailable without throwing when reads themselves fail", () => {
    const storage: StorageLike = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        // Unreachable: getItem fails first.
      }
    };

    expect(checkStorageAvailability(storage)).toBe("unavailable");
  });
});
