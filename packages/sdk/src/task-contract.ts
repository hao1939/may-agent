import { Type, type TSchema } from "typebox";
import { Check, Errors } from "typebox/value";
import { appInputSchema } from "./app-input.js";
import type {
  Condition,
  TaskCondition,
  TaskAction,
  TaskAppRequest,
  LegacyTaskReconcileResult,
  TaskDecisionResult,
  TaskChanges,
  TaskVerificationResult,
} from "./task.js";

export const MIN_CONDITION_REVIEW_AFTER_MS = 60_000;
export const MAX_TASK_RESULT_BYTES = 16 * 1024;

const nonEmptyStringSchema = Type.String({ minLength: 1 });
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
  description:
    "Who can supply the awaited fact: human or kind:identity, e.g. human:requester or app:measurement. Use a lowercase kind and an identity without spaces or colons, not a display name or sentence. This field does not send a message or grant authority.",
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
      description: "Withdraw only this Task’s wait link; external facts and approvals are unchanged.",
    },
  ),
]);

export const conditionSchema = Type.Object(
  {
    id: nonEmptyStringSchema,
    type: Type.String({
      minLength: 1,
      pattern: "\\.",
      description:
        "Namespaced event type from a known producer, e.g. review.completed. Naming a type does not register its producer or ingress.",
    }),
    subject: typedConditionSubjectSchema,
    expected: Type.Unknown(),
    requestedAction: Type.Optional(
      Type.String({ minLength: 1, description: "Needed action; use a delivery capability to contact its owner." }),
    ),
    owner: conditionOwnerSchema,
    reviewAfterMs: Type.Integer({
      minimum: MIN_CONDITION_REVIEW_AFTER_MS,
      description: "Reconsider after this interval; no notification or repair is performed.",
    }),
  },
  {
    additionalProperties: false,
    description: "Known observable fact. Reuse its ID and compatible specification when revising the interval.",
  },
);

