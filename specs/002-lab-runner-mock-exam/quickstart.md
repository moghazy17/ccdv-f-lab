# Quickstart: lab runner, weighted mock exam, and practice modes

Everything here runs with no API key, and so does everything it builds. The Python a candidate runs
in the browser is this repository's own `lab/` and `drills/`, read in place at build time.

## First run

```bash
# Generate the derived data (standard library plus the existing PyYAML)
python tools/export_site_data.py       # Existing: BLUEPRINT.md -> blueprint.json
python tools/export_mock_data.py       # New: quotas from drills.engine -> mock.json
python tools/export_item_bank.py       # New: drills/bank/ -> items.json
python tools/build_flashcards.py       # Existing: notes -> the deck, now with card ids

cd site
npm ci                                  # Installs pyodide at its pinned version too
npm run dev
```

`npm run dev` and `npm run build` both run the runtime bundler first, which archives `lab/` and
`drills/` into the build output. That archive is generated and git-ignored: if you find yourself
copying Python into `site/`, stop — that is the duplication FR-001 exists to reject.

## The gates

```bash
# Python, from the repository root
ruff check .
ruff format --check .
pytest -q
python -m drills.engine validate            # Every authored item, before it can ship
python tools/check_blueprint_consistency.py # Now covers mock.json too
python tools/check_content_single_source.py
python tools/check_links.py

# Site, from site/
npm run typecheck      # Two programs: the Astro site, and the worker's own webworker-lib config
npm run lint
npm run build
npm run check:payload  # After a build: the transferred runtime against its 8 MiB ceiling
npm run test:unit
npm run test:e2e
```

Two site checks are new and worth knowing by name: the **payload budget** check fails the build when
the runtime and its wheels exceed 8 MiB transferred, and the **runtime isolation** test asserts that
no page outside a lab fetches the runtime and that no request leaves the origin while code is
running.

## What each new piece does

| Path | Purpose |
|---|---|
| `tools/export_mock_data.py` | Imports `drills.engine.mock.apportion_items` and writes the quotas. The site never computes one. |
| `tools/export_item_bank.py` | Reshapes `drills/bank/` for the browser and drops format demonstrations. |
| `tools/export_runtime_bundle.py` | Archives `lab/` and `drills/` into the build output. Generated, git-ignored. |
| `site/src/lib/runtime/worker.ts` | Owns Pyodide. Deletes the network globals before candidate code runs. |
| `site/src/lib/runtime/client.ts` | The only way the rest of the site reaches the runtime. |
| `site/src/lib/scoring.ts` | Mirrors `drills/engine/scoring.py`. Pinned by generated fixtures. |
| `site/src/lib/attempt.ts` | Wall-clock timer arithmetic, expiry, resume, and the three-report retention. |
| `site/src/data/mock.json`, `items.json` | Generated. Never edit; the build rejects a stale copy. |

## Things that will surprise you

**Stop kills the worker.** There is no interrupt. `SharedArrayBuffer` needs cross-origin isolation,
which needs response headers, which GitHub Pages cannot set. Stop terminates the worker and builds a
fresh one, so the next Run re-initialises from cache. This is by design — see research R4.

**The mock exam never loads Pyodide.** Quotas are computed at build time by the real engine and the
scoring is TypeScript, so the most time-sensitive surface carries no runtime at all. If you find
yourself importing the runtime client into a mock or quiz page, something has gone wrong.

**One lab does not run.** `mcp` is absent from the Pyodide distribution, so `/labs/mcp-server/`
shows its source read-only. This is decided by an import probe during the build, not by a list — do
not add one.

**Adding an item needs no site change.** Write the YAML into its domain's directory under
`drills/bank/`, validate, rebuild. It appears in mocks and in its domain's quiz.

## Failures you should expect to see, and what they mean

| Symptom | Cause | Fix |
|---|---|---|
| Build fails: mock data is stale | `BLUEPRINT.md` changed without regenerating | `python tools/export_mock_data.py` |
| Build fails: payload budget exceeded | A runtime bump or an extra wheel | Check what was added; the ceiling is 8 MiB for a reason |
| Build fails: item validation | A new item is missing a rationale, a trap type, or a dated source | `python -m drills.engine validate` names the file |
| Test fails: scoring parity | `drills/engine/scoring.py` and `scoring.ts` disagree | Regenerate the fixtures and reconcile; the Python engine is the authority |
| Test fails: apportionment parity | Someone implemented apportionment in TypeScript | Delete it and read `mock.json` |
| A lab page fetches the runtime on load | The client was imported at module scope | Import it inside the Run handler |
| Mock shows a shortfall notice | A domain's bank is below its quota | Author items, or accept the stated shortfall |
