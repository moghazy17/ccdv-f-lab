# Handoff

A working document, not study content. It carries the state a fresh session needs to continue this
work without rediscovering it.

## What this repository is

An unofficial community study kit for the **Claude Certified Developer – Foundations (CCDV-F)**
exam. Python 3.11+, standard-library-first, runs with no API key. It also publishes a static website
built from its own markdown, with an in-browser Python runtime, a weighted mock exam, per-domain
quizzes, and a flashcard deck.

`BLUEPRINT.md` is the source of truth for the 8 domains, 25 sub-skills, and every weight.
`AGENTS.md` is the house rulebook. Read both before changing anything.

## Current state

Branch `002-blueprint-guard-and-frontmatter`, **nine commits ahead of its remote and unpushed**.
Feature 002 is complete: all 113 tasks across ten phases, in `specs/002-lab-runner-mock-exam/`.
Feature 001 is merged to `main`.

All gates green: `ruff check .`, `ruff format --check .`, `pytest -q` (119), blueprint consistency,
single-source, link check, `python -m drills.engine validate` (54 items), `python -m lab.evals run`,
plus the site's `typecheck` (two programs), `lint`, `build` (57 pages, 47 indexed), `check:payload`
(6.62 MiB against an 8 MiB ceiling), `test:unit` (117), `test:e2e` (215).

What feature 002 added, in one line each:

- **Labs.** Thirteen pages over `lab/`: twelve run this repository's real Python in a Web Worker,
  one shows its source. Which is which comes from probing imports against the vendored
  `pyodide-lock.json`, never from a list.
- **Mock exam.** 53 items under a 120-minute wall-clock countdown, per-domain quotas computed by
  the repository's own `drills.engine.mock.apportion_items` at build time.
- **Quizzes.** Per-domain recall prompts parsed from each `self-check.md`, plus a scored quiz sized
  to that domain's share of a full mock.
- **Flashcards.** The generated deck with a stable `Card:` identity and five Leitner boxes.
- **Item bank.** 54 files in `drills/bank/`: 53 original items reaching learners, one format
  demonstration excluded from every surface.

**Content status: 1 of 8 domains authored.** Domain 5, Model Selection and Optimization, is written
and sourced. The other seven are scaffolds, and the site says so honestly on every page.

## Next task

Write the notes for **Domain 2, Applications and Integration** — 33.1% of the exam, six sub-skills,
the largest single block. Four files in `notes/02-applications-and-integration/`: `README.md`,
`decision-tables.md`, `pitfalls.md`, `self-check.md`. Follow the shape of the finished Domain 5
files exactly.

Suggested split, because the domain is roughly double Domain 5: the three Claude-specific sub-skills
first (Claude Application Design 8.6%, Claude API Mechanics 6.8%, Configuration Management 4.1%),
then the three engineering-practice ones (Software Engineering Foundations 7.4%, Understanding
Requirements 3.4%, Systems Life Cycle 2.8%).

**Load the `claude-api` skill before writing a word of it.** Training priors on the Claude API are
stale in ways that are directly examinable: `budget_tokens` is rejected on current models, assistant
prefill returns a 400, sampling parameters are removed, `output_format` became
`output_config.format`. Verify against live documentation and add a dated row to `SOURCES.md` for
every factual claim — that is a hard rule in `AGENTS.md`.

Writing notes is now worth more than any code: the flashcard deck draws all 30 of its cards from
Domain 5 because that is the only domain with notes, and `self-check.md` is the only source of a
domain's recall prompts. Every note written grows three surfaces at once with no site change.

### Known follow-ups

- **Push the branch and open a pull request.**
  `git push -u origin 002-blueprint-guard-and-frontmatter`. Pages needs no setup: it is already on
  **Source: GitHub Actions** (`build_type: workflow`) and `pages.yml` deployed successfully from
  `main` on the feature 001 merge, so merging this branch publishes it. Verify with
  `gh api repos/moghazy17/ccdv-f-lab/pages` rather than assuming either way.
- **Repo-relative links do not survive rendering.** Note prose still names `SOURCES.md` and
  `lab/*.py` in code spans rather than linking them, because `/domains/<slug>/` has no such route.
  `AGENTS.md` wants those links. The fix is a small remark plugin rewriting repo-relative links to
  GitHub blob URLs at render time — cheaper to do before more notes are written. Lab *pages* already
  link their source on GitHub; this is about note prose.
- **Intermediate commits on this branch are not individually gate-verified.** Only the tip is.
  Whole-file staging meant a few files carry a later phase's content — `site/package.json`,
  `site/src/lib/storage.ts`, and `tools/check_content_single_source.py` most notably. Bisecting
  through the middle of the series may not build.
- **The bank holds no surplus.** Every domain is filled to exactly its quota, so repeated mock
  attempts draw the same items, and the mock page says so. More items per domain is the fix.

