/**
 * The dedicated Web Worker that owns Pyodide.
 *
 * This is the only place the runtime actually executes Python. `client.ts` is the only caller:
 * it constructs this worker, sends it `init` and `run` messages, and interprets the `progress`,
 * `ready`, `stdout`, `stderr`, `done`, and `failed` messages this file sends back. The message
 * shapes below are the contract in `specs/002-lab-runner-mock-exam/contracts/runtime-worker.md`,
 * not a private implementation detail.
 */

/** Sent once, before any candidate code runs, to load the runtime and unpack `lab/` and `drills/`. */
export interface InitMessage {
  type: "init";
  bundleUrl: string;
}

/** Sent once per Run, to execute candidate source as `__main__`. */
export interface RunMessage {
  type: "run";
  source: string;
}

export type InboundMessage = InitMessage | RunMessage;

/** Reported while the runtime downloads and unpacks, so the wait is never silent. */
export interface ProgressMessage {
  type: "progress";
  stage: string;
  loaded: number;
  total: number;
}

/** The runtime is up, its packages are imported, and the bundle is unpacked. */
export interface ReadyMessage {
  type: "ready";
}

export interface StdoutMessage {
  type: "stdout";
  chunk: string;
}

export interface StderrMessage {
  type: "stderr";
  chunk: string;
}

/** One run finished without an uncaught exception. */
export interface DoneMessage {
  type: "done";
  durationMs: number;
  truncated: boolean;
}

/** Loading failed, or a run raised an uncaught exception. `traceback` is always the full text. */
export interface FailedMessage {
  type: "failed";
  message: string;
  traceback: string;
}

export type OutboundMessage =
  | ProgressMessage
  | ReadyMessage
  | StdoutMessage
  | StderrMessage
  | DoneMessage
  | FailedMessage;

/** The subset of the Pyodide API this worker calls, kept narrow so it is easy to audit. */
interface PyodideRuntime {
  loadPackage(names: string[]): Promise<unknown>;
  runPythonAsync(code: string): Promise<unknown>;
  setStdout(options: { batched: (output: string) => void }): void;
  setStderr(options: { batched: (output: string) => void }): void;
  unpackArchive(buffer: ArrayBuffer, format: string): void;
}

interface PyodideModule {
  loadPyodide(options: { indexURL: string }): Promise<PyodideRuntime>;
}

/** The six third-party packages `lab/` and `drills/` import, mirroring `scripts/vendor-runtime.mjs`. */
const DIRECT_PACKAGES = [
  "jsonschema",
  "attrs",
  "referencing",
  "jsonschema-specifications",
  "rpds-py",
  "pyyaml"
];

/** Coarse, named stages reported through `progress` while the runtime comes up. */
const LOAD_STAGES = ["fetching-runtime", "loading-packages", "unpacking-bundle", "preparing-sandbox"];

/** A generous but finite bound on combined stdout and stderr characters for one run. */
const MAX_OUTPUT_CHARACTERS = 200_000;

/**
 * Re-raises `lab.secrets`'s missing-key error with a message naming the mock transport, so a
 * candidate who calls the live credential path sees why it is unavailable rather than a bare
 * "ANTHROPIC_API_KEY must be set" with no context. Runs once, before any candidate code.
 */
const BOOTSTRAP_SOURCE = `
import lab.secrets as _lab_secrets

_resolve_anthropic_api_key = _lab_secrets.resolve_anthropic_api_key


def _keyless_resolve_anthropic_api_key(*args, **kwargs):
    try:
        return _resolve_anthropic_api_key(*args, **kwargs)
    except RuntimeError as error:
        raise RuntimeError(
            "This lab runs keyless by construction: it exercises lab.transport.MockTransport, "
            "not a live provider, so this browser worker never defines ANTHROPIC_API_KEY."
        ) from error


_lab_secrets.resolve_anthropic_api_key = _keyless_resolve_anthropic_api_key
`;

let pyodide: PyodideRuntime | null = null;
let outputCharactersEmitted = 0;
let outputTruncated = false;

self.onmessage = (event: MessageEvent<InboundMessage>) => {
  const message = event.data;
  if (message.type === "init") {
    void handleInit(message.bundleUrl);
  } else {
    void handleRun(message.source);
  }
};

