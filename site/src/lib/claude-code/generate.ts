/** Generate the three portable configuration artifacts used by the configuration builder. */

export interface HookDraft {
  enabled: boolean;
  name: string;
  matcher: string;
  command: string;
  protectedPaths: string;
}

export interface ConfigDraft {
  projectName: string;
  instructions: string;
  allow: string;
  deny: string;
  hook: HookDraft;
}

export interface GeneratedFile {
  path: string;
  language: "json" | "markdown" | "python";
  contents: string;
}

export interface HookSample {
  label: string;
  payload: Record<string, unknown>;
  expected: "allow" | "deny";
}

export interface GeneratedConfiguration {
  files: readonly GeneratedFile[];
  readback: readonly string[];
  samples: readonly HookSample[];
}

export interface GenerationFailure {
  errors: readonly string[];
}

export type GenerationResult = GeneratedConfiguration | GenerationFailure;

interface SettingsHook {
  matcher: string;
  hooks: Array<{ type: "command"; command: string }>;
}

const DESTRUCTIVE_COMMAND =
  "(?:\\brm\\s+-[a-z]*[rf]|\\brmdir\\s+/[sq]|\\bdel\\s+/[a-z]*[sqf]|\\bremove-item\\b.{0,80}\\b-recurse\\b|\\bgit\\s+reset\\s+--hard\\b|\\bgit\\s+clean\\s+-[a-z]*f|\\bformat\\s+[a-z]:|\\bmkfs\\b|\\bdd\\s+if=)";

/** A complete, credential-free starting state for the browser form. */
export function defaultConfigDraft(): ConfigDraft {
  return {
    projectName: "My project",
    instructions: "Explain changes briefly and keep the project checks passing.",
    allow: "",
    deny: "",
    hook: {
      enabled: true,
      name: "prevent-destructive-actions",
      matcher: "Bash|Write|Edit",
      command: "python .claude/hooks/prevent-destructive-actions.py",
      protectedPaths: "LICENSE"
    }
  };
}

/** Return form-level reasons why this draft must not emit a configuration file. */
export function validateConfigDraft(draft: ConfigDraft): readonly string[] {
  const allow = entries(draft.allow);
  const deny = entries(draft.deny);
  const overlap = allow.filter((permission) => deny.includes(permission));
  const errors: string[] = [];
  if (overlap.length > 0) {
    errors.push(
      `Permission${overlap.length === 1 ? "" : "s"} cannot appear in both allow and deny: ${overlap.join(", ")}.`
    );
  }
  if (draft.hook.enabled && draft.hook.matcher.trim().length === 0) {
    errors.push("A hook needs a matcher. An empty matcher matches nothing, so the hook would be inert.");
  }
  if (draft.hook.enabled && !isMatcher(draft.hook.matcher)) {
    errors.push("Use tool names separated by | for the matcher, such as Bash|Write|Edit.");
  }
  if (draft.hook.enabled && draft.hook.command.trim().length === 0) {
    errors.push("A hook entry needs a command. Without one, it is not a hook.");
  }
  if (draft.hook.enabled && !isSafeHookName(draft.hook.name)) {
    errors.push("Use a hook filename made of lowercase letters, numbers, and hyphens.");
  }
  // A hook that matches only file tools decides by protected filename. With no filenames it can
  // never deny anything, so it is inert in the same way an empty matcher is — and the page could
  // not honour its promise to show the candidate a real denial.
  if (
    draft.hook.enabled &&
    isMatcher(draft.hook.matcher) &&
    draft.hook.matcher.trim().length > 0 &&
    !matcherMatches(draft.hook.matcher, "Bash") &&
    entries(draft.hook.protectedPaths).length === 0
  ) {
    errors.push(
      "A hook that matches only file tools needs at least one protected file name, " +
        "or it can never deny anything."
    );
  }
  if (allow.length === 0 && deny.length === 0 && !draft.hook.enabled) {
    errors.push("There is nothing to generate: add a permission or register a hook.");
  }
  if (!draft.hook.enabled && (allow.length > 0 || deny.length > 0)) {
    errors.push("This builder always emits a Python hook. Register the hook before generating its three files.");
  }
  return errors;
}

