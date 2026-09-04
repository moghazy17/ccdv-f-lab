# CCDV-F Blueprint

The authoritative content outline for **Claude Certified Developer – Foundations**, transcribed from
the official exam guide.

> **Source of truth:** [Claude Certified Developer – Foundations Exam Guide][guide] — **version 1.0,
> effective July 2026**, exam code `CCDV-F`. The guide states it is *subject to change without notice*;
> re-check it against this file before trusting these numbers. Last verified: **2026-09-04**.
>
> This is an unofficial community transcription. Where this file and the official guide disagree, the
> official guide wins. Weights are reproduced as published; descriptions are paraphrased.

## Exam facts

| | |
|---|---|
| Items | **53** |
| Item format | Multiple-choice **and multiple-response** — each item states how many responses to select |
| Time limit | **120 minutes** (~135 min total seat time incl. check-in and survey) |
| Passing score | **720**, on a scaled range of **100–1000** |
| Fee | **$125 USD** (partner-tier discounts may apply at checkout) |
| Delivery | Pearson VUE — online-proctored and/or test center |
| Validity | **12 months** from the award date |
| Renewal | **Free, non-proctored** assessment on Partner Academy if done on time; a lapsed credential requires the full exam at full fee |
| Retakes | **14 / 30 / 90-day** waits after the 1st / 2nd / 3rd failure; max **4 attempts per rolling 12 months**; fee applies each time |
| Prerequisites | **None mandatory.** Awarded on exam performance alone |
| Scoring | Criterion-referenced against a fixed standard, not a curve. Score report shows **percent-correct per domain** (informational — only the total scaled score determines pass/fail) |

## Domains

| # | Domain | Weight | ~Items |
|---|---|---:|---:|
| 1 | Agents and Workflows | 14.7% | ~8 |
| 2 | **Applications and Integration** | **33.1%** | **~17** |
| 3 | Claude Code | 3.1% | ~2 |
| 4 | Eval, Testing, and Debugging | 2.6% | ~1 |
| 5 | **Model Selection and Optimization** | **16.8%** | **~9** |
| 6 | Prompt and Context Engineering | 11.0% | ~6 |
| 7 | Security and Safety | 8.1% | ~4 |
| 8 | Tools and MCPs | 10.6% | ~6 |
| | **Total** | **100%** | **53** |

**Domains 2 + 5 are 49.9% of the exam.** Claude Code is ~2 items and Eval ~1 — budget study time
accordingly, not by how interesting a domain sounds.

## Sub-skills

25 sub-skills, each with its published share of the **overall** exam. `~Items` is that share of 53.

### Domain 1 — Agents and Workflows (14.7%)

| Sub-skill | Weight | ~Items | Measured |
|---|---:|---:|---|
| Agent Construction with Claude | 5.3% | ~2.8 | Claude Agent SDK; custom agent loops and harnesses; **managed agent deployment models (self-hosted vs. Anthropic-hosted)**; hooks for deterministic actions |
| Agent Patterns and Frameworks | 4.9% | ~2.6 | Tool-use loops, sub-agents, memory, context-window management; agentic abstraction frameworks (Strands, LangGraph, PydanticAI) for multi-step tasks |
| Agent Architecture | 4.5% | ~2.4 | Decision criteria for **workflow vs. agent**; manager/supervisor hierarchies; the role of subagents in task execution |

### Domain 2 — Applications and Integration (33.1%)

| Sub-skill | Weight | ~Items | Measured |
|---|---:|---:|---|
| **Claude Application Design** | **8.6%** | ~4.6 | How Claude interprets instructions **across interfaces** (Claude Code, Desktop, claude.ai, API, SDKs); content boundaries; schema design; session hygiene; plugin management |
| Software Engineering Foundations | 7.4% | ~3.9 | REST APIs, JSON, asynchronous programming, version control, SDLC integration, code review, small- and large-scale refactoring |
| Claude API Mechanics | 6.8% | ~3.6 | Messages, tools, streaming, vision, thinking, caching; invoking Claude via third-party vendors; Messages API data access patterns; **Batch API and realtime-vs-batch tradeoffs** |
| Configuration Management | 4.1% | ~2.2 | `CLAUDE.md` files, `settings.json`, **model version pinning**, prompt versioning, plugin dependencies |
| Understanding Requirements | 3.4% | ~1.8 | Deriving functional and infrastructure requirements from business requirements and solution architecture |
| Systems Life Cycle | 2.8% | ~1.5 | Life-cycle concepts and frameworks for developing, implementing, operating, and maintaining IT systems |

### Domain 3 — Claude Code (3.1%)

| Sub-skill | Weight | ~Items | Measured |
|---|---:|---:|---|
| Claude Code Operation | 3.1% | ~1.6 | Core components (Rules, Skills, Commands, Agents, Agent Memory); features (session management, built-in and custom slash commands, headless mode, streaming mode, auto-mode); the **`CLAUDE.md` hierarchy**; repository initialization; `settings.json` |

### Domain 4 — Eval, Testing, and Debugging (2.6%)

