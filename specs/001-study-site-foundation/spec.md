# Feature Specification: Study site foundation and content pipeline

**Feature Branch**: `001-study-site-foundation`
**Created**: 2026-09-05
**Status**: Draft
**Input**: User description: "Build a public website that turns this CCDV-F study kit into a
hands-on learning platform a candidate can use entirely in the browser: no account, no sign-in, no
local install, no API key. This first feature is the foundation and the content pipeline."

## Context that shapes this specification

Three facts about the repository's current state were verified while writing this spec, and each one
changes what "foundation" can honestly mean:

1. **Every domain note is a scaffold.** The repository's own note loader keeps a heading only when it
   has a non-heading line beneath it, and it strips the seeded `Authoring prompt:` lines. Today that
   yields **zero authored sections for all eight domains**. A requirement to "render the notes"
   therefore ships eight empty pages unless the empty state is specified as a first-class outcome.
2. **The study plans are hour-allocation tables, not task lists.** Each plan is a single eight-row
   table of hours per domain. There is nothing granular to tick off, so "interactive checklist"
   cannot mean what it usually means without new content being authored.
3. **The cheatsheets currently duplicate the blueprint explorer.** Generated from notes that have no
   authored content, each cheatsheet contains only a blueprint allocation table and a sub-skill
   table — the same information the blueprint explorer shows.

This specification treats those as design constraints to be met openly rather than problems to be
discovered during implementation.

## Clarifications

### Session 2026-09-05

- Q: Does the "find your level" diagnostic ask candidates about themselves, or test their knowledge?
  → A: Self-report in this feature, with the recommendation output defined so a later feature can
  replace the input with a scored assessment without touching plans, progress, or addresses.
- Q: Should the site publish publicly while all eight domains are still scaffolds? → A: Yes, publish
  from the first successful build, with the scaffold state labelled per domain and the overall
  coverage stated where a first-time visitor will see it.
- Q: At what granularity does a candidate mark progress against a study plan, given the plans are
  hour-allocation tables rather than task lists? → A: Per domain within a plan. Authoring per-plan
  task lists was considered and rejected as new study content.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Orient to the exam and see where the points are (Priority: P1)

A candidate who has just heard of CCDV-F opens the site and, without signing in or installing
anything, learns what the exam is, what it costs, how long it runs, what score passes, and — most
importantly — which of the eight domains actually carry the marks. They leave knowing that two
domains are roughly half the exam and two others are worth about three items combined.

**Why this priority**: This is the highest-value thing the kit knows that a candidate does not, and
it is the only story that delivers full value while the notes are still scaffolds. Everything the
page needs already exists in the blueprint.

**Independent Test**: Open the landing page and the blueprint explorer with no other page built. A
reader can state the exam facts, name the two heaviest domains, and give each domain's weight and
approximate item count without consulting another source.

**Acceptance Scenarios**:

1. **Given** a first-time visitor with no prior session, **When** they open the landing page,
   **Then** the exam facts, the readiness guidance, and the unofficial / not-affiliated disclaimer
   are visible with no sign-in, dismissal, or interaction.
2. **Given** the blueprint explorer, **When** a reader scans it, **Then** all eight domains and all
   twenty-five sub-skills appear, each labelled with its weight and approximate item count.
3. **Given** the blueprint explorer, **When** any two domains are compared, **Then** the
   higher-weighted one never occupies less than or the same visual space as the lower-weighted one,
   across all twenty-eight domain pairs.
4. **Given** any exam number shown anywhere on the site, **When** it is compared against
   `BLUEPRINT.md`, **Then** the two agree exactly.
5. **Given** the readiness guidance, **When** a candidate reads it, **Then** it is presented as the
   project's static advice and does not imply the site has scored them.

---

### User Story 2 - Open a domain and know exactly where it stands (Priority: P2)

A candidate opens a domain module. If the notes for that domain have been written, they read them —
write-up, decision tables, pitfalls, self-check — with the domain's weight visible. If the notes are
still a scaffold, they are told so plainly, shown what the domain covers according to the blueprint,
and pointed at how to contribute. They are never shown an empty page or led to believe an unwritten
domain has been covered.

**Why this priority**: This is where study time goes, and it is the story most exposed to the
scaffold problem. A domain page that renders nothing is worse than no page at all, because it implies
the material was reviewed and found thin.

**Independent Test**: Open a domain module page for a scaffolded domain. The page is complete,
useful, and unambiguous about the fact that no notes are written yet. Then author one section in that
domain's notes, republish, and confirm the page shows it.

