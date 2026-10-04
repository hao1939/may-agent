import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";
import {
  buildDeepEvaluationTask,
  deepEvaluationOutcomeSchema,
  parseDeepEvaluationOutcome,
} from "./lib/deep-evaluation.js";
import { taskEmissionKey } from "./lib/task-emission.js";

export const name = "evaluator-deep-eval";
export const description =
  "Run one bounded evaluator judgment and publish its validated evaluation fact.";

type DeepEvaluationInput = {
  sessionId?: string;
  subjectAppId?: string;
};

function result(summary: string, facts: string[]) {
  return { state: "converged" as const, summary, facts, actions: [] };
}

function isEvaluationApp(value: unknown): boolean {
  return (
    typeof value === "string" &&
    value
      .trim()
      .toLowerCase()
      .replace(/\.app$/, "") === "evaluation"
  );
}

export async function execute(
  ctx: WorkflowContext<DeepEvaluationInput>,
): Promise<ExecutionResult> {
  const requestedSessionId =
    typeof ctx.input?.sessionId === "string" ? ctx.input.sessionId.trim() : "";
  if (!isEvaluationApp(ctx.input?.subjectAppId)) {
    const summary = `insufficient-evidence: session-only deep review is retired for ${requestedSessionId || "<unresolved>"}; use a canonical external App Task outcome.`;
    return ctx.done(
      summary,
      result(summary, [
        ...(requestedSessionId
          ? [`insufficient-evidence-session:${requestedSessionId}`]
          : []),
        "legacy-deep-review:retired",
      ]),
    );
  }
  if (isEvaluationApp(ctx.input?.subjectAppId)) {
    const summary = `Excluded Evaluation-owned session ${requestedSessionId || "<unresolved>"} before model execution.`;
    return ctx.done(
      summary,
      result(summary, [
        "excluded-owner:evaluation",
        ...(requestedSessionId
          ? [`excluded-session:${requestedSessionId}`]
          : []),
      ]),
    );
  }
  await ctx.events.emit({
    type: "evaluation.deep_dispatched",
    localKey: taskEmissionKey(ctx, "deep-dispatched"),
    data: {
      source: name,
      ...(requestedSessionId ? { sessionId: requestedSessionId } : {}),
    },
    target: {
      appId: "alex",
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
      localKey: taskEmissionKey(ctx, "deep-failed-execution"),
      data: {
        source: name,
        failure: "execution-not-done",
        ...(requestedSessionId ? { sessionId: requestedSessionId } : {}),
      },
      target: {
        appId: "alex",
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
      localKey: taskEmissionKey(ctx, "deep-failed-invalid-output"),
      data: {
        source: name,
        failure: "invalid-output",
        ...(requestedSessionId ? { sessionId: requestedSessionId } : {}),
      },
      target: {
        appId: "alex",
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
    type: "evaluation.recorded",
    localKey: taskEmissionKey(ctx, "deep-recorded"),
    data: {
      source: name,
      evaluationMethod: "llm",
      evaluatedByHeuristic: false,
      evaluation,
    },
    target: {
      appId: "alex",
      project: "alex",
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
