import sourceData from "../../data/claude-code.json";
import type { InstructionFragment, InstructionScope } from "./hierarchy";

export type CommandKind = "built-in" | "custom" | "mode" | "component";
export type TranscriptStream = "stdout" | "stderr" | "event";

export interface TranscriptStep {
  stream: TranscriptStream;
  text: string;
  denial?: boolean;
}

export interface SimulatedCommand {
  id: string;
  guidedTask: number | null;
  invocation: string | null;
  kind: CommandKind;
  where: string | null;
  scope: "built-in" | "user" | "project" | null;
  definedBy: string | null;
  blueprintFeature: string;
  explanation: string;
  sourceAnchor: string;
  sourceUrl: string;
  transcript: readonly TranscriptStep[];
}

export type WorkedExampleComponentType =
  | "rules"
  | "settings"
  | "command"
  | "skill"
  | "agent"
  | "hook"
  | "documentation"
  | "unrecognized";

export interface WorkedExampleComponent {
  path: string;
  componentType: WorkedExampleComponentType;
  noteAnchor: string;
  contents?: string;
}

export interface HookRecordedCase {
  label: string;
  payload: unknown;
  exitCode: number;
  decision: "allow" | "deny";
  message: string;
  stdout: string;
}

export interface HookRecording {
  hookPath: string;
  recordedCases: readonly HookRecordedCase[];
}

export interface ClaudeCodeData {
  commands: readonly SimulatedCommand[];
  scopes: readonly InstructionScope[];
  fragments: readonly InstructionFragment[];
  workedExample: readonly WorkedExampleComponent[];
  hookRecording: HookRecording;
}

/** A dated source resolved by the exporter from SOURCES.md. */
export interface ClaudeCodeSource {
  anchor: string;
  url: string;
}

/** The generated Claude Code data, parsed once at the presentation boundary. */
export const claudeCodeData = parseClaudeCodeData(sourceData);

export const simulatedCommands = claudeCodeData.commands;

/** The existing hierarchy command owns the source for the hierarchy exercise. */
export const instructionHierarchySource: ClaudeCodeSource = (() => {
  const command = simulatedCommands.find((item) => item.id === "instruction-hierarchy");
  if (command === undefined) {
    throw new Error("Generated Claude Code data has no instruction hierarchy citation.");
  }
  return { anchor: command.sourceAnchor, url: command.sourceUrl };
})();

function parseClaudeCodeData(value: unknown): ClaudeCodeData {
  const record = requiredRecord(value, "Claude Code data");
  const scopes = requiredArray(record.scopes, "scopes").map(parseInstructionScope);
  const fragments = requiredArray(record.fragments, "fragments").map(parseInstructionFragment);
  validateFragmentScopeReferences(scopes, fragments);
  return {
    commands: requiredArray(record.commands, "commands").map(parseCommand),
    scopes,
    fragments,
    workedExample: requiredArray(record.workedExample, "workedExample").map(
      parseWorkedExampleComponent
    ),
    hookRecording: parseHookRecording(record.hookRecording)
  };
}

function validateFragmentScopeReferences(
  scopes: readonly InstructionScope[],
  fragments: readonly InstructionFragment[]
): void {
  const scopeIds = new Set(scopes.map((scope) => scope.id));
  for (const fragment of fragments) {
    if (!scopeIds.has(fragment.scopeId)) {
      throw new Error(
        `Generated Claude Code fragment ${fragment.id} names unknown scope ${fragment.scopeId}.`
      );
    }
  }
}

function parseInstructionScope(value: unknown): InstructionScope {
  const record = requiredRecord(value, "instruction scope");
  return {
    id: requiredString(record.id, "instruction scope.id"),
    name: requiredString(record.name, "instruction scope.name"),
    order: requiredNumber(record.order, "instruction scope.order"),
    path: requiredString(record.path, "instruction scope.path")
  };
}

function parseInstructionFragment(value: unknown): InstructionFragment {
  const record = requiredRecord(value, "instruction fragment");
  const conflictsWith = nullableString(record.conflicts_with, "instruction fragment.conflicts_with");
  const enforcedBy = nullableString(record.enforced_by, "instruction fragment.enforced_by");
  if (enforcedBy !== null && enforcedBy !== "settings" && enforcedBy !== "hook") {
    throw new Error("Generated Claude Code data has an invalid instruction fragment.enforced_by.");
  }
  if (typeof record.enforceable !== "boolean") {
    throw new Error("Generated Claude Code data has an invalid instruction fragment.enforceable.");
  }
  return {
    id: requiredString(record.id, "instruction fragment.id"),
    scopeId: requiredString(record.scope_id, "instruction fragment.scope_id"),
    text: requiredString(record.text, "instruction fragment.text"),
    conflictsWith,
    enforceable: record.enforceable,
    enforcedBy
  };
}