**Acceptance Scenarios**:

1. **Given** a domain with no authored note sections, **When** the module page is opened, **Then**
   the page states that the notes are not yet written, lists that domain's sub-skills with their
   weights and what each measures, and offers a route to contribute — and does not render an empty
   body or a wall of bare headings.
2. **Given** a domain with some sections authored and others still scaffolded, **When** the module
   page is opened, **Then** the authored sections render in full and the unwritten ones are marked as
   outstanding rather than omitted silently.
3. **Given** a domain with authored decision tables, **When** the module page is opened, **Then**
   every decision table renders as a table with its "choose this when" column intact.
4. **Given** a note file is edited in the repository, **When** the site is next published, **Then**
   the corresponding module page reflects the edit with no other file changed anywhere.
5. **Given** a module page, **When** a reader looks for the domain's exam weight, **Then** the weight
   and approximate item count appear on the page.
6. **Given** a domain that the reference application does not yet demonstrate, **When** the module
   page is opened, **Then** the absence of a linked lab module is stated rather than left as a
   missing or broken link.

---

### User Story 3 - Budget study time across the domains (Priority: P3)

A candidate picks a time budget — one, three, or six weeks — and gets the hours-per-domain
allocation for it, then tracks which domains they have worked through, so they can see at a glance
where their remaining hours should go. It remembers what they have done, with no account.

**Why this priority**: Turning a static allocation table into something that holds state is the first
thing the site does that the markdown cannot. It is constrained by what the plans actually contain.

**Independent Test**: Open a plan, mark progress against domains, reload, and confirm the marks
survived — with no sign-in at any point.

**Acceptance Scenarios**:

1. **Given** a plan page, **When** a candidate opens it, **Then** the total hours, the per-domain
   hours, and each domain's exam weight are shown, ordered so the heaviest allocation reads first.
2. **Given** a plan page, **When** a candidate marks a domain's allocation as worked through,
   **Then** the mark is recorded and the proportion of the plan completed is shown in both hours and
   domains.
3. **Given** marks recorded on one plan, **When** the candidate switches to a different plan, **Then**
   their marks are not silently lost or silently transferred; the behaviour is stated on screen.
4. **Given** marks recorded, **When** the page is reloaded or reopened later in the same browser,
   **Then** the same marks are present.
5. **Given** a candidate who has not used the diagnostic, **When** they open any plan directly,
   **Then** it is fully usable with no gate in front of it.

---

### User Story 4 - Register correctly and survive exam day (Priority: P4)

A candidate about to book finds the eligibility and registration requirements — including the Partner
Network email requirement that catches people out — and, separately, what exam day permits and
prohibits. A candidate who has just failed finds the retake waiting periods, the attempt cap, and
what a re-sit costs, so they can decide whether to rebook now or study longer.

**Why this priority**: Low frequency, high consequence. Getting it wrong costs a booking, an attempt,
or a credential. The content exists and is written, so it delivers immediately.

**Independent Test**: Open the guide pages with nothing else built. A candidate can complete
registration correctly, knows what exam day requires, and can work out their retake position.

**Acceptance Scenarios**:

1. **Given** the registration page, **When** a candidate reads it, **Then** the Partner Network email
   requirement is present and visually distinguished from ordinary steps.
2. **Given** the exam-day page, **When** a candidate reads it before an appointment, **Then** the
   prohibited items, the proctoring rules, and what invalidates a result are all findable.
3. **Given** a candidate who has just failed an attempt, **When** they open the guide, **Then** the
   waiting period for their attempt number, the rolling attempt cap, and the re-sit fee are stated
   together rather than scattered.
4. **Given** the cross-map, **When** a candidate looks up a preparation module, **Then** the
   blueprint domains it covers are named using the exact domain names from `BLUEPRINT.md`.

---

### User Story 5 - Take a printable cheatsheet into the last week (Priority: P5)

A candidate in their final days opens a domain's cheatsheet and prints it, on paper, without the
site's navigation and controls in the way — and can tell at a glance whether the sheet contains
written study material or only the blueprint allocation.

**Why this priority**: Genuinely valuable late, but presently thin: with no authored notes, a review
sheet carries only what the blueprint explorer already shows. It must not be presented as a second
body of content when it is the same content in a printable form.

**Independent Test**: Print a cheatsheet, or preview its print output. The content is complete and
legible on paper, chrome is gone, and the sheet is honest about its own contents.

