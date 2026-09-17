# Contract: the `run-hook` message and the `init` profile

Extends `specs/002-lab-runner-mock-exam/contracts/runtime-worker.md`. That contract stays in force
for lab pages; this adds one inbound message and one field, and removes nothing.

## Why a second execution path exists

A Claude Code hook decides by *exiting*. It reads a `PreToolUse` JSON document from standard input,
writes its decision to standard error, and exits `2` to deny or `0` to permit. The existing `run`
message models none of that: it executes a source string and reports any `SystemExit` as
"The candidate code raised an uncaught exception" — which would present a working denial as a crash,
inverting the one thing the configuration page exists to teach.

This is the feature's single tracked complexity. See the plan's Complexity Tracking table.

## `init` gains a profile

```ts
interface InitMessage {
  type: "init";
  bundleUrl: string;
  profile?: "labs" | "stdlib";   // default "labs" — existing callers are unchanged
}
```

| Profile | Packages loaded | `lab-drills.zip` | `lab.secrets` bootstrap | Transferred (gzip) |
|---|---|---|---|---|
| `labs` (default) | the six direct wheels and their closure | unpacked | applied | 6.62 MiB |
| `stdlib` | none | not fetched | not applied | 6.10 MiB |

The saving is 7.8%, measured in Phase 0 — worth having, but the reason for the profile is that a
generated hook imports only the standard library, so loading a JSON-schema validator and a YAML
parser beside it would teach something untrue.

The configuration page sends `profile: "stdlib"`. Lab pages send nothing and behave exactly as
before.

## `run-hook`

```ts
interface RunHookMessage {
  type: "run-hook";
  source: string;    // the generated hook file, verbatim as the candidate would copy it
  payload: unknown;  // the PreToolUse document, serialised to stdin as JSON
}
```

Replies with exactly one:

```ts
interface HookResultMessage {
  type: "hook-result";
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  truncated: boolean;
}
```

A hook that fails to parse, or raises before exiting, still yields `hook-result` with the traceback
on `stderr` and a non-zero `exitCode`. `failed` is reserved for the worker itself breaking, never for
a hook denying. **A denial is not a failure**, and the contract is written so that no caller can
confuse the two.

## The driver

The worker writes `source` to the Pyodide filesystem and runs it through this driver, which was
validated against this repository's own hook in Phase 0:

```python
stdout, stderr = io.StringIO(), io.StringIO()
saved_stdin, saved_argv = sys.stdin, sys.argv
sys.stdin = io.StringIO(json.dumps(payload))
sys.argv = [path]
code = 0
try:
    with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
        runpy.run_path(path, run_name="__main__")
except SystemExit as exit_signal:
    code = exit_signal.code if isinstance(exit_signal.code, int) else 1
finally:
    sys.stdin, sys.argv = saved_stdin, saved_argv
```

Four properties this relies on, each confirmed by execution rather than assumed:

1. `io.StringIO` is an acceptable stand-in for standard input for a hook that calls `json.load`.
2. `run_name="__main__"` triggers the `if __name__ == "__main__"` block, so the hook runs the way
   Claude Code runs it.
3. `SystemExit.code` carries the decision; a non-integer code is normalised to `1`.
4. Running the same hook twice in one interpreter yields the same answer, so the page can offer
   repeated runs without reloading the runtime.

## Isolation

Unchanged and inherited. The network and script-loading globals are already deleted before anything
executes, and `connect-src 'self'` backs that up. A generated hook has no more reach than lab code
does: no network, no credential, no access to the candidate's machine. Output is bounded by the same
ceiling, and a run that does not terminate leaves the page responsive and the runtime reusable.
