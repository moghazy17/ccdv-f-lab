# Phase 1 data model

Entities are grouped by where they live: derived at build time from the repository, or stored in the
candidate's browser. Nothing here is authored twice — every build-time entity names the repository
file it comes from.

## Build-time entities

### LabModule

One runnable unit of the reference application. Enumerated from the repository, never listed by
hand.

| Field | Type | Source | Notes |
|---|---|---|---|
| `slug` | string | file or package name | `transport`, `mcp-server`, `evals` |
| `sourcePath` | string | repository path | `lab/transport.py`, `lab/mcp_server/` |
| `concept` | string | curated label | The nine named concepts map onto modules; others get an accurate label |
| `domainNumber` | integer | note cross-reference | Which blueprint domain the module belongs to |
| `notePath` | string | `notes/NN-.../` | Target of the note link |
| `noteStatus` | `authored` \| `partial` \| `scaffold` | `content-status.ts` | Drives the FR-014 notice |
| `runnable` | boolean | **import probe at build time** | Never a maintained list — FR-012 |
| `unrunnableReason` | string \| null | probe result | Shown verbatim on a read-only lab |
| `entrySource` | string | file contents | What the code pane is seeded with |

**Rule**: `runnable` is false only when the probe fails; the reason is recorded from the probe, not
invented. Expected today: twelve true, `mcp-server` false because `mcp` is absent from the runtime
distribution.

### PracticeItem

One original item, read from `drills/bank/**/*.yaml` and re-shaped for the browser.

| Field | Type | Notes |
|---|---|---|
| `id` | string | Stable slug, unique across the bank |
| `domain` | string | Exact `BLUEPRINT.md` name — tooling joins on it |
| `subSkill` | string | Exact `BLUEPRINT.md` name |
| `difficulty` | string | `recall` \| `application` \| `analysis` |
| `select` | integer | Number of correct options |
| `stem` | string | The question |
| `options` | Option[] | ≥4, each with `id`, `text`, `rationale`; incorrect ones also carry `trapType` |
| `sources` | Source[] | Each with `title`, `url`, `verifiedOn` |

**Excluded**: any item with `format_demonstration: true` never reaches `items.json`. This is
enforced in the exporter and asserted by a test, so it cannot be forgotten on a new surface.

**Validation**: every item passes `python -m drills.engine validate` before publication; a failure
blocks the build.

### DomainQuota

The apportionment, computed by the repository's own engine.

| Field | Type | Notes |
|---|---|---|
| `size` | integer | Mock size the quotas are for; 53 comes from `BLUEPRINT.md` |
| `quotas` | map of domain name to integer | Straight from `apportion_items` |
| `available` | map of domain name to integer | How many eligible items the bank actually holds |

**Rule**: `quotas` is never computed in TypeScript. `available` is what powers the shortfall notice
(FR-035) and the no-surplus notice (FR-036): a domain where `available == quota` can only ever draw
the same items.

### Flashcard

One generated card, parsed from `flashcards/ccdv-f.tsv`.

| Field | Type | Notes |
|---|---|---|
| `id` | string | **The stable identifier the generator writes into the back as a tag line** |
| `front` | string | Column one; not unique — 30 cards share 9 fronts |
| `back` | string | Column two, minus the tag lines |
| `domain`, `subSkill` | string | Parsed from the existing tag lines |

**Rule**: `id` is the only key review state is held against. `front` must never be used as a key.

### RecallPrompt

One open question from a domain's notes `Self-check` section, rendered rather than copied.

| Field | Type |
|---|---|
| `id` | string, stable within the domain |
| `domainNumber` | integer |
| `subSkill` | string |
| `text` | string |

## Stored entities

All four namespaces sit beside `foundation` in the existing envelope. The envelope's schema version
does **not** change: `migrateProgress` already preserves namespaces it does not own, so a record
written here imports cleanly into a build that predates it, and a feature 001 record migrates
forward untouched.

### `labs` namespace

| Field | Type | Notes |
|---|---|---|
| `edits` | map of lab slug to string | The candidate's edited source; absent means unedited |

Discarding an edit removes the key rather than storing the original, so a lab whose repository
source changes picks the new source up automatically.

### `mock` namespace

| Field | Type | Notes |
|---|---|---|
| `current` | MockAttempt \| null | At most one attempt in progress |
| `reports` | ScoreReport[] | **At most three in full**, newest first |
| `summaries` | ScoreSummary[] | Every older attempt, unbounded but tiny |

### MockAttempt

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `items` | PracticeItem[] | Snapshot as drawn, so FR-037 holds after the bank changes |
| `answers` | map of item id to option id[] | Revisable until submission |
| `startedAt` | ISO instant | |
| `deadlineAt` | ISO instant | `startedAt` + the blueprint's time limit |
| `submittedAt` | ISO instant \| null | |
| `expiryHandled` | boolean | False until the candidate chooses to score or discard |

**State transitions**:

```text
                    ┌────────────────────────────────┐
                    │                                │
  (start) ──► in progress ──► submitted ──► report (full)
                    │                                │
                    │  deadline passes while away    │  a 4th report arrives
                    ▼                                ▼
               expired ──► (candidate chooses)  summary only
                    │        ├─ score  ──► report (full)
                    │        └─ discard ──► removed, nothing stored
```

An expired attempt is neither scored nor retained until the candidate chooses (FR-028). Remaining
time is always `deadlineAt - now`, never a decremented counter, so a suspended tab cannot
desynchronise it.

### ScoreReport and ScoreSummary

| Field | ScoreReport | ScoreSummary |
|---|---|---|
| `attemptId`, `submittedAt` | yes | yes |
| `correct`, `itemCount` | yes | yes |
| per-domain correct and count | yes | yes |
| `ready`, `lowDomains`, `unassessedDomains` | yes | yes |
| `items` with the candidate's answers and explanations | **yes** | no |
| `detailDropped` | no | `true` — drives the FR-037 notice |

A summary is what a report becomes when a fourth arrives. The trend survives; the item detail does
not, and the report says so rather than rendering an empty list.

### `quiz` namespace

| Field | Type |
|---|---|
| `results` | map of domain slug to QuizResult |
| `recall` | map of prompt id to `known` \| `unknown` |

`QuizResult` holds `correct`, `itemCount`, `takenAt`, and the wrong answers with their explanations.
Only `results` feeds a readiness signal; `recall` never does, and the page says so (FR-041).

### `flashcards` namespace

| Field | Type | Notes |
|---|---|---|
| `state` | map of card id to `{ box, dueAt }` | `box` is 1–5 |

Boxes are the five Leitner intervals: same session, 1 day, 3 days, 7 days, 21 days. Known moves up
one; not known returns to box 1. On regeneration, state for an id no longer in the deck is dropped
and never reassigned to another card (FR-047).

## Validation rules carried from the requirements

| Rule | Requirement |
|---|---|
| An item is correct only when the selected set matches the correct set exactly | FR-030 |
| Readiness requires ≥85% overall and ≥70% in every domain, withheld if any domain is unassessed | FR-033 |
| A mock never substitutes across domains to reach its size | FR-035 |
| The mock's size, time limit, and quotas come from `BLUEPRINT.md` | FR-023, FR-024 |
| A quiz asks for its domain's quota | FR-040 |
| Format demonstrations reach no learner surface | FR-022 |
| Storage writes read-merge-write and never clobber another tab | FR-051 |
