# Phase 0 research: item-bank expansion

Every decision below was measured against the repository rather than reasoned from the request. The
measurements are reproducible from the commands in [quickstart.md](quickstart.md).

## Decision 1 — targets are computed, and the arithmetic already exists

**Decision**: A new `drills.engine.coverage` module computes each domain's target as
`max(apportion_items(blueprint, blueprint.exam_item_count)[domain] * TARGET_MULTIPLE,
DOMAIN_FLOOR)`, with `TARGET_MULTIPLE = 3` and `DOMAIN_FLOOR = 6` as the only two constants. It
apportions that target across the domain's sub-skills with the same largest-remainder function the
mock uses.

**Rationale**: The clarified sizing (3x quota, floor 6) is policy, not blueprint structure, so it
belongs in one named constant. Everything else — which domains exist, what they weigh, which
sub-skills belong to them — is read from `BLUEPRINT.md` through the existing parser, so a reweighted
blueprint moves every target without an edit (FR-007).

**Measured**: A prototype run produced the full target table. Totals: 162 target against 53 eligible
items held, so 109 to author; the two heaviest domains account for 78 of the target and 52 of the
authoring.

The table below is a dated record of what that run printed, kept as the evidence for the sizing
decision. It is not a source: nothing reads it, no task is checked against it, and where it
disagrees with `python -m drills.engine coverage`, the report is right and this table has gone stale
(FR-001).

| Domain | Quota | Target | Held | Shortfall |
|---|---:|---:|---:|---:|
| Applications and Integration | 17 | 51 | 17 | 34 |
| Model Selection and Optimization | 9 | 27 | 9 | 18 |
| Agents and Workflows | 8 | 24 | 8 | 16 |
| Prompt and Context Engineering | 6 | 18 | 6 | 12 |
| Tools and MCPs | 6 | 18 | 6 | 12 |
| Security and Safety | 4 | 12 | 4 | 8 |
| Claude Code | 2 | 6 | 2 | 4 |
| Eval, Testing, and Debugging | 1 | 6 | 1 | 5 |

**Alternatives considered**: A per-domain target table in `tasks.md` — rejected, it goes stale on
the first item and violates FR-001. Computing targets in the site's TypeScript — rejected,
apportionment must not be reimplemented outside the engine.

## Decision 2 — the sub-skill split needs one refactor, not a second implementation

**Decision**: Extract the largest-remainder arithmetic in `drills.engine.mock.apportion_items` into
a reusable helper that takes ordered `(key, weight)` pairs and a size. `apportion_items` keeps its
signature, its behavior, and its tie-break, and delegates. The coverage module calls the same helper
with the sub-skill weights.

**Rationale**: Sub-skill apportionment is the same problem as domain apportionment. Writing it twice
guarantees the two drift, and FR-003 forbids it.

**Measured**: `Domain.sub_skills` carries names only — the parser reads sub-skill weights in
`parse_sub_skills` and discards them when building the dataclass. `parse_sub_skills` is already
public and returns `(name, weight)` pairs, so the coverage module can read weights without changing
`Domain` at all. Tie-breaking on remainder currently uses `domain.number`; the generalized helper
breaks ties on listed position, which is the same ordering for domains because the blueprint's table
is numbered in order. A test asserts the two agree.

**Alternatives considered**: Adding sub-skill weights to the `Domain` dataclass — rejected as a
wider change than the feature needs, and every existing consumer would carry a field it ignores.

## Decision 3 — the source record parses line by line, never as one document

**Decision**: The source-integrity check reads `SOURCES.md` line by line: reference definitions
(`[label]: https://…`) build a label-to-URL map, and each table row contributes its cited URLs with
the row's verified date. Both reference-style (`[Title][label]`) and inline (`[Title](https://…)`)
citations are handled.

**Rationale and measurement — this is a trap worth recording.** The first prototype applied one
`re.findall` with `^…$` anchors across the whole document and silently lost rows: it reported 32 of
34 link definitions recorded and produced 15 false failures, including the models overview page that
is plainly in the table. The trailing `\s*$` lets a match run past a line ending, so rows get
consumed by a neighbour's match. Parsing each line independently reports 34 of 34 and exactly three
real problems. A gate that fails with false positives is worse than no gate, because the first
response is to weaken it.

