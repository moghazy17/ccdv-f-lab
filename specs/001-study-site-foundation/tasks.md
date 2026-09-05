---
description: "Dependency-ordered implementation tasks for the study site foundation"
---

# Tasks: Study site foundation and content pipeline

**Input**: Design documents from `specs/001-study-site-foundation/`
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`,
`quickstart.md`, and `contracts/`

**Tests**: Tests are required: pytest for both Python tools, Vitest for `storage.ts`,
`recommend.ts`, and `content-status.ts`, Playwright for all seven user-story journeys, and axe
checks for every page type.

**Organization**: Setup and shared blockers come first. Each user story then has an independently
testable phase in priority order, followed by cross-cutting proof and publication work.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches a separate file and has no unfinished dependency
- **[Story]**: Appears only on tasks inside a user-story phase
- Every checklist item names an exact file or working directory

## Phase 1: Setup

**Purpose**: Initialize the static-site toolchain and make every required gate executable.

- [X] T001 Use `site/package.json` to define exact Astro, Tailwind, Pagefind, Vitest, Playwright,
  axe, and lint scripts
  - Use exact versions and include `dev`, `typecheck`, `lint`, `build`, `test:unit`, and `test:e2e`
    scripts.

- [X] T002 Use `site/package-lock.json` to install the pinned site dependencies and retain the
  resolved lock
  - Install the Playwright-managed Chromium needed by `npm run test:e2e` as developer tooling.

- [X] T003 [P] Require exact dependency saves in `site/.npmrc`

- [X] T004 [P] Pin the CI-compatible Node 22 LTS line in `site/.nvmrc`

- [X] T005 [P] Enable TypeScript strict mode and Astro settings in `site/tsconfig.json`

- [X] T006 [P] Configure TypeScript and Astro linting in `site/eslint.config.js`

- [X] T007 [P] Configure browser-independent unit tests in `site/vitest.config.ts`

- [X] T008 [P] Use `site/playwright.config.ts` to configure built-site Playwright runs at the
  configured base path

- [X] T009 Use `site/astro.config.mjs` to configure static output, Tailwind, Pagefind, base path,
  and Vite access
  - Read `site` and `base` from environment variables, default the base to `/ccdv-f-lab/`, enforce
    trailing slashes, and allow the repository root through `vite.server.fs.allow`.

- [X] T010 [P] Create a valid shared document shell in `site/src/layouts/BaseLayout.astro`

- [X] T011 Create the buildable setup route in `site/src/pages/index.astro`

- [X] T012 [P] Add a passing toolchain smoke test in `site/tests/unit/setup.test.ts`

- [X] T013 [P] Add a build-and-serve smoke journey in `site/tests/e2e/setup.spec.ts`

- [X] T014 Implement the study-prose duplication gate in `tools/check_content_single_source.py`
  - Scan the five protected content roots and fail when their prose appears under `site/`; keep the
    implementation standard-library only and type-hint public functions.

### Setup gates

- [X] T015 Run `ruff check .` from repository root `./`

- [X] T016 Run `ruff format --check .` from repository root `./`

- [X] T017 Run `pytest -q` from repository root `./`

- [X] T018 Run `python tools/check_blueprint_consistency.py` from repository root `./`
  - Confirm every displayed weight and item count is derived from `BLUEPRINT.md`.

- [X] T019 Run `python tools/check_content_single_source.py` from repository root `./`
  - Confirm no study markdown was copied from `notes/`, `cheatsheets/`, `guide/`, `study-plans/`, or
    `drills/bank/` into `site/`.

- [X] T020 Run `npm run build` from `site/`

- [X] T021 Run `python -m drills.engine validate` from repository root `./`

- [X] T022 Run `python -m lab.evals run` from repository root `./`

- [X] T023 Run `npm run typecheck` from `site/`

- [X] T024 Run `npm run lint` from `site/`

- [X] T025 Run `python tools/check_links.py` from repository root `./`

- [X] T026 Run `npm run test:unit` from `site/`

- [X] T027 Run `npm run test:e2e` from `site/`
  - Confirm no journey requires or offers an account, installation, API key, analytics, tracking,
    cookies, or a third-party runtime request.

**Checkpoint**: The toolchain is initialized and the complete gate set passes.


---

## Phase 2: Foundational

**Purpose**: Build the derived-data, content, storage, layout, and reserved-address foundations that
block all stories.

- [X] T028 [P] Use `tests/fixtures/note-content-status.json` to define shared scaffold, partial, and
  authored cases

- [X] T029 [P] Write exporter and stale-blueprint gate tests in `tests/test_site_data_export.py`
  - Cover all eight domains, 25 sub-skills, byte-identical names, sums of 100 and 53, directory
    slugs, source digest, and stale derived output.

- [X] T030 [P] Use `tests/test_content_single_source.py` to write allow and rejection tests for the
  duplication gate

- [X] T031 [P] Use `tests/test_note_content_status.py` to pin Python authored-content results to the
  shared fixture

- [X] T032 [P] Use `site/tests/unit/content-status.test.ts` to write the matching content-status
  fixture test

- [X] T033 [P] Use `site/tests/unit/storage.test.ts` to write versioning, failures, namespaces, and
  cross-tab tests
  - Cover lower-version migration, higher-version refusal, unknown namespace preservation, malformed
    JSON, unavailable storage, quota failure, and per-mark reconciliation.

- [X] T034 [P] Use `site/tests/e2e/reserved-routes.spec.ts` to write contract checks for all
  reserved addresses
  - Assert trailing slashes, the configured base path, inert explanatory copy, and no interactive
    runtime on each of the nine address patterns.

- [X] T035 Implement the standard-library blueprint exporter in `tools/export_site_data.py`
  - Derive the complete blueprint-data contract, use largest-remainder allocation, validate domain
    directories, and emit a SHA-256 source digest.

- [X] T036 Generate the derived blueprint artifact with `tools/export_site_data.py` at
  `site/src/data/blueprint.json`

- [X] T037 Extend derived-data and directory drift checks in `tools/check_blueprint_consistency.py`

- [X] T038 Reject missing or stale blueprint data during builds in `site/astro.config.mjs`

- [X] T039 [P] Expose validated read-only blueprint entities in `site/src/lib/blueprint.ts`

- [X] T040 Load repository markdown without copying it in `site/src/content.config.ts`
  - Define collections over `notes/`, `guide/`, `study-plans/`, and `cheatsheets/` using external
    `glob()` bases permitted by the Vite allow-list.

- [X] T041 Mirror the Python authored-content rule in `site/src/lib/content-status.ts`
  - Strip `Authoring prompt:` lines and compute scaffold, partial, and authored states without
    storing them.

- [X] T042 Implement the sole localStorage accessor in `site/src/lib/storage.ts`
  - Use key `ccdv-f:progress`, schema version 1, a `foundation` namespace, pure migrations,
    forward-version refusal, non-destructive failures, and per-mark storage-event merging.

- [X] T043 [P] Use `site/src/components/ThemeToggle.astro` to implement the accessible light, dark,
  and system control

- [X] T044 [P] Define responsive and accessible presentation rules in `site/src/styles/global.css`
  - Include visible focus, WCAG 2.1 AA contrast, reduced motion, forced colors, and wide-table
    containment without horizontal page scrolling.

- [X] T045 Use `site/src/layouts/BaseLayout.astro` to complete the shared navigation, theme
  bootstrap, license, and disclaimer
  - Apply theme before first paint, include stable links to reserved routes, expose deep-link
    navigation, use self-hosted or system fonts, and create no analytics, cookies, credential
    fields, or off-origin requests.

- [X] T046 [P] Use `site/src/components/ReservedPage.astro` to create the inert reserved-capability
  presentation

- [X] T047 [P] Reserve the lab index address in `site/src/pages/labs/index.astro`

- [X] T048 [P] Use `site/src/pages/labs/[module].astro` to reserve repository-derived lab-module
  addresses

- [X] T049 [P] Reserve the weighted mock-exam address in `site/src/pages/mock/index.astro`

- [X] T050 [P] Reserve the mock-report address in `site/src/pages/mock/report.astro`

- [X] T051 [P] Reserve the flashcard-review address in `site/src/pages/flashcards/index.astro`

- [X] T052 [P] Use `site/src/pages/domains/[domain]/quiz/index.astro` to reserve every derived
  domain-quiz address

- [X] T053 [P] Use `site/src/pages/claude-code/terminal/index.astro` to reserve the
  terminal-simulator address

- [X] T054 [P] Use `site/src/pages/claude-code/config/index.astro` to reserve the
  configuration-builder address

- [X] T055 [P] Reserve the playground address in `site/src/pages/playground/index.astro`

- [X] T056 Extend internal-link validation to inspect built pages in `tools/check_links.py`
  - Resolve configured-base URLs, trailing slashes, routes, and heading fragments against
    `site/dist/` while retaining markdown-source checks.

### Foundational gates

- [X] T057 Run `ruff check .` from repository root `./`

- [X] T058 Run `ruff format --check .` from repository root `./`

- [X] T059 Run `pytest -q` from repository root `./`

- [X] T060 Run `python tools/check_blueprint_consistency.py` from repository root `./`
  - Confirm every displayed weight and item count is derived from `BLUEPRINT.md`.

- [X] T061 Run `python tools/check_content_single_source.py` from repository root `./`
  - Confirm no study markdown was copied from `notes/`, `cheatsheets/`, `guide/`, `study-plans/`, or
    `drills/bank/` into `site/`.

- [X] T062 Run `npm run build` from `site/`

- [X] T063 Run `python -m drills.engine validate` from repository root `./`

- [X] T064 Run `python -m lab.evals run` from repository root `./`

- [X] T065 Run `npm run typecheck` from `site/`

- [X] T066 Run `npm run lint` from `site/`

- [X] T067 Run `python tools/check_links.py` from repository root `./`

- [X] T068 Run `npm run test:unit` from `site/`

- [X] T069 Run `npm run test:e2e` from `site/`
  - Confirm no journey requires or offers an account, installation, API key, analytics, tracking,
    cookies, or a third-party runtime request.

**Checkpoint**: Shared foundations and reserved contracts are ready; story work can begin.


---

## Phase 3: User story 1 - Orient to the exam and see where the points are (Priority: P1) MVP

**Goal**: A first-time candidate can learn the exam facts and compare the weighted blueprint without
signing in.

**Independent test**: Open `/`, `/blueprint/`, and `/domains/` directly. Verify the facts, guidance,
disclaimer, zero-of-eight coverage statement, eight domains, 25 sub-skills, and every domain-pair
visual comparison.

### Tests for US1

> Write these tests first and confirm that they fail for the missing behavior before implementation.

- [X] T070 [P] [US1] Use `site/tests/e2e/us1-orientation.spec.ts` to write the keyboard-first
  orientation journey

- [X] T071 [P] [US1] Use `site/tests/e2e/us1-weight-order.spec.ts` to write all 28 domain-pair
  visual-weight assertions

- [X] T072 [P] [US1] Use `site/tests/e2e/us1-accessibility.spec.ts` to write landing, blueprint, and
  domain-index axe checks

### Implementation for US1

- [X] T073 [P] [US1] Use `site/src/components/DomainWeightBar.astro` to render strictly proportional
  domain weight data

- [X] T074 [P] [US1] Use `site/src/components/CoverageSummary.astro` to render derived
  authored-domain coverage

- [X] T075 [US1] Implement exam orientation and readiness guidance in `site/src/pages/index.astro`
  - Use derived exam figures, show the unofficial statement without interaction, describe guidance
    as project advice, and make zero authored domains visible without implying completeness.

- [X] T076 [US1] Use `site/src/pages/blueprint/index.astro` to implement the eight-domain and
  25-sub-skill explorer

- [X] T077 [US1] Use `site/src/pages/domains/index.astro` to implement the weight-descending domain
  index

### User story 1 - Orient to the exam and see where the points are (Priority: P1) MVP gates

- [X] T078 [US1] Run `ruff check .` from repository root `./`

- [X] T079 [US1] Run `ruff format --check .` from repository root `./`

- [X] T080 [US1] Run `pytest -q` from repository root `./`

- [X] T081 [US1] Run `python tools/check_blueprint_consistency.py` from repository root `./`
  - Confirm every displayed weight and item count is derived from `BLUEPRINT.md`.

- [X] T082 [US1] Run `python tools/check_content_single_source.py` from repository root `./`
  - Confirm no study markdown was copied from `notes/`, `cheatsheets/`, `guide/`, `study-plans/`, or
    `drills/bank/` into `site/`.

- [X] T083 [US1] Run `npm run build` from `site/`

- [X] T084 [US1] Run `python -m drills.engine validate` from repository root `./`

- [X] T085 [US1] Run `python -m lab.evals run` from repository root `./`

- [X] T086 [US1] Run `npm run typecheck` from `site/`

- [X] T087 [US1] Run `npm run lint` from `site/`

- [X] T088 [US1] Run `python tools/check_links.py` from repository root `./`

- [X] T089 [US1] Run `npm run test:unit` from `site/`

- [X] T090 [US1] Run `npm run test:e2e` from `site/`
  - Confirm no journey requires or offers an account, installation, API key, analytics, tracking,
    cookies, or a third-party runtime request.

**Checkpoint**: US1 is functional and testable through its independent test.


---

## Phase 4: User story 2 - Open a domain and know exactly where it stands (Priority: P2)

**Goal**: Each domain page renders authored material or a useful, honest scaffold state from
repository sources.

**Independent test**: Open all eight domain routes in the all-scaffold state, then exercise partial
and authored fixtures. Verify sub-skill status, tables, contribution route, exam weight, and
absent-lab statements.

### Tests for US2

> Write these tests first and confirm that they fail for the missing behavior before implementation.

- [X] T091 [P] [US2] Use `site/tests/e2e/us2-scaffold-domains.spec.ts` to write the all-eight
  scaffold-page journey

- [X] T092 [P] [US2] Use `site/tests/e2e/us2-content-transitions.spec.ts` to write
  scaffold-to-partial-to-authored fixture journeys

- [X] T093 [P] [US2] Use `site/tests/e2e/us2-domain-details.spec.ts` to write decision-table and
  absent-lab assertions

- [X] T094 [P] [US2] Use `site/tests/e2e/us2-accessibility.spec.ts` to write scaffold and authored
  domain-page axe checks

### Implementation for US2

- [X] T095 [P] [US2] Use `site/src/components/ScaffoldNotice.astro` to present sub-skills, measures,
  weights, and contribution route

- [X] T096 [P] [US2] Use `site/src/layouts/ContentLayout.astro` to render source markdown and
  preserved decision tables

- [X] T097 [US2] Use `site/src/lib/domain-content.ts` to join blueprint, note sections, statuses,
  and lab mappings

- [X] T098 [US2] Use `site/src/pages/domains/[domain].astro` to add the reserved lab region and
  absent-demonstration statement

- [X] T099 [US2] Add the inert reserved practice region in `site/src/pages/domains/[domain].astro`

- [X] T100 [US2] Use `site/src/pages/domains/[domain].astro` to complete all derived domain-module
  routes
  - Render scaffold, partial, and authored states without bare headings; show weight and approximate
    items; preserve non-ASCII source text and deep-linkable headings.

### User story 2 - Open a domain and know exactly where it stands (Priority: P2) gates

- [X] T101 [US2] Run `ruff check .` from repository root `./`

- [X] T102 [US2] Run `ruff format --check .` from repository root `./`

- [X] T103 [US2] Run `pytest -q` from repository root `./`

- [X] T104 [US2] Run `python tools/check_blueprint_consistency.py` from repository root `./`
  - Confirm every displayed weight and item count is derived from `BLUEPRINT.md`.

- [X] T105 [US2] Run `python tools/check_content_single_source.py` from repository root `./`
  - Confirm no study markdown was copied from `notes/`, `cheatsheets/`, `guide/`, `study-plans/`, or
    `drills/bank/` into `site/`.

- [X] T106 [US2] Run `npm run build` from `site/`

- [X] T107 [US2] Run `python -m drills.engine validate` from repository root `./`

- [X] T108 [US2] Run `python -m lab.evals run` from repository root `./`

- [X] T109 [US2] Run `npm run typecheck` from `site/`

- [X] T110 [US2] Run `npm run lint` from `site/`

- [X] T111 [US2] Run `python tools/check_links.py` from repository root `./`

- [X] T112 [US2] Run `npm run test:unit` from `site/`

- [X] T113 [US2] Run `npm run test:e2e` from `site/`
  - Confirm no journey requires or offers an account, installation, API key, analytics, tracking,
    cookies, or a third-party runtime request.

**Checkpoint**: US2 is functional and testable through its independent test.


---

## Phase 5: User story 3 - Budget study time across the domains (Priority: P3)

**Goal**: A candidate can choose a plan, receive a self-report recommendation, and persist
per-domain marks.

**Independent test**: Open any plan without using the diagnostic, mark domains, switch plans,
reload, and use a second tab. Complete the diagnostic by keyboard and verify one announced,
explained recommendation.

### Tests for US3

> Write these tests first and confirm that they fail for the missing behavior before implementation.

- [X] T114 [P] [US3] Write pure recommendation-rule cases in `site/tests/unit/recommend.test.ts`

- [X] T115 [P] [US3] Use `site/tests/e2e/us3-plans.spec.ts` to write the direct-plan and
  persisted-progress journey

- [X] T116 [P] [US3] Use `site/tests/e2e/us3-storage.spec.ts` to write unavailable, quota, cleared,
  and cross-tab journeys

- [X] T117 [P] [US3] Use `site/tests/e2e/us3-diagnostic.spec.ts` to write keyboard, screen-reader,
  and axe diagnostic checks

### Implementation for US3

- [X] T118 [P] [US3] Use `site/src/lib/progress.ts` to implement plan marks, completion totals,
  theme, and diagnostic state

- [X] T119 [P] [US3] Use `site/src/lib/recommend.ts` to implement the pure self-report
  recommendation rule
  - Choose the closest plan at or below the time budget, fall back to `1-week`, bias one plan longer
    for no experience in the two heaviest domains, and return an explanatory reason.

- [X] T120 [P] [US3] Parse and validate weighted plan allocations in `site/src/lib/plans.ts`
  - Require `1-week`, `3-weeks`, and `6-weeks`; verify totals and each domain allocation to three
    decimal places against derived blueprint weights.

- [X] T121 [US3] Use `site/src/components/PlanChecklist.astro` to implement per-domain marks and
  hours-and-domains completion

- [X] T122 [US3] Implement the accessible self-report flow in `site/src/components/Diagnostic.astro`
  - Collect experience, weeks, and hours; avoid practice items and score claims; persist the
    self-contained response; focus and announce the result.

- [X] T123 [US3] Implement the ungated plan chooser in `site/src/pages/plans/index.astro`

- [X] T124 [US3] Use `site/src/pages/plans/[plan].astro` to implement all three weight-descending
  plan routes
  - Show totals, allocations, weights, plan-specific marks, completion proportions, browser storage
    limits, and the stated behavior when switching plans.

- [X] T125 [US3] Use `site/src/pages/diagnostic.astro` to implement the stable self-report
  diagnostic address

### User story 3 - Budget study time across the domains (Priority: P3) gates

- [X] T126 [US3] Run `ruff check .` from repository root `./`

- [X] T127 [US3] Run `ruff format --check .` from repository root `./`

- [X] T128 [US3] Run `pytest -q` from repository root `./`

- [X] T129 [US3] Run `python tools/check_blueprint_consistency.py` from repository root `./`
  - Confirm every displayed weight and item count is derived from `BLUEPRINT.md`.

- [X] T130 [US3] Run `python tools/check_content_single_source.py` from repository root `./`
  - Confirm no study markdown was copied from `notes/`, `cheatsheets/`, `guide/`, `study-plans/`, or
    `drills/bank/` into `site/`.

- [X] T131 [US3] Run `npm run build` from `site/`

- [X] T132 [US3] Run `python -m drills.engine validate` from repository root `./`

- [X] T133 [US3] Run `python -m lab.evals run` from repository root `./`

- [X] T134 [US3] Run `npm run typecheck` from `site/`

- [X] T135 [US3] Run `npm run lint` from `site/`

- [X] T136 [US3] Run `python tools/check_links.py` from repository root `./`

- [X] T137 [US3] Run `npm run test:unit` from `site/`

- [X] T138 [US3] Run `npm run test:e2e` from `site/`
  - Confirm no journey requires or offers an account, installation, API key, analytics, tracking,
    cookies, or a third-party runtime request.

**Checkpoint**: US3 is functional and testable through its independent test.


---

## Phase 6: User story 4 - Register correctly and survive exam day (Priority: P4)

**Goal**: Candidates can read sourced registration, exam-day, retake, and course-cross-map guidance.

**Independent test**: Open each guide route directly and verify the Partner Network callout,
exam-day restrictions, retake terms, and byte-identical blueprint domain names without using another
site.

### Tests for US4

> Write these tests first and confirm that they fail for the missing behavior before implementation.

- [X] T139 [P] [US4] Use `site/tests/e2e/us4-guide.spec.ts` to write the registration, exam-day, and
  retake journey

- [X] T140 [P] [US4] Use `site/tests/e2e/us4-crossmap.spec.ts` to write exact cross-map domain-name
  assertions

- [X] T141 [P] [US4] Use `site/tests/e2e/us4-accessibility.spec.ts` to write guide-page axe and
  keyboard checks

### Implementation for US4

- [X] T142 [US4] Render the three source-backed guide routes in `site/src/pages/guide/[page].astro`
  - Generate only `eligibility`, `exam-day`, and `course-crossmap`; preserve callouts and non-ASCII
    text; link official material rather than reproducing it.

### User story 4 - Register correctly and survive exam day (Priority: P4) gates

- [X] T143 [US4] Run `ruff check .` from repository root `./`

- [X] T144 [US4] Run `ruff format --check .` from repository root `./`

- [X] T145 [US4] Run `pytest -q` from repository root `./`

- [X] T146 [US4] Run `python tools/check_blueprint_consistency.py` from repository root `./`
  - Confirm every displayed weight and item count is derived from `BLUEPRINT.md`.

- [X] T147 [US4] Run `python tools/check_content_single_source.py` from repository root `./`
  - Confirm no study markdown was copied from `notes/`, `cheatsheets/`, `guide/`, `study-plans/`, or
    `drills/bank/` into `site/`.

- [X] T148 [US4] Run `npm run build` from `site/`

- [X] T149 [US4] Run `python -m drills.engine validate` from repository root `./`

- [X] T150 [US4] Run `python -m lab.evals run` from repository root `./`

- [X] T151 [US4] Run `npm run typecheck` from `site/`

- [X] T152 [US4] Run `npm run lint` from `site/`

- [X] T153 [US4] Run `python tools/check_links.py` from repository root `./`

- [X] T154 [US4] Run `npm run test:unit` from `site/`

- [X] T155 [US4] Run `npm run test:e2e` from `site/`
  - Confirm no journey requires or offers an account, installation, API key, analytics, tracking,
    cookies, or a third-party runtime request.

**Checkpoint**: US4 is functional and testable through its independent test.


---

## Phase 7: User story 5 - Take a printable cheatsheet into the last week (Priority: P5)

**Goal**: Each domain has an honest cheatsheet that prints legibly without site controls.

**Independent test**: Open and print every scaffold-state cheatsheet in dark presentation. Verify
light-on-white output, hidden controls, intact rows, repeating table headers, attribution, and
source content.

### Tests for US5

> Write these tests first and confirm that they fail for the missing behavior before implementation.

- [ ] T156 [P] [US5] Use `site/tests/e2e/us5-print.spec.ts` to write dark-theme print and
  multipage-table checks

- [ ] T157 [P] [US5] Use `site/tests/e2e/us5-cheatsheets.spec.ts` to write all-eight scaffold
  cheatsheet and axe checks

### Implementation for US5

- [ ] T158 [P] [US5] Use `site/src/layouts/PrintLayout.astro` to create the attributed, control-free
  print shell

- [ ] T159 [P] [US5] Use `site/src/styles/print.css` to force legible light print and stable table
  pagination

- [ ] T160 [US5] Use `site/src/pages/cheatsheets/index.astro` to implement the weight-descending
  cheatsheet index

- [ ] T161 [US5] Use `site/src/pages/cheatsheets/[domain].astro` to implement all eight
  source-backed cheatsheet routes
  - State when a sheet contains blueprint allocation only; show derived domain name and weight;
    include license and unofficial attribution.

### User story 5 - Take a printable cheatsheet into the last week (Priority: P5) gates

- [ ] T162 [US5] Run `ruff check .` from repository root `./`

- [ ] T163 [US5] Run `ruff format --check .` from repository root `./`

- [ ] T164 [US5] Run `pytest -q` from repository root `./`

- [ ] T165 [US5] Run `python tools/check_blueprint_consistency.py` from repository root `./`
  - Confirm every displayed weight and item count is derived from `BLUEPRINT.md`.

- [ ] T166 [US5] Run `python tools/check_content_single_source.py` from repository root `./`
  - Confirm no study markdown was copied from `notes/`, `cheatsheets/`, `guide/`, `study-plans/`, or
    `drills/bank/` into `site/`.

- [ ] T167 [US5] Run `npm run build` from `site/`

- [ ] T168 [US5] Run `python -m drills.engine validate` from repository root `./`

- [ ] T169 [US5] Run `python -m lab.evals run` from repository root `./`

- [ ] T170 [US5] Run `npm run typecheck` from `site/`

- [ ] T171 [US5] Run `npm run lint` from `site/`

- [ ] T172 [US5] Run `python tools/check_links.py` from repository root `./`

- [ ] T173 [US5] Run `npm run test:unit` from `site/`

- [ ] T174 [US5] Run `npm run test:e2e` from `site/`
  - Confirm no journey requires or offers an account, installation, API key, analytics, tracking,
    cookies, or a third-party runtime request.

**Checkpoint**: US5 is functional and testable through its independent test.


---

## Phase 8: User story 6 - Find any concept in seconds (Priority: P6)

**Goal**: Keyboard users can search typed, source-backed records without loading the index on first
paint.

**Independent test**: Open search with Cmd/Ctrl+K from each page type, navigate and activate a
result, dismiss with focus restored, verify the no-match state, and confirm the format demonstration
is absent.

### Tests for US6

> Write these tests first and confirm that they fail for the missing behavior before implementation.

- [ ] T175 [P] [US6] Use `site/tests/e2e/us6-search.spec.ts` to write the complete keyboard search
  journey

- [ ] T176 [P] [US6] Use `site/tests/e2e/us6-search-exclusion.spec.ts` to prove format-demonstration
  content never enters search

- [ ] T177 [P] [US6] Use `site/tests/e2e/us6-search-runtime.spec.ts` to test lazy loading, Unicode,
  metadata, and same-origin search

### Implementation for US6

- [ ] T178 [P] [US6] Use `site/src/lib/search.ts` to define typed Pagefind records and validated
  metadata

- [ ] T179 [US6] Use `site/src/components/SearchDialog.astro` to implement the accessible on-demand
  Pagefind dialog
  - Support Cmd/Ctrl+K, trapped result navigation, Enter activation, Escape dismissal with focus
    restoration, named result pages, and a plain no-match message.

- [ ] T180 [US6] Use `site/src/layouts/BaseLayout.astro` to emit typed Pagefind metadata and
  pre-index exclusions
  - Populate `note`, `guide`, `plan`, `cheatsheet`, and `blueprint` records with domain, weight, and
    status where applicable; exclude `format_demonstration` before indexing.

- [ ] T181 [US6] Use `site/src/layouts/BaseLayout.astro` to expose search globally without
  first-paint loading

### User story 6 - Find any concept in seconds (Priority: P6) gates

- [ ] T182 [US6] Run `ruff check .` from repository root `./`

- [ ] T183 [US6] Run `ruff format --check .` from repository root `./`

- [ ] T184 [US6] Run `pytest -q` from repository root `./`

- [ ] T185 [US6] Run `python tools/check_blueprint_consistency.py` from repository root `./`
  - Confirm every displayed weight and item count is derived from `BLUEPRINT.md`.

- [ ] T186 [US6] Run `python tools/check_content_single_source.py` from repository root `./`
  - Confirm no study markdown was copied from `notes/`, `cheatsheets/`, `guide/`, `study-plans/`, or
    `drills/bank/` into `site/`.

- [ ] T187 [US6] Run `npm run build` from `site/`

- [ ] T188 [US6] Run `python -m drills.engine validate` from repository root `./`

- [ ] T189 [US6] Run `python -m lab.evals run` from repository root `./`

- [ ] T190 [US6] Run `npm run typecheck` from `site/`

- [ ] T191 [US6] Run `npm run lint` from `site/`

- [ ] T192 [US6] Run `python tools/check_links.py` from repository root `./`

- [ ] T193 [US6] Run `npm run test:unit` from `site/`

- [ ] T194 [US6] Run `npm run test:e2e` from `site/`
  - Confirm no journey requires or offers an account, installation, API key, analytics, tracking,
    cookies, or a third-party runtime request.

**Checkpoint**: US6 is functional and testable through its independent test.


---

## Phase 9: User story 7 - Move progress to another device (Priority: P7)

**Goal**: Candidates can export and safely replace all local progress in another browser.

**Independent test**: Mark progress, export one JSON file, clear site data, and import in a second
browser. Verify exact restoration, replacement disclosure, malformed and newer-version refusal, and
browser-only notice.

### Tests for US7

> Write these tests first and confirm that they fail for the missing behavior before implementation.

- [ ] T195 [P] [US7] Use `site/tests/e2e/us7-transfer.spec.ts` to write the export, clear,
  second-browser, and restore journey

- [ ] T196 [P] [US7] Use `site/tests/e2e/us7-import-safety.spec.ts` to write replacement, malformed,
  incompatible, and axe checks

### Implementation for US7

- [ ] T197 [US7] Use `site/src/lib/transfer.ts` to implement exact-envelope export and validated
  replacement import
  - Name downloads `ccdv-f-progress-YYYY-MM-DD.json`; parse and migrate safely; reject newer or
    malformed data without writes; summarize both records and require confirmation.

- [ ] T198 [US7] Use `site/src/pages/progress.astro` to implement transfer controls and browser-only
  loss warning

### User story 7 - Move progress to another device (Priority: P7) gates

- [ ] T199 [US7] Run `ruff check .` from repository root `./`

- [ ] T200 [US7] Run `ruff format --check .` from repository root `./`

- [ ] T201 [US7] Run `pytest -q` from repository root `./`

- [ ] T202 [US7] Run `python tools/check_blueprint_consistency.py` from repository root `./`
  - Confirm every displayed weight and item count is derived from `BLUEPRINT.md`.

- [ ] T203 [US7] Run `python tools/check_content_single_source.py` from repository root `./`
  - Confirm no study markdown was copied from `notes/`, `cheatsheets/`, `guide/`, `study-plans/`, or
    `drills/bank/` into `site/`.

- [ ] T204 [US7] Run `npm run build` from `site/`

- [ ] T205 [US7] Run `python -m drills.engine validate` from repository root `./`

- [ ] T206 [US7] Run `python -m lab.evals run` from repository root `./`

- [ ] T207 [US7] Run `npm run typecheck` from `site/`

- [ ] T208 [US7] Run `npm run lint` from `site/`

- [ ] T209 [US7] Run `python tools/check_links.py` from repository root `./`

- [ ] T210 [US7] Run `npm run test:unit` from `site/`

- [ ] T211 [US7] Run `npm run test:e2e` from `site/`
  - Confirm no journey requires or offers an account, installation, API key, analytics, tracking,
    cookies, or a third-party runtime request.

**Checkpoint**: US7 is functional and testable through its independent test.


---

## Phase 10: Polish and cross-cutting concerns

**Purpose**: Prove cross-story outcomes, wire review and publication, and harden the complete static
site.

- [ ] T212 [P] Prove `notes/` edits propagate without presentation edits in
  `site/tests/e2e/source-notes.spec.ts`
  - Rebuild from an isolated source fixture after changing only one note and compare rendered
    output.

- [ ] T213 [P] Prove `cheatsheets/` edits propagate without presentation edits in
  `site/tests/e2e/source-cheatsheets.spec.ts`
  - Rebuild from an isolated source fixture after changing only one cheatsheet and compare output.

- [ ] T214 [P] Prove `guide/` edits propagate without presentation edits in
  `site/tests/e2e/source-guide.spec.ts`
  - Rebuild from an isolated source fixture after changing only one guide page and compare output.

- [ ] T215 [P] Prove `study-plans/` edits propagate without presentation edits in
  `site/tests/e2e/source-plans.spec.ts`
  - Rebuild from an isolated source fixture after changing only one study plan and compare output.

- [ ] T216 [P] Use `site/tests/e2e/complete-journey.spec.ts` to prove the account-free cross-story
  journey
  - Cover orienting, choosing a plan, marking progress, printing, exporting, and importing into a
    second browser entirely by keyboard and without installation or a key.

- [ ] T217 [P] Run axe against every page type in `site/tests/e2e/accessibility.spec.ts`
  - Include all content, scaffold, diagnostic, progress, search, index, and reserved page types;
    require no critical or serious findings.

- [ ] T218 [P] Use `site/tests/e2e/performance.spec.ts` to prove LCP, theme stability, and deferred
  search budgets
  - Use a mid-tier mobile profile and typical mobile connection; require study-page LCP under 2.5
    seconds, no theme layout shift, and no Pagefind index request before search opens.

- [ ] T219 [P] Use `tests/test_publication_blueprint_drift.py` to prove blueprint drift blocks
  publication

- [ ] T220 [P] Use `tests/test_publication_duplicate_content.py` to prove duplicated study content
  blocks publication

- [ ] T221 [P] Use `tests/test_publication_missing_domain.py` to prove a missing domain directory
  blocks publication

- [ ] T222 [P] Use `tests/test_publication_broken_link.py` to prove a broken built-site link blocks
  publication

- [ ] T223 [P] Use `site/tests/e2e/all-scaffold-state.spec.ts` to verify all scaffold deliverables
  and landing coverage
  - Assert eight complete domain pages, eight honest cheatsheets, indexed labeled scaffold pages,
    and prominent zero-of-eight authored coverage.

- [ ] T224 [P] Use `site/tests/e2e/reserved-extension.spec.ts` to prove reserved places accept inert
  fixtures without route movement
  - Fill each of the nine reserved address patterns and both domain layout regions in the test
    fixture, then assert all established addresses and navigation targets remain unchanged.

- [ ] T225 [P] Use `site/tests/e2e/routes.spec.ts` to verify every contracted route, base path, and
  trailing slash

- [ ] T226 [P] Use `site/tests/e2e/unicode.spec.ts` to verify source Unicode in screen, search, and
  print output

- [ ] T227 [P] Use `site/tests/e2e/privacy.spec.ts` to audit credentials, cookies, tracking, and
  runtime requests

- [ ] T228 Use `.github/workflows/ci.yml` to add the isolated Node 22 site gate and rendered PR
  artifacts
  - Keep the Python 3.11/3.12 job unchanged. In the site job, run `npm ci`, install the pinned
    Playwright browser, run all five site gates, then run
    `python tools/check_content_single_source.py` and `python tools/check_links.py` against the
    built output. Upload the site, report, and page-type screenshots for proposed changes.

- [ ] T229 Deploy only after every gate passes in `.github/workflows/pages.yml`
  - Build generated content and the configured-base static site on default-branch changes, use
    least-privilege Pages permissions, and leave the published artifact untouched on failure.

- [ ] T230 Audit linked official material and dated factual claims in `SOURCES.md`

- [ ] T231 Document keyless site commands, generated data, and publication behavior in `README.md`

- [ ] T232 Resolve performance and responsive-layout regressions in `site/src/styles/global.css`

### Polish and cross-cutting concerns gates

- [ ] T233 Run `ruff check .` from repository root `./`

- [ ] T234 Run `ruff format --check .` from repository root `./`

- [ ] T235 Run `pytest -q` from repository root `./`

- [ ] T236 Run `python tools/check_blueprint_consistency.py` from repository root `./`
  - Confirm every displayed weight and item count is derived from `BLUEPRINT.md`.

- [ ] T237 Run `python tools/check_content_single_source.py` from repository root `./`
  - Confirm no study markdown was copied from `notes/`, `cheatsheets/`, `guide/`, `study-plans/`, or
    `drills/bank/` into `site/`.

- [ ] T238 Run `npm run build` from `site/`

- [ ] T239 Run `python -m drills.engine validate` from repository root `./`

- [ ] T240 Run `python -m lab.evals run` from repository root `./`

- [ ] T241 Run `npm run typecheck` from `site/`

- [ ] T242 Run `npm run lint` from `site/`

- [ ] T243 Run `python tools/check_links.py` from repository root `./`

- [ ] T244 Run `npm run test:unit` from `site/`

- [ ] T245 Run `npm run test:e2e` from `site/`
  - Confirm no journey requires or offers an account, installation, API key, analytics, tracking,
    cookies, or a third-party runtime request.

**Checkpoint**: The complete feature meets its cross-cutting criteria.


---

## Dependencies and execution order

### Phase dependencies

- Setup has no dependency and makes every gate command executable.
- Foundational depends on Setup and blocks all user stories.
- US1 through US5 can start independently after Foundational when separate contributors are
  available.
- US6 can start after Foundational, then indexes each completed study page without changing its
  contract.
- US7 can start after Foundational with fixture progress; the complete journey also exercises US3
  marks.
- Polish depends on every story selected for publication; full publication requires US1 through US7.

### User story dependencies

| Story | Starts after | Independent delivery test |
|---|---|---|
| US1 (P1) | Foundational | Landing, blueprint, and domain index alone orient a candidate |
| US2 (P2) | Foundational | Domain routes work against scaffold, partial, and authored fixtures |
| US3 (P3) | Foundational | Plans and diagnostic work with the shared storage contract |
| US4 (P4) | Foundational | Three guide routes render directly from their source markdown |
| US5 (P5) | Foundational | Cheatsheets render and print from source markdown |
| US6 (P6) | Foundational | Search works with any records; final coverage follows all pages |
| US7 (P7) | Foundational | Export and import work with fixture records; US3 supplies live marks |

### Within each user story

1. Write the listed tests and confirm that the missing behavior makes them fail.
2. Implement pure data and service modules before components that consume them.
3. Implement routes and integration after their dependencies.
4. Run the entire phase gate set before using the checkpoint.


---

## Parallel execution examples

### User story 1

```text
Task: "T070 Write the keyboard-first orientation journey"
Task: "T071 Write all 28 domain-pair visual-weight assertions"
Task: "T072 Write landing, blueprint, and domain-index axe checks"
```

### User story 2

```text
Task: "T091 Write the all-eight scaffold-page journey"
Task: "T092 Write scaffold-to-partial-to-authored fixture journeys"
Task: "T093 Write decision-table and absent-lab assertions"
```

### User story 3

```text
Task: "T114 Write pure recommendation-rule cases"
Task: "T115 Write the direct-plan and persisted-progress journey"
Task: "T116 Write unavailable, quota, cleared, and cross-tab journeys"
```

### User story 4

```text
Task: "T139 Write the registration, exam-day, and retake journey"
Task: "T140 Write exact cross-map domain-name assertions"
Task: "T141 Write guide-page axe and keyboard checks"
```

### User story 5

```text
Task: "T156 Write dark-theme print and multipage-table checks"
Task: "T157 Write all-eight scaffold cheatsheet and axe checks"
```

### User story 6

```text
Task: "T175 Write the complete keyboard search journey"
Task: "T176 Prove format-demonstration content never enters search"
Task: "T177 Test lazy loading, Unicode, metadata, and same-origin search"
```

### User story 7

```text
Task: "T195 Write the export, clear, second-browser, and restore journey"
Task: "T196 Write replacement, malformed, incompatible, and axe checks"
```


---

## Implementation strategy

### MVP first: User story 1 only

1. Complete Setup.
2. Complete Foundational.
3. Complete US1.
4. Stop at the US1 checkpoint and run its independent test.
5. Publish only after the publication tasks and all required gates are present.

### Incremental delivery

1. Establish the gate-capable setup and shared contracts.
2. Deliver US1 as the smallest independently useful increment.
3. Add US2 through US7 in priority order, running the complete gate set after each phase.
4. Complete the cross-story proofs and publication workflow.
5. Preserve all established routes, storage namespaces, and typed search records between increments.

### Parallel team strategy

After Foundational, separate contributors can implement US1 through US5 and fixture-driven US7.
US6 can build its typed search contract in parallel, then integrate records from completed page
stories.
Tasks marked `[P]` touch separate files and do not depend on unfinished tasks in the same phase.


---

## Requirement traceability

Every functional requirement and success criterion maps to at least one executable task.

| Requirement | Task IDs |
|---|---|
| FR-001 | T035, T039, T075 |
| FR-002 | T029, T038, T219 |
| FR-003 | T037, T029 |
| FR-004 | T040, T212, T213, T214, T215 |
| FR-005 | T014, T030, T220 |
| FR-006 | T028, T031, T032, T041 |
| FR-007 | T041, T097, T100 |
| FR-008 | T037, T056, T221, T222 |
| FR-009 | T176, T180 |
| FR-010 | T070, T075 |
| FR-011 | T071, T076 |
| FR-012 | T091, T100 |
| FR-013 | T091, T095, T100 |
| FR-014 | T093, T096 |
| FR-015 | T139, T140, T142 |
| FR-016 | T120, T124 |
| FR-017 | T157, T161 |
| FR-018 | T077, T124, T160 |
| FR-019 | T071, T073, T076 |
| FR-020 | T034, T047, T048, T049, T050, T051, T052, T053, T054, T055, T098, T099 |
| FR-021 | T093, T098, T100 |
| FR-022 | T115, T118, T121, T124 |
| FR-023 | T115, T124 |
| FR-024 | T042, T115 |
| FR-025 | T033, T042 |
| FR-026 | T033, T042, T116 |
| FR-027 | T195, T196, T197, T198 |
| FR-028 | T033, T042, T116, T124 |
| FR-029 | T196, T198 |
| FR-030 | T114, T119, T122, T125 |
| FR-030a | T114, T118, T119, T122 |
| FR-031 | T117, T122 |
| FR-032 | T175, T179, T181 |
| FR-033 | T175, T179 |
| FR-034 | T177, T178, T180 |
| FR-035 | T045, T216, T227 |
| FR-036 | T045, T177, T227 |
| FR-037 | T142, T230 |
| FR-038 | T180, T230, T227 |
| FR-039 | T045, T161 |
| FR-040 | T042, T043, T045, T218 |
| FR-041 | T044, T217 |
| FR-042 | T156, T158, T159 |
| FR-043 | T044, T232 |
| FR-044 | T100, T142, T177, T226 |
| FR-045 | T229 |
| FR-046 | T228 |
| FR-047 | T219, T220, T221, T222, T229 |
| FR-048 | T228 |
| FR-049 | T074, T075, T223, T229 |
| SC-001 | T070, T075, T076 |
| SC-002 | T029, T037, T219 |
| SC-003 | T014, T030, T220 |
| SC-004 | T212, T213, T214, T215 |
| SC-005 | T216 |
| SC-006 | T072, T094, T117, T141, T157, T217 |
| SC-007 | T045, T218, T232 |
| SC-008 | T219, T220, T221, T222, T229 |
| SC-009 | T074, T091, T157, T223 |
| SC-010 | T034, T098, T099, T224 |

---

## Task-count summary

| Phase | Tasks |
|---|---:|
| Phase 1: Setup | 27 |
| Phase 2: Foundational | 42 |
| Phase 3: User story 1 - Orient to the exam and see where the points are (Priority: P1) MVP | 21 |
| Phase 4: User story 2 - Open a domain and know exactly where it stands (Priority: P2) | 23 |
| Phase 5: User story 3 - Budget study time across the domains (Priority: P3) | 25 |
| Phase 6: User story 4 - Register correctly and survive exam day (Priority: P4) | 17 |
| Phase 7: User story 5 - Take a printable cheatsheet into the last week (Priority: P5) | 19 |
| Phase 8: User story 6 - Find any concept in seconds (Priority: P6) | 20 |
| Phase 9: User story 7 - Move progress to another device (Priority: P7) | 17 |
| Phase 10: Polish and cross-cutting concerns | 34 |
| **Total** | **245** |

| User story | Story-specific tasks before phase gates |
|---|---:|
| US1 | 8 |
| US2 | 10 |
| US3 | 12 |
| US4 | 4 |
| US5 | 6 |
| US6 | 7 |
| US7 | 4 |

## Notes

- Gate tasks intentionally repeat at every phase boundary so the whole repository remains
  reviewable.
- Generated `site/src/data/blueprint.json` is never hand-edited.
- No task authorizes `git add` or `git commit`; changes remain in the working tree for review.
- Stop at any checkpoint to run the named independent test.
