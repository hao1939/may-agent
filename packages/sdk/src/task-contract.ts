import { Type } from "typebox";
import { Check, Errors } from "typebox/value";
import type {
  Condition,
  TaskAction,
  TaskAppDependency,
  TaskExecutorName,
  TaskReconcileResult,
  TaskVerificationResult,
} from "./task.js";

export const MIN_CONDITION_REVIEW_AFTER_MS = 60_000;
export const MAX_TASK_RESULT_BYTES = 16 * 1024;

const nonEmptyStringSchema = Type.String({ minLength: 1 });
const stringArraySchema = Type.Array(nonEmptyStringSchema);
const taskPrioritySchema = Type.Union([Type.Literal("P0"), Type.Literal("P1"), Type.Literal("P2"), Type.Literal("P3")]);
const TASK_EXECUTOR_PATTERN = "^[a-z][a-z0-9-]{0,63}$";
const taskExecutorSchema = Type.String({ minLength: 1, maxLength: 64, pattern: TASK_EXECUTOR_PATTERN });
const nullableStringSchema = Type.Union([nonEmptyStringSchema, Type.Null()]);
const TYPED_CONDITION_SUBJECT_PATTERN = "^\\s*[A-Za-z][A-Za-z0-9_.-]*:[\\s\\S]*\\S\\s*$";
const typedConditionSubjectPattern = new RegExp(TYPED_CONDITION_SUBJECT_PATTERN);
const typedConditionSubjectSchema = Type.String({
  minLength: 3,
  pattern: TYPED_CONDITION_SUBJECT_PATTERN,
  description: "Typed resource identity in kind:value form, for example credential:xhs or pipeline-run:42",
});
const CONDITION_OWNER_PATTERN = "^\\s*(?:human|[a-z][a-z0-9-]*:[^\\s:]+)\\s*$";
const conditionOwnerPattern = new RegExp(CONDITION_OWNER_PATTERN);
const conditionOwnerSchema = Type.String({
  pattern: CONDITION_OWNER_PATTERN,
  description: "Who can supply the awaited fact: human or kind:identity, e.g. human:requester or app:measurement. Use a lowercase kind and an identity without spaces or colons, not a display name or sentence. This field does not send a message or grant authority.",
});
const objectSchema = Type.Unsafe<Record<string, unknown>>({
  type: "object",
  additionalProperties: true,
});

export const taskActionSchema = Type.Union([
  Type.Object(
    {
      kind: Type.Literal("update-task"),
      taskId: nonEmptyStringSchema,
      expectedGeneration: Type.Integer({ minimum: 1 }),
      parentId: Type.Optional(nonEmptyStringSchema),
      outcome: Type.Optional(nonEmptyStringSchema),
      outputs: Type.Optional(stringArraySchema),
      acceptance: Type.Optional(Type.Array(nonEmptyStringSchema, { minItems: 1 })),
      priority: Type.Optional(taskPrioritySchema),
      agent: Type.Optional(nullableStringSchema),
      workflow: Type.Optional(nullableStringSchema),
      executor: Type.Optional(Type.Union([taskExecutorSchema, Type.Null()])),
      input: Type.Optional(objectSchema),
      dependsOn: Type.Optional(stringArraySchema),
      category: Type.Optional(nullableStringSchema),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("unblock-task"),
      taskId: nonEmptyStringSchema,
      expectedGeneration: Type.Integer({ minimum: 1 }),
      reason: nonEmptyStringSchema,
    },
    { additionalProperties: false },
  ),
]);

export const conditionSchema = Type.Object(
  {
    id: nonEmptyStringSchema,
    type: nonEmptyStringSchema,
    subject: typedConditionSubjectSchema,
    expected: Type.Unknown(),
    requestedAction: Type.Optional(nonEmptyStringSchema),
    owner: conditionOwnerSchema,
    reviewAfterMs: Type.Integer({ minimum: MIN_CONDITION_REVIEW_AFTER_MS }),
  },
  { additionalProperties: false },
);

