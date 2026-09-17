# Contract: what the configuration builder emits

Satisfies FR-018 through FR-022 and SC-006. The builder turns typed form state into three files the
candidate copies into a project of their own.

## The three files

| File | Path it names | Language | Provable here |
|---|---|---|---|
| Project instructions | `CLAUDE.md` | Markdown | n/a — it is context, which is the point |
| Settings | `.claude/settings.json` | JSON | Parsed and reported back |
| Hook | `.claude/hooks/<name>.py` | **Python, always** | Executed against sample payloads |

The hook is Python without exception, as this repository's own hook is. That is what keeps FR-022's
promise universal: every hook the builder emits is one the page can prove and the candidate can run
locally with nothing installed beyond Python. A shell variant would have been generated but not
provable, which is the one thing separating this builder from a template.

## Validity, and refusal at the form

**An invalid file is never emitted.** A combination that cannot work is refused at the form with the
reason stated (FR-021). At minimum:

| Refused at the form | Why |
|---|---|
| A hook with an empty matcher | Matches nothing; the file would be inert |
| A hook entry with no command | Not a hook |
| A permission that appears in both allow and deny | The result would depend on precedence the candidate did not choose |
| A settings file with no permissions and no hooks | Nothing to generate; say so rather than emit `{}` silently |

Everything that *is* emitted must satisfy:

- the settings file parses, and its allow, deny, and hook entries are reported back in readable form
  — what it permits, what it denies, what it registers (FR-020);
- the hook file is syntactically valid Python that reads a `PreToolUse` document from standard input
  and exits `2` to deny or `0` to permit;
- the instruction file is Markdown that states, in its own text, that it is context rather than
  enforced configuration — the module's central teaching point, carried into the artifact.

## The prove-it step

The candidate runs the generated hook against sample payloads through the worker's `run-hook`
message. The page must show at least one denial of a destructive action and one permitted ordinary
action, produced by executing the file rather than describing it (FR-022).

Presentation rules:

- A denial is shown as the hook's own output, attributed to the hook, not as the page's commentary.
- Decision is never carried by colour alone.
- The runtime is not fetched until the candidate asks for a run (FR-024). Generating, reading,
  copying, and downloading all work without it.
- When the runtime is unavailable, the files are still generated and handed over, and the page says
  execution is unavailable, why, and how to run the hook locally (FR-025).

## Gate

`tests/test_claude_code_export.py` generates files for a representative set of form answers — not
one — and asserts for each that the settings file parses and the hook file runs, denying and
permitting as intended, using the same driver the browser uses. That is SC-006, and it is what stops
the builder emitting something that only looks right.

## What the builder must not do

- It must not emit a credential, and no form field may invite one. Configuration drafts are
  remembered on the device; a pasted key would persist there, unlike anything typed into a terminal.
- It must not copy this repository's study prose into generated output;
  `tools/check_content_single_source.py` covers the generator.
- It must not apply anything. The files are handed over, never written to a project, and the page
  makes no claim that a generated configuration suits any particular repository.
