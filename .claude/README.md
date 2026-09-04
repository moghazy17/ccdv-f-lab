# Claude Code configuration

This is the project configuration for the study kit. It demonstrates the blueprint sub-skill
`Claude Code Operation`; the executable hook also demonstrates `Claude Hooks`.

## Components

[`../CLAUDE.md`](../CLAUDE.md) supplies the project-level instruction layer and links the repository
rules. It demonstrates rules and the `CLAUDE.md` hierarchy.

`settings.json` permits the keyless quality gates and registers the `PreToolUse` hook. It
demonstrates `settings.json` and permissions.

`commands/verify-triage.md` implements `/verify-triage`, which runs the keyless quality gates. It
demonstrates custom slash commands.

`skills/triage-security/SKILL.md` provides a reusable security-review workflow. It demonstrates
skills.

`agents/triage-security-reviewer.md` defines a read-only, focused security-review subagent. It
demonstrates agents.

`hooks/prevent_destructive_actions.py` blocks protected-file writes and destructive shell commands.
It demonstrates hooks as safety controls.

## Hook behavior

The hook reads Claude Code `PreToolUse` JSON from standard input. It exits `2` with a deny decision
for writes to `AGENTS.md`, `BLUEPRINT.md`, `SOURCES.md`, or `LICENSE`, and for destructive shell
commands. It exits `0` for permitted actions. `settings.json` invokes it relative to the repository
working directory. Test it directly from the repository root:

```powershell
'{"tool_name":"Write","tool_input":{"file_path":"BLUEPRINT.md"}}' |
  python .claude/hooks/prevent_destructive_actions.py
```

The `PreToolUse` / `matcher` / `hooks` / `command` configuration structure was verified from local
Claude Code hook examples. The script has direct tests as a second, independent check of its deny
behavior.
