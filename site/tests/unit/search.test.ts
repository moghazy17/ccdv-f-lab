import { describe, expect, it } from "vitest";

import {
  KNOWN_RECORD_TYPES,
  buildSearchAttributes,
  formatSearchResult,
  getRecordTypeLabel,
  validateSearchMetadata
} from "../../src/lib/search";

describe("search record types and metadata", () => {
  it("includes the five initial record types and reserves the 002 types", () => {
    expect(KNOWN_RECORD_TYPES).toContain("note");
    expect(KNOWN_RECORD_TYPES).toContain("guide");
    expect(KNOWN_RECORD_TYPES).toContain("plan");
    expect(KNOWN_RECORD_TYPES).toContain("cheatsheet");
    expect(KNOWN_RECORD_TYPES).toContain("blueprint");
    expect(KNOWN_RECORD_TYPES).toContain("drill");
    expect(KNOWN_RECORD_TYPES).toContain("flashcard");
    expect(KNOWN_RECORD_TYPES).toContain("lab");
  });

  it("returns human-readable labels for known and novel record types", () => {
    expect(getRecordTypeLabel("note")).toBe("Note");
    expect(getRecordTypeLabel("guide")).toBe("Guide");
    expect(getRecordTypeLabel("plan")).toBe("Study plan");
    expect(getRecordTypeLabel("cheatsheet")).toBe("Cheat sheet");
    expect(getRecordTypeLabel("blueprint")).toBe("Blueprint");
    expect(getRecordTypeLabel("drill")).toBe("Practice item");
    expect(getRecordTypeLabel("flashcard")).toBe("Flashcard");
    expect(getRecordTypeLabel("lab")).toBe("Lab module");

    // Extensible for future features
    expect(getRecordTypeLabel("custom-feature")).toBe("Custom Feature");
  });

  it("validates and normalizes search record metadata safely", () => {
    const valid = validateSearchMetadata({
      type: "note",
      domain: "01-agents-and-workflows",
      weight: "33.1%",
      status: "scaffold",
      title: "Agents and Workflows"
    });
    expect(valid.type).toBe("note");
    expect(valid.domain).toBe("01-agents-and-workflows");
    expect(valid.weight).toBe("33.1%");
    expect(valid.status).toBe("scaffold");
    expect(valid.title).toBe("Agents and Workflows");

    // Missing fields fallback safely
    const empty = validateSearchMetadata({});
    expect(empty.type).toBe("note");
    expect(empty.domain).toBeUndefined();
    expect(empty.weight).toBeUndefined();
    expect(empty.status).toBeUndefined();

    const nonObject = validateSearchMetadata(null as unknown as Record<string, unknown>);
    expect(nonObject.type).toBe("note");
  });

  it("builds HTML data attributes for Pagefind indexing and exclusion", () => {
    const noteAttrs = buildSearchAttributes({
      type: "note",
      domain: "01-agents-and-workflows",
      weight: 33.1,
      status: "scaffold"
    });
    expect(noteAttrs["data-pagefind-body"]).toBe(true);
    expect(noteAttrs["data-type"]).toBe("note");
    expect(noteAttrs["data-domain"]).toBe("01-agents-and-workflows");
    expect(noteAttrs["data-weight"]).toBe("33.1%");
    expect(noteAttrs["data-status"]).toBe("scaffold");
    expect(noteAttrs["data-pagefind-meta"]).toBe(
      "type[data-type], domain[data-domain], weight[data-weight], status[data-status]"
    );

    const guideAttrs = buildSearchAttributes({
      type: "guide"
    });
    expect(guideAttrs["data-pagefind-body"]).toBe(true);
    expect(guideAttrs["data-type"]).toBe("guide");
    expect(guideAttrs["data-pagefind-meta"]).toBe("type[data-type]");
    expect(guideAttrs["data-domain"]).toBeUndefined();

    // Structural exclusion
    const excludedAttrs = buildSearchAttributes({
      type: "drill",
      excludeFromSearch: true
    });
    expect(excludedAttrs["data-pagefind-body"]).toBeUndefined();
    expect(excludedAttrs["data-pagefind-meta"]).toBeUndefined();

    const noTypeAttrs = buildSearchAttributes({});
    expect(noTypeAttrs["data-pagefind-body"]).toBeUndefined();
  });

  it("formats Pagefind search result into a typed SearchRecord", () => {
    const formatted = formatSearchResult({
      url: "/ccdv-f-lab/domains/01-agents-and-workflows/",
      excerpt: "Deterministic <mark>workflows</mark> and routing.",
      meta: {
        title: "Agents and Workflows",
        type: "note",
        domain: "01-agents-and-workflows",
        weight: "33.1%",
        status: "scaffold"
      }
    });

    expect(formatted.url).toBe("/ccdv-f-lab/domains/01-agents-and-workflows/");
    expect(formatted.title).toBe("Agents and Workflows");
    expect(formatted.type).toBe("note");
    expect(formatted.typeLabel).toBe("Note");
    expect(formatted.domain).toBe("01-agents-and-workflows");
    expect(formatted.weight).toBe("33.1%");
    expect(formatted.status).toBe("scaffold");
    expect(formatted.excerpt).toContain("<mark>workflows</mark>");
  });
});
