---
domain_name: "Claude Code"
domain_number: 3
domain_weight: "3.1%"
sub_skills:
  - name: "Claude Code Operation"
    weight: "3.1%"
---

# Decision tables

Each table answers one question: given a situation, which option, and when not to reach for it.

## Claude Code Operation

### Shaping behavior versus enforcing it

The single highest-value table in this domain. An item that asks how to *prevent* something is asking
which row of this table you reach for.

| Option | Choose this when | Do not choose it when |
|---|---|---|
| `CLAUDE.md` instruction | You want to shape how Claude approaches work — conventions, context, preferences | You need the action blocked. Instruction files are context, not enforced configuration, so a firmly worded prohibition is still only a suggestion |
| `settings.json` permission rule | You want the client to allow, ask, or deny a category of tool call, enforced regardless of what the model decides | The decision depends on inspecting the specific call's arguments |
| `PreToolUse` hook | You need deterministic refusal based on the actual pending call, running in the harness before the tool executes | A static rule already covers it — a hook is code to maintain |

### Clearing versus compacting a session

| Option | Choose this when | Do not choose it when |
|---|---|---|
| `/clear` | Starting unrelated work. Begins a new conversation with empty context; the previous one is reachable with `/resume` | You still need what was established — it is gone from this conversation |
| `/compact` | Context is filling but the work continues. Summarizes the conversation so far and continues the same conversation | You want a clean slate; compaction carries a summary forward |

### Interactive versus headless

| Option | Choose this when | Do not choose it when |
|---|---|---|
| Interactive session | Work is exploratory and you will steer it turn by turn | A script or CI job needs one deterministic result |
| `-p` / `--print` | A script needs a single non-interactive run it can branch on, since the exit status is 0 on success and non-zero on failure | You need to iterate — each run is one shot unless you pass `--continue` or `--resume` |
| `-p` with `--bare` | CI, where the same result is wanted on every machine: it skips hooks, skills, custom commands, subagents, plugins, MCP servers, and `CLAUDE.md` | You depend on project configuration — bare mode never reads it |

### Output format for a headless run

| Option | Choose this when | Do not choose it when |
|---|---|---|
| `text` | A human reads it, or the next tool wants plain text. The default | You need session metadata or a machine-readable shape |
| `json` | A script parses one result and wants metadata with it; the text arrives in the `result` field | You want output before the run finishes |
| `stream-json` | Output should appear as it is produced. Newline-delimited, one JSON event per line, `system/init` first and a `result` message last | A simple script would rather read one payload; streaming also requires `--verbose` and `--include-partial-messages` |

### Permission mode

| Option | Choose this when | Do not choose it when |
|---|---|---|
| Manual | You want to approve most file edits, shell commands, and network access yourself | The interruptions outweigh the oversight |
| Auto | You want a second model, the classifier, to review actions instead of you | The work is sensitive enough to warrant a human on each call |
| `acceptEdits` | File edits are routine and should not prompt | Shell commands and network access should also run freely — they still need an allow rule |
| `dontAsk` | An unattended run should deny anything that would otherwise prompt rather than wait | Someone is available to answer |

### Where a custom command belongs

| Option | Choose this when | Do not choose it when |
|---|---|---|
| `~/.claude/commands/` | The command is yours, across every project on this machine | Teammates need it — nothing there is shared |
| `.claude/commands/` in the repository | The whole team should get it on clone, through source control | It encodes something personal to your setup |
