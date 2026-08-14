import type { AppRead, ExecutionView, MetricView, TaskView } from "@may-agent/sdk/app";
import { projectRuntimePaths, readTaskState, type TaskStateConfig } from "@may-agent/sdk/legacy";
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
  opts: Pick<RuntimeAppReadOptions, "executionPaths">,
  taskId: string,
): TaskView | null {
  if (!opts.executionPaths) return null;
  try {
    const tree = readTaskState(taskConfig(opts.executionPaths));
    const receipt = tree.receipts?.[taskId];
    if (receipt) {
      return {
        id: taskId,
        status: "done",
        generation: receipt.metadata.generation,
        outcome: receipt.outcome,
        summary: receipt.summary,
        evidence: receipt.evidence,
      };
    }
    const resource = tree.resources?.[taskId];
    if (!resource) return null;
    return {
      id: taskId,
      status: resource.status.phase === "converged" ? "done" : resource.status.phase,
      generation: resource.metadata.generation,
      outcome: resource.spec.outcome,
      summary: resource.status.summary,
      evidence: resource.status.evidence,
    };
  } catch {
    return null;
  }
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
  return {
    async appResult(itemId) {
      return getAppInboxItem(opts.getDb(), itemId)?.result ?? null;
    },
    async task(taskId) {
      return readRuntimeTaskView(opts, taskId);
    },
    async execution(executionId) {
      return readRuntimeExecutionView(opts, executionId);
    },
    async metric(metricId) {
      return metricView(opts.metrics, metricId);
    },
  };
}
