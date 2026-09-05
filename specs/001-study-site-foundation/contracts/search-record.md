# Contract: search record

**Producer**: Pagefind, indexing the built HTML in a post-build step
**Consumer**: `site/src/components/SearchDialog.astro`

This contract exists because of FR-034: search must be defined over *typed records*, not over "the
markdown pages", so that feature 002 can add practice items and flashcards without replacing the
search surface.

## Record types

Every indexed page declares its type as Pagefind metadata, captured from a data attribute on the
page's root content element.

| Type | Populated in | Source |
|---|---|---|
| `note` | 001 | A domain's note content |
| `guide` | 001 | Eligibility, exam day, cross-map |
| `plan` | 001 | Study plans |
| `cheatsheet` | 001 | Generated per-domain cheatsheets |
| `blueprint` | 001 | The blueprint explorer |
| `drill` | **reserved for 002** | Practice items from `drills/bank/` |
| `flashcard` | **reserved for 002** | Rows from `flashcards/ccdv-f.tsv` |
| `lab` | **reserved for 002** | Lab module pages |

Feature 002 adds types to this table. It does not change how existing types are indexed, and it does
not replace the dialog.

## Metadata on every record

| Key | Meaning |
|---|---|
| `type` | One of the values above |
| `domain` | Domain slug, when the record belongs to one |
| `weight` | The domain's exam weight, so results can be ordered by exam value |
| `status` | `authored`, `partial`, or `scaffold`, so a result can say the material is unwritten |

## Rules

1. **Exclusions are applied before indexing, not filtered afterwards.** Any practice item flagged
   `format_demonstration` in `drills/schema.json` is excluded from the index entirely (FR-009), so it
   cannot leak through a query that bypasses a filter.
2. **Scaffold pages are indexed, and labelled.** A candidate searching for "context drift" should
   learn that the topic exists and its notes are unwritten, rather than getting nothing. The `status`
   metadata makes that visible in the result.
3. **The index and its runtime load on demand**, on first use of the dialog — never on first paint
   (Principle VIII, SC-007).
4. **Everything is served from the site's own origin.** No search request leaves it (FR-036).

## Interaction contract

Derived from FR-032 and FR-033, and testable as written:

| Behaviour | Requirement |
|---|---|
| Open | `Cmd+K` / `Ctrl+K` from any page, focus lands in the input |
| Navigate | `ArrowUp` / `ArrowDown` move through results; focus stays within the dialog |
| Activate | `Enter` opens the focused result |
| Dismiss | `Escape` closes and returns focus to the element that opened it |
| Empty | A query with no matches states so plainly, rather than showing an empty panel |
| No pointer required | Every step above is reachable without a mouse |
