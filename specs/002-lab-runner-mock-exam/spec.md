# Feature Specification: Lab runner, weighted mock exam, and practice modes

**Feature Branch**: `002-blueprint-guard-and-frontmatter`
**Created**: 2026-09-06
**Status**: Draft
**Input**: User description: "Add the interactive layer to the study site: real, hands-on practice
that still needs no install and no API key. Run this repository's actual Python in the browser via
Pyodide, lazily loaded only on pages that need it and never on the critical path. Ship the lab/ and
drills/ packages into the Pyodide virtual filesystem, force the mock transport so nothing can make a
network call or require an ANTHROPIC_API_KEY, and give each lab an editable code pane, a Run
control, real output, and a link back both to the matching note and to the source file in the
repository. […] Add a weighted mock exam that reproduces the same largest-remainder apportionment as
drills/engine — 17 / 9 / 8 / 6 / 6 / 4 / 2 / 1 across the eight domains for a 53-item mock — with a
120-minute timer, a score report showing percent-correct per domain the way the real report does, an
explanation shown for every wrong answer, and the readiness bar applied. […] Add per-domain
self-check quizzes on the module pages and a flashcard mode driven by flashcards/ccdv-f.tsv with
lightweight spaced repetition. All progress stays local to the browser and joins the existing
exportable progress file."

## Context that shapes this specification

Four facts about the repository's current state were verified while writing this spec. Each one
changes what "interactive layer" can honestly mean, and each is treated as a design constraint to be
met openly rather than a problem to be discovered during implementation.

1. **The practice-item bank is empty for learner purposes.** `drills/bank/` holds exactly one file,
   and it carries `format_demonstration: true` — the flag that feature 001 excludes from every
   learner-facing surface. The bank supplies **zero** eligible items today, against the 53 a full
   weighted mock needs. This feature therefore includes authoring an original item bank; that
   authoring is the precondition for the mock exam, not a follow-on to it.
2. **Seven of eight domains have no authored notes.** Only *Model Selection and Optimization*
   carries written sections. Every lab links back to a note, and every module page hosts a quiz, so
   both must render correctly against a scaffolded note the way feature 001 established.
3. **Flashcards cover one domain.** `flashcards/ccdv-f.tsv` is generated from the notes by
   `tools/build_flashcards.py` and currently holds 30 cards, all from the one authored domain. A
   flashcard mode must be honest about that coverage rather than presenting itself as covering the
   exam.
4. **The reference application is complete and is the strongest material the kit has.** `lab/`
   already demonstrates pinned model versions, adaptive thinking, structured output, tool use and
   dispatch, an MCP server, prompt caching, the batch path, guardrails, and an eval harness that
   attributes a failure to the integration layer or to the model. Running it is the one story that
   delivers full value on the day it ships.

Feature 001 reserved the addresses this feature fills — `/labs/`, `/labs/<module>`, `/mock/`,
`/mock/report`, `/domains/<domain>/quiz/`, and `/flashcards/` — and reserved a versioned, namespaced
progress record for it to extend. This feature fills those places without moving an existing page.

## Clarifications

### Session 2026-09-06

- Q: `drills/bank/` holds one item and it is the excluded format demonstration. What does this
  feature deliver? → A: A full bank. Author enough original items to fill one complete 53-item mock
  at the exact weighted quotas (17 / 9 / 8 / 6 / 6 / 4 / 2 / 1), including the seventeen for a
  domain whose notes are still a scaffold. Shipping only the machinery over an empty bank, and
  shipping a small per-domain seed set, were both considered and rejected: a mock exam that cannot
  assemble a mock is not a mock exam.
- Q: Feature 001 reserved `/labs/<module>` addresses enumerated from top-level `lab/*.py` files, and
  the nine named concepts do not map one-to-one onto them. What is a lab module? → A: One lab per
  runnable unit — the eleven top-level modules plus the `mcp_server` and `evals` packages, thirteen
  in all — each labelled with the concept it demonstrates. This keeps every address feature 001
  established and still reaches the two packages the concept list needs.
- Q: Domain notes already carry a `Self-check` section of open recall questions. What is the
  per-domain quiz? → A: Both, kept distinct. The notes' recall prompts render as self-graded reveal
  cards; the domain's bank items render as a separately scored quiz. Only the scored quiz
  contributes to any readiness signal, and the page says so.
- Q: The deck has no stable card identity — 30 cards carry only 9 distinct fronts, and front plus
  domain plus sub-skill collides four ways because a front is emitted once per note file. How is a
  card identified across a regeneration? → A: The generator gives every card a stable identifier and
  writes it as a tag line in the card's back, alongside the `Domain:` and `Sub-skill:` tags it
  already appends. The two-column format is preserved, so the deck stays importable elsewhere, and
  review history survives an edit to a card's prose. A content hash of front and back, and the
  card's position in the generated deck, were both considered and rejected: the first discards
  history on every wording change, the second moves history onto a neighbouring card whenever one is
  inserted or removed.
