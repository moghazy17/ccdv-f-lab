# Implementation Plan: Item-bank expansion past mock quota

**Branch**: `004-item-bank-expansion` | **Date**: 2026-09-17 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-item-bank-expansion/spec.md`

## Summary

Grow `drills/bank/` from one mock's worth of items to three times each domain's apportioned quota,
so that a second mock sitting and a second domain quiz ask different questions. The delivery
mechanism is a YAML file per item; the exporters already publish every eligible item to the mock,
the quizzes, and search, so no site code changes.

Three decisions shape the work, and each came out of Phase 0 measurement rather than the obvious
reading of the request.

**The targets are computed, and the authoring is driven by a report rather than a task list.** A new
`coverage` subcommand prints, per domain and per sub-skill, what the bank holds, what it should
hold, and the difference. The two policy numbers — a multiple of three and a floor of six — are
named constants; everything else is read from `BLUEPRINT.md`. The measured total is 162 items
against 53 held, so 109 to author, 52 of them in the two heaviest domains that close this feature.

**The sub-skill split reuses the mock's apportionment rather than copying it.** The
largest-remainder arithmetic moves into a helper that takes ordered weight pairs;
`apportion_items` keeps its signature and delegates, and the coverage module calls the same helper
with sub-skill weights read through the existing `parse_sub_skills`. No dataclass changes, and a
test asserts the two paths agree.

**The source-integrity gate parses `SOURCES.md` line by line, because parsing it as one document
produces false failures.** The first prototype used a single anchored `findall` and reported 15
problems, twelve of them fabricated by rows being swallowed by a neighbour's match. Line-by-line
parsing reports the three real ones. Those three are the whole of the conformance work: two items
cite this repository's own lab files and one cites a documentation page, and none of the three has a
row in the record.

One correction to the technical direction as given: the bank-wide duplicate-id check it asks for
**already exists** in `bank_validation_errors` and is covered by a test. What is missing is the
advisory near-duplicate report, which this plan adds without making it fail.

## Technical Context

**Language/Version**: Python 3.11+, standard library first. CI matrix stays 3.11 and 3.12. No
TypeScript changes; no Node work beyond running the existing site build as a gate.
**Primary Dependencies**: unchanged. `PyYAML` and `jsonschema`, both already engine dependencies.
**No new dependency**, and nothing new pinned.
**Storage**: YAML files under `drills/bank/<NN>-<domain-slug>/`, one item per file, discovered
recursively. `SOURCES.md` gains rows, including a table for this repository's own cited source
files.
**Testing**: `pytest`, extending `tests/test_drill_validation.py` and adding
`tests/test_bank_coverage.py` and `tests/test_source_integrity.py`.
**Target Platform**: Developer shell and CI. The coverage report is a local authoring instrument;
the source-integrity check is a gate.
**Project Type**: Content authoring against an existing Python engine, with two small tooling
additions.
**Performance Goals**: The coverage report and the integrity check each complete in well under a
second over a bank of this size; both are pure file reads with no network.
**Constraints**: `drills/schema.json` required fields do not move (FR-022). The mock's apportionment
does not change (FR-025). No site code changes (FR-023). Every authoring pass ends with the full
gate set green (FR-027). Item text is never restated in `site/` (FR-024).
**Scale/Scope**: 162 target items, 53 held, 109 to author. This feature delivers the tooling, the
conformance fixes, and the two heaviest domains: 52 items. The remaining 57 are the tracked
follow-on (FR-029).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — both passes clean.*

- [x] **I. Blueprint is the source of truth** — every target is computed from `apportion_items` over
      `BLUEPRINT.md`; the only hand-written numbers are the multiple (3) and the floor (6), which
      are authoring policy rather than exam structure. No per-domain count is written anywhere. Each
      item's `domain` and `sub_skill` are the blueprint's exact strings, already enforced by
      validation and by `tools/check_blueprint_consistency.py`.
- [x] **II. Single-sourced content** — items live once, as YAML in `drills/bank/`. They reach the
      mock, the quizzes, and search through `tools/export_item_bank.py` and
      `tools/export_mock_data.py`. `tools/check_content_single_source.py` continues to gate against
      a copy landing in `site/`.
- [x] **III. Keyless, loginless, installless** — the feature adds data files and two local commands.
      No key, no account, no network call at build or at runtime. The integrity check reads local
      files only; it does not fetch a cited URL.
- [x] **IV. Coverage is proportional to exam weight** — the target is a multiple of the weighted
      quota at domain level and largest-remainder apportioned at sub-skill level. The floor of six
      is the single deliberate deviation, and it applies only where a quota below two would leave a
      quiz unable to vary; it never lifts a light domain above a heavier one.
- [x] **V. Original material only** — FR-008 carries the originality rule; FR-016 through FR-021
      define sourcing, and FR-019 makes the citation-to-record agreement a gate rather than a habit.
      Anthropic material is cited by link, never vendored.
- [x] **VI. Gates are non-negotiable** — the new source-integrity check joins the existing gate set
      and CI beside `tools/check_links.py`. Every pass boundary runs the full set, and the tasks
      phase makes each run an explicit task.
- [x] **VII. The implementation is teaching material** — public functions are type-hinted; the
      coverage module explains the apportionment it reuses rather than duplicating it; the
      near-duplicate report is advisory because an unenforceable threshold presented as a gate would
      teach the wrong lesson.
- [x] **VIII. Accessible and fast by default** — no interface is added. FR-016 keeps every item
      answerable from its text alone, so nothing here can degrade the site's conformance. The site's
      payload check remains the budget, and more items grow `items.json`, which the tasks phase
      measures at each pass boundary rather than assuming.

**Note on VIII**: the payload budget is the one constitutional gate this feature can plausibly move,
because 109 items enlarge a build-time data file. It is measured per pass rather than at the end.

## Project Structure

### Documentation (this feature)

```text
specs/004-item-bank-expansion/
├── plan.md              # This file
├── research.md          # Phase 0 measurements and decisions
├── data-model.md        # Phase 1 entities
├── quickstart.md        # Phase 1 commands, traps, authoring loop
├── contracts/
│   ├── coverage-report.md    # The coverage subcommand's contract
│   ├── source-integrity.md   # The new gate's contract
│   └── item-authoring.md     # What one authored item must satisfy
├── checklists/
│   └── requirements.md       # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source code (repository root)

