import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";
import {
  buildDeepEvaluationTask,
  deepEvaluationOutcomeSchema,
  parseDeepEvaluationOutcome,
} from "./lib/deep-evaluation.js";

export const name = "evaluator-deep-eval";
export const description =
  "Run one bounded evaluator judgment and publish its validated evaluation fact.";

type DeepEvaluationInput = {
  sessionId?: string;
};

function result(summary: string, evidence: string[]) {
  return { state: "converged" as const, summary, evidence, actions: [] };
}

export async function execute(
  ctx: WorkflowContext<DeepEvaluationInput>,
): Promise<ExecutionResult> {
  const requestedSessionId =
    typeof ctx.input?.sessionId === "string" ? ctx.input.sessionId.trim() : "";
  await ctx.events.emit({
    type: "evaluation.deep_dispatched",
    data: {
      source: name,
      ...(requestedSessionId ? { sessionId: requestedSessionId } : {}),
    },
    target: {
      appId: "evaluation",
      ...(requestedSessionId ? { sessionId: requestedSessionId } : {}),
    },
  });

  const execution = await ctx.agents.call(
    "evaluator",
    buildDeepEvaluationTask(requestedSessionId),
    { schema: deepEvaluationOutcomeSchema },
  );
  if (execution.status !== "done") {
    const summary = `Deep evaluator execution ${execution.id} ended ${execution.status}: ${execution.summary}`;
    await ctx.events.emit({
      type: "evaluation.deep_failed",
      data: {
        source: name,
        executionId: execution.id,
        status: execution.status,
        summary: execution.summary,
        ...(requestedSessionId ? { sessionId: requestedSessionId } : {}),
      },
      target: {
        appId: "evaluation",
        executionId: execution.id,
        ...(requestedSessionId ? { sessionId: requestedSessionId } : {}),
      },
    });
    return ctx.done(summary, result(summary, [`execution:${execution.id}`]));
  }

  const outcome = parseDeepEvaluationOutcome(
    execution.output,
    requestedSessionId,
  );
  if (!outcome) {
    const summary = requestedSessionId
      ? `Deep evaluator output for selected session ${requestedSessionId} failed validation.`
      : "Deep evaluator output failed validation; no explicit noCandidate reason or valid evaluation was preserved.";
    await ctx.events.emit({
      type: "evaluation.deep_failed",
      data: {
        source: name,
        executionId: execution.id,
        status: "invalid-output",
        summary,
        ...(requestedSessionId ? { sessionId: requestedSessionId } : {}),
      },
      target: {
        appId: "evaluation",
        executionId: execution.id,
        ...(requestedSessionId ? { sessionId: requestedSessionId } : {}),
      },
    });
    return ctx.blocked(summary, [`execution:${execution.id}`]);
  }
  if (outcome.kind === "none") {
    return ctx.done(
      outcome.reason,
      result(outcome.reason, [`execution:${execution.id}`]),
    );
  }

  const evaluation = { ...outcome.evaluation, createdAt: Date.now() };
  await ctx.events.emit({
    type: "evaluation.deep_recorded",
    data: { source: name, evaluation },
    target: {
      appId: "evaluation",
      project: "evaluation",
      sessionId: evaluation.sessionId,
    },
  });
  const summary = `Recorded deep evaluation for ${evaluation.sessionId} with verdict ${evaluation.verdict}.`;
  return ctx.done(
    summary,
    result(summary, [
      `execution:${execution.id}`,
      `recorded-evaluation:${evaluation.sessionId}`,
    ]),
  );
}