| Sub-skill | Weight | ~Items | Measured |
|---|---:|---:|---|
| Debugging and Error Handling | 2.6% | ~1.4 | Error type identification; recovery strategy selection; trace analysis to identify failure modes; **isolating problem origin between the integration layer and model output** |

### Domain 5 — Model Selection and Optimization (16.8%)

| Sub-skill | Weight | ~Items | Measured |
|---|---:|---:|---|
| Technical Fundamentals | 6.1% | ~3.2 | Foundational engineering practice for AI apps — integrating with SDKs that wrap REST APIs, websockets |
| LLM Fundamentals | 5.2% | ~2.8 | Tokens, context windows, sampling, non-determinism, next-token generation; model options (**fast mode, extended thinking, adaptive thinking, effort levels**); zero-/single-/multi-shot prompting |
| Cost and Token Management | 2.8% | ~1.5 | Token budgeting, usage tracking, cost modeling; **prompt caching and cache check-pointing** |
| Model Selection and Tradeoffs | 2.7% | ~1.4 | Opus vs. Sonnet vs. Haiku use cases; adaptive thinking support; quality/latency/cost tradeoffs; **breaking behavior changes across model releases** |

### Domain 6 — Prompt and Context Engineering (11.0%)

| Sub-skill | Weight | ~Items | Measured |
|---|---:|---:|---|
| Prompt Engineering | 4.6% | ~2.4 | Instruction clarity; few-shot examples; **system vs. user placement**; output constraints; prompt placement across components; iterative refinement; input sanitization |
| Context Engineering | 3.8% | ~2.0 | Context window management; preventing **context drift and bloat** (tool-output pruning, compaction); context isolation via subagents or multi-step agentic workflows |
| Output Handling | 2.6% | ~1.4 | Structured output patterns; response validation; **defensive parsing**; skepticism toward confident output |

### Domain 7 — Security and Safety (8.1%)

| Sub-skill | Weight | ~Items | Measured |
|---|---:|---:|---|
| AI Application Security | 3.2% | ~1.7 | **Prompt injection** awareness and mitigation; jailbreak defense; untrusted input handling; data leakage prevention; PII handling; authentication, authorization, confidentiality, privacy, integrity |
| Guardrails and Safe Deployment | 2.3% | ~1.2 | Content policy; **guardrail layering**; secure-by-design principles (privacy, IAM, least privilege) |
| Identity, Secrets, and Key Management | 1.6% | ~0.8 | Secrets, credentials, and API keys across dev and prod; identity validation; access approval and level verification; authorized access monitoring |
| Claude Hooks | 1.0% | ~0.5 | Hooks as guardrails and safety controls to **prevent destructive actions** |

### Domain 8 — Tools and MCPs (10.6%)

| Sub-skill | Weight | ~Items | Measured |
|---|---:|---:|---|
| Tool Implementation | 4.4% | ~2.3 | Tool use and function calling; configuration for external systems; **writing tool descriptions**; error handling; usage patterns (agentic harness dispatch, client- vs. server-side tools, approval patterns); tool set construction |
| Agentic Customization | 4.1% | ~2.2 | Tradeoffs among **built-in Tools, custom Tools, Skills, and MCPs** — selecting the right one per use case |
| MCP Server Development | 2.1% | ~1.1 | Server authoring, deployment, and integration; MCP **resources, tools, and prompts**; communication patterns (**stdio, sockets**, client vs. server) |

## Weighted mock composition

A representative 53-item mock draws items in these proportions. Counts use **largest-remainder
apportionment**, so they sum to exactly 53 — which is why Applications and Integration gets 17 rather
than the 17.5 its weight implies. `drills/engine` computes this from the weights above at runtime
rather than reading this table, and the tests assert the two agree.

| Domain | Weight | Items |
|---|---:|---:|
| Applications and Integration | 33.1% | 17 |
| Model Selection and Optimization | 16.8% | 9 |
| Agents and Workflows | 14.7% | 8 |
| Prompt and Context Engineering | 11.0% | 6 |
| Tools and MCPs | 10.6% | 6 |
| Security and Safety | 8.1% | 4 |
| Claude Code | 3.1% | 2 |
| Eval, Testing, and Debugging | 2.6% | 1 |
| **Total** | **100%** | **53** |

## How to prepare (per the official guide)

The guide names no required course and guarantees no resource produces a pass. It recommends:

- Self-assess against every objective in this blueprint
- Review official Anthropic documentation for the Claude API, models, prompt engineering, Claude Code,
  Skills, and MCP
- **Build and operate at least one Claude application** exercising the API, one or more tools, basic
  prompt and context engineering, and simple security and evaluation practices — this repo's
  [`lab/`](lab/) exists to be that application
- Practise the competencies directly: writing prompts and system instructions, building agents and
  workflows, configuring Claude Code, managing tokens and cost, implementing guardrails, and creating
  custom tools or MCP servers

[guide]: https://everpath-course-content.s3-accelerate.amazonaws.com/instructor/6nizmqk8tpzpfjvt6qmmav7rh/public/1783542875/Claude+Certified+Developer+%E2%80%93+Foundations+Exam+Guide.pdf
