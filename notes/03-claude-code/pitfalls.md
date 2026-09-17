---
domain_name: "Claude Code"
domain_number: 3
domain_weight: "3.1%"
sub_skills:
  - name: "Claude Code Operation"
    weight: "3.1%"
---

# Pitfalls

## Claude Code Operation

### Believing a nearer instruction file overrides the ones above it

This is the misconception most worth unlearning, because it is what the word "hierarchy" suggests and
it is not what happens. Discovered instruction files are **concatenated into context**, ordered from
the filesystem root down to the working directory. A subdirectory file does not replace, shadow, or
win against the project file above it — both are in context together.

If a project file and a subdirectory file disagree, the model reconciles two present instructions as
text. It does not apply a precedence rule that deletes one of them.

### Believing an instruction file enforces anything

An instruction file is context. The documentation says so directly, and names the alternative: to
block an action regardless of what Claude decides, use a `PreToolUse` hook.

The practical form of the error: writing "never delete files" in `CLAUDE.md` and treating the problem
as solved. It is a strong suggestion to a model that generally follows suggestions. It is not a
control. A settings rule or a hook is a control.

### Treating `/clear` and `/compact` as two words for the same thing

They do opposite things to the conversation. `/clear` starts a new conversation with empty context.
`/compact` summarizes the conversation so far and continues the same one. Reaching for `/clear` when
you meant `/compact` discards the context you were trying to preserve.

### Reading a hook's non-zero exit as a failure

A `PreToolUse` hook denies by exiting non-zero. That is the hook working. Treating the exit code as
an error — in a wrapper script, in a log, or in a mental model of what happened — inverts the meaning
of the control.

### Assuming a hook denies only what its description says

A hook does what its code does. This repository's own hook is the worked example: its summary
describes protecting a ground-truth file from writes, but the match runs over the whole shell command
string, so it also denies a command that merely *mentions* the filename without writing to it. The
repository's own README described a wider set of protected files than the code held, and nothing
caught the divergence until the behavior was recorded rather than described.

The general lesson for the exam and for practice: a safety control is specified by its code, and a
description of it drifts unless something mechanical keeps the two together.

### Expecting project configuration to load under `--bare`

`--bare` exists to make a run reproducible, and it gets there by skipping auto-discovery of hooks,
skills, custom commands, subagents, plugins, MCP servers, and `CLAUDE.md`. A run that depends on any
of those will behave differently — which is the point, but it surprises people who added `--bare` for
speed alone.

### Forgetting that streaming needs more than one flag

`--output-format stream-json` on its own is not the whole incantation: streamed token output also
requires `--verbose` and `--include-partial-messages`.

### Putting a shared command in the personal directory

A command under `~/.claude/commands/` is available to you on that machine and to nobody else. If
teammates should get it on clone, it belongs in `.claude/commands/` in the repository, where source
control carries it.

### Over-studying this domain

Claude Code is 3.1% of the exam, about two items. It is pleasant material and it is tempting because
it is the tool in front of you. Applications and Integration is 33.1%. Budget accordingly.
