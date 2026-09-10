import type { AppRead, ExecutionView, TaskDetail, TaskListOptions, TaskPage, TaskView } from "@may-agent/sdk/app";
import type { AppTaskContext, TaskTree } from "../../app-task-store.js";
import { getExecutionResultFromDb } from "../../../lib/execution-result.js";
import type { SqliteDb } from "../../../lib/db.js";
import { getAppInboxItem } from "../../app-inbox-store.js";

export type RuntimeAppReadOptions = {
  getDb(): SqliteDb;
  /** Optional reporting; absence is explicit, not an empty or zero-valued report. */
  readMetric?: AppRead["metric"];
  readOutcomes?: AppRead["tasks"]["outcomes"];
  /** Canonical loaded-App Task reader. Installed Runtime contexts supply it or resource authority. */
  taskRead?: AppRead["tasks"];
  taskStateConfig?: AppTaskContext;
};

export function readRuntimeTaskView(
  opts: Pick<RuntimeAppReadOptions, "taskStateConfig">,
  taskId: string,
): TaskDetail | null {
  const store = opts.taskStateConfig?.resourceStore;
  if (!store) return null;
  // Match reconciliation authority: a live generation supersedes historical
  // receipts. Completed duplicate resources are retired by admission/claim.
  const current = store.readTaskForView(taskId);
  if (current) {
    return resourceTaskDetail(
      current.resource,
      current.phase,
      store.readTaskConditions(taskId).map((condition) => ({
        id: condition.metadata.id,
        ...structuredClone(condition.spec),
      })),
    );
  }
  const receipt = store.readReceipt(taskId);
  return receipt ? receiptTaskDetail(receipt) : null;
}

function receiptTaskView(receipt: NonNullable<TaskTree["receipts"]>[string]): TaskView {
  return {
    id: receipt.metadata.id,
    status: "done",
    generation: receipt.metadata.generation,
    outcome: receipt.outcome,
    summary: receipt.summary,
    response: receipt.response,
    result: receipt.result ? structuredClone(receipt.result) : undefined,
    evidence: [...receipt.evidence],
  };
}

function resourceTaskView(
  resource: NonNullable<TaskTree["resources"]>[string],
  phase: NonNullable<TaskTree["resources"]>[string]["status"]["phase"],
): TaskView {
  return {
    id: resource.metadata.id,
    status: phase === "converged" ? "done" : phase,
    generation: resource.metadata.generation,
    outcome: resource.spec.outcome,
    summary: resource.status.summary,
    response: resource.status.response,
    result: resource.status.result ? structuredClone(resource.status.result) : undefined,
    evidence: resource.status.evidence ? [...resource.status.evidence] : undefined,
  };
}

function receiptTaskDetail(receipt: NonNullable<TaskTree["receipts"]>[string]): TaskDetail {
  return {
    ...receiptTaskView(receipt),
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
  resource: NonNullable<TaskTree["resources"]>[string],
  phase: NonNullable<TaskTree["resources"]>[string]["status"]["phase"],
  conditions: TaskDetail["conditions"],
): TaskDetail {
  return {
    ...resourceTaskView(resource, phase),
    parentId: resource.spec.parentId,
    mode: resource.spec.mode,
    acceptance: [...resource.spec.acceptance],
    input: structuredClone(resource.spec.input ?? {}),
    ...(resource.spec.owner ? { agent: resource.spec.owner, owner: resource.spec.owner } : {}),
    ...(resource.spec.workflow ? { workflow: resource.spec.workflow } : {}),
    ...(resource.spec.executor ? { executor: resource.spec.executor } : {}),
    ...(resource.spec.priority ? { priority: resource.spec.priority } : {}),
    ...(resource.spec.category ? { category: resource.spec.category } : {}),
    ...(resource.spec.dependsOn?.length ? { dependsOn: [...resource.spec.dependsOn] } : {}),
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
      if (current) return [resourceTaskView(current.resource, current.phase)];
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
  const getTask = async (taskId: string) => readRuntimeTaskView(opts, taskId);
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
