import type {
  AppRead,
  ExecutionView,
  TaskReadOptions,
  TaskDetail,
  TaskListOptions,
  TaskPage,
  TaskView,
} from "@may-agent/sdk/app";
import type { AppTaskContext, TaskTree } from "../tasks/app-task-store.js";
import { getExecutionResultFromDb } from "../../../lib/execution-result.js";
import type { SqliteDb } from "../../../lib/db.js";
import { getAppInboxItem } from "../state/app-inbox-store.js";
import {
  hasTaskAcceptedEvidence,
  readTaskAcceptedEvidence,
  TASK_ACCEPTED_EVIDENCE_MAX_PAGE_SIZE,
} from "./app-task-evidence.js";

export type RuntimeAppReadOptions = {
  getDb(): SqliteDb;
  /** Optional reporting; absence is explicit, not an empty or zero-valued report. */
  readMetric?: AppRead["metric"];
  readOutcomes?: AppRead["tasks"]["outcomes"];
  /** Canonical loaded-App Task reader. Installed Runtime contexts supply it or resource authority. */
  taskRead?: AppRead["tasks"];
  taskStateConfig?: AppTaskContext;
};

const TASK_INPUT_OBLIGATION_LIMIT = 100;

type CorrelatedInputRow = {
  id: string;
  input_kind: string;
  status: "pending" | "handling" | "done";
  task_admission_key: string;
};

function currentTaskObligations(
  store: AppTaskContext["resourceStore"],
  resource: NonNullable<TaskTree["resources"]>[string],
): NonNullable<TaskDetail["currentObligations"]> {
  const waits = Object.entries(resource.status.inputWaits ?? {}).sort(([left], [right]) => left.localeCompare(right));
  const selected = waits.slice(0, TASK_INPUT_OBLIGATION_LIMIT);
  const keys = selected.map(([key]) => key);
  const admissions = keys.length
    ? (store.readTaskContext({ taskIds: [], admissionIds: keys }, { childLimit: 0 }).appTaskAdmissions ?? {})
    : {};
  const inputRows = keys.length
    ? (store.db
        .prepare(
          `SELECT id, input_kind, status, task_admission_key
           FROM app_inbox_items
           WHERE app_id = ? AND task_admission_key IN (${keys.map(() => "?").join(", ")})
             AND ((status = 'handling' AND waiting_on_kind = 'task' AND waiting_on_id = ?)
               OR execution_task_id = ?)
           ORDER BY id`,
        )
        .all(store.appId, ...keys, resource.metadata.id, resource.metadata.id) as CorrelatedInputRow[])
    : [];
  const inputs = new Map<string, CorrelatedInputRow | null>();
  for (const row of inputRows) {
    inputs.set(row.task_admission_key, inputs.has(row.task_admission_key) ? null : row);
  }

  return {
    available: true,
    ...(resource.status.reviewAt !== undefined ? { reviewAt: resource.status.reviewAt } : {}),
    inputWaits: {
      maxItems: TASK_INPUT_OBLIGATION_LIMIT,
      truncated: waits.length > TASK_INPUT_OBLIGATION_LIMIT,
      items: selected.map(([key, wait]) => {
        const input = inputs.get(key);
        const admission = admissions[key];
        return {
          key,
          ...(wait.reviewAt !== undefined ? { reviewAt: wait.reviewAt } : {}),
          conditionCount: wait.conditions.length,
          correlation: {
            input: input
              ? { available: true as const, id: input.id, kind: input.input_kind, status: input.status }
              : { available: false as const },
            admission: admission
              ? {
                  available: true as const,
                  ...(admission.reportAttemptId ? { reportAttemptId: admission.reportAttemptId } : {}),
                  ...(admission.reportRevision !== undefined ? { reportRevision: admission.reportRevision } : {}),
                  ...(admission.resultAttemptId ? { resultAttemptId: admission.resultAttemptId } : {}),
                }
              : { available: false as const },
          },
        };
      }),
    },
  };
}

