# Accessibility, performance, and keyless-constraint requirements checklist

**Purpose**: Validate that the requirements themselves — not the implementation — quantify the
performance budget, define keyboard and screen-reader behaviour, specify offline and slow-connection
handling, define storage-unavailable and storage-full behaviour, and state the no-account, no-key,
no-third-party-request rule in a form a test can actually check.
**Created**: 2026-09-08
**Feature**: [002 spec](../spec.md), with [001 spec](../../001-study-site-foundation/spec.md) for
the surfaces this lens was asked to cover that 001 owns.

**Scope note**: This checklist spans two specs because the constraints do. A candidate's journey
crosses both features, and the keyless, storage, and accessibility rules are meant to hold site-wide
rather than per feature. Part A tests 001's requirements for the diagnostic, plan checklists, and
search; Part B tests 002's for the code pane, timer, quizzes, and flashcards; Part C tests whether
the two hold together.

**How to read an item**: every item asks whether something is *written well enough*, not whether it
works. `§` references cite the owning spec. `[Gap]` means the item is checking for something that
may not be written at all.

---

# Part A — Feature 001 surfaces (diagnostic, plan checklists, search)

## A11y requirement completeness and clarity

- [ ] CHK001 Are the diagnostic's screen-reader obligations specified precisely enough to test —
  specifically, *what* is announced when the recommendation appears, not only that it is announced?
  [Clarity, 001 §FR-031]
- [ ] CHK002 Is "moves focus to its result" defined well enough to identify the exact element that
  receives focus? [Measurability, 001 §FR-031]
- [ ] CHK003 Are search's keyboard obligations complete across open, traverse, activate, and
  dismiss, with the return-focus target named? [Completeness, 001 §FR-032]
- [ ] CHK004 Is the "documented search shortcut" actually documented in the requirements, or only
  referred to as documented? [Ambiguity, 001 §FR-032, §US6]
- [ ] CHK005 Are keyboard and screen-reader requirements defined for the plan checklists, or do they
  inherit only the blanket rule that every interactive element be keyboard-operable? [Coverage, 001
  §FR-022, §FR-041]
- [ ] CHK006 Is the state of a plan's per-domain mark exposed to assistive technology in a specified
  way (checked, pressed, or selected), rather than left to implementation? [Gap, 001 §FR-022]
- [ ] CHK007 Does any requirement state that focus must remain within the search surface while it is
  open, or is that inferable only from the acceptance scenario? [Consistency, 001 §FR-032 vs §US6
  scenario 2]
- [ ] CHK008 Is "visible focus indicator" given any measurable property — contrast, thickness,
  offset — or left entirely to judgement? [Measurability, 001 §FR-041]

## Performance requirement quality

- [ ] CHK009 Is the 2.5-second budget bound to a named metric, or does "main content becomes
  readable" leave the measurement method open? [Clarity, 001 §SC-007]
- [ ] CHK010 Are "mid-tier mobile device" and "typical mobile connection" defined concretely enough
  that two reviewers would measure the same thing? [Measurability, 001 §SC-007]
- [ ] CHK011 Is the no-layout-shift claim expressed as a threshold rather than an absolute, given
  that "no visible shift" is a judgement? [Measurability, 001 §SC-007]
- [ ] CHK012 Is the budget stated per page type, or only once for the site as a whole?
  [Completeness, 001 §SC-007]

## Storage and keyless requirement quality

- [ ] CHK013 Are "unavailable" and "full" distinguished in the requirements, given that they produce
  different failure modes and different messages? [Clarity, 001 §FR-028]
- [ ] CHK014 Is the wording of the "progress cannot be saved" message constrained at all, or only
  its existence required? [Ambiguity, 001 §FR-028]
- [ ] CHK015 Is "every page must remain readable" testable, given that readability is not defined?
  [Measurability, 001 §FR-028]
- [ ] CHK016 Is the no-credential-field rule stated in a form a build check could evaluate — for
  example, naming input types — or only as intent? [Measurability, 001 §FR-035]
- [ ] CHK017 Is "no third-party runtime request" scoped precisely enough to distinguish build-time
  fetches from runtime ones? [Clarity, 001 §FR-036]
- [ ] CHK018 Are webfont CDNs, analytics, and tracking cookies named as instances of the same rule,
  or does the requirement rely on the reader inferring the category? [Completeness, 001 §FR-036]

