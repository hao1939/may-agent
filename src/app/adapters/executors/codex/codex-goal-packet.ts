import type { TaskAttempt, TaskReconciliationEvents } from "@may-agent/sdk/app";

type JsonRecord = Record<string, unknown>;

export const MAX_CODEX_GOAL_OBJECTIVE_CHARS = 4_000;
export const CODEX_ATTEMPT_PACKET_MARKER = "## Canonical May Task Attempt\n";

export type CanonicalTaskAttemptPacket = {
  identity: {
    appId: string;
    taskId: string;
    generation: number;
    resourceVersion: number;
    attemptId: string;
  };
  desired: {
    outcome: string;
    acceptance: string[];

    input: JsonRecord;
  };
  role: {
    agent: string;
    instructions: string;
  };
  events: TaskReconciliationEvents & {
    checkpoint?: { summary: string; facts: string[] };
  };
  observations: {
    children: TaskAttempt["children"];
    waits: TaskAttempt["waits"];
    previousAttempt?: TaskAttempt["previousAttempt"];
  };
  workspace: {
    cwd: string;
    declaredOutputPaths: string[];
  };
  contract: {
    resultSchema: JsonRecord;
  };
};

/** Strip live capabilities from the Runtime-built TaskAttempt for transport. */
export function projectCanonicalTaskAttempt(attempt: TaskAttempt): CanonicalTaskAttemptPacket {
  return {
    identity: {
      appId: attempt.appId,
      taskId: attempt.task.id,
      generation: attempt.task.generation,
      resourceVersion: attempt.resourceVersion,
      attemptId: attempt.attemptId,
    },
    desired: {
      outcome: attempt.task.outcome,
      acceptance: structuredClone(attempt.task.acceptance),

      input: structuredClone(attempt.task.input),
    },
    role: structuredClone(attempt.role),
    events: structuredClone(attempt.events),
    observations: {
      children: structuredClone(attempt.children),
      waits: structuredClone(attempt.waits),
      ...(attempt.previousAttempt ? { previousAttempt: structuredClone(attempt.previousAttempt) } : {}),
    },
    workspace: {
      cwd: attempt.cwd,
      declaredOutputPaths: structuredClone(attempt.declaredOutputPaths),
    },
    contract: { resultSchema: structuredClone(attempt.resultSchema) },
  };
}

export function renderCodexGoalTaskAttempt(packet: CanonicalTaskAttemptPacket): {
  goalObjective: string;
  developerInstructions: string;
} {
  const prefix = `Achieve May Task ${packet.identity.appId}/${packet.identity.taskId} generation ${packet.identity.generation}: `;
  const outcomeChars = Math.max(0, MAX_CODEX_GOAL_OBJECTIVE_CHARS - prefix.length);
  const goalObjective = `${prefix}${packet.desired.outcome.slice(0, outcomeChars)}`;
  return {
    goalObjective,
    developerInstructions: [
      "You are the replaceable executor pursuing one fenced May Task goal.",
      "Use every field in the canonical packet. The May Task and its App remain the completion authority.",
      "Keep the goal active across automatic continuation turns. Do not mark it complete or return merely because one useful step or turn ended.",
      "Return only after acceptance is supported or an exact external wait is identified.",
      "Return only a result accepted by the supplied resultSchema.",
      "The workspace is read-only; cite exact facts and do not mutate files or external systems.",
      "Progress commentary may become a durable Task event, so omit secret values, raw command output, tool payloads, and diffs.",
      "",
      CODEX_ATTEMPT_PACKET_MARKER + JSON.stringify(packet),
    ].join("\n"),
  };
}

export function readCodexGoalTaskAttempt(developerInstructions: string): CanonicalTaskAttemptPacket {
  const markerAt = developerInstructions.indexOf(CODEX_ATTEMPT_PACKET_MARKER);
  if (markerAt < 0) throw new Error("Codex instructions do not contain the canonical Task attempt packet");
  return JSON.parse(developerInstructions.slice(markerAt + CODEX_ATTEMPT_PACKET_MARKER.length));
}
