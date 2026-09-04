# House rules

This repo is an **unofficial, community study kit for the CCDV-F certification**
(Claude Certified Developer – Foundations). It is not affiliated with, endorsed by, or produced by
Anthropic.

Read [`BLUEPRINT.md`](BLUEPRINT.md) before doing anything here. It is the transcribed official exam
outline and the source of every weight, domain name, and sub-skill name used across the repo. Never
invent, round, or restate a weight from memory — read it from `BLUEPRINT.md`.

## Hard rules

1. **No real exam content, ever.** Every candidate signs a confidentiality agreement covering exam
   questions, answer options, and scenarios. Nothing in this repo may be a recalled, reconstructed, or
   paraphrased live exam item. Every practice item is **original**, written from the public blueprint.
   If a contribution looks like a braindump, it does not land. This protects both the contributor's
   credential and everyone who uses the repo.
2. **Do not re-host Anthropic's copyrighted material.** Link the exam guide PDF and the official docs;
   do not vendor them into the repo. Summarizing factual blueprint structure (domain names, weights,
   sub-skill names) is fine and necessary.
3. **Cite sources with dates.** Any factual claim about the exam, the API, pricing, or model behavior
   gets an entry in [`SOURCES.md`](SOURCES.md) with a link and a "verified on" date. The credential is
   valid 12 months and the guide is "subject to change" — undated claims rot silently.
4. **Never commit secrets.** No API keys, tokens, or `.env` files. The lab must run keyless in CI.

## Content conventions

- **Size to weight.** Coverage depth is proportional to a domain's exam weight. Applications and
  Integration (33.1%) gets roughly a third of all note content; Claude Code (3.1%) and Eval (2.6%) stay
  deliberately short. Do not pad a low-weight domain for symmetry — that misallocation is the exact
  mistake the repo exists to prevent.
- **Decision tables over prose.** The exam is tradeoff-driven. When a topic is a choice between
  options (workflow vs. agent, built-in tool vs. custom tool vs. Skill vs. MCP, batch vs. realtime,
  Opus vs. Sonnet vs. Haiku, stdio vs. HTTP), express it as a table with a "choose this when" column.
- **Link notes to code.** Every concept that the lab demonstrates links to the specific file in
  `lab/`, and that file links back to the note. A claim the lab can demonstrate should not be left as
  prose.
- **Tag to the blueprint.** Notes, drill items, and flashcards carry the exact domain and sub-skill
  names from `BLUEPRINT.md`, spelled identically — tooling joins on those strings.
- **US English, sentence case headings, wrap at 100 columns.**

## Code conventions

- **Python 3.11+**, standard library first. Format and lint with `ruff`; test with `pytest`.
- **Keyless by default.** Every lab entry point supports a mock transport so the full suite runs in CI
  with no API key. Tests must never require a live key or make real network calls.
- **Cheap by default.** Examples target the Haiku tier unless the point of the example is a model
  tradeoff. Document the approximate cost of any script that calls the real API.
- **Pin model versions explicitly.** Never rely on an alias resolving to a default; version pinning is
  itself a tested exam objective (Configuration Management, 4.1%).
- Type-hint public functions. Prefer clear, readable code over clever code — this repo is read as
  teaching material, so the implementation *is* the explanation.

## Prohibited in code and docs

- Process language and time-anchored phrasing: "MVP", "for now", "phase 1", "new", "recently",
  "as of today". Write what the code does, not the history of how it got there.
- Ticket, issue, or task IDs in comments.
- Commented-out code, and TODOs without a concrete owner and action.

## Gates

Run before finishing any change:

```bash
ruff check .
ruff format --check .
pytest -q
```

## Commits

**Do not run `git add` or `git commit`.** Leave work uncommitted in the working tree; the orchestrator
reviews the diff, re-runs the gates, and commits.
