# Phase 1 data model: Study site foundation and content pipeline

Two kinds of data meet in this feature: **derived data**, generated from repository sources at build
time and never edited by hand, and **learner data**, written in the browser and owned by the
candidate. They never mix. Derived data is read-only at runtime; learner data never influences a
build.

## Derived entities

### Domain

Generated from `BLUEPRINT.md` into `site/src/data/blueprint.json`; enriched at build time with
content status read from `notes/`.

| Field | Type | Source | Notes |
|---|---|---|---|
| `number` | integer 1–8 | Blueprint | Stable identifier used in note directory names |
| `slug` | string | Derived | `01-agents-and-workflows`, matching the `notes/` directory exactly |
| `name` | string | Blueprint | Verbatim; tooling joins on this string |
| `weight` | decimal | Blueprint | Percentage of the whole exam |
| `approximateItems` | integer | Blueprint | As published in the domain table (`~17`); read, never recomputed |
| `mockItems` | integer | Blueprint | Largest-remainder allocation; the eight sum to exactly 53 |
| `subSkills` | Sub-skill[] | Blueprint | Ordered as published |
| `status` | `authored` \| `partial` \| `scaffold` | Notes | See state transitions below |
| `labModules` | string[] | Reference app | Empty for domains 1, 3, and 8 at present; drives FR-021 |

**Validation**: the eight weights sum to 100. `mockItems` sums to 53. Every `slug` corresponds to an
existing `notes/` directory, and every `notes/` directory corresponds to a domain — a mismatch fails
the build (FR-008). `name` matches `BLUEPRINT.md` byte for byte.

**State transitions** for `status`, evaluated per build:

```text
scaffold  → no note section has authored content
partial   → at least one section authored, at least one still scaffolded
authored  → every section in the domain's notes has authored content
```

"Authored" follows the repository's existing rule, mirrored in `content-status.ts`: strip lines
starting `Authoring prompt:`, then a heading counts only when a non-heading, non-empty line follows.
All eight domains are `scaffold` today, which is the state the pages must be designed against.

### Sub-skill

| Field | Type | Source | Notes |
|---|---|---|---|
| `name` | string | Blueprint | Verbatim |
| `domainNumber` | integer | Blueprint | Parent |
| `weight` | decimal | Blueprint | Share of the **whole** exam, not of its domain |
| `approximateItems` | decimal | Blueprint | As published in the sub-skill table (`~4.6`); read, never recomputed |
| `measured` | string | Blueprint | What the sub-skill covers; shown on a scaffold page (FR-013) |
| `status` | `authored` \| `scaffold` | Notes | Per-sub-skill, from the note headings |

**Validation**: a domain's sub-skill weights sum to that domain's weight. Twenty-five sub-skills
across the eight domains.

### Study plan

Parsed from `study-plans/*.md`, which are hour-allocation tables rather than task lists.

| Field | Type | Notes |
|---|---|---|
| `slug` | `1-week` \| `3-weeks` \| `6-weeks` | Matches the filename |
| `totalHours` | decimal | 14.000, 42.000, 84.000 |
| `allocations` | { domainNumber, hours }[] | Eight rows, summing to `totalHours` |

**Validation**: allocations sum to `totalHours` to three decimal places, and each row's hours equal
`totalHours × weight ÷ 100`, so a plan cannot drift from the blueprint either.

### Guide page and Content record

`Guide page` is a rendered markdown document from `guide/`. `Content record` is the unit search
indexes — see `contracts/search-record.md`, which defines the type field that lets feature 002 add
practice items and flashcards without replacing the search surface.

## Learner entities

All learner data lives in one versioned envelope in `localStorage`, described fully in
`contracts/progress-record.md`. Summarised here for the relationships.

### Progress record

| Field | Type | Notes |
|---|---|---|
| `schemaVersion` | integer | Refuse, do not migrate, when higher than the running site understands |
| `updatedAt` | ISO 8601 string | Used to explain what an import would replace |
| `namespaces.foundation` | object | Everything this feature writes |
| `namespaces.*` | object | Reserved; features 002 and 003 write siblings |

`namespaces.foundation` holds:

| Field | Type | Notes |
|---|---|---|
| `theme` | `light` \| `dark` \| `system` | Applied before first paint |
| `planMarks` | { [planSlug]: domainNumber[] } | Per-plan, per-domain marks (US3, FR-022) |
| `diagnostic` | Diagnostic response \| null | See below |

**Relationships**: `planMarks` keys reference plan slugs; values reference domain numbers. Both are
validated against the derived data on read, so a record naming a plan or domain that no longer exists
is reported rather than silently dropped.

### Diagnostic response

Held in its own area so feature 002 can change how a recommendation is *produced* without disturbing
what depends on it (FR-030a).

| Field | Type | Notes |
|---|---|---|
| `source` | `self-report` | The only value in this feature; 002 adds `assessed` |
| `experience` | { [subjectArea]: `none` \| `some` \| `strong` } | Self-reported |
| `weeksAvailable` | integer | Drives the recommendation |
| `hoursPerWeek` | decimal | Drives the recommendation |
| `recommendedPlan` | plan slug | The output |
| `reason` | string | Shown to the candidate; never implies a score |
| `completedAt` | ISO 8601 string | |

**Validation**: `recommendedPlan` must be one of the three known slugs. `reason` is generated from
the stated rule in `recommend.ts`, not free text.

**Recommendation rule**: choose the plan whose `totalHours` is the closest fit at or below
`weeksAvailable × hoursPerWeek`, falling back to `1-week` when the budget is smaller than any plan,
and biasing one plan longer when experience is `none` across the two heaviest domains. The rule is
pure and unit-tested, with no reference to storage or the DOM, so 002 can supply an `assessed`
response to the same function.

## Invariants that cross both kinds

1. No learner data is ever read at build time; no derived data is ever written at runtime.
2. Every exam number rendered originates in `blueprint.json`; components receive it as typed data and
   never contain a literal.
3. A domain's `status` is computed, never stored, so it cannot go stale against the notes.
4. The practice item flagged `format_demonstration` is excluded before any record reaches the search
   index (FR-009).
