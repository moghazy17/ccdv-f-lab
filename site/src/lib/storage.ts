export const PROGRESS_STORAGE_KEY = "ccdv-f:progress";
export const CURRENT_SCHEMA_VERSION = 1;

export type Theme = "light" | "dark" | "system";

export interface FoundationProgress {
  theme: Theme;
  planMarks: Record<string, number[]>;
  diagnostic: unknown | null;
}

export interface ProgressEnvelope {
  schemaVersion: number;
  updatedAt: string;
  namespaces: Record<string, unknown> & { foundation: FoundationProgress };
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface StorageResult {
  kind: "ok" | "malformed" | "newer-version" | "unavailable" | "write-failed";
  value?: ProgressEnvelope;
}

export const themeBootstrapScript = `(() => {
  try {
    const raw = localStorage.getItem(${JSON.stringify(PROGRESS_STORAGE_KEY)});
    const parsed = raw ? JSON.parse(raw) : null;
    const theme = parsed?.namespaces?.foundation?.theme;
    if (theme === "light" || theme === "dark" || theme === "system") {
      document.documentElement.dataset.theme = theme;
    }
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
      foundation: { theme: "system", planMarks: {}, diagnostic: null }
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
  const migrated: ProgressEnvelope = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    updatedAt: value.updatedAt,
    namespaces: { ...namespaces, foundation }
  };
  return { kind: "ok", value: migrated };
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

  setTheme(theme: Theme): StorageResult {
    // Persist one explicit theme choice while preserving all unrelated namespaces.
    const current = this.read();
    if (current.kind !== "ok" || current.value === undefined) {
      return current;
    }
    const next = cloneEnvelope(current.value);
    next.updatedAt = this.now();
    next.namespaces.foundation.theme = theme;
    return this.write(next);
  }

  setPlanMark(planSlug: string, domainNumber: number, marked: boolean): StorageResult {
    // Merge one domain mark against the latest stored record rather than a stale tab snapshot.
    if (!Number.isInteger(domainNumber) || domainNumber < 1 || planSlug.length === 0) {
      return { kind: "malformed" };
    }
    const current = this.read();
    if (current.kind !== "ok" || current.value === undefined) {
      return current;
    }
    const next = cloneEnvelope(current.value);
    const marks = new Set(next.namespaces.foundation.planMarks[planSlug] ?? []);
    if (marked) {
      marks.add(domainNumber);
    } else {
      marks.delete(domainNumber);
    }
    next.updatedAt = this.now();
    next.namespaces.foundation.planMarks[planSlug] = [...marks].sort((left, right) => left - right);
    return this.write(next);
  }

  setDiagnostic(diagnostic: unknown): StorageResult {
    // Persist diagnostic response while preserving all unrelated namespaces.
    const current = this.read();
    if (current.kind !== "ok" || current.value === undefined) {
      return current;
    }
    const next = cloneEnvelope(current.value);
    next.updatedAt = this.now();
    next.namespaces.foundation.diagnostic = diagnostic;
    return this.write(next);
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
