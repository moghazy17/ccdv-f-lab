---

description: "Task list for feature 004: item-bank expansion past mock quota"
---

# Tasks: Item-bank expansion past mock quota

**Input**: Design documents from `/specs/004-item-bank-expansion/`
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/](contracts/)

**Tests**: Test tasks are included. The spec makes several requirements mechanical (FR-001, FR-003,
FR-005, FR-019, FR-020), and a mechanical requirement without a test is a convention.

**Organization**: Grouped by user story. Phases 1 and 2 are shared; phases 3 through 6 each deliver
one story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story the task serves (US1–US4)
- Every task names the exact files it creates or edits

## Counts live in the report, not here

**No task states how many items a sub-skill needs.** FR-001 forbids a written-out target, and a
count copied into this file is wrong the moment an item lands. Every authoring task ends at the same
condition: `python -m drills.engine coverage --domain "<domain>"` shows no shortfall for that
sub-skill. Run the report at the start of a task to see the work, and at the end to see it closed.

The measured snapshot in [research.md](research.md) is a dated record of what the report printed
during planning. It is evidence, not a source, and it is never the thing a task is checked against.

---

## Phase 1: Setup (baseline measurement)

**Purpose**: Establish the before state, so every later claim of progress is measured rather than
asserted.

- [X] T001 Run the full gate set from the repository root — `ruff check .`, `ruff format --check .`,
      `pytest -q`, `python -m drills.engine validate`, `python -m lab.evals run`,
      `python tools/check_blueprint_consistency.py`, `python tools/check_links.py`,
      `python tools/check_content_single_source.py` — and record that the tree is green before any
      change
- [X] T002 [P] Record the baseline site payload from `site/`: `npm run build` then
      `npm run check:payload`, noting the current headroom, since this feature's 109 items are the
      one thing that can move that budget
- [X] T003 [P] Record the baseline per-domain and per-sub-skill counts by reading
      `drills/bank/**/*.yaml`, so the coverage report's first run can be checked against a count
      taken independently of it

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: The targets, the report that drives every authoring task, and the sourcing gate that
every authored item must satisfy. **No authoring task may begin until this phase is complete** —
authoring against a target that does not yet exist is how a per-domain count gets typed by hand.

**⚠️ The gate and the conformance fixes land together.** Wiring `check_source_integrity.py` into CI
while three citations still fail would leave the tree red; T012 and T013 are part of the same
increment as T011.

### The shared apportionment helper and the coverage report

- [X] T004 Extract the largest-remainder arithmetic from `apportion_items` into a helper taking
      ordered `(key, weight)` pairs and a size, in `drills/engine/mock.py`; `apportion_items` keeps
      its signature, its behavior, and its tie-break, and delegates to it
- [X] T005 Create `drills/engine/coverage.py` with `TARGET_MULTIPLE` and `DOMAIN_FLOOR` as the only
      two constants, a domain target of `max(quota * TARGET_MULTIPLE, DOMAIN_FLOOR)` over
      `apportion_items` for a full-size mock, and sub-skill targets apportioned through the T004
      helper using weights from the existing `parse_sub_skills`
- [X] T006 Add held-count, shortfall, missing-difficulty, and multiple-response-presence reporting
      per domain and per sub-skill to `drills/engine/coverage.py`, excluding items marked
      `format_demonstration`
- [X] T007 Add the `coverage` subcommand to `drills/engine/__main__.py` beside validate, generate,
      take, and score, with `--domain`, `--json`, `--bank`, and `--blueprint`, exiting 0 whether or
      not a shortfall exists
- [X] T008 [P] Create `tests/test_bank_coverage.py` asserting the four invariants in
      [contracts/coverage-report.md](contracts/coverage-report.md): domain targets agree with
      `apportion_items`, sub-skill targets sum to the domain target, the shared helper reproduces
      `apportion_items` exactly including tie-breaking, and every blueprint sub-skill appears
      including one holding no items
- [X] T009 Verify the report's first run against the independent count from T003, and reconcile any
      disagreement before continuing — the report is about to become the definition of the work

### The source-integrity gate

- [X] T010 Create `tools/check_source_integrity.py` parsing `SOURCES.md` **line by line** per
      [contracts/source-integrity.md](contracts/source-integrity.md): reference definitions build a
      label-to-URL map, each table row contributes its cited URLs with that row's verified date, and
      both `[Title][label]` and `[Title](https://…)` forms resolve
- [X] T011 Implement the two checks in `tools/check_source_integrity.py` — every cited URL has a
      row, and no citation predates its row — failing with one line per problem naming the item's
      path, and making no network request
- [X] T012 Add a table for this repository's own cited source files to `SOURCES.md`, with a dated
      row for `lab/output.py` and one for `lab/config.py`, so a repository citation is recorded
      exactly as an external page is rather than exempted
