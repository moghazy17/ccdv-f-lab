# Contract: the simulator's behavioural data

Satisfies FR-003 (every simulated behaviour derives from one sourced place), FR-005 (the implemented
set is bounded and stated), and SC-003 (the citation is gated).

## Source of truth

`claude-code/commands.yml` at the repository root, beside `notes/` and `drills/`. It is repository
content with dated sources, not site code, and it follows the pattern the repository already uses:
a checked-in source, a `tools/export_*.py`, a generated file under `site/src/data/`, and a gate.

**No command's behaviour may be written into an Astro page, a component, a TypeScript module, or a
style sheet.** The typed loader in `site/src/lib/claude-code/commands.ts` is the only reader.

## Entry shape

```yaml
- id: compact-session
  guided_task: 1                  # optional positive position in the guided journey
  invocation: "/compact"
  kind: built-in               # built-in | custom | mode | component
  where: null                  # required location when kind is component
  scope: null                  # built-in | user | project, or null
  defined_by: null             # repository-relative path when kind is custom
  blueprint_feature: "session management"
  explanation: >
    Summarises the session and replaces the history it covers, unlike clearing,
    which discards it.
  source_anchor: "memory"      # must resolve to a link anchor in SOURCES.md
  transcript:
    - stream: stdout
      text: "Compacted 12 turns into a summary."
```

## The bounded set

Roughly 12–15 entries: every command and mode the blueprint names for *Claude Code Operation*, plus
the help, model, cost, and permissions commands that a session needs in order to read as a session.
The set is rendered on the page, so a candidate sees where the simulation stops rather than
discovering it (FR-005).

Reference components use `kind: component`, `invocation: null`, and `where` to name their location.
They count for blueprint coverage but are never offered as terminal input.

Guided journey membership and order come from `guided_task`. Positions must be unique and
consecutive, and reference components cannot carry one. The page sorts these positions at build
time, so changing a command identifier cannot silently remove the task from the journey.

Anything outside the set resolves to an explicit "not implemented here" with a link to the set. The
simulator never invents output, and never fabricates a model response (FR-006).

## Gates

Run by `tools/check_blueprint_consistency.py` and covered by `tests/test_claude_code_export.py`:

1. **Citation** — every `source_anchor` resolves to a link anchor that exists in `SOURCES.md`.
   A behaviour with no source fails the build. This is what makes FR-003 mechanical.
2. **Blueprint coverage** — every feature the blueprint names for *Claude Code Operation* is claimed
   by at least one entry's `blueprint_feature`. The sub-skill statement is read from
   `BLUEPRINT.md`, never restated here.
3. **Custom commands exist** — an entry with `kind: custom` must name a `defined_by` path that is
   present in the repository, so the simulator cannot claim a command this project does not define.
4. **Freshness** — `site/src/data/claude-code.json` must match what the exporter produces from the
   current sources.
5. **Guided journey** — guided positions are present, positive, unique, and consecutive.

## Generated file

`site/src/data/claude-code.json`. Generated, never hand-edited, git-ignored from manual edits by
convention and by gate 4 above. It carries the commands, the scope-exercise fragments, the worked
example, and the hook recording in one document, so a page makes one import.

The `prebuild`, `predev`, `pretypecheck`, and `pretest:unit` scripts in `site/package.json` gain the
new exporter alongside the three that already run.
