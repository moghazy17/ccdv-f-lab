# Phase 0 research: lab runner, weighted mock exam, and practice modes

Every figure below was measured against the current toolchain on 2026-09-08, not recalled. The
commands that produced them are given so a reviewer can repeat them.

## R1 — Which runtime, and how it reaches the browser

**Decision**: Pyodide, pinned to one exact version, installed as an npm devDependency and copied
into the build output. The site serves it from its own origin, with `indexURL` pointing at that
copy.

**Rationale**: Principle III forbids third-party runtime requests, so loading Pyodide from a CDN is
out. Installing it through npm keeps the version in `package-lock.json` alongside every other pinned
dependency, which is the practice feature 001 established and which Principle VII treats as
instructional in its own right. Copying at build time rather than committing the binaries keeps
roughly 12 MiB of WebAssembly out of git history.

**Alternatives considered**: Committing the runtime under `site/public/` — rejected because it puts
large binaries in git and makes a version bump a binary diff. Loading from `cdn.jsdelivr.net` —
rejected outright by Principle III. Compiling a smaller Python to WebAssembly — rejected because the
feature's whole claim is that it runs *this repository's* Python, which needs a real CPython with
the packages below.

**Consequence for the build**: the npm package carries the core files, but individual package wheels
are fetched from the CDN at runtime unless they sit beside `indexURL`. The build must therefore copy
the core files *and* the specific wheels named in R2 into the output, then verify none is missing.

## R2 — Which of the repository's dependencies actually load

`lab/` and `drills/` import three third-party packages. Checked against the Pyodide distribution's
own lock file, which lists 356 packages:

```bash
curl -sL https://cdn.jsdelivr.net/pyodide/v314.0.6/full/pyodide-lock.json
```

| Package | In the distribution | Version | Needed by |
|---|---|---|---|
| `jsonschema` | yes | 4.26.0 | `lab/output.py`, `lab/tools/dispatcher.py`, `drills/engine/validation.py` |
| `attrs`, `referencing`, `jsonschema-specifications`, `rpds-py` | yes | 26.1.0, 0.37.0, 2025.9.1, 0.30.0 | transitive under `jsonschema` |
| `PyYAML` | yes | 6.0.3 | `drills/engine/mock.py`, `drills/engine/validation.py` |
| `mcp` | **no** | — | `lab/mcp_server/server.py` (`FastMCP`) |
| `uvicorn` | **no** | — | transitive under `mcp` |

**Decision**: the MCP server lab is the one lab that shows its source instead of running. Every
other lab runs.

**Rationale**: `rpds-py` matters more than it looks — it is the compiled Rust dependency that modern
`jsonschema` needs, and its presence as a prebuilt wasm wheel is what makes structured output, tool
dispatch, and drill validation runnable at all. `mcp` is absent, and vendoring it is not a fix: it
would mean shipping `mcp`, `uvicorn`, `sse-starlette`, `httpx-sse`, `pydantic-settings`, and
`python-multipart` wheels to run a server that has no transport to serve over inside a browser tab.
That is exactly the trade the specification's fifth clarification rejected.

**How it is decided**: not by this table. FR-012 requires the runnable set to come from what the
runtime actually satisfies at publication time, so the build probes each lab's imports and records
the result. This table is the expected outcome, not the source of truth — if a future Pyodide
release adds `mcp`, the lab starts running with no roster to edit.

**Alternatives considered**: `micropip.install("mcp")` at runtime — rejected, it fetches from
`files.pythonhosted.org`, a third-party runtime request. Vendoring the wheels — rejected as above. A
hand-maintained list of runnable labs — rejected by FR-012 because it goes stale silently.

## R3 — The payload budget

Measured by downloading each artifact twice, once with `Accept-Encoding: identity` and once allowing
compression:

| Artifact | Raw | Over the wire |
|---|---:|---:|
| `pyodide.asm.wasm` | 9,373 KiB | 3,357 KiB |
| `python_stdlib.zip` | 2,485 KiB | 2,446 KiB |
| `pyodide.mjs` | 17 KiB | 7 KiB |
| Six wheels from R2 | 373 KiB | 362 KiB |
| `pyodide.asm.mjs` | 1,221 KiB | — |
| **Total, as first measured** | **12,252 KiB (≈12.0 MiB)** | **6,175 KiB (≈6.0 MiB)** |

**Corrected after vendoring.** The table above was probed against the CDN and missed
`pyodide.asm.mjs`, because this release ships no `pyodide.asm.js` and the probe for it returned
nothing. The build check measures the vendored directory directly and reports **6.62 MiB**,
which also counts `pyodide-lock.json` (the loader fetches it) and `lab-drills.zip`. Nine wheels
are vendored rather than six, because `jsonschema` pulls `pyrsistent`, `attrs` pulls `six`, and
`referencing` pulls `typing-extensions`. The ceiling is unchanged and the headroom holds.