- [X] T013 Add the missing streaming documentation row to `SOURCES.md`'s technology table, with what
      it establishes and the date the page is read
- [X] T014 [P] Create `tests/test_source_integrity.py` covering the parser against a fixture that
      includes both citation forms, the two failure kinds, and an assertion that the real bank now
      conforms with no exemption list
- [X] T015 Wire `python tools/check_source_integrity.py` into `.github/workflows/ci.yml` beside the
      link checker, and into `.github/workflows/pages.yml` where the same gates run before
      publication
- [X] T016 [P] Add `python tools/check_source_integrity.py` to the gate list in `AGENTS.md`, keeping
      the list the full set CI runs rather than a summary of it

### The authoring advisories

- [X] T017 Add an advisory near-duplicate report to `drills/engine/validation.py`, comparing stems
      and correct-option rationales **within a domain only**, printed by `validate` without failing
      it; the existing duplicate-id check stays as it is and is not reimplemented
- [X] T018 [P] Extend `tests/test_drill_validation.py` with a case asserting the near-duplicate
      report is advisory — a near-duplicate pair produces output but a zero exit status — and a case
      asserting each covered domain holds all three difficulty levels
- [X] T019 **Gate**: run the full repository gate set plus `python tools/check_source_integrity.py`,
      and `npm run build` and `npm run check:payload` from `site/`; report results before any
      authoring begins

**Checkpoint**: targets are computed, the work list is machine-generated, sourcing is enforced, and
the existing bank conforms. Authoring can begin.

---

## Phase 3: User Story 1 — A second mock asks different questions (Priority: P1) 🎯 MVP

**Goal**: Bring the two heaviest domains to target so that a second sitting of the weighted mock
draws substantially different items across the largest share of the exam.

**Independent Test**: `python -m drills.engine generate --seed 1` and again with a different seed,
then compare the two item sets within Applications and Integration and Model Selection and
Optimization: a majority of drawn items differ, while each domain still contributes exactly its
apportioned quota.

**Authoring rule for every task in this phase**: follow
[contracts/item-authoring.md](contracts/item-authoring.md) — open the backing page and read the
passage first, add or re-date its `SOURCES.md` row, then write the item. An item written from memory
with a plausible URL attached afterwards passes every gate in this repository and is still wrong. If
a page cannot be opened, leave the item unwritten and report the blocked sub-skill.

### Applications and Integration

Each task runs until `python -m drills.engine coverage --domain "Applications and Integration"`
reports no shortfall for its sub-skill. The six tasks touch disjoint files and can be worked in
parallel, but each ends with its own `validate` and `check_source_integrity` run.

- [X] T020 [P] [US1] Author items for *Claude Application Design* into
      `drills/bank/02-applications-and-integration/`, citing Anthropic's interface,
      content-boundary, schema, and session-hygiene documentation, and adding each cited page's
      `SOURCES.md` row first
- [X] T021 [P] [US1] Author items for *Software Engineering Foundations* into
      `drills/bank/02-applications-and-integration/`, on REST and JSON handling, asynchronous
      patterns, version control, and refactoring at both scales
- [X] T022 [P] [US1] Author items for *Claude API Mechanics* into
      `drills/bank/02-applications-and-integration/`, on messages, tools, streaming, vision,
      thinking, caching, third-party vendor access, and the batch-versus-realtime tradeoff
- [X] T023 [P] [US1] Author items for *Configuration Management* into
      `drills/bank/02-applications-and-integration/`, on the instruction-file hierarchy, the
      settings file, model version pinning, and prompt versioning
- [X] T024 [P] [US1] Author items for *Understanding Requirements* into
      `drills/bank/02-applications-and-integration/`, deriving functional and infrastructure
      requirements from business requirements
- [X] T025 [P] [US1] Author items for *Systems Life Cycle* into
      `drills/bank/02-applications-and-integration/`, on developing, implementing, operating, and
      maintaining a deployed Claude integration
- [X] T026 [US1] **Gate**: run the full repository gate set, `python
      tools/check_source_integrity.py`, and `npm run build` plus `npm run check:payload` from
      `site/`; record the remaining shortfall from `python -m drills.engine coverage`

### Model Selection and Optimization

- [X] T027 [P] [US1] Author items for *Technical Fundamentals* into
      `drills/bank/05-model-selection-and-optimization/`
- [X] T028 [P] [US1] Author items for *LLM Fundamentals* into
      `drills/bank/05-model-selection-and-optimization/`
- [X] T029 [P] [US1] Author items for *Cost and Token Management* into
      `drills/bank/05-model-selection-and-optimization/`, on caching economics, batch pricing, and
      the token accounting a candidate must reason about
- [X] T030 [P] [US1] Author items for *Model Selection and Tradeoffs* into
      `drills/bank/05-model-selection-and-optimization/`, on choosing between tiers under stated
      latency, cost, and capability constraints
