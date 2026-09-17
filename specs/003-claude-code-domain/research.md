# Phase 0 research: Claude Code simulator, configuration builder, and playground

Every finding below was measured or executed against this repository on 2026-09-17, not recalled.
Commands are given so a reviewer can repeat them.

## 1. A generated hook can be executed faithfully in the browser runtime

**Decision**: Execute a generated hook through a small Python driver that injects standard input,
catches `SystemExit` as the exit code, and captures the two streams separately. Add one message type
to the existing runtime worker rather than building a second runtime.

**Rationale**: FR-022 requires the candidate to watch their own hook refuse something, which means
reproducing the three mechanics Claude Code actually uses: a JSON payload on standard input, a
process exit code as the decision, and a message on standard error. None of the three is available
through the worker's current `run` message, which executes a source string and reports uncaught
exceptions. A driver supplies all three with the standard library alone.

The design was validated by running the repository's own hook through exactly that driver under
CPython 3.14:

```text
protected write        exit=2 DENY
ordinary write         exit=0 ALLOW
destructive shell      exit=2 DENY
ordinary shell         exit=0 ALLOW
prose mentions file    exit=2 DENY
second run, same interpreter: exit=2 (no module-level state leaked)
```

The mechanics that matter all held: `io.StringIO` stands in for standard input, `runpy.run_path`
with `run_name="__main__"` triggers the `if __name__ == "__main__"` block, `SystemExit.code` carries
the decision, `contextlib.redirect_stdout` and `redirect_stderr` keep the hook's JSON decision
separable from anything it prints, and running the same hook twice in one interpreter produced the
same answer, so a page can offer repeated runs without a reload.

**Alternatives considered**:

- *Reuse the existing `run` message and let the hook's `SystemExit` surface as a failure.* Rejected:
  the worker would report every denial as "the candidate code raised an uncaught exception", which
  inverts the lesson — a denial is the hook working, not failing.
- *Interpret the generated hook in TypeScript instead of executing it.* Rejected: an interpretation
  of a hook is a second implementation that can disagree with the file the candidate copies out, and
  the whole point of FR-022 is that what runs is what they take away.
- *A second, lighter Python runtime for this page.* Rejected: two runtimes to vendor, audit, and
  keep within one payload budget, for a capability the existing worker gains in one message type.

## 2. The stdlib-only profile is worth having, but not for the reason it first appears

**Decision**: Give the worker's `init` an explicit profile. The configuration page initialises it
with no third-party packages, no `lab-drills.zip`, and no `lab.secrets` bootstrap; lab pages keep
today's behaviour unchanged.

**Rationale**: The honest number, measured over the vendored runtime with gzip, is:

| Part | Transferred (gzip) | Share |
|---|---:|---:|
| Pyodide core (`pyodide.mjs`, `pyodide.asm.mjs`, `pyodide.asm.wasm`, `python_stdlib.zip`, lock) | 6.10 MiB | 92.2% |
| Wheels (`jsonschema`, `attrs`, `referencing`, `jsonschema-specifications`, `rpds-py`, `pyyaml`, and their closure) | 0.46 MiB | 6.9% |
| `lab-drills.zip` | 0.06 MiB | 0.9% |
| **Total** | **6.62 MiB** | |

Reproduce by gzipping each file in `site/public/runtime/` and summing, as
`site/scripts/check-payload.mjs` does.

So the profile saves 0.52 MiB of 6.62 — 7.8%, not the large win the idea suggests. It is still the
right choice, on two grounds that are not about bytes. A generated hook imports nothing but the
standard library, so loading a JSON-schema validator and a YAML parser beside it would quietly teach
that a hook needs them. And the existing bootstrap patches `lab.secrets` to explain the mock
transport, which is a lab concern with no meaning on a configuration page. The plan states the 7.8%
rather than implying more.

**Alternatives considered**:

- *Initialise the worker exactly as lab pages do.* Rejected on the two teaching grounds above; the
  byte saving alone would not have justified the change.
- *Trim the payload further for this page.* Rejected: 92.2% of it is the interpreter, which the page
  genuinely needs to execute Python.

## 3. The hook's description must be a recording, not prose

**Decision**: An exporter runs the repository's hook against a fixture battery of tool payloads at
build time and publishes the observed decisions. The worked example renders that recording. No
sentence about what the hook denies is written by hand anywhere in `site/`.

