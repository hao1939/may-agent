import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  resolveTaskTreePath,
  workflowResultVersion,
  type ProjectAppConditionSpec,
  type ProjectAppTaskAction,
  type WorkflowContext,
  type WorkflowIoContract,
  type WorkflowResult,
} from "@may-agent/sdk";
import {
  defaultFeatureCompactLoopStatePath,
  loadFeatureCompactLoopState,
  safeFeatureCompactTaskId,
  type FeatureCompactItemState,
} from "./lib/feature-compact-loop-store.ts";
import {
  field,
  parseTriggerEvent,
  resolveAppDir,
  triggerString,
} from "./lib/workflow-input.ts";

export const name = "feature-compact-loop-controller";
export const description =
  "Observe feature compact state and declare the next bounded reconciliation work.";
export const workflowContract: WorkflowIoContract = {
  workflow: name,
  version: "feature-compact-loop-controller-v2",
  input: {
    required: [
      "project.task.tick action=feature-compact-loop",
      "target.taskId",
    ],
    optional: ["maxConcurrent"],
    description:
      "Reconcile one durable feature-compact responsibility from current state.",
  },
  output: {
    version: workflowResultVersion,
    fields: ["state", "summary", "evidence", "actions", "conditions"],
    description:
      "Returns desired task actions or exact Conditions; it never assigns work or writes the task graph.",
  },
};

type Graph = {
  tasks?: Record<string, unknown>;
  resources?: Record<string, unknown>;
  receipts?: Record<string, unknown>;
};

function readGraph(appDir: string): Graph {
  try {
    return JSON.parse(
      readFileSync(resolveTaskTreePath(appDir), "utf8"),
    ) as Graph;
  } catch {
    return {};
  }
}

function represented(graph: Graph, taskId: string | null | undefined): boolean {
  return Boolean(
    taskId &&
    (graph.tasks?.[taskId] ||
      graph.resources?.[taskId] ||
      graph.receipts?.[taskId]),
  );
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 10);
}

function workId(featureKey: string, item: FeatureCompactItemState): string {
  const revision = `${item.status}:${item.updatedAt}:${item.lastWorkflowRunId ?? ""}`;
  return `compact/${safeFeatureCompactTaskId(featureKey)}-${digest(revision)}`;
}

function childCondition(taskId: string): ProjectAppConditionSpec {
  return {
    id: `task-converged:${digest(taskId)}`,
    type: "project.task.reconciled",
    subject: `task:${taskId}`,
    expected: { field: "disposition", equals: "converged" },
  };
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectDir = field(ctx.task, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir = resolveAppDir(projectDir, field(ctx.task, "app"));
  const trigger = parseTriggerEvent(ctx.task);
  const loopTaskId =
    triggerString(trigger, "taskId") ||
    triggerString(trigger, "task_id") ||
    "aks-feature-compact-loop";
  const statePath = defaultFeatureCompactLoopStatePath(appDir);
  const { state } = loadFeatureCompactLoopState({
    appDir,
    projectDir,
    loopTaskId,
    windowSize: 1,
    statePath,
    refreshFromProject: false,
  });
  const graph = readGraph(appDir);
  const remaining = Object.entries(state.features)
    .filter(([, item]) => item.status !== "done")
    .sort(([left], [right]) => left.localeCompare(right));

  if (remaining.length === 0) {
    const summary = `Feature compact loop ${loopTaskId} converged: all ${Object.keys(state.features).length} feature packages have live proof.`;
    return ctx.done(summary, {
      state: "converged",
      summary,
      evidence: [`feature-compact-state:${statePath}`],
      actions: [],
    });
  }

  const representedTaskIds = [
    ...new Set(
      remaining
        .flatMap(([, item]) => [item.taskId, ...(item.frontierTaskIds ?? [])])
        .filter((taskId): taskId is string => represented(graph, taskId)),
    ),
  ];
  const actionBudget = Math.min(12, Math.max(1, state.windowSize || 1));
  const actions: ProjectAppTaskAction[] = remaining
    .filter(
      ([, item]) =>
        !represented(graph, item.taskId) &&
        !(item.frontierTaskIds ?? []).some((taskId) =>
          represented(graph, taskId),
        ),
    )
    .slice(0, actionBudget)
    .map(([featureKey, item]) => ({
      kind: "create-task",
      id: workId(featureKey, item),
      parentId: loopTaskId,
      goal: `Reconcile feature compact package ${featureKey} from ${item.status} to live-proven done, an exact wait, or a reviewed terminal disposition.`,
      mode: "achieve",
      owner: "aks-explorer",
      input: {
        featureKey,
        capabilityId: item.capabilityId,
        loopTaskId,
        statePath,
        status: item.status,
        packetPath: item.packetPath,
        lastPlanPath: item.lastPlanPath,
        lastResultPath: item.lastResultPath,
        retryable: item.retryable,
        retryReason: item.retryReason,
        resumeCondition: item.resumeCondition,
      },
      outputs: [statePath, `../aks-rp-e2e/features/${featureKey}/compact/`],
      acceptance: [
        "The feature-owned package covers its complete declared spec set.",
        "A live staging pass is recorded, or one exact typed wait or reviewed terminal disposition preserves the next wake condition.",
        "The compact loop state is updated with evidence before this task converges.",
      ],
      priority: "P1",
    }));
  const conditions = representedTaskIds.slice(0, 64).map(childCondition);
  const summary = `Feature compact loop ${loopTaskId} has ${remaining.length} nonterminal feature(s): declared ${actions.length} bounded task action(s) and observed ${representedTaskIds.length} represented task(s).`;
  return ctx.done(summary, {
    state:
      actions.length > 0
        ? "converged"
        : conditions.length > 0
          ? "waiting"
          : "needs-owner",
    summary,
    evidence: [`feature-compact-state:${statePath}`],
    actions,
    ...(conditions.length > 0 ? { conditions } : {}),
  });
}
