# Specification Quality Checklist: Lab runner, weighted mock exam, and practice modes

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-09-06
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

## Constitutional compliance

- [x] CC-001 through CC-006 each answered in the spec, none dropped
- [x] Exam figures derived from `BLUEPRINT.md` rather than restated (FR-023, FR-024)
- [x] Single-sourcing preserved for lab code, note prompts, and flashcards (FR-001, FR-039, FR-043)
- [x] Keyless, loginless, installless throughout, with no third-party runtime request (FR-003,
  FR-004, FR-054, FR-055)
- [x] Coverage proportional to exam weight, including the one-item and two-item domains (FR-020,
  FR-035)
- [x] Practice material original with dated sources (FR-018, FR-019)
- [x] WCAG 2.1 AA, full keyboard operation, and a stated performance budget (FR-056, FR-057, SC-008)

## Notes

Eight clarifications are recorded in the spec's Clarifications section. Three were resolved before
the spec was written: the item bank is authored to full quota in this feature; a lab module is one
runnable unit of `lab/` including the two packages; and a module page carries both self-graded
recall prompts and a separately scored quiz. Five more came from the clarification pass: flashcards
carry a generated stable identifier; the browser keeps three mock attempts in full and summaries
beyond that; a domain quiz asks for that domain's mock quota; the mock's countdown is wall-clock and
an attempt that expired while the candidate was away is offered rather than scored; and a lab whose
dependencies the runtime cannot load shows its source read-only instead of a failing Run control.

Two of those came from measurement rather than judgement, and the figures are in the spec so a
reviewer can check them: a 53-item attempt snapshot is roughly 84 KB, and `lab/` and `drills/`
import `jsonschema`, `PyYAML`, and `mcp`.

Two verified facts about the repository's current state are recorded in the spec's opening section
because they bound what the feature can honestly claim: the bank supplies zero eligible items today,
and seven of eight domains have no authored notes. Requirements are written so every surface renders
that state openly rather than implying more coverage than exists.

The technology named in the user's input — an in-browser Python runtime — is quoted in the Input
block but deliberately kept out of the requirements, which state the behaviour the runtime must have
(own-origin delivery, no network reach, no credential access, off the critical path, stoppable) and
leave the mechanism to the plan.