- Q: A stored attempt carries a snapshot of its items — measured at roughly 84 KB for 53 items, so
  about 61 attempts would fill a typical 5 MB origin quota, and fewer once lab edits and flashcard
  state share it. How much mock history does the browser keep? → A: The three most recent attempts
  in full; older ones collapse to a per-domain score summary that keeps the trend, with their
  reports stating that item-level detail is no longer held. Keeping every attempt until storage runs
  out, and keeping only identifiers and re-rendering old reports from the current bank, were both
  considered and rejected: the first makes exhaustion a matter of time, the second shows a past
  answer against item text that may since have changed.
- Q: How many items does a domain quiz ask for? → A: That domain's mock quota — 17, 9, 8, 6, 6, 4,
  2, 1 — derived from the blueprint like every other exam figure. The quizzes are then visibly
  unequal in the way the weights are, and the quiz keeps a stable length as the bank grows, with any
  surplus becoming variety between sittings. A fixed small number for every domain, and every item
  the domain holds, were both considered and rejected: the first flattens the weighting the site
  exists to show, the second lengthens without limit.

### Session 2026-09-08

- Q: Does a mock's countdown keep running while the attempt is not on screen? → A: Yes, it
  is wall-clock, which is the honest simulation of a timed exam. Returning after the limit
  shows the attempt as expired and lets the candidate score it as it stood or discard it,
  so a mock nobody actually sat never occupies one of the three full-detail retention
  slots. Expiry while the candidate is present still submits and scores. Pausing the clock
  whenever the tab is closed was considered and rejected: it measures something the exam
  does not.
- Q: FR-010 said the code pane restores "the repository's current source for that module". Does
  that work? → A: No, and it is corrected. No module in `lab/` carries a `__main__` block, so its
  source would run and print nothing. The pane is seeded with a short demonstration that imports
  the module and exercises its real API; the module's own source stays one link away under FR-013.
  The Python that executes is still the repository's, imported from the shipped packages, so FR-001
  is untouched.
- Q: `lab/` and `drills/` import three third-party packages — `jsonschema` and `PyYAML`, both
  pure Python, and `mcp`, whose `FastMCP` brings pydantic, anyio, httpx and a web-server
  stack that an in-browser runtime may not be able to load, and which has no transport to
  serve over inside a tab. What happens to a lab the runtime cannot satisfy? → A: It stays a
  page, showing its source read-only with the concept explained, saying plainly why it does not
  run here and how to run it locally. Which labs those are is determined by what actually
  loads rather than assumed. A maintained list of runnable labs, and requiring all thirteen to
  run whatever the payload, were both considered and rejected: the first goes stale silently,
  the second would carry a web-server stack into the browser to run something that cannot
  serve there.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run the reference application and watch it work (Priority: P1)

A candidate opens a lab module, reads the concept it demonstrates, edits the code in front of them,
presses Run, and sees the real output that this repository's own Python produces — no install, no
key, no account. When they want to see how the piece fits the whole, they follow one link to the
note that explains it and another to the source file in the repository.

**Why this priority**: It is the only story that delivers its full value on the day it ships,
because the code it runs is already written and already tested. It is also the story that proves the
kit's central claim — that the implementation is the teaching material.

**Independent Test**: Open one lab module with nothing else built. Run the unmodified code, see real
output, change a value, run again, see the output change, and reach both the note and the source
file from that page.

**Acceptance Scenarios**:

1. **Given** a lab module page, **When** it first loads, **Then** the concept it demonstrates, the
   code, the Run control, and the two links are present, and the runtime has not been fetched.
2. **Given** a lab module page, **When** the candidate presses Run for the first time, **Then** the
   runtime is fetched, its progress is reported while it loads, and the code's real output —
   standard output, standard error, and a full traceback when it raises — is shown.
3. **Given** a lab that has run once, **When** the candidate edits the code and runs it again,
   **Then** the output reflects the edited code and the previous output is replaced rather than
   appended to indefinitely.
4. **Given** edited code, **When** the candidate asks to restore it, **Then** the pane returns to
   the demonstration it was seeded with, and the module's own source stays one link away.
5. **Given** code that attempts a network call or reads an API key from the environment, **When** it
   runs, **Then** it fails with a clear message naming the mock transport, and no request leaves the
   browser.
6. **Given** code that does not terminate, **When** it runs, **Then** the page stays responsive, the
   candidate can stop it, and the runtime is usable afterwards without reloading the page.
7. **Given** a lab whose domain's notes are still a scaffold, **When** the page is opened, **Then**
   the link to the note states that the note is not yet written rather than leading to an empty
   page.
8. **Given** the source-file link, **When** it is followed, **Then** it opens the file in the
   repository at the path the lab actually ran.
