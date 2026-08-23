export type CodexGoalStatus = "active" | "paused" | "blocked" | "usageLimited" | "budgetLimited" | "complete";

export type CodexGoalLivenessAction =
  | { kind: "observe"; reason: string }
  | { kind: "reactivate"; reason: string }
  | { kind: "steer"; reason: string }
  | { kind: "interrupt"; reason: string }
  | { kind: "report-wait"; reason: string };

/**
 * Pure PoC policy evaluated when Task events or the nearest liveness deadline
 * wake the May reconciler. It owns no timer and performs no I/O.
 */
export function decideCodexGoalLiveness(input: {
  nowMs: number;
  lastActivityAtMs: number;
  softStaleAfterMs: number;
  hardStaleAfterMs: number;
  nudgeCount: number;
  taskPaused: boolean;
  turnActive: boolean;
  goalStatus: CodexGoalStatus;
}): CodexGoalLivenessAction {
  if (input.taskPaused) return { kind: "observe", reason: "May Task is explicitly paused" };
  if (input.goalStatus === "complete") {
    return { kind: "observe", reason: "Codex goal is complete; await turn completion and App verification" };
  }
  if (input.goalStatus === "blocked" || input.goalStatus === "usageLimited" || input.goalStatus === "budgetLimited") {
    return { kind: "report-wait", reason: `Codex goal reported ${input.goalStatus}` };
  }
  if (!input.turnActive || input.goalStatus === "paused") {
    return { kind: "reactivate", reason: "May Task is pending but Codex has no active turn" };
  }

  const silentForMs = Math.max(0, input.nowMs - input.lastActivityAtMs);
  if (silentForMs < input.softStaleAfterMs) {
    return { kind: "observe", reason: "Codex turn has recent protocol activity" };
  }
  if (silentForMs < input.hardStaleAfterMs) {
    return input.nudgeCount === 0
      ? { kind: "steer", reason: "Codex turn crossed the soft stale threshold" }
      : { kind: "observe", reason: "A bounded stale nudge is already outstanding" };
  }
  return { kind: "interrupt", reason: "Codex turn crossed the hard stale threshold" };
}
