---

description: "Task list for the lab runner, weighted mock exam, and practice modes"
---

# Tasks: Lab runner, weighted mock exam, and practice modes

**Input**: Design documents from `/specs/002-lab-runner-mock-exam/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. The specification requires automated verification throughout — FR-022, FR-023,
SC-002, SC-003, SC-004, SC-006 all say "verified automatically" rather than "checked" — and
Principle VI makes the gate set non-negotiable.

**Organization**: Grouped by user story so each is independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US6)
- Exact file paths are given in every task

## Path Conventions

The site is an Astro project in `site/`; the Python packages, tools, and tests sit at the repository
root, as feature 001 established. Paths below are repository-relative.

## Mandatory gate tasks *(constitution v1.1.0)*

The gate set appears as explicit numbered tasks at every phase boundary, never as assumed background
work. Each gate task runs: `ruff check .`, `ruff format --check .`, `pytest -q`,
`tools/check_blueprint_consistency.py`, `tools/check_links.py`,
`tools/check_content_single_source.py`, `python -m drills.engine validate`, and — from `site/` —
`npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:unit`, `npm run test:e2e`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the one new dependency and the build wiring everything else assumes.

- [X] T001 Add `pyodide` at an exact pinned version to `site/package.json` and refresh
  `site/package-lock.json` with `npm install --save-exact`, confirming the version's lock file lists
  `jsonschema`, `PyYAML`, `rpds-py`, `attrs`, `referencing`, and `jsonschema-specifications` per
  research R2
- [X] T002 [P] Create the runtime module boundary at `site/src/lib/runtime/` with an `index.ts` that
  re-exports only the client surface, so no page can reach Pyodide directly
- [X] T003 [P] Add `site/src/data/mock.json`, `site/src/data/items.json`, and the generated runtime
  archive to `.gitignore`, so no copy of `lab/` or `drills/` is ever committed under `site/`
- [X] T004 [P] Add `prebuild` and `predev` npm scripts to `site/package.json` that run the three
  exporters, and a `check:payload` script for the budget gate
- [X] T005 Run the full gate set from the repository root and from `site/`

**Checkpoint**: The toolchain builds with the new dependency and nothing else has changed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The stored-progress surface every user story writes to.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 Extend `site/src/lib/storage.ts` with the `labs`, `mock`, `quiz`, and `flashcards`
  namespaces and their defaults, leaving `CURRENT_SCHEMA_VERSION` at 1 per
  `contracts/progress-record.md`
- [X] T007 [P] Extend `site/src/lib/transfer.ts` so the export summary and the import validator
  cover the four new namespaces without changing the file format
- [X] T008 [P] Add a storage-availability helper in `site/src/lib/storage.ts` that reports
  unavailable or full without throwing, so every surface can degrade to a stated message
- [X] T009 [P] Write Vitest cases in `site/tests/unit/storage.test.ts` proving a feature 001 record
  migrates forward with the new namespaces defaulted, and a record carrying them opens in a reader
  that does not know them
- [X] T010 [P] Write Vitest cases in `site/tests/unit/storage-multitab.test.ts` proving
  read-merge-write does not discard a concurrent write to another namespace
- [X] T011 [P] Confirm `.github/workflows/ci.yml` already runs `pytest -q` and `npm run test:unit`,
  so the parity tests added in later phases need no new wiring. Each new *command* is wired in the
  phase that creates it — the payload budget in Phase 3, item validation in Phase 4 — so no phase
  ends with CI invoking a script that does not yet exist
- [X] T012 Run the full gate set from the repository root and from `site/`

**Checkpoint**: Progress storage accepts all four namespaces, and CI invokes nothing that does
not yet exist.

---

## Phase 3: User Story 1 - Run the reference application (Priority: P1) 🎯 MVP

**Goal**: A candidate opens a lab, edits the code, presses Run, and sees this repository's real
Python produce real output — with no install and no key.

**Independent Test**: Open one lab page with nothing else built. Run the unmodified code, see
output, change a value, run again, see the output change, and reach both the note and the source
file.

### Tests for User Story 1

- [X] T013 [P] [US1] Playwright test in `site/tests/e2e/us1-runtime-lazy.spec.ts` asserting no lab
  page requests the runtime on load, and that it is requested only after Run (SC-002)
- [X] T014 [P] [US1] Playwright test in `site/tests/e2e/us1-runtime-isolation.spec.ts` asserting no
  request leaves the origin while code executes, and that code attempting a network call or reading
  `ANTHROPIC_API_KEY` fails with a message naming the mock transport (SC-003)
- [X] T015 [P] [US1] Playwright test in `site/tests/e2e/us1-lab-journey.spec.ts` covering edit, Run,
  re-run, Restore, Stop on a non-terminating loop, and the two outbound links
- [X] T016 [P] [US1] Pytest in `tests/test_runtime_bundle.py` asserting the archive contains `lab/`
  and `drills/` and nothing from the study-content directories
- [X] T017 [P] [US1] Vitest in `site/tests/unit/labs.test.ts` asserting the catalogue enumerates
  thirteen modules and that each names a concept and a domain

### Implementation for User Story 1

- [X] T018 [US1] Write `tools/export_runtime_bundle.py` archiving `lab/` and `drills/` from the
  repository root into the site's build output as a git-ignored artifact
- [X] T019 [US1] Extend `tools/check_content_single_source.py` so publication fails when `lab/` or
  `drills/` source is copied under `site/`, not only when study prose is, and cover it with a case
  in `tests/test_content_single_source.py` (FR-001)
- [X] T020 [US1] Write `site/scripts/vendor-runtime.mjs` copying the Pyodide core files from
  `node_modules/pyodide/` into `site/public/runtime/`, and fetching the wheels the labs need,
  with their transitive dependencies — `jsonschema`, `attrs`, `referencing`,
  `jsonschema-specifications`, `rpds-py`, `PyYAML`
  — into the same directory at build time, pinned to the versions in the installed
  `pyodide-lock.json`. The npm package ships the interpreter but not the wheels, and Principle
  III forbids fetching them from a package index at runtime, so `indexURL` must point at this
  copy. Add it to the `export:data` script chain
- [X] T021 [US1] Write `site/src/lib/runtime/worker.ts` owning Pyodide: load from own origin with
  `indexURL` at the vendored wheels, unpack the bundle, delete `fetch`, `XMLHttpRequest`,
  `WebSocket`, `EventSource`, and `importScripts` before any candidate code runs, and bound output
  per `contracts/runtime-worker.md`
- [X] T022 [US1] Add the Python bootstrap inside `site/src/lib/runtime/worker.ts` that catches
  `lab/secrets.py`'s missing-key `RuntimeError` and re-raises it naming the mock transport (FR-005)
- [X] T023 [US1] Write `site/src/lib/runtime/client.ts` implementing the message protocol, load
  progress reporting, and Stop as `worker.terminate()` plus re-instantiation, reporting the
  re-initialisation rather than hiding it (research R4)
- [X] T024 [US1] Write `site/src/lib/runtime/labs.ts` building the lab catalogue from `lab/`,
  mapping the nine named concepts onto modules and labelling the rest accurately
- [X] T025 [US1] Add the build-time import probe to `site/src/lib/runtime/labs.ts` that sets
  `runnable` and `unrunnableReason` from what the runtime actually satisfies, never from a
  maintained list (FR-012)
- [X] T026 [P] [US1] Build `site/src/components/CodePane.astro`: textarea, Run, Stop, Restore,
  output region, load progress, and a documented key to leave the pane without trapping the keyboard
- [X] T027 [P] [US1] Build `site/src/components/LabSource.astro` rendering a read-only lab with its
  concept, the reason it does not run here, and how to run it locally (FR-011)
- [X] T028 [US1] Replace the reserved page at `site/src/pages/labs/index.astro` with the catalogue,
  showing each lab's concept and whether it runs
- [X] T029 [US1] Replace the reserved page at `site/src/pages/labs/[module].astro` with the thirteen
  real lab pages, adding `/labs/mcp-server/` and `/labs/evals/` while keeping all eleven addresses
  feature 001 published (`contracts/routes.md`)
- [X] T030 [US1] Add the note link and repository source link to each lab page, with the scaffold
  notice when the linked note is unwritten, and fail the build when either target is missing
  (FR-013, FR-014). This also adds the `noteStatus` field `data-model.md` lists on `LabModule`,
  computed through the existing `content-status.ts` — `labs.ts` does not carry it yet
- [X] T031 [US1] Persist and discard per-lab code edits through the `labs` namespace in
  `site/src/lib/storage.ts` (FR-016)
- [X] T032 [US1] Write the payload budget check invoked by `npm run check:payload`, failing the
  build above 8 MiB transferred against the 6.62 MiB baseline (research R3)
- [X] T033 [US1] Add `connect-src 'self'` to the document policy so an escape from the deleted
  globals still cannot reach a third party
- [X] T034 [US1] Add `npm run check:payload` to the site job in `.github/workflows/ci.yml`, now that
  T032 has created it
- [X] T035 [US1] Narrow `site/tests/e2e/reserved-routes.spec.ts` and
  `site/tests/e2e/reserved-extension.spec.ts` so `./labs/` and `./labs/batch/` move from the
  reserved set to the established set. Both currently assert those addresses contain zero
  interactive elements, which T028 and T029 make false. Leave the three feature 003 addresses
  asserted as inert
- [X] T036 [US1] Extend `site/tests/e2e/accessibility.spec.ts` to run axe over a runnable lab page
  and the read-only lab page
- [X] T037 [US1] Run the full gate set from the repository root and from `site/`

**Checkpoint**: The labs work end to end. This is a shippable MVP with no bank, no mock, and no
quiz.

---

## Phase 4: The item bank (Content — blocks US2, US3, US6)

**Purpose**: `drills/bank/` holds one item and it is the excluded format demonstration. Nothing
downstream is honest until this is written. This phase is content, not code, and can be authored in
parallel with Phase 3 by someone else.

**Rule for every task here**: original, written from the public blueprint, never recalled or
reconstructed. Exact `BLUEPRINT.md` domain and sub-skill names. A rationale on every option, a trap
type on every incorrect option, and at least one dated source. Sub-skill spread follows the
published shares (FR-018).

- [X] T038 [P] Author 17 items in `drills/bank/02-applications-and-integration/`, spread across that
  domain's sub-skills by their published shares
- [X] T039 [P] Author 9 items in `drills/bank/05-model-selection-and-optimization/`
- [X] T040 [P] Author 8 items in `drills/bank/01-agents-and-workflows/`, alongside the existing
  format demonstration
- [X] T041 [P] Author 6 items in `drills/bank/06-prompt-and-context-engineering/`
- [X] T042 [P] Author 6 items in `drills/bank/08-tools-and-mcps/`
- [X] T043 [P] Author 4 items in `drills/bank/07-security-and-safety/`
- [X] T044 [P] Author 2 items in `drills/bank/03-claude-code/`
- [X] T045 [P] Author 1 item in `drills/bank/04-eval-testing-and-debugging/`
- [X] T046 Add each item's sources to `SOURCES.md` with verification dates, per Principle V
- [X] T047 Add `python -m drills.engine validate` to the Python job in `.github/workflows/ci.yml`,
  so a malformed item blocks publication (FR-021)
- [X] T048 Run `python -m drills.engine validate` and the full gate set

**Checkpoint**: The bank fills every quota. A 53-item weighted mock can be assembled.

---

## Phase 5: User Story 2 - Sit a full weighted mock (Priority: P2)

**Goal**: A 53-item mock apportioned exactly as the engine apportions it, under a 120-minute
wall-clock countdown, ending in a per-domain report with an explanation on every wrong answer.

**Independent Test**: Start a mock, answer everything, submit, and read a report whose domain counts
match the repository's drill engine.

### Tests for User Story 2

- [X] T049 [P] [US2] Pytest in `tests/test_export_mock_data.py` asserting the exported quotas equal
  `drills.engine.mock.apportion_items` for the published size (FR-024, SC-004)
- [X] T050 [P] [US2] Pytest in `tests/test_export_item_bank.py` asserting format demonstrations are
  excluded and every exported item carries its rationales, trap types, and dated sources
- [X] T051 [P] [US2] Pytest in `tests/test_scoring_fixtures.py` generating scoring fixtures from
  `drills/engine/scoring.py` for the TypeScript suite to consume
- [X] T052 [P] [US2] Vitest in `site/tests/unit/scoring.test.ts` running those fixtures against
  `scoring.ts`, covering exact-set matching, per-domain tallies, and readiness withheld when a
  domain is unassessed
- [X] T053 [P] [US2] Vitest in `site/tests/unit/attempt.test.ts` covering wall-clock remaining time,
  a restart mid-attempt, expiry while away, and the three-report retention with summaries
- [X] T054 [P] [US2] Playwright in `site/tests/e2e/us2-mock-journey.spec.ts` covering a timed
  sitting, a mid-attempt reload, submission, and the report
- [X] T055 [P] [US2] Playwright in `site/tests/e2e/us2-mock-no-runtime.spec.ts` asserting the mock
  and report pages never request the runtime

### Implementation for User Story 2

- [X] T056 [US2] Write `tools/export_mock_data.py` importing `drills.engine.mock.apportion_items`
  and writing `site/src/data/mock.json` per `contracts/mock-data.md`
- [X] T057 [US2] Write `tools/export_item_bank.py` writing `site/src/data/items.json`, dropping
  every item flagged `format_demonstration`
- [X] T058 [US2] Extend `tools/check_blueprint_consistency.py` to cover `site/src/data/mock.json` so
  a blueprint change without regeneration fails the existing gate (FR-023)
- [X] T059 [US2] Write `site/src/lib/scoring.ts` mirroring `drills/engine/scoring.py`: exact-set
  matching, per-domain results, 85% overall and 70% per domain, readiness withheld on an unassessed
  domain
- [X] T060 [US2] Write `site/src/lib/attempt.ts` holding `startedAt` and `deadlineAt` as absolute
  instants, deriving remaining time from the wall clock, never a decremented counter (research R10)
- [X] T061 [US2] Implement mock assembly in `site/src/lib/attempt.ts` reading quotas from
  `mock.json`, drawing per domain with no cross-domain substitution (FR-035)
- [X] T062 [US2] Implement the three-report retention and summary reduction in
  `site/src/lib/attempt.ts` per `contracts/progress-record.md`
- [X] T063 [US2] Build `site/src/components/MockRunner.astro`: item navigation in any order,
  revisable answers, unanswered indicator, and a timer announced at intervals rather than
  continuously
- [X] T064 [US2] Implement resume and the expired-attempt choice in `MockRunner.astro` — score as it
  stood or discard, never scored or retained silently (FR-028)
- [X] T065 [US2] Build `site/src/components/ScoreReport.astro` with overall and per-domain
  percentages, the informational-figures statement, an explanation on every wrong answer, and the
  readiness verdict as the project's own advice
- [X] T066 [US2] Add the estimate label and its stated assumption to `ScoreReport.astro`, matching
  what `format_score_report` already says about the real exam's unpublished method (FR-034)
- [X] T067 [US2] Add the shortfall and no-surplus notices to `site/src/pages/mock/index.astro` from
  the `available` versus `quotas` comparison (FR-035, FR-036)
- [X] T068 [US2] Replace the reserved pages at `site/src/pages/mock/index.astro` and
  `site/src/pages/mock/report.astro` with the exam and the report
- [X] T069 [US2] Extend `site/src/styles/print.css` so the report prints with per-domain figures and
  explanations and without navigation, theme, or search controls (FR-038)
- [X] T070 [US2] Render a summary-only report as a statement rather than an empty item list (FR-037)
- [X] T071 [US2] Narrow `site/tests/e2e/reserved-routes.spec.ts` and `reserved-extension.spec.ts`
  so `./mock/` and `./mock/report/` move from the reserved set to the established set
- [X] T072 [US2] Extend `site/tests/e2e/accessibility.spec.ts` to run axe over the mock and the
  report
- [X] T073 [US2] Run the full gate set from the repository root and from `site/`

**Checkpoint**: A candidate can sit a full weighted mock and get a real report.

---

## Phase 6: User Story 3 - Check one domain before moving on (Priority: P3)

**Goal**: Each module page carries self-graded recall prompts and a separately scored quiz, with
only the scored one feeding readiness.

**Independent Test**: Open the module page for the one authored domain, work both sections, and
confirm the results are recorded and distinguishable.

### Tests for User Story 3

- [X] T074 [P] [US3] Vitest in `site/tests/unit/quiz.test.ts` asserting a domain quiz asks for that
  domain's quota from `mock.json` and runs short with a stated count when the bank holds fewer
- [X] T075 [P] [US3] Playwright in `site/tests/e2e/us3-quiz-journey.spec.ts` covering both sections
  on an authored domain and on a scaffolded one

### Implementation for User Story 3

- [X] T076 [US3] Write `site/src/lib/quiz.ts` assembling a domain quiz over `items.json` at the
  domain's quota, and recording results in the `quiz` namespace
- [X] T077 [P] [US3] Build `site/src/components/RecallPrompts.astro` rendering the notes'
  `Self-check` prompts as reveal-and-self-grade cards, from the note rather than a copy (FR-039)
- [X] T078 [P] [US3] Build `site/src/components/DomainQuiz.astro` scoring through `scoring.ts` and
  showing the same explanation the mock report gives
- [X] T079 [US3] Replace the reserved page at `site/src/pages/domains/[domain]/quiz/index.astro`
  with the scored quiz
- [X] T080 [US3] Add both sections to `site/src/pages/domains/[domain].astro` with the statement
  that only the scored quiz feeds a readiness signal (FR-041)
- [X] T081 [US3] Handle the empty states in both components: no authored recall prompts, and a bank
  below the quiz's ask, each stating its own condition (FR-042)
- [X] T082 [US3] Surface per-domain quiz results together on `site/src/pages/progress.astro`
- [X] T083 [US3] Narrow `site/tests/e2e/reserved-routes.spec.ts` and `reserved-extension.spec.ts`
  so `./domains/01-agents-and-workflows/quiz/` moves from the reserved set to the established set
- [X] T084 [US3] Extend `site/tests/e2e/accessibility.spec.ts` to run axe over a module page
  carrying both sections
- [X] T085 [US3] Run the full gate set from the repository root and from `site/`

**Checkpoint**: Domain-level self-checking works, scored and self-graded, clearly separated.

---

## Phase 7: User Story 4 - Drill the recall items (Priority: P4)

**Goal**: A flashcard deck with lightweight spaced repetition whose review history survives a
regeneration.

**Independent Test**: Review a deck, mark cards known and unknown, return, and confirm the missed
cards are due first.

### Tests for User Story 4

- [X] T086 [P] [US4] Pytest in `tests/test_tools.py` asserting `build_flashcards.py` writes a unique
  stable `Card:` identifier for all 30 cards, including the four that share a front, a domain, and a
  sub-skill
- [X] T087 [P] [US4] Vitest in `site/tests/unit/flashcards.test.ts` covering the five Leitner boxes
  and a regeneration that drops a card without reassigning its history to a neighbour

### Implementation for User Story 4

- [X] T088 [US4] Extend `tools/build_flashcards.py` to append the `Card:` tag line beside the
  existing `Domain:` and `Sub-skill:` tags, keeping the file two columns per
  `contracts/flashcard-deck.md`
- [X] T089 [US4] Regenerate `flashcards/ccdv-f.tsv` and confirm it stays importable as two columns
- [X] T090 [US4] Write `site/src/lib/flashcards.ts` parsing the deck by identifier and implementing
  the five Leitner intervals
- [X] T091 [US4] Build `site/src/components/FlashcardDeck.astro` with reveal, known and not-known
  marking, keyboard shortcuts stated on the page, and an exhausted-deck state naming the next due
  time
- [X] T092 [US4] Replace the reserved page at `site/src/pages/flashcards/index.astro` with the deck,
  stating which domains it covers and which it does not (FR-044)
- [X] T093 [US4] Narrow `site/tests/e2e/reserved-routes.spec.ts` and `reserved-extension.spec.ts`
  so `./flashcards/` moves from the reserved set to the established set, leaving only the three
  feature 003 addresses asserted as inert
- [X] T094 [US4] Extend `site/tests/e2e/accessibility.spec.ts` to run axe over the flashcard surface
- [X] T095 [US4] Run the full gate set from the repository root and from `site/`

**Checkpoint**: The deck works and its scheduling survives a note edit.

---

## Phase 8: User Story 5 - Keep everything, and move it (Priority: P5)

**Goal**: Results from all four surfaces export as one file and import on another device.

**Independent Test**: Produce results everywhere, export, import into a second browser, confirm each
surface shows the same state.

### Tests for User Story 5

- [X] T096 [P] [US5] Playwright in `site/tests/e2e/us5-transfer.spec.ts` producing results on all
  four surfaces, exporting, importing into a fresh context, and asserting every surface matches
- [X] T097 [P] [US5] Playwright in `site/tests/e2e/us5-storage-degraded.spec.ts` asserting each
  surface stays usable with storage unavailable, and that a mock in progress survives to submission

### Implementation for User Story 5

- [X] T098 [US5] Confirm export and import carry all four namespaces in `site/src/lib/transfer.ts`,
  still refusing an incompatible record whole
- [X] T099 [US5] Add per-surface storage-unavailable messages using the T008 helper, without
  discarding the attempt on screen (FR-052)
- [X] T100 [US5] Add clearing of practice results only, leaving `foundation` untouched, to
  `site/src/pages/progress.astro` (FR-053)
- [X] T101 [US5] Run the full gate set from the repository root and from `site/`

**Checkpoint**: Nothing a candidate earns is trapped in one browser.

---

## Phase 9: User Story 6 - Contribute an original item (Priority: P6)

**Goal**: A contributor adds one item, validates it, republishes, and finds it in a mock and a quiz.

**Independent Test**: Add one item file, run the repository's validation, rebuild, and find it.

- [X] T102 [P] [US6] Pytest in `tests/test_export_item_bank.py` asserting a deliberately malformed
  item fails the build rather than reaching a learner surface (SC-006)
- [X] T103 [US6] Update `drills/bank/README.md` with what the site now does with an item, and
  confirm the documented `python -m drills.engine validate` command is what CI runs
- [X] T104 [US6] Add the contribution route to `site/src/pages/labs/index.astro` and the quiz empty
  state, so a candidate who spots a gap knows where items come from
- [X] T105 [US6] Run the full gate set from the repository root and from `site/`

**Checkpoint**: The bank can grow without a site change.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [X] T106 [P] Add `lab` and `flashcard` record types to `site/src/lib/search.ts`, keeping practice
  items out of the index so a search result cannot leak an answer (`contracts/routes.md`)
- [X] T107 [P] Verify every new page carries the unofficial notice and the licence terms (FR-058)
- [X] T108 [P] Give the worker its own `tsconfig` with `lib: ["webworker"]` so `self` is typed as
  a worker scope rather than borrowing the DOM `Window` lib. It compiles and behaves correctly
  today, but the type is wrong and the comment saying so should not have to stand in for a fix
- [X] T109 [P] Verify reduced motion and forced colours lose no information on the timer, the card
  flip, and the load progress indicator (FR-057)
- [X] T110 [P] Verify the code pane, item options, and report tables stay usable on a narrow screen
  without the page scrolling sideways
- [X] T111 Update `README.md` and `PROGRESS.md` coverage statements to reflect the authored bank
- [X] T112 Walk `specs/002-lab-runner-mock-exam/quickstart.md` end to end on a clean checkout
- [X] T113 Run the full gate set from the repository root and from `site/`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup — blocks every user story
- **US1 (Phase 3)**: depends on Foundational only. Needs no items, so it ships without the bank
- **Item bank (Phase 4)**: depends on nothing in this feature — it is content. **Blocks US2, US3,
  US6**
- **US2 (Phase 5)**: depends on Foundational and the item bank
- **US3 (Phase 6)**: depends on the item bank, and reuses `scoring.ts` from US2
- **US4 (Phase 7)**: depends on Foundational only — independent of the bank
- **US5 (Phase 8)**: depends on the surfaces whose state it moves; fullest after US1–US4
- **US6 (Phase 9)**: depends on the item bank and the US2 exporters
- **Polish (Phase 10)**: last

### The critical path

The item bank is the long pole and the only content work in the feature. It gates three of the six
stories and three success criteria, and it is written rather than coded, so it does not accelerate
with better tooling. Start it early and in parallel with Phase 3.

```text
Setup ─► Foundational ─┬─► US1 (labs, MVP) ──────────────┬─► US5 ─► Polish
                       │                                 │
                       ├─► US4 (flashcards) ─────────────┤
                       │                                 │
   Item bank ──────────┴─► US2 (mock) ─► US3 (quizzes) ──┴─► US6
   (start early)
