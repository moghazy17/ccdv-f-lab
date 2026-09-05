import { describe, expect, test } from "vitest";

import {
  createProgressStorage,
  emptyProgress,
  type StorageLike
} from "../../src/lib/storage";
import {
  exportProgress,
  getExportFilename,
  hasRecordedProgress,
  parseAndValidateImport,
  serializeProgress,
  summarizeEnvelope
} from "../../src/lib/transfer";

class MemoryStorage implements StorageLike {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("transfer module", () => {
  test("generates expected export filename from date", () => {
    const date = new Date("2026-09-05T12:00:00.000Z");
    expect(getExportFilename(date)).toBe("ccdv-f-progress-2026-09-05.json");
  });

  test("serializes progress envelope as pretty-printed JSON", () => {
    const envelope = emptyProgress("2026-09-05T10:00:00.000Z");
    const serialized = serializeProgress(envelope);
    expect(serialized).toContain("\n");
    expect(serialized).toContain('  "schemaVersion": 1');
    const parsed = JSON.parse(serialized);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.updatedAt).toBe("2026-09-05T10:00:00.000Z");
  });

  test("summarizes envelope marks and metadata", () => {
    const envelope = emptyProgress("2026-09-05T10:00:00.000Z");
    envelope.namespaces.foundation.planMarks = {
      "3-weeks": [2, 5],
      "1-week": [1]
    };

    const summary = summarizeEnvelope(envelope);
    expect(summary.totalMarks).toBe(3);
    expect(summary.plans).toEqual([
      { planSlug: "1-week", count: 1, domainNumbers: [1] },
      { planSlug: "3-weeks", count: 2, domainNumbers: [2, 5] }
    ]);
    expect(summary.hasDiagnostic).toBe(false);
  });

  test("detects whether progress has been recorded", () => {
    const empty = emptyProgress("2026-09-05T10:00:00.000Z");
    expect(hasRecordedProgress(empty)).toBe(false);

    const withMarks = emptyProgress("2026-09-05T10:00:00.000Z");
    withMarks.namespaces.foundation.planMarks["3-weeks"] = [2];
    expect(hasRecordedProgress(withMarks)).toBe(true);

    const withDiagnostic = emptyProgress("2026-09-05T10:00:00.000Z");
    withDiagnostic.namespaces.foundation.diagnostic = { recommendedPlan: "3-weeks" };
    expect(hasRecordedProgress(withDiagnostic)).toBe(true);
  });

  test("parses and validates valid JSON envelope", () => {
    const valid = emptyProgress("2026-09-05T10:00:00.000Z");
    valid.namespaces.foundation.planMarks["3-weeks"] = [2, 5];
    const raw = JSON.stringify(valid);

    const result = parseAndValidateImport(raw);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.envelope.schemaVersion).toBe(1);
      expect(result.summary.totalMarks).toBe(2);
      expect(result.summary.plans[0].planSlug).toBe("3-weeks");
    }
  });

  test("migrates version 0 forward to version 1", () => {
    const v0 = {
      schemaVersion: 0,
      updatedAt: "2026-01-01T00:00:00.000Z",
      namespaces: {
        foundation: {
          theme: "dark",
          planMarks: { "1-week": [3] }
        }
      }
    };
    const raw = JSON.stringify(v0);

    const result = parseAndValidateImport(raw);
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") {
      expect(result.envelope.schemaVersion).toBe(1);
      expect(result.summary.totalMarks).toBe(1);
    }
  });

  test("rejects non-JSON input with descriptive message", () => {
    const result = parseAndValidateImport("NOT JSON AT ALL");
    expect(result.kind).toBe("non-json");
    if (result.kind === "non-json") {
      expect(result.message).toMatch(/not valid JSON/i);
    }
  });

  test("rejects non-object or malformed structures", () => {
    expect(parseAndValidateImport("[]").kind).toBe("malformed");
    expect(parseAndValidateImport('"string"').kind).toBe("malformed");
    expect(parseAndValidateImport('{"invalid": true}').kind).toBe("malformed");
  });

  test("rejects newer schemaVersion with version indication", () => {
    const future = {
      schemaVersion: 5,
      updatedAt: "2027-01-01T00:00:00.000Z",
      namespaces: { foundation: {} }
    };
    const result = parseAndValidateImport(JSON.stringify(future));
    expect(result.kind).toBe("newer-version");
    if (result.kind === "newer-version") {
      expect(result.version).toBe(5);
      expect(result.message).toMatch(/newer version/i);
    }
  });

  test("exportProgress reads storage and creates file download without errors", () => {
    const storage = new MemoryStorage();
    const accessor = createProgressStorage(storage, () => "2026-09-05T12:00:00.000Z");
    accessor.setPlanMark("3-weeks", 2, true);

    const result = exportProgress(accessor, new Date("2026-09-05T12:00:00.000Z"));
    expect(result.success).toBe(true);
    expect(result.filename).toBe("ccdv-f-progress-2026-09-05.json");
  });
});
