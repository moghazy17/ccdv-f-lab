# Sources

Every factual claim in this repo about the exam, the Claude API, models, or pricing traces to an entry
here. Each entry carries a **verified on** date, because the credential is valid for only 12 months and
the exam guide is explicitly "subject to change without notice" — an undated claim rots silently.

**When you add a claim, add its source. When you re-check a source, update its date.**

## Primary — the exam

| Source | What it establishes | Verified |
|---|---|---|
| [Claude Certified Developer – Foundations Exam Guide (PDF)][guide] — v1.0, effective July 2026 | The whole of [`BLUEPRINT.md`](BLUEPRINT.md): 8 domains, 25 sub-skills, exact weights, 53 items, 120 min, 720/1000 cut score, $125 fee, 12-month validity, retake ladder, no prerequisites, scoring model, exam-day rules, NDA, renewal | 2026-09-04 |
| [Certification FAQ][faq] — Anthropic Partner Academy | Four certifications and fees; 720 cut score across all four; 120-min format; retake waits; 12-month validity; **registration requires a Partner Network organization email on a recognized company domain** | 2026-09-04 |
| [CCDV-F prep path][path] — Anthropic Partner Academy | The 5 prep modules and their durations; the 9 recommended prerequisite courses | 2026-09-04 |
| [Certification prep courses index][prep] | Which prep track maps to which credential | 2026-09-04 |

## Primary — the technology

Claims about API behavior, model tiers, Claude Code, Skills, and MCP should cite Anthropic's official
documentation rather than a community summary. Add rows as notes are written.

| Source | What it establishes | Verified |
|---|---|---|
| [Models overview][models] — Anthropic | The current lineup with model IDs, context windows, max output, and per-MTok pricing; which models take adaptive versus extended thinking; the default effort level, and that Claude Haiku 4.5 does not support effort at all; that every model ID is a pinned snapshot, including the dateless ones; batch at 50% of synchronous price and cache reads at 10% of base input; the published retirement commitments | 2026-09-05 |
| [Steering thinking][steering] — Anthropic | The effort levels and what each does, with `high` as the default; that effort is set at `output_config.effort` rather than inside `thinking`; that changing effort mid-conversation invalidates the prompt cache while restating the default does not; that thinking counts toward `max_tokens` and there is no separate thinking budget; that billing covers the full reasoning regardless of the `display` setting; `usage.output_tokens_details.thinking_tokens` | 2026-09-05 |

## Deliberately not sources

- **Third-party practice-test vendors and exam-dump sites.** Not cited here at any point. They are
  frequently wrong, and the ones claiming real exam questions are trading in material every candidate
  is contractually barred from disclosing.
- **Other community study repos.** Useful for gauging what already exists; not evidence for a factual
  claim. If a claim only traces to another community repo, it is not sourced.

[guide]: https://everpath-course-content.s3-accelerate.amazonaws.com/instructor/6nizmqk8tpzpfjvt6qmmav7rh/public/1783542875/Claude+Certified+Developer+%E2%80%93+Foundations+Exam+Guide.pdf
[faq]: https://anthropic-partners.skilljar.com/page/faq-certifications
[path]: https://anthropic-partners.skilljar.com/path/claude-certified-developer-foundations
[prep]: https://anthropic-partners.skilljar.com/page/claude-certification-exam-prep-courses
[models]: https://platform.claude.com/docs/en/about-claude/models/overview
[steering]: https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost
