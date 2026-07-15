import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";

export const name = "session-recovery";
export const description = "Recover or escalate a failed session from a session.end error/interrupted event.";

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

function parseJsonBlock(task: string, heading: string): Record<string, unknown> | null {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = task.match(new RegExp(`## ${escaped}\\s*\\n\\\`\\\`\\\`json\\s*([\\s\\S]*?)\\s*\\\`\\\`\\\``));
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1] ?? "");
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function decisionFromTask(task: string): RecoveryDecision | null {
  const parsed = parseJsonBlock(task, "Recovery Decision");
  if (!parsed) return null;
  const sessionId = String(parsed.sessionId ?? "");
  const agent = String(parsed.agent ?? "");
  const action = String(parsed.action ?? "");
  if (!sessionId || !agent || !action) return null;
  return {
    sessionId,
    agent,
    action,
    source: String(parsed.source ?? ""),
    attempt: typeof parsed.attempt === "number" ? parsed.attempt : undefined,
    maxAttempts: typeof parsed.maxAttempts === "number" ? parsed.maxAttempts : undefined,
    error: String(parsed.error ?? ""),
    task: String(parsed.task ?? ""),
  };
}

function compact(value: string | undefined, limit = 500): string {
  const text = (value ?? "").trim();
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 3)}...`;
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
    "Run the original task again. If the failure is still present, stop cleanly and explain the concrete blocker.",
    "",
    "## Original Task",
    decision.task || "(missing original task)",
  ].join("\n");
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const decision = decisionFromTask(ctx.task);
  if (!decision) return ctx.blocked("session-recovery requires a Recovery Decision block", { task: ctx.task.slice(0, 1000) });

  if (decision.action === "resume" || decision.action === "requeue") {
    if (!decision.task?.trim()) {
      ctx.emit({
        type: "session.recovery_failed",
        owner: "may",
        sessionId: decision.sessionId,
        agent: decision.agent,
        reason: "missing original task",
      });
      return ctx.blocked(`Cannot recover ${decision.sessionId}: missing original task`, decision);
    }

    const result = await ctx.runAgent(decision.agent, recoveryPrompt(decision));
    ctx.emit({
      type: "session.recovery_attempted",
      owner: "may",
      sessionId: decision.sessionId,
      agent: decision.agent,
      action: decision.action,
      attempt: decision.attempt ?? null,
      newSessionId: result.sessionId,
      status: result.status,
    });

    if (result.status === "error") {
      return ctx.blocked(`Recovery rerun failed for ${decision.sessionId}`, {
        originalSessionId: decision.sessionId,
        recoverySessionId: result.sessionId,
        error: result.error,
      });
    }

    return ctx.done(`Recovery ${decision.action} for ${decision.sessionId} ran as ${result.sessionId} (${result.status}).`);
  }

  if (decision.action === "escalate") {
    const reason = `Digest classifier recommended escalation for failed session ${decision.sessionId}: ${compact(decision.error, 500) || "unknown error"}`;
    ctx.notify(reason);
    ctx.emit({
      type: "session.recovery_escalated",
      owner: decision.agent || "may",
      sessionId: decision.sessionId,
      agent: decision.agent,
      reason,
    });
    return ctx.blocked(reason, decision);
  }

  ctx.emit({
    type: "session.recovery_skipped",
    owner: "may",
    sessionId: decision.sessionId,
    agent: decision.agent,
    action: decision.action,
  });
  return ctx.done(`Recovery skipped for ${decision.sessionId}: classifier chose ${decision.action}.`);
}