9. **Given** a lab whose dependencies the runtime cannot load, **When** its page is opened, **Then**
   its source is shown read-only with the concept explained and the reason it does not run here,
   and no Run control is offered.

---

### User Story 2 - Sit a full weighted mock and find out where the gaps are (Priority: P2)

A candidate sits a 53-item mock whose items are distributed across the eight domains exactly as the
exam's published weights distribute them, under a 120-minute timer. At the end they get percent
correct per domain the way the real score report gives it, an explanation on every item they got
wrong, and a plain readiness verdict against the project's stated bar.

**Why this priority**: It is the highest-value thing the kit can tell a candidate about themselves,
and the single most requested capability. It is second only because it depends on an item bank that
must be written first.

**Independent Test**: Start a mock, answer every item, submit, and read a report that names each
domain's percent correct, explains every wrong answer, and states readiness — then confirm the
domain counts against the repository's own drill engine.

**Acceptance Scenarios**:

1. **Given** the mock exam page, **When** a candidate starts a mock, **Then** it contains exactly
   the number of items the blueprint states, distributed across the eight domains in the same counts
   the repository's drill engine produces for that size.
2. **Given** a mock in progress, **When** the candidate looks at the timer, **Then** the time
   remaining is visible, is announced to assistive technology at meaningful intervals rather than
   continuously, and counts down from the limit the blueprint states.
3. **Given** a mock in progress, **When** the candidate moves between items, **Then** they can
   revisit and change any earlier answer, and can see which items are still unanswered.
4. **Given** a mock in progress, **When** the page is reloaded or the browser is closed and
   reopened, **Then** the attempt, the answers so far, and the remaining time are restored rather
   than lost.
5. **Given** an attempt open on screen, **When** the timer reaches zero, **Then** the attempt is
   submitted and scored as it stands, and the report says the time ran out.
6. **Given** an attempt whose time ran out while the candidate was away, **When** they return,
   **Then** it is shown as expired and they choose whether to score it as it stood or discard
   it, and it is neither scored nor retained until they do.
7. **Given** a submitted attempt, **When** the report is shown, **Then** it gives overall percent
   correct, percent correct for each of the eight domains, and states that per-domain figures are
   informational in the same way the real report does.
8. **Given** an item answered incorrectly, **When** the report is read, **Then** an explanation is
   shown for it, covering why the correct options are correct.
9. **Given** an item with more than one correct option, **When** it is scored, **Then** it counts as
   correct only when the selected set matches the correct set exactly, with no partial credit.
10. **Given** a completed attempt, **When** readiness is stated, **Then** it reads as met only when
    overall correctness is at least 85% and no domain falls below 70%, and it is withheld with a
    reason when any domain had no item.
11. **Given** any scaled-score figure the report shows, **When** it is read, **Then** it is labelled
    an estimate, its assumption is stated, and it does not present itself as a prediction of the
    real exam.
12. **Given** the bank, **When** any mock is assembled, **Then** no item flagged as a format
    demonstration appears in it.
13. **Given** a report, **When** it is printed, **Then** the per-domain figures and the explanations
    print legibly without the site's navigation.

---

### User Story 3 - Check one domain before moving on (Priority: P3)

A candidate finishing a domain wants to know whether it has stuck before they spend their next hours
elsewhere. On the module page they answer the domain's recall prompts from memory and grade
themselves, then take the domain's scored quiz and see how they actually did — with the page making
clear which of the two counts.

**Why this priority**: It is where study time is actually spent, and it turns the mock's verdict
from a single late event into a running signal. It reuses the mock's scoring, so it costs little
once the mock exists.

**Independent Test**: Open a module page for the one domain with authored notes, work through both
the recall prompts and the scored quiz, and confirm the results are recorded and distinguishable.

**Acceptance Scenarios**:

1. **Given** a module page for a domain with authored notes, **When** it is opened, **Then** the
   notes' recall prompts appear as cards that reveal on request and accept a self-grade, and the
   domain's scored quiz appears separately.
2. **Given** both are present, **When** the candidate reads the page, **Then** it states plainly
   that only the scored quiz contributes to a readiness signal.
3. **Given** the scored quiz, **When** it is completed, **Then** each wrong answer carries the same
   explanation the mock report gives, and the domain's percent correct is shown.
4. **Given** a domain whose notes are a scaffold, **When** the module page is opened, **Then** the
   recall section states that no prompts are written yet, and the scored quiz still works from that
   domain's bank items.
5. **Given** a domain with fewer bank items than the quiz asks for, **When** the quiz is started,
   **Then** it runs with the items that exist and says how many it had.
6. **Given** completed quizzes across several domains, **When** the candidate looks at their
   progress, **Then** the per-domain results are visible together.

---

### User Story 4 - Drill the recall items until they hold (Priority: P4)

A candidate with ten spare minutes works a flashcard deck, marks each card as known or not, and
finds that the cards they miss come back sooner than the cards they know. The deck is honest about
how much of the exam it currently covers.

