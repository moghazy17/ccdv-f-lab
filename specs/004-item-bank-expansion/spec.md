# Feature Specification: Item-bank expansion past mock quota

**Feature Branch**: `004-item-bank-expansion`
**Created**: 2026-09-17
**Status**: Draft
**Input**: User description: "Grow this repository's practice-item bank past mock quota so that
repeated mock sittings and domain quizzes draw varying items rather than the same ones every time,
and so that every sub-skill in the blueprint is practised in proportion to its published share.
Author additional original practice items into the existing bank until each domain holds a multiple
of its mock quota, with the multiple and any small-domain floor decided during planning. The
per-domain target is derived from the blueprint's apportionment at build time and is never a
hand-typed count. Distribute the items a domain receives across its sub-skills in proportion to each
sub-skill's published share of the exam. Cover all three difficulty levels the schema defines. Every
item cites at least one official Anthropic source that was read during authoring, with the date it
was read, and every cited source has a matching dated row in SOURCES.md before the item lands. Every
item is original, written from the public blueprint. No two items in a domain may turn on the same
distinguishing fact. Each incorrect option carries one of the schema's trap types and a rationale
that explains why a prepared candidate might still pick it. The bank's existing schema and
validation command stay authoritative and unchanged in shape; domain and sub-skill strings match
BLUEPRINT.md exactly; items reach the weighted mock, the per-domain quizzes, and site search through
the existing exporters with no site code change; the full repository gate set keeps passing; nothing
in the site tree restates an item's text. Non-goals: authoring the six scaffold note trees,
regenerating flashcards or cheatsheets, changing the mock engine's apportionment, changing the
schema's required fields, and any change to how items are rendered."

## Context that shapes this specification

Six facts about the repository were measured while writing this specification. Each one constrains
what the feature must deliver, and each is stated here so that later phases do not rediscover it.

1. **The bank holds exactly one mock's worth of eligible items.** `drills/bank/` holds 54 files, one
   of which is the format demonstration the exporter drops, leaving 53 eligible items against a
   full-size mock of 53. Every domain sits at exactly the quota that apportionment gives it. A
   surplus of zero, not a shortfall, is the defect this feature removes.
2. **The consequence is already disclosed rather than hidden.** `site/src/lib/attempt.ts` computes
   whether any domain holds a surplus, and the mock page renders a notice saying repeated attempts
   draw the same items when none does. The notice is conditional on the measured bank, so it retires
   itself the moment surplus exists. This feature therefore needs no site change to remove it, and
   removing the notice by editing the page instead of by growing the bank would be a defect.
3. **Publication is automatic.** The exporters publish every eligible item to the weighted mock, to
   its domain's scored quiz, and to site search. An authored file that validates reaches learners
   with no code change anywhere.
4. **The joins are string joins.** Validation and every exporter match an item to the blueprint by
   its `domain` and `sub_skill` strings. A near-miss spelling is not a cosmetic defect; it detaches
   the item from its domain's quota and from its quiz.
5. **The bank practises two of the three difficulty levels.** Every existing item is `application`
   or `analysis`. No `recall` item exists anywhere in the bank, so the least demanding third of the
   schema's own range is unpractised.
6. **Seven sub-skills stand on a single item each.** Systems Life Cycle, Model Selection and
   Tradeoffs, Output Handling, Guardrails and Safe Deployment, Identity, Secrets, and Key
   Management, MCP Server Development, and Debugging and Error Handling each have one item. A
   learner who misses that one item has no second chance to meet the sub-skill, and a learner who
   remembers it has no way to test whether they know the sub-skill or the item.

## Clarifications

### Session 2026-09-17

- Q: What multiple of each domain's mock quota, and what floor for the lightest domains? → A: Three
  times the quota, with a floor of six items per domain.
- Q: Does the three-difficulty-level requirement bind per domain or bank-wide? → A: Per domain —
  every domain holds at least one item at each level.
- Q: Do the existing items have to meet the new sourcing rules? → A: Yes, the whole bank conforms
  with no exemption; a citation may also be this repository's own source file.
- Q: When does this feature close? → A: When the coverage tooling and the two heaviest domains
  reach target; the remaining six domains are a tracked follow-on against the same targets.
- Q: Is there a requirement on the share of multiple-response items? → A: Every domain holds at
  least one, with no target share above that floor.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A second mock asks different questions (Priority: P1)