/** Generate the portable instruction, settings, and Python hook files, or refuse invalid input. */
export function generateConfiguration(draft: ConfigDraft): GenerationResult {
  const errors = validateConfigDraft(draft);
  if (errors.length > 0) {
    return { errors };
  }

  const allow = entries(draft.allow);
  const deny = entries(draft.deny);
  const protectedPaths = entries(draft.hook.protectedPaths);
  const settings = settingsContents(draft.hook, allow, deny);
  const files: GeneratedFile[] = [
    { path: "CLAUDE.md", language: "markdown", contents: instructionContents(draft) },
    {
      path: ".claude/settings.json",
      language: "json",
      contents: `${JSON.stringify(settings, null, 2)}\n`
    },
    {
      path: `.claude/hooks/${draft.hook.name}.py`,
      language: "python",
      contents: hookContents(draft.hook.matcher, protectedPaths)
    }
  ];
  return {
    files,
    readback: readback(allow, deny, draft.hook),
    samples: hookSamples(draft.hook.matcher, protectedPaths)
  };
}

/** Representative cases exported to Python so it executes the same generated hook source. */
export function representativeConfigurationFixtures(): readonly {
  name: string;
  draft: ConfigDraft;
}[] {
  const defaultDraft = defaultConfigDraft();
  return [
    { name: "shell-and-file-protection", draft: defaultDraft },
    {
      name: "file-protection-only",
      draft: {
        ...defaultDraft,
        allow: "Read",
        hook: { ...defaultDraft.hook, matcher: "Write|Edit", protectedPaths: "package-lock.json" }
      }
    },
    {
      name: "permission-policy-with-shell-hook",
      draft: {
        ...defaultDraft,
        deny: "Bash(rm:*)",
        hook: { ...defaultDraft.hook, matcher: "Bash", protectedPaths: "" }
      }
    }
  ];
}

function entries(value: string): string[] {
  return [...new Set(value.split(/[\n,]/).map((entry) => entry.trim()).filter(Boolean))];
}

function isSafeHookName(name: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name.trim());
}

function isMatcher(matcher: string): boolean {
  return /^[A-Za-z][A-Za-z0-9]*(?:\|[A-Za-z][A-Za-z0-9]*)*$/.test(matcher);
}

function instructionContents(draft: ConfigDraft): string {
  const name = draft.projectName.trim() || "Project";
  const instructions = draft.instructions.trim() || "Follow the project conventions and verify changes.";
  return `# ${name}\n\n${instructions}\n\n## Enforcement boundary\n\nThis instruction file provides context to Claude. It is not enforced configuration. Use settings rules or hooks when an action must be enforced.\n`;
}

function settingsContents(hook: HookDraft, allow: string[], deny: string[]): Record<string, unknown> {
  const settings: { permissions?: { allow?: string[]; deny?: string[] }; hooks?: { PreToolUse: SettingsHook[] } } = {};
  if (allow.length > 0 || deny.length > 0) {
    settings.permissions = {};
    if (allow.length > 0) settings.permissions.allow = allow;
    if (deny.length > 0) settings.permissions.deny = deny;
  }
  if (hook.enabled) {
    settings.hooks = {
      PreToolUse: [{ matcher: hook.matcher.trim(), hooks: [{ type: "command", command: hook.command.trim() }] }]
    };
  }
  return settings;
}

function readback(allow: string[], deny: string[], hook: HookDraft): string[] {
  return [
    allow.length > 0 ? `Permits: ${allow.join(", ")}.` : "Permits: no permissions listed.",
    deny.length > 0 ? `Denies: ${deny.join(", ")}.` : "Denies: no permissions listed.",
    hook.enabled
      ? `Registers: PreToolUse matcher “${hook.matcher.trim()}” runs ${hook.command.trim()}.`
      : "Registers: no hooks."
  ];
}

/**
 * An ordinary file path the generated hook will not deny.
 *
 * The permitted sample must actually be permitted. A fixed path would be denied whenever the
 * candidate happened to protect that same basename, and the page would then label a denial
 * "Ordinary action", teaching the opposite of what it set out to show.
 */
