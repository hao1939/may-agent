import type { AppRead, ExecutionView, MetricView, TaskListOptions, TaskPage, TaskView } from "@may-agent/sdk/app";
import { projectRuntimePaths } from "./app-task-runtime-state.js";
import { cacheTaskStateReads, readTaskState, type TaskStateConfig, type TaskTree } from "./app-task-store.js";
import { getExecutionResultFromDb } from "../lib/execution-result.js";
import type { MetricService } from "../lib/metrics.js";
import type { SqliteDb } from "../lib/db.js";
import { getAppInboxItem } from "./app-inbox-store.js";

export type RuntimeAppReadOptions = {
  getDb(): SqliteDb;
  metrics: MetricService;
  executionPaths?: {
    appDir: string;
    projectDir: string;
  };
  taskStateConfig?: TaskStateConfig;
};

function taskConfig(paths: NonNullable<RuntimeAppReadOptions["executionPaths"]>): TaskStateConfig {
  const runtimePaths = projectRuntimePaths(paths.appDir);
  return {
    appDir: paths.appDir,
    projectDir: paths.projectDir,
    statePath: runtimePaths.taskStatePath,
    journalPath: runtimePaths.journalPath,
    worker: "app-read",
    maxConcurrent: 1,
  };
}

export function readRuntimeTaskView(
  opts: Pick<RuntimeAppReadOptions, "executionPaths" | "taskStateConfig">,
  taskId: string,
): TaskView | null {
  if (opts.taskStateConfig?.resourceStore) {
    const receipt = opts.taskStateConfig.resourceStore.readReceipt(taskId);
    if (receipt) return receiptTaskView(receipt);
    const resource = opts.taskStateConfig.resourceStore.readTask(taskId);
    return resource ? resourceTaskView(resource) : null;
  }
  if (!opts.executionPaths) return null;
  const tree = readTaskState(taskConfig(opts.executionPaths));
  return taskView(tree, taskId);
}

/** Reuse one parsed canonical tree across a bounded sequence of Task reads. */
export function createRuntimeTaskReader(
  executionPaths: NonNullable<RuntimeAppReadOptions["executionPaths"]>,
): (taskId: string) => TaskView | null {
  const config = taskConfig(executionPaths);
  cacheTaskStateReads(config);
  return (taskId) => taskView(readTaskState(config), taskId);
}

function taskView(tree: TaskTree, taskId: string): TaskView | null {
  const receipt = tree.receipts?.[taskId];
  if (receipt) return receiptTaskView(receipt);
  const resource = tree.resources?.[taskId];
  if (!resource) return null;
  return resourceTaskView(resource);
}

function receiptTaskView(receipt: NonNullable<TaskTree["receipts"]>[string]): TaskView {
  return {
    id: receipt.metadata.id,
    status: "done",
    generation: receipt.metadata.generation,
    outcome: receipt.outcome,
    summary: receipt.summary,
    response: receipt.response,
    evidence: [...receipt.evidence],
  };
}

function resourceTaskView(resource: NonNullable<TaskTree["resources"]>[string]): TaskView {
  return {
    id: resource.metadata.id,
    status: resource.status.phase === "converged" ? "done" : resource.status.phase,
    generation: resource.metadata.generation,
    outcome: resource.spec.outcome,
    summary: resource.status.summary,
    response: resource.status.response,
    evidence: resource.status.evidence ? [...resource.status.evidence] : undefined,
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
  opts: Pick<RuntimeAppReadOptions, "executionPaths" | "taskStateConfig">,
  options: TaskListOptions = {},
): TaskPage {
  if (!opts.executionPaths) return { items: [] };
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
  if (opts.taskStateConfig?.resourceStore) {
    const ids = opts.taskStateConfig.resourceStore.listTaskIds({ after, statuses, limit: limit + 1 });
    const pageIds = ids.slice(0, limit);
    return {
      items: pageIds.flatMap((id) => {
        const view = readRuntimeTaskView(opts, id);
        return view ? [view] : [];
      }),
      ...(ids.length > limit && pageIds.length > 0 ? { nextCursor: encodeTaskCursor(pageIds.at(-1)!) } : {}),
    };
  }
  const tree = readTaskState(taskConfig(opts.executionPaths));
  const ids = [...new Set([...Object.keys(tree.resources ?? {}), ...Object.keys(tree.receipts ?? {})])].sort();
  const visible = ids
    .filter((id) => after === null || id > after)
    .map((id) => taskView(tree, id))
    .filter((task): task is TaskView => Boolean(task && (!statuses || statuses.has(task.status))));
  const page = visible.slice(0, limit);
  return {
    items: page,
    ...(visible.length > limit && page.length > 0 ? { nextCursor: encodeTaskCursor(page.at(-1)!.id) } : {}),
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

function metricView(metrics: MetricService, id: string): MetricView | null {
  const metric = metrics.get(id);
  if (!metric) return null;
  return {
    id: metric.id,
    value: metric.current,
    status: metric.status,
    target: metric.target,
    threshold: metric.threshold,
    unit: metric.unit,
  };
}

/** Runtime-owned implementation of the SDK's bounded read projections. */
export function createRuntimeAppRead(opts: RuntimeAppReadOptions): AppRead {
  const getTask = async (taskId: string) => readRuntimeTaskView(opts, taskId);
  return {
    async appResult(itemId) {
      return getAppInboxItem(opts.getDb(), itemId)?.result ?? null;
    },
    tasks: {
      async list(options) {
        return listRuntimeTaskViews(opts, options);
      },
      get: getTask,
    },
    async execution(executionId) {
      return readRuntimeExecutionView(opts, executionId);
    },
    async metric(metricId) {
      return metricView(opts.metrics, metricId);
    },
  };
}
