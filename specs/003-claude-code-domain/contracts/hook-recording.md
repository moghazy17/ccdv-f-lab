# Contract: the hook behaviour recording

Satisfies FR-030 and SC-007: the site's description of this repository's hook matches what the hook
does, and publication fails when it does not.

## The rule

**No sentence stating what the repository's hook denies may be written by hand anywhere in `site/`.**
The worked example renders a recording of what the hook actually decided, payload by payload, made
by executing it at build time.

## Why a recording rather than prose

Three approaches would satisfy the letter of FR-030. Two were rejected in Phase 0.

Parsing `PROTECTED_FILES` and the destructive-command pattern out of the hook's source publishes the
*intention* encoded in two constants. That is precisely what `.claude/README.md` already does, and
what this feature is correcting: the README claims four protected files, the constant holds one, and
nothing caught the divergence. Writing the prose and adding a test that greps for it couples a gate
to wording, so a rephrasing breaks the build and a behaviour change does not.

Recording the decisions cannot drift in that direction. If the hook changes and the fixtures do not,
the exporter's output changes and the reviewer sees it in the diff.

The recording has already earned its place. It captures that the hook denies a shell command that
merely *mentions* a protected filename — `echo <protected>` exits `2`, because the match runs over
the whole command string. That is a defensible choice for a safety control and an instructive one for
a candidate studying hooks, and it surfaced twice while this feature was being written: the hook
refused a write of the specification for quoting the filename in prose, and refused a shell heredoc
for containing a destructive command inside a Python string literal. Three hand-written descriptions
had missed it.

## Shape

`tools/export_claude_code_data.py` runs `.claude/hooks/prevent_destructive_actions.py` against a
fixture battery using the same driver as the browser (see
[runtime-worker.md](runtime-worker.md)), and writes:

```json
{
  "hookPath": ".claude/hooks/prevent_destructive_actions.py",
  "recordedCases": [
    {
      "label": "a write to a protected ground-truth file",
      "payload": { "tool_name": "Write", "tool_input": { "file_path": "<protected>" } },
      "exitCode": 2,
      "decision": "deny",
      "message": "<the hook's own text, verbatim>"
    }
  ]
}
```

## Required cases

The battery must cover, at minimum:

| Case | Expected | Why it must be present |
|---|---|---|
| Write to a protected ground-truth file | deny | The hook's primary purpose |
| Write to an ordinary source file | allow | A gate with no allow path proves nothing |
| A destructive shell command | deny | The blueprint's phrasing for *Claude Hooks* |
| An ordinary shell command | allow | As above |
| A shell command that only mentions a protected filename | deny | Real behaviour that prose kept missing |
| A malformed or empty payload | allow | The hook deliberately passes unrelated input through |

## Gate

Two checks, both in `pytest -q`:

1. **Freshness** — regenerating the recording from the live hook must reproduce the committed file
   byte for byte. A behaviour change that skips the regeneration fails here.
2. **Coverage** — every case in the required table above must be present, so the battery cannot be
   quietly narrowed to make a change pass.

`tests/test_claude_configuration.py` already executes the hook directly and keeps doing so; this
adds the recording as a second, independent check rather than replacing it.

## The README correction

`.claude/README.md` claims the hook denies writes to four ground-truth files. The hook protects one.
The README is corrected to describe the hook as it is, including the whole-command matching, as part
of this feature. **The hook's behaviour is not changed here** — narrowing the protected set was
deliberate, and widening it again is not this feature's call to make.