**Real problems found**, and the whole of the conformance work FR-020 requires:

| Item | Citation | Problem |
|---|---|---|
| `deriving-schema-validation-requirement-from-business-rule` | `…/ccdv-f-lab/blob/main/lab/output.py` | No row in the record |
| `prompt-version-bump-for-reproducible-ab-test` | `…/ccdv-f-lab/blob/main/lab/config.py` | No row in the record |
| `streaming-required-above-large-max-tokens` | `…/build-with-claude/streaming` | No row in the record |

**Decision on the two repository citations**: add a *this repository* table to `SOURCES.md` with a
row per cited source file, rather than exempting repository URLs from the check. One uniform rule —
everything cited has a dated row — is enforceable; a category exemption is a hole that grows.

**Alternatives considered**: A Markdown parsing dependency — rejected, standard library first, and
the format is this repository's own. Matching citations by title rather than URL — rejected, titles
are prose and drift.

## Decision 4 — duplicate ids are already caught; the near-duplicate check is what is missing

**Decision**: Do not add a duplicate-id check. `bank_validation_errors` already reports
`id 'x' duplicates <path>` bank-wide, and a test covers it. Add instead an advisory near-duplicate
report over items within one domain, printed by `validate` without failing it.

**Rationale**: FR-012 is about two items turning on the same fact, which no exact-match check can
see. An advisory report shows an author the neighbours of what they just wrote; making it fail would
punish legitimate overlap between sub-skills that genuinely share vocabulary.

**Measured**: The existing check is in `drills/engine/validation.py`, in the `seen_ids` loop.

**Alternatives considered**: Failing on near-duplicates — rejected as unenforceable without a
similarity threshold nobody can defend. Embedding-based similarity — rejected, it would need a model
and a network, and the repository is keyless.

## Decision 5 — one sub-skill has no item at all

**Decision**: Treat *Claude Hooks* as a first-pass target rather than a later one.

**Measured**: The spec's context section records seven sub-skills standing on a single item. The
target run surfaced an eighth fact it did not have: *Claude Hooks*, under Security and Safety, holds
**zero** items, so FR-004's floor of two is a from-scratch authoring job there. Its target is 2.

**Rationale**: A sub-skill with no item is invisible in every per-sub-skill count that multiplies
what exists, and the repository's own hook is the worked example the Claude Code module already
publishes, so the sourcing is at hand.

## Decision 6 — passes are ordered by weight, and each ends green

**Decision**: Tooling first (coverage report, source-integrity check, conformance fixes), then one
authoring pass per domain in descending exam weight. This feature closes after the two heaviest
domains (FR-029); the rest are the tracked follow-on.

**Rationale**: A pattern error in an item — a weak distractor shape, a rationale that restates the
option — is cheap to correct in a five-item diff and expensive across forty files. Running the gate
set at each pass boundary is what makes the error surface while the diff is small.

**Measured**: The full gate set is eight commands from the repository root and six from `site/`; a
pure content pass needs the Python set plus the site build. `tools/check_content_single_source.py`
runs in the CI `site` job rather than the `test` job, so a local run of the `test` job's commands
alone would not catch a duplication defect.

## Decision 7 — no new dependency, and no schema change

**Decision**: Python 3.11+, standard library, plus the `PyYAML` and `jsonschema` the engine already
depends on. `drills/schema.json` keeps its required fields. No site code changes.

**Rationale**: FR-022 through FR-026 fix these boundaries, and the site already publishes every
eligible item through `tools/export_item_bank.py` and `tools/export_mock_data.py`. Adding a file is
the whole delivery mechanism.

**Measured**: A domain quiz asks for that domain's full mock quota (`quizLength` in
`site/src/lib/quiz.ts`), so at 3x quota every quiz draws from three times what it asks for, and
SC-002 holds without a site change. The mock page's notice is driven by `hasNoSurplus`, so it
retires itself per FR-026.
