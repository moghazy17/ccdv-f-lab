import { execFileSync } from "node:child_process";

import { describe, expect, test } from "vitest";

import {
  defaultConfigDraft,
  generateConfiguration,
  type ConfigDraft,
  type GeneratedConfiguration
} from "../../../src/lib/claude-code/generate";

function generated(draft: ConfigDraft): GeneratedConfiguration {
  const result = generateConfiguration(draft);
  if ("errors" in result) throw new Error(result.errors.join(" "));
  return result;
}

describe("configuration file generator", () => {
  test("emits the three contracted file shapes", () => {
    const result = generated({ ...defaultConfigDraft(), allow: "Read", deny: "Bash(rm:*)" });
    expect(result.files.map((file) => file.path)).toEqual([
      "CLAUDE.md",
      ".claude/settings.json",
      ".claude/hooks/prevent-destructive-actions.py"
    ]);
    expect(result.files[0]?.contents).toContain("context");
    expect(result.files[0]?.contents).toContain("not enforced configuration");
    expect(JSON.parse(result.files[1]?.contents ?? "")).toMatchObject({
      permissions: { allow: ["Read"], deny: ["Bash(rm:*)"] },
      hooks: { PreToolUse: [{ matcher: "Bash|Write|Edit" }] }
    });
    const hook = result.files[2]?.contents ?? "";
    expect(hook).toContain("#!/usr/bin/env python3");
    execFileSync("python", ["-c", "import sys; compile(sys.stdin.read(), 'hook.py', 'exec')"], {
      input: hook
    });
  });

  test.each([
    ["an empty matcher", (draft: ConfigDraft) => ({ ...draft, hook: { ...draft.hook, matcher: "" } }), "matches nothing"],
    ["a missing hook command", (draft: ConfigDraft) => ({ ...draft, hook: { ...draft.hook, command: "" } }), "not a hook"],
    ["overlapping permission", (draft: ConfigDraft) => ({ ...draft, allow: "Read", deny: "Read" }), "both allow and deny"],
    ["empty settings", (draft: ConfigDraft) => ({ ...draft, hook: { ...draft.hook, enabled: false } }), "nothing to generate"]
  ])("refuses %s rather than emitting files", (_label, amend, explanation) => {
    const result = generateConfiguration(amend(defaultConfigDraft()));
    expect("errors" in result).toBe(true);
    if ("errors" in result) expect(result.errors.join(" ")).toContain(explanation);
  });
});
