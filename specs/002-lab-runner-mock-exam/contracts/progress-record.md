# Contract: the progress record after this feature

Feature 001 shipped a versioned envelope whose namespaces are independently owned. This feature adds
four and changes nothing that already exists.

## The envelope is unchanged

```jsonc
{
  "schemaVersion": 1,          // NOT bumped by this feature
  "updatedAt": "…",
  "namespaces": {
    "foundation": { "theme": "…", "planMarks": {}, "diagnostic": null },
    "labs":       { "edits": {} },
    "mock":       { "current": null, "reports": [], "summaries": [] },
    "quiz":       { "results": {}, "recall": {} },
    "flashcards": { "state": {} }
  }
}
```

**Why the version does not change.** `migrateProgress` already preserves namespaces it does not own
and refuses only records whose `schemaVersion` exceeds the reader's. Adding a namespace is therefore
additive in both directions: a record written here imports into a build that predates this feature
without loss, and a feature 001 record opens here with the new namespaces defaulted. Bumping the
version would break the first of those for no benefit.

**Rule for a later feature**: add a namespace, never repurpose one. The version bumps only when the
*shape* of something existing changes incompatibly.

## Retention

`mock.reports` holds **at most three** full reports, newest first. When a fourth is written, the
oldest is reduced to a `ScoreSummary` and appended to `mock.summaries`.

| | Approximate size | Bound |
|---|---|---|
| Full report (53-item snapshot) | ≈84 KiB | 3 |
| Summary | well under 1 KiB | unbounded |

Measured: one bank item serialises to 1,621 bytes, so 53 items is ≈84 KiB, and unbounded retention
would fill a typical 5 MiB origin quota in roughly 61 attempts — sooner once lab edits share it.
Three full reports cost ≈250 KiB and never grow.

A report reduced to a summary keeps its per-domain trend and sets `detailDropped`, which the report
page renders as a statement rather than an empty item list.

## Export and import

Unchanged in mechanism: one JSON file, the envelope exactly as stored. It now carries the four new
namespaces, so a candidate's labs, mocks, quizzes, and flashcard schedule move between devices with
their plan marks and diagnostic. An incompatible record is still refused whole, never partially
applied.

## Writing safely

Every write goes through the storage module and follows read, merge the one namespace, write back —
the pattern feature 001 established for plan marks. A `storage` event listener refreshes open
surfaces, so a quiz recorded in one tab cannot discard a mock in progress in another.

## When storage is unavailable or full

| Surface | Behaviour |
|---|---|
| Lab | Runs normally; edits are not persisted; the pane says so |
| Mock in progress | **Stays usable on screen through to submission**; the candidate is told the result cannot be stored |
| Quiz | Answerable and scorable on screen; the result is not kept |
| Flashcards | Reviewable; scheduling does not advance, and the page says so |

No surface becomes unusable, and none silently discards work in progress.

## Clearing

A candidate can clear practice results — the four namespaces here — without touching `foundation`.
Plan marks, theme, and the diagnostic outcome survive.
