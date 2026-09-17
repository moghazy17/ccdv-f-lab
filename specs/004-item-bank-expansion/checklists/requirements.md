# Specification Quality Checklist: Item-bank expansion past mock quota

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-17
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Validation notes

Two issues were found on the first pass and fixed in the spec before this checklist was marked
complete.

1. **Filename leakage into requirements.** The first draft named `drills/bank/`, `SOURCES.md`, and
   `site/src/lib/attempt.ts` inside functional requirements, which fixes the solution's shape in a
   document that should state the need. Paths now appear only in the measured-context section, where
   they record what was verified, and in CC-002, where the constitution itself names the single
   source. The requirements speak of the bank, the source record, and the disclosure.
2. **An untestable duplication rule.** "No two items turn on the same fact" had no test a reviewer
   could apply. FR-012 now defines the relation: two items share a distinguishing fact when knowing
   the single passage that settles one is enough to answer the other.

The judgment call this checklist flagged — the multiple applied to each domain's quota and the floor
for the lightest domains — was settled in the clarification session of 2026-09-17 as three times
quota with a floor of six. That session also settled per-domain difficulty coverage, conformance of
the existing items to the sourcing rules, the delivery boundary, and the multiple-response floor.
All five are recorded under `## Clarifications` in the spec and integrated into the requirements.

`/speckit-analyze` then found four issues that this checklist's own "no contradictory text" pass had
missed, all of them introduced by the clarification integration rather than present in the first
draft:

- FR-004, FR-005, and FR-015 kept bank-wide wording after their matching success criteria were
  rescoped to the domains this feature covers, which made the completion condition in FR-029
  unsatisfiable. All three now bind to domains that have reached target, and name the bank-wide
  floor as the follow-on's exit condition.
- FR-001 forbade a per-domain count "anywhere in the repository", which the plan's phase table and
  the research measurement table both broke. FR-001 now forbids a hand-typed count from standing as
  the authority for a target, and both documents state where their numbers came from and that the
  report overrides them.

The lesson for the next clarification session: rescoping a success criterion means auditing every
requirement that shares its subject, not only the requirement the question named.

## Notes

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`
