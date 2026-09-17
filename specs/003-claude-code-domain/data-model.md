# Phase 1 data model: Claude Code simulator, configuration builder, and playground

Entities are grouped by where they live: build-time data derived from the repository, in-memory
state that exists only for a visit, and the small amount that is written to the candidate's device.

## Build-time data

Generated into `site/src/data/claude-code.json` by `tools/export_claude_code_data.py`. Never
hand-edited; the site reads it through a typed loader.

### SimulatedCommand

One command or mode the simulator reproduces. Roughly 12–15 entries, and the set is bounded and
shown on the page (FR-005).

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable slug, unique across the file |
| `invocation` | string \| null | What the candidate types; null for a reference component |
| `kind` | `"built-in" \| "custom" \| "mode" \| "component"` | Drives FR-004's distinction; components are reference material, not input |
| `where` | string \| null | Where a component lives; required for `"component"` |
| `scope` | `"built-in" \| "user" \| "project"` \| null | Where a custom command was loaded from; null for built-ins |
| `definedBy` | string \| null | Repository-relative file for a custom command, so FR-004 can name it |
| `blueprintFeature` | string | The blueprint phrase this covers; ties the set to the sub-skill |
| `explanation` | string | The short explanation shown beside the result (FR-007) |
| `sourceAnchor` | string | A `SOURCES.md` link anchor. **Gated**: the build fails if absent there |
| `sourceUrl` | string | The dated source destination resolved from `sourceAnchor` at export time |
| `transcript` | TranscriptStep[] | What the simulator prints |

**Validation**: `id` unique; `sourceAnchor` resolves in `SOURCES.md`; every feature the blueprint
names for *Claude Code Operation* is covered by at least one entry; `definedBy` exists on disk when
`kind` is `"custom"`.

### TranscriptStep

One line or event of simulated output.

| Field | Type | Notes |
|---|---|---|
| `stream` | `"stdout" \| "stderr" \| "event"` | `event` is a streaming-mode event (FR-010) |
| `text` | string | |
| `denial` | boolean | True when this step is a hook refusing an action, so FR-011 can attribute it to the hook rather than to the model declining. Never carried by colour alone |

### InstructionScope and InstructionFragment

The scope exercise's prepared material (FR-014).

| Field | Type | Notes |
|---|---|---|
| `scope.id` | string | `managed-policy`, `user`, `project`, `local` |
| `scope.name` | string | The documented name, not the brief's paraphrase (FR-017) |
| `scope.order` | integer | Load order; the composed result concatenates ascending |
| `scope.path` | string | Where the file lives |
| `fragment.id` | string | |
| `fragment.scopeId` | string | The scope that contributes this prepared fragment |
| `fragment.text` | string | The instruction as it would be written |
| `fragment.conflictsWith` | string \| null | Another fragment id; at least one pair is non-null |
| `fragment.enforceable` | boolean | False for at least one fragment, which is what FR-016 hangs on |
| `fragment.enforcedBy` | `"settings" \| "hook"` \| null | Named when `enforceable` is false |

**Validation**: exactly the four documented scopes, in the documented order; at least one conflicting
pair and at least one unenforceable fragment must exist, so no arrangement avoids both misconceptions
(FR-014).

### WorkedExampleComponent

One part of the repository's own Claude Code configuration, read at build time (FR-028). Files are
discovered by walking `.claude/`, never from a maintained list (FR-031); the root `CLAUDE.md` joins
that walk because it is the project instruction file the configuration README names.

| Field | Type | Notes |
|---|---|---|
| `path` | string | Repository-relative |
| `componentType` | `"rules" \| "settings" \| "command" \| "skill" \| "agent" \| "hook" \| "documentation" \| "unrecognized"` | Non-teaching files never fall through to `rules` |
| `contents` | string, optional | As on disk for one deterministic representative of each teaching type |
| `noteAnchor` | string | Section of `notes/03-claude-code/` that explains it. Build fails if missing (FR-032) |

### HookRecording

The observed behaviour of the repository's hook (FR-030). Produced by executing it, not by
describing it — see [contracts/hook-recording.md](contracts/hook-recording.md).

| Field | Type | Notes |
|---|---|---|
| `payload` | object | The `PreToolUse` document sent in |
| `label` | string | What the case demonstrates |
| `exitCode` | integer | Observed |
| `decision` | `"deny" \| "allow"` | Derived from `exitCode` |
| `message` | string | The hook's own text on standard error |

**Validation**: the recording is regenerated on every build and compared against the live hook; any
difference fails publication. The battery must include the case where a command only mentions a
protected filename, because that behaviour is real and three descriptions have missed it.

## Visit-scoped state

Held in memory for the duration of a visit and never written to the device (FR-036).

### SimulatedSession

| Field | Type | Notes |
|---|---|---|
| `turns` | Turn[] | Each an invocation and its resolved transcript |
| `surface` | `"module" \| "playground"` | |
| `compactedBefore` | integer \| null | Index before which turns were summarised, so the page can show what compaction kept against what clearing discarded (FR-008) |

**Transitions**: `clear` empties `turns` entirely. `compact` replaces the turns before a point with a
summary turn and sets `compactedBefore`. The difference between the two is the teaching point, so
both are represented rather than collapsed.

### ComposedInstructionSet

The result of the scope exercise. Derived, not stored.

| Field | Type | Notes |
|---|---|---|
| `contributions` | { scopeId, fragmentId, text }[] | In ascending scope order |
| `conflicts` | { fragmentIds, scopeIds }[] | Both sides present; neither is removed (FR-015) |
| `unenforceable` | { fragmentId, enforcedBy }[] | Drives the statement FR-016 requires |

### GeneratedFile and HookExecutionResult

| Field | Type | Notes |
|---|---|---|
| `file.path` | string | Intended repository-relative destination |
| `file.contents` | string | |
| `file.language` | `"markdown" \| "json" \| "python"` | The hook is always Python (FR-018) |
| `file.validation` | { valid, problems[] } | A combination that cannot work is refused at the form, so an invalid file is never emitted (FR-021) |
| `result.payload` | object | The sample sent to the generated hook |
| `result.exitCode` | integer | |
| `result.decision` | `"deny" \| "allow"` | |
| `result.stderr` / `result.stdout` | string | Kept separate, per the validated driver |
| `result.completed` | boolean | False when the run was stopped (FR-023) |

## Device-scoped state

One new namespace, `claudeCode`, beside `foundation`, `labs`, `mock`, `quiz`, and `flashcards` in
the existing envelope. Exported and imported with them as one file; clearable on its own (FR-048).

```text
namespaces.claudeCode = {
  guidedTasks: { [taskId]: boolean },     // completion only; never a score (FR-013a)
  scopeExercise: { [scopeId]: fragmentId[] },
  configDraft: { ...form answers } | null // no field invites a credential
}
```

**Explicitly absent**: any terminal transcript, from either surface. Storage growth from this module
is therefore bounded by the number of tasks, scopes, and form fields rather than by how much a
candidate types, which is what makes a retention rule unnecessary.

**Degradation**: when storage is unavailable, full, or written by a newer version, all three keys
degrade to not being remembered and the page says so. Terminals are unaffected, because they never
write.