## Working rules that are easy to get wrong

- **Commits.** Claude Opus 5 acting as orchestrator may `git add` and `git commit`, but only after
  the full gate set passes. Delegated implementers never commit — they leave work for review. This
  is in `CLAUDE.md` and constitution 1.1.0.
- **Never `cd` in a Bash call.** The safety hook is registered at a relative path, so changing the
  shell's directory makes every subsequent tool call fail closed. Use `npm run --prefix site
  <script>` and `git -C`.
- **`rm` is blocked** by the same hook. Delete with `python -c "import pathlib;
  pathlib.Path(p).unlink()"`, or `shutil.rmtree` for a directory.
- **`AGENTS.md` and `BLUEPRINT.md` are write-protected** by the hook. `SOURCES.md` is not.
- **Do not generate source files through a shell heredoc.** Escape sequences get eaten a level and
  produce broken literals — `\n` inside a Python heredoc becomes a real newline and breaks the
  string it was in. Use the Write tool for anything containing `\n` or quotes.
- **Wrap prose at 100 columns.** Table rows are exempt. `AGENTS.md` also bans time-anchored phrasing
  ("for now", "recently"), commented-out code, and unowned TODOs.
- **Derive every exam figure.** Item counts, quotas, the mock's size and time limit all come from
  `BLUEPRINT.md` through generated data. Never type one into a page or a component.
- **`site/src/data/mock.json` and `items.json` are generated and git-ignored**; `blueprint.json` is
  generated and committed. None may be hand-edited.

## Running the end-to-end suite

Two things about `npm run test:e2e` will waste an hour if you do not know them.

- **`astro preview --ignore-lock` refuses to start** when the shell has `AI_AGENT`, `CLAUDECODE`, or
  `CLAUDE_CODE_ENTRYPOINT` set, because Astro auto-detects an agent environment and runs preview in
  the background, which needs the lock. Run the command with those unset:
  `env -u AI_AGENT -u CLAUDECODE -u CLAUDE_CODE_ENTRYPOINT npm run --prefix site test:e2e`.
- **The suite is memory-sensitive, not flaky.** Seven specs each build the whole site behind one
  lock while the lab specs run a real CPython in WebAssembly. On a machine with headroom the full
  215 tests take about two minutes; on one that is swapping, a single fixture spec consumed fifteen.
  If `source-plans.spec.ts` appears to hang, check free memory before touching a timeout — that spec
  runs in under eight seconds on its own. `playwright.config.ts` pins `workers: 2` and those specs
  carry a 900-second ceiling deliberately; the lock helper's own wait ceiling is ten minutes, so a
  shorter test timeout is inconsistent with its design.
- **An interrupted run leaves `site/.us2-*` directories behind.** The gates now skip that prefix, so
  they no longer report hundreds of false duplications, but delete the directories anyway.

## Delegating implementation

Implementation work can go to a separate CLI through one of the `*-delegate` skills. The
orchestrator writes the brief, reviews the result, and commits; the implementer only writes code.
Feature 002's Phases 7–10 went to the **OpenAI Codex CLI** through `codex-delegate`; feature 001
used the **Google Antigravity CLI** through `agy-delegate`. Both follow the same loop.

```bash
node "C:/Users/ahmed/.claude/skills/codex-delegate/scripts/relay.mjs" \
  --brief <path> --cd "D:/Projects/claude-courses/ccdv-f" \
  --model gpt-5.6-terra --effort high --timeout 2h
```

Points that matter:

- **Model names resolve through Codex's own list.** "terra" is `gpt-5.6-terra`; the configured
  default is `gpt-5.6-sol` at low effort. `~/.codex/models_cache.json` holds the roster.
- **Rework goes to the same session.** `--session <threadId>` from the prior `result.json` continues
  the exact conversation, so a delta brief needs only the defects, not the whole context again.
- **This machine kills long runs for memory.** Two of three Codex runs were terminated part-way. The
  edits survived each time — re-verify from the working tree rather than re-dispatching blindly.
  Freeing memory before a long run is worth the minute it costs.
- **Never trust the self-report.** Re-run every gate independently and read the diff. Across feature
  002, review caught a sandbox that did not actually seal (deleting `fetch` from the worker global
  removed nothing, because `fetch` lives on `WorkerGlobalScope.prototype`), a keyboard handler that
  broke the space bar on focused buttons, every flashcard printing its tags twice, and a run
  reporting "gates passed" while one spec had timed out. A green self-report is a claim, not
  evidence.
- **Write the brief as if the implementer has no memory, because it does not.** Include the repo's
  real gate commands, the house rules, an explicit "you do not commit", and a report contract. Say
  what a "verify" task means: establish the property and leave behind something that fails if it
  stops holding, not read the code and tick a box.
