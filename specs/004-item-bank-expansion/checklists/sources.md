# Source fidelity and originality checklist: item-bank expansion

**Purpose**: Unit-test the *requirements* governing what an item may cite, what a citation's date
means, how a citation and its record are kept in agreement, how originality is applied to a specific
item, and what happens when a cited page moves under the item.
**Created**: 2026-09-17
**Feature**: [spec.md](../spec.md)

**Audience and depth**: a reviewer reading a pull request that adds items, at standard depth. The
brief fixes the audience ("how a reviewer can tell"), so no clarifying questions were asked.

**Note**: This checklist tests whether the requirements are written well enough to review against.
It does not test the bank, the gate, or any item.

## What qualifies as a source

- [ ] CHK001 Is the admitted set of sources written so that a specific URL can be judged in or out
      without interpretation? [Clarity, Spec §FR-017]
- [ ] CHK002 Does "Anthropic's product documentation" state whether Anthropic's engineering blog and
      support articles are inside or outside it? Both are cited by the bank today
      (`www.anthropic.com/engineering`, `support.claude.com`). [Ambiguity, Spec §FR-017]
- [ ] CHK003 Do the requirements say whether an open-specification site that Anthropic does not
      publish — `modelcontextprotocol.io`, cited by two items — is an authoritative source for an
      item about MCP? [Gap, Spec §FR-017]
- [ ] CHK004 Is the exam guide's identity defined by what it is rather than where it is served,
      given that it is cited through a third-party content-delivery host rather than an Anthropic
      domain? [Clarity, Spec §FR-017]