**Why this priority**: High-frequency, low-effort study that fits the gaps in a day. It ranks below
the scored surfaces because its content presently covers one domain of eight.

**Independent Test**: Review a deck, mark some cards known and some not, return later, and confirm
that the missed cards are scheduled ahead of the known ones.

**Acceptance Scenarios**:

1. **Given** the flashcard page, **When** it is opened, **Then** it states which domains the deck
   currently covers and which it does not.
2. **Given** a card, **When** the candidate reveals it and marks it known or not known, **Then** the
   next card follows without a page change, and the mark is recorded.
3. **Given** a card marked not known, **When** the candidate returns to the deck, **Then** that card
   is due before cards they marked known.
4. **Given** a session where every due card has been reviewed, **When** the deck is exhausted,
   **Then** the page says so and states when the next cards fall due.
5. **Given** a note is edited and the deck is regenerated, **When** the site is republished,
   **Then** the deck reflects the edit, and every card whose identifier survived keeps its review
   history — including the card whose own wording changed.
6. **Given** the whole deck, **When** it is used, **Then** every action is available from the
   keyboard with the shortcuts stated on the page.

---

### User Story 5 - Keep everything, and take it to another device (Priority: P5)

A candidate who has run labs, sat mocks, taken quizzes, and worked flashcards exports one file and
imports it on another device, and finds all of it there. Nothing asked for an account at any point.

**Why this priority**: Without it, "no account" quietly means the mock results a candidate has spent
two hours earning are disposable. It ranks last among the learner stories because it only matters
once there is something worth keeping.

**Independent Test**: Produce results across every new surface, export, import into a second
browser, and confirm each surface shows the same state.

**Acceptance Scenarios**:

1. **Given** results across labs, mocks, quizzes, and flashcards, **When** the candidate exports,
   **Then** one file carries all of them alongside the progress feature 001 already stored.
2. **Given** that file, **When** it is imported into another browser, **Then** every surface shows
   the same state, including flashcard scheduling and past mock reports.
3. **Given** a file written by an incompatible version, **When** it is imported, **Then** it is
   refused with a plain explanation and nothing already stored is changed.
4. **Given** on-device storage that is unavailable or full, **When** any of these surfaces is used,
   **Then** the page stays usable, says plainly that results cannot be saved, and does not lose the
   attempt in progress on screen.
5. **Given** a mock in progress in one tab, **When** another tab records a quiz result, **Then**
   neither discards the other's work.
6. **Given** stored results, **When** the candidate asks to clear them, **Then** they can clear the
   practice results without discarding the plan and diagnostic progress from feature 001.

---

### User Story 6 - Contribute an original practice item (Priority: P6)

A contributor writes one original item from the public blueprint, validates it with the repository's
existing command, and sees it appear in mocks and in its domain's quiz on the next publication —
without touching the site.

**Why this priority**: It is what keeps the bank growing after this feature lands, and it is the
guard that keeps recalled exam content out. It is last because the feature ships with a bank already
written.

**Independent Test**: Add one item file, run the repository's validation, republish, and find the
item in its domain's quiz.

**Acceptance Scenarios**:

1. **Given** a new item file placed in its domain's directory, **When** the repository's validation
   runs, **Then** it is accepted only if its domain and sub-skill match `BLUEPRINT.md` exactly, it
   has the required options, a rationale on every option, a trap type on every incorrect option, and
   at least one dated source.
2. **Given** an accepted item, **When** the site is republished, **Then** it can appear in a mock
   and in its domain's quiz with no site file edited.
3. **Given** an item flagged as a format demonstration, **When** the site is republished, **Then**
   it appears in no learner-facing surface.
4. **Given** an item that fails validation, **When** publication runs, **Then** publication fails
   rather than serving a malformed item.

---

### Edge Cases

- **A lab's dependencies cannot be loaded.** The page must say so and show the source, rather
  than offering a Run control that raises an import error.
- **The runtime cannot be fetched.** Offline, blocked, or interrupted mid-download. The lab page
  must stay readable, state what happened, and offer a retry without losing the candidate's edits.
- **The runtime loads slowly.** On a slow connection the first Run may take tens of seconds.
  Progress must be reported and the wait must be interruptible.
- **Learner code runs forever, allocates without bound, or crashes the interpreter.** The page must
  remain responsive and recoverable in each case.
- **Learner code tries to reach the network or read a credential.** Must fail structurally, not by
  convention, and must say why.
- **Learner code prints an enormous amount of output.** Output must be bounded with the truncation
  stated, rather than freezing the page.
- **A mock is started with an undersupplied domain.** If any domain's bank falls below its quota,
  the mock must state the shortfall per domain and must not silently substitute items from
  elsewhere.
- **The bank holds exactly the quota.** Every attempt then draws the same items, so repeated
  attempts measure recall of the bank rather than of the domain. The site must say so rather than
  implying fresh items.
