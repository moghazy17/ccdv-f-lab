import { describe, expect, test } from "vitest";

import {
  PROGRESS_STORAGE_KEY,
  createProgressStorage,
  emptyProgress,
  migrateProgress,
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
});