**Decision**: a first-run ceiling of **8 MiB transferred**, enforced by a build check that sums the
vendored payload and fails when it is exceeded. The measured baseline is 6.62 MiB, leaving headroom
for a Pyodide version bump without a surprise.

**Rationale**: Principle VIII requires a *stated* budget, and Principle VI requires gates to be
mechanical rather than aspirational — a number nobody checks is a number that drifts. The headroom
is deliberate: `python_stdlib.zip` is already compressed and will not shrink, and GitHub Pages
serves gzip rather than brotli, which the build check measures directly.

**Alternatives considered**: no ceiling, with the budget expressed only as user-visible timing —
rejected because payload creep is precisely the failure a build check catches and a manual target
does not. Trimming `python_stdlib.zip` — rejected as premature; it is 2.4 MiB and the labs import
across a wide slice of the standard library.

## R4 — Running code without freezing the page, and stopping it

**Decision**: execute in a dedicated Web Worker. Implement Stop as `worker.terminate()` followed by
re-instantiation, not as an interrupt.

**Rationale**: Pyodide's `setInterruptBuffer` is the usual way to interrupt a running script, and it
requires a `SharedArrayBuffer`. `SharedArrayBuffer` requires cross-origin isolation, which requires
`Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` response headers. **GitHub Pages
serves static files and cannot set custom response headers**, so cross-origin isolation is
unavailable on the deployment target feature 001 chose. Termination is the honest alternative: the
worker dies, a fresh one is created, and the runtime is usable again without reloading the page —
which is exactly what FR-006 asks for. The cost is that the re-created worker re-initialises the
runtime, served from the HTTP cache rather than the network.

**Consequence for the design**: because the page never executes Python on the main thread, a runaway
loop cannot block it, and the "page stays responsive" half of FR-006 holds structurally rather than
by care.

**Alternatives considered**: a service worker that injects the isolation headers — rejected as a
fragile workaround that fails on first load, before the service worker controls the page, and that
adds a caching layer nobody asked for. Moving off GitHub Pages to a host that can set headers —
rejected as out of scope; feature 001 recorded hosting as a planning decision and nothing else here
needs it.

## R5 — Blocking the network and the credential, structurally

**Decision**: three independent layers, in the worker.

1. Before any user code runs, the worker deletes `fetch`, `XMLHttpRequest`, `WebSocket`,
   `EventSource`, and `importScripts` from its own global scope. The runtime is already loaded by
   then, so nothing legitimate needs them afterwards.
2. A `Content-Security-Policy` of `connect-src 'self'` on the document, so any path that escapes the
   first layer still cannot reach a third party.
3. `lab/secrets.py` already raises `RuntimeError("ANTHROPIC_API_KEY must be set for the live
   transport")` when the variable is absent, and the worker's environment never sets it. The
   bootstrap catches that specific failure and re-raises it with a message naming the mock
   transport, which is what FR-005 requires.

**Rationale**: FR-004 requires enforcement "by the execution environment itself rather than by the
code under execution choosing not to". Deleting the globals is that enforcement; the CSP is defence
in depth; the third layer turns an accurate but bare error into a teaching one.

**Alternatives considered**: patching Python's `urllib` inside Pyodide — rejected as insufficient,
since `js.fetch` is reachable from Python through the foreign-function interface and would bypass
it. Trusting the mock transport to be the only one wired up — rejected, because FR-004 is explicitly
about not trusting that.

## R6 — Getting `lab/` and `drills/` into the runtime without copying them into `site/`

**Decision**: a build step reads `lab/` and `drills/` from the repository root and writes a single
archive into the site's output directory. The archive is generated, git-ignored, and unpacked into
the runtime's virtual filesystem on first Run.

**Rationale**: FR-001 requires the site to hold no copy of that source and publication to fail if
one appears. A generated, ignored artifact satisfies both: the bytes exist only in the build output,
and the existing `tools/check_content_single_source.py` gate keeps prose out of `site/`
independently. It also means editing `lab/transport.py` changes what the lab runs with no second
edit, which is the point of FR-001.

**Alternatives considered**: committing the packages under `site/public/` — rejected, it is the
exact duplication FR-001 forbids. Fetching the files individually at runtime — rejected as dozens of
requests where one archive does.

## R7 — The mock exam does not need the runtime at all

**Decision**: per-domain quotas are computed **at build time** by importing the repository's real
`drills.engine.mock.apportion_items`, and exported as data. The mock and the quizzes are ordinary
TypeScript; they never load Pyodide.