---

# Part B — Feature 002 surfaces (code pane, timer, quizzes, flashcards)

## Keyboard and screen-reader requirement completeness

- [ ] CHK019 Is "allow the keyboard to leave the code pane without trapping it" specified with the
  actual key or mechanism, given that this is the known failure mode for editable text areas?
  [Clarity, 002 §FR-056]
- [ ] CHK020 Are the timer's screen-reader announcements defined by interval or by threshold —
  "meaningful intervals" is currently unquantified. [Measurability, 002 §FR-025]
- [ ] CHK021 Is what the timer announces specified, or only that it is announced at intervals rather
  than continuously? [Completeness, 002 §FR-025]
- [ ] CHK022 Are requirements defined for how the unanswered-item indicator is conveyed
  non-visually? [Gap, 002 §FR-026]
- [ ] CHK023 Are the flashcard keyboard shortcuts required to be *stated on the page*, and is the
  set of actions they must cover enumerated? [Completeness, 002 §FR-045, §US4 scenario 6]
- [ ] CHK024 Is the reveal-and-self-grade interaction's accessible semantics specified for the
  recall prompts, or left to implementation? [Gap, 002 §FR-039]
- [ ] CHK025 Are focus-management requirements defined for the transitions that change page content
  without navigation — submitting a mock, revealing a card, advancing a quiz item? [Gap, 002
  §FR-056]
- [ ] CHK026 Does any requirement state how run output is announced when it arrives, given that it
  appears asynchronously after Run? [Gap, 002 §FR-007, §FR-056]
- [ ] CHK027 Is SC-007's "completable by keyboard alone" distinguishable from WCAG conformance, so
  the two are not assumed to be verified by the same check? [Consistency, 002 §SC-007 vs §FR-057]

## Performance requirement quality

- [X] CHK028 Is the 8 MiB first-run ceiling stated with its measurement unit — raw, gzipped, or
  brotli? RESOLVED: `site/scripts/check-payload.mjs` measures gzip, because that is what the
  host serves, and reports 6.62 MiB against the 8 MiB ceiling. [Ambiguity, 002 §SC-008, plan
  Technical Context]
- [ ] CHK029 Is "a lab page is interactive within that same budget *before* the runtime is
  requested" expressed as a measurable condition, or does it depend on an undefined notion of
  interactive? [Measurability, 002 §SC-008]
- [ ] CHK030 Is the 2.5-second budget inherited from 001 restated for 002's new page types, or
  assumed? [Consistency, 002 §SC-008 vs 001 §SC-007]
- [ ] CHK031 Are requirements defined for what a *second* Run must cost, given the first is expected
  to be cached? [Gap, 002 §FR-002]
- [ ] CHK032 Is there a stated bound on how long a run may execute before the candidate is offered
  Stop, or is that left entirely to the candidate? [Gap, 002 §FR-006]
- [ ] CHK033 Is the output cap in FR-007 quantified, or only required to exist and be stated?
  [Measurability, 002 §FR-007]

## Offline and slow-connection requirement quality

- [ ] CHK034 Offline and slow-connection behaviour appears in the spec's Edge Cases but not in any
  numbered requirement — is that intentional, given the rest of the edge cases have requirement
  backing? [Gap, 002 §Edge Cases vs §FR-001–FR-007]
- [ ] CHK035 Is "the wait must be interruptible" defined as a requirement with a stated outcome —
  what the page shows after the candidate interrupts a download? [Completeness, 002 §Edge Cases]
- [ ] CHK036 Are the three fetch-failure causes — offline, blocked, interrupted mid-download —
  required to be distinguishable to the candidate, or may they share one message? [Clarity, 002
  §Edge Cases]
- [ ] CHK037 Is "the candidate's edits are kept" through a failed runtime fetch stated as a
  requirement, or only as an edge-case expectation? [Coverage, 002 §Edge Cases, §FR-016]
- [ ] CHK038 Are requirements defined for the non-lab surfaces when the network is unavailable —
  whether the mock, quizzes, and flashcards are expected to work offline at all? [Gap]
- [ ] CHK039 Is load progress required to be reported in an accessible form, not only visually?
  [Gap, 002 §FR-002, §US1 scenario 2]

## Storage requirement quality

