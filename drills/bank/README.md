# Drill-bank format

Each YAML file below this directory is one original practice item. Place it in the directory named
`NN-domain-slug`, where `NN` and the slug match its notes directory. The engine discovers every
`.yaml` file recursively.

Start from the format demonstration in `01-agents-and-workflows/`. Give every item a stable, unique
slug, and copy the domain and sub-skill exactly from `BLUEPRINT.md`. Set `select` to the number of
correct options. Supply four or more options, a rationale for every option, and a `trap_type` for
each incorrect option.

Each source needs a title, URL, and `verified_on` date. Practice items must be original
public-outline exercises, never recalled or reconstructed exam material. Validate additions before
sharing them:

```powershell
python -m drills.engine validate
python tools/check_source_integrity.py
```

CI runs both before publication. The first checks each item against the schema and the blueprint,
and prints an advisory when two items in one domain read alike — a prompt to judge whether they turn
on the same distinguishing fact, never a failure. The second checks every cited URL against a dated
row in `SOURCES.md`, and rejects an item claiming a check older than that row. Add the source row
before the item that cites it.

The site exporter rejects a malformed item, excludes items marked `format_demonstration: true`, and
publishes every eligible item to the weighted mock and to its domain's scored quiz. Rebuild the site
after validation; no site-code change is needed for an eligible item to appear.

## Finding the next item to write

```powershell
python -m drills.engine coverage
python -m drills.engine coverage --domain "Applications and Integration"
```

The report computes each domain's target from the blueprint's own apportionment of a full-size mock,
so no count is written down anywhere: read it rather than a list, which goes stale as soon as an
item lands. It shows held, target, and shortfall per domain and per sub-skill, and names the floors
a count alone cannot show — a difficulty level with no item, a domain with no multiple-response
item, and a sub-skill standing on fewer than two.

## What the checks cannot see

Two rules are yours to apply, because no gate can:

- **Whether the cited page says what the item claims.** Open the page and read the passage before
  writing the stem, then record the source. An item written from memory with a plausible URL
  attached afterwards passes every check here and is still wrong.
- **Whether a distractor is worth offering.** Ask whether a candidate who studied the material but
  missed one distinction would pick it. Keep the options close in length: a correct option that is
  the longest and most detailed can be spotted without knowing anything, and so can a batch whose
  answers all sit in the same position. Two tests in `tests/test_drill_validation.py` fail if the
  bank drifts far in either direction, but they are a backstop rather than a substitute for writing
  the options evenly in the first place.
