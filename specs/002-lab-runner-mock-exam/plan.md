# Implementation Plan: Lab runner, weighted mock exam, and practice modes

**Branch**: `002-blueprint-guard-and-frontmatter` | **Date**: 2026-09-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-lab-runner-mock-exam/spec.md`

## Summary

Fill the five addresses feature 001 reserved — the labs, the mock exam and its report, the
per-domain quizzes, and the flashcards — with surfaces that are genuinely interactive and still need
no account, no installation, and no key.

Two decisions shape everything else, and both came out of Phase 0 measurement rather than from the
obvious reading of the request.

**The runtime is for the labs, not for the exam.** Pyodide runs `lab/` and `drills/` in a Web Worker
on lab pages only, loaded after an explicit Run and never before. The mock exam and the quizzes are
ordinary TypeScript over data exported at build time, and never fetch it. Per-domain quotas are
computed by importing the repository's real `drills.engine.mock.apportion_items` during the build,
so the site's 17 / 9 / 8 / 6 / 6 / 4 / 2 / 1 *is* the engine's rather than a copy of it, and the
heaviest surface a candidate uses under time pressure stays free of a 6 MiB download.

**One lab shows its source instead of running.** `jsonschema` and `PyYAML` are both in the Pyodide
distribution, so structured output, tool dispatch, and drill validation all run. `mcp` is not, and
vendoring it would mean shipping a web-server stack to run a server that has no transport inside a
browser tab. The MCP server lab therefore renders read-only with the concept explained — and which
labs those are is decided by probing imports at build time, not by a list someone maintains.

The other precondition is content, not code: `drills/bank/` supplies zero eligible items today, so
this feature authors an original bank to the full weighted quota before the mock exam means
anything.

## Technical Context

**Language/Version**: TypeScript 5.9 in `strict` mode for the site; Python 3.11+ (standard library
plus the existing `PyYAML`) for the exporters and their gates. CI matrix stays 3.11 and 3.12; Node
22 LTS.
**Primary Dependencies**: unchanged from feature 001 — Astro 7.3.1, Tailwind CSS 4 via
`@tailwindcss/vite`, Pagefind 1.4, Vitest 3.2, Playwright 1.59 with `@axe-core/playwright` — plus
exactly one addition: `pyodide`, pinned to the exact version whose lock file Phase 0 verified. No
editor library, no spaced-repetition library, no charting library. Every version pinned exactly; no
third-party runtime request.
**Storage**: `localStorage`, through the existing typed module, gaining four namespaces beside
`foundation`. Attempt retention is bounded at three full reports. Export and import stay one JSON
file.
**Testing**: Vitest for scoring, apportionment parity, retention, timer arithmetic, and card
scheduling; Playwright with axe for the six user-story journeys and every new page type; pytest for
the three new exporters and the bank's validation gate.
**Target Platform**: Static hosting on GitHub Pages at the existing base path. Notably, GitHub Pages
cannot set response headers, which rules out cross-origin isolation and therefore
`SharedArrayBuffer` — see the Stop control below.
**Project Type**: Static content site with interactive islands, inside an existing Python
repository.
**Performance Goals**: pages that do not run code keep feature 001's budget of readable main content
within 2.5 s on a mid-tier mobile device. A lab page is interactive within that same budget *before*
the runtime is requested. First Run transfers no more than **8 MiB**, against a measured baseline of
6.62 MiB, enforced by a build check.
**Constraints**: no account, no installation, no API key, no analytics, no third-party runtime
request. Executed code cannot reach the network or a credential, enforced by the worker environment
rather than by convention. WCAG 2.1 AA with full keyboard operation, including a code pane that does
not trap the keyboard. `lab/` and `drills/` are read from the repository at build time and never
copied into `site/`.
**Scale/Scope**: 13 lab pages (12 runnable, 1 read-only), 1 mock exam, 1 report, 8 domain quizzes, 1
flashcard surface. An authored bank of at least 53 original items at the weighted quota. A generated
deck of 30 cards today, growing with the notes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.1.0. Initial evaluation and post-design
re-evaluation both recorded; two justified complexities are tracked below.

- [x] **I. Blueprint is the source of truth** — PASS. The mock's size, its time limit, its
  per-domain quotas, and each quiz's length all come from `BLUEPRINT.md`:
  `tools/export_mock_data.py` calls the repository's own `apportion_items` at build time and writes
  the result beside the existing `blueprint.json`. Nothing types a quota.
  `tools/check_blueprint_consistency.py` gains coverage of the new derived file, so drift fails the
  gate that already guards notes, drills, and the site's exam figures.
- [x] **II. Single-sourced content** — PASS. `lab/` and `drills/` are archived from the repository
  root at build time into a git-ignored artifact; no copy lives under `site/`. Recall prompts render
  from the notes, flashcards from the generated deck, items from `drills/bank/`.
  `tools/check_content_single_source.py` continues to fail the build on duplicated prose.
- [x] **III. Keyless, loginless, installless** — PASS. The runtime is served from the site's own
  origin. The worker deletes `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, and
  `importScripts` before user code runs; a `connect-src 'self'` policy backs that up; no
  `ANTHROPIC_API_KEY` exists in the environment, and the existing `lab/secrets.py` failure is
  re-raised with a message naming the mock transport. Results stay in `localStorage` and export as
  one file. The existing Playwright origin check extends to cover a page that is executing code.
