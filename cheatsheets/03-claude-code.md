# Claude Code cheat sheet

## Blueprint allocation

| Domain weight | Approximate items in a 53-item mock | Allocated mock items |
|---:|---:|---:|
| 3.1% | 1.6 | 2 |

## Sub-skills

| Sub-skill | Weight |
|---|---:|
| Claude Code Operation | 3.1% |

## Authored note extracts

### Claude Code

This domain is 3.1% of the exam — roughly two items. It is one of the two smallest domains, and the
study time it deserves is proportional to that. Read this once, work the terminal simulator and the
configuration builder, and move on to Applications and Integration, which is ten times its weight.

Two qualifications, because the raw percentage understates and overstates different things.

It understates, because the configuration artifacts this domain covers are examined twice. `CLAUDE.md`
files and `settings.json` also sit under *Configuration Management* in Applications and Integration
at 4.1%, and hooks sit under *Claude Hooks* in Security and Safety at 1.0%. Time spent understanding
what an instruction file does and what a hook does is therefore worth more than 3.1% suggests.

It overstates, because two items cannot test breadth. Expect recognition rather than recall: which
scope a file loads at, which of two commands discards history, whether a rule is enforced or merely
suggested.

Source note: `notes/03-claude-code/README.md`

### Rules and instruction hierarchy

Claude Code discovers instruction files at four scopes and loads them in a documented order: managed
policy, then user, then project, then local.

The single most important property, and the one most often got backwards: **discovered files are
concatenated into context, ordered from the filesystem root down to the working directory. A nearer
file does not override a file above it.** Both instructions end up in context. If a project file says
one thing and a subdirectory file says another, the model sees both and reconciles them as text — it
does not apply a precedence rule that deletes one.

The second property follows from the first, and is the thing worth carrying into the exam:

> Claude treats them as context, not enforced configuration. To block an action regardless of what
> Claude decides, use a `PreToolUse` hook instead.

An instruction file shapes behavior. A settings rule or a hook enforces it. A question that offers
"add a line to `CLAUDE.md`" as a way to *prevent* something is offering the wrong tool, however
firmly the line is worded.

Source note: `notes/03-claude-code/README.md`

### Custom slash commands

A command is a markdown file, and where the file lives decides who gets it.

Personal commands live under `~/.claude/commands/` and are available on that machine across every
project. Project commands live under `.claude/commands/` at the repository root, are shared through
source control, and load for anyone who clones the repository. The command's name derives from the
file or directory name.

When the same name exists at more than one scope, the resolution order runs enterprise, personal,
project, nested, plugin, bundled.

Built-in commands are different in kind from bundled skills: a built-in command executes fixed logic
directly, while a skill is prompt-based and gives Claude instructions to orchestrate work.

Source note: `notes/03-claude-code/README.md`

### Skills

A Skill is a loaded, prompt-based markdown bundle that Claude orchestrates using its own tools. It is
not a custom tool and not an MCP server: it adds instructions and assets to the context rather than
adding a callable endpoint, and its lifecycle is loading rather than invocation.

Source note: `notes/03-claude-code/README.md`

### Subagents

A subagent runs in its own separate context window and returns only a summary to the main
conversation, which keeps its intermediate work out of the parent's context. That isolation is the
reason to reach for one — it is a context-management tool before it is a parallelism tool.

Source note: `notes/03-claude-code/README.md`

### Hooks as safety controls

A hook is a callback that runs in the harness's own process, before a tool executes, and can block
the operation **independently of what the model decided**. That independence is the whole point, and
it is what separates a hook from an instruction.

A `PreToolUse` hook receives the pending call as JSON on standard input and decides by exiting: a
non-zero exit denies the action. A denial is the hook working correctly, not an error.

