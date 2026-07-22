import { Type } from "@earendil-works/pi-ai";
import { Check, Errors } from "typebox/value";
import type {
  ProjectAppConditionSpec,
  ProjectAppTaskAction,
  ProjectAppTaskHandlerResult,
  ProjectAppTaskMode,
  ProjectAppTaskVerificationResult,
} from "./project-app.js";

const nonEmptyStringSchema = Type.String({ minLength: 1 });
const stringArraySchema = Type.Array(nonEmptyStringSchema);
const taskModeSchema = Type.Union([Type.Literal("achieve"), Type.Literal("maintain")]);
const taskPrioritySchema = Type.Union([Type.Literal("P0"), Type.Literal("P1"), Type.Literal("P2"), Type.Literal("P3")]);
const nullableStringSchema = Type.Union([nonEmptyStringSchema, Type.Null()]);
const objectSchema = Type.Unsafe<Record<string, unknown>>({
  type: "object",
  additionalProperties: true,
});

export const projectAppTaskActionSchema = Type.Union([
  Type.Object(
    {
      kind: Type.Literal("create-task"),
      id: nonEmptyStringSchema,
      outcome: nonEmptyStringSchema,
      acceptance: Type.Array(nonEmptyStringSchema, { minItems: 1 }),
      parentId: Type.Optional(nonEmptyStringSchema),
      mode: Type.Optional(taskModeSchema),
      outputs: Type.Optional(stringArraySchema),
      priority: Type.Optional(taskPrioritySchema),
      owner: Type.Optional(nonEmptyStringSchema),
      workflow: Type.Optional(nonEmptyStringSchema),
      input: Type.Optional(objectSchema),
      dependsOn: Type.Optional(stringArraySchema),
      category: Type.Optional(nonEmptyStringSchema),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("update-task"),
      taskId: nonEmptyStringSchema,
      expectedGeneration: Type.Integer({ minimum: 1 }),
      parentId: Type.Optional(nonEmptyStringSchema),
      outcome: Type.Optional(nonEmptyStringSchema),
      mode: Type.Optional(taskModeSchema),
      outputs: Type.Optional(stringArraySchema),
      acceptance: Type.Optional(Type.Array(nonEmptyStringSchema, { minItems: 1 })),
      priority: Type.Optional(taskPrioritySchema),
      owner: Type.Optional(nullableStringSchema),
      workflow: Type.Optional(nullableStringSchema),
      input: Type.Optional(objectSchema),
      dependsOn: Type.Optional(stringArraySchema),
      category: Type.Optional(nullableStringSchema),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("close-task"),
      taskId: nonEmptyStringSchema,
      expectedGeneration: Type.Integer({ minimum: 1 }),
      summary: nonEmptyStringSchema,
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

export const projectAppConditionSchema = Type.Object(
  {
    id: nonEmptyStringSchema,
    type: nonEmptyStringSchema,
    subject: nonEmptyStringSchema,
    expected: Type.Unknown(),
    owner: Type.Optional(nonEmptyStringSchema),
  },
  { additionalProperties: false },
);

const resultFields = {
  summary: nonEmptyStringSchema,
  evidence: Type.Array(nonEmptyStringSchema, { maxItems: 32 }),
  actions: Type.Optional(Type.Array(projectAppTaskActionSchema, { maxItems: 16 })),
  conditions: Type.Optional(Type.Array(projectAppConditionSchema, { maxItems: 16 })),
};

/** Model-output schema for a resolved owner. */
export const projectAppTaskOwnerResultSchema = Type.Object(
  {
    state: Type.Union([Type.Literal("converged"), Type.Literal("waiting")]),
    ...resultFields,
  },
  { additionalProperties: false },
);

/** Model-output schema for a workflow, including its explicit owner handoff. */
export const projectAppTaskHandlerResultSchema = Type.Union([
  projectAppTaskOwnerResultSchema,
  Type.Object(
    {
      state: Type.Literal("needs-owner"),
      summary: nonEmptyStringSchema,
      evidence: Type.Array(nonEmptyStringSchema, { maxItems: 32 }),
    },
    { additionalProperties: false },
  ),
]);

export const projectAppTaskVerificationResultSchema = Type.Object(
  {
    accepted: Type.Boolean(),
    summary: nonEmptyStringSchema,
    evidence: Type.Array(nonEmptyStringSchema, { maxItems: 32 }),
  },
  { additionalProperties: false },
);

export type ProjectAppTaskHandlerAdmission =
  { ok: true; result: ProjectAppTaskHandlerResult } | { ok: false; error: string };

export type ProjectAppTaskHandlerAdmissionOptions = {
  allowNeedsOwner: boolean;
  defaultParentId: string;
  rootParentAliases?: string[];
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

function validMode(value: unknown): value is ProjectAppTaskMode {
  return value === "achieve" || value === "maintain";
}

function validPriority(value: unknown): value is "P0" | "P1" | "P2" | "P3" {
  return value === "P0" || value === "P1" || value === "P2" || value === "P3";
}

function optionalString(value: Record<string, unknown>, key: string): { ok: true; value?: string } | { ok: false } {
  if (!(key in value)) return { ok: true };
  const normalized = normalizedString(value[key]);
  return normalized ? { ok: true, value: normalized } : { ok: false };
}

function normalizeCreateTaskAction(
  value: Record<string, unknown>,
  options: ProjectAppTaskHandlerAdmissionOptions,
  index: number,
): ProjectAppTaskAction | string {
  const id = normalizedString(value.id);
  if (!id) return `actions[${index}].id must be a non-empty string`;
  const defaultParentId = normalizedString(options.defaultParentId);
  const rawParentId = normalizedString(value.parentId);
  const rootAliases = new Set(
    (options.rootParentAliases ?? [])
      .map((entry) => normalizedString(entry))
      .filter((entry): entry is string => Boolean(entry)),
  );
  const parentId = rawParentId && rootAliases.has(rawParentId) ? defaultParentId : (rawParentId ?? defaultParentId);
  if (!parentId) return `actions[${index}].parentId has no app-root default`;
  const outcome = normalizedString(value.outcome);
  if (!outcome) return `actions[${index}].outcome must be a non-empty string`;
  const acceptance = normalizedStringArray(value.acceptance, false);
  if (!acceptance) return `actions[${index}].acceptance must be a non-empty string array`;
  const mode = value.mode === undefined ? "achieve" : value.mode;
  if (!validMode(mode)) return `actions[${index}].mode must be achieve or maintain`;
  const outputs = value.outputs === undefined ? [] : normalizedStringArray(value.outputs, true);
  if (!outputs) return `actions[${index}].outputs must be a string array`;
  const priority = value.priority === undefined ? "P2" : value.priority;
  if (!validPriority(priority)) return `actions[${index}].priority must be P0, P1, P2, or P3`;
  const owner = optionalString(value, "owner");
  if (!owner.ok) return `actions[${index}].owner must be a non-empty string when present`;
  const workflow = optionalString(value, "workflow");
  if (!workflow.ok) return `actions[${index}].workflow must be a non-empty string when present`;
  if (workflow.value === "project") {
    return `actions[${index}].workflow must name a real workflow; omit workflow for owner-handled project work`;
  }
  if (value.input !== undefined && !isRecord(value.input)) {
    return `actions[${index}].input must be an object when present`;
  }
  const dependsOn = value.dependsOn === undefined ? undefined : normalizedStringArray(value.dependsOn, true);
  if (value.dependsOn !== undefined && !dependsOn) {
    return `actions[${index}].dependsOn must be a string array when present`;
  }
  const category = optionalString(value, "category");
  if (!category.ok) return `actions[${index}].category must be a non-empty string when present`;
  return {
    kind: "create-task",
    id,
    parentId,
    outcome,
    acceptance,
    mode,
    outputs,
    priority,
    ...(owner.value ? { owner: owner.value } : {}),
    ...(workflow.value ? { workflow: workflow.value } : {}),
    ...(value.input ? { input: structuredClone(value.input) as Record<string, unknown> } : {}),
    ...(dependsOn ? { dependsOn } : {}),
    ...(category.value ? { category: category.value } : {}),
  };
}

function nullableBinding(
  value: Record<string, unknown>,
  key: "owner" | "workflow" | "category",
): { ok: true; present: false } | { ok: true; present: true; value: string | null } | { ok: false } {
  if (!(key in value)) return { ok: true, present: false };
  if (value[key] === null) return { ok: true, present: true, value: null };
  const normalized = normalizedString(value[key]);
  return normalized ? { ok: true, present: true, value: normalized } : { ok: false };
}

function normalizeUpdateTaskAction(value: Record<string, unknown>, index: number): ProjectAppTaskAction | string {
  const taskId = normalizedString(value.taskId);
  if (!taskId) return `actions[${index}].taskId must be a non-empty string`;
  if (!validGeneration(value.expectedGeneration)) {
    return `actions[${index}].expectedGeneration must be a positive integer`;
  }
  const action: Extract<ProjectAppTaskAction, { kind: "update-task" }> = {
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
    if (!validMode(value.mode)) return `actions[${index}].mode must be achieve or maintain when present`;
    action.mode = value.mode;
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
  for (const key of ["owner", "workflow", "category"] as const) {
    const binding = nullableBinding(value, key);
    if (!binding.ok) return `actions[${index}].${key} must be a non-empty string or null when present`;
    if (!binding.present) continue;
    if (key === "workflow" && binding.value === "project") {
      return `actions[${index}].workflow must name a real workflow or null`;
    }
    action[key] = binding.value;
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

function normalizeAction(
  value: unknown,
  options: ProjectAppTaskHandlerAdmissionOptions,
  index: number,
): ProjectAppTaskAction | string {
  if (!isRecord(value)) return `actions[${index}] must be an object`;
  switch (value.kind) {
    case "create-task":
      return normalizeCreateTaskAction(value, options, index);
    case "update-task":
      return normalizeUpdateTaskAction(value, index);
    case "close-task": {
      const taskId = normalizedString(value.taskId);
      if (!taskId) return `actions[${index}].taskId must be a non-empty string`;
      if (!validGeneration(value.expectedGeneration)) {
        return `actions[${index}].expectedGeneration must be a positive integer`;
      }
      const summary = normalizedString(value.summary);
      if (!summary) return `actions[${index}].summary must be a non-empty string`;
      return { kind: "close-task", taskId, expectedGeneration: value.expectedGeneration, summary };
    }
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
      return `actions[${index}].kind must be one of create-task, update-task, close-task, unblock-task`;
  }
}

export function isTypedProjectAppConditionSubject(subject: string): boolean {
  const separator = subject.indexOf(":");
  if (separator <= 0 || separator === subject.length - 1) return false;
  return /^[A-Za-z][A-Za-z0-9_.-]*$/.test(subject.slice(0, separator));
}

function normalizeCondition(value: unknown, index: number): ProjectAppConditionSpec | string {
  if (!isRecord(value)) return `conditions[${index}] must be an object`;
  const id = normalizedString(value.id);
  if (!id) return `conditions[${index}].id must be a non-empty string`;
  const type = normalizedString(value.type);
  if (!type) return `conditions[${index}].type must be a non-empty string`;
  const subject = normalizedString(value.subject);
  if (!subject || !isTypedProjectAppConditionSubject(subject)) {
    return `conditions[${index}].subject must be a typed subject`;
  }
  if (!("expected" in value)) return `conditions[${index}].expected is required`;
  const owner = optionalString(value, "owner");
  if (!owner.ok) return `conditions[${index}].owner must be a non-empty string when present`;
  return {
    id,
    type,
    subject,
    expected: structuredClone(value.expected),
    ...(owner.value ? { owner: owner.value } : {}),
  };
}

/** The single production admission and normalization boundary for task handlers. */
export function admitProjectAppTaskHandlerResult(
  output: unknown,
  options: ProjectAppTaskHandlerAdmissionOptions,
): ProjectAppTaskHandlerAdmission {
  if (!isRecord(output)) return { ok: false, error: "expected an object" };
  if (!nonEmptyString(output.summary)) return { ok: false, error: "summary must be a non-empty string" };
  const evidence = normalizedStringArray(output.evidence, true);
  if (!evidence) return { ok: false, error: "evidence must be a string array" };
  if (evidence.length > 32) return { ok: false, error: "evidence exceeds the 32-entry limit" };

  if (output.state === "needs-owner") {
    if (!options.allowNeedsOwner) return { ok: false, error: "a resolved owner cannot return needs-owner" };
    if (output.actions !== undefined || output.conditions !== undefined) {
      return { ok: false, error: "needs-owner cannot include actions or Conditions" };
    }
    if (!Check(projectAppTaskHandlerResultSchema, output)) {
      const first = [...Errors(projectAppTaskHandlerResultSchema, output)][0];
      return {
        ok: false,
        error: `handler result schema rejected ${first?.instancePath || "result"}: ${first?.message ?? "invalid value"}`,
      };
    }
    return {
      ok: true,
      result: { state: "needs-owner", summary: output.summary.trim(), evidence },
    };
  }
  if (output.state !== "converged" && output.state !== "waiting") {
    return { ok: false, error: "state must be converged, waiting, or needs-owner" };
  }
  const admittedOutput = output as Record<string, unknown>;

  const rawActions = admittedOutput.actions ?? [];
  if (!Array.isArray(rawActions)) return { ok: false, error: "actions must be an array" };
  if (rawActions.length > 16) return { ok: false, error: "actions exceed the 16-entry limit" };
  const actions: ProjectAppTaskAction[] = [];
  for (let index = 0; index < rawActions.length; index += 1) {
    const normalized = normalizeAction(rawActions[index], options, index);
    if (typeof normalized === "string") return { ok: false, error: normalized };
    actions.push(normalized);
  }

  const rawConditions = admittedOutput.conditions ?? [];
  if (!Array.isArray(rawConditions)) return { ok: false, error: "conditions must be an array" };
  if (rawConditions.length > 16) return { ok: false, error: "conditions exceed the 16-entry limit" };
  const conditions: ProjectAppConditionSpec[] = [];
  for (let index = 0; index < rawConditions.length; index += 1) {
    const normalized = normalizeCondition(rawConditions[index], index);
    if (typeof normalized === "string") return { ok: false, error: normalized };
    conditions.push(normalized);
  }
  if (output.state !== "waiting" && conditions.length > 0) {
    return { ok: false, error: "Conditions are valid only for waiting" };
  }
  if (!Check(projectAppTaskHandlerResultSchema, output)) {
    const first = [...Errors(projectAppTaskHandlerResultSchema, output)][0];
    return {
      ok: false,
      error: `handler result schema rejected ${first?.instancePath || "result"}: ${first?.message ?? "invalid value"}`,
    };
  }

  return {
    ok: true,
    result: {
      state: output.state,
      summary: output.summary.trim(),
      evidence,
      actions,
      ...(conditions.length > 0 ? { conditions } : {}),
    },
  };
}

export function admitProjectAppTaskVerificationResult(
  output: unknown,
): { ok: true; result: ProjectAppTaskVerificationResult } | { ok: false; error: string } {
  if (!isRecord(output)) return { ok: false, error: "verifier must return an object" };
  if (typeof output.accepted !== "boolean") {
    return { ok: false, error: "verifier accepted must be boolean" };
  }
  const summary = normalizedString(output.summary);
  if (!summary) return { ok: false, error: "verifier summary must be a non-empty string" };
  const evidence = normalizedStringArray(output.evidence, true);
  if (!evidence) return { ok: false, error: "verifier evidence must be a string array" };
  if (evidence.length > 32) return { ok: false, error: "verifier evidence exceeds the 32-entry limit" };
  if (!Check(projectAppTaskVerificationResultSchema, output)) {
    const first = [...Errors(projectAppTaskVerificationResultSchema, output)][0];
    return {
      ok: false,
      error: `verifier result schema rejected ${first?.instancePath || "result"}: ${first?.message ?? "invalid value"}`,
    };
  }
  return { ok: true, result: { accepted: output.accepted, summary, evidence } };
}
