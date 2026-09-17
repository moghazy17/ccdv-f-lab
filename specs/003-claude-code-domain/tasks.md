---

description: "Task list for the Claude Code simulator, configuration builder, and playground"
---

# Tasks: Claude Code simulator, configuration builder, and playground

**Input**: Design documents from `/specs/003-claude-code-domain/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included, and not as a stylistic preference. Six of the twelve success criteria require
automatic verification in their own words — SC-002 "demonstrated by a deliberate attempt", SC-003,
SC-004, SC-006, SC-007, SC-009 "verified against the built site rather than by inspection" — and
constitution Principle VI makes the gate set non-negotiable. A test task here is the deliverable of
a success criterion, not scaffolding around it.

**Organization**: Grouped by user story. Two cross-story dependencies are real and are marked rather
than hidden: the playground is built from the terminal, and the worked example cannot link to note
sections that do not yet exist.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to
- Exact file paths are given in each task

## Path conventions

Repository root holds `claude-code/`, `notes/`, `tools/`, `tests/`. The site is `site/`, with
`site/src/lib/`, `site/src/components/`, `site/src/pages/`, `site/tests/unit/`, `site/tests/e2e/`.

---

## Phase 1: Setup

**Purpose**: Put the new data source and its export path in place before anything reads them.

- [X] T001 Create `claude-code/` at the repository root with a `README.md` stating that
      `commands.yml` is the simulator's behavioural source, that every entry cites `SOURCES.md`, and
      that it is not study prose
- [X] T002 Create `claude-code/commands.yml` with the file-level shape from
      `specs/003-claude-code-domain/contracts/command-data.md` and two worked entries (one built-in,
      one custom) to fix the format
- [X] T003 [P] Add `site/src/lib/claude-code/` and `site/tests/unit/claude-code/` directories with
      an index module so later tasks have a home
- [X] T004 [P] Register `tools/export_claude_code_data.py` in the `predev`, `prebuild`,
      `pretypecheck`, and `pretest:unit` scripts in `site/package.json`, alongside the three
      exporters already there
- [X] T005 Add `site/src/data/claude-code.json` to the generated-file conventions noted in
      `site/README.md` (or the site's existing contributor note) so it is never hand-edited

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: The exporter, its gates, the worker's second execution path, and the storage namespace.
Every user story reads from at least one of these.

**⚠️ CRITICAL**: No user story phase can begin until this phase is complete.

### The exporter and its gates

- [X] T006 Implement `tools/export_claude_code_data.py` reading `claude-code/commands.yml` and
      emitting the `commands` and `scopes`/`fragments` sections of `site/src/data/claude-code.json`
      per `contracts/command-data.md`
- [X] T007 Extend `tools/export_claude_code_data.py` to walk the repository's `.claude/` directory
      and emit the `workedExample` section, classifying each file by component type — discovered by
      walking, never from a maintained list (FR-031)
- [X] T008 Implement the hook-recording driver in `tools/export_claude_code_data.py` using the
      validated Phase 0 driver (stdin via `io.StringIO`, `runpy.run_path(run_name="__main__")`,
      `SystemExit.code`, redirected streams) per `contracts/hook-recording.md`
- [X] T009 Add the required fixture battery from `contracts/hook-recording.md` — protected write,
      ordinary write, destructive shell, ordinary shell, a command that only mentions a protected
      filename, and a malformed payload — and emit the `hookRecording` section
- [X] T010 [P] Implement the citation gate: every `source_anchor` in `commands.yml` must resolve to a
      link anchor present in `SOURCES.md`, failing the build with the offending id when it does not
- [X] T011 [P] Implement the blueprint-coverage gate: every feature named in the *Claude Code
      Operation* sub-skill statement read from `BLUEPRINT.md` must be claimed by at least one entry's
      `blueprint_feature`
- [X] T012 [P] Implement the custom-command-exists gate: an entry with `kind: custom` must name a
      `defined_by` path present in the repository
- [X] T013 Wire the freshness check into `tools/check_blueprint_consistency.py` so a stale
      `site/src/data/claude-code.json` fails the same gate that already guards the other derived data
- [X] T014 [P] Write `tests/test_claude_code_export.py` covering the exporter, all four gates above,
      and a deliberately failing fixture for each gate that proves publication is blocked (SC-003)
- [X] T015 [P] Extend `tests/test_claude_configuration.py` with the recording freshness check —
      regenerating from the live hook must reproduce the committed recording byte for byte — and the
      coverage check that the required cases are all present (SC-007)

### The runtime worker

- [X] T016 Add the `profile` field to `InitMessage` in `site/src/lib/runtime/worker.ts`, defaulting
      to `"labs"`, with `"stdlib"` skipping `loadPackage`, the `lab-drills.zip` unpack, and the
      `lab.secrets` bootstrap, per `contracts/runtime-worker.md`
- [X] T017 Add the `run-hook` inbound message and `hook-result` outbound message to
      `site/src/lib/runtime/worker.ts`, writing the hook source to the Pyodide filesystem and running
      it through the driver. A hook exiting non-zero MUST yield `hook-result`, never `failed`
- [X] T018 Add `runHook()` to `site/src/lib/runtime/client.ts` exposing the message pair with the
      same lazy-load, progress, and stop behaviour the existing `run` path has
- [X] T019 [P] Write `site/tests/unit/runtime-hook.spec.ts` asserting that a denying hook returns
      `hook-result` with a non-zero exit code and a message on stderr, that a permitting hook returns
      zero, and that a hook raising before exit still returns `hook-result` rather than `failed`

### Shared state and typed access

- [X] T020 Add the `claudeCode` namespace to `site/src/lib/storage.ts` with `guidedTasks`,
      `scopeExercise`, and `configDraft` per `data-model.md`, preserving unknown namespaces on
      migration as the existing code does, and **holding no terminal transcript**
- [X] T021 [P] Implement the typed loader `site/src/lib/claude-code/commands.ts` over
      `site/src/data/claude-code.json`, the only reader of that file
- [X] T022 [P] Write `site/tests/unit/claude-code/storage.spec.ts` covering the new namespace's
      round-trip, its independent clearing, and its degradation when storage is unavailable, full, or
      written by a newer version

### Phase 2 gate

- [X] T023 Run `ruff check .`, `ruff format --check .`, `pytest -q`,
      `python tools/check_blueprint_consistency.py`, and `python tools/check_links.py`; then in
      `site/`: `npm run lint`, `npm run typecheck`, `npm run test:unit`

**Checkpoint**: Data, gates, runtime, and storage are ready. User story phases may begin.

---

## Phase 3: User Story 1 — Practise a Claude Code session (Priority: P1) 🎯 MVP

**Goal**: A candidate runs built-in and custom slash commands, manages a session, and sees headless
and streaming forms — with no install and no key.

**Independent Test**: Open the terminal page, run a built-in command, a custom command, and a
headless invocation, and confirm each produces the documented result with an explanation and a
citation.

### Tests for User Story 1

- [X] T024 [P] [US1] Write `site/tests/e2e/us1-terminal-journey.spec.ts` covering the seven
      acceptance scenarios, including the unimplemented-command statement and the no-fabricated-model
      -response rule
- [X] T025 [P] [US1] Write `site/tests/e2e/us1-terminal-privacy.spec.ts` asserting no request leaves
      the browser and the runtime is never fetched on this page (SC-002, FR-053)
- [X] T026 [P] [US1] Write `site/tests/unit/claude-code/session.spec.ts` covering clear versus
      compact semantics — clear empties the transcript, compact summarises and sets
      `compactedBefore` — and that neither persists anything

### Implementation for User Story 1

- [X] T027 [US1] Populate `claude-code/commands.yml` with the full bounded set: every command and
      mode the blueprint names, plus the help, model, cost, and permissions commands, each with an
      explanation, a `source_anchor`, and a transcript (FR-005)
- [X] T028 [P] [US1] Add the `SOURCES.md` entries any new behaviour needs, each with a verification
      date, before the citation gate can pass
- [X] T029 [US1] Implement `site/src/lib/claude-code/session.ts` — transcript state, turn
      resolution, clear and compact — holding state for the visit only
- [X] T030 [US1] Implement `site/src/components/SimulatedTerminal.astro` with keyboard operation
      throughout, including reaching and re-running earlier commands (FR-013)
- [X] T031 [US1] Implement streaming presentation so events arrive progressively, are announced to
      assistive technology as a completed result rather than continuously, and lose no information
      under reduced motion (FR-010, FR-052)
- [X] T032 [US1] Implement hook-denial presentation attributing the refusal to the hook rather than
      to the model declining, distinguishable without colour (FR-011)
- [X] T033 [US1] Implement `site/src/components/GuidedTasks.astro` — the ordered task set, completion
      stored in the `claudeCode` namespace, stated as neither a score nor part of readiness (FR-013a)
- [X] T034 [US1] Replace the reserved stub at `site/src/pages/claude-code/terminal/index.astro` with
      the real page, stating that it is a simulation and showing the bounded implemented set
- [X] T035 [US1] Add the "not implemented here" path with a link to the implemented set, and the
      explicit refusal to fabricate a model response (FR-005, FR-006)

**Checkpoint**: The terminal works independently. This is the MVP.

---

## Phase 4: User Story 2 — Assemble the instruction hierarchy (Priority: P2)

**Goal**: A candidate composes instruction scopes and discovers that files concatenate rather than
override, and that an instruction file is context while a settings rule or hook enforces.

**Independent Test**: Assign the prepared fragments to scopes, produce the composed result, confirm
it matches the documented load order and composition rule, then place the unenforceable rule and
confirm the exercise says so.

### Tests for User Story 2

- [X] T036 [P] [US2] Write `site/tests/unit/claude-code/hierarchy.spec.ts` asserting the composed
      result concatenates root-down in the documented order, that a conflicting pair leaves **both**
      instructions present, and that no arrangement removes a lower-precedence instruction (SC-004)
- [X] T037 [P] [US2] Write `site/tests/e2e/us2-hierarchy-journey.spec.ts` covering the four
      acceptance scenarios including the dated citation being one click away

### Implementation for User Story 2

- [X] T038 [US2] Add the four documented scopes and the fragment set to `claude-code/commands.yml`,
      including at least one conflicting pair and at least one unenforceable rule, using the
      documented scope names rather than the brief's paraphrase (FR-017)
- [X] T039 [US2] Add a gate to `tools/export_claude_code_data.py` asserting the fragment set always
      contains a conflicting pair and an unenforceable rule, so no edit can flatten the exercise
- [X] T040 [US2] Implement `site/src/lib/claude-code/hierarchy.ts` — composition, conflict
      detection, unenforceable detection — with no code path that removes a contribution
- [X] T041 [US2] Implement `site/src/components/ScopeComposer.astro`, fully keyboard-operable, with
      side-by-side panes that stay usable on a narrow screen without sideways scrolling
- [X] T042 [US2] Show the enforcement statement naming the settings rule or hook that would enforce
      a rule an instruction file cannot (FR-016)
- [X] T043 [US2] Surface the dated citation for the load order and composition rule from the exercise

**Checkpoint**: The hierarchy exercise works independently of the terminal.

---

## Phase 5: User Story 3 — Build a configuration and watch it refuse (Priority: P3)

**Goal**: Forms produce three files; the generated hook runs in the browser and denies a destructive
action and permits an ordinary one.

**Independent Test**: Complete the forms, generate all three files, run the generated hook against a
destructive and an ordinary payload, and copy the files out.

### Tests for User Story 3

- [X] T044 [P] [US3] Write `site/tests/unit/claude-code/generate.spec.ts` asserting the three files'
      shapes, that the settings file parses, that the hook is valid Python, and that each refusal
      case in `contracts/generated-files.md` is refused at the form rather than emitted
- [X] T045 [P] [US3] Write `tests/test_claude_code_generated_files.py` generating files for a
      representative set of form answers and executing each hook through the shared driver, asserting
      it denies and permits as intended (SC-006)
- [X] T046 [P] [US3] Write `site/tests/e2e/us3-config-journey.spec.ts` covering the six acceptance
      scenarios, including the runtime-unavailable path still generating and handing over files
- [X] T047 [P] [US3] Write `site/tests/e2e/us3-config-lazy.spec.ts` asserting the runtime is not
      fetched until the candidate asks for a hook run, and that generate, copy, and download all work
      before it is (FR-024)

### Implementation for User Story 3

- [X] T048 [US3] Implement `site/src/lib/claude-code/generate.ts` turning typed form state into the
      three files, with the hook always Python (FR-018)
- [X] T049 [US3] Implement form-level refusal for every combination in `contracts/generated-files.md`
      — empty matcher, hook with no command, a permission in both allow and deny, an empty settings
      file — stating the reason (FR-021)
- [X] T050 [US3] Implement the settings read-back showing what the file permits, denies, and
      registers in readable form (FR-020)
- [X] T051 [US3] Ensure the generated instruction file states in its own text that it is context
      rather than enforced configuration, carrying the module's teaching point into the artifact
- [X] T052 [US3] Implement copy and download for each file, with a fully visible and selectable
      fallback when the clipboard is unavailable or refused (FR-019)
- [X] T053 [US3] Implement the prove-it step calling `runHook()` with the sample payloads, showing at
      minimum one denial and one permitted action as the hook's own output (FR-022)
- [X] T054 [US3] Present decisions without relying on colour alone, and keep the denial attributed to
      the hook rather than to the page's commentary
- [X] T055 [US3] Implement the runtime-unavailable path: files still generated and copyable, with the
      reason stated and local instructions given (FR-025)
- [X] T056 [US3] Persist form answers to the `claudeCode` namespace and make them discardable, with
      no field that invites a credential (FR-026)
- [X] T057 [US3] Initialise the worker with `profile: "stdlib"` from this page only
- [X] T058 [US3] Replace the reserved stub at `site/src/pages/claude-code/config/index.astro` with
      the real page
- [X] T059 [US3] Add a build check asserting no page but the configuration builder imports the
      runtime client

**Checkpoint**: The builder generates and proves, independently of the other stories.

---

## Phase 6: User Story 4 — The worked example (Priority: P4)

**Goal**: The repository's own `.claude/` directory is rendered as the worked example, with the
hook's behaviour described by recording rather than by prose.

**Independent Test**: Open the worked example and confirm every component is shown as it is on disk,
with the hook's behaviour described accurately.

**⚠️ Depends on US5's section headings.** FR-032 fails publication when a `noteAnchor` does not
resolve, so the note's headings must exist before this phase completes. The prose behind them may
land later; T072 creates the headings early for exactly this reason.

### Tests for User Story 4

- [X] T060 [P] [US4] Write `site/tests/e2e/us4-worked-example.spec.ts` covering the four acceptance
      scenarios
- [X] T061 [P] [US4] Write `tests/test_claude_code_worked_example.py` asserting that adding a file to
      `.claude/` changes the export with no file under `site/` edited (SC-008), and that a missing
      note anchor or missing repository link fails publication (FR-032)
- [X] T062 [P] [US4] Add a check that no file under `site/` contains a hand-written sentence
      describing what the repository's hook denies (the rule in `contracts/hook-recording.md`)

### Implementation for User Story 4

- [X] T063 [US4] Implement `site/src/components/WorkedExample.astro` rendering each component from
      the export, naming the component type it demonstrates (FR-029)
- [X] T064 [US4] Render the hook recording — payload, decision, and the hook's own message per case —
      as the only description of what the hook does
- [X] T065 [US4] Link each component to its file in the repository and to the note section that
      explains it, failing publication when either target is missing (FR-032)
- [X] T066 [US4] Correct `.claude/README.md` to describe the hook as it is: one protected
      ground-truth file, and matching that catches any shell command mentioning it. **Do not change
      the hook's behaviour** (FR-030)
- [X] T067 [US4] Add the worked example to the Claude Code module's page, reached from domain 3

**Checkpoint**: The worked example is accurate and self-maintaining.

---

## Phase 7: User Story 5 — The domain note (Priority: P5)

**Goal**: `notes/03-claude-code/` carries authored content, and the site's existing generation
carries it into flashcards, search, and recall prompts.

**Independent Test**: Open the domain page and confirm authored content, a decision table, pitfalls,
recall prompts, and dated citations, with the scaffold notice gone.

### Tests for User Story 5

- [X] T068 [P] [US5] Write `site/tests/e2e/us5-domain-note.spec.ts` asserting the scaffold notice is
      absent for domain 3 and that recall prompts render
- [X] T069 [P] [US5] Extend the repository's existing note-structure checks to cover domain 3's
      authored state, including exact blueprint domain and sub-skill names

### Implementation for User Story 5

- [X] T070 [US5] Add the `SOURCES.md` entries for every factual claim the note will make, each with a
      verification date, before the prose cites them
- [X] T071 [US5] Author `notes/03-claude-code/README.md`: core components, the instruction hierarchy
      and its composition rule, session management, headless and streaming, hooks as enforcement
- [X] T072 [US5] Create the section headings that the worked example's `noteAnchor` values resolve
      to, so US4 can complete (see the dependency note in Phase 6)
- [X] T073 [P] [US5] Author `notes/03-claude-code/decision-tables.md` with a "choose this when"
      column, covering at minimum headless versus interactive, clear versus compact, and instruction
      file versus settings rule versus hook
- [X] T074 [P] [US5] Author `notes/03-claude-code/pitfalls.md`, leading with the two misconceptions
      the module exists to correct — that the nearer instruction file overrides, and that an
      instruction is enforced
- [X] T075 [P] [US5] Author `notes/03-claude-code/self-check.md` recall prompts
- [X] T076 [US5] Regenerate the flashcard deck and confirm domain 3 cards, search entries, and recall
      prompts appear with no further edit (FR-041)

**Checkpoint**: The domain has written content and every other surface's links resolve.

---

## Phase 8: User Story 6 — The playground (Priority: P6)

**Goal**: A free-form Claude Code terminal with no task, no guidance, and no score.

**Independent Test**: Open the playground, run several commands, and confirm it behaves as the
module's terminal does with no task, no scoring, and no readiness effect.

**⚠️ Depends on US1.** The playground is the terminal component without guidance; it has no separate
simulator. This is the one place the spec accepts a story that is not independently implementable.

### Tests for User Story 6

- [X] T077 [P] [US6] Write `site/tests/e2e/us6-playground.spec.ts` covering the four acceptance
      scenarios, including that a return visit starts clean and nothing was written to the device
- [X] T078 [P] [US6] Write a check asserting nothing done in the playground touches the readiness,
      quiz, or score-report state (FR-035)

### Implementation for User Story 6

- [X] T079 [US6] Replace the reserved stub at `site/src/pages/playground/index.astro` with the
      terminal component configured with no tasks, no progress indicator, and no score
- [X] T080 [US6] State on the page that it is a simulation and that the transcript starts clean each
      visit, and provide a within-visit clear (FR-034, FR-036)
- [X] T081 [US6] Link to the module's guided terminal, described as the guided one (FR-037)

**Checkpoint**: All six stories are functional.

---

## Phase 9: Polish, weighting, and cross-cutting gates

- [X] T082 Extend `site/src/pages/domains/[domain].astro` to link the module's surfaces from domain
      3's page, with no new top-level navigation entry (FR-044)
- [X] T083 [P] Show, on each surface, the sub-skills it serves with their published weights read from
      `site/src/data/blueprint.json` — 3.1% Claude Code Operation, 4.1% Configuration Management,
      1.0% Claude Hooks (FR-045)
- [X] T084 Rewrite `site/tests/e2e/reserved-routes.spec.ts`, moving the three addresses to the live
      list and keeping their route-stability assertions (FR-050)
- [X] T085 Rewrite `site/tests/e2e/reserved-extension.spec.ts` the same way, following the precedent
      its own comment records from feature 002
- [X] T086 [P] Write `site/tests/e2e/us-weighting.spec.ts` asserting domain 3 never outranks a
      heavier domain on any surface that ranks domains, and that the module adds no scored practice
      (SC-009)
- [X] T087 [P] Extend the accessibility suite to the three new pages, asserting no critical or
      serious violations and full keyboard completion of every journey (SC-010)
- [X] T088 [P] Add forced-colours and reduced-motion assertions for the transcript, the streaming
      output, and the decision presentation
- [X] T089 [P] Extend the export and import round-trip test to the `claudeCode` namespace, asserting
      guided tasks, scope state, and drafts survive and **no transcript is present in the exported
      file** (SC-012)
- [X] T090 Confirm the module's record clears independently of plans, diagnostic, and mock history
      (FR-048)
- [X] T091 Run `npm run check:payload` and confirm the configuration page's stdlib profile transfers
      the measured 6.10 MiB against the 8 MiB ceiling
- [X] T092 Verify no study markdown from `notes/`, `cheatsheets/`, `guide/`, `study-plans/`, or
      `drills/bank/` has been copied into `site/` (Principle II)
- [X] T093 Verify no journey requires an account, an installation, or an `ANTHROPIC_API_KEY`, and
      that no analytics or third-party runtime request was introduced (Principle III)
- [X] T094 Verify every displayed weight and item count derives from `BLUEPRINT.md` (Principle I)
- [X] T095 Run the full gate set from `quickstart.md`: `ruff check .`, `ruff format --check .`,
      `pytest -q`, `python tools/check_blueprint_consistency.py`, `python tools/check_links.py`, and
      in `site/`: `npm run lint`, `npm run typecheck`, `npm run test:unit`, `npm run build`,
      `npm run check:payload`, `npx playwright test`

---

## Dependencies & execution order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup — blocks every user story
- **US1 (Phase 3)**: depends on Phase 2
- **US2 (Phase 4)**: depends on Phase 2 — independent of US1
- **US3 (Phase 5)**: depends on Phase 2 — independent of US1 and US2
- **US4 (Phase 6)**: depends on Phase 2 **and on T072** from US5
- **US5 (Phase 7)**: depends on Phase 2 — independent of the others
- **US6 (Phase 8)**: depends on **US1** — it is the terminal without guidance
- **Polish (Phase 9)**: depends on every story that is being shipped

### The two honest exceptions

Most stories here are independent. Two are not, and pretending otherwise would produce a build order
that fails:

1. **US6 needs US1.** The playground has no simulator of its own. If only one of the two ships, it
   must be US1.
2. **US4 needs US5's headings.** FR-032 fails publication on an unresolved note anchor. T072 exists
   to unblock US4 early; the note's prose can follow.

### Within each story

Data before logic, logic before component, component before page. Tests are written before the
implementation they cover and must fail first.

### Parallel opportunities

- T003, T004 in Setup
- T010, T011, T012, T014, T015 in Foundational, then T019, T021, T022
- All test tasks within a story phase carry [P]
- US2, US3, and US5 can run fully in parallel with US1 once Phase 2 is complete

---

## Parallel example: Foundational gates

```bash
Task: "Implement the citation gate in tools/export_claude_code_data.py"
Task: "Implement the blueprint-coverage gate in tools/export_claude_code_data.py"
Task: "Implement the custom-command-exists gate in tools/export_claude_code_data.py"
Task: "Write tests/test_claude_code_export.py with a failing fixture per gate"
Task: "Extend tests/test_claude_configuration.py with recording freshness and coverage"
```

---

## Implementation strategy

### MVP (User Story 1 only)

1. Phase 1: Setup
2. Phase 2: Foundational — blocks everything
3. Phase 3: User Story 1
4. **Stop and validate**: the terminal delivers the domain's central surface on its own
5. Run the Phase 9 gate tasks that apply

### Incremental delivery

Phase 2 → US1 (MVP) → US5's headings (T072) → US3 → US2 → US4 → US5 prose → US6. US3 is placed early
in delivery order despite its P3 priority because it serves the heaviest sub-skill the module
touches — *Configuration Management* at 4.1%, against domain 3's own 3.1%.

### Notes

- [P] means different files and no dependency on incomplete work
- A delegated implementer does not run `git add` or `git commit`; it leaves work in the working tree
  for the orchestrator to review, re-gate, and commit
- A hook exiting `2` is the hook working. Never route it to the worker's `failed` message
- The repository's own hook will refuse a shell command that mentions a protected filename, including
  inside a heredoc or a string literal. Use the editor tool for such files
