import { createHash } from "node:crypto";
import { metricReviewTaskId } from "./agents/evaluator/workflows/lib/metric-selection.js";
import {
  Type,
  defineApp,
  type AppEvent,
  type AppInput,
  type AppTaskInput,
} from "@may-agent/sdk";

const details = Type.Record(Type.String(), Type.Unknown());
const role = Type.Union([
  Type.Literal("alex"),
  Type.Literal("may-bob"),
  Type.Literal("may-tech-lead"),
  Type.Literal("alex-evaluator"),
  Type.Literal("alex-evaluator-deepseek"),
  Type.Literal("alex-gym"),
]);
const comparisonData = Type.Object({
  requestId: Type.String({ minLength: 1 }),
  objective: Type.Optional(details),
  agent: Type.Union([Type.Literal("may"), Type.Literal("scout")]),
  baselineRunId: Type.String({ minLength: 1 }),
  baselinePath: Type.String({ minLength: 1 }),
  baselineFingerprint: Type.String({ minLength: 1 }),
  candidate: Type.String({ minLength: 1 }),
  candidatePath: Type.String({ minLength: 1 }),
  candidateFingerprint: Type.String({ minLength: 1 }),
  benchmark: Type.String({ minLength: 1 }),
  scorerRevision: Type.String({ minLength: 1 }),
  frameworkRevision: Type.String({ minLength: 1 }),
  model: Type.String({ minLength: 1 }),
  scenarios: Type.Array(Type.String({ minLength: 1 }), { minItems: 4 }),
  trials: Type.Integer({ minimum: 1, maximum: 5 }),
  timeoutMs: Type.Integer({ minimum: 60000 }),
  totalAllowanceMs: Type.Integer({ minimum: 60000, maximum: 3600000 }),
}, { additionalProperties: false });

export const inputSchema = Type.Union([
  Type.Object({
    kind: Type.Literal("goal"),
    data: Type.Object({
      outcome: Type.String({ minLength: 1 }),
      acceptance: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
      constraints: Type.Optional(Type.Array(Type.String())),
      context: Type.Optional(details),
      assignment: Type.Optional(Type.Object({ agent: role }, { additionalProperties: false })),
    }, { additionalProperties: false }),
  }, { additionalProperties: false }),
  Type.Object({
    kind: Type.Literal("message"),
    data: Type.Object({
      message: Type.String({ minLength: 1 }),
      context: Type.Optional(details),
    }, { additionalProperties: false }),
  }, { additionalProperties: false }),
  Type.Object({
    kind: Type.Literal("review-task-outcome"),
    data: Type.Object({
      appId: Type.String({ minLength: 1 }),
      taskId: Type.String({ minLength: 1 }),
      subjectGeneration: Type.Optional(Type.Integer({ minimum: 1 })),
      evidenceHash: Type.Optional(Type.String({ minLength: 64, maxLength: 64 })),
      populationEnd: Type.Optional(Type.Integer({ minimum: 1 })),
      assessmentPurpose: Type.Optional(Type.Union([Type.Literal("outcome"), Type.Literal("ongoing")])),
      reviewer: Type.Optional(Type.Union([Type.Literal("evaluator"), Type.Literal("evaluator-deepseek")])),
      automatic: Type.Optional(Type.Literal(true)),
    }, { additionalProperties: false }),
  }, { additionalProperties: false }),
  Type.Object({
    kind: Type.Literal("review-metric"),
    data: Type.Object({
      metricId: Type.String({ minLength: 1, maxLength: 512 }),
      end: Type.Integer({ minimum: 1 }),
      reviewer: Type.Optional(Type.Union([Type.Literal("evaluator"), Type.Literal("evaluator-deepseek")])),
      automatic: Type.Optional(Type.Boolean()),
      alertId: Type.Optional(Type.Integer({ minimum: 1 })),
    }, { additionalProperties: false }),
  }, { additionalProperties: false }),
  Type.Object({ kind: Type.Literal("compare-candidate"), data: comparisonData }, { additionalProperties: false }),
]);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function safe(value: string): string {
  const stem = value.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || "work";
  return `${stem}-${createHash("sha256").update(value).digest("hex").slice(0, 12)}`;
}

/** Route selected reviews and qualified Scout findings into executable Alex work. */
export function taskInputForEvent(event: AppEvent<Record<string, unknown>>): AppInput | null {
  const data = record(event.data);
  if (event.type === "scout.research.qualified") {
    return {
      kind: "message",
      data: {
        message: "Assess this qualified Scout finding for practical adoption. Verify the pinned artifact and current system evidence, then adopt, defer, or reject it with reasons.",
        context: { researchHandoff: structuredClone(data) },
      },
    } as AppInput;
  }
  if (event.type === "evaluation.review_failed") {
    return {
      kind: "message",
      data: {
        message: "Recover this failed automatic review within Alex. Preserve the affected subject and evidence gap, repair locally when possible, and escalate an unresolved operational blocker to May.",
        context: { reviewFailure: structuredClone(data) },
      },
    } as AppInput;
  }
  if (event.type === "evaluation.metric.review.requested") {
    const metricId = typeof data.metricId === "string" ? data.metricId.trim() : "";
    const end = Number(data.end);
    if (!metricId || !Number.isSafeInteger(end) || end <= 0) return null;
    return { kind: "review-metric", data: {
      metricId,
      end,
      reviewer: data.reviewer === "evaluator-deepseek" ? data.reviewer : "evaluator",
      automatic: true,
      ...(Number.isSafeInteger(Number(data.alertId)) && Number(data.alertId) > 0 ? { alertId: Number(data.alertId) } : {}),
    }} as AppInput;
  }
  if (event.type !== "evaluation.task.review.requested") return null;
  const appId = typeof data.appId === "string" ? data.appId.trim() : "";
  const taskId = typeof data.taskId === "string" ? data.taskId.trim() : "";
  const reviewer = data.reviewer === "evaluator-deepseek" ? data.reviewer : "evaluator";
  if (!appId || !taskId) return null;
  const subjectGeneration = Number(data.subjectGeneration);
  const populationEnd = Number(data.populationEnd);
  const evidenceHash = typeof data.evidenceHash === "string" ? data.evidenceHash.trim() : "";
  const assessmentPurpose = data.assessmentPurpose === "ongoing" ? "ongoing" : "outcome";
  return { kind: "review-task-outcome", data: {
    appId,
    taskId,
    ...(Number.isSafeInteger(subjectGeneration) && subjectGeneration > 0 ? { subjectGeneration } : {}),
    ...(evidenceHash ? { evidenceHash } : {}),
    ...(Number.isSafeInteger(populationEnd) && populationEnd > 0 ? { populationEnd } : {}),
    assessmentPurpose,
    reviewer,
    automatic: true,
  }} as AppInput;
}

