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
    mode: "achieve" | "maintain";
    input: JsonRecord;
  };
  role: {
    agent: string;
    instructions: string;
    capabilities: string[];
  };
  events: TaskReconciliationEvents & {
    checkpoint?: { summary: string; evidence: string[] };
  };
  observations: {
    children: TaskAttempt["children"];
    dependencies: JsonRecord[];
  };
  workspace: {
    cwd: string;
    declaredOutputPaths: string[];
  };
  contract: {
    resultSchema: JsonRecord;
  };
  limits: {
    deadlineAt: string;
    remainingTaskTokens: number | null;
    sandbox: "read-only" | "workspace-write" | "danger-full-access";
  };
};

/** One semantic projection which every executor renderer must consume whole. */
export function buildCanonicalTaskAttemptPacket(input: CanonicalTaskAttemptPacket): CanonicalTaskAttemptPacket {
  return structuredClone(input);
}

export function renderNativeTaskAttempt(packet: CanonicalTaskAttemptPacket): CanonicalTaskAttemptPacket {
  return structuredClone(packet);
}

export function renderCodexGoalTaskAttempt(packet: CanonicalTaskAttemptPacket): {
  goalObjective: string;
  developerInstructions: string;
} {
  const prefix = `Advance May Task ${packet.identity.appId}/${packet.identity.taskId} generation ${packet.identity.generation}: `;
  const outcomeChars = Math.max(0, MAX_CODEX_GOAL_OBJECTIVE_CHARS - prefix.length);
  const goalObjective = `${prefix}${packet.desired.outcome.slice(0, outcomeChars)}`;
  return {
    goalObjective,
    developerInstructions: [
      "You are a replaceable executor for one fenced May Task attempt.",
      "Use every field in the canonical packet. The May Task and its App remain the completion authority.",
      "Return only a result accepted by the supplied resultSchema.",
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
