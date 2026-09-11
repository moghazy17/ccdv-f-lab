import type { PracticeItem } from "./items";

export const PROGRESS_STORAGE_KEY = "ccdv-f:progress";
export const CURRENT_SCHEMA_VERSION = 1;
const WRITE_MERGE_RETRIES = 1;

export type Theme = "light" | "dark" | "system";

export interface FoundationProgress {
  theme: Theme;
  planMarks: Record<string, number[]>;
  diagnostic: unknown | null;
}

export interface MockAttempt {
  id: string;
  items: PracticeItem[];
  answers: Record<string, string[]>;
  startedAt: string;
  deadlineAt: string;
  submittedAt: string | null;
  expiryHandled: boolean;
}

export interface DomainScore {
  correct: number;
  itemCount: number;
}

export interface ScoreReportItem {
  itemId: string;
  selected: string[];
  correct: string[];
  isCorrect: boolean;
  rationale: string;
}

export interface ScoreReport {
  attemptId: string;
  submittedAt: string;
  correct: number;
  itemCount: number;
  domainScores: Record<string, DomainScore>;
  ready: boolean;
  lowDomains: string[];
  unassessedDomains: string[];
  /**
   * True when the countdown ran out rather than the candidate submitting (FR-029). Optional
   * because a report stored before this field existed simply does not carry it, and an absent
   * flag means the same thing as a false one.
   */
  timeRanOut?: boolean;
  items: ScoreReportItem[];
}

export interface ScoreSummary {
  attemptId: string;
  submittedAt: string;
  correct: number;
  itemCount: number;
  domainScores: Record<string, DomainScore>;
  ready: boolean;
  lowDomains: string[];
  unassessedDomains: string[];
  timeRanOut?: boolean;
  detailDropped: true;
}

export interface LabsProgress {
  edits: Record<string, string>;
}

export interface MockProgress {
  current: MockAttempt | null;
  reports: ScoreReport[];
  summaries: ScoreSummary[];
}

export interface QuizWrongAnswer {
  itemId: string;
  selected: string[];
  correct: string[];
  rationale: string;
}

export interface QuizResult {
  correct: number;
  itemCount: number;
  takenAt: string;
  wrongAnswers: QuizWrongAnswer[];
}

export type RecallOutcome = "known" | "unknown";

export interface QuizProgress {
  results: Record<string, QuizResult>;
  recall: Record<string, RecallOutcome>;
}

export interface FlashcardState {
  box: number;
  dueAt: string;
}

export interface FlashcardsProgress {
  state: Record<string, FlashcardState>;
}

export interface ProgressEnvelope {
  schemaVersion: number;
  updatedAt: string;
  namespaces: Record<string, unknown> & {
    foundation: FoundationProgress;
    labs: LabsProgress;
    mock: MockProgress;
    quiz: QuizProgress;
    flashcards: FlashcardsProgress;
  };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface StorageResult {
  kind: "ok" | "malformed" | "newer-version" | "unavailable" | "write-failed";
  value?: ProgressEnvelope;
}

export type StorageAvailability = "available" | "unavailable" | "full";

/**
 * How a new report is folded into what is already stored.
 *
 * Passed in rather than implemented here so the retention rule stays with the mock logic in
 * `attempt.ts`, where it is unit-tested, while this module keeps sole responsibility for writing.
 */
export type RetentionRule = (
  reports: readonly ScoreReport[],
  summaries: readonly ScoreSummary[],
  report: ScoreReport
) => { reports: ScoreReport[]; summaries: ScoreSummary[] };

const STORAGE_PROBE_KEY = "ccdv-f:storage-probe";

export const themeBootstrapScript = `(() => {
  try {
    const raw = localStorage.getItem(${JSON.stringify(PROGRESS_STORAGE_KEY)});
    const parsed = raw ? JSON.parse(raw) : null;
    const schemaVersion = parsed?.schemaVersion;
    const theme =
      typeof schemaVersion === "number" &&
      Number.isFinite(schemaVersion) &&
      schemaVersion <= ${CURRENT_SCHEMA_VERSION}
        ? parsed?.namespaces?.foundation?.theme
        : "system";
    document.documentElement.dataset.theme =
      theme === "light" || theme === "dark" || theme === "system" ? theme : "system";
  } catch (_) {
    document.documentElement.dataset.theme = "system";
  }
})();`;

export function emptyProgress(updatedAt: string): ProgressEnvelope {
  // Create a fresh version-one envelope without writing to browser storage.
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt,
    namespaces: {
      foundation: { theme: "system", planMarks: {}, diagnostic: null },
      labs: { edits: {} },
      mock: { current: null, reports: [], summaries: [] },
      quiz: { results: {}, recall: {} },
      flashcards: { state: {} }
    }
  };
}

