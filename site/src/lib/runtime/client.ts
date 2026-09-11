/**
 * The main-thread side of the runtime, and the only way the rest of the site reaches it.
 *
 * Nothing here executes at import time: constructing the worker and fetching the runtime happen
 * only inside `load()`, which a page calls from a Run handler. See
 * `specs/002-lab-runner-mock-exam/contracts/runtime-worker.md` for the message protocol and why
 * `stop()` terminates the worker rather than interrupting it.
 */

import type {
  DoneMessage,
  FailedMessage,
  InboundMessage,
  OutboundMessage
} from "./worker";
import type { LoadProgress, RunResult, RuntimeStatus } from "./index";

export type OutputStream = "stdout" | "stderr";

/** One streamed chunk of output, delivered as the run produces it. */
export interface OutputChunk {
  stream: OutputStream;
  chunk: string;
}

export type StatusListener = (status: RuntimeStatus) => void;
export type ProgressListener = (progress: LoadProgress) => void;
export type OutputListener = (output: OutputChunk) => void;

interface PendingInit {
  resolve: () => void;
  reject: (error: Error) => void;
}

interface PendingRun {
  resolve: (result: RunResult) => void;
  stdout: string;
  stderr: string;
  startedAt: number;
  onOutput: OutputListener | undefined;
}

let worker: Worker | null = null;
let status: RuntimeStatus = "idle";
let awaitingReinitialisation = false;
let pendingInit: PendingInit | null = null;
let pendingRun: PendingRun | null = null;
const statusListeners = new Set<StatusListener>();
const progressListeners = new Set<ProgressListener>();

/** The runtime's current lifecycle status, from the caller's point of view. */
export function currentStatus(): RuntimeStatus {
  return status;
}

/** Subscribe to status changes; call the returned function to unsubscribe. */
export function subscribeStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
}

/** Subscribe to load progress; call the returned function to unsubscribe. */
export function subscribeProgress(listener: ProgressListener): () => void {
  progressListeners.add(listener);
  return () => progressListeners.delete(listener);
}

/** Load the runtime if it is not already ready. Safe to call more than once. */
export async function load(): Promise<void> {
  if (status === "ready") {
    return;
  }
  if (awaitingReinitialisation) {
    awaitingReinitialisation = false;
    emitProgress({ stage: "reinitialising", loaded: 0, total: 1 });
  }
  if (worker === null) {
    worker = createWorker();
  }
  setStatus("loading");
  await new Promise<void>((resolve, reject) => {
    pendingInit = { resolve, reject };
    worker?.postMessage({ type: "init", bundleUrl: bundleUrl() } satisfies InboundMessage);
  });
}

/**
 * Run one execution of `source` as `__main__`, loading the runtime first if it is not ready.
 * `onOutput`, when supplied, receives every stdout/stderr chunk as the worker streams it.
 */
export async function run(source: string, onOutput?: OutputListener): Promise<RunResult> {
  if (status !== "ready") {
    await load();
  }
  setStatus("running");
  return new Promise<RunResult>((resolve) => {
    pendingRun = { resolve, stdout: "", stderr: "", startedAt: performanceNow(), onOutput };
    worker?.postMessage({ type: "run", source } satisfies InboundMessage);
  });
}

/**
 * Terminate the worker and prepare a fresh one. There is no interrupt: `SharedArrayBuffer`
 * requires cross-origin isolation headers GitHub Pages cannot set. The next `load()` or `run()`
 * call re-initialises from the HTTP cache and reports that through the progress subscription.
 */
export function stop(): void {
  if (pendingRun !== null) {
    const finished = pendingRun;
    pendingRun = null;
    finished.resolve({
      stdout: finished.stdout,
      stderr: finished.stderr,
      traceback: null,
      durationMs: performanceNow() - finished.startedAt,
      stopped: true,
      truncated: false
    });
  }
  worker?.terminate();
  worker = null;
  pendingInit = null;
  awaitingReinitialisation = true;
  setStatus("idle");
}

function createWorker(): Worker {
  const nextWorker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  nextWorker.onmessage = (event: MessageEvent<OutboundMessage>) => handleWorkerMessage(event.data);
  return nextWorker;
}

function bundleUrl(): string {
  const base = new URL(import.meta.env.BASE_URL, location.origin);
  return new URL("runtime/", base).toString();
}

function handleWorkerMessage(message: OutboundMessage): void {
  switch (message.type) {
    case "progress":
      emitProgress({ stage: message.stage, loaded: message.loaded, total: message.total });
      return;
    case "ready":
      setStatus("ready");
      pendingInit?.resolve();
      pendingInit = null;
      return;
    case "stdout":
      appendOutput("stdout", message.chunk);
      return;
    case "stderr":
      appendOutput("stderr", message.chunk);
      return;
    case "done":
      finishRun(message);
      return;
    case "failed":
      handleFailure(message);
      return;
  }
}

function appendOutput(stream: OutputStream, chunk: string): void {
  if (pendingRun === null) {
    return;
  }
  if (stream === "stdout") {
    pendingRun.stdout += chunk;
  } else {
    pendingRun.stderr += chunk;
  }
  pendingRun.onOutput?.({ stream, chunk });
}

function finishRun(message: DoneMessage): void {
  setStatus("ready");
  const finished = pendingRun;
  if (finished === null) {
    return;
  }
  pendingRun = null;
  finished.resolve({
    stdout: finished.stdout,
    stderr: finished.stderr,
    traceback: null,
    durationMs: message.durationMs,
    stopped: false,
    truncated: message.truncated
  });
}

function handleFailure(message: FailedMessage): void {
  if (pendingInit !== null) {
    setStatus("failed");
    const failedInit = pendingInit;
    pendingInit = null;
    failedInit.reject(new Error(message.message));
    return;
  }
  const finished = pendingRun;
  if (finished === null) {
    return;
  }
  pendingRun = null;
  setStatus("ready");
  finished.resolve({
    stdout: finished.stdout,
    stderr: finished.stderr,
    traceback: message.traceback,
    durationMs: performanceNow() - finished.startedAt,
    stopped: false,
    truncated: false
  });
}

function setStatus(next: RuntimeStatus): void {
  status = next;
  for (const listener of statusListeners) {
    listener(next);
  }
}

function emitProgress(progress: LoadProgress): void {
  for (const listener of progressListeners) {
    listener(progress);
  }
}

function performanceNow(): number {
  return performance.now();
}
