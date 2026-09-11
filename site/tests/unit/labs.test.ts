import { describe, expect, test } from "vitest";

import { labs } from "../../src/lib/runtime/labs";

const NAMED_CONCEPTS = [
  "pinned model versions",
  "adaptive thinking",
  "structured output",
  "tool use and dispatch",
  "the MCP server",
  "prompt caching",
  "the batch path",
  "guardrails",
  "the eval harness"
];

describe("the lab catalogue", () => {
  test("enumerates all thirteen lab modules", () => {
    expect(labs).toHaveLength(13);
  });

  test("every entry names a concept and a domain", () => {
    for (const lab of labs) {
      expect(lab.concept.length).toBeGreaterThan(0);
      expect(lab.domainNumber).toBeGreaterThanOrEqual(1);
      expect(lab.domainNumber).toBeLessThanOrEqual(8);
      expect(lab.notePath).toMatch(/^notes\/\d{2}-.+\/$/);
      expect(lab.sourcePath.length).toBeGreaterThan(0);
      expect(lab.entrySource.length).toBeGreaterThan(0);
    }
  });

  test("every named concept from the blueprint is reachable", () => {
    const concepts = labs.map((lab) => lab.concept);
    for (const concept of NAMED_CONCEPTS) {
      expect(concepts).toContain(concept);
    }
  });

  test("slugs are unique and cover the thirteen expected modules", () => {
    const slugs = labs.map((lab) => lab.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(slugs)).toEqual(
      new Set([
        "batch",
        "caching",
        "config",
        "context",
        "ingest",
        "loop",
        "output",
        "router",
        "secrets",
        "security",
        "transport",
        "mcp-server",
        "evals"
      ])
    );
  });

  test("runnable is derived from the import probe, not hard-coded", () => {
    const mcpServer = labs.find((lab) => lab.slug === "mcp-server");
    expect(mcpServer).toBeDefined();
    expect(mcpServer?.runnable).toBe(false);
    expect(mcpServer?.unrunnableReason).toMatch(/mcp/i);

    const runnableCount = labs.filter((lab) => lab.runnable).length;
    expect(runnableCount).toBe(12);
    for (const lab of labs) {
      if (lab.runnable) {
        expect(lab.unrunnableReason).toBeNull();
      } else {
        expect(lab.unrunnableReason).not.toBeNull();
      }
    }
  });
});