- [ ] CHK005 Is the repository-source-file exception bounded by a stated condition ("tests something
      this repository's own reference application demonstrates") that a reviewer can apply to a
      specific item, rather than by the file's location alone? [Measurability, Spec §FR-017]
- [ ] CHK006 Do the requirements state whether a repository source file is cited by permanent link
      or by mutable branch reference, given that a branch link's content changes under the item?
      [Gap, Spec §FR-017]
- [ ] CHK007 Is the non-source list ("a community summary, an aggregator, or an assistant's
      recollection") expressed as a closed rule rather than examples, so a reviewer can rule out a
      source type it does not name? [Clarity, Spec §FR-017]
- [ ] CHK008 Where an item cites more than one source, do the requirements state whether every
      citation must be authoritative, or only one of them? [Coverage, Gap, Spec §FR-017]

## What the date means and how it is judged

- [ ] CHK009 Is `verified_on` defined as an event ("the date the page was read during authoring")
      rather than a formatting rule, in terms a reviewer can dispute? [Clarity, Spec §FR-018]
- [ ] CHK010 Do the requirements name any reviewable signal that a page was actually read — the
      passage cited, a quoted phrase, a section anchor — or does the rule rest entirely on the
      author's assertion? [Gap, Spec §FR-018]
- [ ] CHK011 Is the ordering rule between an item's date and its record's date stated with its
      direction and its reason, so a reviewer knows which of the two is wrong when they disagree?
      [Clarity, Spec §FR-020]
- [ ] CHK012 When an item is read more recently than the record, do the requirements state whether
      the record must be re-dated, or whether the newer item date simply stands? [Gap, Spec §FR-020]
- [ ] CHK013 Is there a stated maximum age beyond which a citation is considered stale and must be
      re-read, given that the credential is annual and the exam guide is "subject to change"?
      [Gap, Spec §FR-018]
- [ ] CHK014 Do the requirements distinguish the date a page was read from the date an item was
      written, in a way that survives an item being edited later without its source being re-read?
      [Coverage, Gap, Spec §FR-018]

## Citation and record kept consistent by a check

- [ ] CHK015 Is the citation-to-record agreement assigned to a repeatable check rather than to
      reviewer attention, in the requirement itself and not only in a contract document?
      [Measurability, Spec §FR-020]
- [ ] CHK016 Are both failure kinds — a cited page with no record, and an item predating its record
      — stated as requirements rather than left to the checker to design? [Completeness,
      Spec §FR-020]
- [ ] CHK017 Do the requirements define when two URLs are the same URL, so that a trailing slash, a
      scheme change, a fragment, or a tracking parameter cannot split one page into two records?
      [Gap, Ambiguity, Spec §FR-019]
- [ ] CHK018 Is the ordering obligation ("added before the item that cites it") expressed as a
      reviewable property of the final state, rather than as an unobservable claim about the order
      two files were edited in? [Measurability, Spec §FR-019]
- [ ] CHK019 Do the requirements state what the record's "what it establishes" text must contain for
      a row to count as a record, or is any non-empty prose sufficient? [Gap, Spec §FR-019]
- [ ] CHK020 Is the absence of an exemption list stated as a requirement, including for items
      authored before this feature? [Completeness, Spec §FR-021]
- [ ] CHK021 Do the requirements state explicitly which checks are mechanical and which remain human
      judgment, so a reader does not assume a green gate means the citation supports the claim?
      [Clarity, Spec §FR-020, §SC-010]
- [ ] CHK022 Is the check's scope stated as local-file-only, so that a requirement is not read as
      obliging the gate to fetch a cited page — which would contradict the keyless, offline-capable
      constraint? [Consistency, Spec §CC-003]

## Originality, applied to one item

- [ ] CHK023 Is the no-recalled-content rule accompanied by anything a reviewer can apply to a
      *specific* item, or is it stated only as a prohibition on a category of behavior? [Gap,
      Spec §FR-008]
- [ ] CHK024 Do the requirements name the observable signals that distinguish an original item from
      a recalled one — derivation from a named blueprint sub-skill, a cited passage that settles it,
      a scenario the author constructed — rather than leaving the judgment unanchored?
      [Measurability, Spec §FR-008]
- [ ] CHK025 Is the relationship between originality and sourcing stated, so that an item traceable
      to a public page is not thereby assumed original, and an original item is not assumed
      sourced? [Consistency, Spec §FR-008, §FR-017]
- [ ] CHK026 Do the requirements address provenance for authoring that is delegated to another tool
      or contributor, given that the plan forbids delegating factual sourcing but the spec does not
      say so? [Gap, Spec §FR-008]
- [ ] CHK027 Is the consequence of a suspected recalled item stated — withdrawal, rewrite, or
      review escalation — rather than only the prohibition? [Coverage, Gap, Spec §FR-008]
- [ ] CHK028 Is the originality rule stated as admitting no degrees, so that "substantially
      reworded" cannot be argued as compliance? [Clarity, Spec §FR-008, §CC-005]

## When a cited page changes, moves, or disappears

- [ ] CHK029 Is the behavior for a cited page that no longer states the claim expressed as a
      requirement, or does it appear only as an edge case with no requirement behind it? [Gap,
      Spec §Edge Cases]
- [ ] CHK030 Do the requirements distinguish a page that *changed* from one that *disappeared*, and
      state whether the two are handled the same way? [Completeness, Gap, Spec §Edge Cases]
- [ ] CHK031 Is "corrected or withdrawn, not re-dated" stated with the condition that selects
      between correcting and withdrawing? [Clarity, Spec §Edge Cases]
- [ ] CHK032 Do the requirements say who is obliged to notice that a page has changed, and at what
      moment — authoring, review, or a periodic sweep — given that no check can detect it? [Gap,
      Spec §FR-020]
- [ ] CHK033 Is the unopenable-page rule ("the item is not added, the blocked sub-skill is
      reported") extended to a page that becomes unopenable *after* its item landed?
      [Coverage, Gap, Spec §FR-022]
- [ ] CHK034 Do the requirements state whether a link-rot fix may substitute a different URL for the
      same claim, and whether that resets the read date? [Gap, Spec §FR-018, §FR-020]
- [ ] CHK035 Is the no-re-hosting obligation reconciled with the durability problem it creates — a
      citation cannot be preserved by copying the page — so that a reviewer does not resolve link
      rot by vendoring? [Consistency, Spec §CC-005]
- [ ] CHK036 Are the existing bank's known record gaps described in the requirements as work this
      feature owns, rather than as a discovery left to the implementer? [Completeness, Spec §FR-021]

## Consistency with the rest of the specification

- [ ] CHK037 Are the sourcing requirements consistent with the delivery boundary, so that "every
      item in the bank" in the completion condition is unambiguous about items the follow-on has not
      yet authored? [Consistency, Spec §FR-021, §FR-029]
- [ ] CHK038 Is the term used for the citation record consistent across the requirements — "source
      record", "dated entry", "row" — or does the drift invite two readings? [Consistency,
      Spec §FR-019, §FR-020]
- [ ] CHK039 Do the success criteria for sourcing state a measurable outcome rather than restating
      the requirement, and is "in under a minute" attached to a stated reviewer action?
      [Measurability, Spec §SC-007, §SC-010]
- [ ] CHK040 Is every sourcing obligation traceable to a numbered requirement, with none of them
      living only in a contract or quickstart document? [Traceability, Spec §FR-017–§FR-022]

## Constitutional compliance *(standing category — always include)*

- [ ] CHK041 Is the source of every exam weight and item count stated rather than assumed?
      (Principle I)
- [ ] CHK042 Is the single-source rule for study content written so a build step can enforce it?
      (Principle II)
- [ ] CHK043 Are the no-account, no-install, no-API-key, and no-analytics constraints expressed as
      testable requirements rather than aspirations? (Principle III)
- [ ] CHK044 Is weight-proportional coverage quantified concretely enough to review a design
      against? (Principle IV)
- [ ] CHK045 Are originality, attribution, and dated-source obligations covered? (Principle V)
- [ ] CHK046 Are the accessibility and performance requirements quantified? (Principle VIII)

## Notes

- Check items off as completed: `[x]`
- An item that fails is a requirement to rewrite, not a defect to log against the bank
- CHK002, CHK003, CHK004, and CHK006 were raised by a host survey of the existing bank: it cites
  `platform.claude.com`, `code.claude.com`, `www.anthropic.com`, `support.claude.com`,
  `modelcontextprotocol.io`, `github.com`, and a third-party content-delivery host serving the exam
  guide. FR-017 names three admitted categories, and at least four of those hosts are not obviously
  inside any of them — while FR-021 requires the whole bank to conform with no exemption
- CHK010 and CHK023 are the two most likely to fail. Both describe rules the specification asserts
  but gives a reviewer no way to apply to a specific item
