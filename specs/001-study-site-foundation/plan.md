# Implementation Plan: Study site foundation and content pipeline

**Branch**: `001-study-site-foundation` | **Date**: 2026-09-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-study-site-foundation/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Publish the study kit as a static, account-free website built from the repository's own markdown,
with the exam structure derived from `BLUEPRINT.md` rather than retyped. The site is an Astro 7
project in `site/`, rendering `notes/`, `guide/`, `study-plans/`, and `cheatsheets/` through content
collections that point at the existing directories, so no study text is ever copied. A
standard-library Python exporter turns `BLUEPRINT.md` into a single data file that the site reads and
that the repository's existing anti-drift gate now covers, making the weighting claim enforced on the
site exactly as it already is in the notes and drills.

The dominant design constraint is that all eight domains are currently scaffolds — the repository's
own note loader yields zero authored sections — so the scaffold state is a designed page rather than
an empty one, and the site states its own coverage openly.

## Technical Context

**Language/Version**: TypeScript 5.x in `strict` mode for the site; Python 3.11+ (standard library
only, plus the existing `PyYAML` dependency) for the exporter and its gate. CI matrix stays 3.11 and
3.12; Node 22 LTS in CI, Node 24 known working locally.
**Primary Dependencies**: Astro 7 (static output), Tailwind CSS 4 via `@tailwindcss/vite`, Pagefind
for the build-time search index, Vitest for unit tests, Playwright with `@axe-core/playwright` for
end-to-end and accessibility checks. Every version pinned exactly; no runtime third-party requests.
**Storage**: `localStorage`, behind one typed module with a schema version and per-feature namespaces.
No cookies, no server, no account. Export and import as a downloaded and uploaded JSON file.
**Testing**: Vitest for the storage, recommendation, and content-status modules; Playwright for the
seven user-story journeys; axe on every page type; pytest for the exporter and the extended blueprint
gate.
**Target Platform**: Static hosting. GitHub Pages project site at `/ccdv-f-lab/`, with the base path
read from configuration so a custom domain or another host is a one-line change.
**Project Type**: Static content site with a small number of interactive islands, inside an existing
Python repository.
**Performance Goals**: LCP under 2.5s on a mid-tier mobile device over a typical mobile connection;
no layout shift when the theme is restored; search index fetched on demand, never on first paint.
**Constraints**: No account, no installation, no API key, no analytics, no tracking cookies, no
third-party runtime requests — which also rules out webfont CDNs, so fonts are self-hosted or a
system stack. WCAG 2.1 AA with full keyboard operation. Study content single-sourced: copying
markdown into `site/` fails the build.
**Scale/Scope**: 8 domain pages, 8 cheatsheets, 3 study plans, 3 guide pages, 1 blueprint explorer,
1 landing page, 1 diagnostic, 1 search surface. 25 sub-skills of structured data. Content volume
grows as notes are authored; page count does not.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against `.specify/memory/constitution.md` v1.0.0. Initial evaluation and post-design
re-evaluation both recorded; one justified complexity is tracked below.

- [x] **I. Blueprint is the source of truth** — PASS. `tools/export_site_data.py` derives
      `site/src/data/blueprint.json` from `BLUEPRINT.md`; nothing types a weight. A pytest case
      asserts the emitted data matches the blueprint, and `tools/check_blueprint_consistency.py`
      gains a check so drift fails the same gate that already guards notes and drills. The site build
      refuses a stale data file.
- [x] **II. Single-sourced content** — PASS. Content collections read `../notes`, `../guide`,
      `../study-plans`, and `../cheatsheets` in place. A `tools/check_content_single_source.py` gate
      fails the build if study prose appears under `site/`.
- [x] **III. Keyless, loginless, installless** — PASS. No account, no key, no server. Progress is
      `localStorage` only. No analytics, no cookies, no third-party runtime requests, and no webfont
      CDN. A Playwright check asserts that no request leaves the site's own origin.
- [x] **IV. Coverage is proportional to exam weight** — PASS. Navigation and the explorer order by
      weight descending; a Playwright test reads rendered dimensions and asserts no inversion across
      all 28 domain pairs.
- [x] **V. Original material only** — PASS. The site links Anthropic's guide and documentation and
      re-hosts nothing. The one practice item flagged `format_demonstration` is excluded from the
      search index. Licence and unofficial-status notices appear on every page.
- [x] **VI. Gates are non-negotiable** — PASS. `ci.yml` gains a `site` job running build, lint,
      type-check, Vitest, Playwright, and axe, alongside the unchanged Python job. Publication runs
      only when both pass.
- [x] **VII. The implementation is teaching material** — PASS. TypeScript strict; every dependency
      pinned to an exact version, which is the behaviour the Configuration Management sub-skill
      tests; the exporter is readable standard-library Python.
- [x] **VIII. Accessible and fast by default** — PASS. WCAG 2.1 AA verified by axe on every page
      type; theme applied before first paint by an inline script; Pagefind's index and WASM load on
      demand; no Pyodide anywhere in this feature.

