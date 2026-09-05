import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { authoredHeadings, domainContentStatus } from "../../src/lib/content-status";

interface ContentStatusCase {
  name: string;
  markdown: string;
  authoredHeadings: string[];
}

const fixturePath = new URL("../../../tests/fixtures/note-content-status.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as { cases: ContentStatusCase[] };

describe("content status", () => {
  for (const fixtureCase of fixture.cases) {
    test(fixtureCase.name, () => {
      expect(authoredHeadings(fixtureCase.markdown)).toEqual(fixtureCase.authoredHeadings);
    });
  }

  test("distinguishes scaffold, partial, and authored domains", () => {
    expect(domainContentStatus([fixture.cases[0].markdown])).toBe("scaffold");
    expect(domainContentStatus([fixture.cases[1].markdown])).toBe("partial");
    expect(domainContentStatus([fixture.cases[2].markdown])).toBe("authored");
  });
});