- [X] T031 [US1] **Gate**: run the full repository gate set,
      `python tools/check_source_integrity.py`, and `npm run build` plus `npm run check:payload`
      from `site/`; record the remaining shortfall
- [X] T032 [US1] Verify the story: generate two mocks with different seeds and confirm a majority of
      items differ within each of the two covered domains, with each domain contributing exactly its
      apportioned quota

**Checkpoint**: the two heaviest domains hold three times their quota. A second mock differs across
roughly half the exam's weight.

---

## Phase 4: User Story 2 — A domain quiz can be attempted twice (Priority: P2)

**Goal**: Confirm that a covered domain's scored quiz varies between attempts, and that a domain
still below target degrades honestly rather than misleading a candidate.

**Independent Test**: Take a covered domain's quiz twice and confirm the two attempts differ; take
an uncovered domain's quiz and confirm it still assembles and still says what it is.

- [X] T033 [US2] Verify in `site/` that a covered domain's quiz draws a varying subset: a domain
      quiz asks for that domain's mock quota, which is now a third of what the domain holds
- [X] T034 [P] [US2] Verify that every drawn item carries its domain's exact blueprint name and a
      sub-skill the blueprint places in that domain, with no near-miss string detaching an item from
      its quiz
- [X] T035 [P] [US2] Verify that a domain still at quota continues to assemble its quiz and its
      share of the mock from what it holds, and that the mock page's surplus disclosure still
      describes the bank as measured (FR-026, FR-031)
- [X] T036 [US2] **Gate**: run `npm run test:unit` and `npm run test:e2e` from `site/`, confirming
      no site behavior changed while the data underneath it grew

**Checkpoint**: the per-domain feedback loop varies where the bank supports it, and states the truth
where it does not.

---

## Phase 5: User Story 3 — Every sub-skill practised in proportion (Priority: P2)

**Goal**: Close the per-sub-skill floors, the difficulty floor, and the multiple-response floor in
the covered domains — the requirements a domain-level count can satisfy while a sub-skill still
stands alone.

**Independent Test**: `python -m drills.engine coverage` shows, for each covered domain, no
sub-skill below two items, all three difficulty levels present, and at least one multiple-response
item.

- [X] T037 [US3] Read `python -m drills.engine coverage --json` and list every remaining floor
      violation in the covered domains: a sub-skill under two items, a missing difficulty level, or
      a domain with no multiple-response item
- [X] T038 [P] [US3] Author `recall`-difficulty items into the covered domains' directories until
      each covered domain holds at least one, since the bank holds none at all before this feature
- [X] T039 [P] [US3] Author at least one multiple-response item into each covered domain's
      directory, with the stem stating its own select count (FR-014, FR-015)
- [X] T040 [P] [US3] Author items for *Claude Hooks* into `drills/bank/07-security-and-safety/`,
      which holds none at all, using this repository's own `PreToolUse` hook as the worked example
      the Claude Code module already publishes
- [X] T041 [US3] Review every item authored in phases 3 through 5 against
      [contracts/item-authoring.md](contracts/item-authoring.md), reading the near-duplicate
      advisory from `python -m drills.engine validate` and rewriting or withdrawing any item that
      turns on a fact another item in its domain already tests (FR-012)
- [X] T042 [US3] **Gate**: run the full repository gate set plus
      `python tools/check_source_integrity.py`, and the full site suite from `site/`

**Checkpoint**: coverage is proportional at sub-skill level, and every covered domain practises all
three difficulties and both item formats.

---

## Phase 6: User Story 4 — A reviewer can verify an item's source (Priority: P3)

**Goal**: Make any item traceable to the passage that backs it in under a minute, without
independent research.

**Independent Test**: Pick five items at random across the authored set, follow each citation, and
find both the passage that settles the item and a matching dated row in `SOURCES.md`.

- [X] T043 [US4] Confirm `python tools/check_source_integrity.py` passes over the whole grown bank
      with no exemption list, including every item authored before this feature (FR-020)
- [X] T044 [P] [US4] Spot-check five authored items end to end — open each cited page, find the
      passage the item turns on, and confirm the `SOURCES.md` row states what that page establishes
- [X] T045 [P] [US4] Confirm that every `SOURCES.md` row added during this feature names what the
      page establishes in terms specific enough to re-verify later, rather than restating the page's
      title
- [X] T046 [US4] Record any sub-skill left short because a backing page could not be opened or no
      longer states the claim, so the shortfall is reported rather than filled with an unsourced
      substitute (FR-021)

**Checkpoint**: sourcing is mechanical, and the one thing that cannot be mechanised — whether the
page says what the item claims — has been checked by hand and recorded.

---

## Phase 7: Polish and cross-cutting concerns

