import type { WorkflowContext, WorkflowResult } from "@may-agent/sdk";
import {
  buildDeepEvaluationTask,
  ensureDeepEvaluationArtifactDir,
  normalizeDeepEvaluationCandidate,
  readDeepEvaluationArtifact,
  recordDeepEvaluation,
  recordPendingDeepEvaluationArtifacts,
} from "./lib/deep-evaluation.js";

export const name = "evaluator-deep-eval";

export const description =
  "Reuse the evaluator's learned deep-review process: select one candidate, inspect substance, validate its artifact, and record the result.";

export function reconciliationInput(task: string): Record<string, unknown> {
  const raw = task.match(
    /## Reconciliation Task\s*```json\s*([\s\S]*?)```/,
  )?.[1];
  if (!raw) return {};
  try {
    const packet = JSON.parse(raw) as { input?: unknown };
    return packet.input &&
      typeof packet.input === "object" &&
      !Array.isArray(packet.input)
      ? (packet.input as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const input = reconciliationInput(ctx.task);
  const requestedSessionId =
    typeof input.sessionId === "string" ? input.sessionId.trim() : "";
  const db = ctx.getDb() as any;
  ensureDeepEvaluationArtifactDir(ctx.projectRoot);

  const recordedPending = recordPendingDeepEvaluationArtifacts(
    db,
    ctx.projectRoot,
  );
  if (recordedPending > 0) {
    ctx.emit({
      type: "evaluation.deep_recorded",
      project: "evaluation",
      data: { count: recordedPending, source: name },
    });
    const summary = `Recorded ${recordedPending} validated deep-evaluation artifact(s).`;
    return ctx.done(summary, {
      state: "converged",
      summary,
      evidence: [`deep-evaluations:${recordedPending}`],
      actions: [],
    });
  }

  let candidate;
  if (requestedSessionId) {
    const context = ctx.query.evaluatorAftermathContext({
      sessionId: requestedSessionId,
    });
    candidate = normalizeDeepEvaluationCandidate(context.session);
  } else {
    const scan = ctx.query.evaluatorDeepEvalScan({
      now: Date.now(),
      backfillHours: 24,
      fallbackDelayMs: 15 * 60_000,
      activeWindowMs: 30 * 60_000,
    });
    if (scan.activeDeepEval) {
      const summary =
        "A recent deep evaluation is still active; no duplicate was dispatched.";
      return ctx.done(summary, {
        state: "converged",
        summary,
        evidence: ["query:evaluatorDeepEvalScan"],
        actions: [],
      });
    }
    candidate = normalizeDeepEvaluationCandidate(scan.candidate);
  }

  if (!candidate) {
    const summary = requestedSessionId
      ? `Session ${requestedSessionId} is unavailable for deep evaluation.`
      : "No eligible session currently needs deep evaluation.";
    return ctx.done(summary, {
      state: "converged",
      summary,
      evidence: [
        requestedSessionId
          ? `session:${requestedSessionId}`
          : "query:evaluatorDeepEvalScan",
      ],
      actions: [],
    });
  }

  ctx.emit({
    type: "evaluation.deep_dispatched",
    project: "evaluation",
    data: {
      source: name,
      sessionId: candidate.sessionId,
      agent: candidate.agent,
    },
  });
  const result = await ctx.runAgent(
    "evaluator",
    buildDeepEvaluationTask(candidate, ctx.persistDir, ctx.projectRoot),
  );
  if (result.status === "error" || result.status === "interrupted") {
    const summary = `Deep evaluator session failed for ${candidate.sessionId}: ${result.error ?? result.status}`;
    ctx.emit({
      type: "evaluation.deep_failed",
      project: "evaluation",
      data: {
        source: name,
        sessionId: candidate.sessionId,
        agent: candidate.agent,
        error: result.error ?? result.status,
      },
    });
    return ctx.done(summary, {
      state: "needs-owner",
      summary,
      evidence: [`session:${result.sessionId}`],
      actions: [],
    });
  }

  const evaluation = readDeepEvaluationArtifact(ctx.projectRoot, candidate);
  if (!evaluation) {
    const summary = `Deep evaluator did not produce a valid artifact for ${candidate.sessionId}.`;
    return ctx.done(summary, {
      state: "needs-owner",
      summary,
      evidence: [`session:${result.sessionId}`],
      actions: [],
    });
  }

  recordDeepEvaluation(db, evaluation);
  ctx.emit({
    type: "evaluation.deep_recorded",
    project: "evaluation",
    data: {
      source: name,
      count: 1,
      sessionId: candidate.sessionId,
      agent: candidate.agent,
      verdict: evaluation.verdict,
    },
  });
  const summary = `Recorded deep evaluation for ${candidate.sessionId} with verdict ${evaluation.verdict}.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: [
      `session:${result.sessionId}`,
      `evaluated-session:${candidate.sessionId}`,
    ],
    actions: [],
  });
}
