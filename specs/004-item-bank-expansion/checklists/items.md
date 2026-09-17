# Item quality and coverage proportionality checklist: item-bank expansion

**Purpose**: Unit-test the *requirements* governing how targets are derived, what makes two items
duplicates, what a usable distractor is, how the three difficulty levels are told apart, and how an
item declares how many options to select.
**Created**: 2026-09-17
**Feature**: [spec.md](../spec.md)

**Audience and depth**: a reviewer reading a pull request that adds items, at standard depth. The
brief names five focus areas and the audience matches [sources.md](sources.md), so no clarifying
questions were asked.

**Note**: This checklist tests whether the requirements are written well enough to review an item
against. It does not test any item, the bank, or the coverage tooling.

## Targets derived rather than asserted

- [ ] CHK001 Is the derivation chain from published weight to per-domain target stated completely
      enough that two people computing it independently would agree? [Measurability, Spec §FR-001]
- [ ] CHK002 Are the multiple (three) and the floor (six) identified as authoring policy rather than
      exam structure, so a reader does not look for them in the blueprint? [Clarity, Spec §FR-001,
      §FR-002]
- [ ] CHK003 Do the requirements state the rounding rule for a sub-skill target, given that
      proportional shares of an integer target do not divide evenly? [Gap, Spec §FR-003]
- [ ] CHK004 Is the tie-break stated for two sub-skills with equal remainders, so the apportionment
      is reproducible rather than merely deterministic in one implementation? [Gap, Spec §FR-003]
- [ ] CHK005 Does the "same apportionment the mock already uses" requirement identify *which*
      property must match — the arithmetic, the tie-break, or both? [Clarity, Spec §FR-003]
- [ ] CHK006 Is the floor's effect on proportionality bounded by a stated rule — that it never lifts
      a lighter domain above a heavier one — rather than left as an observation about current
      weights? [Gap, Consistency, Spec §FR-002, §CC-004]
- [ ] CHK007 Do the requirements state what a *surplus* means: whether exceeding a target is
      permitted, discouraged, or irrelevant, and whether a surplus in one sub-skill offsets a
      shortfall in another? [Gap, Spec §FR-001, §FR-030]
- [ ] CHK008 Is "reportable on demand" attached to a stated moment or actor, or does it leave open
      whether the report is an authoring instrument, a review artifact, or a gate?
      [Ambiguity, Spec §FR-006]
- [ ] CHK009 Is the behavior on a blueprint weight change specified beyond "targets change" — for
      instance, whether a domain that drops below its new target becomes non-conforming?
      [Coverage, Gap, Spec §FR-007]
- [ ] CHK010 Are the sub-skill floor (two items) and the sub-skill target (apportioned) stated in a
      way that makes clear which governs when they disagree? [Consistency, Spec §FR-003, §FR-004]

## What makes two items duplicates

- [ ] CHK011 Is the duplicate relation defined by a property of the items rather than by a
      similarity score, so two reviewers reach the same verdict? [Measurability, Spec §FR-012]
- [ ] CHK012 Does the definition state its unit — "the single passage that settles one" — precisely
      enough to apply when an item rests on two passages or on a passage plus a stated constraint?
      [Clarity, Spec §FR-012]
- [ ] CHK013 Is the relation's scope stated as within-domain, with a reason a reader can evaluate
      rather than accept? [Clarity, Spec §FR-012]
- [ ] CHK014 Do the requirements address clusters rather than only pairs, so that three items each
      distinct from the next but collectively testing one fact are visible? [Gap, Spec §FR-012]
- [ ] CHK015 Is the disposition of a duplicate pair stated — which of the two is withdrawn or
      rewritten, and on what basis? [Coverage, Gap, Spec §FR-012]
- [ ] CHK016 Do the requirements distinguish a duplicate *fact* from a duplicate *scenario*, so that
      two items may legitimately use the same setting to test different distinctions?
      [Clarity, Gap, Spec §FR-012]
- [ ] CHK017 Is the relationship between the non-failing advisory and the binding requirement
      stated, so a reader does not read a green validation run as a duplicate-free verdict?
      [Consistency, Spec §FR-012]
- [ ] CHK018 Is the duplicate rule reconciled with the sub-skill targets, given that a heavily
      weighted sub-skill must carry many items drawn from a bounded body of documentation?
      [Consistency, Gap, Spec §FR-003, §FR-012]

## Distractors and trap types

- [ ] CHK019 Do the requirements define what makes a distractor usable in terms a reviewer can apply
      to one option, rather than only requiring that a rationale exist? [Gap, Spec §FR-010]
- [ ] CHK020 Is there a stated test for plausibility — such as whether a prepared candidate who
      missed one distinction would select it — inside the requirements rather than only in a
      contract document? [Traceability, Spec §FR-010]
- [ ] CHK021 Are the trap types enumerated or defined anywhere in the requirements, or does the spec
      defer entirely to a schema file a reviewer may not open? [Gap, Traceability, Spec §FR-010]
- [ ] CHK022 Do the requirements state what correct *use* of a trap type means — that the named trap
      matches the reason the option actually fails — rather than only that a value is present?
      [Measurability, Spec §FR-010]
- [ ] CHK023 Is it stated whether two distractors in one item may carry the same trap type, and
      whether four distractors failing for one reason is a defect? [Gap, Spec §FR-010]
- [ ] CHK024 Do the requirements say anything about the *number* of options, given that the schema
      admits four or more and the spec names no count? [Gap, Completeness, Spec §FR-010]
- [ ] CHK025 Is the rationale's job distinguished between the correct and incorrect options — one
      explaining why the option wins, the other explaining the distinction a learner missed?
      [Clarity, Spec §FR-010, §FR-011]