export function readRuntimeTaskView(
  opts: Pick<RuntimeAppReadOptions, "taskStateConfig">,
  taskId: string,
  options?: TaskReadOptions,
): TaskDetail | null {
  const store = opts.taskStateConfig?.resourceStore;
  if (!store) return null;
  // Retained Task state owns current decisions. The fallback below only
  // exposes pre-cutover history when no retained resource exists.
  const acceptedEvidence: TaskDetail["acceptedEvidence"] = {
    available: hasTaskAcceptedEvidence(store.db, store.appId, taskId),
    maxPageSize: TASK_ACCEPTED_EVIDENCE_MAX_PAGE_SIZE,
    ...(options?.acceptedEvidence
      ? { page: readTaskAcceptedEvidence(store.db, store.appId, taskId, options.acceptedEvidence) }
      : {}),
  };
  const current = store.readTaskForView(taskId);
  if (current) {
    return resourceTaskDetail(
      store,
      current.resource,
      current.phase,
      acceptedEvidence,
      store.readTaskConditions(taskId).map((condition) => ({
        id: condition.metadata.id,
        ...structuredClone(condition.spec),
      })),
      current.resource.status.observedAttemptId ? store.readAttempt(current.resource.status.observedAttemptId) : null,
      current.closed,
    );
  }
  const receipt = store.readReceipt(taskId);
  return receipt ? receiptTaskDetail(receipt, acceptedEvidence) : null;
}

function receiptTaskView(receipt: NonNullable<TaskTree["receipts"]>[string]): TaskView {
  return {
    id: receipt.metadata.id,
    closed: true,
    status: "done",
    generation: receipt.metadata.generation,
    outcome: receipt.outcome,
    summary: receipt.summary,
    response: receipt.response,
    result: receipt.result ? structuredClone(receipt.result) : undefined,
    facts: [...receipt.facts],
  };
}

function resourceTaskView(
  resource: NonNullable<TaskTree["resources"]>[string],
  phase: NonNullable<TaskTree["resources"]>[string]["status"]["phase"],
  closed = false,
): TaskView {
  return {
    id: resource.metadata.id,
    ...(closed ? { closed: true } : {}),
    status: phase === "converged" ? "done" : phase,
    generation: resource.metadata.generation,
    outcome: resource.spec.outcome,
    summary: resource.status.summary,
    response: resource.status.response,
    result: resource.status.result ? structuredClone(resource.status.result) : undefined,
    facts: resource.status.facts ? [...resource.status.facts] : undefined,
  };
}

function receiptTaskDetail(
  receipt: NonNullable<TaskTree["receipts"]>[string],
  acceptedEvidence: TaskDetail["acceptedEvidence"],
): TaskDetail {
  return {
    ...receiptTaskView(receipt),
    currentObligations: { available: false },
    acceptedEvidence,
    parentId: receipt.parentId,
    acceptance: [...receipt.acceptance],
    input: structuredClone(receipt.input ?? {}),
    agent: receipt.owner,
    owner: receipt.owner,
    ...(receipt.workflow ? { workflow: receipt.workflow } : {}),
    ...(receipt.executor ? { executor: receipt.executor } : {}),
    ...(receipt.priority ? { priority: receipt.priority } : {}),
    conditions: [],
  };
}

