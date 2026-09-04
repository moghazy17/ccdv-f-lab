# CCDV-F community study kit

[![CI](https://github.com/ahmedmoghazy/ccdv-f-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/ahmedmoghazy/ccdv-f-lab/actions/workflows/ci.yml)

This is an unofficial community study kit for Claude Certified Developer - Foundations
(CCDV-F), and is not affiliated with, endorsed by, or produced by Anthropic.

This blueprint-led repository supports study, practice, and skill-building for CCDV-F.
It is for developers preparing from the public outline, alone, with a team, or alongside the Partner
Academy preparation path.

The domain structure below is transcribed from [BLUEPRINT.md](BLUEPRINT.md). That file is the local
source of truth for this kit. The underlying exam source and its verification date are in
[SOURCES.md](SOURCES.md).

**No braindumps.** Every practice item here is original, written from the public blueprint. Recalled
exam questions are never accepted — see [CONTRIBUTING.md](CONTRIBUTING.md) for why that rule protects
both you and the project.

## Exam weighting

| # | Domain | Weight | Approximate items |
|---|---|---:|---:|
| 1 | Agents and Workflows | 14.7% | ~8 |
| 2 | Applications and Integration | 33.1% | ~17 |
| 3 | Claude Code | 3.1% | ~2 |
| 4 | Eval, Testing, and Debugging | 2.6% | ~1 |
| 5 | Model Selection and Optimization | 16.8% | ~9 |
| 6 | Prompt and Context Engineering | 11.0% | ~6 |
| 7 | Security and Safety | 8.1% | ~4 |
| 8 | Tools and MCPs | 10.6% | ~6 |
| | Total | 100% | 53 |

> **Where the points are:** Domains 2 and 5 together are 49.9% of the exam. Claude Code is about
> 2 items and Eval, Testing, and Debugging is about 1 item. Let that weighting, rather than novelty,
> decide how you spend study time.

## Quickstart

Everything runs without an API key. The lab defaults to a mock transport, so the full suite — tests,
drills, and evals — works offline and in CI with no credentials.

```bash
git clone https://github.com/ahmedmoghazy/ccdv-f-lab.git
cd ccdv-f-lab
pip install -e .

pytest -q                                  # the whole suite, keyless
python tools/check_blueprint_consistency.py # nothing has drifted from the blueprint
python -m drills.engine validate            # every practice item is well-formed
python -m drills.engine generate --seed 1   # build a weight-proportional mock
python -m lab.evals run                     # the reference app's eval suite
```

To exercise the reference application against the real Claude API, set `ANTHROPIC_API_KEY` and select
the live transport — see [lab/README.md](lab/README.md), which also documents the cost of a full run.

## How to use this repo to study

Work through it in this order.

1. **[guide/](guide/)** — start here. Eligibility and registration (including the Partner Network
   email requirement that catches people out), exam-day rules, and a cross-map from the free Anthropic
   Academy prep modules onto the eight blueprint domains, so you can study against the blueprint
   rather than in course order.
2. **[study-plans/](study-plans/)** — pick a time budget. Each plan allocates hours across domains in
   proportion to their exam weight, with the arithmetic shown.
3. **[notes/](notes/)** — the per-domain write-ups, sized to weight. Write them as you study; that is
   the highest-retention part of preparing, and the skeletons give you a consistent structure.
4. **[lab/](lab/)** — a working Claude application, `triage`, that demonstrates the concepts as running
   code: pinned models, adaptive thinking, structured output, tool use, an MCP server, prompt caching,
   the batch path, guardrails, and an eval harness. The exam guide tells candidates to build exactly
   this; cite it from your notes rather than re-explaining it in prose.
5. **[drills/](drills/)** — write practice items, then take weighted mocks. Authoring a good distractor
   forces more understanding of a concept than answering one does.
6. **[cheatsheets/](cheatsheets/)** and **[flashcards/](flashcards/)** — generated from your notes for
   final review. Run `python tools/build_cheatsheets.py` and `python tools/build_flashcards.py`.

**Readiness bar:** the published cut score is 720 on a 100–1000 scale, but the mapping to
percent-correct is not published. Target 85% or better on weighted mocks with no domain below 70%
before booking.

## Repository map

| Path | Purpose |
|---|---|
| [guide/](guide/) | Exam logistics, exam-day expectations, and a course-to-blueprint cross-map. |
| [notes/](notes/) | Blueprint-tagged study-note skeletons, organized by domain. |
| [drills/](drills/) | Original practice material, the item schema, and the weighted mock engine. |
| [lab/](lab/) | The `triage` reference application — keyless, tested, linked back to notes. |
| [lab/evals/](lab/evals/) | Eval harness attributing each failure to the integration layer or the model. |
| [tools/](tools/) | Link checker, blueprint anti-drift gate, and the cheat-sheet and flashcard generators. |
| [cheatsheets/](cheatsheets/) | Generated one-page reviews, one per domain. |
| [flashcards/](flashcards/) | Generated TSV for Anki or Quizlet. |
| [study-plans/](study-plans/) | Weight-proportional schedules for 1, 3, and 6 weeks. |
| [workflows](.github/workflows/) | Continuous-integration workflows for repository gates. |
| [tests/](tests/) | The test suite, including the checks that keep the tree aligned with the blueprint. |
| [Blueprint](BLUEPRINT.md) | Local outline transcription; source of truth for names and weights. |
| [SOURCES.md](SOURCES.md) | Dated source register for factual claims. |

## How this repo stays honest

The kit's central claim is that its coverage is weighted to the real exam outline, so that claim is
enforced rather than asserted. `tools/check_blueprint_consistency.py` runs in CI and fails the build
if domain weights stop summing to 100, if a domain's sub-skill weights stop summing to that domain's
weight, if a `notes/` directory and a blueprint domain stop corresponding, if a drill item names a
sub-skill that does not belong to its domain, if the weight table above stops matching
[BLUEPRINT.md](BLUEPRINT.md), or if a generated mock drifts more than one item from the published
weights.

The blueprint itself is pinned to a version — exam guide v1.0, effective July 2026 — and the guide is
explicitly subject to change. Re-check it against `BLUEPRINT.md` before trusting these numbers.

## Coverage

Note trees are scaffolds until written. They give a consistent, weight-sized structure without
presenting uncited material as settled guidance.

| Domain | Notes |
|---|---|
| Agents and Workflows | Skeleton |
| Applications and Integration | Skeleton |
| Claude Code | Skeleton |
| Eval, Testing, and Debugging | Skeleton |
| Model Selection and Optimization | Skeleton |
| Prompt and Context Engineering | Skeleton |
| Security and Safety | Skeleton |
| Tools and MCPs | Skeleton |

## License

Code is MIT; written study content is CC BY 4.0. Neither extends to Anthropic's material — the exam
guide and documentation are linked, never reproduced. See [LICENSE](LICENSE).