const resultFields = {
  summary: nonEmptyStringSchema,
  response: Type.Optional(nonEmptyStringSchema),
  result: Type.Optional(objectSchema),
  facts: Type.Array(nonEmptyStringSchema, { maxItems: 32 }),
  actions: Type.Optional(Type.Array(taskActionSchema, { maxItems: 16 })),
  conditions: Type.Optional(Type.Array(conditionSchema, { maxItems: 16 })),
  dependencies: Type.Optional(
    Type.Array(
      Type.Object(
        {
          id: nonEmptyStringSchema,
          appId: nonEmptyStringSchema,
          taskId: Type.Optional(nonEmptyStringSchema),
          input: Type.Object({ kind: nonEmptyStringSchema, data: Type.Unknown() }, { additionalProperties: false }),
        },
        { additionalProperties: false },
      ),
      { maxItems: 8 },
    ),
  ),
};

/** Model-output schema for a resolved agent. */
export const taskAgentResultSchema = Type.Union([
  Type.Object(
    { state: Type.Literal("converged"), ...resultFields },
    { additionalProperties: false },
  ),
  Type.Object(
    { state: Type.Literal("waiting"), ...resultFields },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      state: Type.Literal("waiting"), ...resultFields, report: Type.Literal(true),
      facts: Type.Array(nonEmptyStringSchema, { minItems: 1, maxItems: 32 }),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      state: Type.Literal("incomplete"),
      report: Type.Optional(Type.Literal(true)),
      summary: nonEmptyStringSchema,
      response: Type.Optional(nonEmptyStringSchema),
      result: Type.Optional(objectSchema),
      facts: Type.Array(nonEmptyStringSchema, { minItems: 1, maxItems: 32 }),
    },
    { additionalProperties: false },
  ),
]);

/** @deprecated Use `taskAgentResultSchema`. */
export const taskOwnerResultSchema = taskAgentResultSchema;

/** Model-output schema for a workflow, including its explicit agent handoff. */
export const taskReconcileResultSchema = Type.Union([
  taskAgentResultSchema,
  Type.Object(
    {
      state: Type.Literal("needs-agent"),
      summary: nonEmptyStringSchema,
      facts: Type.Array(nonEmptyStringSchema, { maxItems: 32 }),
    },
    { additionalProperties: false },
  ),
]);

export const taskVerificationResultSchema = Type.Object(
  {
    accepted: Type.Boolean(),
    summary: nonEmptyStringSchema,
    facts: Type.Array(nonEmptyStringSchema, { maxItems: 32 }),
  },
  { additionalProperties: false },
);

export type TaskReconcileAdmission = { ok: true; result: TaskReconcileResult } | { ok: false; error: string };

