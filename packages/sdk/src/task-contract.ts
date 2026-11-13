import { Type, type TSchema } from "typebox";
import { Check, Errors } from "typebox/value";
import { conversationRequestUpdatesSchema } from "./conversation-contract.js";
import { appInputSchema } from "./app-input.js";
import type {
  Condition,
  TaskCondition,
  TaskAction,
  TaskAppRequest,
  TaskReconcileResult,
  TaskChanges,
  TaskVerificationResult,
} from "./task.js";

export const MAX_TASK_RESULT_BYTES = 16 * 1024;

const nonEmptyStringSchema = Type.String({ minLength: 1 });
const TYPED_CONDITION_SUBJECT_PATTERN = "^\\s*[A-Za-z][A-Za-z0-9_.-]*:[\\s\\S]*\\S\\s*$";
const typedConditionSubjectPattern = new RegExp(TYPED_CONDITION_SUBJECT_PATTERN);
const typedConditionSubjectSchema = Type.String({
  minLength: 3,
  pattern: TYPED_CONDITION_SUBJECT_PATTERN,
  description: "Typed resource identity in kind:value form (e.g. credential:xhs or pipeline-run:42).",
});
const CONDITION_OWNER_PATTERN = "^\\s*(?:human|[a-z][a-z0-9-]*:[^\\s:]+)\\s*$";
const conditionOwnerPattern = new RegExp(CONDITION_OWNER_PATTERN);
const conditionOwnerSchema = Type.String({
  pattern: CONDITION_OWNER_PATTERN,
  description: "Awaited fact supplier: human or lowercase kind:identity (e.g. human:requester, app:measurement).",
});
const objectSchema = Type.Unsafe<Record<string, unknown>>({
  type: "object",
  additionalProperties: true,
});

export const taskActionSchema = Type.Union([
  Type.Object(
    {
      kind: Type.Literal("unblock-task"),
      taskId: nonEmptyStringSchema,
      expectedGeneration: Type.Integer({ minimum: 1 }),
      reason: nonEmptyStringSchema,
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      kind: Type.Literal("retire-condition"),
      conditionId: nonEmptyStringSchema,
      expectedConditionGeneration: Type.Integer({ minimum: 1, description: "Observed OpenWait.conditionGeneration." }),
      reason: nonEmptyStringSchema,
    },
    {
      additionalProperties: false,
      description: "Withdraw this Task's wait link.",
    },
  ),
]);

const progressInterestSchema = Type.Union([Type.Literal("immediate"), Type.Literal("next-wake")], {
  description: "Intermediate progress delivery timing (default next-wake; completion/failure always wake promptly).",
});

export const conditionSchema = Type.Object(
  {
    id: nonEmptyStringSchema,
    type: Type.String({
      minLength: 1,
      pattern: "\\.",
      description: "Namespaced event type from a known producer (e.g. review.completed).",
    }),
    subject: typedConditionSubjectSchema,
    expected: Type.Unknown(),
    progress: Type.Optional(progressInterestSchema),
    requestedAction: Type.Optional(
      Type.String({ minLength: 1, description: "Action needed; contact the owner separately to deliver the ask." }),
    ),
    owner: conditionOwnerSchema,
  },
  {
    additionalProperties: false,
    description: "External observable fact wait.",
  },
);

const communicationSchema = Type.Array(
  Type.Object(
    {
      id: Type.String({ minLength: 1, maxLength: 160, pattern: "\\S" }),
      inputId: Type.String({
        minLength: 1,
        pattern: "\\S",
        description:
          "This Task's accepted input ID; select an events.inputs entry with communication context.",
      }),
      message: Type.Optional(Type.String({ minLength: 1, maxLength: 8000, pattern: "\\S" })),
      replyId: Type.Optional(Type.String({ minLength: 1, maxLength: 160, pattern: "\\S" })),
      requestUpdates: Type.Optional(conversationRequestUpdatesSchema),
      topic: Type.Optional(
        Type.Union([
          Type.Object({ kind: Type.Literal("none") }, { additionalProperties: false }),
          Type.Object(
            { kind: Type.Literal("new"), title: Type.String({ minLength: 1 }) },
            { additionalProperties: false },
          ),
          Type.Object(
            { kind: Type.Literal("existing"), id: Type.String({ minLength: 1 }) },
            { additionalProperties: false },
          ),
        ]),
      ),
    },
    { additionalProperties: false },
  ),
  {
    maxItems: 8,
    description:
      "Publish messages or update Requests only through an accepted input's saved reply context. Use the final result's response for ordinary App answers. Reuse id and content on retry; omit response when publishing messages.",
  },
);

