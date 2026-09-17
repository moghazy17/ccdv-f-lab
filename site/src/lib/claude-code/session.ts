import type { SimulatedCommand, TranscriptStep } from "./commands";

export type TerminalSurface = "module" | "playground";
export type TurnKind = "command" | "summary" | "unimplemented";

export interface SessionTurn {
  input: string;
  kind: TurnKind;
  command: SimulatedCommand | null;
  transcript: readonly TranscriptStep[];
}

export interface SimulatedSession {
  surface: TerminalSurface;
  turns: readonly SessionTurn[];
  compactedBefore: number | null;
}

export interface ResolvedTurn {
  session: SimulatedSession;
  turn: SessionTurn | null;
  operation: "clear" | "compact" | null;
}

/** Start a visit-only transcript. This module intentionally has no storage dependency. */
export function createSession(surface: TerminalSurface): SimulatedSession {
  return { surface, turns: [], compactedBefore: null };
}

/** Resolve only data-backed typeable entries; all other input stays explicitly unimplemented. */
export function resolveTurn(
  session: SimulatedSession,
  input: string,
  commands: readonly SimulatedCommand[]
): ResolvedTurn {
  const trimmed = input.trim();
  const command = commands.find(
    (candidate) => candidate.kind !== "component" && candidate.invocation === trimmed
  );
  if (command === undefined) {
    const turn: SessionTurn = {
      input: trimmed,
      kind: "unimplemented",
      command: null,
      transcript: [
        {
          stream: "stderr",
          text:
            "Not implemented here. This simulator cannot run Claude Code or fabricate a model response."
        }
      ]
    };
    return { session: appendTurn(session, turn), turn, operation: null };
  }
  if (command.id === "clear-session") {
    return { session: clearSession(session), turn: null, operation: "clear" };
  }
  if (command.id === "compact-session") {
    return { session: compactSession(session), turn: null, operation: "compact" };
  }
  const turn: SessionTurn = {
    input: trimmed,
    kind: "command",
    command,
    transcript: command.transcript
  };
  return { session: appendTurn(session, turn), turn, operation: null };
}

/** Remove every turn and the compaction marker; a clear never produces a summary. */
export function clearSession(session: SimulatedSession): SimulatedSession {
  return { ...session, turns: [], compactedBefore: null };
}

/** Summarise turns before the requested point without removing any later turns. */
export function compactSession(session: SimulatedSession, before = session.turns.length): SimulatedSession {
  const point = Math.max(0, Math.min(before, session.turns.length));
  if (point === 0) {
    return { ...session, compactedBefore: 0 };
  }
  const summary: SessionTurn = {
    input: "/compact",
    kind: "summary",
    command: null,
    transcript: [
      {
        stream: "stdout",
        text: `Compacted ${point} earlier ${point === 1 ? "turn" : "turns"}; this session continues.`
      }
    ]
  };
  return { ...session, turns: [summary, ...session.turns.slice(point)], compactedBefore: point };
}

function appendTurn(session: SimulatedSession, turn: SessionTurn): SimulatedSession {
  return { ...session, turns: [...session.turns, turn] };
}
