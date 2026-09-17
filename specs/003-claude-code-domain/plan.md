# Implementation Plan: Claude Code simulator, configuration builder, and playground

**Branch**: `003-claude-code-domain` | **Date**: 2026-09-17 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-claude-code-domain/spec.md`

## Summary

Fill the last three addresses feature 001 reserved — the terminal simulator, the configuration
builder, and the playground — and author the Claude Code domain note that every one of them links
to.

Three decisions shape the rest, and each came out of Phase 0 measurement rather than from the
obvious reading of the request.

**The builder executes what it generates, through one new worker message.** A generated hook is run
by a standard-library driver that injects a JSON payload on standard input, catches `SystemExit` as
the decision, and keeps the hook's message on standard error separable from anything it prints. The
design was validated by running this repository's own hook through it: five payloads, five correct
decisions, repeatable in one interpreter. The configuration page initialises the worker with a
stdlib-only profile — no wheels, no `lab-drills.zip`, no `lab.secrets` bootstrap — which saves 7.8%
of the payload and, more importantly, stops the page implying that a hook needs a JSON-schema
validator.

**The hook's description is a recording, not a sentence.** An exporter runs the repository's hook
against a fixture battery at build time and publishes the decisions it observes; the worked example
renders that. This is what makes FR-030 mechanical, and it has already earned its place — the
recording captures that the hook denies any shell command merely *mentioning* a protected filename,
which three hand-written descriptions had missed, including the one in `.claude/README.md` that this
feature corrects.

**The module is small on the page and honest about its weight.** Domain 3 is 3.1% and gains no
top-level navigation entry; the terminal and the builder are reached from the domain's own page. But
the builder is the site's primary surface for *Configuration Management* at 4.1% and the hook work
for *Claude Hooks* at 1.0%, so every surface names the sub-skills it serves with their published
weights, read from `blueprint.json` rather than typed.

## Technical Context

**Language/Version**: TypeScript 5.9 in `strict` mode for the site; Python 3.11+ (standard library
plus the existing `PyYAML`) for the new exporter and its gates. CI matrix stays 3.11 and 3.12; Node
22 LTS.
**Primary Dependencies**: unchanged from feature 002 — Astro 7.3.1, Tailwind CSS 4 via
`@tailwindcss/vite`, Pagefind 1.4, Vitest 3.2, Playwright 1.59 with `@axe-core/playwright`, Pyodide
314.0.6. **No new dependency.** No terminal-emulator library, no form library, no JSON-schema
library in the browser; the simulator is a transcript over build-time data and the builder is
string generation over typed form state.
**Storage**: `localStorage`, through the existing typed module, gaining one namespace beside
`foundation`, `labs`, `mock`, `quiz`, and `flashcards`. It holds guided-task completion,
scope-exercise state, and configuration drafts. It holds **no terminal transcript** — neither
terminal writes to the device. Export and import stay one JSON file.
**Testing**: Vitest for the composition rule, the generated-file shapes, the command-data loader,
and the storage namespace; Playwright with axe for the six user-story journeys and the three new
page types; pytest for the new exporter, the hook-recording fixtures, and the citation gate.
**Target Platform**: Static hosting on GitHub Pages at the existing base path, unchanged.
**Project Type**: Static content site with interactive islands, inside an existing Python
repository.
**Performance Goals**: every page here keeps feature 001's budget of readable main content within
2.5 s on a mid-tier mobile device. The terminal, the scope exercise, and the playground never fetch
the runtime at all. The configuration page is fully interactive — forms complete, files generated,
copied, downloaded — before the runtime is requested, and requests it only when the candidate asks
for a hook to be run.
**Constraints**: no account, no installation, no API key, no analytics, no third-party runtime
request. The simulator makes no network request and fabricates no model response. Executed hooks
inherit the worker's existing isolation. WCAG 2.1 AA with full keyboard operation, including a
transcript that does not trap the keyboard and streamed output that is announced as a result rather
than continuously. The repository's `.claude/` directory is read at build time and never copied into
`site/`.
**Scale/Scope**: 3 pages filled (terminal, configuration builder, playground), 1 worked example, 1
domain note authored across 4 files, roughly 12–15 simulated commands, 1 new exporter, 1 new
generated data file, 1 new worker message type, 1 new storage namespace. No new practice items.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.1.0. Initial evaluation and post-design
re-evaluation both recorded. One justified complexity is tracked below.

- [x] **I. Blueprint is the source of truth** — PASS. The 3.1% the module states about itself, the
  4.1% and 1.0% its surfaces serve, and domain 3's two mock items all read from
  `site/src/data/blueprint.json`, which already carries `subSkills` with weights for every domain —
  verified in Phase 0, so no new export and no new figure. Nothing types a weight. The module adds
  no practice items, so apportionment is untouched.
- [x] **II. Single-sourced content** — PASS. The worked example renders `.claude/` from the
  repository root at build time; the domain note is authored in `notes/03-claude-code/` and rendered
  from there, which is also what carries it into flashcards, search, and recall prompts.
  `tools/check_content_single_source.py` continues to fail the build on duplicated prose, and it
  covers the builder's generated strings, which are configuration rather than study text.
- [x] **III. Keyless, loginless, installless** — PASS. Nothing here asks for an account, an install,
  or a key. The simulator never makes a network request and never fabricates a model response. The
  one execution path reuses the worker that already deletes `fetch`, `XMLHttpRequest`, `WebSocket`,
  `EventSource`, and `importScripts` before anything runs, backed by the existing `connect-src
  'self'` policy. Terminal transcripts are never written to the device, which removes a whole class
  of stored-credential risk rather than mitigating it.
- [x] **IV. Coverage is proportional to exam weight** — PASS, and this gate did real work here. The
  module gains no top-level navigation entry and is reached from domain 3's page; a Playwright check
  asserts domain ordering against the blueprint. The same gate cuts the other way and the plan says
  so: the configuration builder serves a 4.1% sub-skill in domain 2, so building it thin to honour
  "Claude Code is 3.1%" would have misweighted the site in the opposite direction. Each surface
  names the sub-skills it serves.
- [x] **V. Original material only** — PASS. Every simulated behaviour cites a `SOURCES.md` anchor and
  a gate fails the build when the anchor does not exist. Anthropic's documentation is linked, never
  re-hosted. No exam content is reproduced and no practice item is added. The note carries dated
  sources for every factual claim.
- [x] **VI. Gates are non-negotiable** — PASS. `ruff check .`, `ruff format --check .`, `pytest -q`,
  `tools/check_blueprint_consistency.py`, and `tools/check_links.py` all run unchanged; the site's
  build, lint, type-check, unit, end-to-end, accessibility, and payload checks join them. Three
  gates are added: the citation gate on the command data, the hook-recording gate behind FR-030, and
  a check that no page but the configuration builder can reach the runtime client.
- [x] **VII. The implementation is teaching material** — PASS, and unusually directly: the artifact
  being explained is the repository's own configuration. Public functions stay type-hinted, the
  worked example links each component to the note section that explains it and back, and the module
  documents the hook's real matching rather than its intent. No model version is involved.
- [x] **VIII. Accessible and fast by default** — PASS. No page here fetches the runtime on first
  render and three of the four never fetch it at all. Streamed output is announced as a completed
  result. Nothing depends on colour or motion alone, which the forced-colours and reduced-motion
  cases pin down. Storage-unavailable behaviour is defined per surface, and terminals are unaffected
  because they never write.

**Post-design re-evaluation (after Phase 1)**: unchanged, all eight PASS. The design added one
worker message type, one exporter, one data file, and one storage namespace. The one item that moved
is recorded in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/003-claude-code-domain/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # Written by /speckit-specify
├── contracts/           # Phase 1 output
│   ├── command-data.md       # claude-code.json, and the YAML it derives from
│   ├── hook-recording.md     # the observed-behaviour recording behind FR-030
│   ├── runtime-worker.md     # the run-hook message added to feature 002's contract
│   └── generated-files.md    # what the builder emits and what makes it valid
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
claude-code/
└── commands.yml                    # NEW. The simulator's behaviour, each entry citing SOURCES.md

notes/03-claude-code/               # AUTHORED. Scaffold today; prose, tables, pitfalls, self-check
├── README.md
├── decision-tables.md
├── pitfalls.md
└── self-check.md

tools/
├── export_claude_code_data.py      # NEW. commands.yml + .claude/ + hook recording -> site data
└── check_blueprint_consistency.py  # EXTENDED. Covers the new derived file

tests/
├── test_claude_code_export.py      # NEW. Exporter, citation gate, hook-recording fixtures
└── test_claude_configuration.py    # EXTENDED. The recording matches the live hook

site/src/
├── data/
│   └── claude-code.json            # NEW, generated. Never hand-edited
├── lib/
│   ├── claude-code/
│   │   ├── commands.ts             # Typed loader over the generated data
│   │   ├── session.ts              # Transcript state, clear and compact semantics
│   │   ├── hierarchy.ts            # Scope composition, root-down concatenation
│   │   └── generate.ts             # Form state -> the three files
│   ├── runtime/
│   │   ├── worker.ts               # EXTENDED. init profile, run-hook message
│   │   └── client.ts               # EXTENDED. runHook()
│   └── storage.ts                  # EXTENDED. One namespace: claudeCode
├── components/
│   ├── SimulatedTerminal.astro     # Shared by the module page and the playground
│   ├── GuidedTasks.astro
│   ├── ScopeComposer.astro
│   ├── ConfigBuilder.astro
│   └── WorkedExample.astro
└── pages/
    ├── claude-code/
    │   ├── terminal/index.astro    # REPLACES the reserved stub
    │   └── config/index.astro      # REPLACES the reserved stub
    ├── playground/index.astro      # REPLACES the reserved stub
    └── domains/[domain].astro      # EXTENDED. Links the module from domain 3

site/tests/
├── unit/                           # Composition, generation, command data, storage
└── e2e/
    ├── reserved-routes.spec.ts     # REWRITTEN. Three addresses move to the live list
    ├── reserved-extension.spec.ts  # REWRITTEN. Same, keeping route-stability assertions
    └── us1..us6-*.spec.ts          # NEW. One journey per user story, plus axe
```