```text
drills/
├── engine/
│   ├── blueprint.py       # unchanged; parse_sub_skills already returns weights
│   ├── coverage.py        # NEW: targets, shortfalls, the report model
│   ├── mock.py            # apportionment extracted to a shared helper; behavior unchanged
│   ├── validation.py      # advisory near-duplicate report added; duplicate-id check already here
│   └── __main__.py        # NEW `coverage` subcommand beside validate/generate/take/score
├── bank/
│   ├── 01-agents-and-workflows/          # authored items, one YAML per item
│   ├── 02-applications-and-integration/  # heaviest domain: this feature takes it to 51
│   ├── 03-claude-code/
│   ├── 04-eval-testing-and-debugging/
│   ├── 05-model-selection-and-optimization/  # second heaviest: to 27
│   ├── 06-prompt-and-context-engineering/
│   ├── 07-security-and-safety/
│   └── 08-tools-and-mcps/
└── schema.json            # unchanged

tools/
└── check_source_integrity.py   # NEW gate: citations against SOURCES.md

tests/
├── test_bank_coverage.py       # NEW: targets agree with apportion_items; sub-skill sums
├── test_source_integrity.py    # NEW: the parser, and the conformance of the real bank
└── test_drill_validation.py    # extended: difficulty coverage, near-duplicate advisory

SOURCES.md                      # gains rows, including a this-repository table
.github/workflows/ci.yml        # the new gate wired beside check_links.py
```

**Structure Decision**: No new top-level directory and no new package. The engine gains one module
and one subcommand; `tools/` gains one check; `tests/` gains two files. Everything else this feature
delivers is content in `drills/bank/`, which is the delivery mechanism the exporters already read.

## Phased delivery

Each pass ends at a green gate set, and is a reviewable commit.

The item counts below are a dated measurement of what the coverage report printed while this plan
was written, recorded so the phasing can be judged for size. They are evidence, never the authority:
every pass ends when the report shows no shortfall, and a count here that disagrees with the report
is wrong by definition (FR-001).

| Pass | What lands | Items measured |
|---|---|---:|
| 1 | `drills/engine/coverage.py`, the shared apportionment helper, the `coverage` subcommand, `tests/test_bank_coverage.py` | 0 |
| 2 | `tools/check_source_integrity.py`, its test, CI wiring, the three conformance fixes and the new `SOURCES.md` rows | 0 |
| 3 | Advisory near-duplicate report in `validate`; difficulty-coverage test | 0 |
| 4 | Applications and Integration to target | 34 |
| 5 | Model Selection and Optimization to target | 18 |
| 6 | Gap pass: every sub-skill in the covered domains at two or more, each covered domain holding all three difficulties and at least one multiple-response item | as measured |

Passes 4 and 5 are each large enough to split by sub-skill; `/speckit-tasks` decides that split from
the coverage report rather than from a number written here.

The follow-on — the six remaining domains, 57 items by the same measurement — keeps these targets
and floors and is tracked separately per FR-029. Passes 1 through 3 make that follow-on measurable
rather than estimated.

## Complexity Tracking

No constitutional violations. One deliberate deviation is recorded rather than justified as a
violation: the floor of six items per domain is a departure from strict weight proportionality
(Principle IV), accepted because a domain holding one or two items cannot vary a quiz between
attempts or carry the three difficulty levels FR-005 requires, and because the floor lifts only the
two lightest domains and never past a heavier one.
