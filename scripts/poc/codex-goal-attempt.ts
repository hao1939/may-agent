import { decideCodexGoalLiveness, type CodexGoalLivenessAction, type CodexGoalStatus } from "./codex-goal-liveness.js";

export type CodexGoalAttemptControl = {
  reactivate(): Promise<void>;
  steer(turnId: string, message: string): Promise<void>;
  interrupt(turnId: string): Promise<void>;
  waitForTerminalTurn(turnId: string): Promise<"completed" | "interrupted" | "failed">;
};

export type CodexGoalAttemptDisposition =
  | { kind: "observe"; reason: string; nudgeCount: number }
  | { kind: "wait"; reason: string; nudgeCount: number }
  | { kind: "requeue"; reason: string; backoffMs: number; terminalTurnStatus: string; nudgeCount: number };

export function boundedStaleBackoffMs(staleInterruptCount: number): number {
  const exponent = Math.min(6, Math.max(0, Math.floor(staleInterruptCount)));
  return Math.min(60_000, 1_000 * 2 ** exponent);
}

/**
 * Execute one pure liveness decision against a narrow protocol seam.
 *
 * It owns no timer and never starts a second turn. A hard-stale attempt is not
 * released until app-server reports the interrupted turn's terminal event.
 */
export async function reconcileCodexGoalAttemptLiveness(input: {
  control: CodexGoalAttemptControl;
  turnId: string | null;
  staleInterruptCount: number;
  nudgeMessage: string;
  nowMs: number;
  lastActivityAtMs: number;
  softStaleAfterMs: number;
  hardStaleAfterMs: number;
  nudgeCount: number;
  taskPaused: boolean;
  turnActive: boolean;
  goalStatus: CodexGoalStatus;
}): Promise<{ decision: CodexGoalLivenessAction; disposition: CodexGoalAttemptDisposition }> {
  const decision = decideCodexGoalLiveness(input);
  if (decision.kind === "observe") {
    return { decision, disposition: { kind: "observe", reason: decision.reason, nudgeCount: input.nudgeCount } };
  }
  if (decision.kind === "report-wait") {
    return { decision, disposition: { kind: "wait", reason: decision.reason, nudgeCount: input.nudgeCount } };
  }
  if (decision.kind === "reactivate") {
    await input.control.reactivate();
    return { decision, disposition: { kind: "observe", reason: decision.reason, nudgeCount: input.nudgeCount } };
  }
  if (!input.turnId) throw new Error(`Liveness decision ${decision.kind} requires an active turn id`);
  if (decision.kind === "steer") {
    await input.control.steer(input.turnId, input.nudgeMessage);
    return { decision, disposition: { kind: "observe", reason: decision.reason, nudgeCount: 1 } };
  }

  await input.control.interrupt(input.turnId);
  const terminalTurnStatus = await input.control.waitForTerminalTurn(input.turnId);
  return {
    decision,
    disposition: {
      kind: "requeue",
      reason: `${decision.reason}; turn ended ${terminalTurnStatus}`,
      backoffMs: boundedStaleBackoffMs(input.staleInterruptCount),
      terminalTurnStatus,
      nudgeCount: input.nudgeCount,
    },
  };
}