- **A mock is abandoned.** An attempt left for days comes back expired, with the choice to score or
  discard it — never silently resumed with a timer that has run to zero unnoticed, and never
  scored into the retention slots on the candidate's behalf.
- **Two tabs run the same mock.** Answers must not be lost to a last-write-wins overwrite.
- **Storage fills during an attempt.** The attempt on screen must survive to submission and the
  candidate must be told the result cannot be stored.
- **An item is removed or rewritten between attempts.** A stored report must still render, showing
  the items as they were when answered.
- **A report ages past the retention limit.** Its per-domain scores must survive and the report must
  say that item-level detail is no longer held, rather than vanishing or rendering an empty item
  list.
- **A quiz for a two-item or one-item domain.** *Claude Code* and *Eval, Testing, and Debugging*
  carry roughly two and one items. Their quizzes must read as deliberately short, not as broken.
- **The flashcard deck is regenerated with cards removed.** Review history for a card that no longer
  exists must not resurrect it or corrupt the schedule.
- **Non-ASCII output.** The content uses typographic dashes and quotation marks; program output,
  explanations, and printed reports must render them correctly.
- **Reduced motion and forced colours.** Timers, card flips, and progress indicators must lose no
  information.
- **A narrow screen.** The code pane, its output, and wide item options must remain usable without
  the page scrolling sideways.

## Requirements *(mandatory)*

### Functional Requirements

**The in-browser runtime**

- **FR-001**: Lab code MUST execute this repository's actual `lab/` and `drills/` Python. The site
  MUST NOT hold its own copy of that source; it MUST be taken from the repository at publication
  time, and publication MUST fail if a copy is introduced into the site's own tree.
- **FR-002**: The runtime MUST NOT be fetched on any page that does not need it, and MUST NOT be
  fetched on a lab page until the candidate acts. Every page's first render MUST be unaffected by
  the runtime's existence.
- **FR-003**: The runtime and everything it loads MUST be served from the site's own origin. No
  third-party runtime request is permitted.
- **FR-004**: Executed code MUST NOT be able to make a network request, and MUST NOT be able to
  obtain an API key from the environment. This MUST be enforced by the execution environment itself
  rather than by the code under execution choosing not to.
- **FR-005**: The lab transport MUST be the repository's existing mock transport, and code that
  requests the real transport MUST fail with a message that names the mock transport and explains
  why.
- **FR-006**: Execution MUST NOT block the page. A run MUST be stoppable by the candidate, and a run
  that does not terminate MUST leave the page responsive and the runtime reusable.
- **FR-007**: Output MUST include standard output, standard error, and the full traceback of an
  uncaught exception. Output MUST be bounded, and truncation MUST be stated where it occurs.

**Lab modules**

- **FR-008**: The site MUST present one lab module for each runnable unit of the reference
  application: each top-level module in `lab/`, plus the MCP server package and the eval harness
  package.
- **FR-009**: Every lab module MUST name the concept it demonstrates. The concepts the reference
  application already demonstrates — pinned model versions, adaptive thinking, structured output,
  tool use and dispatch, the MCP server, prompt caching, the batch path, guardrails, and the eval
  harness that attributes a failure to the integration layer or to the model — MUST each be
  reachable from the labs index.
- **FR-010**: Every lab module the runtime can satisfy MUST offer an editable code pane, a Run
  control, and a way to restore the pane to its starting state. The pane MUST be seeded with a
  short demonstration that imports the module and exercises its real API, not with the module's
  own source: no module in `lab/` carries a `__main__` block, so its source would run and print
  nothing. The code that executes is still the repository's, imported from the shipped packages.
- **FR-011**: A lab module whose dependencies the runtime cannot satisfy MUST still be a page.
  It MUST show its source read-only, name the concept it demonstrates, state plainly that it does
  not run in the browser and why, and say how to run it locally. It MUST NOT offer a Run control
  that fails, and MUST NOT be omitted from the labs index.
- **FR-012**: Which lab modules run MUST be determined by what the runtime actually satisfies
  at publication time, not by a hand-maintained list, so a lab that gains or loses the ability to
  run changes state without anyone editing a roster.
- **FR-013**: Every lab module MUST link to the note for the domain it belongs to, and to its source
  file in the repository. Publication MUST fail if either target does not exist.
- **FR-014**: When the linked note is still a scaffold, the lab MUST say so rather than presenting a
  link to an empty page.
- **FR-015**: The addresses feature 001 reserved for labs MUST continue to resolve. No address
  established there may be moved or removed by this feature.
- **FR-016**: A candidate's edits to a lab's code MUST persist on their device between visits and
  MUST be discardable per module.

**The item bank**

- **FR-017**: This feature MUST add original practice items sufficient to assemble a full weighted
  mock at the blueprint's stated size — at least the per-domain quota for every one of the eight
  domains.
