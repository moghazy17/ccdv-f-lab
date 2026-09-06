import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import {
  assertDerivedDomainsMatchBlueprint,
  publishedDomainRows
} from "../../src/lib/blueprint-guard";

const blueprintPath = new URL("../../../BLUEPRINT.md", import.meta.url);
const dataPath = new URL("../../src/data/blueprint.json", import.meta.url);

const blueprintText = readFileSync(blueprintPath, "utf8").replace(/\r\n/g, "\n");
const derived = JSON.parse(readFileSync(dataPath, "utf8")).domains as Array<{
  number: number;
  name: string;
  weight: number;
}>;

describe("blueprint guard", () => {
  test("the committed data agrees with the published blueprint", () => {
    expect(() => assertDerivedDomainsMatchBlueprint(derived, blueprintText)).not.toThrow();
  });

  test("published rows are read from the domain table rather than the allocation tables", () => {
    const rows = publishedDomainRows(blueprintText);

    expect(rows).toHaveLength(derived.length);
    expect(rows.map((row) => row.number)).toEqual(derived.map((domain) => domain.number));
    expect(rows.map((row) => row.name)).toEqual(derived.map((domain) => domain.name));
  });

  test("a weight edited into the generated data is rejected", () => {
    // The digest still matches, because BLUEPRINT.md was not touched. This is the case the
    // digest alone cannot see, and the reason publication must compare the figures themselves.
    const tampered = derived.map((domain, index) =>
      index === 0 ? { ...domain, weight: domain.weight + 5.6 } : domain
    );

    expect(() => assertDerivedDomainsMatchBlueprint(tampered, blueprintText)).toThrow(
      /disagrees with BLUEPRINT\.md for domain/
    );
  });

  test("a renamed domain is rejected", () => {
    const tampered = derived.map((domain, index) =>
      index === 1 ? { ...domain, name: `${domain.name} (renamed)` } : domain
    );

    expect(() => assertDerivedDomainsMatchBlueprint(tampered, blueprintText)).toThrow(
      /disagrees with BLUEPRINT\.md for domain/
    );
  });

  test("a dropped domain is rejected", () => {
    expect(() => assertDerivedDomainsMatchBlueprint(derived.slice(1), blueprintText)).toThrow(
      /holds \d+ domains, BLUEPRINT\.md publishes \d+/
    );
  });

  test("a blueprint without a complete domain table is rejected", () => {
    expect(() => publishedDomainRows("# Blueprint\n\nNo domain table here.\n")).toThrow(
      /no complete Domains section/
    );
  });
});
