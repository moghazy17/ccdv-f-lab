import {
  CURRENT_SCHEMA_VERSION,
  migrateProgress,
  type ProgressEnvelope,
  type ProgressStorage
} from "./storage";

export interface PlanMarksSummary {
  planSlug: string;
  count: number;
  domainNumbers: number[];
}

export interface RecordSummary {
  updatedAt: string;
  schemaVersion: number;
  plans: PlanMarksSummary[];
  totalMarks: number;
  hasDiagnostic: boolean;
  theme: string;
  labsEditedCount: number;
  mockReportCount: number;
  mockHasInProgressAttempt: boolean;
  quizResultCount: number;
  flashcardsTrackedCount: number;
}

export type ImportValidationResult =
  | {
      kind: "ok";
      envelope: ProgressEnvelope;
      summary: RecordSummary;
    }
  | {
      kind: "non-json";
      message: string;
    }
  | {
      kind: "newer-version";
      message: string;
      version: number;
    }
  | {
      kind: "malformed";
      message: string;
    };

export function getExportFilename(date: Date = new Date()): string {
  // ISO date slice ensures deterministic YYYY-MM-DD formatting
  const isoDate = date.toISOString().slice(0, 10);
  return `ccdv-f-progress-${isoDate}.json`;
}

export function serializeProgress(envelope: ProgressEnvelope): string {
  // The exported file is the envelope exactly as stored, pretty-printed
  return JSON.stringify(envelope, null, 2);
}

export function summarizeEnvelope(envelope: ProgressEnvelope | null | undefined): RecordSummary {
  if (!envelope || !envelope.namespaces || !envelope.namespaces.foundation) {
    return {
      updatedAt: "None",
      schemaVersion: 0,
      plans: [],
      totalMarks: 0,
      hasDiagnostic: false,
      theme: "system",
      labsEditedCount: 0,
      mockReportCount: 0,
      mockHasInProgressAttempt: false,
      quizResultCount: 0,
      flashcardsTrackedCount: 0
    };
  }

  const foundation = envelope.namespaces.foundation;
  const labs = envelope.namespaces.labs;
  const mock = envelope.namespaces.mock;
  const quiz = envelope.namespaces.quiz;
  const flashcards = envelope.namespaces.flashcards;
  const rawMarks = foundation.planMarks ?? {};
  const plans: PlanMarksSummary[] = Object.entries(rawMarks)
    .map(([planSlug, domainNumbers]) => {
      const validNumbers = Array.isArray(domainNumbers)
        ? domainNumbers.filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n > 0)
        : [];
      return {
        planSlug,
        count: validNumbers.length,
        domainNumbers: [...new Set(validNumbers)].sort((a, b) => a - b)
      };
    })
    .filter((p) => p.count > 0)
    .sort((a, b) => a.planSlug.localeCompare(b.planSlug));

  const totalMarks = plans.reduce((sum, p) => sum + p.count, 0);

  return {
    updatedAt: envelope.updatedAt ?? "Unknown",
    schemaVersion: envelope.schemaVersion,
    plans,
    totalMarks,
    hasDiagnostic: foundation.diagnostic !== null && foundation.diagnostic !== undefined,
    theme: foundation.theme ?? "system",
    labsEditedCount: labs ? Object.keys(labs.edits ?? {}).length : 0,
    mockReportCount: mock ? mock.reports.length + mock.summaries.length : 0,
    mockHasInProgressAttempt: mock ? mock.current !== null : false,
    quizResultCount: quiz ? Object.keys(quiz.results ?? {}).length : 0,
    flashcardsTrackedCount: flashcards ? Object.keys(flashcards.state ?? {}).length : 0
  };
}

export function hasRecordedProgress(envelope: ProgressEnvelope | null | undefined): boolean {
  if (!envelope || !envelope.namespaces || !envelope.namespaces.foundation) {
    return false;
  }
  const summary = summarizeEnvelope(envelope);
  return summary.totalMarks > 0 || summary.hasDiagnostic;
}

export function parseAndValidateImport(rawText: string): ImportValidationResult {
  // Step 1: Parse. Reject non-JSON with a plain message; existing progress untouched (FR-027).
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      kind: "non-json",
      message: "The selected file is not valid JSON. No data was imported and your existing progress is untouched."
    };
  }

  if (!isRecord(parsed)) {
    return {
      kind: "malformed",
      message: "The selected file does not contain a valid study kit progress record. Existing progress is untouched."
    };
  }

  // Step 2: Reject a schemaVersion higher than understood; existing progress untouched.
  const rawVersion = parsed.schemaVersion;
  if (typeof rawVersion === "number" && rawVersion > CURRENT_SCHEMA_VERSION) {
    return {
      kind: "newer-version",
      version: rawVersion,
      message: `This file was exported by a newer version of the study kit (version ${rawVersion}) and cannot be imported into version ${CURRENT_SCHEMA_VERSION}. Existing progress is untouched.`
    };
  }

  // Step 3: Migrate a lower version forward.
  const migration = migrateProgress(parsed);
  if (migration.kind !== "ok" || !migration.value) {
    if (migration.kind === "newer-version") {
      return {
        kind: "newer-version",
        version: typeof rawVersion === "number" ? rawVersion : 999,
        message: "This file was exported by a newer version of the study kit and cannot be imported here. Existing progress is untouched."
      };
    }
    return {
      kind: "malformed",
      message: "The progress record format is invalid or missing required envelope fields. Existing progress is untouched."
    };
  }

  const envelope = migration.value;
  const summary = summarizeEnvelope(envelope);

  return {
    kind: "ok",
    envelope,
    summary
  };
}

export function triggerDownload(filename: string, content: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function exportProgress(
  storage: ProgressStorage,
  date: Date = new Date()
): { success: boolean; filename?: string; error?: string } {
  const current = storage.read();
  if (current.kind !== "ok" || !current.value) {
    return {
      success: false,
      error: "Unable to read current progress from browser storage."
    };
  }

  const filename = getExportFilename(date);
  const content = serializeProgress(current.value);
  triggerDownload(filename, content);

  return {
    success: true,
    filename
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
