<!--
Sync Impact Report
==================
Version change: unversioned template -> 1.0.0
Bump rationale: initial ratification. Every placeholder token replaced with concrete, testable
rules derived from AGENTS.md, BLUEPRINT.md, and CLAUDE.md. No prior version existed, so this is
the baseline rather than an amendment.

Principle mapping (template slot -> ratified principle):
  [PRINCIPLE_1_NAME] -> I. Blueprint is the source of truth
  [PRINCIPLE_2_NAME] -> II. Single-sourced content
  [PRINCIPLE_3_NAME] -> III. Keyless, loginless, installless
  [PRINCIPLE_4_NAME] -> IV. Coverage is proportional to exam weight
  [PRINCIPLE_5_NAME] -> V. Original material only
  (added)            -> VI. Gates are non-negotiable
  (added)            -> VII. The implementation is teaching material
  (added)            -> VIII. Accessible and fast by default

Section mapping:
  [SECTION_2_NAME] -> Additional constraints
  [SECTION_3_NAME] -> Development workflow and quality gates
  Added sections: none beyond the above. Removed sections: none.

Template propagation:
  OK  .specify/templates/plan-template.md      - Constitution Check gates filled in
  OK  .specify/templates/spec-template.md      - constitutional constraints block added
  OK  .specify/templates/tasks-template.md     - gate and compliance task types added
  OK  .specify/templates/checklist-template.md - standing compliance category added
  N/A .specify/templates/commands/             - directory absent in this installation

Runtime guidance reviewed: AGENTS.md, CLAUDE.md, README.md. No principle in this constitution
contradicts them; the constitution restates and extends their rules to cover the website.

Deferred items: none.

Amendment 1.0.0 -> 1.1.0 (2026-09-05)
Bump rationale: MINOR. A workflow rule was materially changed, no principle was removed or redefined.
Changed: "Development workflow and quality gates" no longer forbids the assistant from committing.
The orchestrating model may commit once the full gate set passes; delegated implementers still may
not, which keeps author and committer distinct. Spec Kit's auto-commit hooks remain declined.
Propagated to: CLAUDE.md, .specify/templates/tasks-template.md.
Outstanding: AGENTS.md still carries the older blanket prohibition and is protected from assistant
edits, so it must be reconciled by the maintainer. CLAUDE.md records the precedence meanwhile.
-->

# CCDV-F community study kit constitution

## Core Principles

### I. Blueprint is the source of truth

`BLUEPRINT.md` supplies every domain name, sub-skill name, weight, and item count used anywhere in
this project. No weight MUST ever be hand-typed, rounded, or restated from memory — not in notes, not
in drills, not in the website, not in a commit message. Any surface that displays exam structure MUST
derive it from `BLUEPRINT.md` through a build step, and `tools/check_blueprint_consistency.py` MUST
gate that derived data exactly as it gates `notes/` and `drills/`. A stale derived artifact is a build
failure, not a warning.

**Rationale**: The kit's central claim is that its coverage is weighted to the real exam outline. A
claim that is asserted rather than enforced decays silently, and a decayed weight sends a candidate to
study the wrong domain.

### II. Single-sourced content

Study content lives exactly once, as markdown under `notes/`, `cheatsheets/`, `guide/`,
`study-plans/`, and `drills/bank/`. Any presentation layer — the website included — MUST render those
files at build time rather than hold its own copy. Copying, forking, or paraphrasing study text into a
presentation tree is a build failure. When a note changes, every surface that shows it MUST change
with it, without a second edit.

**Rationale**: Two copies of a fact become two different facts. Single-sourcing is what allows the
blueprint gate in Principle I to certify the whole project rather than one directory.

### III. Keyless, loginless, installless

Every learner-facing experience MUST be fully usable with no account, no sign-in, no installation, and
no `ANTHROPIC_API_KEY`. Every lab MUST run against the existing mock transport, and the full suite —
tests, drills, and evals — MUST pass offline and in CI with no credentials. Learner progress MUST stay
local to the learner's browser and MUST be exportable as a file. No analytics, no tracking cookies, no
third-party data collection, and no runtime request to a third-party service. Secrets, tokens, and
`.env` files MUST never be committed.

**Rationale**: A study kit that demands a paid key or an account before the first exercise excludes
the candidates who most need it, and a keyless default is what keeps CI honest and reproducible.

### IV. Coverage is proportional to exam weight

Depth, navigation prominence, practice volume, and study-time guidance MUST follow the published
weights. Applications and Integration (33.1%) and Model Selection and Optimization (16.8%) dominate;
Claude Code (3.1%) and Eval, Testing, and Debugging (2.6%) stay deliberately short. A user interface
MUST NOT present the eight domains as visually equal, and a low-weight domain MUST NOT be padded for
symmetry.

**Rationale**: Misallocating study time across domains is the specific failure this project exists to
prevent. A layout that gives a 3.1% domain the same visual weight as a 33.1% domain re-creates that
failure in the one place a candidate will trust most.

### V. Original material only

