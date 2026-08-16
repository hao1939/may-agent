import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";

export const name = "session-recovery";
export const description =
  "Recover or escalate a failed session from a session.end error/interrupted event.";

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

function parseJsonBlock(
  task: string,
  heading: string,
): Record<string, unknown> | null {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = task.match(
    new RegExp(
      `## ${escaped}\\s*\\n\\\`\\\`\\\`json\\s*([\\s\\S]*?)\\s*\\\`\\\`\\\``,
    ),
  );
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1] ?? "");
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
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
    maxAttempts:
      typeof parsed.maxAttempts === "number" ? parsed.maxAttempts : undefined,
    error: String(parsed.error ?? ""),
    task: String(parsed.task ?? ""),
  };
}

function decisionFromInput(input: unknown): RecoveryDecision | null {
  if (typeof input === "string") return decisionFromTask(input);
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const parsed = input as Record<string, unknown>;
  const sessionId = String(parsed.sessionId ?? "").trim();
  const agent = String(parsed.agent ?? "").trim();
  const action = String(parsed.action ?? "").trim();
  if (!sessionId || !agent || !action) return null;
  return {
    sessionId,
    agent,
    action,
    source: String(parsed.source ?? ""),
    attempt: typeof parsed.attempt === "number" ? parsed.attempt : undefined,
    maxAttempts:
      typeof parsed.maxAttempts === "number" ? parsed.maxAttempts : undefined,
    error: String(parsed.error ?? ""),
    task: String(parsed.task ?? ""),
  };
}

async function emit(
  ctx: WorkflowContext,
  type: string,
  data: Record<string, unknown>,
  owner?: string,
): Promise<void> {
  await ctx.events.emit({ type, data, ...(owner ? { owner } : {}) });
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

export async function execute(ctx: WorkflowContext): Promise<ExecutionResult> {
  const decision = decisionFromInput(ctx.input);
  if (!decision) {
    await emit(
      ctx,
      "session.recovery_skipped",
      {
        reason: "missing-recovery-decision-block",
      },
      "agent:may",
    );
    return ctx.done(
      "session-recovery: no Recovery Decision block found in task — skipping (not actionable).",
    );
  }

  if (decision.action === "resume" || decision.action === "requeue") {
    if (!decision.task?.trim()) {
      await emit(
        ctx,
        "session.recovery_failed",
        {
          sessionId: decision.sessionId,
          agent: decision.agent,
          reason: "missing original task",
        },
        "agent:may",
      );
      return ctx.done(
        `Cannot recover ${decision.sessionId}: missing original task — skipping.`,
      );
    }

    const result = await ctx.agents.call(
      decision.agent,
      recoveryPrompt(decision),
    );
    await emit(
      ctx,
      "session.recovery_attempted",
      {
        sessionId: decision.sessionId,
        agent: decision.agent,
        action: decision.action,
        attempt: decision.attempt ?? null,
        newSessionId: result.id,
        status: result.status,
      },
      "agent:may",
    );

    if (result.status === "error") {
      return ctx.blocked(`Recovery rerun failed for ${decision.sessionId}`, {
        originalSessionId: decision.sessionId,
        recoverySessionId: result.id,
        error: result.summary,
        evidence: result.evidence,
      });
    }

    return ctx.done(
      `Recovery ${decision.action} for ${decision.sessionId} ran as ${result.id} (${result.status}).`,
    );
  }

  if (decision.action === "escalate") {
    const reason = `Digest classifier recommended escalation for failed session ${decision.sessionId}: ${compact(decision.error, 500) || "unknown error"}`;
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
      {
        sessionId: decision.sessionId,
        agent: decision.agent,
        reason,
      },
      `agent:${decision.agent || "may"}`,
    );
    return ctx.blocked(reason, decision);
  }

  await emit(
    ctx,
    "session.recovery_skipped",
    {
      sessionId: decision.sessionId,
      agent: decision.agent,
      action: decision.action,
    },
    "agent:may",
  );
  return ctx.done(
    `Recovery skipped for ${decision.sessionId}: classifier chose ${decision.action}.`,
  );
}