A candidate sits the full weighted mock, reviews the score report, studies the domains that scored
below the readiness bar, and sits the mock again a week later. The second sitting asks substantially
different questions while keeping the same per-domain shape, so the second score measures the domain
rather than memory of the first sitting's items.

**Why this priority**: This is the outcome the feature exists for. Without it, every later measure
of readiness is contaminated by recall of a fixed set, and the readiness bar the site publishes
means less each time a candidate applies it.

**Independent Test**: Generate two full-size mocks from the bank and compare their item sets. The
journey delivers value as soon as any domain holds a surplus, and more value as more domains do.

**Acceptance Scenarios**:

1. **Given** a bank where every domain holds more items than its quota, **When** a candidate
   generates two full-size mocks, **Then** the second mock's item set differs substantially from the
   first while each domain still contributes exactly its apportioned quota.
2. **Given** the same bank, **When** the mock page is rendered, **Then** the notice saying repeated
   attempts draw the same items is absent, because the condition that produced it no longer holds.
3. **Given** a bank where one domain still sits at quota, **When** a candidate generates two mocks,
   **Then** that domain repeats its items, every other domain varies, and the site continues to
   describe the situation accurately rather than implying a fresh draw everywhere.

---

### User Story 2 - A domain quiz can be attempted twice (Priority: P2)

A candidate finishes a domain's notes, takes that domain's scored quiz, gets two questions wrong,
reads the rationales, returns a few days later, and takes the quiz again. The second attempt asks
questions the candidate has not already seen the answer explanation for.

**Why this priority**: The quizzes are the per-domain feedback loop the study plans send a candidate
through repeatedly. A fixed quiz converts that loop into rehearsal of five remembered answers.
It ranks below the mock because the mock is the readiness instrument.

**Independent Test**: Take a domain quiz twice from a domain that holds surplus and confirm the two
attempts differ; confirm every drawn item still carries the domain's exact blueprint name.

**Acceptance Scenarios**:

1. **Given** a domain holding more items than one quiz draws, **When** a candidate takes that quiz
   twice, **Then** the two attempts differ in their items.
2. **Given** any domain, **When** its quiz is assembled, **Then** every item it draws belongs to
   that domain and names a sub-skill the blueprint places in that domain.

---

### User Story 3 - Every sub-skill is practised in proportion to its share (Priority: P2)

A candidate who is weak in one named sub-skill can practise that sub-skill specifically, and finds
that the heavier sub-skills carry more practice than the lighter ones rather than an equal share
each.

**Why this priority**: Proportional coverage is the principle the whole kit is organized around, and
a bank that spreads items evenly across sub-skills teaches the misallocation the project exists to
prevent. It ranks with the quiz journey because both depend on the same authored volume.

**Independent Test**: Compare the per-sub-skill counts in the bank against the shares the blueprint
publishes, and confirm the ordering matches and no sub-skill stands alone.

**Acceptance Scenarios**:

1. **Given** a domain that has reached its target, **When** its items are counted by sub-skill,
   **Then** every sub-skill in that domain holds at least two items. Once the follow-on completes,
   the same holds for every sub-skill the blueprint names.
2. **Given** the finished bank, **When** its per-sub-skill counts are ordered by count, **Then**
   heavier sub-skills hold at least as many items as lighter ones within the same domain.
3. **Given** the finished bank, **When** any one domain's items are counted by difficulty, **Then**
   all three difficulty levels the schema defines are represented within that domain.

---

### User Story 4 - A reviewer can verify an item's source without re-researching it (Priority: P3)

A reviewer reading a pull request that adds forty items can confirm, for any item, which official
page backs it, when that page was read, and that the repository records the same page and date, in
under a minute per item and without opening a search engine.

**Why this priority**: A confidently wrong item passes every structural gate and reaches a candidate
as fact. Sourcing is what makes the wrongness detectable. It ranks third because it protects the
work rather than delivering the learner outcome.

**Independent Test**: Pick any item at random, follow its cited source, and find both the passage
that settles the item and a matching dated repository record.

**Acceptance Scenarios**:

1. **Given** any item in the bank, **When** a reviewer reads its sources, **Then** each carries a
   title, a link to an official Anthropic page, and the date the page was read.
2. **Given** any item in the bank, **When** a reviewer looks up its cited page in the repository's
   source record, **Then** a row exists for that page stating what it establishes, with a date not
   later than the item's own.