This repository runs one. See [worked example inventory](#worked-example-inventory).

Source note: `notes/03-claude-code/README.md`

### Settings and permissions

`settings.json` carries permission rules — allow, ask, and deny — and registers hooks. Unlike an
instruction file, a settings rule is enforced by the client regardless of what Claude decides.

The `/permissions` command manages those rules interactively, showing them by scope.

Source note: `notes/03-claude-code/README.md`

### Session management

Two commands are routinely confused, and the distinction is exactly the kind of thing two items can
test.

`/clear` starts a new conversation with empty context. The history is gone from the session; the
previous conversation can be returned to with `/resume`.

`/compact` frees context "by summarizing the conversation so far" — and continues the **same**
conversation. It does not start a new one.

So: reach for `/compact` when the context window is filling but the work is ongoing, and `/clear`
when starting something unrelated. From the command line, `--continue` resumes the most recent
conversation and `--resume <session-id>` a specific one.

Source note: `notes/03-claude-code/README.md`

### Headless and streaming modes

Headless mode is `-p` (or `--print`): one non-interactive run, suitable for scripts and CI. It exits
0 on success and non-zero on failure, so a script can branch on the status, and it reads standard
input, so data can be piped through it.

`--output-format` selects the shape of the result:

- `text` — plain text, and the default.
- `json` — structured, with the text in the `result` field alongside session metadata.
- `stream-json` — newline-delimited JSON, one event per line.

Streaming needs `--output-format stream-json` together with `--verbose` and
`--include-partial-messages`. The first event is `system/init`, reporting the model, tools, and MCP
servers; the last line of the stream is a `result` message carrying the final response text and
session metadata.

`--bare` skips auto-discovery of hooks, skills, custom commands, subagents, plugins, MCP servers, and
`CLAUDE.md`, which is what makes a scripted run reproducible across machines.

Source note: `notes/03-claude-code/README.md`

### Auto mode

A permission mode decides what runs without asking. In Manual mode, Claude Code stops and asks before
most actions that edit files, run shell commands, or reach the network. In auto mode, "a second
model, the classifier, reviews actions instead of you".

Two neighbouring modes are worth telling apart: `acceptEdits` writes files without prompting while
still requiring an allow rule for other shell commands, and `dontAsk` denies anything that would
otherwise prompt, which suits an unattended run.

Source note: `notes/03-claude-code/README.md`

### Repository initialization

`/init` initializes a project with a `CLAUDE.md` guide — the starting point for the project scope of
the hierarchy above.

Source note: `notes/03-claude-code/README.md`

### Worked example inventory

This repository's own `.claude/` directory is the worked example, and every part of it is rendered on
the site from the files themselves rather than described second-hand.

| Component | Where it lives | What it demonstrates |
|---|---|---|
| Rules | `CLAUDE.md` at the repository root | The project scope of the instruction hierarchy |
| Settings | `.claude/settings.json` | Permission rules and hook registration |
| Custom command | `.claude/commands/verify-triage.md` | A project-scoped slash command |
| Skill | `.claude/skills/triage-security/SKILL.md` | A reusable prompt-based workflow |
| Subagent | `.claude/agents/triage-security-reviewer.md` | A read-only, focused subagent |
| Hook | `.claude/hooks/prevent_destructive_actions.py` | A `PreToolUse` hook that denies destructive actions |

The hook is worth reading closely, because its real behavior is broader than a summary suggests: it
matches a protected filename anywhere in a shell command, so it denies commands that merely mention
the file without writing to it. The site publishes a recording of what the hook actually decides for
each sample payload rather than a description of what it is meant to do, so the two cannot drift
apart.

Source note: `notes/03-claude-code/README.md`

### Decision tables

Each table answers one question: given a situation, which option, and when not to reach for it.

Source note: `notes/03-claude-code/decision-tables.md`

### Shaping behavior versus enforcing it

The single highest-value table in this domain. An item that asks how to *prevent* something is asking
which row of this table you reach for.

| Option | Choose this when | Do not choose it when |
|---|---|---|
| `CLAUDE.md` instruction | You want to shape how Claude approaches work — conventions, context, preferences | You need the action blocked. Instruction files are context, not enforced configuration, so a firmly worded prohibition is still only a suggestion |
| `settings.json` permission rule | You want the client to allow, ask, or deny a category of tool call, enforced regardless of what the model decides | The decision depends on inspecting the specific call's arguments |
| `PreToolUse` hook | You need deterministic refusal based on the actual pending call, running in the harness before the tool executes | A static rule already covers it — a hook is code to maintain |

Source note: `notes/03-claude-code/decision-tables.md`

### Clearing versus compacting a session

| Option | Choose this when | Do not choose it when |
|---|---|---|
| `/clear` | Starting unrelated work. Begins a new conversation with empty context; the previous one is reachable with `/resume` | You still need what was established — it is gone from this conversation |
| `/compact` | Context is filling but the work continues. Summarizes the conversation so far and continues the same conversation | You want a clean slate; compaction carries a summary forward |

Source note: `notes/03-claude-code/decision-tables.md`

### Interactive versus headless

| Option | Choose this when | Do not choose it when |
|---|---|---|
| Interactive session | Work is exploratory and you will steer it turn by turn | A script or CI job needs one deterministic result |
| `-p` / `--print` | A script needs a single non-interactive run it can branch on, since the exit status is 0 on success and non-zero on failure | You need to iterate — each run is one shot unless you pass `--continue` or `--resume` |
| `-p` with `--bare` | CI, where the same result is wanted on every machine: it skips hooks, skills, custom commands, subagents, plugins, MCP servers, and `CLAUDE.md` | You depend on project configuration — bare mode never reads it |

Source note: `notes/03-claude-code/decision-tables.md`

### Output format for a headless run

| Option | Choose this when | Do not choose it when |
|---|---|---|
| `text` | A human reads it, or the next tool wants plain text. The default | You need session metadata or a machine-readable shape |
| `json` | A script parses one result and wants metadata with it; the text arrives in the `result` field | You want output before the run finishes |
| `stream-json` | Output should appear as it is produced. Newline-delimited, one JSON event per line, `system/init` first and a `result` message last | A simple script would rather read one payload; streaming also requires `--verbose` and `--include-partial-messages` |

Source note: `notes/03-claude-code/decision-tables.md`

### Permission mode

| Option | Choose this when | Do not choose it when |
|---|---|---|
| Manual | You want to approve most file edits, shell commands, and network access yourself | The interruptions outweigh the oversight |
| Auto | You want a second model, the classifier, to review actions instead of you | The work is sensitive enough to warrant a human on each call |
| `acceptEdits` | File edits are routine and should not prompt | Shell commands and network access should also run freely — they still need an allow rule |
| `dontAsk` | An unattended run should deny anything that would otherwise prompt rather than wait | Someone is available to answer |

Source note: `notes/03-claude-code/decision-tables.md`

### Where a custom command belongs

| Option | Choose this when | Do not choose it when |
|---|---|---|
| `~/.claude/commands/` | The command is yours, across every project on this machine | Teammates need it — nothing there is shared |
| `.claude/commands/` in the repository | The whole team should get it on clone, through source control | It encodes something personal to your setup |

Source note: `notes/03-claude-code/decision-tables.md`

### Believing a nearer instruction file overrides the ones above it

This is the misconception most worth unlearning, because it is what the word "hierarchy" suggests and
it is not what happens. Discovered instruction files are **concatenated into context**, ordered from
the filesystem root down to the working directory. A subdirectory file does not replace, shadow, or
win against the project file above it — both are in context together.

If a project file and a subdirectory file disagree, the model reconciles two present instructions as
text. It does not apply a precedence rule that deletes one of them.

Source note: `notes/03-claude-code/pitfalls.md`

### Believing an instruction file enforces anything

An instruction file is context. The documentation says so directly, and names the alternative: to
block an action regardless of what Claude decides, use a `PreToolUse` hook.

The practical form of the error: writing "never delete files" in `CLAUDE.md` and treating the problem
as solved. It is a strong suggestion to a model that generally follows suggestions. It is not a
control. A settings rule or a hook is a control.

Source note: `notes/03-claude-code/pitfalls.md`

### Treating `/clear` and `/compact` as two words for the same thing

They do opposite things to the conversation. `/clear` starts a new conversation with empty context.
`/compact` summarizes the conversation so far and continues the same one. Reaching for `/clear` when
you meant `/compact` discards the context you were trying to preserve.

Source note: `notes/03-claude-code/pitfalls.md`

### Reading a hook's non-zero exit as a failure

A `PreToolUse` hook denies by exiting non-zero. That is the hook working. Treating the exit code as
an error — in a wrapper script, in a log, or in a mental model of what happened — inverts the meaning
of the control.

Source note: `notes/03-claude-code/pitfalls.md`

### Assuming a hook denies only what its description says

A hook does what its code does. This repository's own hook is the worked example: its summary
describes protecting a ground-truth file from writes, but the match runs over the whole shell command
string, so it also denies a command that merely *mentions* the filename without writing to it. The
repository's own README described a wider set of protected files than the code held, and nothing
caught the divergence until the behavior was recorded rather than described.

The general lesson for the exam and for practice: a safety control is specified by its code, and a
description of it drifts unless something mechanical keeps the two together.

Source note: `notes/03-claude-code/pitfalls.md`

### Expecting project configuration to load under `--bare`

`--bare` exists to make a run reproducible, and it gets there by skipping auto-discovery of hooks,
skills, custom commands, subagents, plugins, MCP servers, and `CLAUDE.md`. A run that depends on any
of those will behave differently — which is the point, but it surprises people who added `--bare` for
speed alone.

Source note: `notes/03-claude-code/pitfalls.md`

### Forgetting that streaming needs more than one flag

`--output-format stream-json` on its own is not the whole incantation: streamed token output also
requires `--verbose` and `--include-partial-messages`.

Source note: `notes/03-claude-code/pitfalls.md`

### Putting a shared command in the personal directory

A command under `~/.claude/commands/` is available to you on that machine and to nobody else. If
teammates should get it on clone, it belongs in `.claude/commands/` in the repository, where source
control carries it.

Source note: `notes/03-claude-code/pitfalls.md`

### Over-studying this domain

Claude Code is 3.1% of the exam, about two items. It is pleasant material and it is tempting because
it is the tool in front of you. Applications and Integration is 33.1%. Budget accordingly.

Source note: `notes/03-claude-code/pitfalls.md`

### Self-check

Open questions. Answer them aloud or in writing before looking anything up; the site renders these as
reveal cards, and they are not scored.

Source note: `notes/03-claude-code/self-check.md`

### Claude Code Operation

1. Name the four instruction-file scopes in the order they load.
2. A project instruction file says "use tabs" and a subdirectory file says "use spaces". What does
   Claude Code actually load, and which instruction wins?
3. You want to guarantee that a command is never run, regardless of what the model decides. Which of
   an instruction file, a settings rule, and a hook achieves that, and why do the others not?
4. Quote, in your own words, what the documentation says about whether instruction files are enforced
   configuration.
5. What is the difference between `/clear` and `/compact`? Which one keeps the conversation going?
6. After `/clear`, is the previous conversation recoverable? How?
7. A `PreToolUse` hook exits with status 2. What happened, and is that a failure?
8. Where does a `PreToolUse` hook get the details of the pending call?
9. You want a teammate to get your custom slash command when they clone the repository. Where does
   the file go, and where would it be useless for that purpose?
10. What distinguishes a built-in command from a bundled skill?
11. Which flag runs Claude Code non-interactively, and what does its exit status tell a script?
12. Name the three `--output-format` values and say when each is the right choice.
13. Streaming output needs more than `--output-format stream-json`. What else, and what is the first
    event and the last line of the stream?
14. What does `--bare` skip, and why would a CI job want that?
15. In auto mode, what reviews an action instead of you?
16. How does `acceptEdits` differ from `dontAsk`?
17. What does `/init` produce?
18. What does a subagent return to the parent conversation, and why is that the reason to use one?
19. How does a Skill differ from a custom tool or an MCP server?
20. This repository's hook is described as protecting a ground-truth file from writes. Name a command
    it denies that writes nothing at all, and explain why.

Source note: `notes/03-claude-code/self-check.md`
