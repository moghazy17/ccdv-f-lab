/**
 * The boundary around the in-browser Python runtime.
 *
 * Everything outside this directory imports from here and never from `worker.ts` or from Pyodide
 * directly. That is what keeps the runtime off every page that does not run code: a page can only
 * pull it in by importing the client, and the client is only imported inside a Run handler.
 *
 * `labs.ts` is deliberately not re-exported here. It probes `lab/`'s Python sources and the
 * vendored `pyodide-lock.json` with `node:fs` at module load, which only ever runs at build time
 * (an Astro page's frontmatter) or under Vitest. Barrelling it through this file would pull that
 * filesystem code into any browser bundle that imports this module for `load`/`run`/`stop`, so a
 * page that needs the catalogue imports `./labs` directly instead.
 *
 * See `specs/002-lab-runner-mock-exam/contracts/runtime-worker.md` for the message protocol, the
 * isolation guarantees, and why Stop terminates the worker rather than interrupting it.
 */

export {
  currentStatus,
  load,
  run,
  stop,
  subscribeProgress,
  subscribeStatus
} from "./client";
export type { OutputChunk, OutputListener, OutputStream, ProgressListener, StatusListener } from "./client";

/** Where the runtime is in its lifecycle, from the caller's point of view. */
export type RuntimeStatus = "idle" | "loading" | "ready" | "running" | "failed";

/** Progress while the runtime downloads, so the wait is never silent. */
export interface LoadProgress {
  stage: string;
  loaded: number;
  total: number;
}

/** One execution of a lab's code. */
export interface RunResult {
  stdout: string;
  stderr: string;
  /** The traceback of an uncaught exception, or null when the run completed. */
  traceback: string | null;
  durationMs: number;
  /** True when the candidate pressed Stop and the worker was terminated. */
  stopped: boolean;
  /** True when output hit its cap; the pane states this rather than truncating silently. */
  truncated: boolean;
}
