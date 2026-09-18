# Contract: the coverage report

Satisfies FR-001, FR-002, FR-003, FR-006, FR-007, and FR-030 (the follow-on reads its work from the
bank rather than from a list).

## Invocation

```powershell
python -m drills.engine coverage
python -m drills.engine coverage --domain "Applications and Integration"
python -m drills.engine coverage --json
```

`--bank` and `--blueprint` take paths and default exactly as the other subcommands do, so the
report can run against a fixture bank in a test.

## What it computes

| Level | Target |
|---|---|
| Domain | `max(quota * TARGET_MULTIPLE, DOMAIN_FLOOR)`, quota from `apportion_items` over a full-size mock |
| Sub-skill | The domain target, largest-remainder apportioned across the domain's blueprint weights |

`TARGET_MULTIPLE = 3` and `DOMAIN_FLOOR = 6` are module constants in `drills/engine/coverage.py` and
are the only two numbers in this feature not derived from `BLUEPRINT.md`. **No per-domain number is
written anywhere.** Changing either constant changes every target; changing a blueprint weight
changes them too, with no code edit.

## Counting rules

- Items marked `format_demonstration: true` are excluded, matching what the exporter publishes.
- An item counts toward exactly one domain and one sub-skill, by its own exact strings.
- An item whose domain or sub-skill does not resolve against the blueprint is a validation failure,
  not a coverage question; the report says so and does not silently drop it.

## Output

Domains in descending exam weight; sub-skills in published order within each domain. A domain at or
above target still prints, showing the surplus, because a surplus is the outcome this feature exists
to produce.

```text
Domain                                 held  target  short
Applications and Integration             17      51     34
  Claude Application Design               4      13      9
  Software Engineering Foundations        4      12      8
  Claude API Mechanics                    4      11      7
  Configuration Management                2       6      4
  Understanding Requirements              2       5      3
  Systems Life Cycle                      1       4      3
...
Total                                    53     162    109
```

The report also names, per domain, any difficulty level with no item and whether the domain holds a
multiple-response item, because FR-005 and FR-015 are per-domain floors an author cannot see from
the counts alone.

`--json` emits the same data for a test or a follow-on tool to consume. Exit status is 0 whether or
not a shortfall exists: this is an instrument, not a gate. A shortfall is the normal state during
authoring, and failing on it would make the gate set unusable mid-pass.

## Invariants a test asserts

1. Domain targets agree with `apportion_items` times the multiple, or the floor, whichever is
   larger.
2. Sub-skill targets within a domain sum exactly to the domain target.
3. The shared apportionment helper, given the domain weights, reproduces `apportion_items` exactly —
   including tie-breaking — so the refactor cannot drift from the mock.
4. Every blueprint sub-skill appears in the report, including one holding no items.
