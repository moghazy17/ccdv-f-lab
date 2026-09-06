/**
 * Typed search records and metadata definitions for Pagefind search integration.
 * Complies with contracts/search-record.md.
 */

export const KNOWN_RECORD_TYPES = [
  "note",
  "guide",
  "plan",
  "cheatsheet",
  "blueprint",
  "drill",
  "flashcard",
  "lab"
] as const;

export type KnownRecordType = (typeof KNOWN_RECORD_TYPES)[number];
export type RecordType = KnownRecordType | (string & {});

export type ContentStatus = "authored" | "partial" | "scaffold";

export interface SearchRecordMetadata {
  type: RecordType;
  domain?: string;
  weight?: string;
  status?: ContentStatus | string;
  title?: string;
  [key: string]: unknown;
}

export interface SearchRecord {
  url: string;
  title: string;
  excerpt: string;
  type: RecordType;
  typeLabel: string;
  domain?: string;
  weight?: string;
  status?: string;
  subResults?: Array<{
    title: string;
    url: string;
    excerpt: string;
  }>;
}

const RECORD_TYPE_LABELS: Record<string, string> = {
  note: "Note",
  guide: "Guide",
  plan: "Study plan",
  cheatsheet: "Cheat sheet",
  blueprint: "Blueprint",
  drill: "Practice item",
  flashcard: "Flashcard",
  lab: "Lab module"
};

/**
 * Returns a human-readable display label for a record type.
 * Supports known types directly and formats arbitrary new types additively for future features.
 */
export function getRecordTypeLabel(type: string): string {
  if (type in RECORD_TYPE_LABELS) {
    return RECORD_TYPE_LABELS[type];
  }
  return type
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Validates and normalizes raw search metadata returned by Pagefind.
 */
export function validateSearchMetadata(
  rawMeta: Record<string, unknown> | undefined | null
): SearchRecordMetadata {
  if (!rawMeta || typeof rawMeta !== "object") {
    return { type: "note" };
  }

  const rawType =
    typeof rawMeta.type === "string" && rawMeta.type.trim().length > 0
      ? rawMeta.type.trim()
      : "note";

  const domain =
    typeof rawMeta.domain === "string" && rawMeta.domain.trim().length > 0
      ? rawMeta.domain.trim()
      : undefined;

  const weight =
    typeof rawMeta.weight === "string" && rawMeta.weight.trim().length > 0
      ? rawMeta.weight.trim()
      : undefined;

  const status =
    typeof rawMeta.status === "string" && rawMeta.status.trim().length > 0
      ? (rawMeta.status.trim() as ContentStatus)
      : undefined;

  const title =
    typeof rawMeta.title === "string" && rawMeta.title.trim().length > 0
      ? rawMeta.title.trim()
      : undefined;

  return {
    type: rawType,
    domain,
    weight,
    status,
    title,
    ...rawMeta
  };
}

export interface SearchMetaAttributes {
  "data-pagefind-body"?: boolean;
  "data-pagefind-meta"?: string;
  "data-type"?: string;
  "data-domain"?: string;
  "data-weight"?: string;
  "data-status"?: string;
}

export interface SearchRecordOptions {
  type?: RecordType;
  domain?: string;
  weight?: number | string;
  status?: ContentStatus | string;
  excludeFromSearch?: boolean;
}

/**
 * Builds HTML data attributes for a page root element so Pagefind indexes it with typed metadata.
 * Pages marked with excludeFromSearch: true or without a type will emit no Pagefind body attribute,
 * ensuring structural pre-indexing exclusion (FR-009).
 */
export function buildSearchAttributes(options: SearchRecordOptions): SearchMetaAttributes {
  if (options.excludeFromSearch || !options.type) {
    return {};
  }

  const metaKeys: string[] = ["type[data-type]"];
  const attrs: SearchMetaAttributes = {
    "data-pagefind-body": true,
    "data-type": options.type
  };

  if (options.domain) {
    metaKeys.push("domain[data-domain]");
    attrs["data-domain"] = options.domain;
  }

  if (options.weight !== undefined) {
    const weightStr =
      typeof options.weight === "number" ? `${options.weight}%` : options.weight;
    metaKeys.push("weight[data-weight]");
    attrs["data-weight"] = weightStr;
  }

  if (options.status) {
    metaKeys.push("status[data-status]");
    attrs["data-status"] = options.status;
  }

  attrs["data-pagefind-meta"] = metaKeys.join(", ");
  return attrs;
}

/**
 * Transforms a raw Pagefind search result into a typed SearchRecord.
 */
export function formatSearchResult(rawResult: {
  url: string;
  excerpt?: string;
  meta?: Record<string, unknown>;
  sub_results?: Array<{ title: string; url: string; excerpt: string }>;
}): SearchRecord {
  const meta = validateSearchMetadata(rawResult.meta);
  const title = meta.title || rawResult.url;
  const typeLabel = getRecordTypeLabel(meta.type);

  return {
    url: rawResult.url,
    title,
    excerpt: rawResult.excerpt || "",
    type: meta.type,
    typeLabel,
    domain: meta.domain,
    weight: meta.weight,
    status: meta.status,
    subResults: rawResult.sub_results
  };
}