- **FR-018**: Every item MUST be original, written from the public blueprint. Recalled,
  reconstructed, or paraphrased live exam content MUST NOT be added, in any form.
- **FR-019**: Every item MUST carry the exact domain and sub-skill names from `BLUEPRINT.md`, a
  rationale for every option, a trap type for every incorrect option, and at least one source with a
  title, a location, and a verification date.
- **FR-020**: Within a domain, items MUST be distributed across that domain's sub-skills in a way
  that follows the sub-skills' published shares rather than treating them as equal.
- **FR-021**: Every item MUST pass the repository's existing item validation, and publication MUST
  fail when any item does not.
- **FR-022**: Items flagged as a format demonstration MUST NOT appear in any mock, quiz, search
  result, or other learner-facing surface.

**The weighted mock exam**

- **FR-023**: The mock's item count and time limit MUST be derived from `BLUEPRINT.md`. Neither may
  be typed into a page, a component, or a configuration file.
- **FR-024**: The mock's per-domain item counts MUST equal the counts the repository's drill engine
  produces by largest-remainder apportionment for the same size. Equality MUST be verified
  automatically against the engine rather than asserted by a hand-written table.
- **FR-025**: The mock MUST run under a countdown from the blueprint's stated time limit, showing
  the time remaining and announcing it to assistive technology at intervals rather than
  continuously.
- **FR-026**: A candidate MUST be able to move between items in any order, change an earlier answer,
  and see which items remain unanswered.
- **FR-027**: The countdown MUST run against wall-clock time from the moment the attempt starts,
  whether or not the attempt is on screen. An attempt in progress MUST survive a page reload and
  a browser restart, including its answers and its remaining time, and MUST be resumable while
  time is left.
- **FR-028**: An attempt whose time ran out while the candidate was away MUST be presented as
  expired on their return, and the candidate MUST choose whether to score it as it stood or
  discard it. It MUST NOT be scored, retained, or resumed silently.
- **FR-029**: When the time limit expires while the candidate has the attempt open, it MUST be
  submitted and scored as it stands, and the report MUST state that the time ran out.
- **FR-030**: An item MUST be scored correct only when the selected options exactly match the
  correct options. No partial credit.
- **FR-031**: The score report MUST show overall percent correct and percent correct for each of the
  eight domains, and MUST state that per-domain figures are informational, as the real report does.
- **FR-032**: The report MUST show an explanation for every item answered incorrectly.
- **FR-033**: The report MUST state readiness as met only when overall correctness is at least 85%
  and every domain is at or above 70%, MUST withhold readiness with a reason when any domain had no
  item, and MUST present the bar as the project's own advice rather than an official threshold.
- **FR-034**: Any scaled-score figure MUST be labelled an estimate, MUST state the assumption behind
  it, and MUST state that the real exam is scored by a method that is not published.
- **FR-035**: When any domain's bank holds fewer items than its quota, the mock MUST state the
  shortfall by domain and MUST NOT substitute items from another domain to reach the size.
- **FR-036**: When repeated attempts would necessarily draw the same items because the bank holds no
  surplus, the site MUST say so.
- **FR-037**: A past report that still holds item detail MUST remain readable after the bank
  changes, showing the items as they were answered.
- **FR-038**: The score report MUST print legibly, carrying the per-domain figures and the
  explanations without the site's navigation, theme, or search controls.

**Per-domain quizzes and flashcards**

- **FR-039**: Each domain module page MUST present the notes' recall prompts for that domain as
  self-graded cards that reveal on request, rendered from the note rather than copied.
- **FR-040**: Each domain module page MUST present a separately scored quiz drawn from that domain's
  bank items, scored by the same rules as the mock and showing an explanation for every wrong
  answer. The quiz MUST ask for that domain's share of a full mock, derived from `BLUEPRINT.md` in
  the same way the mock's own quotas are, so quiz lengths differ between domains as the weights do.
- **FR-041**: The module page MUST state that only the scored quiz contributes to a readiness
  signal.
- **FR-042**: When a domain's notes carry no recall prompts, or its bank holds fewer items than the
  quiz asks for, each section MUST state its own condition rather than being omitted or rendered
  empty.
- **FR-043**: Flashcards MUST be driven by the generated deck at `flashcards/ccdv-f.tsv`, which is
  produced from the notes. No card text may be authored in the site.
- **FR-044**: The flashcard surface MUST state which domains the deck currently covers.
- **FR-045**: Flashcard review MUST schedule cards a candidate marked as not known ahead of cards
  they marked as known, MUST state when the next cards fall due once the due set is exhausted, and
  MUST keep the scheduling rule simple enough to be described on the page in a sentence.
- **FR-046**: Every card in the generated deck MUST carry a stable identifier that survives an edit
  to the card's own text and to the text of any other card, and that identifies exactly one card.
  The identifier MUST travel with the card in the deck file, and the deck MUST remain importable by
  the flashcard tools it is generated for.