const resultFields = {
  communication: Type.Optional(communicationSchema),
  summary: nonEmptyStringSchema,
  inputKeys: Type.Optional(
    Type.Array(Type.String({ minLength: 1, pattern: "\\S" }), {
      maxItems: 64,
      uniqueItems: true,
      description:
        "Exact outstanding input keys covered by this result (omit for saved assignment; [] covers none; converged settles only this set).",
    }),
  ),
  result: Type.Optional(objectSchema),
  reviewAt: Type.Optional(Type.Integer({ minimum: 1 })),

  facts: Type.Array(nonEmptyStringSchema, { maxItems: 32 }),
  actions: Type.Optional(Type.Array(taskActionSchema, { maxItems: 16 })),
  conditions: Type.Optional(
    Type.Array(
      Type.Union([
        conditionSchema,
        Type.Object(
          { requestId: nonEmptyStringSchema, progress: Type.Optional(progressInterestSchema) },
          {
            additionalProperties: false,
            description: "Wait for a request id submitted here or already admitted in this caller generation.",
          },
        ),
      ]),
      // Preserve the former allowance of 16 external Conditions plus 8 requests.
      { maxItems: 24 },
    ),
  ),
  requests: Type.Optional(
    Type.Array(
      Type.Object(
        {
          id: nonEmptyStringSchema,
          appId: nonEmptyStringSchema,
          taskId: Type.Optional(nonEmptyStringSchema),
          input: appInputSchema,
        },
        { additionalProperties: false },
      ),
      { maxItems: 8 },
    ),
  ),
};

const TASK_AGENT_RESULT_SCHEMA_ID = "may.task-agent-result.v1";
const TASK_RECONCILE_RESULT_SCHEMA_ID = "may.task-reconcile-result.v1";

/**
 * Single-object Task attempt schema. Defining shared fields once with compact
 * per-state `anyOf` constraints preserves exact validation while avoiding 3x
 * inline schema duplication across every model call.
 */
export const taskAgentResultSchema = Type.Object(
  {
    state: Type.Union([Type.Literal("converged"), Type.Literal("waiting"), Type.Literal("incomplete")]),
    ...resultFields,
    response: Type.Optional(
      Type.String({
        minLength: 1,
        description:
          "Final answer for the addressed input, including ordinary App results. On convergence, Host routes it through one unambiguous saved reply context if present. Omit when publishing explicit communication messages.",
      }),
    ),
    continue: Type.Optional(
      Type.Literal(true, {
        description: "With state=waiting and non-empty facts: queue one more bounded pass for independent work.",
      }),
    ),
    report: Type.Optional(
      Type.Literal(true, {
        description: "With state=waiting or incomplete and non-empty facts: emit a caller progress or failure update.",
      }),
    ),
  },
  {
    $id: TASK_AGENT_RESULT_SCHEMA_ID,
    additionalProperties: false,
    description:
      "Report one Task attempt: converged (answer/completed scope; omit reviewAt/Conditions), waiting (keep input open on saved waits, Conditions, requests, reviewAt, or continue:true; no response), or incomplete (unsuccessful attempt with non-empty facts; no waits/requests/actions). Omitting unchanged Conditions preserves existing waits; use retire-condition to withdraw one. Delegate work via requests (stable id) and add conditions:[{requestId}] with waiting to await its result.",
    anyOf: [
      {
        properties: { state: { const: "converged" } },
        not: { anyOf: [{ required: ["continue"] }, { required: ["report"] }] },
      },
      {
        properties: { state: { const: "waiting" } },
        not: { anyOf: [{ required: ["response"] }, { required: ["report"] }] },
      },
      {
        required: ["report"],
        properties: { state: { const: "waiting" }, facts: { minItems: 1 } },
        not: { required: ["response"] },
      },
      {
        properties: { state: { const: "incomplete" }, facts: { minItems: 1 } },
        not: {
          anyOf: [
            { required: ["communication"] },
            { required: ["reviewAt"] },
            { required: ["actions"] },
            { required: ["conditions"] },
            { required: ["requests"] },
            { required: ["continue"] },
          ],
        },
      },
    ],
  },
);

