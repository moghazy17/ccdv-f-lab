import { describe, expect, test } from "vitest";

import {
  PROGRESS_STORAGE_KEY,
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