export function migrateProgress(value: unknown): StorageResult {
  // Migrate an older envelope purely, preserving namespaces this feature does not own.
  if (!isRecord(value)) {
    return { kind: "malformed" };
  }
  const schemaVersion = value.schemaVersion;
  if (!isPositiveIntegerOrZero(schemaVersion)) {
    return { kind: "malformed" };
  }
  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    return { kind: "newer-version" };
  }
  if (typeof value.updatedAt !== "string" || !isRecord(value.namespaces)) {
    return { kind: "malformed" };
  }

  const namespaces = cloneRecord(value.namespaces);
  const foundation = foundationProgress(namespaces.foundation);
  const labs = labsProgress(namespaces.labs);
  const mock = mockProgress(namespaces.mock);
  const quiz = quizProgress(namespaces.quiz);
  const flashcards = flashcardsProgress(namespaces.flashcards);
  const migrated: ProgressEnvelope = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt: value.updatedAt,
    namespaces: { ...namespaces, foundation, labs, mock, quiz, flashcards }
  };
  return { kind: "ok", value: migrated };
}

export function checkStorageAvailability(
  storage: StorageLike | null = browserStorage()
): StorageAvailability {
  // Report availability without throwing, so every surface can degrade to a stated message.
  if (storage === null) {
    return "unavailable";
  }
  try {
    storage.getItem(STORAGE_PROBE_KEY);
  } catch {
    return "unavailable";
  }
  try {
    storage.setItem(STORAGE_PROBE_KEY, "1");
  } catch {
    return "full";
  }
  try {
    storage.removeItem?.(STORAGE_PROBE_KEY);
  } catch {
    // A cleanup failure is harmless; the probe key holds no progress data.
  }
  return "available";
}

export class ProgressStorage {
  private readonly listeners = new Set<(result: StorageResult) => void>();
  private readonly onStorageEvent = (event: StorageEvent): void => {
    if (event.key !== PROGRESS_STORAGE_KEY) {
      return;
    }
    this.notify(this.read());
  };

  constructor(
    private readonly storage: StorageLike | null = browserStorage(),
    private readonly now: () => string = () => new Date().toISOString()
  ) {
    if (typeof window !== "undefined") {
      window.addEventListener("storage", this.onStorageEvent);
    }
  }

  read(): StorageResult {
    // Read a safe envelope without overwriting malformed or newer-version data.
    if (this.storage === null) {
      return { kind: "unavailable" };
    }
    let raw: string | null;
    try {
      raw = this.storage.getItem(PROGRESS_STORAGE_KEY);
    } catch {
      return { kind: "unavailable" };
    }
    if (raw === null) {
      return { kind: "ok", value: emptyProgress(this.now()) };
    }

    try {
      const result = migrateProgress(JSON.parse(raw) as unknown);
      if (result.kind !== "ok" || result.value === undefined) {
        return result;
      }
      if (result.value.schemaVersion !== JSON.parse(raw).schemaVersion) {
        const writeResult = this.write(result.value);
        return writeResult.kind === "ok" ? result : writeResult;
      }
      return result;
    } catch {
      return { kind: "malformed" };
    }
  }

