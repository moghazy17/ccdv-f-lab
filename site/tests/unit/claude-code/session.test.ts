import { describe, expect, test } from "vitest";

import type { SimulatedCommand } from "../../../src/lib/claude-code/commands";
import { clearSession, compactSession, createSession, resolveTurn } from "../../../src/lib/claude-code/session";

const command: SimulatedCommand = {
  id: "help",
  guidedTask: null,
  invocation: "/help",
  kind: "built-in",
  where: null,
  scope: null,
  definedBy: null,
  blueprintFeature: "Commands",
  explanation: "Shows help.",
  sourceAnchor: "cc-commands",
  sourceUrl: "https://example.test/commands",
  transcript: [{ stream: "stdout", text: "Help" }]
};

describe("simulated terminal session", () => {
  test("clear empties every turn while compact keeps a summary and marks its boundary", () => {
    let session = createSession("module");
    session = resolveTurn(session, "/help", [command]).session;
    session = resolveTurn(session, "/help", [command]).session;

    const compacted = compactSession(session);
    expect(compacted.compactedBefore).toBe(2);
    expect(compacted.turns).toHaveLength(1);
    expect(compacted.turns[0]).toMatchObject({ kind: "summary", input: "/compact" });

    const cleared = clearSession(compacted);
    expect(cleared.turns).toEqual([]);
    expect(cleared.compactedBefore).toBeNull();
  });

  test("keeps the transcript only in the returned session value", () => {
    const first = createSession("module");
    const second = resolveTurn(first, "/help", [command]).session;

    expect(first.turns).toEqual([]);
    expect(second.turns).toHaveLength(1);
    expect(Object.keys(second)).toEqual(["surface", "turns", "compactedBefore"]);
  });
});
