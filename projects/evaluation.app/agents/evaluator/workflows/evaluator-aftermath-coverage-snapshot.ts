import type {
  ExecutionResult,
  TaskReconcileResult,
  WorkflowContext,
} from "@may-agent/sdk";
import { Type } from "@may-agent/sdk";

export const name = "evaluator-aftermath-coverage-snapshot";
export const description =
  "Compute and persist one bounded trailing-3h evaluator aftermath coverage sample.";
export const METRIC_ID = "evaluator.aftermath-coverage-rate-3h";
export const WINDOW_MS = 3 * 60 * 60 * 1_000;

export type CoverageSnapshotInput = { reason?: string };
export type CoverageCounts = {
  eligible: number;
  evaluated: number;
  windowStart: number;
  windowEnd: number;
};

export const coverageCountsSchema = Type.Object(
  {
    eligible: Type.Integer({ minimum: 0 }),
    evaluated: Type.Integer({ minimum: 0 }),
    windowStart: Type.Integer({ minimum: 0 }),
    windowEnd: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function integer(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

export function parseCoverageCounts(value: unknown): CoverageCounts | null {
  const root = record(value);
  const result = record(root.result);
  const raw = Object.keys(result).length ? result : root;
  const eligible = integer(raw.eligible);
  const evaluated = integer(raw.evaluated);
  const windowStart = integer(raw.windowStart);
  const windowEnd = integer(raw.windowEnd);
  if (
    eligible === null ||
    evaluated === null ||
    evaluated > eligible ||
    windowStart === null ||
    windowEnd === null ||
    windowEnd <= windowStart
  ) {
    return null;
  }
  return { eligible, evaluated, windowStart, windowEnd };
}

export function buildCoverageTask(): string {
  return `Compute one read-only aftermath coverage snapshot from the runtime database.
Use query_db only; do not edit files, write the database, send messages, or change tasks.
Set windowEnd to the current runtime time (use MAX(lastActivityAt) from sessions if it is newer than wall-clock evidence) and windowStart=windowEnd-${WINDOW_MS}.
Eligible sessions are rows in sessions with endedAt in [windowStart, windowEnd], terminal status in ('done','failed','interrupted','error'), agent not in ('evaluator','judge'), and NOT (status='done' AND agent!='may' AND workflowRunId IS NOT NULL). The final exclusion must exactly match app.ts routineWorkflowSession admission policy: successful routine workflow sessions are intentionally not admitted for aftermath evaluation.
Evaluated is the number of those distinct eligible sessionId values present in evaluations.
Return finish().result as exactly {"eligible":<integer>,"evaluated":<integer>,"windowStart":<epoch-ms>,"windowEnd":<epoch-ms>} and cite the aggregate query in finish evidence.`;
}

function reconciled(summary: string, evidence: string[]): TaskReconcileResult {
  return { state: "converged", summary, evidence, actions: [] };
}

export async function execute(
  ctx: WorkflowContext<CoverageSnapshotInput>,
): Promise<ExecutionResult> {
  if (!ctx.reconciliation) {
    return ctx.blocked(
      "evaluator-aftermath-coverage-snapshot requires canonical reconciliation context",
    );
  }
  const execution = await ctx.agents.call("evaluator", buildCoverageTask(), {
    schema: coverageCountsSchema,
  });
  if (execution.status !== "done") {
    return ctx.blocked(
      `Coverage counter ${execution.id} ended ${execution.status}: ${execution.summary}`,
      [`execution:${execution.id}`],
    );
  }
  const counts = parseCoverageCounts(execution.output);
  if (!counts) {
    return ctx.blocked(
      `Coverage counter ${execution.id} returned invalid counts.`,
      [`execution:${execution.id}`],
    );
  }
  const value = counts.eligible === 0 ? 1 : counts.evaluated / counts.eligible;
  // The counter's windowEnd is the authoritative instant represented by this
  // trailing-window sample. Recording a later wall-clock time would place the
  // metric outside the declared measurement window.
  const measuredAt = counts.windowEnd;
  const note = JSON.stringify({
    source: "sessions+evaluations",
    eligible: counts.eligible,
    evaluated: counts.evaluated,
    windowStart: counts.windowStart,
    windowEnd: counts.windowEnd,
    counterExecutionId: execution.id,
    reason: ctx.input?.reason ?? "requested",
  });
  await ctx.metrics.record(METRIC_ID, value, {
    sampleSize: counts.eligible,
    measuredAt,
    measuredBy: `workflow:${name}`,
    note,
  });
  const thresholdDisposition =
    value >= 0.2
      ? "threshold-satisfied"
      : `terminal-coverage-blocker:${counts.evaluated}/${counts.eligible}<0.2`;
  const summary = `Persisted ${METRIC_ID}=${value} from ${counts.evaluated}/${counts.eligible} eligible trailing-3h sessions (${thresholdDisposition}).`;
  return ctx.done(
    summary,
    reconciled(summary, [
      `execution:${execution.id}`,
      `metric:${METRIC_ID}`,
      `measured-at:${measuredAt}`,
      `eligible:${counts.eligible}`,
      `evaluated:${counts.evaluated}`,
      thresholdDisposition,
    ]),
  );
}