  mockProgress(): MockProgress | null {
    // Read the mock namespace, treating an unreadable record as nothing in progress.
    const current = this.read();
    if (current.kind !== "ok" || current.value === undefined) {
      return null;
    }
    return current.value.namespaces.mock;
  }

  setMockAttempt(attempt: MockAttempt | null): StorageResult {
    // Persist the attempt in progress, including its absolute deadline, so a reload or a browser
    // restart resumes it with the time it actually has left (FR-027).
    return this.mergeAndRetry(
      (envelope) => {
        envelope.namespaces.mock.current = attempt;
      },
      (envelope) => envelope.namespaces.mock.current?.id === attempt?.id
    );
  }

  recordAnswer(itemId: string, selected: readonly string[]): StorageResult {
    // Merge one answer against the stored attempt so a second tab cannot roll the attempt back.
    if (itemId.length === 0) {
      return { kind: "malformed" };
    }
    const chosen = [...selected];
    return this.mergeAndRetry(
      (envelope) => {
        const attempt = envelope.namespaces.mock.current;
        if (attempt !== null) {
          attempt.answers[itemId] = chosen;
        }
      },
      (envelope) => {
        const stored = envelope.namespaces.mock.current?.answers[itemId];
        return (
          stored !== undefined &&
          stored.length === chosen.length &&
          stored.every((id, index) => id === chosen[index])
        );
      }
    );
  }

  saveReport(report: ScoreReport, retain: RetentionRule): StorageResult {
    // Store a scored attempt under the retention rule and clear the attempt it came from.
    return this.mergeAndRetry(
      (envelope) => {
        const mock = envelope.namespaces.mock;
        const retained = retain(mock.reports, mock.summaries, report);
        mock.reports = retained.reports;
        mock.summaries = retained.summaries;
        mock.current = null;
      },
      (envelope) => envelope.namespaces.mock.reports[0]?.attemptId === report.attemptId
    );
  }

  clearPracticeResults(): StorageResult {
    // Clear the four namespaces this feature owns and leave `foundation` untouched (FR-051):
    // a candidate discarding practice keeps their theme, plan marks, and diagnostic outcome.
    return this.mergeAndRetry(
      (envelope) => {
        const empty = emptyProgress(envelope.updatedAt).namespaces;
        envelope.namespaces.labs = empty.labs;
        envelope.namespaces.mock = empty.mock;
        envelope.namespaces.quiz = empty.quiz;
        envelope.namespaces.flashcards = empty.flashcards;
      },
      (envelope) =>
        envelope.namespaces.mock.reports.length === 0 &&
        envelope.namespaces.mock.current === null &&
        Object.keys(envelope.namespaces.labs.edits).length === 0 &&
        Object.keys(envelope.namespaces.quiz.results).length === 0 &&
        Object.keys(envelope.namespaces.flashcards.state).length === 0
    );
  }

  setRecallOutcome(promptKey: string, outcome: RecallOutcome): StorageResult {
    // Self-grading a recall prompt records only what the candidate said about themselves; it is
    // never scored and never feeds readiness (FR-041).
    if (promptKey.length === 0) {
      return { kind: "malformed" };
    }
    return this.mergeAndRetry(
      (envelope) => {
        envelope.namespaces.quiz.recall[promptKey] = outcome;
      },
      (envelope) => envelope.namespaces.quiz.recall[promptKey] === outcome
    );
  }

  setQuizResult(domainSlug: string, result: QuizResult): StorageResult {
    // Keep one result per domain: the most recent scored attempt at that domain's quiz.
    if (domainSlug.length === 0) {
      return { kind: "malformed" };
    }
    return this.mergeAndRetry(
      (envelope) => {
        envelope.namespaces.quiz.results[domainSlug] = result;
      },
      (envelope) => envelope.namespaces.quiz.results[domainSlug]?.takenAt === result.takenAt
    );
  }