**Acceptance Scenarios**:

1. **Given** any cheatsheet, **When** it is printed, **Then** the study content appears in full and
   navigation, theme controls, and search controls do not.
2. **Given** the site is in dark presentation, **When** a page is printed, **Then** the printed output
   is light-on-white regardless of the on-screen theme.
3. **Given** a table that spans a page break, **When** it is printed, **Then** rows are not split
   mid-row and column headers repeat on the following page.
4. **Given** a cheatsheet for a domain with no authored notes, **When** it is opened, **Then** it
   states that it contains blueprint allocation only, and does not present itself as a summary of
   written material.
5. **Given** a printed sheet, **When** a reader checks it, **Then** the domain name, its weight, and
   the licence and unofficial-status attribution appear on the page.

---

### User Story 6 - Find any concept in seconds (Priority: P6)

A candidate who half-remembers a term — "largest remainder", "adaptive thinking", "stdio" — finds
every place the kit discusses it, using only the keyboard.

**Why this priority**: A multiplier across every other story that grows more valuable as notes fill
in, and worth little before then.

**Independent Test**: Open search by keyboard from any page, type a term, and reach the relevant page
without touching a pointing device.

**Acceptance Scenarios**:

1. **Given** any page, **When** the candidate presses the documented search shortcut, **Then** search
   opens with focus in the input.
2. **Given** an open search, **When** the candidate moves through results, **Then** focus stays within
   search, each result names the page it comes from, and each can be opened with the keyboard alone.
3. **Given** search is open, **When** the candidate dismisses it, **Then** focus returns to the
   element that opened it.
4. **Given** a query with no matches, **When** results are shown, **Then** the empty state says so
   plainly rather than showing an empty panel.
5. **Given** the practice-item bank contains an item flagged as a format demonstration, **When**
   search runs, **Then** that item never appears in results.

---

### User Story 7 - Move progress to another device (Priority: P7)

A candidate who studies on a laptop and revises on a tablet — or who is about to clear their browser
— exports their progress to a file and imports it elsewhere, with no account involved.

**Why this priority**: Without it, "no account" quietly means "your progress is disposable". Last,
because it only matters once there is progress worth keeping.

**Independent Test**: Mark progress, export, import in a different browser, confirm it appears.

**Acceptance Scenarios**:

1. **Given** recorded progress, **When** the candidate exports, **Then** a single file containing all
   of it is produced.
2. **Given** an exported file, **When** it is imported in another browser, **Then** the progress it
   contains is restored exactly.
3. **Given** an export, a full clearing of site data, and a re-import, **When** the candidate returns,
   **Then** their state matches what it was before the clearing.
4. **Given** a malformed file or one written by an incompatible version, **When** it is imported,
   **Then** the import is refused with a plain explanation and existing progress is untouched.
5. **Given** an import that would replace existing progress, **When** it runs, **Then** the candidate
   is told what will be replaced before it happens.
6. **Given** a candidate who has never exported, **When** they have recorded progress, **Then** the
   site tells them their progress lives only in this browser and can be lost.

---

### Edge Cases

- **Every domain is a scaffold.** This is the present state, not a hypothetical. All eight module
  pages, all eight cheatsheets, and search must behave well with zero authored sections.
- **A domain is partly authored.** Two of three sub-skills written, one still seeded. This mixed
  state will persist for months and must render without implying the domain is finished.
- **A note is deleted, or a domain directory is renamed.** Publication must fail rather than serve a
  missing or broken module.
- **Derived exam data goes stale.** If `BLUEPRINT.md` changes and the data the site consumes is not
  regenerated, publication must fail rather than serve numbers that disagree with the blueprint.
- **Study content is duplicated into the site tree.** Must fail the build, not review.
- **A heading is renamed.** Deep links and search results that pointed at it must be caught by a
  check against the built site, not only against the markdown sources.
- **On-device storage is unavailable, full, or cleared.** Private browsing, a locked-down browser, or
  an exceeded quota must leave every page readable, with progress features degrading to a stated
  message rather than an error.
- **Two tabs are open at once.** A candidate with a plan in one tab and a cheatsheet in another
  must not lose marks to a last-write-wins overwrite.
- **Progress written by a later version is read by an earlier one.** Refused cleanly, never partially
  applied.
- **A deep link is opened first.** Any page reached directly, with no prior visit and no progress,
  must render completely and offer a route into the site's structure.
- **Reduced motion and forced colours.** No information may be lost.
- **A wide decision table on a narrow screen.** Wide content must stay readable without the page
  scrolling sideways.