export function taskForInput(admitted: Readonly<AppTaskInput>) {
  const data = record(admitted.input.data);
  if (admitted.input.kind === "review-metric") {
    const metricId = String(data.metricId);
    const reviewer = data.reviewer === "evaluator-deepseek" ? "evaluator-deepseek" : "evaluator";
    return { kind: "desired" as const, intent: {
      id: metricReviewTaskId(metricId, reviewer),
      parentId: "root",
      agent: reviewer === "evaluator-deepseek" ? "alex-evaluator-deepseek" : "alex-evaluator",
      workflow: "metric-review",
      outcome: `Review observations of metric ${metricId} and return an evidence-backed recommendation.`,
      acceptance: [
        "Preserve the exact metric evidence and review cutoff.",
        "Publish a bounded assessment to the accountable owner without changing original work or retry policy.",
      ],
      input: {
        metricId,
        end: Number(data.end),
        reviewer,
        automatic: data.automatic === true,
        ...(data.alertId !== undefined ? { alertId: Number(data.alertId) } : {}),
      },
      priority: data.alertId !== undefined ? "P1" as const : "P2" as const,
    }};
  }
  if (admitted.input.kind === "review-task-outcome") {
    const appId = String(data.appId);
    const taskId = String(data.taskId);
    const reviewer = data.reviewer === "evaluator-deepseek" ? "evaluator-deepseek" : "evaluator";
    return { kind: "desired" as const, intent: {
      id: `review/${safe(`${appId}/${taskId}/${data.subjectGeneration ?? "current"}/${data.evidenceHash ?? "current"}/${reviewer}`)}`,
      parentId: "root",
      agent: reviewer === "evaluator-deepseek" ? "alex-evaluator-deepseek" : "alex-evaluator",
      workflow: "task-outcome-review",
      outcome: `Independently review ${appId}/${taskId} from canonical Task evidence.`,
      acceptance: [
        "Read the canonical Task and exact current evidence before judgment.",
        "Return an immutable evidence-backed assessment with authorship and limits disclosed.",
      ],
      input: {
        appId,
        taskId,
        ...(data.subjectGeneration ? { subjectGeneration: data.subjectGeneration } : {}),
        ...(data.evidenceHash ? { evidenceHash: data.evidenceHash } : {}),
        ...(data.populationEnd ? { populationEnd: data.populationEnd } : {}),
        assessmentPurpose: data.assessmentPurpose ?? "outcome",
        reviewer,
        ...(data.automatic === true ? { automatic: true } : {}),
      },
      priority: "P1" as const,
    }};
  }
  if (admitted.input.kind === "compare-candidate") {
    return { kind: "desired" as const, intent: {
      id: `comparison/${safe(String(data.requestId))}`,
      parentId: "root",
      agent: "alex-gym",
      workflow: "compare-candidate",
      outcome: `Run the frozen comparison ${String(data.requestId)} and return bounded evidence.`,
      acceptance: ["Verify all frozen identities before execution.", "Retain a complete comparison receipt and disclose invalid or inconclusive trials."],
      input: data,
      outputs: [".state/comparison-runs"],
      priority: "P1" as const,
    }};
  }
  const assignment = record(data.assignment);
  const selected = typeof assignment.agent === "string" ? assignment.agent : "alex";
  return { kind: "desired" as const, intent: {
    id: `input/${admitted.id}`,
    parentId: "root",
    agent: selected,
    outcome: String(data.outcome ?? data.message),
    acceptance: Array.isArray(data.acceptance) ? data.acceptance as string[] : ["Answer the addressed request with evidence and preserve any remaining obligation."],
    ...(Array.isArray(data.constraints) ? { constraints: data.constraints as string[] } : {}),
    input: admitted.input,
    priority: "P1" as const,
  }};
}

export function taskIntentForInput(input: AppInput) {
  return taskForInput({ id: "preview", input } as AppTaskInput).intent;
}

export const taskForEvaluationInput = taskForInput;

export default defineApp({
  id: "alex",
  version: 1,
  agent: "alex",
  description: "Own system improvement from diagnosis through verified outcome, with design, implementation, independent review and comparison specialists; escalate unresolved blockers to May.",
  workspace: { kind: "git", localPath: ".", branch: "main" },
  inputSchema,
  task: taskForInput,
  subscriptions: [
    {
      id: "selected-task-review",
      event: "evaluation.task.review.requested",
      toInput: taskInputForEvent,
    },
    {
      id: "qualified-scout-research",
      event: "scout.research.qualified",
      toInput: taskInputForEvent,
    },
  ],
  tasks: { maxConcurrent: 3 },
});