  setFlashcardState(
    cardId: string,
    state: FlashcardState,
    activeCardIds: readonly string[]
  ): StorageResult {
    // Schedule against the card's source-position identity and prune cards a regenerated deck no
    // longer contains. State can therefore never move from a removed card to a neighbouring one.
    if (
      cardId.length === 0 ||
      !Number.isInteger(state.box) ||
      state.box < 1 ||
      state.box > 5 ||
      Number.isNaN(Date.parse(state.dueAt))
    ) {
      return { kind: "malformed" };
    }
    const active = new Set(activeCardIds);
    if (!active.has(cardId)) {
      return { kind: "malformed" };
    }
    return this.mergeAndRetry(
      (envelope) => {
        const flashcards = envelope.namespaces.flashcards;
        flashcards.state = Object.fromEntries(
          Object.entries(flashcards.state).filter(([id]) => active.has(id))
        );
        flashcards.state[cardId] = state;
      },
      (envelope) =>
        envelope.namespaces.flashcards.state[cardId]?.box === state.box &&
        envelope.namespaces.flashcards.state[cardId]?.dueAt === state.dueAt
    );
  }

  pruneFlashcardState(activeCardIds: readonly string[]): StorageResult {
    // A regeneration removes identities, never recycles them, so remove only state whose matching
    // card is gone and retain every surviving card's box and due date unchanged.
    const active = new Set(activeCardIds);
    return this.mergeAndRetry(
      (envelope) => {
        envelope.namespaces.flashcards.state = Object.fromEntries(
          Object.entries(envelope.namespaces.flashcards.state).filter(([id]) => active.has(id))
        );
      },
      (envelope) => Object.keys(envelope.namespaces.flashcards.state).every((id) => active.has(id))
    );
  }

  setTheme(theme: Theme): StorageResult {
    // Persist one explicit theme choice while preserving all unrelated namespaces.
    return this.mergeAndRetry(
      (envelope) => {
        envelope.namespaces.foundation.theme = theme;
      },
      (envelope) => envelope.namespaces.foundation.theme === theme
    );
  }

  setPlanMark(planSlug: string, domainNumber: number, marked: boolean): StorageResult {
    // Merge one domain mark against the latest stored record rather than a stale tab snapshot.
    if (!Number.isInteger(domainNumber) || domainNumber < 1 || planSlug.length === 0) {
      return { kind: "malformed" };
    }
    return this.mergeAndRetry(
      (envelope) => {
        const marks = new Set(envelope.namespaces.foundation.planMarks[planSlug] ?? []);
        if (marked) {
          marks.add(domainNumber);
        } else {
          marks.delete(domainNumber);
        }
        envelope.namespaces.foundation.planMarks[planSlug] = [...marks].sort(
          (left, right) => left - right
        );
      },
      (envelope) => {
        const marks = envelope.namespaces.foundation.planMarks[planSlug] ?? [];
        return marks.includes(domainNumber) === marked;
      }
    );
  }

  setLabEdit(labSlug: string, source: string): StorageResult {
    // Keep one lab's edited source, merged against the latest record so a second tab's edit to a
    // different lab survives (FR-016).
    if (labSlug.length === 0) {
      return { kind: "malformed" };
    }
    return this.mergeAndRetry(
      (envelope) => {
        envelope.namespaces.labs.edits[labSlug] = source;
      },
      (envelope) => envelope.namespaces.labs.edits[labSlug] === source
    );
  }

  clearLabEdit(labSlug: string): StorageResult {
    // Discard one lab's edit, leaving every other lab's edit in place (FR-016).
    if (labSlug.length === 0) {
      return { kind: "malformed" };
    }
    return this.mergeAndRetry(
      (envelope) => {
        delete envelope.namespaces.labs.edits[labSlug];
      },
      (envelope) => envelope.namespaces.labs.edits[labSlug] === undefined
    );
  }