- [x] **IV. Coverage is proportional to exam weight** — PASS. Mock composition follows the engine's
  apportionment; each domain quiz asks for that domain's quota, so quizzes are visibly unequal — 17
  items for Applications and Integration, 1 for Eval, Testing, and Debugging; the authored bank
  spreads across sub-skills by their published shares. No surface pads a low-weight domain.
- [x] **V. Original material only** — PASS. Every authored item is written from the public blueprint
  with dated `SOURCES.md`-style entries in the item's own `sources` block, and passes `python -m
  drills.engine validate`. Anthropic material is linked, never re-hosted. Items flagged
  `format_demonstration` reach no learner surface. The unofficial notice stays on every page.
- [x] **VI. Gates are non-negotiable** — PASS. The existing five gates keep passing unchanged. The
  site job gains a payload-budget check, an apportionment-parity test, and a scoring-parity test
  against fixtures generated from `drills/engine/scoring.py`. Item validation joins CI so a
  malformed item blocks publication.
- [x] **VII. The implementation is teaching material** — PASS. The labs *are* the reference
  application, run unmodified, each linking to its note and its source file. Model pins in
  `lab/config.py` are what the pinned-versions lab demonstrates. The one lab that cannot run says
  why, which teaches something true about WebAssembly Python rather than hiding a gap.
- [x] **VIII. Accessible and fast by default** — PASS. The runtime is fetched only after an explicit
  Run, on lab pages only, verified against the built site. Execution is off the main thread, so a
  runaway loop cannot freeze the page. The code pane is a textarea with a documented key to leave
  it. Storage-unavailable and storage-full behaviour is specified per surface, and the retention
  limit keeps the record bounded.

**Post-design re-evaluation**: unchanged, and Principle VIII is materially better served than the
initial reading suggested. Phase 1 moved the mock exam and the quizzes off the runtime entirely
(research R7), so the only pages that can fetch 6 MiB are the twelve runnable labs, and only on a
deliberate press of Run.

## Project Structure

### Documentation (this feature)

```text
specs/002-lab-runner-mock-exam/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── runtime-worker.md      # Worker protocol, isolation guarantees, Stop semantics
│   ├── mock-data.md           # Exported quotas and item bank consumed by the site
│   ├── progress-record.md     # The four namespaces this feature adds, and retention
│   ├── flashcard-deck.md      # The deck's card identifier and its tag line
│   └── routes.md              # Addresses filled, and the reserved ones left alone
├── checklists/
│   └── requirements.md  # Written by /speckit-specify
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
site/
├── package.json                     # Gains exactly one dependency: pyodide, pinned
└── src/
    ├── data/
    │   ├── blueprint.json           # Existing. Generated from BLUEPRINT.md
    │   ├── mock.json                # New. Quotas from drills.engine, per mock size
    │   └── items.json               # New. The bank, format demonstrations excluded
    ├── lib/
    │   ├── storage.ts               # Existing. Gains four namespaces and retention
    │   ├── runtime/
    │   │   ├── worker.ts            # Owns Pyodide; isolates it; runs one script
    │   │   ├── client.ts            # Main-thread side: load, run, stop, progress
    │   │   └── labs.ts              # Lab catalogue, concepts, runnable flags
    │   ├── scoring.ts               # Mirrors drills/engine/scoring.py; fixture-pinned
    │   ├── attempt.ts               # Timer arithmetic, expiry, resume, retention
    │   ├── quiz.ts                  # Per-domain quiz assembly over items.json
    │   └── flashcards.ts            # Deck parsing, Leitner scheduling
    ├── components/
    │   ├── CodePane.astro           # Island: textarea, Run, Stop, Restore, output
    │   ├── LabSource.astro          # Read-only source for a lab that cannot run
    │   ├── MockRunner.astro         # Island: item navigation, timer, submission
    │   ├── ScoreReport.astro        # Per-domain figures, explanations, readiness
    │   ├── DomainQuiz.astro         # Island
    │   ├── RecallPrompts.astro      # Island: reveal and self-grade
    │   └── FlashcardDeck.astro      # Island
    └── pages/
        ├── labs/index.astro         # Was reserved; now the catalogue
        ├── labs/[module].astro      # Was reserved; now 13 real pages
        ├── mock/index.astro         # Was reserved; now the exam
        ├── mock/report.astro        # Was reserved; now the report
        ├── domains/[domain]/quiz/index.astro   # Was reserved; now the scored quiz
        └── flashcards/index.astro   # Was reserved; now the deck

