# Contract: one authored item

Satisfies FR-008 through FR-021. The schema enforces the shape; this contract holds what the schema
cannot see, and is the checklist a reviewer applies per item.

## The stem

A situation with a stated constraint, not a definition prompt. The exam is tradeoff-driven: the
candidate should have to choose between options that all work, on a requirement the stem names.

- Names the constraint that settles it — who must see it, how fast, at what cost, under whose
  control.
- Answerable from its own text: no reliance on option ordering, on colour, or on layout (FR-016).
- States the select count in its own words when more than one option is correct (FR-014).
- Carries no time-anchored phrasing, no ticket reference, and no process language.

## The options

Four or more, one row per plausible engineering decision.

| Property | Rule |
|---|---|
| Correct option | Right because of the stem's stated constraint, not because of an unstated assumption |
| Distractors | Each fails for a different, nameable reason; each carries a `trap_type` from the schema (FR-010) |
| Rationales | Every option, correct and incorrect, explains rather than restates (FR-010, FR-011) |

A distractor that is obviously absurd teaches nothing and makes the item easier than the exam. The
test to apply: would a candidate who has studied the material but missed one distinction pick it? If
no distractor passes that test, the item is not yet an item.

The wrong-answer rationale is what a learner reads after a miss. It explains the distinction that
separates the option from the correct one, in terms the learner can carry to the next question.

## Distinctness

No other item in the same domain may turn on the same distinguishing fact (FR-012): if knowing the
single passage that settles this item is enough to answer another without further knowledge, one of
the two is redundant. `validate` prints a near-duplicate advisory to make neighbours visible; it
does not decide this, because it cannot.

## The sourcing sequence

The order is the rule, not an implementation detail:

1. Open the page and read the passage that settles the item.
2. Add or re-date its row in `SOURCES.md`, with what it establishes.
3. Write the item, citing that page with the date it was read.

Writing the item first and attaching a plausible URL afterwards produces something that passes every
gate and is still wrong. If the page cannot be opened, the item is not written and the blocked
sub-skill is reported (FR-021).

A source is an official Anthropic page — the exam guide, Partner Academy, or Anthropic's product
documentation — or a source file in this repository where the item tests something this repository's
own reference application demonstrates (FR-017). A community summary, an aggregator, or a model's
recollection is not a source, whatever it says.

## Originality

Every item is written from the public blueprint. Nothing recalled, reconstructed, or paraphrased
from a live exam, in any form (FR-008). This is the project's central rule and it is not a matter of
degree.

## Placement

| Field | Rule |
|---|---|
| File | `drills/bank/<NN>-<domain-slug>/<id>.yaml`, the directory matching the item's domain |
| `id` | Lowercase kebab slug describing the distinction the item tests, stable once published (FR-013) |
| `domain`, `sub_skill` | Copied character for character from `BLUEPRINT.md` (FR-009) |
| `difficulty` | Chosen honestly; each covered domain ends holding all three (FR-005) |

An item id that names its answer — `use-batch-api` — spoils the item in any listing. Name the
distinction: `batch-vs-realtime-tradeoff-pricing-and-latency`.

## Before the item is considered written

```powershell
python -m drills.engine validate
python tools/check_source_integrity.py
python -m drills.engine coverage --domain "<the domain>"
```

The first two must pass. The third is read, not passed: it shows what the pass still owes.
