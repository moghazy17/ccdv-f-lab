# Contract: the runtime worker

The only place in the site that executes Python. Everything outside `site/src/lib/runtime/` talks to
it through `client.ts` and never touches Pyodide directly — that boundary is what makes SC-002
testable.

## Loading

| Property | Value |
|---|---|
| Fetched from | the site's own origin, under the configured base path |
| Fetched when | the first press of Run on a lab page, never earlier |
| Fetched on | runnable lab pages only |
| Transferred, first run | ≤ 8 MiB, measured 6.62 MiB |
| Subsequent runs | HTTP cache; no network request required |

The build copies the runtime core and the wheels for `jsonschema`, `attrs`, `referencing`,
`jsonschema-specifications`, `rpds-py`, and `PyYAML` into the output and points `indexURL` at that
copy, so no package is ever fetched from a package index.

## Messages

Main thread to worker:

| Message | Payload | Meaning |
|---|---|---|
| `init` | `{ bundleUrl }` | Load the runtime, unpack `lab/` and `drills/` |
| `run` | `{ source }` | Execute this source as `__main__` |

Worker to main thread:

| Message | Payload | Meaning |
|---|---|---|
| `progress` | `{ stage, loaded, total }` | Reported while loading, so the wait is never silent |
| `ready` | — | Runtime up, packages imported, bundle unpacked |
| `stdout` / `stderr` | `{ chunk }` | Streamed as produced |
| `done` | `{ durationMs, truncated }` | Run finished |
| `failed` | `{ message, traceback }` | Uncaught exception, full traceback preserved |

## Stop

`stop()` terminates the worker and creates a fresh one.

Pyodide's `setInterruptBuffer` needs a `SharedArrayBuffer`, which needs cross-origin isolation,
which needs `Cross-Origin-Opener-Policy` and `Cross-Origin-Embedder-Policy` response headers. GitHub
Pages serves static files and cannot set them, so that route is closed on the deployment target.
Termination is the honest alternative and satisfies FR-006 as written: the page was never blocked,
because execution is off the main thread, and the runtime is usable again after re-initialising from
cache without a page reload.

The client must report the re-initialisation rather than hiding it, so a candidate understands why
the next Run takes a moment.

## Isolation guarantees

These are the contract, not implementation detail. Each is asserted by a test.

1. **No network.** Before any candidate code runs, the worker deletes `fetch`, `XMLHttpRequest`,
   `WebSocket`, `EventSource`, and `importScripts` from its global scope. The runtime is already
   loaded, so nothing legitimate needs them afterwards. A `connect-src 'self'` policy on the
   document backs this up.
2. **No credential.** The worker environment never defines `ANTHROPIC_API_KEY`. `lab/secrets.py`
   already raises `RuntimeError` when it is absent; the bootstrap catches that and re-raises it with
   a message naming the mock transport and explaining that the browser lab is keyless by
   construction.
3. **No main-thread execution.** All Python runs in the worker. A non-terminating loop cannot freeze
   the page.
4. **Bounded output.** Output is capped at 200,000 characters across stdout and stderr combined,
   and the pane states that the cap was reached rather than truncating silently.

## Failure states

| Condition | Behaviour |
|---|---|
| Runtime cannot be fetched | Page stays readable, states what happened, offers retry, keeps the candidate's edits |
| Slow connection | `progress` reported throughout; the wait is interruptible |
| Candidate code raises | Full traceback shown; the runtime stays usable |
| Candidate code does not terminate | Stop terminates and re-initialises |
| Lab's imports unavailable | The page never offers Run — see `runnable` in the data model |
