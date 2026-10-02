import type { TaskAttempt } from "@may-agent/sdk/app";
import { join } from "node:path";
import { writeContentAddressedJson } from "../../../../lib/artifacts.js";
import { taskDecisionState, previewTaskDecisionSections } from "../../../../lib/task-decision-context.js";

export const MAX_CODEX_GOAL_OBJECTIVE_CHARS = 4_000;
const CODEX_ATTEMPT_PACKET_MARKER = "## Canonical May Task Attempt\n";

export type CanonicalTaskAttemptPacket = ReturnType<typeof projectCanonicalTaskAttempt>;

/** Preserve the same starting facts as managed agents, without serializing capabilities. */
export function projectCanonicalTaskAttempt(attempt: TaskAttempt) {
  return structuredClone({
    identity: {
      appId: attempt.appId,
      taskId: attempt.task.id,
      generation: attempt.task.generation,
      resourceVersion: attempt.resourceVersion,
      attemptId: attempt.attemptId,
    },
    observed: { snapshot: "attempt-start", resourceVersion: attempt.task.resourceVersion },
    ...taskDecisionState(attempt.task, attempt.events),
    role: attempt.role,
    related: { childrenAtAttemptStart: attempt.children },
    waitsAtAttemptStart: attempt.waits,
    ...(attempt.previousAttempt ? { previousAttempt: attempt.previousAttempt } : {}),
    workspace: { cwd: attempt.cwd, declaredOutputPaths: attempt.declaredOutputPaths },
    contract: { resultSchema: attempt.resultSchema },
  });
}

export function renderCodexGoalTaskAttempt(
  packet: CanonicalTaskAttemptPacket,
  detailRoot: string,
): {
  goalObjective: string;
  developerInstructions: string;
} {
  const prefix = `Achieve May Task ${packet.identity.appId}/${packet.identity.taskId} generation ${packet.identity.generation}: `;
  const outcomeChars = Math.max(0, MAX_CODEX_GOAL_OBJECTIVE_CHARS - prefix.length);
  const goalObjective = `${prefix}${packet.assignment.outcome.slice(0, outcomeChars)}`;
  const { identity, observed, role, contract, ...full } = packet;
  const sections = previewTaskDecisionSections(full);
  // Only omitted context needs a file. Fail visibly before starting a provider
  // if its required detail cannot be saved, rather than sending unusable pointers.
  const detail =
    JSON.stringify(sections) === JSON.stringify(full)
      ? undefined
      : join(detailRoot, writeContentAddressedJson(detailRoot, "task-context", packet).ref);
  const context = {
    identity,
    observed,
    role,
    ...sections,
    contract,
    coverage: {
      ...(detail ? { detail } : {}),
      note: "Attempt-start snapshot. Assigned input and pending input are separate; observing either is not fulfillment. Omitted values have JSON pointers into detail. Read that file before a decision needing omitted evidence. Live steering carries new input; the next reconciliation supplies the refreshed Task snapshot.",
    },
  };
  return {
    goalObjective,
    developerInstructions: [
      "You are the replaceable executor pursuing one fenced May Task goal.",
      "Use the supplied Task context alongside your role. The May Task and its App remain the completion authority.",
      "Keep the goal active across automatic continuation turns. Do not mark it complete or return merely because one useful step or turn ended.",
      "Return only after acceptance is supported or an exact external wait is identified.",
      "Return only a result accepted by the supplied resultSchema.",
      "Follow the Task's authorized scope and the installation's execution permissions; available tools do not grant additional authority.",
      "Progress commentary may become a durable Task event, so omit secret values, raw command output, tool payloads, and diffs.",
      "",
      CODEX_ATTEMPT_PACKET_MARKER + JSON.stringify(context),
    ].join("\n"),
  };
}
