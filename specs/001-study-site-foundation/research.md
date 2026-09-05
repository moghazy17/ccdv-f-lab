# Phase 0 research: Study site foundation and content pipeline

Every unknown in the plan's Technical Context is resolved here. Decisions that carry real risk are
recorded with the risk and the fallback, rather than as settled facts.

## 1. Reading study markdown from outside the site directory

**Decision**: Astro 7 content collections defined in `site/src/content.config.ts`, each using the
`glob()` loader from `astro/loaders` with a `base` that points at the repository directory —
`../notes`, `../guide`, `../study-plans`, `../cheatsheets`. No study markdown is copied into `site/`.

**Rationale**: This is the single decision that makes Principle II enforceable rather than aspirational.
The collection reads the file that the repository already treats as the source, so an edit to a note
cannot fail to reach the site, and there is no second copy to fall out of date.

**Risk and fallback**: A loader `base` outside the Astro project root is outside Vite's default
filesystem allow-list, which can surface as a dev-server read refusal even when the production build
succeeds. Mitigation: set `vite.server.fs.allow` to include the repository root in `astro.config.mjs`.
If a future Astro version tightens this further, the fallback is a small custom loader that reads the
files directly with Node's `fs` at build time — still no copy, still one source. The build must be
proven against the real directories in CI, not only locally, so this risk surfaces immediately.

**Alternatives considered**: Copying markdown into `site/src/content/` at build time — rejected, it
recreates the duplication the constitution forbids and makes the "did anyone edit the copy?" question
permanent. A git submodule or symlink — rejected as fragile on Windows, which is the maintainer's
platform.

## 2. Deriving the exam structure from the blueprint

**Decision**: `tools/export_site_data.py`, standard library only, parses the domain and sub-skill
tables in `BLUEPRINT.md` and writes `site/src/data/blueprint.json`. A pytest case asserts the emitted
data matches `BLUEPRINT.md` exactly, and `tools/check_blueprint_consistency.py` gains a check that
fails when the committed JSON is stale. `astro.config.mjs` additionally fails the build if the file
is missing or its recorded source digest does not match the current `BLUEPRINT.md`.

**Rationale**: Principle I requires that the site's numbers be derived and gated, not merely correct
on the day they were written. Putting the check inside the existing consistency tool means one gate
guards notes, drills, the README table, and now the site.

**Alternatives considered**: Parsing `BLUEPRINT.md` from TypeScript at build time — rejected, it puts
the authoritative parse in two languages and leaves the Python gate blind to the site. Committing a
hand-written JSON file — rejected outright by Principle I.

## 3. Search without a server

**Decision**: Pagefind, run against the built output as a post-build step, with a keyboard-first
dialog opened by Cmd/Ctrl+K. The index and its WASM are fetched on first use, never on first paint.

**Correction worth recording**: Pagefind is not built into Astro. It is a separate tool that indexes
*built HTML*, wired either through the community `astro-pagefind` integration or a `postbuild` script
invoking the Pagefind CLI against `dist/`. This plan uses the explicit `postbuild` script, so the
dependency is visible in `package.json` rather than hidden behind an integration, which suits a
repository read as teaching material.

**Rationale**: A build-time index is the only search approach that satisfies "no server, no
third-party runtime request" while still covering full prose. Because it indexes rendered HTML, it
automatically covers whatever the notes grow into without an indexing pipeline of its own.

**Consequence for feature 002**: Pagefind indexes pages, not records. Spec FR-034 requires a typed
search record so practice items and flashcards can join later. This is satisfied by giving every
indexed page an explicit record type attribute that Pagefind captures as filterable metadata, so 002
adds new types rather than replacing the search surface. The contract is in
`contracts/search-record.md`.

**Alternatives considered**: A client-side index built by the site itself — rejected, it grows
linearly with content and lands on the critical path. A hosted search service — rejected by
Principle III.

## 4. Detecting authored versus scaffold content

**Decision**: `site/src/lib/content-status.ts` implements the same rule as
`tools/note_content.py`: strip lines beginning `Authoring prompt:`, then treat a heading as authored
only when a non-heading, non-empty line follows it. A shared fixture, checked by both a pytest case
and a Vitest case, pins the two implementations to identical answers.

**Rationale**: The site must not disagree with the repository's own tooling about what counts as
written material, because the coverage statement required by FR-049 depends on that judgement. This
duplication is deliberate and bounded, and is recorded in the plan's Complexity Tracking.

**Alternatives considered**: Invoking Python during the Astro build — rejected, it makes the deploy
job depend on a correctly-versioned Python environment and couples two toolchains that are otherwise
independent. Exporting the status from Python into the blueprint data file — rejected because the
status depends on note content that changes independently of the blueprint, so it belongs to the
content pipeline rather than the blueprint export.

## 5. Progress storage and its forward compatibility

