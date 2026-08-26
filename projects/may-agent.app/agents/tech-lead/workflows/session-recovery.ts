import type {
  ExecutionResult,
  TaskReconcileResult,
  WorkflowContext,
} from "@may-agent/sdk";

export const name = "session-recovery";
export const description =
  "Resolve one failed session selected by Host recovery policy.";

type RecoveryDecision = {
  sessionId: string;
  agent: string;
  action: string;
  source?: string;
  attempt?: number;
  maxAttempts?: number;
  error?: string;
  task?: string;
};

function decisionFromInput(input: unknown): RecoveryDecision | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  const sessionId = String(value.sessionId ?? "").trim();
  const agent = String(value.agent ?? "").trim();
  const action = String(value.action ?? "").trim();
  if (!sessionId || !agent || !action) return null;
  return {
    sessionId,
    agent,
    action,
    source: String(value.source ?? ""),
    attempt: typeof value.attempt === "number" ? value.attempt : undefined,
    maxAttempts:
      typeof value.maxAttempts === "number" ? value.maxAttempts : undefined,
    error: String(value.error ?? ""),
    task: String(value.task ?? ""),
  };
}

async function emit(
  ctx: WorkflowContext,
  type: string,
  data: Record<string, unknown>,
  owner = "agent:may",
): Promise<void> {
  await ctx.events.emit({ type, data, owner });
}

function compact(value: string | undefined, limit = 500): string {
  const text = (value ?? "").trim();
  return text.length <= limit ? text : `${text.slice(0, limit - 3)}...`;
}

function evidence(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function recoveryPrompt(decision: RecoveryDecision): string {
  return [
    `[session-recovery] Rerun failed session ${decision.sessionId}.`,
    "",
    `Original failed agent: ${decision.agent}`,
    `Classifier action: ${decision.action}`,
    `Decision source: ${decision.source || "unknown"}`,
    `Attempt: ${decision.attempt ?? "unknown"}/${decision.maxAttempts ?? "unknown"}`,
    `Failure: ${compact(decision.error, 800) || "unknown"}`,
    "",
    "Run the original task again. If it still fails, stop and report the concrete blocker.",
    "",
    "## Original Task",
    decision.task || "(missing original task)",
  ].join("\n");
}

function result(
  ctx: WorkflowContext,
  state: TaskReconcileResult["state"],
  summary: string,
  evidence: string[] = [],
): ExecutionResult<TaskReconcileResult> {
  return ctx.done(summary, { state, summary, evidence, actions: [] });
}

export async function execute(
  ctx: WorkflowContext,
): Promise<ExecutionResult<TaskReconcileResult>> {
  const decision = decisionFromInput(ctx.reconciliation?.input ?? ctx.input);
  if (!decision) {
    await emit(ctx, "session.recovery_skipped", {
      reason: "missing-recovery-input",
    });
    return result(
      ctx,
      "converged",
      "Session recovery input was incomplete, so no action was taken.",
      ["session-recovery:missing-input"],
    );
  }

  if (decision.action === "resume" || decision.action === "requeue") {
    if (!decision.task?.trim()) {
      await emit(ctx, "session.recovery_failed", {
        sessionId: decision.sessionId,
        agent: decision.agent,
        reason: "missing original task",
      });
      return result(
        ctx,
        "needs-agent",
        `Cannot recover ${decision.sessionId}: the original task is missing.`,
        [`session:${decision.sessionId}`],
      );
    }

    const rerun = await ctx.agents.call(
      decision.agent,
      recoveryPrompt(decision),
    );
    await emit(ctx, "session.recovery_attempted", {
      sessionId: decision.sessionId,
      agent: decision.agent,
      action: decision.action,
      attempt: decision.attempt ?? null,
      newSessionId: rerun.id,
      status: rerun.status,
    });

    if (rerun.status === "error") {
      return result(
        ctx,
        "needs-agent",
        `Recovery rerun ${rerun.id} failed for ${decision.sessionId}: ${rerun.summary}`,
        evidence(rerun.evidence),
      );
    }
    return result(
      ctx,
      "converged",
      `Recovery ${decision.action} for ${decision.sessionId} ran as ${rerun.id} (${rerun.status}).`,
      [...evidence(rerun.evidence), `session:${rerun.id}`],
    );
  }

  if (decision.action === "escalate") {
    const reason = `Failed session ${decision.sessionId} needs owner review: ${compact(decision.error) || "unknown error"}`;
    await emit(
      ctx,
      "escalation.created",
      {
        escalationId: `session-recovery:${decision.sessionId}`,
        sourceAgent: "tech-lead",
        sourceSessionId: decision.sessionId,
        reason,
        requestedAction:
          "Review the failed session and choose a recovery path.",
        evidence: decision,
      },
      `agent:${decision.agent || "may"}`,
    );
    await emit(
      ctx,
      "session.recovery_escalated",
      { sessionId: decision.sessionId, agent: decision.agent, reason },
      `agent:${decision.agent || "may"}`,
    );
    return result(ctx, "needs-agent", reason, [
      `session:${decision.sessionId}`,
    ]);
  }

  await emit(ctx, "session.recovery_skipped", {
    sessionId: decision.sessionId,
    agent: decision.agent,
    action: decision.action,
  });
  return result(
    ctx,
    "converged",
    `Recovery skipped for ${decision.sessionId}: classifier chose ${decision.action}.`,
    [`session:${decision.sessionId}`],
  );
}