export type TaskReconcileAdmissionOptions = {
  allowNeedsAgent: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizedString(value: unknown): string | null {
  return nonEmptyString(value) ? value.trim() : null;
}

function normalizedStringArray(value: unknown, allowEmpty: boolean): string[] | null {
  if (!Array.isArray(value)) return null;
  if (!allowEmpty && value.length === 0) return null;
  if (!value.every(nonEmptyString)) return null;
  return value.map((entry) => entry.trim());
}

function validGeneration(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function validPriority(value: unknown): value is "P0" | "P1" | "P2" | "P3" {
  return value === "P0" || value === "P1" || value === "P2" || value === "P3";
}

function validExecutor(value: unknown): value is TaskExecutorName {
  return typeof value === "string" && new RegExp(TASK_EXECUTOR_PATTERN).test(value);
}

function optionalString(value: Record<string, unknown>, key: string): { ok: true; value?: string } | { ok: false } {
  if (!(key in value)) return { ok: true };
  const normalized = normalizedString(value[key]);
  return normalized ? { ok: true, value: normalized } : { ok: false };
}

function nullableBinding(
  value: Record<string, unknown>,
  key: "agent" | "owner" | "workflow" | "category",
): { ok: true; present: false } | { ok: true; present: true; value: string | null } | { ok: false } {
  if (!(key in value)) return { ok: true, present: false };
  if (value[key] === null) return { ok: true, present: true, value: null };
  const normalized = normalizedString(value[key]);
  return normalized ? { ok: true, present: true, value: normalized } : { ok: false };
}

function nullableAgentBinding(
  value: Record<string, unknown>,
): { ok: true; present: false } | { ok: true; present: true; value: string | null } | { ok: false; error: string } {
  const agent = nullableBinding(value, "agent");
  if (!agent.ok) return { ok: false, error: "agent must be a non-empty string or null when present" };
  const owner = nullableBinding(value, "owner");
  if (!owner.ok) return { ok: false, error: "legacy owner must be a non-empty string or null when present" };
  if (agent.present && owner.present && agent.value !== owner.value) {
    return { ok: false, error: "agent conflicts with legacy owner" };
  }
  if (agent.present) return agent;
  return owner;
}

function normalizeUpdateTaskAction(value: Record<string, unknown>, index: number): TaskAction | string {
  const taskId = normalizedString(value.taskId);
  if (!taskId) return `actions[${index}].taskId must be a non-empty string`;
  if (!validGeneration(value.expectedGeneration)) {
    return `actions[${index}].expectedGeneration must be a positive integer`;
  }
  const action: Extract<TaskAction, { kind: "update-task" }> = {
    kind: "update-task",
    taskId,
    expectedGeneration: value.expectedGeneration,
  };
  if ("parentId" in value) {
    const parentId = normalizedString(value.parentId);
    if (!parentId) return `actions[${index}].parentId must be a non-empty string when present`;
    action.parentId = parentId;
  }
  if ("outcome" in value) {
    const outcome = normalizedString(value.outcome);
    if (!outcome) return `actions[${index}].outcome must be a non-empty string when present`;
    action.outcome = outcome;
  }
  if ("mode" in value) {
    return `actions[${index}].mode is retired; all Tasks use one lifecycle`;
  }
  if ("outputs" in value) {
    const outputs = normalizedStringArray(value.outputs, true);
    if (!outputs) return `actions[${index}].outputs must be a string array when present`;
    action.outputs = outputs;
  }
  if ("acceptance" in value) {
    const acceptance = normalizedStringArray(value.acceptance, false);
    if (!acceptance) return `actions[${index}].acceptance must be a non-empty string array when present`;
    action.acceptance = acceptance;
  }
  if ("priority" in value) {
    if (!validPriority(value.priority)) return `actions[${index}].priority must be P0, P1, P2, or P3`;
    action.priority = value.priority;
  }
  const agent = nullableAgentBinding(value);
  if ("error" in agent) return `actions[${index}].${agent.error}`;
  if (agent.present) action.owner = agent.value;
  for (const key of ["workflow", "category"] as const) {
    const binding = nullableBinding(value, key);
    if (!binding.ok) return `actions[${index}].${key} must be a non-empty string or null when present`;
    if (!binding.present) continue;
    if (key === "workflow" && binding.value === "project") {
      return `actions[${index}].workflow must name a real workflow or null`;
    }
    action[key] = binding.value;
  }
  if ("executor" in value) {
    if (value.executor !== null && !validExecutor(value.executor)) {
      return `actions[${index}].executor must be a lowercase name of at most 64 characters or null when present`;
    }
    action.executor = value.executor as TaskExecutorName | null;
  }
  if (action.workflow && action.executor) {
    return `actions[${index}] cannot configure both workflow and executor`;
  }
  if ("input" in value) {
    if (!isRecord(value.input)) return `actions[${index}].input must be an object when present`;
    action.input = structuredClone(value.input);
  }
  if ("dependsOn" in value) {
    const dependsOn = normalizedStringArray(value.dependsOn, true);
    if (!dependsOn) return `actions[${index}].dependsOn must be a string array when present`;
    action.dependsOn = dependsOn;
  }
  if (Object.keys(action).length === 3) return `actions[${index}] contains no change`;
  return action;
}

function normalizeAction(value: unknown, index: number): TaskAction | string {
  if (!isRecord(value)) return `actions[${index}] must be an object`;
  switch (value.kind) {
    case "update-task":
      return normalizeUpdateTaskAction(value, index);
    case "unblock-task": {
      const taskId = normalizedString(value.taskId);
      if (!taskId) return `actions[${index}].taskId must be a non-empty string`;
      if (!validGeneration(value.expectedGeneration)) {
        return `actions[${index}].expectedGeneration must be a positive integer`;
      }
      const reason = normalizedString(value.reason);
      if (!reason) return `actions[${index}].reason must be a non-empty string`;
      return { kind: "unblock-task", taskId, expectedGeneration: value.expectedGeneration, reason };
    }
    default:
      return `actions[${index}].kind must be one of update-task, unblock-task; delegate new work through dependencies`;
  }
}

export function isTypedConditionSubject(subject: string): boolean {
  return typedConditionSubjectPattern.test(subject);
}

const INTERNAL_TASK_SCHEDULING_CONDITION_TYPES = new Set([
  "project.state",
  "project.task.tick",
  "task-field",
  "task-phase",
  "task.phase",
]);

function normalizeCondition(value: unknown, index: number): Condition | string {
  if (!isRecord(value)) return `conditions[${index}] must be an object`;
  const id = normalizedString(value.id);
  if (!id) return `conditions[${index}].id must be a non-empty string`;
  const type = normalizedString(value.type);
  if (!type) return `conditions[${index}].type must be a non-empty string`;
  if (INTERNAL_TASK_SCHEDULING_CONDITION_TYPES.has(type)) {
    return `conditions[${index}].type ${type} is internal task scheduling; use a direct child, dependsOn, or an external observable Condition`;
  }
  const subject = normalizedString(value.subject);
  if (!subject || !isTypedConditionSubject(subject)) {
    return `conditions[${index}].subject must be a typed subject`;
  }
  if (!("expected" in value)) return `conditions[${index}].expected is required`;
  const requestedAction = optionalString(value, "requestedAction");
  if (!requestedAction.ok) {
    return `conditions[${index}].requestedAction must be a non-empty string when present`;
  }
  const owner = normalizedString(value.owner);
  if (!owner) return `conditions[${index}].owner must be a canonical non-empty identity`;
  if (!conditionOwnerPattern.test(owner)) {
    return `conditions[${index}].owner must be a canonical kind:identity`;
  }
  const reviewAfterMs = value.reviewAfterMs;
  if (
    !Number.isInteger(reviewAfterMs) ||
    Number(reviewAfterMs) < MIN_CONDITION_REVIEW_AFTER_MS
  ) {
    return `conditions[${index}].reviewAfterMs must be an integer of at least ${MIN_CONDITION_REVIEW_AFTER_MS}`;
  }
  return {
    id,
    type,
    subject,
    expected: structuredClone(value.expected),
    ...(requestedAction.value ? { requestedAction: requestedAction.value } : {}),
    owner,
    reviewAfterMs: Number(reviewAfterMs),
  };
}

/** The single production admission and normalization boundary for task handlers. */
export function admitTaskReconcileResult(
  output: unknown,
  options: TaskReconcileAdmissionOptions,
): TaskReconcileAdmission {
  if (!isRecord(output)) return { ok: false, error: "expected an object" };
  if (!nonEmptyString(output.summary)) return { ok: false, error: "summary must be a non-empty string" };
  const facts = normalizedStringArray(output.facts, true);
  if (!facts) return { ok: false, error: "facts must be a string array" };
  if (facts.length > 32) return { ok: false, error: "facts exceeds the 32-entry limit" };

  if (output.state === "needs-agent" || output.state === "needs-owner") {
    if (!options.allowNeedsAgent) return { ok: false, error: "a resolved agent cannot return needs-agent" };
    if (
      output.response !== undefined ||
      output.result !== undefined ||
      output.actions !== undefined ||
      output.conditions !== undefined ||
      output.dependencies !== undefined
    ) {
      return { ok: false, error: "needs-agent cannot include response, result, actions, Conditions, or dependencies" };
    }
    const canonicalOutput = output.state === "needs-owner" ? { ...output, state: "needs-agent" } : output;
    if (!Check(taskReconcileResultSchema, canonicalOutput)) {
      const first = [...Errors(taskReconcileResultSchema, canonicalOutput)][0];
      return {
        ok: false,
        error: `handler result schema rejected ${first?.instancePath || "result"}: ${first?.message ?? "invalid value"}`,
      };
    }
    return {
      ok: true,
      result: { state: "needs-agent", summary: output.summary.trim(), facts },
    };
  }
  if (output.state !== "converged" && output.state !== "waiting" && output.state !== "incomplete") {
    return { ok: false, error: "state must be converged, waiting, incomplete, or needs-agent" };
  }
  if (output.report !== undefined &&
    ((output.state !== "waiting" && output.state !== "incomplete") || output.report !== true || facts.length === 0)) {
    return { ok: false, error: "report requires waiting or incomplete, true, and non-empty facts" };
  }
  if (output.state === "incomplete") {
    if (facts.length === 0) return { ok: false, error: "incomplete requires facts for the decision" };
    if (output.actions !== undefined || output.conditions !== undefined || output.dependencies !== undefined) {
      return { ok: false, error: "incomplete cannot include actions, Conditions, or dependencies" };
    }
  }
  const admittedOutput = output as Record<string, unknown>;
  const response = optionalString(admittedOutput, "response");
  if (!response.ok) return { ok: false, error: "response must be a non-empty string" };
  const rawResult = admittedOutput.result;
  if (rawResult !== undefined && !isRecord(rawResult)) {
    return { ok: false, error: "result must be an object" };
  }
  const result = rawResult as Record<string, unknown> | undefined;
  if (
    result !== undefined &&
    new TextEncoder().encode(JSON.stringify(result)).byteLength >
      MAX_TASK_RESULT_BYTES
  ) {
    return { ok: false, error: `result exceeds the ${MAX_TASK_RESULT_BYTES}-byte limit` };
  }
  if (output.state === "waiting" && response.value) {
    return { ok: false, error: "waiting cannot include response; put operational progress in summary" };
  }

  const rawActions = admittedOutput.actions ?? [];
  if (!Array.isArray(rawActions)) return { ok: false, error: "actions must be an array" };
  if (rawActions.length > 16) return { ok: false, error: "actions exceed the 16-entry limit" };
  const actions: TaskAction[] = [];
  for (let index = 0; index < rawActions.length; index += 1) {
    const normalized = normalizeAction(rawActions[index], index);
    if (typeof normalized === "string") return { ok: false, error: normalized };
    actions.push(normalized);
  }

  const rawConditions = admittedOutput.conditions ?? [];
  if (!Array.isArray(rawConditions)) return { ok: false, error: "conditions must be an array" };
  if (rawConditions.length > 16) return { ok: false, error: "conditions exceed the 16-entry limit" };
  const conditions: Condition[] = [];
  for (let index = 0; index < rawConditions.length; index += 1) {
    const normalized = normalizeCondition(rawConditions[index], index);
    if (typeof normalized === "string") return { ok: false, error: normalized };
    conditions.push(normalized);
  }
  if (output.state !== "waiting" && conditions.length > 0) {
    return { ok: false, error: "Conditions are valid only for waiting" };
  }
  const rawDependencies = admittedOutput.dependencies ?? [];
  if (!Array.isArray(rawDependencies)) return { ok: false, error: "dependencies must be an array" };
  if (rawDependencies.length > 8) return { ok: false, error: "dependencies exceed the 8-entry limit" };
  const dependencies: TaskAppDependency[] = [];
  const dependencyIds = new Set<string>();
  for (let index = 0; index < rawDependencies.length; index += 1) {
    const dependency = rawDependencies[index];
    if (!isRecord(dependency)) return { ok: false, error: `dependencies[${index}] must be an object` };
    const id = normalizedString(dependency.id);
    const appId = normalizedString(dependency.appId);
    const taskId = dependency.taskId === undefined ? undefined : normalizedString(dependency.taskId);
    if (!id) return { ok: false, error: `dependencies[${index}].id must be a non-empty string` };
    if (!appId) return { ok: false, error: `dependencies[${index}].appId must be a non-empty string` };
    if (dependency.taskId !== undefined && !taskId) {
      return { ok: false, error: `dependencies[${index}].taskId must be a non-empty string when present` };
    }
    if (dependencyIds.has(id)) return { ok: false, error: `dependencies contains duplicate id ${id}` };
    if (!isRecord(dependency.input) || !nonEmptyString(dependency.input.kind) || !("data" in dependency.input)) {
      return { ok: false, error: `dependencies[${index}].input must contain kind and data` };
    }
    dependencyIds.add(id);
    dependencies.push({
      id,
      appId,
      ...(taskId ? { taskId } : {}),
      input: { kind: dependency.input.kind.trim(), data: structuredClone(dependency.input.data) },
    });
  }
  if (output.state !== "waiting" && dependencies.length > 0) {
    return { ok: false, error: "dependencies are valid only for waiting" };
  }
  if (!Check(taskReconcileResultSchema, output)) {
    const first = [...Errors(taskReconcileResultSchema, output)][0];
    return {
      ok: false,
      error: `handler result schema rejected ${first?.instancePath || "result"}: ${first?.message ?? "invalid value"}`,
    };
  }

  const report = {
    summary: output.summary.trim(),
    ...(result ? { result: structuredClone(result) } : {}),
    facts,
  };
  if (output.state === "waiting") {
    const waiting = {
      ...report, state: "waiting" as const, actions,
      ...(conditions.length ? { conditions } : {}),
      ...(dependencies.length ? { dependencies } : {}),
    };
    return { ok: true, result: admittedOutput.report === true
      ? { ...waiting, report: true, facts: facts as [string, ...string[]] }
      : waiting };
  }
  const answer = { ...report, ...(response.value ? { response: response.value } : {}) };
  if (output.state === "incomplete") {
    // The incomplete branch above has already checked that facts are non-empty.
    return { ok: true, result: { ...answer, state: "incomplete", facts: facts as [string, ...string[]],
      ...(output.report === true ? { report: true } : {}),
    } };
  }
  return { ok: true, result: { ...answer, state: "converged", actions } };
}

export function admitTaskVerificationResult(
  output: unknown,
): { ok: true; result: TaskVerificationResult } | { ok: false; error: string } {
  if (!isRecord(output)) return { ok: false, error: "verifier must return an object" };
  if (typeof output.accepted !== "boolean") {
    return { ok: false, error: "verifier accepted must be boolean" };
  }
  const summary = normalizedString(output.summary);
  if (!summary) return { ok: false, error: "verifier summary must be a non-empty string" };
  const facts = normalizedStringArray(output.facts, true);
  if (!facts) return { ok: false, error: "verifier facts must be a string array" };
  if (facts.length > 32) return { ok: false, error: "verifier facts exceeds the 32-entry limit" };
  if (!Check(taskVerificationResultSchema, output)) {
    const first = [...Errors(taskVerificationResultSchema, output)][0];
    return {
      ok: false,
      error: `verifier result schema rejected ${first?.instancePath || "result"}: ${first?.message ?? "invalid value"}`,
    };
  }
  return { ok: true, result: { accepted: output.accepted, summary, facts } };
}