- **Non-ASCII source text.** The existing content uses typographic dashes and quotation marks
  throughout; they must survive into pages, search results, and print.

## Requirements *(mandatory)*

### Functional Requirements

**Content pipeline and blueprint fidelity**

- **FR-001**: The site MUST derive every domain name, sub-skill name, weight, and approximate item
  count it displays from `BLUEPRINT.md`. No exam number may be typed into a page or a component.
- **FR-002**: Publication MUST fail when the derived exam data no longer matches `BLUEPRINT.md`.
- **FR-003**: The repository's existing blueprint consistency gate MUST be extended to cover the
  derived data the site consumes, in the same change that introduces that data.
- **FR-004**: The site MUST render study content from the existing markdown in `notes/`,
  `cheatsheets/`, `guide/`, and `study-plans/`. Editing a source file and republishing MUST change
  the site with no other edit.
- **FR-005**: Publication MUST fail when study text from those directories has been copied into the
  site's own tree.
- **FR-006**: The site MUST determine whether a note section is authored using the repository's
  existing authored-content rule, so the site and the repository's own tooling agree on what counts
  as written material.
- **FR-007**: The site MUST show, per domain and per sub-skill, whether the material is authored or
  still a scaffold, derived from the note files rather than a hand-maintained list.
- **FR-008**: Publication MUST fail when a domain expected by the blueprint is missing, and when an
  internal link between study pages does not resolve — checked against the built site as well as the
  markdown sources, so a renamed heading cannot break a deep link silently.
- **FR-009**: Any practice item flagged as a format demonstration MUST be excluded from every
  learner-facing surface, including search.

**Pages and navigation**

- **FR-010**: The site MUST present a landing page carrying the exam facts, the readiness guidance,
  and the unofficial / not-affiliated disclaimer. The readiness guidance MUST read as static advice
  and MUST NOT imply the site has measured the candidate.
- **FR-011**: The site MUST present a blueprint explorer covering all eight domains and all
  twenty-five sub-skills with their weights and approximate item counts.
- **FR-012**: The site MUST present one module page per blueprint domain.
- **FR-013**: A domain module page with no authored sections MUST render a defined state carrying
  that domain's sub-skills, weights, and what each measures, together with a route to contribute. An
  empty body is a defect.
- **FR-014**: Authored decision tables MUST render as tables with their "choose this when" column
  preserved.
- **FR-015**: The site MUST present the eligibility and registration guidance, the exam-day guidance,
  the retake terms, and the course-to-blueprint cross-map.
- **FR-016**: The site MUST present the one-, three-, and six-week plans, showing total hours,
  per-domain hours, and each domain's weight.
- **FR-017**: The site MUST present one printable cheatsheet per domain, which MUST state when it
  contains blueprint allocation only because no notes are authored for that domain.
- **FR-018**: Navigation MUST order domains by exam weight descending and MUST show each domain's
  weight wherever domains are listed.
- **FR-019**: In the blueprint explorer, across all twenty-eight domain pairs, a higher-weighted
  domain MUST never occupy less than or equal visual space to a lower-weighted one.
- **FR-020**: The information architecture MUST reserve named, currently-empty places — in both the
  address structure and the page layout — for the interactive labs, the mock exam, flashcards, the
  terminal simulator, and the config builder, so those can be added without moving an existing page
  or breaking an existing link.
- **FR-021**: A domain module page MUST state when the reference application does not yet demonstrate
  that domain, rather than omitting or breaking the link.

**Progress, diagnostic, and search**

- **FR-022**: The site MUST let a candidate mark a plan's per-domain allocation as worked through,
  and MUST show the proportion of the plan completed in both hours and domains.
- **FR-023**: The site MUST state on screen what happens to recorded marks when the candidate moves
  between plans.
- **FR-024**: Progress MUST persist on the candidate's own device between visits, with no account and
  no server.
- **FR-025**: The stored progress record MUST carry a version marker and MUST keep each feature's
  data in its own named area, so later features can add to it without invalidating what this feature
  wrote. The site MUST refuse a record it cannot safely read rather than partially applying it.
- **FR-026**: Concurrent use in more than one tab MUST NOT silently discard marks made in another tab.
- **FR-027**: The site MUST let a candidate export all progress to a single file and import it in
  another browser, warning before an import replaces existing progress and refusing malformed or
  incompatible files without damaging what is stored.