3. **Given** an item whose cited page cannot be reached or no longer states the claim, **When** the
   authoring pass encounters it, **Then** the item is not added, and the blocked sub-skill is
   reported rather than filled with an unsourced substitute.

---

### Edge Cases

- **A domain reaches its target before every sub-skill does.** The domain-level count is met while a
  light sub-skill still stands alone. The sub-skill requirement governs: the pass is unfinished.
- **A sub-skill has too little public documentation to support its share.** The pass reports the
  shortfall explicitly rather than padding the sub-skill with restatements of one fact, and rather
  than silently moving the items to an easier sub-skill.
- **Two authors write the same distinguishing fact into two items.** Both validate structurally and
  both are defects, because two restatements of one fact provide no variety between sittings.
- **A cited page changes between authoring and review.** The item's claim no longer matches its
  source; the item is corrected or withdrawn, not re-dated.
- **An item's correct option is right only under an assumption the stem never states.** It is
  unsourceable by construction and does not land, however good its citation is.
- **A domain quiz draws more items than the domain holds.** Assembly must degrade to what exists and
  say so, exactly as the mock already does for a domain shortfall.
- **The bank grows large enough that one pass's items cluster in one part of a domain.** Coverage is
  measured per sub-skill and per difficulty, not per domain alone, so the clustering is visible.

## Requirements *(mandatory)*

### Functional Requirements

**Targets and coverage**

- **FR-001**: The per-domain item target MUST be derived from the blueprint's own apportionment of a
  full-size mock, multiplied by a single factor of three that applies to every domain. No hand-typed
  count may stand as the authority for a target: nothing reads one, no task is checked against one,
  and a count that disagrees with the computation is wrong by definition. A dated measurement
  recorded in a planning document is evidence of what the computation printed and is not covered by
  this rule, provided it says so where it appears.
- **FR-002**: A floor of six items per domain MUST apply, so that the lightest domains still hold
  enough items for a quiz to vary between attempts. A domain's target is its apportioned quota times
  three, or six, whichever is larger. The floor is one value applied uniformly, not a per-domain
  table.
- **FR-003**: The target a domain receives MUST be distributed across that domain's sub-skills in
  proportion to each sub-skill's published share, using the same apportionment the mock already uses
  rather than a second implementation of the same arithmetic.
- **FR-004**: Every sub-skill in a domain that has reached its target MUST hold at least two items,
  so that no sub-skill can be passed or failed on one remembered question. The same floor across
  every sub-skill the blueprint names is the follow-on's exit condition rather than this feature's,
  because the domains the follow-on covers are where the remaining single-item sub-skills live.
- **FR-005**: Every domain that has reached its target MUST hold at least one item at each
  difficulty level the schema defines, so that a candidate studying one domain meets the full range
  rather than one level of it. Every domain holding all three is the follow-on's exit condition.
- **FR-006**: Current counts, targets, and remaining shortfall MUST be reportable per domain and per
  sub-skill on demand, so an author can tell what to write next without counting files by hand.
- **FR-007**: The reported target MUST change automatically when the blueprint's weights change,
  with no edit to any count.

**Item quality**

- **FR-008**: Every item MUST be original, written from the public blueprint. No recalled,
  reconstructed, or paraphrased live exam content, in any form.
- **FR-009**: Every item MUST carry the exact domain and sub-skill strings the blueprint publishes,
  character for character, and the sub-skill MUST be one the blueprint places in that domain.
- **FR-010**: Every incorrect option MUST carry one of the trap types the schema defines and a
  rationale that explains why a prepared candidate might still choose it.
- **FR-011**: Every correct option MUST carry a rationale that states what makes it correct, rather
  than restating the option.
- **FR-012**: No two items within a domain may turn on the same distinguishing fact, where two items
  share a distinguishing fact if knowing the single passage that settles one is enough to answer the
  other without further knowledge.
- **FR-013**: Every item MUST have a bank-wide unique identifier that remains stable once published,
  so that a learner's answer history is not invalidated by later authoring.
- **FR-014**: An item with more than one correct option MUST state in its own text how many options
  the candidate selects, so the candidate never has to infer it.
- **FR-015**: Every domain that has reached its target MUST hold at least one item with more than
  one correct option, so that a candidate meets the exam's multiple-response format in practice
  rather than for the first time under exam timing. Every domain holding one is the follow-on's exit
  condition. No target share applies above that floor; the mix follows what the content genuinely
  supports.