```

### Within Each User Story

- Tests are written before the implementation they cover and must fail first
- Exporters before the modules that read their output
- Library modules before the components that use them
- Components before the pages that mount them

### Parallel Opportunities

- T002, T003, T004 in Setup
- T007, T008, T009, T010 in Foundational
- All eight bank-authoring tasks T038–T045 — different directories, no shared files
- Every test task marked [P] within a story
- US1 and US4 can proceed simultaneously with the item bank, by different people
- US2 and US3 share `scoring.ts`, so US3 follows US2 rather than running beside it

---

## Parallel Example: the item bank

```bash
# Eight independent directories, no shared files:
Task: "Author 17 items in drills/bank/02-applications-and-integration/"
Task: "Author 9 items in drills/bank/05-model-selection-and-optimization/"
Task: "Author 8 items in drills/bank/01-agents-and-workflows/"
Task: "Author 6 items in drills/bank/06-prompt-and-context-engineering/"
Task: "Author 6 items in drills/bank/08-tools-and-mcps/"
Task: "Author 4 items in drills/bank/07-security-and-safety/"
Task: "Author 2 items in drills/bank/03-claude-code/"
Task: "Author 1 item in drills/bank/04-eval-testing-and-debugging/"
```

## Parallel Example: User Story 1 tests

```bash
Task: "Playwright test in site/tests/e2e/us1-runtime-lazy.spec.ts"
Task: "Playwright test in site/tests/e2e/us1-runtime-isolation.spec.ts"
Task: "Playwright test in site/tests/e2e/us1-lab-journey.spec.ts"
Task: "Pytest in tests/test_runtime_bundle.py"
Task: "Vitest in site/tests/unit/labs.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: Setup
2. Phase 2: Foundational
3. Phase 3: User Story 1
4. **STOP and VALIDATE**: the labs run this repository's Python in a browser with no key

This is a genuine MVP. It needs no practice items, so it ships while the bank is still being
written, and it is the story the specification identifies as delivering full value on the day it
lands.

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → the labs run → demo
3. Item bank → the precondition for everything scored
4. US2 → a full weighted mock → demo
5. US3 → per-domain quizzes → demo
6. US4 → flashcards → demo
7. US5 → export and import across all of it
8. US6 → the bank can grow without a site change

### Parallel Team Strategy

1. Everyone completes Setup and Foundational
2. Then: one person on US1 (the runtime is the hardest engineering), one or more authoring the item
   bank (the largest volume of work), one on US4, which touches neither
3. US2 begins when the bank fills its quotas; US3 follows US2

---

## Notes

- [P] tasks touch different files and have no incomplete dependencies
- Every phase ends at a state where the full gate set passes, so a reviewer can inspect and commit
  between phases
- A delegated implementer does not run `git add` or `git commit`; it leaves work in the working tree
  for the orchestrator to review, re-gate, and commit
- Never reimplement apportionment in TypeScript — read `mock.json`
- Never import the runtime client from a mock or quiz page
- Never key flashcard state on a card's front
