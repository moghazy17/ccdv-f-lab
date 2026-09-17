import { describe, expect, test } from "vitest";

import {
  compose,
  type InstructionFragment,
  type InstructionScope
} from "../../../src/lib/claude-code/hierarchy";

const scopes: readonly InstructionScope[] = [
  { id: "managed-policy", name: "managed policy", order: 1, path: "managed policy" },
  { id: "user", name: "user", order: 2, path: "~/.claude/CLAUDE.md" },
  { id: "project", name: "project", order: 3, path: "./CLAUDE.md" },
  { id: "local", name: "local", order: 4, path: "./subdirectory/CLAUDE.md" }
];

const fragments: readonly InstructionFragment[] = [
  {
    id: "managed-rule",
    scopeId: "managed-policy",
    text: "Use named exports.",
    conflictsWith: "project-rule",
    enforceable: true,
    enforcedBy: null
  },
  {
    id: "project-rule",
    scopeId: "project",
    text: "Use default exports.",
    conflictsWith: "managed-rule",
    enforceable: true,
    enforcedBy: null
  },
  {
    id: "local-rule",
    scopeId: "local",
    text: "Do not run destructive shell commands.",
    conflictsWith: null,
    enforceable: false,
    enforcedBy: "hook"
  }
];

describe("instruction hierarchy composition", () => {
  test("concatenates every contribution in documented root-down order", () => {
    const result = compose(scopes, fragments);

    expect(result.contributions.map((contribution) => contribution.scope.name)).toEqual([
      "managed policy",
      "project",
      "local"
    ]);
    expect(result.contributions.map((contribution) => contribution.fragment.id)).toEqual([
      "managed-rule",
      "project-rule",
      "local-rule"
    ]);
  });

  test("keeps both conflicting instructions in the composed result", () => {
    const result = compose(scopes, fragments);

    expect(result.contributions.map((contribution) => contribution.fragment.text)).toContain(
      "Use named exports."
    );
    expect(result.contributions.map((contribution) => contribution.fragment.text)).toContain(
      "Use default exports."
    );
    expect(result.conflicts).toHaveLength(1);
  });

  test("does not remove a contribution under any valid arrangement", () => {
    const result = compose(scopes, fragments, {
      "managed-rule": "local",
      "project-rule": "user",
      "local-rule": "managed-policy"
    });

    expect(result.contributions.map((contribution) => contribution.fragment.id).sort()).toEqual([
      "local-rule",
      "managed-rule",
      "project-rule"
    ]);
  });

  test("fails loudly when a fragment names no known scope", () => {
    const unmatched: InstructionFragment = {
      ...fragments[0],
      scopeId: "missing-scope"
    };

    expect(() => compose(scopes, [unmatched])).toThrow(/unknown scope.*missing-scope/i);
  });
});