const resultFields = {
  summary: nonEmptyStringSchema,
  inputKeys: Type.Optional(
    Type.Array(Type.String({ minLength: 1, pattern: "\\S" }), {
      maxItems: 64,
      uniqueItems: true,
      description:
        "Exact requests covered by this result, from assigned input or currentObligations.inputWaits. Read originals with tasks.get({inputKeys}) as needed. Omit to use the saved assignment; [] covers none. Converged answers only this set; waiting/incomplete keep it open. Other requests and Conditions remain.",
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
          { requestId: nonEmptyStringSchema },
          {
            additionalProperties: false,
            description:
              "Caller waits for this local or durable request id, submitted here or already admitted in the caller generation. Host resolves the exact result and creates the durable Condition.",
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

/** Model-output schema for a resolved agent. */
const legacyTaskAgentResultSchema = Type.Union(
  [
    Type.Object(
      { state: Type.Literal("converged"), ...resultFields, response: Type.Optional(nonEmptyStringSchema) },
      {
        additionalProperties: false,
        description:
          "Facts support an answer or completed work for the considered input. Include response when owed. Convergence is not closure; unrelated open children need not prevent an answer.",
      },
    ),
    Type.Object(
      {
        state: Type.Literal("waiting"),
        ...resultFields,
        continue: Type.Optional(
          Type.Literal(true, {
            description:
              "Queue one more bounded pass for useful work. Keeps the input unanswered; omit to sleep until feedback or review.",
          }),
        ),
      },
      {
        additionalProperties: false,
        description:
          "Keep input open. Continue useful work or sleep on a saved wait, exact Condition, App request or review time. Omit unchanged waits; existing obligations remain.",
      },
    ),
    Type.Object(
      {
        state: Type.Literal("waiting"),
        ...resultFields,
        report: Type.Literal(true, {
          description:
            "Return new caller-relevant progress or a blocker with facts. Existing independent waits remain; omit for an unchanged quiet wait.",
        }),
        continue: Type.Optional(
          Type.Literal(true, {
            description:
              "Queue one more bounded pass for useful work. This may coexist with a report or an independent wait.",
          }),
        ),
        facts: Type.Array(nonEmptyStringSchema, { minItems: 1, maxItems: 32 }),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        state: Type.Literal("incomplete"),
        inputKeys: resultFields.inputKeys,
        report: Type.Optional(
          Type.Literal(true, {
            description: "Return a new caller-relevant update after an earlier report; omit for unchanged failure.",
          }),
        ),
        summary: nonEmptyStringSchema,
        response: Type.Optional(nonEmptyStringSchema),
        result: resultFields.result,
        facts: Type.Array(nonEmptyStringSchema, { minItems: 1, maxItems: 32 }),
      },
      {
        additionalProperties: false,
        description:
          "An unsuccessful attempt. Include partial work, failure evidence and unresolved effects. The assignment remains pending under paced recovery until its owner revises or closes it. Existing saved obligations are preserved.",
      },
    ),
  ],
  {
    $id: TASK_AGENT_RESULT_SCHEMA_ID,
    description:
      "Report one Task attempt against its goal and acceptance. Put supported progress, limitations and exact evidence links in facts; partial output may be retained in result. Existing independent obligations survive omitted fields. Supported observations settle Conditions; authorized decisions supply approval. Feedback is evidence to assess. The Host persists and delivers results; the App judges outcomes. Waiting may set reviewAt (Unix milliseconds) without changing Condition intervals. Requests submit independently owned work: reuse stable id and exact taskId when applicable. The receiver handles the request independently. To wait for its result, return conditions:[{requestId: id}] and state waiting; Host resolves the reference into an ordinary Condition. continue:true permits independent work. Requests without Conditions may accompany convergence. Omission never retires an existing wait; use retire-condition for that decision. Host publishes and correlates; blocked retains the wait, done returns an answer or owner closure. Parent links organize work; dependsOn gates execution. Use ordinary helper calls for bounded contributions.",
  },
);

/** Model-output schema for a workflow, including its explicit agent handoff. */
const legacyTaskReconcileResultSchema = Type.Union(
  [
    legacyTaskAgentResultSchema,
    Type.Object(
      {
        state: Type.Literal("needs-agent"),
        summary: nonEmptyStringSchema,
        facts: Type.Array(nonEmptyStringSchema, { maxItems: 32 }),
      },
      { additionalProperties: false },
    ),
  ],
  { $id: TASK_RECONCILE_RESULT_SCHEMA_ID },
);

const evidenceFields = {
  summary: resultFields.summary,
  facts: resultFields.facts,
  inputKeys: resultFields.inputKeys,
  result: resultFields.result,
};
const changeFields = {
  requests: resultFields.requests,
  conditions: resultFields.conditions,
  actions: resultFields.actions,
};
const ongoingFields = { ...evidenceFields, ...changeFields, reviewAt: resultFields.reviewAt };
const factsRequired = Type.Array(nonEmptyStringSchema, { minItems: 1, maxItems: 32 });
const TASK_AGENT_DECISION_SCHEMA_ID = "may.task-agent-result.v2";
const TASK_RECONCILE_DECISION_SCHEMA_ID = "may.task-reconcile-result.v2";

/** Same typed changes for a live action and final-result declarations. */
export const taskChangesSchema = Type.Object(
  {
    ...changeFields,
    inputKeys: resultFields.inputKeys,
    facts: Type.Optional(resultFields.facts),
  },
  { additionalProperties: false },
);

export const taskAgentResultSchema = Type.Union(
  [
    Type.Object(
      {
        decision: Type.Literal("continue"),
        ...ongoingFields,
        facts: factsRequired,
        report: Type.Optional(Type.Literal(true)),
      },
      { additionalProperties: false },
    ),
    Type.Object({ decision: Type.Literal("wait"), ...ongoingFields }, { additionalProperties: false }),
    Type.Object(
      { decision: Type.Literal("wait"), ...ongoingFields, report: Type.Literal(true), facts: factsRequired },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        decision: Type.Literal("converged"),
        ...evidenceFields,
        requests: resultFields.requests,
        actions: resultFields.actions,
        response: Type.Optional(nonEmptyStringSchema),
      },
      { additionalProperties: false },
    ),
    Type.Object(
      {
        decision: Type.Literal("incomplete"),
        ...evidenceFields,
        facts: factsRequired,
        report: Type.Optional(Type.Literal(true)),
        response: Type.Optional(nonEmptyStringSchema),
      },
      { additionalProperties: false },
    ),
  ],
  {
    $id: TASK_AGENT_DECISION_SCHEMA_ID,
    description:
      "Return one final decision about this Task: continue schedules another attempt for useful work; wait yields on a retained Condition or review time; converged fulfills only inputKeys under App acceptance; incomplete retains unsuccessful work for paced recovery. Multiple tool actions may run within an attempt. Use tasks apply to submit requests, Conditions or actions immediately and keep working; final declarations use the same admission. Requests are receiver-owned work; Conditions belong to the caller and do not stop useful execution. requestId selects a request here or already admitted in this caller generation. Omit unchanged waits. Retire them explicitly. Preserve original input and updates; acknowledgment, interpretation and handoff are not fulfillment. New input and independent obligations survive. Task state and lifetime are Host-owned.",
  },
);

/** @deprecated Use taskAgentResultSchema. */
export const taskOwnerResultSchema = taskAgentResultSchema;
export const taskReconcileResultSchema = Type.Union(
  [
    taskAgentResultSchema,
    Type.Object(
      { decision: Type.Literal("needs-agent"), summary: nonEmptyStringSchema, facts: resultFields.facts },
      { additionalProperties: false },
    ),
  ],
  { $id: TASK_RECONCILE_DECISION_SCHEMA_ID },
);

export const taskVerificationResultSchema = Type.Object(
  {
    accepted: Type.Boolean(),
    summary: nonEmptyStringSchema,
    facts: Type.Array(nonEmptyStringSchema, { maxItems: 32 }),
  },
  { additionalProperties: false },
);

export type TaskReconcileAdmission = { ok: true; result: TaskDecisionResult } | { ok: false; error: string };

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
  const reviewAfterMs = value.reviewAfterMs;
  if (!Number.isInteger(reviewAfterMs) || Number(reviewAfterMs) < MIN_CONDITION_REVIEW_AFTER_MS) {
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
function admitLegacyTaskResult(
  output: unknown,
  options: TaskReconcileAdmissionOptions,
): { ok: true; result: LegacyTaskReconcileResult } | { ok: false; error: string } {
  if (!isRecord(output)) return { ok: false, error: "expected an object" };
  if (output.dependencies !== undefined) {
    if (output.requests !== undefined) return { ok: false, error: "use requests or legacy dependencies, not both" };
    if (output.state !== "waiting") return { ok: false, error: "dependencies are valid only for waiting" };
    if (!Array.isArray(output.dependencies)) return { ok: false, error: "dependencies must be an array" };
    const { dependencies, ...rest } = output;
    if (rest.conditions !== undefined && !Array.isArray(rest.conditions))
      return { ok: false, error: "conditions must be an array" };
    output = {
      ...rest,
      requests: dependencies,
      conditions: [
        ...(Array.isArray(rest.conditions) ? rest.conditions : []),
        ...dependencies.map((dependency) => ({ requestId: isRecord(dependency) ? dependency.id : undefined })),
      ],
    };
  }
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
      output.requests !== undefined
    ) {
      return { ok: false, error: "needs-agent cannot include response, result, actions, Conditions, or requests" };
    }
    const canonicalOutput = output.state === "needs-owner" ? { ...output, state: "needs-agent" } : output;
    if (!Check(legacyTaskReconcileResultSchema, canonicalOutput)) {
      const first = [...Errors(legacyTaskReconcileResultSchema, canonicalOutput)][0];
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
      conditions.push({ requestId });
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
  if (!Check(legacyTaskReconcileResultSchema, output)) {
    const first = [...Errors(legacyTaskReconcileResultSchema, output)][0];
    return {
      ok: false,
      error: `handler result schema rejected ${first?.instancePath || "result"}: ${first?.message ?? "invalid value"}`,
    };
  }

  const report = {
    summary: output.summary.trim(),
    ...("inputKeys" in output && output.inputKeys ? { inputKeys: [...output.inputKeys] } : {}),
    ...(result ? { result: structuredClone(result) } : {}),
    facts,
  };
  if (output.state === "waiting") {
    const waiting = {
      ...report,
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
  return { ok: true, result: { ...answer, state: "converged", actions, ...(requests.length ? { requests } : {}) } };
}

/** Accept legacy producers once; all runtime consumers receive a decision. */
export function admitTaskReconcileResult(
  output: unknown,
  options: TaskReconcileAdmissionOptions,
): TaskReconcileAdmission {
  if (!isRecord(output)) return { ok: false, error: "expected an object" };
  const original = output;
  if (output.decision !== undefined) {
    if (output.state !== undefined || output.continue !== undefined || output.dependencies !== undefined)
      return { ok: false, error: "decision cannot mix with legacy state, continue or dependencies" };
    const { decision, ...fields } = output;
    output = {
      ...fields,
      state: decision === "wait" || decision === "continue" ? "waiting" : decision,
      ...(decision === "continue" ? { continue: true } : {}),
    };
  }
  const admitted = admitLegacyTaskResult(output, options);
  if (!admitted.ok) return admitted;
  if (original.decision !== undefined) {
    const schema = options.allowNeedsAgent ? taskReconcileResultSchema : taskAgentResultSchema;
    if (!Check(schema, original)) {
      const first = [...Errors(schema, original)][0];
      return {
        ok: false,
        error: `handler result schema rejected ${first?.instancePath || "result"}: ${first?.message ?? "invalid value"}`,
      };
    }
  }
  const { state, ...fields } = admitted.result;
  const { continue: continuing, ...rest } = fields as typeof fields & { continue?: true };
  return {
    ok: true,
    result: {
      ...rest,
      decision: state === "waiting" ? (continuing ? "continue" : "wait") : state,
    } as TaskDecisionResult,
  };
}

export function admitTaskChanges(output: unknown): { ok: true; changes: TaskChanges } | { ok: false; error: string } {
  if (!Check(taskChangesSchema, output))
    return { ok: false, error: "Task changes must contain only inputKeys, facts, requests, conditions and actions" };
  const admitted = admitTaskReconcileResult(
    { decision: "wait", summary: "Apply Task changes", facts: [], ...(output as TaskChanges) },
    { allowNeedsAgent: false },
  );
  if (!admitted.ok) return admitted;
  const { requests, conditions, actions, inputKeys, facts } = admitted.result;
  if (actions?.length && !facts.length) return { ok: false, error: "Task actions require non-empty facts" };
  return {
    ok: true,
    changes: {
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
  if (id === TASK_AGENT_RESULT_SCHEMA_ID || id === TASK_AGENT_DECISION_SCHEMA_ID) {
    return admitTaskReconcileResult(output, { allowNeedsAgent: false });
  }
  if (id === TASK_RECONCILE_RESULT_SCHEMA_ID || id === TASK_RECONCILE_DECISION_SCHEMA_ID) {
    return admitTaskReconcileResult(output, { allowNeedsAgent: true });
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