function parseCommand(value: unknown): SimulatedCommand {
  const record = requiredRecord(value, "command");
  const kind = requiredString(record.kind, "command.kind");
  if (kind !== "built-in" && kind !== "custom" && kind !== "mode" && kind !== "component") {
    throw new Error("Generated Claude Code data has an invalid command.kind.");
  }
  const scope = record.scope;
  if (scope !== null && scope !== "built-in" && scope !== "user" && scope !== "project") {
    throw new Error("Generated Claude Code data has an invalid command.scope.");
  }
  const definedBy = record.definedBy;
  if (definedBy !== null && typeof definedBy !== "string") {
    throw new Error("Generated Claude Code data has an invalid command.definedBy.");
  }
  const invocation = record.invocation;
  const where = record.where;
  const guidedTask = nullablePositiveInteger(record.guidedTask, "command.guidedTask");
  if (kind === "component") {
    if (
      invocation !== null ||
      typeof where !== "string" ||
      where.length === 0 ||
      guidedTask !== null
    ) {
      throw new Error("Generated Claude Code component data is invalid.");
    }
  } else if (typeof invocation !== "string" || invocation.length === 0 || where !== null) {
    throw new Error("Generated Claude Code command data has an invalid invocation.");
  }
  return {
    id: requiredString(record.id, "command.id"),
    guidedTask,
    invocation: invocation as string | null,
    kind,
    where: where as string | null,
    scope,
    definedBy,
    blueprintFeature: requiredString(record.blueprintFeature, "command.blueprintFeature"),
    explanation: requiredString(record.explanation, "command.explanation"),
    sourceAnchor: requiredString(record.sourceAnchor, "command.sourceAnchor"),
    sourceUrl: requiredString(record.sourceUrl, "command.sourceUrl"),
    transcript: requiredArray(record.transcript, "command.transcript").map(parseTranscriptStep)
  };
}

function parseWorkedExampleComponent(value: unknown): WorkedExampleComponent {
  const record = requiredRecord(value, "worked-example component");
  const componentType = requiredString(
    record.componentType,
    "worked-example component.componentType"
  );
  const validTypes: readonly WorkedExampleComponentType[] = [
    "rules",
    "settings",
    "command",
    "skill",
    "agent",
    "hook",
    "documentation",
    "unrecognized"
  ];
  if (!validTypes.includes(componentType as WorkedExampleComponentType)) {
    throw new Error("Generated Claude Code data has an invalid worked-example component type.");
  }
  const contents = optionalString(record.contents, "worked-example component.contents");
  return {
    path: requiredString(record.path, "worked-example component.path"),
    componentType: componentType as WorkedExampleComponentType,
    noteAnchor: requiredString(record.noteAnchor, "worked-example component.noteAnchor"),
    ...(contents === undefined ? {} : { contents })
  };
}

function parseHookRecording(value: unknown): HookRecording {
  const record = requiredRecord(value, "hook recording");
  return {
    hookPath: requiredString(record.hookPath, "hook recording.hookPath"),
    recordedCases: requiredArray(record.recordedCases, "hook recording.recordedCases").map(
      parseHookRecordedCase
    )
  };
}

function parseHookRecordedCase(value: unknown): HookRecordedCase {
  const record = requiredRecord(value, "hook recorded case");
  const decision = requiredString(record.decision, "hook recorded case.decision");
  if (decision !== "allow" && decision !== "deny") {
    throw new Error("Generated Claude Code data has an invalid hook-recording decision.");
  }
  return {
    label: requiredString(record.label, "hook recorded case.label"),
    payload: record.payload,
    exitCode: requiredNumber(record.exitCode, "hook recorded case.exitCode"),
    decision,
    message: requiredText(record.message, "hook recorded case.message"),
    stdout: requiredText(record.stdout, "hook recorded case.stdout")
  };
}

function parseTranscriptStep(value: unknown): TranscriptStep {
  const record = requiredRecord(value, "transcript step");
  const stream = requiredString(record.stream, "transcript step.stream");
  if (stream !== "stdout" && stream !== "stderr" && stream !== "event") {
    throw new Error("Generated Claude Code data has an invalid transcript step stream.");
  }
  if (record.denial !== undefined && typeof record.denial !== "boolean") {
    throw new Error("Generated Claude Code data has an invalid transcript denial marker.");
  }
  return { stream, text: requiredString(record.text, "transcript step.text"), denial: record.denial as boolean | undefined };
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Generated Claude Code data has an invalid ${label}.`);
  }
  return value as Record<string, unknown>;
}

function requiredArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`Generated Claude Code data has an invalid ${label}.`);
  }
  return value;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Generated Claude Code data has an invalid ${label}.`);
  }
  return value;
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`Generated Claude Code data has an invalid ${label}.`);
  }
  return value;
}

function optionalString(value: unknown, label: string): string | undefined {
  if (value !== undefined && typeof value !== "string") {
    throw new Error(`Generated Claude Code data has an invalid ${label}.`);
  }
  return value;
}

function nullableString(value: unknown, label: string): string | null {
  if (value !== null && typeof value !== "string") {
    throw new Error(`Generated Claude Code data has an invalid ${label}.`);
  }
  return value;
}

function requiredNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Generated Claude Code data has an invalid ${label}.`);
  }
  return value;
}

function nullablePositiveInteger(value: unknown, label: string): number | null {
  if (value === null) {
    return null;
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`Generated Claude Code data has an invalid ${label}.`);
  }
  return value;
}