- **FR-047**: Regenerating the deck MUST preserve review history for every card whose identifier is
  still present, and MUST discard history for identifiers that are gone, without shifting a
  discarded card's history onto another card.

**Progress**

- **FR-048**: Lab edits, mock attempts and reports, quiz results, and flashcard scheduling MUST be
  stored in the candidate's own browser, each in its own named area of the progress record feature
  001 established, so neither this feature nor a later one invalidates what the other wrote.
- **FR-049**: The site MUST retain the three most recent mock attempts in full. An older
  attempt MUST collapse to a per-domain score summary that preserves the trend, and its report
  MUST state that item-level detail is no longer held. Stored practice results MUST therefore
  stop growing once the limit is reached, however many mocks are sat.
- **FR-050**: All of it MUST be carried by the existing export and import, in the same single file,
  and an incompatible record MUST still be refused without damaging what is stored.
- **FR-051**: Concurrent use in more than one tab MUST NOT silently discard results recorded in
  another tab.
- **FR-052**: When on-device storage is unavailable or full, every surface MUST remain usable, MUST
  say plainly that results cannot be saved, and MUST NOT discard the attempt on screen.
- **FR-053**: A candidate MUST be able to clear practice results without clearing the plan marks,
  theme, and diagnostic outcome feature 001 stores.

**Constraints on the whole experience**

- **FR-054**: No journey added here may require or offer an account, a sign-in, a local
  installation, or an API key, and no page may contain a credential field.
- **FR-055**: The site MUST make no third-party runtime request and MUST load no analytics or
  tracking, including on the pages that run the runtime.
- **FR-056**: Every interactive element added here — the code pane, the Run and Stop controls, the
  item navigation, the timer, the quiz, and the flashcards — MUST be fully operable by keyboard with
  a visible focus indicator, and MUST allow the keyboard to leave the code pane without trapping it.
- **FR-057**: Every surface added here MUST meet WCAG 2.1 AA, MUST lose no information under reduced
  motion or forced colours, and MUST remain usable on a narrow screen without the page scrolling
  sideways.
- **FR-058**: Every page added here MUST carry the unofficial / not-affiliated statement and the
  licence terms, as feature 001 requires of every page.
- **FR-059**: The repository's existing gates MUST continue to pass unchanged, and the site's checks
  — including a check that the mock's apportionment matches the drill engine — MUST run alongside
  them on every proposed change, with a failure blocking publication and leaving the previously
  published site in place.

### Constitutional constraints *(mandatory — do not delete)*

- **CC-001**: Every exam figure this feature uses — the mock's size, its time limit, its per-domain
  quotas, and each domain's weight — is derived from `BLUEPRINT.md` and verified against the
  repository's drill engine. Satisfied by FR-023, FR-024, FR-059.
- **CC-002**: Lab code, note prompts, and flashcards are rendered from their single source in
  `lab/`, `notes/`, and `flashcards/`; nothing is copied into the site tree, and publication fails
  if it is. Satisfied by FR-001, FR-039, FR-043.
- **CC-003**: Every surface works with no account, no installation, and no API key; the runtime is
  served from the site's own origin, executed code cannot reach the network or a credential, and no
  analytics run. Satisfied by FR-003, FR-004, FR-005, FR-054, FR-055.
- **CC-004**: The mock's composition, the quizzes' lengths, and the item bank's sub-skill spread all
  follow the published weights; the one-item and two-item domains stay deliberately short. Satisfied
  by FR-020, FR-024, FR-035, FR-040.
- **CC-005**: Every item added is original, written from the public blueprint, with dated sources;
  Anthropic material is linked, not re-hosted. Satisfied by FR-018, FR-019, FR-021.
- **CC-006**: Every surface meets WCAG 2.1 AA and is fully keyboard-operable, including the code
  pane and the timer, and the runtime stays off the critical path within the stated budget.
  Satisfied by FR-002, FR-056, FR-057, with the budget in SC-008.

### Key Entities

- **Lab module**: One unit of the reference application — a top-level module or a package.
  Carries the concept it demonstrates, its source, the domain and note it belongs to, whether
  the runtime can satisfy its dependencies, and the candidate's local edits.
- **Run result**: One execution of a lab's code. Carries standard output, standard error, an
  uncaught exception with its traceback, whether it was stopped or truncated, and how long it took.
- **Practice item**: One original multiple-response question. Carries a stable identifier, its
  domain and sub-skill, its difficulty, the number of correct options, its options with a rationale
  for each and a trap type for each incorrect one, its dated sources, and whether it is a format
  demonstration.
- **Mock attempt**: One sitting. Carries the items as they were when drawn, the answers given, the
  time remaining, whether the time expired, and when it started and finished.
- **Score report**: The result of scoring an attempt. Carries overall correctness, per-domain
  correctness, the explanation for each wrong answer, the readiness verdict against the project's
  bar, and any estimate with its stated assumption. Held either in full, with the items as they were
  answered, or — once it falls outside the retention limit — as the per-domain summary alone.