**Rationale**: FR-024 requires the site's per-domain counts to equal the engine's, verified
automatically rather than asserted. Calling the engine at build time satisfies that by construction
— there is no second apportionment implementation to drift. It also keeps the heaviest surface a
candidate uses under time pressure entirely free of a 6 MiB runtime, which serves Principle VIII far
better than running the engine in the browser would.

This is the single most consequential design decision in the feature, and it inverts the obvious
reading of the specification's input: the runtime is for the labs, not for the exam.

**Alternatives considered**: running `drills.engine` in Pyodide on the mock page — rejected because
it puts the runtime on the path of the most time-sensitive surface for no gain in fidelity, given
the quotas are fully determined at build time. Porting largest-remainder apportionment to TypeScript
— rejected because it creates precisely the second implementation FR-024 exists to prevent.

**Verified**: the engine returns 17 / 9 / 8 / 6 / 6 / 4 / 2 / 1 for a 53-item mock, matching the
specification.

```bash
python -c "from drills.engine.blueprint import load_blueprint; from drills.engine.mock import apportion_items; print(apportion_items(load_blueprint(), 53))"
```

## R8 — Scoring, and the one duplication this feature accepts

**Decision**: implement scoring in TypeScript, and pin it to `drills/engine/scoring.py` with
fixtures generated from the Python engine and checked into the test suite.

**Rationale**: scoring must run in the browser as the candidate answers, and the runtime is
deliberately absent from that page by R7. The rule is small and closed — exact set match, per-domain
tallies, 85% overall and 70% per domain, readiness withheld when a domain is unassessed — so the
duplication is bounded. Generated fixtures make drift a test failure rather than a discovery. This
mirrors the `content-status.ts` decision feature 001 recorded and justified for the same reason.

**Alternatives considered**: scoring in Pyodide — rejected, it drags the runtime onto the mock path
and undoes R7. Scoring at build time — impossible; the answers do not exist until the candidate
gives them.

## R9 — The editable code pane

**Decision**: a plain `<textarea>` with explicit Tab handling and a documented key to leave it. No
editor library.

**Rationale**: FR-056 requires the pane to be keyboard-operable *and* not to trap the keyboard,
which is the accessibility failure every code editor component has to work around. A textarea has
correct screen-reader semantics for free, adds nothing to the bundle, and keeps the critical-path
budget from R3 untouched. Syntax highlighting is not a requirement anywhere in the specification.

**Alternatives considered**: CodeMirror 6, self-hosted — rejected as roughly 200 KiB and a keyboard
trap to mitigate, bought for highlighting nobody asked for. `contenteditable` — rejected as worse on
both counts.

## R10 — The timer, and surviving a restart

**Decision**: store the attempt's start instant and its deadline as absolute timestamps. Remaining
time is always derived from the wall clock, never accumulated by a running counter.

**Rationale**: FR-027 makes the countdown wall-clock whether or not the attempt is on screen, so a
derived value is the only representation that cannot drift when a tab is suspended, a laptop sleeps,
or the page is closed. Restoring an attempt is then reading two timestamps, and deciding whether it
expired is comparing one to `Date.now()`.

**Alternatives considered**: a stored "seconds remaining" decremented on a timer — rejected, it
stops when the tab is throttled and produces exactly the silently-wrong resume the specification's
edge case forbids.

## R11 — Multi-tab safety

**Decision**: every write goes through the existing storage module, which re-reads, merges the
touched namespace, and writes back; a `storage` event listener refreshes open surfaces.

**Rationale**: FR-051 forbids silently discarding another tab's results. Feature 001 established
this read-merge-write pattern for plan marks and the mechanism is unchanged; this feature only adds
namespaces to it.

## R12 — Spaced repetition

**Decision**: Leitner boxes with five intervals — same session, 1 day, 3 days, 7 days, 21 days. A
card marked known moves up one box; a card marked not known returns to the first.

**Rationale**: FR-045 requires the rule to be describable on the page in one sentence, and the
sentence above is that description. It needs two stored fields per card, which keeps the export
small and the retention budget in R3 intact.

**Alternatives considered**: SM-2 or FSRS — rejected as more state and more explanation than a study
kit's flashcard mode warrants, and explicitly out of step with the specification's "lightweight".

## Resolved unknowns

Every `NEEDS CLARIFICATION` raised while filling the Technical Context is closed above: runtime
choice and delivery (R1), package availability and the non-runnable lab (R2), the performance budget
(R3), stopping a run without cross-origin isolation (R4), structural network and credential blocking
(R5), source delivery without duplication (R6), apportionment fidelity (R7), and the scoring
duplication with its mitigation (R8).