  labEdit(labSlug: string): string | null {
    // Read one lab's stored edit, treating an unreadable record as no edit rather than throwing.
    const current = this.read();
    if (current.kind !== "ok" || current.value === undefined) {
      return null;
    }
    return current.value.namespaces.labs.edits[labSlug] ?? null;
  }

  setDiagnostic(diagnostic: unknown): StorageResult {
    // Persist diagnostic response while preserving all unrelated namespaces.
    return this.mergeAndRetry(
      (envelope) => {
        envelope.namespaces.foundation.diagnostic = diagnostic;
      },
      (envelope) => envelope.namespaces.foundation.diagnostic === diagnostic
    );
  }

  replace(value: ProgressEnvelope): StorageResult {
    // Wholesale replacement of stored envelope while validating and migrating safely.
    const migrated = migrateProgress(value);
    if (migrated.kind !== "ok" || migrated.value === undefined) {
      return migrated;
    }
    return this.write(migrated.value);
  }

  subscribe(listener: (result: StorageResult) => void): () => void {
    // Observe storage events so separate tabs re-render after another tab changes a mark.
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    // Remove the browser listener when a client component is replaced.
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", this.onStorageEvent);
    }
    this.listeners.clear();
  }

  private mergeAndRetry(
    mutate: (envelope: ProgressEnvelope) => void,
    matches: (envelope: ProgressEnvelope) => boolean
  ): StorageResult {
    // Merge one change against the latest stored record rather than a stale tab snapshot.
    // Browser storage offers no compare-and-set, so a second tab can write its own whole envelope
    // between this read and this write and drop the change. Reading the record back detects that
    // and merges again onto the now-current record, which recovers the change together with
    // whatever the other tab wrote, without making every write asynchronous.
    let result = this.mergeOnce(mutate);
    for (let retry = 0; retry < WRITE_MERGE_RETRIES; retry += 1) {
      if (result.kind !== "ok" || this.storedMatches(matches)) {
        return result;
      }
      result = this.mergeOnce(mutate);
    }
    return result;
  }

  private mergeOnce(mutate: (envelope: ProgressEnvelope) => void): StorageResult {
    const current = this.read();
    if (current.kind !== "ok" || current.value === undefined) {
      return current;
    }
    const next = cloneEnvelope(current.value);
    next.updatedAt = this.now();
    mutate(next);
    return this.write(next);
  }

  private storedMatches(matches: (envelope: ProgressEnvelope) => boolean): boolean {
    // Treat an unreadable record as a match so an unavailable store cannot spin the retry loop.
    const stored = this.read();
    if (stored.kind !== "ok" || stored.value === undefined) {
      return true;
    }
    return matches(stored.value);
  }

  private write(value: ProgressEnvelope): StorageResult {
    if (this.storage === null) {
      return { kind: "unavailable" };
    }
    try {
      this.storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(value));
    } catch {
      return { kind: "write-failed" };
    }
    const result: StorageResult = { kind: "ok", value };
    this.notify(result);
    return result;
  }

  private notify(result: StorageResult): void {
    this.listeners.forEach((listener) => listener(result));
  }
}

export function createProgressStorage(
  storage: StorageLike | null = browserStorage(),
  now: () => string = () => new Date().toISOString()
): ProgressStorage {
  // Create the sole browser-storage accessor with injectable storage for deterministic tests.
  return new ProgressStorage(storage, now);
}

export function applyTheme(theme: Theme): void {
  // Apply the chosen theme attribute immediately after a user changes the control.
  document.documentElement.dataset.theme = theme;
}

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function foundationProgress(value: unknown): FoundationProgress {
  const source = isRecord(value) ? value : {};
  return {
    theme: isTheme(source.theme) ? source.theme : "system",
    planMarks: planMarks(source.planMarks),
    diagnostic: source.diagnostic ?? null
  };
}

