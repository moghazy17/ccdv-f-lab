# Handoff

A working document, not study content. It carries the state a fresh session needs to continue this
work without rediscovering it.

## What this repository is

An unofficial community study kit for the **Claude Certified Developer – Foundations (CCDV-F)**
exam. Python 3.11+, standard-library-first, runs with no API key. It now also publishes a static
website built from its own markdown.

`BLUEPRINT.md` is the source of truth for the 8 domains, 25 sub-skills, and every weight.
`AGENTS.md` is the house rulebook. Read both before changing anything.

## Current state

Branch `001-study-site-foundation`, **unpushed**. Feature 001 is complete: all 245 tasks across ten
phases, spec through deployment, in `specs/001-study-site-foundation/`.

All gates green: `ruff check .`, `ruff format --check .`, `pytest -q` (85), blueprint consistency,
single-source, link check, drills validate, evals 16/16, plus the site's `typecheck`, `lint`,
`build` (54 pages, 23 indexed), `test:unit` (46), `test:e2e` (169).

The site is Astro 7.3.1 + TypeScript in `site/`, every dependency pinned exactly, `npm audit` clean.
It renders `notes/`, `guide/`, `study-plans/` and `cheatsheets/` **in place** — copying study prose
into `site/` fails the build. Exam figures come from `site/src/data/blueprint.json`, generated from
`BLUEPRINT.md` by `tools/export_site_data.py`.

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

### Known follow-ups

- **Push and enable Pages.** `git push -u origin 001-study-site-foundation`, then in GitHub repo
  settings set **Pages → Source: GitHub Actions**, or `pages.yml` fails on the first push to `main`.
- **Repo-relative links do not survive rendering.** Note prose currently names `SOURCES.md` and
  `lab/*.py` in code spans rather than linking them, because `/domains/<slug>/` has no such route.
  `AGENTS.md` wants those links. The fix is a small remark plugin rewriting repo-relative links to
  GitHub blob URLs at render time — cheaper to do before more notes are written.
- **`drills/bank/` holds one item**, flagged `format_demonstration` and excluded from every
  learner-facing surface. Feature 002's mock exam needs a real item bank before it is worth
  building.

## Working rules that are easy to get wrong

- **Commits.** Claude Opus 5 acting as orchestrator may `git add` and `git commit`, but only after
  the full gate set passes. Delegated implementers never commit — they leave work for review. This
  is in `CLAUDE.md` and constitution 1.1.0.
- **Never `cd` in a Bash call.** The safety hook is registered at a relative path, so changing the
  shell's directory makes every subsequent tool call fail closed. Use `npm run --prefix site
  <script>` and `git -C`.
- **`rm` is blocked** by the same hook. Delete with `python -c "import pathlib;
  pathlib.Path(p).unlink()"`.
- **`AGENTS.md` and `BLUEPRINT.md` are write-protected** by the hook. `SOURCES.md` is not, anymore.
- **Do not generate source files through a shell heredoc.** Escape sequences get eaten a level and
  produce broken literals. Use the Write tool for anything containing `\n` or quotes.
- **Wrap prose at 100 columns.** Table rows are exempt. `AGENTS.md` also bans time-anchored phrasing
  ("for now", "recently"), commented-out code, and unowned TODOs.

## Delegating implementation to Antigravity

Implementation work goes to the **Google Antigravity CLI (`agy`)** through the `agy-delegate` skill.
The orchestrator writes the brief, reviews the result, and commits; `agy` only writes code.

Invoke the skill with the Skill tool (`agy-delegate`), then dispatch:

```bash
node "C:/Users/ahmed/.claude/skills/agy-delegate/scripts/relay.mjs" \
  --brief "<path to brief file>" \
  --cd "D:/Projects/claude-courses/ccdv-f" \
  --effort high --print-timeout 90m --timeout 95m \
  --dangerously-skip-permissions
```

Run it in the background and wait for the completion notification.

Points that matter:

- **`--dangerously-skip-permissions` is required and the maintainer has approved it.** In headless
  `--print` mode Antigravity cannot prompt, so without the flag it auto-denies its own first command
  and the run fails having done nothing. The flag auto-approves every tool request, which is
  acceptable here only because the work is committed at every phase boundary.
- **Model.** `agy`'s configured default resolves to `gemini-3.7-flash-high`. It produced five phases
  with one defect, so it is not the weak link, but `agy models` also lists `gemini-3.1-pro-high`,
  `claude-opus-4-6-thinking`, and `claude-sonnet-4-6` if a task warrants more. Pass `--model
  <label>`.
- **No network in its sandbox.** It cannot run `npm install`. If a brief needs a new package, tell
  it to add a pinned entry to `site/package.json`, leave the task unmarked, and report — the
  orchestrator installs.
- **Never trust the self-report.** Re-run every gate independently and read the diff. Across the ten
  phases, review caught a critical advisory, an unfixable Astro major version, cp1252 mojibake, a
  broken string literal, a gate that passed without guarding anything, and hard-coded values that
  should have been derived. A green self-report is a claim, not evidence.
- **Two runs were killed for host memory.** The work usually survives; re-verify from the working
  tree rather than re-dispatching blindly.

Every brief should carry the accumulated traps: navigate relatively in Playwright
(`page.goto("./x/")`, never `"/x/"`, which discards the `/ccdv-f-lab/` base); `astro preview` needs
`--ignore-lock`; write files as UTF-8; verify a file still parses after editing it; and derive
anything derivable instead of hard-coding it.