async function handleInit(bundleUrl: string): Promise<void> {
  try {
    postMessage({ type: "progress", stage: LOAD_STAGES[0], loaded: 0, total: LOAD_STAGES.length });
    const pyodideModule = await importPyodideModule(bundleUrl);

    postMessage({ type: "progress", stage: LOAD_STAGES[1], loaded: 1, total: LOAD_STAGES.length });
    const runtime = await pyodideModule.loadPyodide({ indexURL: bundleUrl });
    await runtime.loadPackage(DIRECT_PACKAGES);

    postMessage({ type: "progress", stage: LOAD_STAGES[2], loaded: 2, total: LOAD_STAGES.length });
    await unpackLabDrillsBundle(runtime, bundleUrl);

    postMessage({ type: "progress", stage: LOAD_STAGES[3], loaded: 3, total: LOAD_STAGES.length });
    disableNetworkAndScriptLoading();
    runtime.setStdout({ batched: (chunk) => forwardOutput("stdout", chunk) });
    runtime.setStderr({ batched: (chunk) => forwardOutput("stderr", chunk) });
    await runtime.runPythonAsync(BOOTSTRAP_SOURCE);

    postMessage({ type: "progress", stage: LOAD_STAGES[3], loaded: 4, total: LOAD_STAGES.length });
    pyodide = runtime;
    postMessage({ type: "ready" });
  } catch (error) {
    postMessage({
      type: "failed",
      message: "The runtime failed to load.",
      traceback: describeError(error)
    });
  }
}

async function handleRun(source: string): Promise<void> {
  if (pyodide === null) {
    postMessage({
      type: "failed",
      message: "The runtime has not finished loading.",
      traceback: "run was received before init completed."
    });
    return;
  }
  outputCharactersEmitted = 0;
  outputTruncated = false;
  const startedAt = performance.now();
  try {
    await pyodide.runPythonAsync(source);
    postMessage({ type: "done", durationMs: performance.now() - startedAt, truncated: outputTruncated });
  } catch (error) {
    postMessage({
      type: "failed",
      message: "The candidate code raised an uncaught exception.",
      traceback: describeError(error)
    });
  }
}

async function importPyodideModule(bundleUrl: string): Promise<PyodideModule> {
  const moduleUrl = new URL("pyodide.mjs", bundleUrl).toString();
  return (await import(/* @vite-ignore */ moduleUrl)) as PyodideModule;
}

async function unpackLabDrillsBundle(runtime: PyodideRuntime, bundleUrl: string): Promise<void> {
  const archiveUrl = new URL("lab-drills.zip", bundleUrl).toString();
  const response = await fetch(archiveUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${archiveUrl}: HTTP ${response.status}.`);
  }
  const buffer = await response.arrayBuffer();
  runtime.unpackArchive(buffer, "zip");
}

function forwardOutput(stream: "stdout" | "stderr", chunk: string): void {
  if (outputTruncated) {
    return;
  }
  outputCharactersEmitted += chunk.length;
  if (outputCharactersEmitted > MAX_OUTPUT_CHARACTERS) {
    outputTruncated = true;
    return;
  }
  postMessage(stream === "stdout" ? { type: "stdout", chunk } : { type: "stderr", chunk });
}

/** The names removed from the worker before any candidate code runs. */
const NETWORK_AND_SCRIPT_GLOBALS = [
  "fetch",
  "XMLHttpRequest",
  "WebSocket",
  "EventSource",
  "importScripts"
] as const;

/**
 * Removes the network and script-loading globals; nothing legitimate needs them after this.
 *
 * Deleting the own property is not enough. `fetch` and `importScripts` are defined on
 * `WorkerGlobalScope.prototype`, not on the global object itself, so `delete self.fetch` succeeds
 * without removing anything and the name still resolves through the prototype chain. Each name is
 * therefore deleted wherever the chain actually defines it, which is what makes FR-004 a property
 * of the environment rather than a claim about it.
 */
function disableNetworkAndScriptLoading(): void {
  for (const name of NETWORK_AND_SCRIPT_GLOBALS) {
    let target: object | null = globalThis;
    while (target !== null) {
      if (Object.prototype.hasOwnProperty.call(target, name)) {
        delete (target as Record<string, unknown>)[name];
      }
      target = Object.getPrototypeOf(target) as object | null;
    }
  }
}

function postMessage(message: OutboundMessage): void {
  self.postMessage(message);
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