function resourceTaskDetail(
  store: AppTaskContext["resourceStore"],
  resource: NonNullable<TaskTree["resources"]>[string],
  phase: NonNullable<TaskTree["resources"]>[string]["status"]["phase"],
  acceptedEvidence: TaskDetail["acceptedEvidence"],
  conditions: TaskDetail["conditions"],
  acceptedAttempt: ReturnType<AppTaskContext["resourceStore"]["readAttempt"]>,
  closed = false,
): TaskDetail {
  return {
    ...resourceTaskView(resource, phase, closed),
    currentObligations: currentTaskObligations(store, resource),
    acceptedEvidence,
    ...(resource.metadata.creator ? { creator: structuredClone(resource.metadata.creator) } : {}),
    ...(acceptedAttempt && acceptedAttempt.acceptedResult
      ? {
          acceptedAttempt: {
            id: acceptedAttempt.metadata.id,
            generation: acceptedAttempt.taskGeneration,
            startedAt: acceptedAttempt.startedAt,
            ...(acceptedAttempt.finishedAt ? { finishedAt: acceptedAttempt.finishedAt } : {}),
          },
        }
      : {}),
    parentId: resource.spec.parentId,

    acceptance: [...resource.spec.acceptance],
    input: structuredClone(resource.spec.input ?? {}),
    ...(resource.spec.owner ? { agent: resource.spec.owner, owner: resource.spec.owner } : {}),
    ...(resource.spec.workflow ? { workflow: resource.spec.workflow } : {}),
    ...(resource.spec.executor ? { executor: resource.spec.executor } : {}),
    ...(resource.spec.priority ? { priority: resource.spec.priority } : {}),
    ...(resource.spec.category ? { category: resource.spec.category } : {}),
    ...(resource.spec.dependsOn?.length ? { dependsOn: [...resource.spec.dependsOn] } : {}),
    ...(resource.spec.outputs ? { outputs: [...resource.spec.outputs] } : {}),
    conditions,
  };
}

function encodeTaskCursor(taskId: string): string {
  return Buffer.from(taskId, "utf8").toString("base64url");
}

function decodeTaskCursor(cursor: string): string {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    if (!decoded || encodeTaskCursor(decoded) !== cursor) throw new Error("non-canonical cursor");
    return decoded;
  } catch {
    throw new Error("Invalid Task cursor");
  }
}

export function listRuntimeTaskViews(
  opts: Pick<RuntimeAppReadOptions, "taskStateConfig">,
  options: TaskListOptions = {},
): TaskPage {
  const limit = options.limit ?? 50;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error("Task list limit must be an integer between 1 and 100");
  }
  const validStatuses = new Set<TaskView["status"]>(["pending", "running", "waiting", "attention", "done"]);
  if (options.status?.some((status) => !validStatuses.has(status))) {
    throw new Error("Invalid Task status filter");
  }
  const statuses = options.status ? new Set(options.status) : null;
  const after = options.cursor === undefined ? null : decodeTaskCursor(options.cursor);
  const store = opts.taskStateConfig?.resourceStore;
  if (!store) return { items: [] };
  const ids = store.listTaskIds({ after, statuses, limit: limit + 1 });
  const pageIds = ids.slice(0, limit);
  return {
    items: pageIds.flatMap((id) => {
      const current = store.readTaskForView(id);
      if (current) return [resourceTaskView(current.resource, current.phase, current.closed)];
      const receipt = store.readReceipt(id);
      return receipt ? [receiptTaskView(receipt)] : [];
    }),
    ...(ids.length > limit && pageIds.length > 0 ? { nextCursor: encodeTaskCursor(pageIds.at(-1)!) } : {}),
  };
}

export function readRuntimeExecutionView(opts: Pick<RuntimeAppReadOptions, "getDb">, id: string): ExecutionView | null {
  const result = getExecutionResultFromDb(opts.getDb(), id);
  if (!result) return null;
  const status = result.status === "escalated" ? "blocked" : result.status;
  return {
    id: result.id,
    kind: result.kind === "session" ? "agent" : "workflow",
    status,
    summary: result.summary,
  };
}

/** Runtime-owned implementation of the SDK's bounded read projections. */
export function createRuntimeAppRead(opts: RuntimeAppReadOptions): AppRead {
  const getTask = async (taskId: string, options?: TaskReadOptions) => readRuntimeTaskView(opts, taskId, options);
  return {
    async appResult(itemId) {
      return getAppInboxItem(opts.getDb(), itemId)?.result ?? null;
    },
    tasks: opts.taskRead ?? {
      async list(options) {
        return listRuntimeTaskViews(opts, options);
      },
      async outcomes(options) {
        if (!opts.readOutcomes) throw new Error("Task outcome reporting is unavailable");
        return opts.readOutcomes(options);
      },
      get: getTask,
    },
    async execution(executionId) {
      return readRuntimeExecutionView(opts, executionId);
    },
    async metric(metricId) {
      if (!opts.readMetric) throw new Error("Metric reporting is unavailable");
      return opts.readMetric(metricId);
    },
  };
}
