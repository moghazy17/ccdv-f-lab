---
domain_name: "Claude Code"
domain_number: 3
domain_weight: "3.1%"
sub_skills:
  - name: "Claude Code Operation"
    weight: "3.1%"
---

# Claude Code

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

## Claude Code Operation

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

### Skills

A Skill is a loaded, prompt-based markdown bundle that Claude orchestrates using its own tools. It is
not a custom tool and not an MCP server: it adds instructions and assets to the context rather than
adding a callable endpoint, and its lifecycle is loading rather than invocation.

### Subagents

A subagent runs in its own separate context window and returns only a summary to the main
conversation, which keeps its intermediate work out of the parent's context. That isolation is the
reason to reach for one — it is a context-management tool before it is a parallelism tool.

### Hooks as safety controls

A hook is a callback that runs in the harness's own process, before a tool executes, and can block
the operation **independently of what the model decided**. That independence is the whole point, and
it is what separates a hook from an instruction.

A `PreToolUse` hook receives the pending call as JSON on standard input and decides by exiting: a
non-zero exit denies the action. A denial is the hook working correctly, not an error.

This repository runs one. See [worked example inventory](#worked-example-inventory).

### Settings and permissions

`settings.json` carries permission rules — allow, ask, and deny — and registers hooks. Unlike an
instruction file, a settings rule is enforced by the client regardless of what Claude decides.

The `/permissions` command manages those rules interactively, showing them by scope.

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

### Auto mode

A permission mode decides what runs without asking. In Manual mode, Claude Code stops and asks before
most actions that edit files, run shell commands, or reach the network. In auto mode, "a second
model, the classifier, reviews actions instead of you".

Two neighbouring modes are worth telling apart: `acceptEdits` writes files without prompting while
still requiring an allow rule for other shell commands, and `dontAsk` denies anything that would
otherwise prompt, which suits an unattended run.

### Repository initialization

`/init` initializes a project with a `CLAUDE.md` guide — the starting point for the project scope of
the hierarchy above.

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