function ordinaryPath(protectedPaths: readonly string[]): string {
  const protectedNames = new Set(
    protectedPaths.map((path) => path.split("/").at(-1)?.toUpperCase() ?? "")
  );
  let candidate = "src/example.py";
  let suffix = 0;
  while (protectedNames.has(candidate.split("/").at(-1)?.toUpperCase() ?? "")) {
    suffix += 1;
    candidate = `src/example-${suffix}.py`;
  }
  return candidate;
}

function hookSamples(matcher: string, protectedPaths: string[]): HookSample[] {
  const matchesBash = matcherMatches(matcher, "Bash");
  const matchingTool = matchesBash ? "Bash" : firstMatchingTool(matcher);
  const protectedPath = protectedPaths[0] ?? "protected-file";
  // Each payload must be one Claude Code could really send. A file tool carries `file_path` and a
  // shell tool carries `command`; a sample mixing both would prove a denial no real `PreToolUse`
  // payload could trigger, on a page whose whole claim is that it shows genuine hook behaviour.
  const denyPayload = matchesBash
    ? { tool_name: "Bash", tool_input: { command: "git reset --hard" } }
    : { tool_name: matchingTool, tool_input: { file_path: protectedPath } };
  const allowPayload =
    matchingTool === "Bash"
      ? { tool_name: "Bash", tool_input: { command: "python -V" } }
      : { tool_name: matchingTool, tool_input: { file_path: ordinaryPath(protectedPaths) } };
  return [
    { label: "Destructive action", payload: denyPayload, expected: "deny" },
    { label: "Ordinary action", payload: allowPayload, expected: "allow" }
  ];
}

function matcherMatches(matcher: string, toolName: string): boolean {
  try {
    return new RegExp(`^(?:${matcher})$`).test(toolName);
  } catch {
    return false;
  }
}

function firstMatchingTool(matcher: string): string {
  return ["Write", "Edit", "Bash", "Read"].find((tool) => matcherMatches(matcher, tool)) ?? "Write";
}

function hookContents(matcher: string, protectedPaths: string[]): string {
  const names = JSON.stringify(protectedPaths.map((path) => path.replace(/\\/g, "/").split("/").pop()));
  return `#!/usr/bin/env python3
"""Deny destructive PreToolUse actions selected by this project configuration."""

from __future__ import annotations

import json
import re
import sys
from pathlib import PurePath
from typing import Any

MATCHER = re.compile(${JSON.stringify(`^(?:${matcher})$`)})
PROTECTED_FILES = frozenset(${names})
DESTRUCTIVE_COMMAND = re.compile(${JSON.stringify(DESTRUCTIVE_COMMAND)}, re.IGNORECASE)


def deny(message: str) -> int:
    """Write the hook decision to standard error and return the denial exit code."""
    print(json.dumps({"hookSpecificOutput": {"permissionDecision": "deny"}, "systemMessage": message}), file=sys.stderr)
    return 2


def protected_path(value: object) -> bool:
    """Return whether a tool path names one of this hook's protected files."""
    return isinstance(value, str) and PurePath(value.replace("\\\\", "/")).name in PROTECTED_FILES


def decide(payload: dict[str, Any]) -> int:
    """Return 2 for a denied action and 0 for an allowed one."""
    tool_name = payload.get("tool_name")
    if not isinstance(tool_name, str) or MATCHER.fullmatch(tool_name) is None:
        return 0
    tool_input = payload.get("tool_input", {})
    if not isinstance(tool_input, dict):
        return 0
    if protected_path(tool_input.get("file_path")):
        return deny(f"Protected file write denied by the hook: {tool_input['file_path']}")
    command = tool_input.get("command")
    if isinstance(command, str) and DESTRUCTIVE_COMMAND.search(command):
        return deny("Destructive shell command denied by the hook.")
    print("Action permitted by the hook.")
    return 0


def main() -> int:
    """Read a PreToolUse JSON document from standard input."""
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0
    return decide(payload) if isinstance(payload, dict) else 0


if __name__ == "__main__":
    raise SystemExit(main())
`;
}