- **FR-016**: An item MUST be answerable from its text alone, without relying on color, layout, or
  option ordering to carry meaning.

**Sourcing**

- **FR-017**: Every item MUST cite at least one authoritative source: an official Anthropic page —
  the exam guide, Partner Academy, or Anthropic's product documentation — or a source file in this
  repository, where the item tests something this repository's own reference application
  demonstrates. A community summary, an aggregator, or an assistant's recollection is not a source.
- **FR-018**: Every cited source MUST carry the date the page was read during authoring, not the
  date the item was written from memory.
- **FR-019**: Every cited source MUST have a matching dated entry in the repository's source record
  stating what that page establishes, added before the item that cites it.
- **FR-020**: A conflict between an item's citation and the repository's source record — a cited
  page with no record, or an item claiming a check earlier than the record's own date — MUST fail
  a repeatable check rather than depend on a reviewer noticing.
- **FR-021**: The sourcing rules MUST hold for every item in the bank, including those authored
  before this feature. The check carries no exemption list, and bringing the existing items into
  conformance is part of this feature's scope.
- **FR-022**: An item whose backing page cannot be opened and read MUST NOT be added. The blocked
  sub-skill is reported instead.

**Boundaries**

- **FR-023**: The item schema's required fields and the validation command MUST stay authoritative
  and unchanged in shape. Additional checks may be added around them; the contract items are written
  against does not move.
- **FR-024**: Authored items MUST reach the weighted mock, the per-domain quizzes, and site search
  through the existing export path, with no change to site code and no change to how an item is
  rendered.
- **FR-025**: No item's text may be restated anywhere in the site tree; the site renders the bank
  rather than holding a copy of it.
- **FR-026**: The mock's per-domain apportionment MUST NOT change. This feature changes what is
  drawn from, not how much is drawn.
- **FR-027**: The disclosure that repeated attempts draw the same items MUST remain driven by the
  measured bank, so it retires itself when surplus exists and reappears honestly if the bank were
  ever to shrink.
- **FR-028**: The full repository gate set MUST pass at the end of every authoring pass, not only at
  the end of the feature.

**Delivery boundary**

- **FR-029**: This feature is complete when the coverage reporting, the source-record check, and the
  two heaviest domains have reached the target FR-001 and FR-002 define, when those two domains meet
  the sub-skill, difficulty, and multiple-response floors in FR-004, FR-005, and FR-015, and when
  every item in the bank meets the item-quality and sourcing requirements. The remaining six domains
  keep the same targets and floors and are delivered as a tracked follow-on, which is complete when
  every domain and every sub-skill the blueprint names meets those same floors.
- **FR-030**: While any domain remains below target, the coverage report MUST state the outstanding
  shortfall per domain and per sub-skill, so the follow-on work is derived from the bank rather than
  from a list that can go stale.
- **FR-031**: A domain the follow-on has not yet reached MUST keep behaving correctly: its quiz and
  its share of the mock draw from whatever it holds, and the site's own disclosure continues to
  describe the bank as measured.

### Constitutional constraints *(mandatory — do not delete)*

- **CC-001**: Any exam structure this feature displays MUST be derived from `BLUEPRINT.md`, never
  hand-typed or restated from memory. Per-domain and per-sub-skill targets are computed from the
  blueprint's apportionment (FR-001, FR-003, FR-007); no hand-typed count is authoritative for a
  target, and every item's domain and sub-skill are the blueprint's own strings (FR-009).
- **CC-002**: Study content MUST be rendered from its single source; no copies or paraphrases live
  in this feature's tree. Items live once, as YAML in `drills/bank/`, and reach every surface
  through the existing exporters (FR-024, FR-025).
- **CC-003**: The feature MUST be fully usable with no account, no installation, and no API key,
  with no analytics and no third-party runtime requests. The feature adds data files only; the
  surfaces that render them are unchanged and stay keyless and loginless (FR-024, FR-026).
- **CC-004**: Depth and prominence MUST track the published exam weights rather than treating the
  eight domains equally. Authored volume is apportioned by weight at both domain and sub-skill level
  (FR-001, FR-003), with a floor only where a light domain would otherwise be too small to vary
  (FR-002).
- **CC-005**: Practice material MUST be original, Anthropic material MUST be linked rather than
  re-hosted, and new factual claims MUST carry dated `SOURCES.md` entries. Originality is FR-008;
  linking rather than re-hosting is inherent to citation (FR-017); dated records and their
  enforcement are FR-018 through FR-022.