function planMarks(value: unknown): Record<string, number[]> {
  if (!isRecord(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).flatMap(([planSlug, domainNumbers]) => {
      if (!Array.isArray(domainNumbers) || !domainNumbers.every(isPositiveInteger)) {
        return [];
      }
      return [[planSlug, [...new Set(domainNumbers)].sort((left, right) => left - right)]];
    })
  );
}

function labsProgress(value: unknown): LabsProgress {
  return { edits: stringRecord(isRecord(value) ? value.edits : undefined) };
}

function mockProgress(value: unknown): MockProgress {
  const source = isRecord(value) ? value : {};
  return {
    current: isMockAttempt(source.current) ? source.current : null,
    reports: filterArray(source.reports, isScoreReport),
    summaries: filterArray(source.summaries, isScoreSummary)
  };
}

function quizProgress(value: unknown): QuizProgress {
  const source = isRecord(value) ? value : {};
  return {
    results: recordOf(source.results, isQuizResult),
    recall: recordOf(source.recall, isRecallOutcome)
  };
}

function flashcardsProgress(value: unknown): FlashcardsProgress {
  const source = isRecord(value) ? value : {};
  return { state: recordOf(source.state, isFlashcardState) };
}

function stringRecord(value: unknown): Record<string, string> {
  return recordOf(value, (item): item is string => typeof item === "string");
}

function recordOf<T>(value: unknown, guard: (item: unknown) => item is T): Record<string, T> {
  if (!isRecord(value)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, T] => guard(entry[1]))
  );
}

function filterArray<T>(value: unknown, guard: (item: unknown) => item is T): T[] {
  return Array.isArray(value) ? value.filter(guard) : [];
}

function isMockAttempt(value: unknown): value is MockAttempt {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    Array.isArray(value.items) &&
    isRecord(value.answers) &&
    typeof value.startedAt === "string" &&
    typeof value.deadlineAt === "string" &&
    (value.submittedAt === null || typeof value.submittedAt === "string") &&
    typeof value.expiryHandled === "boolean"
  );
}

function isDomainScoreMap(value: unknown): value is Record<string, DomainScore> {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (entry) =>
        isRecord(entry) && typeof entry.correct === "number" && typeof entry.itemCount === "number"
    )
  );
}

function hasScoreReportShape(value: Record<string, unknown>): boolean {
  return (
    typeof value.attemptId === "string" &&
    typeof value.submittedAt === "string" &&
    typeof value.correct === "number" &&
    typeof value.itemCount === "number" &&
    isDomainScoreMap(value.domainScores) &&
    typeof value.ready === "boolean" &&
    Array.isArray(value.lowDomains) &&
    Array.isArray(value.unassessedDomains)
  );
}

function isScoreReport(value: unknown): value is ScoreReport {
  return isRecord(value) && hasScoreReportShape(value) && Array.isArray(value.items);
}

function isScoreSummary(value: unknown): value is ScoreSummary {
  return isRecord(value) && hasScoreReportShape(value) && value.detailDropped === true;
}

function isQuizResult(value: unknown): value is QuizResult {
  return (
    isRecord(value) &&
    typeof value.correct === "number" &&
    typeof value.itemCount === "number" &&
    typeof value.takenAt === "string" &&
    Array.isArray(value.wrongAnswers)
  );
}

function isRecallOutcome(value: unknown): value is RecallOutcome {
  return value === "known" || value === "unknown";
}

function isFlashcardState(value: unknown): value is FlashcardState {
  return isRecord(value) && typeof value.box === "number" && typeof value.dueAt === "string";
}

function cloneEnvelope(value: ProgressEnvelope): ProgressEnvelope {
  return migrateProgress(JSON.parse(JSON.stringify(value)) as unknown).value ?? value;
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isPositiveIntegerOrZero(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}
