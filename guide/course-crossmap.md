---
title: Course-to-blueprint cross-map
sources:
  - SOURCES.md
verified_on: 2026-09-04
---

# Course-to-blueprint cross-map

This is a reasoned estimate from the preparation path's module titles and durations, not an official
Anthropic mapping. Study in blueprint order and supplement objectives that a title does not clearly
name. Course names, durations, and prerequisite recommendations are recorded in the dated
[prep-path source](../SOURCES.md).

The preparation path is **Claude Certified Developer - Foundations Prep Course**. It has these five
modules:

| Key | Module | Duration | Estimated domains |
|---|---|---:|---|
| M1 | MSO Foundations | 57 min | 5 primary; 6 supporting |
| M2 | Production-Grade Prompting, Agents & Tool Use | 209 min | 1, 6, 8 |
| M3 | Claude Code, MCP & Integration | 142 min | 2, 3, 8 |
| M4 | Production Engineering, Evals & Security | 211 min | 2, 4, 7 |
| M5 | Accelerators & IP Contribution | 155 min | 2 supporting; 5 supporting |

Domain numbers in this table use the exact names and weights in [BLUEPRINT.md](../BLUEPRINT.md).

## Domain-first path

The recommended prerequisite courses are keyed here:

- P1: Claude 101
- P2: Claude Code 101
- P3: Claude Platform 101
- P4: Claude Code in Action
- P5: AI Fluency: Framework & Foundations
- P6: Building with the Claude API
- P7: Introduction to Model Context Protocol
- P8: Model Context Protocol: Advanced Topics
- P9: AI Capabilities and Limitations

| Domain | Modules | Prerequisite courses | Coverage signal |
|---|---|---|---|
| 1 Agents and Workflows | M2 | P1, P5, P9 | Direct |
| 2 Applications and Integration | M3, M4, M5 | P3, P4, P6 | Broad but split |
| 3 Claude Code | M3 | P2, P4 | Direct |
| 4 Eval, Testing, and Debugging | M4 | P6, P9 | **Supplement** |
| 5 Model Selection and Optimization | M1, M5 | P1, P3, P5, P9 | **Supplement** |
| 6 Prompt and Context Engineering | M1, M2 | P1, P5, P9 | Direct |
| 7 Security and Safety | M4 | P3, P5 | Direct |
| 8 Tools and MCPs | M2, M3 | P6, P7, P8 | Direct |

The clearest thin-coverage signals are Domains 4 and 5. “Debugging” is not explicit in the path title.
Domain 5 has only a 57-minute direct module despite its 16.8% blueprint weight. Domain 2 is broad and
split across several titles. Compare its six blueprint sub-skills against official documentation rather
than assuming a single module covers every one. These are planning inferences from labels and durations,
not claims about the course's internal lessons.