**Decision**: One module, `site/src/lib/storage.ts`, is the only code that touches `localStorage`.
The stored value is a single versioned envelope with a namespace per feature, so feature 002 writes
under its own key without touching what 001 wrote. All reads are wrapped so a refusal or a quota
failure degrades to a stated message rather than an exception. Cross-tab consistency uses the browser
`storage` event so a second tab does not overwrite the first. The full schema is in
`contracts/progress-record.md`.

**Rationale**: Spec FR-025 and FR-026 make this a user-facing promise, not an implementation detail:
progress must survive the next release and must not be lost to a second tab.

**Alternatives considered**: IndexedDB — rejected as more machinery than a few kilobytes of marks
needs. A key per concern — rejected, it makes export, import, and version migration read from an
open-ended set of keys.

## 6. Theme without a flash

**Decision**: A small inline script in `<head>` reads the stored preference and sets an attribute on
the document element before first paint; CSS keys off that attribute and off
`prefers-color-scheme` for the default. The toggle updates both the attribute and storage.

**Rationale**: SC-007 requires no visible shift when the theme is applied. Any approach that waits
for a module to load repaints in the wrong theme first.

## 7. Print behaviour

**Decision**: A print stylesheet forces light presentation regardless of the active theme, hides
navigation, theme, and search controls, sets `break-inside: avoid` on table rows, and repeats table
headers with `thead { display: table-header-group }`. Every content page gets it, not only the
cheatsheets.

**Rationale**: Spec US5 scenarios 2 and 3 make dark-theme printing and mid-table page breaks explicit
acceptance criteria, both of which are silent failures otherwise.

## 8. Styling and fonts

**Decision**: Tailwind CSS 4 through the `@tailwindcss/vite` plugin, not the older
`@astrojs/tailwind` integration, which is superseded for Tailwind 4. Fonts are self-hosted under
`site/public/fonts/` or a system stack.

**Rationale**: Principle III forbids third-party runtime requests, which rules out a webfont CDN.
This is easy to violate accidentally, so a Playwright assertion that no request leaves the origin is
part of the test set rather than a review convention.

## 9. Deployment and base path

**Decision**: A separate `.github/workflows/pages.yml` builds `site/` and deploys to GitHub Pages on
push to `main`, using `actions/upload-pages-artifact` and `actions/deploy-pages` with `pages: write`
and `id-token: write` permissions. `astro.config.mjs` reads `site` and `base` from environment
variables with defaults of `https://moghazy17.github.io` and `/ccdv-f-lab/`, so a custom domain or a
different host is a one-line change. Deployment runs only after the gate job passes; a failure leaves
the previously published site in place, satisfying FR-047.

**Rationale**: The repository name is `ccdv-f-lab`, so a project page is served from a sub-path.
Getting `base` wrong is the classic GitHub Pages failure, and it breaks every asset and internal link
at once, so it is configuration rather than a constant.

**Alternatives considered**: Deploying from the existing `ci.yml` — rejected, it mixes a matrixed
test job with a single-deploy job and makes the permissions broader than the tests need.

## 10. CI shape

**Decision**: `ci.yml` keeps its existing Python steps unchanged, on the 3.11 and 3.12 matrix, and
gains a second `site` job on Node 22 LTS running install, type-check, lint, build, Vitest, then
Playwright with axe against the built output. Both jobs run on pull requests and pushes.

**One check moves.** FR-008 requires internal links to be verified against the *built* site, and the
single-source check is clearest once the build has run. Both therefore execute in the `site` job
after the build, not in the Python job, which runs before any build exists. The Python job's own
`tools/check_links.py` step stays as it is, checking the markdown sources.

**Rationale**: The existing eight Python steps are the project's proof that it stays honest; nothing
here should perturb them. Keeping the site in its own job means a JavaScript failure reports as a
JavaScript failure.

**Note on Node versions**: the maintainer's machine runs Node 24; CI pins 22 LTS. Both are supported
by Astro 7, and pinning the lower of the two in CI is the safer default. `.nvmrc` records the version
so the two do not drift silently.

## 11. Dependency pinning

**Decision**: `.npmrc` sets `save-exact=true`, `package.json` carries exact versions with no range
prefixes, and `package-lock.json` is committed. CI installs with `npm ci`.

**Rationale**: Principle VII names version pinning as instructional, and the Configuration Management
sub-skill (4.1% of the exam) tests exactly this. A caret range in a repository that teaches pinning
would be a visible contradiction.

## 12. Items deferred from clarification

Both items the clarification session deferred are resolved here rather than left open.

- **Offline behaviour**: no service worker in this feature. Ordinary HTTP caching already keeps
  retrieved pages usable, which is all FR-043's neighbouring requirement asks for. A service worker
  introduces a cache-invalidation surface that would need its own tests, and it is better considered
  once Pyodide arrives in feature 002 and there is a large runtime genuinely worth caching.
- **External link durability**: unchanged in this feature. `tools/check_links.py` deliberately skips
  external links, and the site links Anthropic's material rather than re-hosting it. FR-008 adds
  checking of *internal* links against the built output, which is the failure mode this feature can
  actually create by renaming a heading.