- [ ] CHK026 Is "rather than restating the option" given an applicable test, so a reviewer can rule
      on a rationale that paraphrases rather than explains? [Measurability, Spec §FR-011]
- [ ] CHK027 Do the requirements address structural tells that give an answer away without
      knowledge — a correct option markedly longer than the others, absolute qualifiers confined to
      distractors, or an option that subsumes the rest? [Gap, Spec §FR-010, §FR-016]
- [ ] CHK028 Is it stated whether an option may be correct only under an assumption the stem does
      not state, and if not, where that rule lives as a requirement rather than an edge case?
      [Coverage, Spec §Edge Cases, §FR-016]

## Difficulty levels

- [ ] CHK029 Are the three difficulty levels defined anywhere in the requirements, or is the
      distinction left entirely to the schema's enumeration of their names? [Gap, Spec §FR-005]
- [ ] CHK030 Is each level distinguished in terms that fit a tradeoff-driven exam, rather than in
      terms borrowed from a recall-and-apply taxonomy that this exam's item style does not match?
      [Clarity, Gap, Spec §FR-005]
- [ ] CHK031 Can an item's difficulty be adjudicated by a second reader, or is the label effectively
      unfalsifiable as specified? [Measurability, Spec §FR-005]
- [ ] CHK032 Do the requirements say what a `recall` item looks like when every item is supposed to
      present a decision under a constraint — the one level the bank holds no example of?
      [Gap, Spec §FR-005]
- [ ] CHK033 Is the per-domain difficulty floor stated with its scope (domains that have reached
      target) consistently everywhere it appears? [Consistency, Spec §FR-005, §SC-005]
- [ ] CHK034 Do the requirements state whether difficulty distribution matters beyond presence — for
      instance, whether a domain may hold one `recall` item and twenty `analysis` items?
      [Gap, Coverage, Spec §FR-005]
- [ ] CHK035 Is difficulty's relationship to scoring or mock assembly stated, or explicitly declared
      irrelevant, so a reader knows whether the label carries weight beyond authoring balance?
      [Gap, Spec §FR-005]

## Select count and multiple-response items

- [ ] CHK036 Is the obligation to state the select count placed on the item's own text, with the
      reason (the candidate never infers it) stated? [Clarity, Spec §FR-014]
- [ ] CHK037 Do the requirements say whether a single-answer item must also declare its count, or
      whether silence means one? [Gap, Ambiguity, Spec §FR-014]
- [ ] CHK038 Is the declared count required to agree with the number of correct options as a stated
      requirement, rather than only as a schema constraint? [Traceability, Spec §FR-014]
- [ ] CHK039 Is "states in its own text" specific about where — the stem, an option, a separate
      field — so the requirement cannot be satisfied by metadata a candidate never sees?
      [Clarity, Spec §FR-014]
- [ ] CHK040 Is the multiple-response floor's scope (domains that have reached target) stated
      consistently with the success criterion that mirrors it? [Consistency, Spec §FR-015, §SC-006]
- [ ] CHK041 Do the requirements state an upper bound or guidance on how many options may be
      correct, or is any count admissible? [Gap, Spec §FR-015]
- [ ] CHK042 Is the decision to set a floor without a target share justified in terms a reviewer can
      apply when judging whether a domain's mix is acceptable? [Clarity, Spec §FR-015]
- [ ] CHK043 Are partial-credit and all-or-nothing scoring addressed, or explicitly declared out of
      scope, given that a multiple-response item raises the question for a learner reading a score
      report? [Gap, Coverage, Spec §FR-015]

## Consistency across the quality requirements

- [ ] CHK044 Are the item-quality requirements traceable to numbered requirements rather than living
      only in a contract, given that a reviewer may work from the spec alone? [Traceability,
      Spec §FR-008–§FR-016]
- [ ] CHK045 Do the requirements state which quality properties are mechanically checkable and which
      are review judgments, so that neither is mistaken for the other? [Clarity, Spec §FR-010,
      §FR-012, §FR-016]
- [ ] CHK046 Is the proportionality principle expressed concretely enough that a reviewer can judge
      whether a finished domain's distribution honors it, rather than only whether its total is
      met? [Measurability, Spec §FR-003, §CC-004]

## Constitutional compliance *(standing category — always include)*

- [ ] CHK047 Is the source of every exam weight and item count stated rather than assumed?
      (Principle I)
- [ ] CHK048 Is the single-source rule for study content written so a build step can enforce it?
      (Principle II)
- [ ] CHK049 Are the no-account, no-install, no-API-key, and no-analytics constraints expressed as
      testable requirements rather than aspirations? (Principle III)
- [ ] CHK050 Is weight-proportional coverage quantified concretely enough to review a design
      against? (Principle IV)
- [ ] CHK051 Are originality, attribution, and dated-source obligations covered? (Principle V)
- [ ] CHK052 Are the accessibility and performance requirements quantified? (Principle VIII)

## Notes

- Check items off as completed: `[x]`
- An item that fails is a requirement to rewrite, not a defect to log against the bank
- CHK021, CHK029, and CHK030 are the three most likely to fail together. The specification requires
  a trap type "the schema defines" and a difficulty level "the schema defines", but neither the
  trap types nor the difficulty levels are defined in prose anywhere a reviewer would look. The
  schema enumerates eight trap types with one-line descriptions and three difficulty names with
  none
- CHK032 is worth answering before the first `recall` item is written. The bank holds none, so
  there is no worked example to imitate, and a level that nobody has defined and nobody has
  demonstrated will be applied inconsistently from the first item onward
- CHK027 has no requirement behind it at all. Structural tells are the most common way an otherwise
  well-sourced item becomes answerable without knowledge, and nothing in the spec, the contracts, or
  the schema addresses them