/** Workflows and agents share one Task result contract. Keep the schema ID for saved sessions. */
export const taskReconcileResultSchema = { ...taskAgentResultSchema, $id: TASK_RECONCILE_RESULT_SCHEMA_ID };

const changeFields = {
  communication: resultFields.communication,
  requests: resultFields.requests,
  conditions: resultFields.conditions,
  actions: resultFields.actions,
};

/** Same typed changes for a live action and final-result declarations. */
export const taskChangesSchema = Type.Object(
  {
    ...changeFields,
    inputKeys: resultFields.inputKeys,
    facts: Type.Optional(resultFields.facts),
  },
  { additionalProperties: false },
);

export const taskVerificationResultSchema = Type.Object(
  {
    accepted: Type.Boolean(),
    summary: nonEmptyStringSchema,
    facts: Type.Array(nonEmptyStringSchema, { maxItems: 32 }),
  },
  { additionalProperties: false },
);

export type TaskReconcileAdmission = { ok: true; result: TaskReconcileResult } | { ok: false; error: string };

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

function optionalString(value: Record<string, unknown>, key: string): { ok: true; value?: string } | { ok: false } {
  if (!(key in value)) return { ok: true };
  const normalized = normalizedString(value[key]);
  return normalized ? { ok: true, value: normalized } : { ok: false };
}

