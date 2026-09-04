# Build progress

Task queue for the repo build. Engineering tasks are implemented by the Codex CLI
(`gpt-5.6-terra`) via the `codex-delegate` loop; each is reviewed, gate-checked, and committed by the
orchestrator. **Domain note content is written by hand** — see "Not delegated" below.

| T | Owner | Task | Status |
|---|---|---|---|
| T0 | orchestrator | Ground truth: `BLUEPRINT.md`, `AGENTS.md`, `SOURCES.md`, licenses | ✅ `adac341` |
| T1 | Codex | Scaffold: README, guide pages, `CONTRIBUTING.md`, tooling, note skeletons | ✅ `de393c2` |
| T2 | Codex | Drill engine: schema, weighted mock generator, scorer | ✅ see below |
| T3 | Codex | Lab core: package, config, keyless mock transport, ingest, output | queued |
| T4 | Codex | Tools + MCP server (stdio + HTTP) | queued |
| T5 | Codex | Agent loop, model routing, caching, batch | queued |
| T6 | Codex | Security layer + `.claude/` configuration and hooks | queued |
| T7 | Codex | Eval harness | queued |
| T8 | Codex | CI workflows + flashcard/cheatsheet generators | queued |
| T9+ | **by hand** | Domain notes, drill items | ongoing, weekly |

## Not delegated

**Domain notes and drill items.** Writing them is the studying — the repo exists to serve that, not to
replace it. Authoring a good distractor in particular demands more understanding of a concept than
answering one does. Codex builds the structure that holds them; the substance is written by hand.

**Ground truth** (`BLUEPRINT.md`, `AGENTS.md`). Transcribed by the orchestrator from the official exam
guide, because a hallucinated weight there would silently corrupt every study plan built on it.

## Review notes

### T0 — ground truth
`BLUEPRINT.md` transcribes the official exam guide v1.0 (July 2026): 8 domains, 25 sub-skills, exact
published weights. Verified that weights sum to 100.0% at both the domain and sub-skill level.

### T1 — scaffold
Gates re-run independently of Codex's self-report: `ruff check` and `ruff format --check` clean across
41 files, `pytest` 1 passed.

Verified beyond the report:
- **The structural test is not vacuous.** Mutated a domain weight in `BLUEPRINT.md`; `pytest` failed as
  intended; restored and it passed again. It parses 8 domains and all 25 sub-skills from the blueprint
  rather than hardcoding them, so it catches blueprint/repo drift.
- **No study content leaked into the skeletons.** They carry frontmatter, headings, and authoring
  prompts only — checked by reading them, since this was the constraint most at risk.
- **Facts spot-checked** against the exam guide: fee, 24-hour change deadline, ID and age rules,
  accommodations route, 14/30/90 retake ladder, 4-attempt cap, 12-month validity, the five prep-module
  durations, and the pacing math (120 ÷ 53 ≈ 2 min 15 s).

### T2 — drill engine
Gates re-run independently: `ruff` clean across 52 files, `pytest` 12 passed. Exercised the CLI
end to end (`validate`, `generate`, `score`).

**The implementer caught an error in `BLUEPRINT.md`.** The mock-composition table said Applications
and Integration 18 / Tools and MCPs 5. Apportioning 53 items by largest remainder gives **17 / 6**.
Both sum to 53, but the original split was ad-hoc rounding and misallocated one item: it left Tools
1.17 percentage points from its true weight where the correct split is 0.72 off, and total absolute
deviation across all domains is 4.58 for largest-remainder versus 4.86. `BLUEPRINT.md` and `README.md`
are corrected, and the blueprint now records the method rather than just the numbers. The engine
computes the split from the weights at runtime instead of reading the table, so the two cannot drift.

Verified beyond the report — validation was probed adversarially with six deliberately malformed
items. Correctly rejected: a sub-skill borrowed from another domain, an invalid `trap_type`, a wrong
option missing its rationale, an unknown domain, and duplicate ids. A seventh probe appeared to expose
a hole in the `select`-equals-correct-count rule, but the fixture was a no-op — the example item is
already a 2-of-N multiple-response item, so setting `select: 2` changed nothing. Retested with a
genuine mismatch and the rule fires. All six rules hold.

Grading is exact-set match with no partial credit on multiple-response items, which is the right
default absent any published statement otherwise.

## Needs your eyes

- **`LICENSE` says "Copyright (c) 2026 ccdv-f-lab contributors".** A legal name was not guessed. Set it
  to whatever you want before publishing.
- **README "Study paths" table is thin** — three rows that each say roughly "apply the weighting".
  Superseded when `study-plans/` lands; worth a rewrite then rather than now.
- **Skeleton size tracks sub-skill count, not weight.** Security and Safety (8.1%, 4 sub-skills) gets
  more skeleton than Agents and Workflows (14.7%, 3 sub-skills). Harmless for empty scaffolding, but do
  not let it set the depth of the notes you write into them — weight decides that.
- **Codex ran the linters via `uvx ruff`** because `ruff` is not on PATH directly. Worth installing it
  into the project environment so CI and local runs use one resolution path.
- **The scored report never states pass/fail against the score anchor.** It prints the estimated scaled
  score, the anchor, and readiness against this repo's stricter 85%/70% bar, leaving you to compare the
  estimate to the anchor yourself. Deliberate for now — the repo's bar is the one worth chasing — but
  say the word and it becomes one explicit line.
- **`PyYAML` and `jsonschema` are the first runtime dependencies.** Both justified: readable
  one-item-per-file storage, and Draft 2020-12 validation. Worth knowing the surface is no longer
  standard-library only.