- **FR-028**: When on-device storage is unavailable or full, every page MUST remain readable and the
  site MUST say plainly that progress cannot be saved.
- **FR-029**: The site MUST tell a candidate with recorded progress that it lives only in the current
  browser.
- **FR-030**: The site MUST offer a diagnostic that asks the candidate about themselves — their prior
  experience across the blueprint's subject areas, the weeks available before their target date, and
  their study hours per week — and MUST recommend exactly one of the three plans, stating the reason.
  It MUST NOT draw on the practice-item bank, and MUST NOT describe itself as measuring exam
  knowledge or predicting a score.
- **FR-030a**: The diagnostic MUST record its input as a self-contained response, and MUST produce
  its recommendation through a stated rule over that response, so a later feature can replace
  self-report with a scored assessment without changing the plans, the other areas of the progress
  record, or any address established here.
- **FR-031**: The diagnostic MUST be operable by keyboard and screen reader, MUST move focus to its
  result, and MUST announce the recommendation.
- **FR-032**: Every study page MUST be reachable through search, and search MUST be openable,
  operable, and dismissible by keyboard alone, returning focus to its trigger on dismissal.
- **FR-033**: Search MUST state plainly when a query has no matches.
- **FR-034**: Search MUST index a defined set of typed content records. The types populated in this
  feature are those rendered from repository sources — notes, guide pages, study plans, cheatsheets,
  and the blueprint explorer — so later features can add practice items, flashcards, and lab modules
  as further types without replacing the search surface.

**Constraints on the whole experience**

- **FR-035**: No user journey may require or offer an account, a sign-in, a local installation, or an
  API key. No page may contain a credential field.
- **FR-036**: The site MUST NOT make third-party runtime requests, load analytics or tracking, or set
  tracking cookies.
- **FR-037**: The site MUST link Anthropic's exam guide and documentation rather than reproducing
  them.
- **FR-038**: The site MUST NOT publish recalled, reconstructed, or paraphrased live exam content.
- **FR-039**: Every page MUST carry the unofficial / not-affiliated statement and the licence terms —
  code under MIT, written study content under CC BY 4.0.
- **FR-040**: The site MUST offer light and dark presentation, follow the reader's system preference
  by default, remember an explicit choice, and apply the correct one before first paint.
- **FR-041**: Every interactive element MUST be operable by keyboard with a visible focus indicator,
  and the site MUST meet WCAG 2.1 AA.
- **FR-042**: Content pages MUST produce legible printed output, forcing light presentation and
  omitting navigation, theme, and search controls.
- **FR-043**: Wide content MUST remain readable on a narrow screen without the page scrolling
  horizontally.
- **FR-044**: Non-ASCII characters present in the source content MUST render correctly in pages,
  search results, and printed output.

**Publication**

- **FR-045**: The published site MUST be produced from this repository automatically whenever the
  default branch changes.
- **FR-046**: The repository's existing keyless checks MUST continue to pass unchanged, and the
  site's own checks MUST run alongside them on every proposed change.
- **FR-047**: A failure in any of those checks MUST block publication and leave the previously
  published version in place.
- **FR-048**: A proposed change MUST be reviewable as a rendered preview before it reaches the
  default branch, so the single-sourcing rule can be confirmed by looking at the result.
- **FR-049**: The site MUST publish publicly from the first successful build, with no content
  threshold gating release. It MUST state its overall coverage — how many of the eight domains have
  authored notes — where a first-time visitor will encounter it, and MUST NOT present itself as a
  complete course while any domain remains a scaffold.

### Constitutional constraints *(mandatory — do not delete)*

- **CC-001**: Any exam structure this feature displays MUST be derived from `BLUEPRINT.md`, never
  hand-typed. Satisfied by FR-001, FR-002, FR-003.
- **CC-002**: Study content MUST be rendered from its single source; no copies in this feature's tree.
  Satisfied by FR-004, FR-005, FR-048.
- **CC-003**: The feature MUST be usable with no account, no installation, and no API key, with no
  analytics and no third-party runtime requests. Satisfied by FR-035, FR-036.
- **CC-004**: Depth and prominence MUST track published exam weights. Satisfied by FR-018, FR-019.
- **CC-005**: Practice material MUST be original, Anthropic material linked rather than re-hosted, and
  new factual claims carry dated `SOURCES.md` entries. Satisfied by FR-037, FR-038, FR-009; any new
  factual claim in site copy takes a dated `SOURCES.md` entry.
