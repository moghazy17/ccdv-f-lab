# Quickstart: growing the item bank

What to run, what the numbers mean, and the traps this feature carries.

## Verify a change

From the repository root:

```powershell
ruff check .
ruff format --check .
pytest -q
python -m drills.engine validate
python tools/check_source_integrity.py
python -m lab.evals run
python tools/check_blueprint_consistency.py
python tools/check_links.py
python tools/check_content_single_source.py
```

That is the full set CI runs, not a summary of it. From `site/`:

```powershell
npm run lint
npm run typecheck
npm run test:unit
npm run build
npm run check:payload
npm run test:e2e
```

For a pure authoring pass, the Python set plus `npm run build` and `npm run check:payload` is
enough; run the full site suite before opening the pull request. `check:payload` is the one
constitutional gate this work can plausibly move, so it is measured rather than assumed: 54 authored
items left the transferred payload unchanged at 6.62 MiB against an 8.00 MiB ceiling, because item
text is small beside the runtime the page already carries.

## See what to write next

```powershell
python -m drills.engine coverage
python -m drills.engine coverage --domain "Applications and Integration"
```

The report is the work list. It prints held, target, and shortfall per domain and per sub-skill,
plus any difficulty level a domain is missing and whether the domain holds a multiple-response item.
It exits 0 whether or not a shortfall exists — it is an instrument, not a gate.

Do not copy its numbers into a task list. The whole point is that the report is recomputed from the
bank, so it is right after every item lands.

## The targets, and where they come from

A domain's target is `max(quota * 3, 6)`, where the quota is what
`drills.engine.mock.apportion_items` gives that domain for a full-size mock. Three and six are the
only two hand-written numbers in this feature; both live as constants in
`drills/engine/coverage.py`. Everything else is read from `BLUEPRINT.md`.

Measured at the start of this feature: 162 target, 53 held, 109 to author. The two heaviest domains
account for 52 of that and close this feature; the rest is the tracked follow-on.

## Authoring loop, per item

1. Take the largest sub-skill shortfall from the coverage report, rather than the topic you find
   interesting.
2. Read the blueprint's "Measured" cell for that sub-skill. The item tests something named there.
3. Open the Anthropic page that settles the question and read the passage. Add or re-date its
   `SOURCES.md` row.
4. Write the item against [contracts/item-authoring.md](contracts/item-authoring.md).
5. `python -m drills.engine validate` and `python tools/check_source_integrity.py`.

Steps 3 and 4 are in that order deliberately. An item written from memory with a plausible URL
attached afterwards passes every gate in this repository and is still wrong.

## Two habits the first two domains earned

**Vary the answer position and keep options the same length.** The first batch was written with the
correct option first every time, and longest in 44 items of 54. Either tell lets a reader answer
without knowing anything. Both were repaired afterwards; writing them right costs nothing.

**Read a sub-skill's existing items before authoring into it.** Two duplicates were caught that
way and by review, neither visible to the near-duplicate advisory, because the overlap was
conceptual rather than textual.

## Traps

**The disclosure is per domain, not all-or-nothing.** `site/src/lib/attempt.ts` reports which
domains still repeat, and the mock page names them. An earlier all-or-nothing version hid the notice
entirely as soon as one domain gained a surplus, which implied a fresh draw across a bank where six
domains still repeated. Removing the notice by editing the page rather than by growing the bank is a
defect; it retires itself when the last domain passes its quota.

**Do not parse `SOURCES.md` as one document.** A single anchored `re.findall` over the whole file
swallows rows into their neighbours: the prototype that did so reported 15 citation problems where
three exist. Parse line by line. This is recorded in
[contracts/source-integrity.md](contracts/source-integrity.md) because it will look like an
over-specification until someone rewrites it the obvious way.

**`Domain.sub_skills` carries names, not weights.** The weights are parsed and discarded when the
dataclass is built. Use `parse_sub_skills`, which is public and returns pairs, rather than widening
the dataclass.

**Apportionment exists once.** `apportion_items` keeps its signature and delegates to a shared
helper; the coverage module calls the same helper for sub-skills. Do not write the largest-remainder
arithmetic a second time, in Python or in TypeScript.

**The duplicate-id check already exists.** `bank_validation_errors` reports it bank-wide and a test
covers it. What this feature adds is the advisory near-duplicate report, which must not fail
`validate`.

**A sub-skill can hold nothing at all.** *Claude Hooks*, under Security and Safety, held zero items
when this work began: every per-sub-skill count that multiplies what exists leaves such a sub-skill
at zero. The coverage report names it rather than omitting it, which is how it was found.

**Generated files are never hand-edited.** `site/src/data/items.json`, `mock.json`,
`blueprint.json`, `claude-code.json`, `flashcards/ccdv-f.tsv`, and `cheatsheets/*.md` are all
produced by a tool.
Adding an item changes the first two through their exporters, and no site edit is needed for an item
to reach the mock, its domain quiz, and search.

## What this feature does not touch

The item schema's required fields, the mock's apportionment, any site code, the six scaffold note
trees, and the generated flashcard deck. Growing the flashcard deck means authoring notes, which is
a separate feature.