- [ ] CHK040 Are "unavailable" and "full" given distinct required behaviours per surface, or one
  shared rule? [Clarity, 002 §FR-052]
- [ ] CHK041 Is "the attempt on screen must survive to submission" specified precisely enough to
  distinguish it from being stored? [Clarity, 002 §FR-052]
- [ ] CHK042 Is the behaviour defined for storage that becomes full *during* an attempt, as distinct
  from being full at the start? [Edge Case, 002 §Edge Cases]
- [ ] CHK043 Is the retention limit of three full reports stated with what happens at the boundary —
  whether the fourth submission or the third triggers the reduction? [Clarity, 002 §FR-049]
- [ ] CHK044 Are the size figures behind the retention limit recorded as rationale rather than as
  requirements, so a future change re-derives them rather than copying them? [Traceability, 002
  §FR-049, contracts/progress-record.md]

## Keyless-constraint requirement quality

- [ ] CHK045 Is "enforced by the execution environment itself rather than by the code under
  execution choosing not to" stated concretely enough to test, given it is the strongest claim in
  the spec? [Measurability, 002 §FR-004]
- [ ] CHK046 Are the specific globals whose absence constitutes enforcement named in a requirement,
  or only in the contract? [Traceability, 002 §FR-004 vs contracts/runtime-worker.md]
- [ ] CHK047 Is the required failure *message* for a real-transport request constrained beyond
  "names the mock transport"? [Clarity, 002 §FR-005]
- [ ] CHK048 Does the no-third-party-request rule explicitly extend to the period *while candidate
  code is executing*, or is that only in the success criterion? [Consistency, 002 §FR-055 vs
  §SC-003]
- [ ] CHK049 Is the runtime's own-origin requirement written so it covers the package wheels as well
  as the interpreter? [Completeness, 002 §FR-003]
- [ ] CHK050 Is there a requirement that no page may contain a credential field, expressed so it
  covers the code pane — which is a text input a candidate could type a key into? [Edge Case, 002
  §FR-054]

---

# Part C — Do the two specs hold together?

- [ ] CHK051 Does the keyless rule read as site-wide, or does each spec restate it for its own
  surfaces in ways that could drift? [Consistency, 001 §FR-035–FR-036 vs 002 §FR-054–FR-055]
- [ ] CHK052 Do the two storage requirements agree on what "usable" means when storage is
  unavailable, given 001 says "readable" and 002 says "usable"? [Conflict, 001 §FR-028 vs 002
  §FR-052]
- [ ] CHK053 Is the performance budget expressed in the same terms across both specs, so one figure
  governs rather than two similar ones? [Consistency, 001 §SC-007 vs 002 §SC-008]
- [ ] CHK054 Do both specs use one accessibility standard and one conformance claim, without a
  second, weaker formulation appearing anywhere? [Consistency, 001 §FR-041 vs 002 §FR-057]
- [ ] CHK055 Is it defined whether a candidate mid-mock in one tab and mid-diagnostic in another is
  a supported state, given both features write to the same record? [Gap, 001 §FR-026 vs 002 §FR-051]
- [ ] CHK056 Are the print requirements consistent, given 001 requires forced-light printing
  site-wide and 002 specifies printing only for the score report? [Consistency, 001 §FR-042 vs 002
  §FR-038]

## Constitutional compliance *(standing category)*

- [ ] CHK057 Is the source of every exam weight and item count stated rather than assumed?
  (Principle I)
- [ ] CHK058 Is the single-source rule for study content written so a build step can enforce it —
  including for `lab/` and `drills/` source, not only study prose? (Principle II)
- [ ] CHK059 Are the no-account, no-install, no-API-key, and no-analytics constraints expressed as
  testable requirements rather than aspirations? (Principle III)
- [ ] CHK060 Is weight-proportional coverage quantified concretely enough to review a design
  against? (Principle IV)
- [ ] CHK061 Are originality, attribution, and dated-source obligations covered? (Principle V)
- [ ] CHK062 Are the accessibility and performance requirements quantified? (Principle VIII)

## Notes

- Check items off as completed: `[x]`
- An unchecked item is a question about the *requirements*, not a defect in the build
- Items marked `[Gap]` are the most likely to need a spec edit rather than a clarification
- CHK028, CHK034, and CHK045 overlap findings A1, C4, and the FR-004 discussion in
  `/speckit-analyze`; resolving them there resolves them here
