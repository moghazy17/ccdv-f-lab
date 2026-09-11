import { describe, expect, test } from "vitest";

import {
  PROGRESS_STORAGE_KEY,
  createProgressStorage,
  emptyProgress,
  type StorageLike
} from "../../src/lib/storage";

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

/**
 * Stands in for a second browser tab. Its own write is injected immediately after this tab's
 * write lands, the same interleaving a real second tab produces when its independent
 * read-merge-write finishes microseconds after this one's.
 */
class SecondTabStorage extends MemoryStorage {
  pendingSecondTabWrite: string | null = null;

  setItem(key: string, value: string): void {
    super.setItem(key, value);
    if (this.pendingSecondTabWrite !== null) {
      const secondTabWrite = this.pendingSecondTabWrite;
      this.pendingSecondTabWrite = null;
      super.setItem(key, secondTabWrite);
    }
  }
}

describe("multi-tab writes across namespaces", () => {
  test("a diagnostic write recovers a concurrent lab edit written by another tab", () => {
    const storage = new SecondTabStorage();
    const seed = emptyProgress("2026-01-01T00:00:00.000Z");
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(seed));

    // The second tab's whole envelope: a lab edit, no diagnostic, written right after this tab's
    // own write completes.
    const secondTabEnvelope = emptyProgress("2026-01-01T00:00:01.000Z");
    secondTabEnvelope.namespaces.labs.edits.transport = "print('second tab')";
    storage.pendingSecondTabWrite = JSON.stringify(secondTabEnvelope);

    const progress = createProgressStorage(storage, () => "2026-01-01T00:00:02.000Z");
    const result = progress.setDiagnostic({ recommendedPlan: "3-weeks" });

    expect(result.kind).toBe("ok");
    const stored = progress.read();
    expect(stored.kind).toBe("ok");
    // Our own change survived the clobber and the retry...
    expect(stored.value?.namespaces.foundation.diagnostic).toEqual({
      recommendedPlan: "3-weeks"
    });
    // ...and so did the concurrent write to the unrelated labs namespace.
    expect(stored.value?.namespaces.labs.edits.transport).toBe("print('second tab')");
  });

  test("a plan mark write recovers a concurrent flashcard review from another tab", () => {
    const storage = new SecondTabStorage();
    const seed = emptyProgress("2026-01-01T00:00:00.000Z");
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(seed));

    const secondTabEnvelope = emptyProgress("2026-01-01T00:00:01.000Z");
    secondTabEnvelope.namespaces.flashcards.state["card-1"] = {
      box: 2,
      dueAt: "2026-01-04T00:00:00.000Z"
    };
    storage.pendingSecondTabWrite = JSON.stringify(secondTabEnvelope);

    const progress = createProgressStorage(storage, () => "2026-01-01T00:00:02.000Z");
    const result = progress.setPlanMark("3-weeks", 2, true);

    expect(result.kind).toBe("ok");
    const stored = progress.read();
    expect(stored.value?.namespaces.foundation.planMarks["3-weeks"]).toEqual([2]);
    expect(stored.value?.namespaces.flashcards.state["card-1"]).toEqual({
      box: 2,
      dueAt: "2026-01-04T00:00:00.000Z"
    });
  });
});