function normalizeAction(value: unknown, index: number): TaskAction | string {
  if (!isRecord(value)) return `actions[${index}] must be an object`;
  switch (value.kind) {
    case "update-task":
      return `actions[${index}].update-task is retired; use tasks update or TaskAttempt.reviseTask before returning a result`;
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
    case "retire-condition": {
      const conditionId = normalizedString(value.conditionId);
      if (!conditionId) return `actions[${index}].conditionId must be a non-empty string`;
      if (!validGeneration(value.expectedConditionGeneration)) {
        return `actions[${index}].expectedConditionGeneration must be a positive integer`;
      }
      const reason = normalizedString(value.reason);
      if (!reason) return `actions[${index}].reason must be a non-empty string`;
      return {
        kind: "retire-condition",
        conditionId,
        expectedConditionGeneration: value.expectedConditionGeneration,
        reason,
      };
    }
    default:
      return `actions[${index}].kind must be unblock-task or retire-condition; revise requirements through tasks update and delegate new work through requests`;
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
  if (!type.includes(".")) return `conditions[${index}].type must be a namespaced event type`;
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
  if (value.progress !== undefined &&
      (type !== "app.dependency.updated" || !id.startsWith("app-request:") ||
       (value.progress !== "immediate" && value.progress !== "next-wake"))) {
    return `conditions[${index}].progress requires an App request Condition and immediate or next-wake`;
  }
  if ("reviewAfterMs" in value) return `conditions[${index}].reviewAfterMs is retired; use Task reviewAt`;
  return {
    id,
    type,
    subject,
    expected: structuredClone(value.expected),
    ...(requestedAction.value ? { requestedAction: requestedAction.value } : {}),
    owner,
    ...(value.progress === undefined ? {} : { progress: value.progress as "immediate" | "next-wake" }),
  };
}

/** The single production admission and normalization boundary for task handlers. */
export function admitTaskReconcileResult(output: unknown): TaskReconcileAdmission {
  if (!isRecord(output)) return { ok: false, error: "expected an object" };
  if ("dependencies" in output) return { ok: false, error: "dependencies is retired; use requests and request Conditions" };
  if (!nonEmptyString(output.summary)) return { ok: false, error: "summary must be a non-empty string" };
  const facts = normalizedStringArray(output.facts, true);
  if (!facts) return { ok: false, error: "facts must be a string array" };
  if (facts.length > 32) return { ok: false, error: "facts exceeds the 32-entry limit" };

  if (output.state !== "converged" && output.state !== "waiting" && output.state !== "incomplete") {
    return { ok: false, error: "state must be converged, waiting, or incomplete" };
  }
  if (
    output.report !== undefined &&
    ((output.state !== "waiting" && output.state !== "incomplete") || output.report !== true || facts.length === 0)
  ) {
    return { ok: false, error: "report requires waiting or incomplete, true, and non-empty facts" };
  }
  if (output.state === "incomplete") {
    if (facts.length === 0) return { ok: false, error: "incomplete requires facts for the decision" };
    if (output.actions !== undefined || output.conditions !== undefined || output.requests !== undefined) {
      return { ok: false, error: "incomplete cannot include actions, Conditions, or requests" };
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
  if (result !== undefined && new TextEncoder().encode(JSON.stringify(result)).byteLength > MAX_TASK_RESULT_BYTES) {
    return { ok: false, error: `result exceeds the ${MAX_TASK_RESULT_BYTES}-byte limit` };
  }
  if (output.state === "waiting" && response.value) {
    return { ok: false, error: "waiting cannot include response; put operational progress in summary" };
  }
  const reviewAt = admittedOutput.reviewAt;
  if (reviewAt !== undefined && (!Number.isSafeInteger(reviewAt) || Number(reviewAt) <= 0)) {
    return { ok: false, error: "reviewAt must be a positive integer Unix timestamp in milliseconds" };
  }
  if (output.state !== "waiting" && reviewAt !== undefined) {
    return { ok: false, error: "reviewAt is valid only for waiting" };
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
  if (rawConditions.length > 24) return { ok: false, error: "conditions exceed the 24-entry limit" };
  const conditions: TaskCondition[] = [];
  for (let index = 0; index < rawConditions.length; index += 1) {
    const declaration = rawConditions[index];
    if (isRecord(declaration) && "requestId" in declaration) {
      const requestId = normalizedString(declaration.requestId);
      if (!requestId) return { ok: false, error: `conditions[${index}].requestId must be a non-empty string` };
      if (declaration.progress !== undefined && declaration.progress !== "immediate" && declaration.progress !== "next-wake")
        return { ok: false, error: `conditions[${index}].progress must be immediate or next-wake` };
      conditions.push({ requestId, ...(declaration.progress === undefined ? {} : { progress: declaration.progress }) });
      continue;
    }
    const normalized = normalizeCondition(declaration, index);
    if (typeof normalized === "string") return { ok: false, error: normalized };
    conditions.push(normalized);
  }
  if (output.state !== "waiting" && conditions.length > 0) {
    return { ok: false, error: "Conditions are valid only for waiting" };
  }
  const rawRequests = admittedOutput.requests ?? [];
  if (!Array.isArray(rawRequests)) return { ok: false, error: "requests must be an array" };
  if (rawRequests.length > 8) return { ok: false, error: "requests exceed the 8-entry limit" };
  const requests: TaskAppRequest[] = [];
  const requestIds = new Set<string>();
  for (let index = 0; index < rawRequests.length; index += 1) {
    const request = rawRequests[index];
    if (!isRecord(request)) return { ok: false, error: `requests[${index}] must be an object` };
    const id = normalizedString(request.id);
    const appId = normalizedString(request.appId);
    const taskId = request.taskId === undefined ? undefined : normalizedString(request.taskId);
    if (!id) return { ok: false, error: `requests[${index}].id must be a non-empty string` };
    if (!appId) return { ok: false, error: `requests[${index}].appId must be a non-empty string` };
    if (request.taskId !== undefined && !taskId) {
      return { ok: false, error: `requests[${index}].taskId must be a non-empty string when present` };
    }
    if (requestIds.has(id)) return { ok: false, error: `requests contains duplicate id ${id}` };
    if (!isRecord(request.input) || !nonEmptyString(request.input.kind) || !("data" in request.input)) {
      return { ok: false, error: `requests[${index}].input must contain kind and data` };
    }
    requestIds.add(id);
    requests.push({
      id,
      appId,
      ...(taskId ? { taskId } : {}),
      input: { kind: request.input.kind.trim(), data: structuredClone(request.input.data) },
    });
  }
  if (output.continue !== undefined && (output.continue !== true || output.state !== "waiting" || !facts.length)) {
    return { ok: false, error: "continue requires waiting and progress facts" };
  }
  if (!Check(taskReconcileResultSchema, output)) {
    const first = [...Errors(taskReconcileResultSchema, output)][0];
    return {
      ok: false,
      error: `handler result schema rejected ${first?.instancePath || "result"}: ${first?.message ?? "invalid value"}`,
    };
  }

  const communication =
    "communication" in output && output.communication ? { communication: structuredClone(output.communication) } : {};
  const report = {
    summary: output.summary.trim(),
    ...("inputKeys" in output && output.inputKeys ? { inputKeys: [...output.inputKeys] } : {}),
    ...(result ? { result: structuredClone(result) } : {}),
    facts,
  };
  if (output.state === "waiting") {
    const waiting = {
      ...report,
      ...communication,
      state: "waiting" as const,
      actions,
      ...(reviewAt !== undefined ? { reviewAt: Number(reviewAt) } : {}),
      ...(admittedOutput.continue === true ? { continue: true as const } : {}),
      ...(conditions.length ? { conditions } : {}),
      ...(requests.length ? { requests } : {}),
    };
    return {
      ok: true,
      result:
        admittedOutput.report === true ? { ...waiting, report: true, facts: facts as [string, ...string[]] } : waiting,
    };
  }
  const answer = { ...report, ...(response.value ? { response: response.value } : {}) };
  if (output.state === "incomplete") {
    // The incomplete branch above has already checked that facts are non-empty.
    return {
      ok: true,
      result: {
        ...answer,
        state: "incomplete",
        facts: facts as [string, ...string[]],
        ...(output.report === true ? { report: true } : {}),
      },
    };
  }
  return {
    ok: true,
    result: { ...answer, ...communication, state: "converged", actions, ...(requests.length ? { requests } : {}) },
  };
}

export function admitTaskChanges(output: unknown): { ok: true; changes: TaskChanges } | { ok: false; error: string } {
  if (!Check(taskChangesSchema, output))
    return {
      ok: false,
      error: "Task changes must contain only inputKeys, facts, requests, conditions, actions and communication",
    };
  const admitted = admitTaskReconcileResult(
    { state: "waiting", summary: "Apply Task changes", facts: [], ...(output as TaskChanges) },
  );
  if (!admitted.ok) return admitted;
  const { requests, conditions, actions, inputKeys, facts, communication } = admitted.result;
  if (actions?.length && !facts.length) return { ok: false, error: "Task actions require non-empty facts" };
  return {
    ok: true,
    changes: {
      ...(communication ? { communication } : {}),
      ...(requests ? { requests } : {}),
      ...(conditions ? { conditions } : {}),
      ...(actions ? { actions } : {}),
      ...(inputKeys !== undefined ? { inputKeys } : {}),
      facts,
    },
  };
}

/**
 * Reuse Task admission semantics at a model finish boundary without teaching
 * generic execution another interpretation of the Task contract. The schema
 * identifier survives persisted-session JSON round trips; unknown schemas have
 * no Task semantics and remain governed by their own structural contract.
 */
export function admitTaskResultForSchema(schema: TSchema | undefined, output: unknown): TaskReconcileAdmission | null {
  const id = (schema as (TSchema & { $id?: unknown }) | undefined)?.$id;
  if (id === TASK_AGENT_RESULT_SCHEMA_ID || id === TASK_RECONCILE_RESULT_SCHEMA_ID) {
    return admitTaskReconcileResult(output);
  }
  return null;
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