**Structure Decision**: The feature extends the structure features 001 and 002 established rather
than introducing one. Behavioural data joins the repository root beside `notes/` and `drills/` as
`claude-code/`, because it is repository content with dated sources rather than site code; it
follows the established path of a checked-in source, a `tools/export_*.py`, a generated file under
`site/src/data/`, and a consistency gate. Site code lands in a `claude-code/` module under
`site/src/lib/`, mirroring how `runtime/` groups feature 002's client. No existing address moves.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| The runtime worker gains a second execution path (`run-hook`) alongside `run`, changing a contract feature 002 documented as fixed | FR-022 requires the candidate to watch their own generated hook refuse a destructive action, and a hook's decision is an exit code carrying a JSON message on standard error after reading a payload from standard input. The existing `run` message models none of that: it reports every `SystemExit` as an uncaught exception, which would present a working denial as a crash | Reusing `run` and interpreting the failure was rejected because it inverts the lesson the page exists to teach. Re-implementing the hook's logic in TypeScript was rejected because an interpretation can disagree with the file the candidate copies out, which defeats the purpose of generating it. A second, lighter runtime was rejected as two runtimes to vendor, audit, and fit inside one payload budget for a capability the existing worker gains in one message |

The stdlib-only `init` profile is **not** tracked as a complexity: it narrows what the worker loads
rather than widening what it does, and Phase 0 measured its effect honestly at 7.8% of payload, with
the real justification being that a configuration page should not imply a hook needs a JSON-schema
validator.
