# Item-bank expansion plan — Spec Kit command sequence

A working document, not study content. It holds the exact Spec Kit commands and prompts for growing
`drills/bank/` past mock quota with original, source-backed practice items, in the order they should
be run.

The work is tracked as feature `004-item-bank-expansion`. The constitution is already ratified at
v1.1.1, so the cycle starts at `/speckit-specify` and skips `/speckit-constitution`. Slash commands
use the dash form in this repository (`.claude/skills/speckit-specify/`), so `/speckit-specify`
rather than `/speckit.specify`.

## Where this stands

Feature `004-item-bank-expansion` has run through `/speckit-implement` to its delivery boundary. The
coverage tooling, the source-integrity gate, and the two heaviest domains are done; the six
remaining domains are the tracked follow-on. Read the live position with
`python -m drills.engine coverage` rather than the table below, which is a dated snapshot.

| Domain | Held | Target | State |
|---|---:|---:|---|
| Applications and Integration | 51 | 51 | at target |
| Model Selection and Optimization | 27 | 27 | at target |
| Agents and Workflows | 8 | 24 | follow-on |
| Prompt and Context Engineering | 6 | 18 | follow-on |
| Tools and MCPs | 6 | 18 | follow-on |
| Security and Safety | 6 | 12 | follow-on |
| Claude Code | 2 | 6 | follow-on |
| Eval, Testing, and Debugging | 1 | 6 | follow-on |

The follow-on is 55 items. Every domain below target still repeats its items between sittings, and
the mock page names those domains rather than implying a fresh draw. The `Claude Hooks` sub-skill,
which held nothing when this work began, now holds two.

Three lessons from the first two domains are worth carrying into the follow-on:

- **Read the sub-skill's existing items before authoring.** One duplicate was caught that way and a
  second by review; neither was visible to the near-duplicate advisory, because the overlap was
  conceptual rather than textual.
- **Vary where the correct option sits, and keep the options close in length.** The first 54 items
  were written with the answer first every time and usually longest, which let a reviewer answer the
  batch without reading it — and the 54 items that predate this work had the same two tells. Both
  halves were rebalanced, and `pytest` now fails if the bank drifts back, but writing them right
  costs nothing and repairing them costs a pass over every file.
- **Extending a source row re-dates it, which obliges re-verifying every item that cites it.** That
  cascade is the cost of one row per URL, and it is worth planning a pass around.

## Why this was the highest-value content work

The bank held 54 files, one of which is the format demonstration the exporter drops, leaving 53
eligible items against a full mock of 53. Apportionment gave every domain exactly its quota and
nothing more:

| Domain | Bank | Mock quota |
|---|---:|---:|
| Applications and Integration | 17 | 17 |
| Model Selection and Optimization | 9 | 9 |
| Agents and Workflows | 8 | 8 |
| Prompt and Context Engineering | 6 | 6 |
| Tools and MCPs | 6 | 6 |
| Security and Safety | 4 | 4 |
| Claude Code | 2 | 2 |
| Eval, Testing, and Debugging | 1 | 1 |

Every mock attempt therefore draws almost the same items, and each domain quiz asks the same
questions every sitting — repeated practice measures recall of the bank rather than of the domain.
`specs/002-lab-runner-mock-exam/spec.md` records that as an accepted edge case and the site states
it plainly. Surplus items fix it with no code change: the exporter publishes every eligible item to
the weighted mock and to its domain's scored quiz automatically.

Two further gaps the bank has today: every item is `application` or `analysis`, with no `recall`
item anywhere, and several sub-skills sit at a single item (Systems Life Cycle, Model Selection and
Tradeoffs, Output Handling, Guardrails and Safe Deployment, Identity, Secrets, and Key Management,
MCP Server Development, Debugging and Error Handling).

## Decisions to carry into the cycle

| Decision | Choice |
|---|---|
| Target bank size | A multiple of each domain's apportioned quota, computed by the tooling |
| Sizing multiple | 3x quota, with a floor keeping the two smallest domains usable as quizzes |
| Distribution in a domain | Proportional to published sub-skill share, not even across sub-skills |
| Sourcing | Every item cites a live-checked Anthropic page and a dated `SOURCES.md` row |
| Delegation | Item prose may be delegated; factual sourcing may not |
| Scope of this feature | Items only. Notes, flashcards, and cheatsheets are a separate feature |

