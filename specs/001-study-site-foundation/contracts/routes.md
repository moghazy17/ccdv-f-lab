# Contract: address structure

FR-020 requires that features 002 and 003 be addable without moving a page or breaking a link. That
makes the address structure a contract from the first publication, not an implementation detail —
every address below is a promise, including the reserved ones.

Base path defaults to `/ccdv-f-lab/` for a GitHub Pages project site and is read from configuration.
All addresses are shown relative to that base.

## Addresses in this feature

| Address | Page | Notes |
|---|---|---|
| `/` | Landing | Exam facts, readiness guidance, coverage statement, disclaimer |
| `/blueprint/` | Blueprint explorer | 8 domains, 25 sub-skills, weight-proportional |
| `/domains/` | Domain index | Ordered by weight descending |
| `/domains/<domain-slug>/` | Domain module | Slug matches the `notes/` directory, e.g. `02-applications-and-integration` |
| `/guide/eligibility/` | Registration and eligibility | Includes the Partner Network requirement |
| `/guide/exam-day/` | Exam day and retakes | |
| `/guide/course-crossmap/` | Course-to-blueprint cross-map | |
| `/plans/` | Plan index | |
| `/plans/<plan-slug>/` | A plan | `1-week`, `3-weeks`, `6-weeks` |
| `/cheatsheets/` | Cheatsheet index | |
| `/cheatsheets/<domain-slug>/` | A cheatsheet | Print-oriented |
| `/diagnostic/` | Find your level | Self-report in this feature |
| `/progress/` | Progress, export and import | |

## Reserved addresses

These resolve in this feature to a short page stating that the capability arrives in a later feature.
They carry no runtime and no placeholder interface. They exist so the navigation, the search index,
and any bookmark made today remain valid when the capability lands.

| Address | Arrives in | Reserved for |
|---|---|---|
| `/labs/` | 002 | Lab index |
| `/labs/<module-slug>/` | 002 | A runnable lab module, Pyodide loaded lazily on this address only |
| `/mock/` | 002 | Weighted 53-item mock exam |
| `/mock/report/` | 002 | Per-domain score report |
| `/flashcards/` | 002 | Flashcard review |
| `/domains/<domain-slug>/quiz/` | 002 | Per-domain self-check quiz |
| `/claude-code/terminal/` | 003 | Terminal simulator |
| `/claude-code/config/` | 003 | `CLAUDE.md` and `settings.json` builder |
| `/playground/` | 003 | Free-form playground |

## Rules

1. **Slugs come from the repository, not from prose.** A domain's slug is its `notes/` directory
   name; a plan's slug is its filename. A rename in either place is a deliberate, breaking change.
2. **Trailing slashes are consistent** across every address, so a link written by hand and a link
   generated from data resolve identically.
3. **Reserved addresses ship in this feature.** An address introduced later would break FR-020's
   promise, because the navigation and search index would both have to change to accommodate it.
4. **The base path is configuration.** No page, component, or link helper hard-codes `/ccdv-f-lab/`.
   The literal appears exactly once, as the default for the `BASE` environment variable in
   `astro.config.mjs`, so a custom domain or another host is a one-line change. Every internal link
   is built from Astro's configured base rather than written out.
5. **Internal links are verified against the built site**, not only against the markdown, so a
   renamed heading cannot silently break a deep link (FR-008).

## Layout regions reserved alongside the addresses

The domain module layout defines two regions that render nothing in this feature:

- **`lab`** — where a domain's runnable lab modules will be listed. Renders the FR-021 statement
  today, since domains 1, 3, and 8 have no lab module at all.
- **`practice`** — where the per-domain quiz and drill count will appear in 002.

Reserving the regions, not just the addresses, is what keeps 002 from restructuring the page that
candidates will already have been reading.