Every practice item MUST be original, written from the public blueprint. Recalled, reconstructed, or
paraphrased live exam items MUST NOT be accepted, in any form, from any contributor. Anthropic's
copyrighted material MUST be linked, never vendored or re-hosted; summarizing factual blueprint
structure is permitted and necessary. Every factual claim about the exam, the API, pricing, or model
behavior MUST carry a dated entry in `SOURCES.md`. The unofficial, not-affiliated-with-Anthropic
disclaimer MUST be visible on the website and in the repository.

**Rationale**: Candidates sign a confidentiality agreement. A braindump endangers the contributor's
credential and everyone who uses the kit, and undated claims about a guide that is "subject to change"
rot without anyone noticing.

### VI. Gates are non-negotiable

`ruff check .`, `ruff format --check .`, `pytest -q`, `tools/check_blueprint_consistency.py`, and
`tools/check_links.py` MUST pass before any change is complete, and MUST run in CI on every change.
Once the website exists, its build, lint, type-check, unit tests, and accessibility checks join that
set on equal terms. Python MUST stay 3.11 or newer and standard library first. Tests MUST never
require a live key or make a real network call.

**Rationale**: A gate that runs sometimes is a suggestion. These specific gates are what let the
project make verifiable claims about weighting, link health, and keyless operation.

### VII. The implementation is teaching material

This repository is read as an explanation of the concepts it teaches, so the implementation *is* part
of the explanation. Code MUST favor clarity over cleverness, public functions MUST be type-hinted, and
model versions MUST be pinned explicitly rather than resolved through an alias — version pinning is
itself a tested exam objective. Every concept the lab demonstrates MUST link to the specific file that
demonstrates it, and that file MUST link back to the note.

**Rationale**: A candidate learning from this repository reads the code as a worked example. Clever
code teaches nothing, and an unpinned model alias teaches the opposite of the objective it appears
under.

### VIII. Accessible and fast by default

Learner-facing surfaces MUST meet WCAG 2.1 AA, MUST be fully operable by keyboard, and MUST respect a
stated performance budget. A heavy runtime — an in-browser Python interpreter above all — MUST NOT sit
on the critical path; it loads lazily, only on the pages that need it. Behavior when local storage is
unavailable, full, or empty MUST be defined rather than discovered.

**Rationale**: A study tool is used under time pressure, on whatever device is to hand. Slow or
keyboard-hostile study material is study material that goes unused.

## Additional constraints

**Content conventions.** Decision tables beat prose wherever a topic is a choice between options —
workflow versus agent, built-in tool versus custom tool versus Skill versus MCP, batch versus
realtime, Opus versus Sonnet versus Haiku, stdio versus HTTP — and each table carries a "choose this
when" column. Notes, drill items, and flashcards MUST carry the exact domain and sub-skill names from
`BLUEPRINT.md`, spelled identically, because tooling joins on those strings. US English, sentence case
headings, wrapped at 100 columns.

**Cost conventions.** Examples target the Haiku tier unless the point of the example is a model
tradeoff. Any script that can call the real API MUST document its approximate cost.

**Prohibited in code and docs.** Process language and time-anchored phrasing ("MVP", "for now",
"phase 1", "new", "recently", "as of today"); ticket, issue, or task IDs in comments; commented-out
code; and TODOs without a concrete owner and action. Write what the code does, not the history of how
it got there.

**Licensing.** Code is MIT and written study content is CC BY 4.0. Neither extends to Anthropic's
material. Both MUST be surfaced wherever the content is published.

## Development workflow and quality gates

Work proceeds through the Spec Kit cycle: constitution, specify, clarify, plan, tasks, analyze,
checklist, implement. The Constitution Check in `plan-template.md` MUST be evaluated before Phase 0
research and re-evaluated after Phase 1 design; a violation MUST either be removed or justified in the
plan's Complexity Tracking table with the simpler alternative named and its rejection explained.

Implementation proceeds in phases that each end at a state where the full gate set passes, so a
reviewer can inspect and commit between phases.

Claude Opus 5, acting as the orchestrator, MAY run `git add` and `git commit`, and only once the full
gate set passes. Every delegated implementer — Codex, Antigravity, or any other CLI — MUST leave its
work uncommitted for the orchestrator to review, re-run the gates against, and commit. That division
is what keeps the committer and the author distinct, so no implementer lands its own unreviewed work.
Spec Kit's optional auto-commit hooks MUST still be declined, because they commit at phase boundaries
rather than after a verified review.

## Governance

This constitution supersedes other practices where they conflict. `AGENTS.md` and `CLAUDE.md` are the
operational rulebooks that implement it day to day; where one of them and this document disagree, this
document wins and the other MUST be corrected to match.

**Amendment procedure.** An amendment requires an edit to this file, a Sync Impact Report recorded in
the comment at the top, and propagation into `.specify/templates/` in the same change. A principle
MUST NOT be weakened silently to let a specific feature pass its Constitution Check.

**Versioning policy.** Semantic versioning applies to this document. MAJOR for a backward-incompatible
governance change or the removal or redefinition of a principle; MINOR for a new principle or a
materially expanded rule; PATCH for clarifications, wording, and non-semantic refinement.

**Compliance review.** Every plan states its Constitution Check result. Every review verifies that
result against the change in front of it. The automated gates in Principle VI are the mechanical half
of compliance; the Constitution Check is the half that requires judgment.

**Version**: 1.1.0 | **Ratified**: 2026-09-05 | **Last Amended**: 2026-09-05
