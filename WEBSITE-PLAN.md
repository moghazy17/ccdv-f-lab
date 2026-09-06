# Website build plan — Spec Kit command sequence

A working document, not study content. It holds the exact Spec Kit commands and prompts for turning
this study kit into a browser-based learning site, in the order they should be run.

The site is modelled on [claude.nagdy.me](https://claude.nagdy.me/) — interactive modules, a terminal
simulator, a config builder, end-of-module quizzes — with CCDV-F and this repository's own reference
application as the subject.

## Decisions already made

| Decision | Choice |
|---|---|
| How labs run in the browser | Real Python via Pyodide, against the existing mock transport |
| Hosting | GitHub Pages, from this repository |
| Languages | English only, with an i18n-ready structure |

## Before starting

1. `.specify/memory/constitution.md` is still the unfilled template — every `[PLACEHOLDER]` is
   intact. Step 1 is not optional; every later command reads that file.
2. Spec Kit offers to auto-commit at each phase (`.specify/extensions.yml` enables the
   `speckit.git.commit` hooks as optional). `CLAUDE.md` forbids the assistant running `git add` or
   `git commit`, so **answer no to every commit prompt** and commit by hand. The `before_specify`
   hook that creates a feature branch is not a commit — let that one run.
3. Split the work into three features. A whole learning platform in one spec produces a `tasks.md`
   no implement run finishes cleanly. Feature 001 below is the full walkthrough; features 002 and
   003 reuse the same cycle with a different `/speckit-specify` prompt.

Slash commands use the dash form in this repository (`.claude/skills/speckit-specify/`), so
`/speckit-specify` rather than `/speckit.specify`.

## Step 1 — Constitution

Run once, ever.

```text
/speckit-constitution
```

```text
Fill the constitution for this repo, which is an unofficial community study kit for the
Claude Certified Developer - Foundations (CCDV-F) exam that is about to grow a public
static website. Derive the principles from AGENTS.md, BLUEPRINT.md, and CLAUDE.md rather
than inventing new ones. Use these principles:

I. Blueprint is the source of truth. BLUEPRINT.md supplies every domain name, sub-skill
name, weight, and item count. No weight is ever hand-typed, rounded, or restated from
memory anywhere in the repo or the website. tools/check_blueprint_consistency.py must gate
the website's data too, not just notes/ and drills/.

II. Single-sourced content. Study content lives exactly once, as markdown under notes/,
cheatsheets/, guide/, study-plans/, and drills/bank/. The website renders those files at
build time. Copying or paraphrasing study text into the site tree is a build failure.

III. Keyless, loginless, installless. The site must be fully usable with no account, no
sign-in, no installation, and no ANTHROPIC_API_KEY. Every lab runs against the existing
mock transport. Learner progress is local to the browser and exportable as a file. No
analytics, no tracking cookies, no third-party data collection.

IV. Coverage is proportional to exam weight. Depth, navigation prominence, and practice
volume follow the published weights: Applications and Integration (33.1%) and Model
Selection and Optimization (16.8%) dominate; Claude Code (3.1%) and Eval, Testing, and
Debugging (2.6%) stay short. The UI must not present eight visually equal domains, because
that misallocation is the exact mistake this project exists to prevent.

V. Original material only. No recalled, reconstructed, or paraphrased live exam items. No
re-hosting of Anthropic's copyrighted material - link it, never vendor it. Every factual
claim about the exam, API, pricing, or model behavior carries a dated entry in SOURCES.md.
The unofficial, not-affiliated-with-Anthropic disclaimer is visible on the site.

VI. Gates are non-negotiable. ruff check ., ruff format --check ., pytest -q,
tools/check_blueprint_consistency.py, tools/check_links.py, and the website's own build,
lint, type-check, and tests all run in CI on every change. Python stays 3.11+ and standard
library first.

VII. The implementation is teaching material. This repo is read as an explanation of the
concepts it teaches, so code favors clarity over cleverness, public functions are
type-hinted, and model versions are pinned explicitly rather than resolved through aliases.

VIII. Accessible and fast by default. WCAG 2.1 AA, full keyboard operation, and a
performance budget that keeps the heavy in-browser Python runtime off the critical path.

Set version 1.0.0, ratified today, and propagate the principles into the plan, spec, tasks,
and checklist templates under .specify/templates/. Do not run git add or git commit.
```

## Step 2 — Specify feature 001

The spec carries no technology choices; those belong in the plan.

```text
/speckit-specify
```

```text
Build a public website that turns this CCDV-F study kit into a hands-on learning platform
a candidate can use entirely in the browser: no account, no sign-in, no local install, no
API key. The inspiration is https://claude.nagdy.me/ - interactive modules, a terminal
simulator, a config builder, and end-of-module quizzes - but the subject here is the CCDV-F
exam blueprint and this repo's own reference application.

This first feature is the foundation and the content pipeline. Interactive labs and the
mock-exam engine are separate later features; specify this one so they can slot in without
rework.

Scope of feature 001:

- A landing page stating what CCDV-F is, the exam facts from BLUEPRINT.md (53 items, 120
  minutes, 720 cut score on a 100-1000 scale, $125, Pearson VUE, 12-month validity), the
  readiness bar (85% or better on weighted mocks with no domain below 70% before booking),
  and the unofficial / not-affiliated disclaimer.
- A blueprint explorer covering all 8 domains and 25 sub-skills, with each weight and
  approximate item count read from BLUEPRINT.md at build time. Visual weight in the UI is
  proportional to exam weight.
- Eight domain module pages rendering the existing notes/<domain>/ files - README,
  decision-tables, pitfalls, self-check - with the decision tables kept as tables, since
  the exam is tradeoff-driven.
- The guide/ pages: eligibility and registration including the Partner Network email
  requirement, exam-day rules, and the Anthropic Academy course-to-blueprint cross-map.
- The three study plans (1, 3, and 6 weeks) rendered as interactive checklists whose
  completion state persists in the browser with no account.
- The eight generated cheatsheets, in a print-friendly layout.
- A "find your level" diagnostic that recommends one of the three study plans.
- Site-wide search over all study content, reachable by keyboard.
- Learner progress stored locally, with export and import as a file so a candidate can move
  devices or keep a backup without a server.
- Light and dark themes, full keyboard navigation, WCAG 2.1 AA.
- Content is read from the existing markdown at build time. If a note changes, the site
  changes. Duplicated study text in the site tree is a defect.
- Deployment of the built site from this repository on every push to main.

Explicit non-goals for feature 001: running Python in the browser, the interactive lab
runner, the weighted mock-exam engine, flashcards, the Claude Code terminal simulator, the
CLAUDE.md and settings.json config builder, and any non-English language. Note them as
planned follow-ons so the information architecture reserves room for them.

Constraints that must appear as requirements: no login and no API key anywhere in the user
journey; nothing re-hosts Anthropic's copyrighted material, only links it; no braindump or
recalled exam content; code is MIT and written study content is CC BY 4.0, both surfaced on
the site; the existing keyless test suite and the blueprint anti-drift gate must keep
passing, and the blueprint gate must be extended to cover the data the site consumes.

Write the spec as user scenarios and testable requirements only. Do not name any framework,
library, or hosting provider - the plan phase decides that. Do not run git add or git commit.
```

## Step 3 — Clarify

No arguments. Up to five targeted questions, with the answers written back into `spec.md`. Expect
questions about progress-tracking scope, search depth, and how domain weighting shows up visually.
Answer concretely.

```text
/speckit-clarify
```

## Step 4 — Plan

The technology choices land here.

```text
/speckit-plan
```

```text
Technical direction for this feature.

Location and boundaries: the website lives in a new site/ directory at the repository root.
The existing Python packages (lab/, drills/, tools/, tests/) keep their current structure
and gates. site/node_modules and build output go in .gitignore.

Stack: Astro 7 with TypeScript in strict mode, static output, Tailwind CSS for styling, and
small interactive islands only where a page genuinely needs them - Astro ships zero client
JavaScript by default, which is what makes the eight mostly-prose domain pages fast. No
React or Next.js; the interactivity in this feature is a checklist, a theme toggle, a
search box, and a diagnostic quiz.

Content pipeline, and treat this as the core architectural decision: Astro content
collections read the existing markdown in ../notes, ../guide, ../study-plans, and
../cheatsheets directly through a glob loader. Do not copy those files into site/. Add a
standard-library-only Python exporter at tools/export_site_data.py that parses BLUEPRINT.md
and emits site/src/data/blueprint.json - domains, sub-skills, weights, and item counts -
and add a pytest case asserting the emitted JSON matches BLUEPRINT.md exactly, so
tools/check_blueprint_consistency.py and the existing anti-drift gate now cover the site.
The site must fail its build if blueprint.json is stale relative to BLUEPRINT.md.

Persistence: localStorage behind a single typed storage module with a schema version, so
later features can extend the shape without corrupting existing learners' progress. Export
and import as a downloaded and uploaded JSON file. No cookies, no analytics, no third-party
network requests at runtime.

Search: build-time index (Pagefind, which Astro supports natively and needs no server),
opened with Cmd+K / Ctrl+K, fully keyboard operable.

Reserve for later features so the architecture does not need reworking: a lazily loaded
Pyodide runtime that will run this repo's actual lab/ and drills/ Python in the browser
against the existing mock transport, a CodeMirror 6 editor pane, and a weighted mock-exam
engine that must reproduce the same largest-remainder apportionment as drills/engine.
Define the module boundary and route structure they will plug into now, but do not build or
install them in this feature.

Testing: Vitest for unit tests on the storage, search, and quiz modules; Playwright for end
to end coverage of the critical journeys; automated accessibility checks with axe on every
page type. Add site linting and type-checking as scripts.

Performance budget: LCP under 2.5s on a mid-tier mobile connection, no layout shift on
theme restore, and no heavy runtime on the critical path.

Deployment: GitHub Pages, via a new GitHub Actions workflow that builds site/ and uploads a
Pages artifact on push to main. Extend the existing .github/workflows/ci.yml so the Python
gates (ruff check ., ruff format --check ., pytest -q, the blueprint gate, the link
checker) and the new site gates (build, lint, type-check, unit tests, a11y) both run on
pull requests. Set the Astro base path correctly for a project-pages URL, and make it
configurable so a custom domain or a different host is a one-line change.

Pin exact versions for every dependency - version pinning is itself a tested exam objective
in this blueprint, and this repo is read as teaching material. Do not run git add or git
commit.
```

Read `plan.md` before continuing. If the content-pipeline section is vague about *not copying*
markdown into `site/`, fix it there — that requirement is what everything else rests on.

## Step 5 — Tasks

```text
/speckit-tasks
```

```text
Generate dependency-ordered tasks grouped into phases that each end at a state where the
repository gates pass and the site builds, so I can review and commit between phases.
Suggested phasing: scaffold and CI wiring; the blueprint exporter and its pytest gate;
content collections and the domain module pages; guide, study-plans, and cheatsheets pages;
storage, progress, and the diagnostic; search, theming, and accessibility; the GitHub Pages
deployment workflow.

Every task names the exact files it creates or edits. Mark tasks that can run in parallel.
Make ruff check ., ruff format --check ., pytest -q, tools/check_blueprint_consistency.py,
and the site build and test scripts explicit tasks at each phase boundary, not assumed
background work. Add a task that verifies no study markdown has been duplicated into site/.
Do not run git add or git commit.
```

## Step 6 — Analyze

No arguments. A non-destructive cross-check of spec against plan against tasks. Fix what it flags
before implementing — a contradiction caught here costs minutes; the same contradiction found after
`/speckit-implement` costs hours.

```text
/speckit-analyze
```

## Step 7 — Checklists

Run twice, with a different focus each time.

```text
/speckit-checklist
```

```text
Content fidelity and blueprint accuracy. Validate that the requirements pin down: where
every weight and item count originates; what happens when BLUEPRINT.md changes; how the
no-duplication rule between notes/ and site/ is enforced rather than asserted; how the
unofficial-and-unaffiliated disclaimer, the no-braindump rule, and the MIT / CC BY 4.0
licensing are surfaced; and how the weight-proportional coverage principle is expressed
concretely enough in the UI requirements to be testable.
```

```text
/speckit-checklist
```

```text
Accessibility, performance, and the keyless constraint. Validate that the requirements
quantify the performance budget, define keyboard and screen-reader behavior for the
diagnostic, checklists, and search, specify offline and slow-connection behavior, define
what happens when localStorage is unavailable or full, and state the no-account, no-key,
no-third-party-request rule in a form a test can actually check.
```

## Step 8 — Implement

```text
/speckit-implement
```

```text
Implement phase by phase. Stop at each phase boundary, run ruff check ., ruff format
--check ., pytest -q, tools/check_blueprint_consistency.py, and the site build and test
scripts, and report the results before starting the next phase. Follow AGENTS.md: Python
3.11+ standard library first, type-hinted public functions, no process language or
time-anchored phrasing in code or docs, no commented-out code, no unowned TODOs, US
English, sentence case headings, wrap at 100 columns. Do not run git add or git commit -
leave the work in the tree for me to review.
```

## Step 9 — Verify and review

```text
/verify-triage
```

```text
/code-review high
```

```text
/security-review
```

Commit by hand, then open the pull request.

## Feature 002 — Lab runner and mock exam

Re-run steps 2 through 9, skipping the constitution. Only the `/speckit-specify` prompt changes.

```text
Add the interactive layer to the study site: real, hands-on practice that still needs no
install and no API key.

Run this repository's actual Python in the browser via Pyodide, lazily loaded only on pages
that need it and never on the critical path. Ship the lab/ and drills/ packages into the
Pyodide virtual filesystem, force the mock transport so nothing can make a network call or
require an ANTHROPIC_API_KEY, and give each lab an editable code pane, a Run control, real
output, and a link back both to the matching note and to the source file in the repository.

Lab modules follow the concepts the reference triage application already demonstrates:
pinned model versions, adaptive thinking, structured output, tool use and dispatch, the MCP
server, prompt caching, the batch path, guardrails, and the eval harness that attributes a
failure to the integration layer or to the model.

Add a weighted mock exam that reproduces the same largest-remainder apportionment as
drills/engine - 17 / 9 / 8 / 6 / 6 / 4 / 2 / 1 across the eight domains for a 53-item mock -
with a 120-minute timer, a score report showing percent-correct per domain the way the real
report does, an explanation shown for every wrong answer, and the readiness bar applied:
85% or better overall with no domain below 70%. Items come from drills/bank/ and are all
original, written from the public blueprint; no recalled exam content, ever.

Add per-domain self-check quizzes on the module pages and a flashcard mode driven by
flashcards/ccdv-f.tsv with lightweight spaced repetition. All progress stays local to the
browser and joins the existing exportable progress file. Everything continues to work with
no account and no key.
```

## Feature 003 — Claude Code simulator and config builder

```text
Add the Claude Code domain experience: a simulated terminal for practising built-in and
custom slash commands, session management, headless and streaming modes, and hooks, plus a
config builder whose interactive forms generate CLAUDE.md, settings.json, and hook files
the learner can copy straight into a project. Cover the CLAUDE.md hierarchy - enterprise,
user, project, and subdirectory - as something the learner assembles rather than reads
about, and use this repository's own .claude/ directory as the worked example, including
the hook that prevents destructive actions. Add a free-form playground page. Keep the
weighting honest: Claude Code is 3.1% of the exam, roughly 2 items, so this stays a small
and clearly-scoped module and must not visually outrank the 33.1% domain.
```

## Two content gaps to close alongside the build

- The `notes/` trees are skeletons, as the coverage table in [README.md](README.md) states. Feature
  001 will render a fully-plumbed site over mostly-empty pages. Writing the two heavyweight domains
  — Applications and Integration, and Model Selection and Optimization — is worth doing before or
  during that feature.
- `drills/bank/` holds a single item. The mock exam in feature 002 needs an item-authoring push
  behind it before a 53-item mock can be generated from real content.
