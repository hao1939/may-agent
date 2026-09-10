import { admitTaskReconcileResult, type TaskReconcileAdmissionOptions, type TaskReconcileResult } from "@may-agent/sdk";

const MAX_ADMISSION_ERROR_CHARS = 1_024;

export type CodexGoalTaskResultAdmission =
  { kind: "accepted"; result: TaskReconcileResult } | { kind: "retry"; reason: string; nextAttemptContext: string };

function boundedError(error: string): string {
  if (error.length <= MAX_ADMISSION_ERROR_CHARS) return error;
  return `${error.slice(0, MAX_ADMISSION_ERROR_CHARS - 3)}...`;
}

/** Boundary between one terminal Codex goal turn and May Task admission. */
export function admitCodexGoalTaskResult(
  finalAnswer: string | null,
  options: TaskReconcileAdmissionOptions,
): CodexGoalTaskResultAdmission {
  if (!finalAnswer?.trim()) {
    return retry("terminal Codex turn returned no final answer");
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(finalAnswer);
  } catch (error) {
    return retry(`terminal Codex answer was not exact JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  const admitted = admitTaskReconcileResult(candidate, options);
  if (!admitted.ok) return retry(`May Task result admission rejected the candidate: ${admitted.error}`);
  return { kind: "accepted", result: admitted.result };
}

function retry(reason: string): Extract<CodexGoalTaskResultAdmission, { kind: "retry" }> {
  const boundedReason = boundedError(reason);
  return {
    kind: "retry",
    reason: boundedReason,
    nextAttemptContext: [
      "The previous executor turn ended, but May did not accept its Task result.",
      `Admission finding: ${boundedReason}`,
      "The May Task remains pending. Continue the same Task from current workspace evidence.",
      'Return exactly one JSON object whose state is "converged", "waiting", or an App-authorized "stopped", and which passes the supplied Task result schema.',
    ].join("\n"),
  };
}