- [X] T047 [P] Update `drills/bank/README.md` to describe the coverage report as the way to find the
      next item to write, and the source-integrity check as a gate
- [X] T048 [P] Update `ITEM-BANK-PLAN.md` to record which domains reached target and which remain,
      so the working document matches the tree
- [X] T049 Record the follow-on in a form the next session can pick up: the six remaining domains,
      their targets taken from the report rather than restated, and the passes they divide into
      (FR-030)
- [X] T050 Confirm the constitutional checks by hand: every displayed count derives from
      `BLUEPRINT.md` (Principle I), no item text was copied into `site/` (Principle II), no journey
      gained an account, install, or key requirement (Principle III), and the payload budget still
      holds (Principle VIII)
- [X] T051 **Final gate**: the full repository gate set plus
      `python tools/check_source_integrity.py`, and `npm run lint`, `npm run typecheck`,
      `npm run test:unit`, `npm run build`, `npm run check:payload`, `npm run test:e2e` from `site/`
- [X] T052 Run the [quickstart.md](quickstart.md) verification sequence end to end as a fresh reader
      would, and correct anything it gets wrong about the tree

---

## Dependencies and execution order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup — **blocks every authoring phase**, because the
  targets and the sourcing gate must exist before an item is written against them
- **US1 (Phase 3)**: depends on Foundational. The bulk of the feature
- **US2 (Phase 4)**: depends on US1 — a quiz cannot vary until its domain holds surplus
- **US3 (Phase 5)**: depends on US1 for the domains it completes; T040 (*Claude Hooks*) depends only
  on Foundational and can run at any point after it
- **US4 (Phase 6)**: the gate itself lands in Foundational; this phase's verification depends on the
  authoring being done
- **Polish (Phase 7)**: depends on everything above

### Why US4's tooling sits in Phase 2 despite being P3

The story is lowest priority by learner value and highest by sequence: every item authored in phases
3 through 5 must satisfy the sourcing gate, so the gate must exist before authoring rather than
after it. Landing it late would mean re-verifying 52 items instead of writing them correctly once.

### Within an authoring task

Read the page → record the source → write the item → validate. Never write first and cite
afterwards.

### Parallel opportunities

- T002 and T003 in Setup
- T008, T014, T016, T018 in Foundational, once their implementation tasks land
- T020 through T025 — six sub-skills, disjoint files, one domain
- T027 through T030 — four sub-skills, disjoint files
- T038, T039, T040 in US3
- T044 and T045 in US4
- T047 and T048 in Polish

Two authors can take a sub-skill each within a domain; the files never collide, because one item is
one file. The gate tasks are the serialization points.

---

## Parallel example: Applications and Integration

```text
# All six target drills/bank/02-applications-and-integration/, one file per item.
Task: "Author items for Claude Application Design"
Task: "Author items for Software Engineering Foundations"
Task: "Author items for Claude API Mechanics"
Task: "Author items for Configuration Management"
Task: "Author items for Understanding Requirements"
Task: "Author items for Systems Life Cycle"
```

Each ends when the coverage report shows that sub-skill at zero shortfall, and each runs
`python -m drills.engine validate` and `python tools/check_source_integrity.py` before it is
considered done.

---

## Implementation strategy

### Smallest useful increment

Phase 1 plus Phase 2 delivers something valuable on its own even if no item is ever authored against
it: the targets become computable, the follow-on becomes measurable rather than estimated, and three
unrecorded citations that ship today are fixed. Stop and validate there.

### Incremental delivery

1. Setup and Foundational → the work becomes measurable, and the tree is green
2. US1, one domain at a time → the mock varies across the heaviest half of the exam
3. US2 → confirm the quizzes vary and the uncovered domains still behave
4. US3 → close the sub-skill, difficulty, and format floors
5. US4 → verify sourcing by hand where no check can
6. Polish → hand the follow-on over in a state the next session can act on

Each authoring task is individually shippable: an item that validates reaches the mock, its domain
quiz, and search with no further work.

### What closes this feature

The tooling, the conformance fixes, and the two heaviest domains at target (FR-029). The remaining
six domains keep the same targets and are the tracked follow-on, whose size is read from the
coverage report rather than from a number written here.

---

## Notes

- `[P]` tasks touch different files and have no dependency on an incomplete task
- Every authoring task's completion condition is the coverage report, never a number in this file
- The gate tasks are numbered deliberately: a gate that is assumed rather than run is a gate that is
  skipped, and this repository has had a red build reach a branch that way before
- A delegated implementer does not run `git add` or `git commit`; it leaves the work in the tree for
  the orchestrator to review, re-gate, and commit
- Factual sourcing is not delegable. A sandboxed implementer cannot open Anthropic's documentation,
  and an invented citation breaches Principle V while passing every structural check
