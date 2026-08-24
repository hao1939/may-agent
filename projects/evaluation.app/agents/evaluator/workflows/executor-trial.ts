import type { ExecutionResult, WorkflowContext } from "@may-agent/sdk";
import { Type } from "typebox";

export const name = "executor-trial";
export const description =
  "Run one bounded read-only assessment through the native evaluator workflow.";

const nonEmptyString = Type.String({ minLength: 1 });
export const executorTrialResultSchema = Type.Object(
  {
    assessment: nonEmptyString,
    evidence: Type.Array(nonEmptyString, { minItems: 1, maxItems: 24 }),
  },
  { additionalProperties: false },
);

type ExecutorTrialInput = {
  targetProject?: string;
  focus?: string;
  readOnly?: boolean;
};

type ExecutorTrialResult = {
  assessment: string;
  evidence: string[];
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function executorTrialPrompt(input: {
  targetProject: string;
  focus: string;
}): string {
  return `Independently assess ${input.targetProject}.

Focus: ${input.focus}

This is a bounded, read-only executor comparison. Inspect only current evidence. Do not edit files, mutate Tasks, send messages, or change an external system. Answer the focus directly and distinguish observations from inference.

Return through finish() with exactly:
{
  "assessment": "concise direct answer with exact citations for every material claim",
  "evidence": ["exact current file, command result, or durable observation"]
}`;
}

export function parseExecutorTrialResult(
  value: unknown,
): ExecutorTrialResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const assessment = text(raw.assessment);
  const evidence = Array.isArray(raw.evidence)
    ? raw.evidence.map(text).filter(Boolean).slice(0, 24)
    : [];
  return assessment && evidence.length > 0 ? { assessment, evidence } : null;
}

export async function execute(
  ctx: WorkflowContext<ExecutorTrialInput>,
): Promise<ExecutionResult> {
  const targetProject = text(ctx.input?.targetProject);
  const focus = text(ctx.input?.focus);
  if (!targetProject || !focus || ctx.input?.readOnly !== true) {
    return ctx.blocked(
      "Executor trial requires targetProject, focus, and the read-only fence.",
    );
  }

  const execution = await ctx.agents.call(
    "evaluator",
    executorTrialPrompt({ targetProject, focus }),
    { schema: executorTrialResultSchema },
  );
  if (execution.status !== "done") {
    return ctx.blocked(
      `Workflow trial execution ${execution.id} ended ${execution.status}: ${execution.summary}`,
      [`execution:${execution.id}`],
    );
  }

  const result = parseExecutorTrialResult(execution.output);
  if (!result) {
    return ctx.blocked("Workflow trial returned an invalid assessment.", [
      `execution:${execution.id}`,
    ]);
  }

  return ctx.done(result.assessment, {
    state: "converged",
    summary: result.assessment,
    response: result.assessment,
    evidence: [`execution:${execution.id}`, ...result.evidence],
    actions: [],
  });
}