The sizing multiple is the one number a human should decide before `/speckit-plan`, because it sets
the volume of every later task. 3x quota is 159 items, roughly a hundred to author. If that is too
large for one feature, cut it to 2x and keep the heavy domains at 3x rather than trimming evenly —
Applications and Integration at 33.1% and Model Selection at 16.8% are half the exam between them.

## Before starting

1. Read `drills/bank/README.md` and one existing item end to end. The item shape is enforced by
   `drills/schema.json`: `id`, `domain`, `sub_skill`, `difficulty`, `select`, `stem`, `options[]`,
   `sources[]`; a rationale on every option; a `trap_type` on every incorrect option and on no
   correct one.
2. `domain` and `sub_skill` must match `BLUEPRINT.md` character for character. Tooling joins on
   those strings and validation fails otherwise.
3. Spec Kit offers to auto-commit at each phase. `CLAUDE.md` scopes committing to the orchestrator
   after the full gate set passes, so **answer no to every commit prompt** and let the orchestrator
   commit deliberately. The `before_specify` hook that creates a feature branch is not a commit —
   let that one run.
4. Load the `claude-api` skill before writing any item that touches model ids, pricing, parameters,
   streaming, tool use, caching, or context limits. Most of the unwritten items are exactly that,
   and a stale parameter in a rationale is a defect that ships looking correct.

## What "verified source" means here

An item is source-backed when all four hold. Write this into the spec as testable requirements
rather than leaving it as a convention:

1. Every `sources[]` entry is an official Anthropic page — the exam guide, Partner Academy, the
   API docs, or the Claude Code docs — or a source file in this repository, where the item tests
   something this repository's own reference application demonstrates. A community summary, a blog
   aggregator, or a model's own memory is not a source.
2. The page was opened and read during authoring, and `verified_on` is the date it was read, not the
   date the item was written against recollection.
3. The specific claim the item turns on is visible on that page. An item whose correct option is
   right only under an unstated assumption is not source-backed, however good the URL is.
4. `SOURCES.md` carries a row for the source, with what it establishes and the same verified date.
   The row goes in before the item that cites it.

The originality rule from `AGENTS.md` is not negotiable and belongs in the spec verbatim: every item
is original, written from the public blueprint, never a recalled or reconstructed live exam item.

## Step 1 — Specify feature 004

```text
/speckit-specify
```

```text
Grow this repository's practice-item bank past mock quota so that repeated mock sittings and
domain quizzes draw varying items rather than the same ones every time, and so that every
sub-skill in the blueprint is practised in proportion to its published share.

Today the bank holds one mock's worth of items. Every domain sits at exactly its apportioned
quota, so a learner who takes two mocks sees almost the same 53 questions twice, and each
domain quiz is fixed. The site currently states this limitation rather than implying a fresh
draw; the outcome of this feature is that the statement is no longer needed.

Scope:

- Author additional original practice items into the existing bank until each domain holds a
  multiple of its mock quota, with the multiple and any small-domain floor decided during
  planning. The per-domain target is derived from the blueprint's apportionment at build time
  and is never a hand-typed count.
- Distribute the items a domain receives across its sub-skills in proportion to each
  sub-skill's published share of the exam, so the heavy sub-skills gain the most items.
- Cover all three difficulty levels the schema defines. The bank today has no recall item at
  all, which leaves the easiest third of the exam's cognitive range unpractised.
- Every item cites at least one official Anthropic source that was read during authoring,
  with the date it was read, and every cited source has a matching dated row in SOURCES.md
  before the item lands.
- Every item is original, written from the public blueprint. No recalled, reconstructed, or
  paraphrased live exam content, ever.
- No two items in a domain may turn on the same distinguishing fact. Variety between sittings
  is the point of the feature, and two restatements of one fact do not provide it.
- Each incorrect option carries one of the schema's trap types and a rationale that explains
  why a prepared candidate might still pick it.

Constraints that must appear as requirements: the bank's existing schema and validation
command stay authoritative and unchanged in shape; domain and sub-skill strings match
BLUEPRINT.md exactly; items reach the weighted mock, the per-domain quizzes, and site search
through the existing exporters with no site code change; the full repository gate set keeps
passing; nothing in the site tree restates an item's text.

Explicit non-goals: authoring the six scaffold note trees, regenerating flashcards or
cheatsheets, changing the mock engine's apportionment, changing the schema's required fields,
and any change to how items are rendered.

Write the spec as user scenarios and testable requirements only. Do not name a target count
per domain - the plan phase derives it. Do not run git add or git commit.
```