**Rationale**: FR-030 requires the site's description to match the hook's behaviour and publication
to fail when it does not. Three approaches could satisfy the letter of that. Parsing the hook's
`PROTECTED_FILES` and its destructive-command pattern out of the source would publish the
*intention* encoded in two constants, which is what the stale `.claude/README.md` already does and
is exactly the drift being fixed. Writing the prose and adding a test that greps for it couples a
gate to wording. Recording what the hook actually decides, payload by payload, cannot drift: if the
behaviour changes and the fixtures do not, the exporter's output changes and the reviewer sees it in
the diff.

This also captures behaviour no hand-written description had caught. The hook denies a shell command
that merely *mentions* a protected filename — `echo <protected>` exits 2 — because
`_protected_file_in_command` searches the whole command string. That is a defensible choice for a
safety control and a genuinely instructive one for a candidate studying hooks, and it surfaced twice
while writing this feature: the hook refused a write of the specification for quoting the filename
in prose, and refused a shell heredoc for containing a destructive command inside a Python string
literal. A recording publishes it; prose had missed it three times.

**Alternatives considered**: covered above — source parsing and a wording test were both rejected.

## 4. Scaffold state, sub-skill weights, and quotas need no new machinery

**Decision**: Reuse what exists. Author `notes/03-claude-code/` and the rest follows.

**Rationale**: verified against the current code.

- `site/src/lib/content-status.ts` classifies a heading as authored or scaffold by stripping
  frontmatter and the repository's authoring-prompt sentence, then checking for a body. Authoring
  the note flips `domainContentStatus` from `scaffold` without anyone setting a flag, which is what
  FR-042 asks for.
- `site/src/data/blueprint.json` already carries `subSkills` with `name`, `weight`,
  `approximateItems`, and `measured` for every domain. FR-045 needs a lookup across domains 2, 3,
  and 7, not a new export. Domain 3 reads `weight: 3.1`, `mockItems: 2`.
- Flashcards, search, and recall prompts are generated from the notes by existing tooling, so FR-041
  costs nothing beyond writing the note.

**Alternatives considered**: adding a per-domain "module" export was considered and rejected as a
second source for figures that `blueprint.json` already holds, which Principle I forbids.

## 5. The simulator's behaviour is data, and it needs its own gate

**Decision**: A single YAML source at `claude-code/commands.yml` in the repository root describes
every command and mode the simulator reproduces, each entry naming the `SOURCES.md` anchor it is
taken from. `tools/export_claude_code_data.py` exports it to `site/src/data/claude-code.json`, and a
gate fails the build when an entry cites an anchor that does not exist in `SOURCES.md`.

**Rationale**: FR-003 forbids a command's behaviour being written into a page, and FR-005 requires
the implemented set to be bounded and stated. Both are properties of data, and the repository's
established pattern is exactly this: a checked-in source, a `tools/export_*.py`, a generated file
under `site/src/data/`, and a consistency gate. The clarified set is roughly twelve to fifteen
entries, which is a file a reviewer can read in one sitting.

The citation gate is what makes FR-003 mechanical rather than aspirational, and it mirrors how
`tools/check_blueprint_consistency.py` already guards derived exam figures.

**Alternatives considered**:

- *Put the behaviour in the note's markdown and parse it out.* Rejected: it mixes prose meant to be
  read with data meant to be executed, and it makes a wording change a behaviour change.
- *Hold the command table in TypeScript beside the component.* Rejected by FR-003, and it would put
  factual claims about Anthropic's product outside the reach of the sources gate.

## 6. Two existing end-to-end specs assert these addresses are inert

**Decision**: Rewrite `site/tests/e2e/reserved-routes.spec.ts` and
`site/tests/e2e/reserved-extension.spec.ts` to move the three addresses from the reserved list to
the live list, following the precedent their own comments record from feature 002.

**Rationale**: both currently assert that `/claude-code/terminal/`, `/claude-code/config/`, and
`/playground/` show the reserved-page text and contain no interactive control. Those assertions will
fail the moment this feature lands, by design. They are not obsolete tests to delete: their route
stability checks are what enforce FR-050, so each address moves lists and keeps its
"still resolves at the same path" assertion.

**Alternatives considered**: deleting the specs outright was rejected — it would drop the guarantee
that feature 001's addresses never move.

## Resolved unknowns

Every `NEEDS CLARIFICATION` raised in the plan's Technical Context is answered above: hook execution
mechanics (§1), runtime profile and payload (§2), the FR-030 gate's shape (§3), scaffold and weight
plumbing (§4), the behavioural data source and its gate (§5), and the fate of the reserved-route
specs (§6). No unknown remains open into Phase 1.
