# Contributing

## No braindumps

Do not submit recalled, reconstructed, or paraphrased live exam items: every candidate signs an NDA,
and such material puts both the contributor's credential and this project at risk. Every drill item
must be original and written only from the public blueprint.

## Add a drill item

1. Start from the exact domain and sub-skill names in [BLUEPRINT.md](BLUEPRINT.md).
2. Write an original scenario, prompts, and answer rationale from public documentation or your own
   demonstration; never model an item on remembered exam content.
3. Tag the item with its exact blueprint domain and sub-skill names.
4. Cite factual assertions in [SOURCES.md](SOURCES.md) with a link and verified-on date.
5. Keep the item within the conventions owned by the drills directory.

## Add a note

1. Work inside the matching numbered directory in [notes/](notes/).
2. Preserve the YAML frontmatter's exact domain name, number, weight, and sub-skill names.
3. Prefer decision tables for choices and include a “choose this when” column.
4. Link a demonstrable concept to a specific file in [lab/](lab/); that lab file must link back.
5. Add a dated [SOURCES.md](SOURCES.md) entry for every factual claim about the exam, API, pricing,
   or model behavior.

## Conventions

Use US English, sentence-case headings, and lines no longer than 100 columns. Size coverage by the
published domain weights instead of giving every domain equal space. Use Python 3.11 or later and
standard-library-first code. Public functions need type hints, models need pinned versions, and lab
transports need to be keyless and mockable. Do not commit secrets, process language, ticket IDs in
comments, commented-out code, or unowned TODOs.

The full repository rules are in [AGENTS.md](AGENTS.md), and the exact source terms belong in
[BLUEPRINT.md](BLUEPRINT.md).

## Required gates

    ruff check .
    ruff format --check .
    pytest -q

Do not run git add or git commit. Leave changes uncommitted for review.