- **CC-006**: The feature MUST meet WCAG 2.1 AA with full keyboard operation, and MUST state its
  performance budget. The feature adds no interface. Item text must not depend on color, layout, or
  ordering to be answerable (FR-016), so nothing it adds can degrade the existing conformance. Its
  performance budget is that the site's build-time data payload stays within the limit the payload
  check already enforces, and that no item adds a runtime request.

### Key Entities

- **Practice item**: One original question. Carries a stable identifier, the blueprint domain and
  sub-skill it tests, a difficulty level, how many options to select, a stem, four or more options
  each with a rationale and, when incorrect, a trap type, and one or more dated sources.
- **Drill bank**: The whole collection of practice items, grouped by domain. Its per-domain and
  per-sub-skill counts are the quantity this feature changes.
- **Domain target**: The number of items a domain should hold, derived from that domain's share of a
  full-size mock and a single stated multiple, with a floor for the lightest domains.
- **Sub-skill target**: The domain target apportioned across the domain's sub-skills by published
  share.
- **Coverage shortfall**: The difference between a target and the count held, per domain and per
  sub-skill, and the thing an authoring pass consumes as its work list.
- **Source record**: The repository's dated register of what each cited page establishes, which
  every item's citation must agree with.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A candidate who sits the full mock twice in a row encounters, from the domains this
  feature covers, a majority of items they have not seen in the first sitting. Once the follow-on
  completes the remaining domains, the same holds for the mock as a whole.
- **SC-002**: A candidate who takes the same domain quiz twice encounters at least one item they
  have not seen, in every domain that has reached target.
- **SC-003**: Every sub-skill in a domain that has reached target holds at least two items, so no
  sub-skill can be passed or failed on the strength of a single remembered question.
- **SC-004**: Every domain this feature covers holds at least three times its full-size mock quota,
  or six items, whichever is larger, and every remaining domain has a reported shortfall against the
  same target.
- **SC-005**: All three difficulty levels are represented in every domain this feature covers, where
  one of them is represented nowhere in the bank before this feature.
- **SC-006**: Every domain this feature covers holds at least one multiple-response item, so the
  format is practised in every domain rather than met first under exam conditions.
- **SC-007**: Every item in the bank, including every item authored before this feature, cites at
  least one authoritative source with a read date, and a repeatable check finds no citation without
  a matching dated record.
- **SC-008**: The disclosure that repeated attempts draw the same items continues to describe the
  bank as measured at every point: it stays accurate while the lighter domains remain at quota, and
  it disappears once the follow-on clears the last of them — never because a page was edited.
- **SC-009**: The repository's full gate set passes at every pass boundary, with no change to the
  item schema's required fields, to the mock's apportionment, or to site code.
- **SC-010**: A reviewer can trace any item to the passage that backs it in under a minute, without
  independent research.

## Assumptions

- A factor of three was chosen over two because a domain drawing its full quota from twice as many
  items repeats about half of a sitting, which is the exact boundary SC-001 stands on. Three puts
  the expected overlap near a third.
- "Substantially different" in SC-001 means a majority of drawn items differ. It is stated as an
  outcome rather than an arithmetic identity, because the draw is random.
- The three-difficulty requirement binds per domain rather than bank-wide. The floor of six items
  is what makes this affordable for the lightest domains: six items carry three levels without
  padding, where a domain held to its quota of one or two could not.
- Existing items' claims are not re-researched as part of this feature; their read dates stand
  until an item citing the same page finds that the page has changed. Their citations, however, are
  brought into conformance with the source record (FR-021), which is a records gap rather than a
  factual one: three citations in the bank have no row, two of them to this repository's own lab
  files.
- Ordering heavier sub-skills at or above lighter ones (User Story 3) is checked within a domain,
  not across domains, because a light domain's only sub-skill can outrank a heavy domain's smallest
  one purely through the floor.
- The site's own statements about bank size are computed from the bank, so no site copy needs
  rewriting as counts change.
- Authoring capacity, not tooling, is the binding constraint. The feature is structured so that
  value arrives per domain rather than only at completion, which is why the delivery boundary
  (FR-029) closes it at the two heaviest domains rather than at all eight.
- The two heaviest domains are identified by the blueprint's own weights at the time the work runs,
  not by a name written here, so a reweighted blueprint redirects the work rather than invalidating
  this specification.