tools/
├── export_mock_data.py              # BLUEPRINT.md + drills.engine -> site/src/data/mock.json
├── export_item_bank.py              # drills/bank/ -> site/src/data/items.json
├── export_runtime_bundle.py         # lab/ + drills/ -> git-ignored archive in the build output
├── build_flashcards.py              # Existing. Gains the stable card identifier
└── check_blueprint_consistency.py   # Existing. Gains coverage of mock.json

drills/bank/
├── 01-agents-and-workflows/         # 8 items
├── 02-applications-and-integration/ # 17 items
├── 03-claude-code/                  # 2 items
├── 04-eval-testing-and-debugging/   # 1 item
├── 05-model-selection-and-optimization/  # 9 items
├── 06-prompt-and-context-engineering/    # 6 items
├── 07-security-and-safety/          # 4 items
└── 08-tools-and-mcps/               # 6 items

tests/
├── test_export_mock_data.py         # Quotas equal drills.engine for every published size
├── test_export_item_bank.py         # Format demonstrations excluded; schema honoured
├── test_runtime_bundle.py           # Archive contains lab/ and drills/, and nothing else
└── test_scoring_fixtures.py         # Generates the fixtures site/tests consume
```

**Structure Decision**: the shape feature 001 established is unchanged — `site/` holds presentation,
`tools/` holds the Python that derives data for it, `tests/` covers that Python, and study content
stays where it is. This feature adds three exporters beside the existing one rather than a new
mechanism, and adds the item bank to `drills/bank/`, where the repository's own validation command
already reaches it. The only structural novelty is `site/src/lib/runtime/`, which is isolated behind
a client module so that no page outside the labs can pull the runtime in by accident — the property
SC-002 tests.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| A second scoring implementation in TypeScript (`scoring.ts`) alongside `drills/engine/scoring.py` | Scoring must run in the browser as the candidate answers, and Phase 0 deliberately kept the runtime off the mock and quiz pages so the most time-sensitive surface does not carry a 6 MiB download. The rule is small and closed: exact set match, per-domain tallies, 85% overall, 70% per domain, readiness withheld when a domain is unassessed. | Scoring in Pyodide was rejected because it undoes research R7 and puts the runtime on the path of the surface that can least afford it. Scoring at build time is impossible — the answers do not exist until they are given. The duplication is bounded to one function and pinned by fixtures generated from the Python engine, so the two cannot drift without a test failing. This is the same trade, for the same reason, that feature 001 recorded for `content-status.ts`. |
| Vendoring a ≈12 MiB Python runtime into the deployed site | The feature's central claim is that a candidate runs *this repository's* Python with no install. Principle III forbids fetching it from a CDN, so it must be served from the site's own origin. | Loading Pyodide from `cdn.jsdelivr.net` is one line and was rejected outright: it is a third-party runtime request, which Principle III prohibits without exception. A smaller WebAssembly Python was rejected because the labs need real CPython with `jsonschema` and `PyYAML`. The cost is contained by Principle VIII rather than waived: the payload never loads on the critical path, never loads outside a lab page, never loads before an explicit Run, and is capped by a build check at 8 MiB. |

## Phase 2 note

`/speckit-tasks` should sequence the authored item bank first and on its own. It is the precondition
for the mock exam, the quizzes, and three of the twelve success criteria, and it is the only part of
this feature that is content rather than code. Every other phase can be built and gated against a
bank that is already complete; none of them can be honestly demonstrated against an empty one.
