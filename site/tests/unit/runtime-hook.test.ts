import { afterEach, describe, expect, test, vi } from "vitest";

type MessageHandler = (event: MessageEvent<unknown>) => void;

class HookWorker {
  static result = { exitCode: 0, stdout: "", stderr: "" };
  onmessage: MessageHandler | null = null;
  readonly messages: unknown[] = [];

  postMessage(message: { type: string }): void {
    this.messages.push(message);
    if (message.type === "init") {
      queueMicrotask(() => this.onmessage?.({ data: { type: "ready" } } as MessageEvent));
    }
    if (message.type === "run-hook") {
      queueMicrotask(() =>
        this.onmessage?.({
          data: {
            type: "hook-result",
            ...HookWorker.result,
            durationMs: 4,
            truncated: false
          }
        } as MessageEvent)
      );
    }
  }

  terminate(): void {}
}

const originalWorker = globalThis.Worker;
const originalLocation = Object.getOwnPropertyDescriptor(globalThis, "location");

afterEach(() => {
  vi.resetModules();
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: originalWorker });
  if (originalLocation) {
    Object.defineProperty(globalThis, "location", originalLocation);
  } else {
    Reflect.deleteProperty(globalThis, "location");
  }
});

function installRuntimeGlobals(): void {
  Object.defineProperty(globalThis, "Worker", { configurable: true, value: HookWorker });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: new URL("https://study.example/")
  });
}

describe("runtime hook execution", () => {
  test("a denial remains a hook result with its non-zero exit code and stderr", async () => {
    HookWorker.result = { exitCode: 2, stdout: "", stderr: "denied" };
    installRuntimeGlobals();
    const { runHook } = await import("../../src/lib/runtime/client");

    await expect(runHook("raise SystemExit(2)", {})).resolves.toMatchObject({
      exitCode: 2,
      stderr: "denied",
      stopped: false
    });
  });

  test("a permitting hook returns zero", async () => {
    HookWorker.result = { exitCode: 0, stdout: "permitted", stderr: "" };
    installRuntimeGlobals();
    const { runHook } = await import("../../src/lib/runtime/client");

    await expect(runHook("raise SystemExit(0)", {})).resolves.toMatchObject({ exitCode: 0 });
  });

  test("a hook exception is returned as a hook result instead of a worker failure", async () => {
    HookWorker.result = { exitCode: 1, stdout: "", stderr: "Traceback: example" };
    installRuntimeGlobals();
    const { runHook } = await import("../../src/lib/runtime/client");

    await expect(runHook("raise RuntimeError('example')", {})).resolves.toMatchObject({
      exitCode: 1,
      stderr: "Traceback: example"
    });
  });
});