## Step 2 — Clarify

No arguments. Expect questions about the sizing multiple, how small-domain floors interact with
weight-proportional coverage, and what counts as two items testing the same fact. Answer concretely;
each of those answers changes the task volume.

```text
/speckit-clarify
```

## Step 3 — Plan

```text
/speckit-plan
```

```text
Technical direction for this feature.

Location and boundaries: items are YAML files under drills/bank/<NN>-<domain-slug>/, one item
per file, discovered recursively by the existing engine. No change to drills/schema.json's
required fields, to drills/engine/, or to the site. tools/export_item_bank.py and
tools/export_mock_data.py already publish every eligible item; adding a file is the whole
delivery mechanism.

Target sizing, and treat this as the core decision: add a target-coverage report to the drills
engine that computes each domain's target as a multiple of the quota that
drills.engine.mock.apportion_items returns for a full-size mock, reading the multiple and the
small-domain floor from one named constant rather than from a per-domain table. The report
prints, per domain and per sub-skill, the current count, the target, and the shortfall. The
authoring work is then driven by that report rather than by a list of counts written into
tasks.md, which would go stale the moment an item lands. Expose it as a subcommand alongside
validate, generate, take, and score.

Sub-skill distribution: derive each sub-skill's share from BLUEPRINT.md through the existing
blueprint parser and apportion the domain's target across its sub-skills with the same
largest-remainder function the mock already uses. Do not write a second apportionment
implementation.

Testing: extend the drills test module with a case asserting that the coverage report's
per-domain targets agree with apportion_items, a case asserting the report's sub-skill targets
sum to the domain target, and a case asserting the bank contains at least one item at each
difficulty level. Add a bank-wide uniqueness check to validation that fails on a duplicate id
and reports, without failing, items in one domain whose correct-option rationales are near
duplicates of each other, so an author sees accidental restatement during validation.

Source integrity: add a standard-library-only check that every sources[] URL in the bank also
appears in SOURCES.md, and that the item's verified_on is not earlier than the SOURCES.md row's
verified date. Wire it into the existing gate set next to tools/check_links.py so a cited page
that was never recorded, or an item claiming a check older than the record, fails before
review.

Authoring workflow: items are written in passes, one domain per pass, heaviest domain first, so
the gate set runs against a small diff and a bad pattern is caught before it is repeated across
forty files. Each pass ends at a green gate set.

Python stays 3.11+ and standard library first, except for the yaml and jsonschema dependencies
the engine already uses. Public functions are type-hinted. Pin nothing new unless a pass
genuinely needs it. Do not run git add or git commit.
```

Read `plan.md` before continuing. If the sizing section leaves any per-domain count written out as
a literal, fix it there — a hand-typed count is the exact drift the blueprint gate exists to stop.

## Step 4 — Tasks

```text
/speckit-tasks
```

```text
Generate dependency-ordered tasks grouped into passes that each end at a state where the full
gate set passes, so I can review and commit between passes. Suggested ordering: the coverage
report subcommand and its tests; the source-integrity check and its wiring into the gate set;
then one authoring pass per domain in descending exam weight, starting with Applications and
Integration and Model Selection and Optimization; then a final pass that fills the difficulty
and sub-skill gaps the report still shows.

Each authoring task names the domain and sub-skill it covers and the number of items it adds,
taken from the coverage report rather than restated from the blueprint. Each authoring task
also names the SOURCES.md rows it expects to add or re-date.

Make python -m drills.engine validate, ruff check ., ruff format --check ., pytest -q,
python tools/check_blueprint_consistency.py, python tools/check_links.py,
python tools/check_content_single_source.py, and the site build explicit tasks at every pass
boundary, not assumed background work. Add a task that re-runs the coverage report at the end
of each pass and records the remaining shortfall. Do not run git add or git commit.
```

## Step 5 — Analyze