- **Recall prompt**: One open question from a domain's notes, with the candidate's self-grade.
- **Flashcard**: One generated card with a stable identifier, a front, a back, its domain and
  sub-skill, and its review state — how it was last graded and when it next falls due. The
  identifier is what review state is held against, so it must survive a rewording of the card.
- **Practice progress**: Everything this feature remembers for one candidate in one browser — lab
  edits, attempts and reports, quiz results, and flashcard schedules — held in its own named areas
  of the record feature 001 established, exported and imported with it as one file.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A candidate who has never installed Python runs this repository's reference
  application and sees its real output within two minutes of opening a lab page, with no account, no
  install, and no key at any point.
- **SC-002**: No page that does not offer a lab, a mock, or a quiz fetches the runtime — verified
  automatically against the built site rather than by inspection.
- **SC-003**: No request leaves the browser for a third party on any page, including while code is
  executing, and code that attempts a network call or reads a credential fails — each demonstrated
  by a deliberate attempt.
- **SC-004**: A full mock assembles at the blueprint's stated size with per-domain counts identical
  to the repository's drill engine, verified automatically on every proposed change rather than by
  reading a table.
- **SC-005**: A candidate completes a full timed mock, has the attempt survive a mid-attempt reload,
  and receives a report giving percent correct per domain, an explanation on every wrong answer, and
  a readiness verdict — with no sign-in and no key.
- **SC-006**: Every item in the bank passes the repository's validation, carries a dated source, and
  uses domain and sub-skill names that match `BLUEPRINT.md` exactly — enforced on every proposed
  change, with a deliberate failing item demonstrating that publication is blocked.
- **SC-007**: Every journey added here — running a lab, sitting a mock, taking a quiz, working the
  deck, exporting and importing — is completable by keyboard alone, and every page added returns no
  critical or serious accessibility violations.
- **SC-008**: Pages that do not use the runtime keep feature 001's budget of readable main content
  within 2.5 seconds on a mid-tier mobile device over a typical mobile connection. On a lab page,
  the page is interactive within that same budget before the runtime is requested, and the wait for
  the runtime is reported and interruptible.
- **SC-009**: A candidate produces results on all four new surfaces, exports one file, imports it
  into a second browser, and finds every result present, including flashcard scheduling and past
  reports.
- **SC-010**: Every surface behaves correctly against the repository's current content state — seven
  scaffolded domains and a deck covering one — stating its own coverage rather than implying more,
  verified against that state and not a populated one.
- **SC-011**: A contributor adds one original item, validates it with the repository's existing
  command, republishes, and finds it in a mock and in its domain's quiz with no site file edited.
- **SC-012**: Stored practice results stop growing once the retention limit is reached — verified by
  sitting more mocks than the limit and confirming the stored record's size levels off while the
  per-domain trend for the earlier attempts survives.

## Assumptions

- The item bank written for this feature reaches the per-domain quota, not far beyond it. Where a
  domain holds exactly its quota, every attempt draws the same items; the site states this rather
  than implying a fresh draw, and surplus items are ordinary later content work.
- Items are written from the public blueprint and the linked public documentation. Writing items for
  a domain whose notes are still a scaffold is expected and acceptable: the blueprint states what
  each sub-skill measures, which is what an item is written against.
- The notes stay largely scaffolded while this feature is built, as they were for feature 001. Every
  surface here is specified to render that state honestly.
- The flashcard deck is generated from the notes as part of publishing, so it never lags its source,
  and it grows as the notes are written without any change here.
- Spaced repetition is deliberately lightweight — a small number of intervals a candidate can read
  in a sentence, not a memory model. Nothing here prevents a better schedule later.
- Results are per browser. Two browsers are two records, reconciled only through export and import,
  exactly as feature 001 established.
- A candidate uses a current desktop or mobile browser with enough memory to hold an in-browser
  Python runtime. Browsers that cannot are supported to the extent that the lab page stays readable
  and says the runtime is unavailable; every non-runtime surface stays fully usable there.
- `lab/` and `drills/` depend on `jsonschema`, `PyYAML`, and `mcp`. The first two are pure Python
  and expected to load; the MCP server's `FastMCP` stack is the one known candidate for a lab
  that shows its source instead of running. Which labs actually run is settled by the runtime at
  publication time, so this assumption changes nothing if it turns out to be wrong in either
  direction.
- Lab code executes as the candidate wrote it. The protection specified here is against reaching the
  network or a credential and against hanging the page, not against a candidate deliberately
  breaking their own session, which costs them a reload.
- The 85% overall and 70% per-domain bar is the project's advice, not an official rule. The only
  published threshold is the scaled score of 720.
- The Claude Code terminal simulator, the config builder, and the free-form playground remain
  reserved for feature 003 and are untouched here.