**Post-design re-evaluation**: unchanged. The Phase 1 design introduced no new dependency and no new
runtime request. The single complexity below was identified during Phase 0 and is justified rather
than removed.

## Project Structure

### Documentation (this feature)

```text
specs/001-study-site-foundation/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   ├── blueprint-data.md      # Shape of the exported blueprint data
│   ├── progress-record.md     # Stored progress schema and its versioning rules
│   ├── search-record.md       # Typed search record, so 002 can add item types
│   └── routes.md              # Address structure, including reserved addresses
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
site/
├── astro.config.mjs             # Static output, base path from configuration, Tailwind, Pagefind
├── package.json                 # Exact versions only
├── package-lock.json            # Committed
├── .npmrc                       # save-exact=true
├── tsconfig.json                # strict
├── playwright.config.ts
├── vitest.config.ts
├── public/
│   └── fonts/                   # Self-hosted; no webfont CDN is reachable under Principle III
└── src/
    ├── content.config.ts        # Collections pointing at ../notes, ../guide, ../study-plans, ../cheatsheets
    ├── data/
    │   └── blueprint.json       # Generated by tools/export_site_data.py; never edited by hand
    ├── lib/
    │   ├── blueprint.ts         # Typed access to the exported data
    │   ├── content-status.ts    # Authored-or-scaffold status, mirroring tools/note_content.py
    │   ├── storage.ts           # The only module that touches localStorage
    │   ├── progress.ts          # Plan marks, theme, diagnostic response
    │   ├── transfer.ts          # Export and import, with validation
    │   └── recommend.ts         # Diagnostic response to plan recommendation
    ├── components/
    │   ├── DomainWeightBar.astro
    │   ├── ScaffoldNotice.astro
    │   ├── CoverageSummary.astro
    │   ├── PlanChecklist.astro  # Island
    │   ├── Diagnostic.astro     # Island
    │   ├── SearchDialog.astro   # Island
    │   └── ThemeToggle.astro    # Island
    ├── layouts/
    │   ├── BaseLayout.astro
    │   ├── ContentLayout.astro
    │   └── PrintLayout.astro
    └── pages/
        ├── index.astro
        ├── blueprint/index.astro
        ├── domains/[domain].astro
        ├── guide/[page].astro
        ├── plans/[plan].astro
        ├── cheatsheets/[domain].astro
        ├── diagnostic.astro
        ├── progress.astro
        ├── labs/index.astro             # Reserved. Each of these ships in this feature and
        ├── labs/[module].astro          # renders a short "arrives in a later feature" page with
        ├── mock/index.astro             # no runtime. contracts/routes.md is authoritative for the
        ├── mock/report.astro            # reserved set, and these file paths must produce those
        ├── flashcards/index.astro       # addresses exactly — so none of them may sit under an
        ├── domains/[domain]/quiz.astro  # extra directory segment such as `reserved/`, which would
        ├── claude-code/terminal.astro   # change the published address.
        ├── claude-code/config.astro
        └── playground.astro

tools/
├── export_site_data.py          # BLUEPRINT.md -> site/src/data/blueprint.json
└── check_content_single_source.py  # Fails if study prose is duplicated under site/

tests/
├── test_site_data_export.py     # Exported data matches BLUEPRINT.md exactly
└── test_content_single_source.py

.github/workflows/
├── ci.yml                       # Existing Python job, plus a new site job
└── pages.yml                    # Build and deploy to GitHub Pages on push to main
```

**Structure Decision**: The site is a sibling of the existing Python packages rather than a
replacement for any of them, so `lab/`, `drills/`, `tools/`, and `tests/` keep their layout and their
gates untouched. The two new Python files live in `tools/` beside the existing generators and are
tested from the existing `tests/` directory, which keeps the Python surface uniform and means the
site's data is covered by the same suite that already guards the blueprint. Content stays where it
is; `site/` holds presentation only.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| A Node and npm dependency tree in a repository that is otherwise standard-library Python | The feature is a website. Astro is what makes the eight mostly-prose pages ship zero client JavaScript, and Pagefind is what makes search work without a server — both directly serve Principles III and VIII. Every version is pinned exactly, which Principle VII treats as instructional in itself. | Generating HTML from the existing Python tooling was considered. It avoids the dependency tree but means hand-writing routing, an accessible search dialog, theme handling without a flash, and a print pipeline — more bespoke code to read and maintain than the configuration it would replace, and worse against Principle VII, which asks that the implementation read as an explanation. |
| A second content-status implementation in TypeScript (`content-status.ts`) alongside `tools/note_content.py` | The site must decide "authored or scaffold" at build time in the same way the Python tooling does, and the two run in different languages. | Shelling out to Python from the Astro build was rejected: it makes the site build depend on a Python environment being present and correctly versioned, which breaks the deploy job's isolation. The duplication is bounded to one rule and is pinned by a shared fixture test, so the two cannot drift silently. |
