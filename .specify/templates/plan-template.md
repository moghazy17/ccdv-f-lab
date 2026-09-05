# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

[Extract from feature spec: primary requirement + technical approach from research]

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: [e.g., Python 3.11, Swift 5.9, Rust 1.75 or NEEDS CLARIFICATION]  
**Primary Dependencies**: [e.g., FastAPI, UIKit, LLVM or NEEDS CLARIFICATION]  
**Storage**: [if applicable, e.g., PostgreSQL, CoreData, files or N/A]  
**Testing**: [e.g., pytest, XCTest, cargo test or NEEDS CLARIFICATION]  
**Target Platform**: [e.g., Linux server, iOS 15+, WASM or NEEDS CLARIFICATION]
**Project Type**: [e.g., library/cli/web-service/mobile-app/compiler/desktop-app or NEEDS CLARIFICATION]  
**Performance Goals**: [domain-specific, e.g., 1000 req/s, 10k lines/sec, 60 fps or NEEDS CLARIFICATION]  
**Constraints**: [domain-specific, e.g., <200ms p95, <100MB memory, offline-capable or NEEDS CLARIFICATION]  
**Scale/Scope**: [domain-specific, e.g., 10k users, 1M LOC, 50 screens or NEEDS CLARIFICATION]

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluate each gate against `.specify/memory/constitution.md` v1.0.0. Mark PASS, or record the
violation in Complexity Tracking below with the simpler alternative that was rejected and why.

- [ ] **I. Blueprint is the source of truth** — every domain name, sub-skill name, weight, and item
      count this feature displays is derived from `BLUEPRINT.md` by a build step rather than
      hand-typed, and `tools/check_blueprint_consistency.py` covers the derived artifact.
- [ ] **II. Single-sourced content** — no study markdown is copied or paraphrased into this feature's
      tree; content is rendered at build time from `notes/`, `cheatsheets/`, `guide/`,
      `study-plans/`, and `drills/bank/`.
- [ ] **III. Keyless, loginless, installless** — no account, sign-in, installation, or
      `ANTHROPIC_API_KEY` appears in any user journey; labs use the mock transport; learner state is
      local and exportable; no analytics and no third-party runtime requests.
- [ ] **IV. Coverage is proportional to exam weight** — depth, prominence, and practice volume track
      the published weights, and the design does not render the eight domains as visually equal.
- [ ] **V. Original material only** — no recalled exam content; Anthropic material is linked, never
      vendored; new factual claims carry dated `SOURCES.md` entries; the unofficial disclaimer stays
      visible.
- [ ] **VI. Gates are non-negotiable** — `ruff check .`, `ruff format --check .`, `pytest -q`,
      `tools/check_blueprint_consistency.py`, `tools/check_links.py`, and this feature's own build,
      lint, type-check, and test commands are wired into CI.
- [ ] **VII. The implementation is teaching material** — public functions type-hinted, model versions
      pinned explicitly rather than resolved through an alias, demonstrated concepts cross-linked to
      the notes.
- [ ] **VIII. Accessible and fast by default** — WCAG 2.1 AA, full keyboard operation, a stated
      performance budget, no heavy runtime on the critical path, and defined behavior when local
      storage is unavailable or full.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
# [REMOVE IF UNUSED] Option 1: Single project (DEFAULT)
src/
├── models/
├── services/
├── cli/
└── lib/

tests/
├── contract/
├── integration/
└── unit/

# [REMOVE IF UNUSED] Option 2: Web application (when "frontend" + "backend" detected)
backend/
├── src/
│   ├── models/
│   ├── services/
│   └── api/
└── tests/

frontend/
├── src/
│   ├── components/
│   ├── pages/
│   └── services/
└── tests/

# [REMOVE IF UNUSED] Option 3: Mobile + API (when "iOS/Android" detected)
api/
└── [same as backend above]

ios/ or android/
└── [platform-specific structure: feature modules, UI flows, platform tests]
```

**Structure Decision**: [Document the selected structure and reference the real
directories captured above]

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