- **CC-006**: WCAG 2.1 AA with full keyboard operation, and a stated performance budget. Satisfied by
  FR-041 and FR-031, with the budget in SC-007.

### Key Entities

- **Domain**: One of the eight blueprint areas. Carries a name, weight, approximate item count,
  sub-skills, note content, a cheatsheet, an authored-or-scaffold status, and optionally a link to
  the reference application.
- **Sub-skill**: One of the twenty-five measured competencies, with its share of the exam, its
  approximate item count, its parent domain, and its own authored-or-scaffold status.
- **Study plan**: A named time budget — one, three, or six weeks — holding a total hour count and a
  per-domain hour allocation.
- **Progress record**: Everything the site remembers for one candidate in one browser: per-plan
  domain marks, theme choice, diagnostic outcome, and a version marker, divided into named areas so
  later features can extend it. Exportable and importable as one file.
- **Diagnostic response**: What the candidate reported about themselves — experience across the
  subject areas, weeks available, hours per week — together with the plan recommended and the reason
  given. Held in its own named area of the progress record, so how the recommendation is *produced*
  can change later without disturbing what depends on it.
- **Guide page**: A logistics document — eligibility and registration, exam-day rules and retake
  terms, or the course-to-blueprint cross-map.
- **Content record**: The unit search indexes. Typed, so that prose pages today and practice items
  and flashcards later share one search surface.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A candidate arriving with no prior knowledge can name the two heaviest domains and
  state any domain's weight within two minutes of landing, without leaving the site.
- **SC-002**: Every exam figure published on the site matches `BLUEPRINT.md` exactly, verified
  automatically on every proposed change rather than by reading.
- **SC-003**: No paragraph of study prose exists in two places: an automated check confirms that no
  text from the four content directories is duplicated in the site's own source.
- **SC-004**: A change to any study markdown file appears on the published site after republishing
  with no other file edited, demonstrated once for each of the four content areas.
- **SC-005**: A candidate completes the whole journey — orient, choose a plan, mark progress, print a
  cheatsheet, export, and import into a second browser — with no sign-in prompt, no installation,
  and no request for a key.
- **SC-006**: Every page type, including a domain page in its current scaffold state, returns no
  critical or serious accessibility violations, and every journey above is completable by keyboard
  alone.
- **SC-007**: The main content of any study page becomes readable within 2.5 seconds on a mid-tier
  mobile device over a typical mobile connection, with no visible shift once the theme is applied.
- **SC-008**: Publication is blocked whenever exam data drifts from the blueprint, study content is
  duplicated into the site tree, an expected domain is missing, or an internal link breaks — each
  demonstrated by a deliberate failing case, with the previously published site left in place.
- **SC-009**: All eight domain pages and all eight cheatsheets are complete and unambiguous about
  their own content while every domain is still a scaffold, and the site's overall coverage is
  visible to a first-time visitor without hunting for it — verified against the repository's current
  state, not a populated one.
- **SC-010**: The deferred features are added later with no change to the addresses or navigation
  established here, verified by filling a reserved place without moving an existing page.

## Assumptions

- The notes stay largely scaffolded while this feature is built. The site is specified to render that
  state honestly rather than to wait for content; authoring the notes is separate work.
- Generated material — the cheatsheets, and later flashcards — is produced from the notes by the
  repository's existing generators as part of publishing, so the site never shows generated content
  older than its source.
- The 85% readiness bar and the "no domain below 70%" guidance are the project's advice, not official
  rules. The only published threshold is the scaled score of 720.
- The diagnostic is self-report in this feature. It is a routing device for choosing a time budget,
  not an assessment, and the site says so where a candidate could otherwise infer that their
  knowledge has been measured.
- A candidate uses a current desktop or mobile browser. Browsers without on-device storage are
  supported only to the extent of remaining readable and saying progress cannot be kept.
- Progress is per-browser. Two browsers are two records, reconciled only through export and import.
- The plans are hour allocations rather than task lists, so progress is marked per domain within a
  plan. Authoring per-plan task lists, or generating them from domain and activity type, was
  considered and rejected: both would introduce new study content as a side effect of building a
  website, which the single-sourcing principle requires to be authored deliberately instead.
- English is the only language here. Nothing in the structure prevents a second language later.
- The reference application, the drill bank, the mock exam, flashcards, the terminal simulator, and
  the config builder are out of scope and arrive in features 002 and 003. This feature reserves their
  place and their search surface.
- The site is published from this repository; the hosting arrangement is a planning decision, not a
  requirement here.