No arguments. Cross-checks spec against plan against tasks. Fix what it flags before authoring
anything — a contradiction about targets found here costs minutes, and the same contradiction
found after ninety items are written costs a rewrite.

```text
/speckit-analyze
```

## Step 6 — Checklists

Run twice, with a different focus each time.

```text
/speckit-checklist
```

```text
Source fidelity and originality. Validate that the requirements pin down: what qualifies as an
official source and what does not; what verified_on means and how a reviewer can tell a page
was actually read; how the SOURCES.md row and the item's citation are kept consistent by a
check rather than by diligence; how the no-recalled-content rule is expressed in a form a
reviewer can apply to a specific item; and what happens to an item whose cited page later
changes or disappears.
```

```text
/speckit-checklist
```

```text
Item quality and coverage proportionality. Validate that the requirements define: how the
per-domain and per-sub-skill targets are derived rather than asserted; what makes two items
duplicates of each other; what a good distractor is, in terms a reviewer can apply, and how
each trap type is used correctly; how the three difficulty levels are distinguished for this
exam's tradeoff-driven style; and how a multiple-response item states its own select count so
a learner is never guessing how many options to choose.
```

## Step 7 — Implement

```text
/speckit-implement
```

```text
Implement pass by pass. Stop at each pass boundary, run python -m drills.engine validate,
ruff check ., ruff format --check ., pytest -q, python tools/check_blueprint_consistency.py,
python tools/check_links.py, python tools/check_content_single_source.py, and the site build,
then report the results and the remaining coverage shortfall before starting the next pass.

For every item you author: open the Anthropic page that backs it and read the passage the item
turns on before writing the stem; add or re-date the SOURCES.md row first; then write the item.
Do not write an item from memory and attach a plausible URL afterwards. If you cannot open a
page, say so and leave the item unwritten rather than citing it unread.

Follow AGENTS.md: Python 3.11+ standard library first, type-hinted public functions, no process
language or time-anchored phrasing, no commented-out code, no unowned TODOs, US English,
sentence case headings, wrap at 100 columns. Do not run git add or git commit - leave the work
in the tree for me to review.
```

## Step 8 — Verify and review

```text
/verify-triage
```

```text
/code-review high
```

```text
/security-review
```

`verify-triage` is a convenience wrapper for three of the gates, not the whole set. Run the full
list from `AGENTS.md`, plus `npm run lint`, `npm run typecheck`, `npm run test:unit`,
`npm run build`, `npm run check:payload`, and `npm run test:e2e` from `site/`, before opening the
pull request.

## The authoring loop, per item

The Spec Kit cycle governs the feature; this is what one item looks like inside it.

1. Pick the sub-skill from the coverage report's largest shortfall, not by interest.
2. Open the blueprint's "Measured" cell for that sub-skill. The item tests something named there.
3. Open the Anthropic page that settles the question and read the passage. Add or re-date its
   `SOURCES.md` row.
4. Write the stem as a situation with a constraint, not a definition prompt. The exam is
   tradeoff-driven: the candidate should have to choose between options that all work, on a stated
   requirement.
5. Write the correct option, then four distractors that each fail for a different, nameable reason,
   and give each one a `trap_type` from the schema. A distractor that is obviously absurd teaches
   nothing and makes the item easier than the exam.
6. Write a rationale for every option, including the correct one. The wrong-answer rationale is what
   the learner reads after a miss, so it explains the distinction rather than restating the answer.
7. Run `python -m drills.engine validate`.

Items that carry a wrong `sub_skill` or a paraphrased weight fail the gates. Items that carry a
confident, unsourced claim pass every gate and are the defect this plan's source rules exist to
prevent.

## What this plan deliberately leaves out

- **The notes gap.** Six of eight domain note trees are scaffolds, including Applications and
  Integration at 33.1%. That is a larger content feature than this one and deserves its own cycle;
  authoring a domain's notes also produces its flashcards, cheatsheet extracts, search entries, and
  on-page recall prompts.
- **Flashcards.** `flashcards/ccdv-f.tsv` is generated from authored notes by
  `tools/build_flashcards.py`. Editing it directly is overwritten on the next build and fails its
  test. Growing the deck means authoring notes, which is the feature above.
- **The mock engine.** Apportionment, scoring, and the readiness bar are settled in feature 002 and
  are not reopened by adding items.
