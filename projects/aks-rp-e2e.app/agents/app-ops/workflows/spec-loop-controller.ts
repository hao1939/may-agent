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
  defaultSpecLoopStatePath,
  loadSpecLoopState,
  safeTaskIdForSpec,
  type SpecLoopSpecState,
} from "./lib/spec-loop-store.ts";
import {
  field,
  parseTriggerEvent,
  resolveAppDir,
  triggerString,
} from "./lib/workflow-input.ts";

export const name = "spec-loop-controller";
export const description =
  "Observe single-spec verification state and declare the next bounded reconciliation work.";
export const workflowContract: WorkflowIoContract = {
  workflow: name,
  version: "spec-loop-controller-v2",
  input: {
    required: ["project.task.tick action=spec-loop", "target.taskId"],
    optional: ["maxConcurrent"],
    description:
      "Reconcile one durable spec-loop responsibility from current state.",
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

function workId(specId: string, spec: SpecLoopSpecState): string {
  const revision = `${spec.status}:${spec.updatedAt}:${spec.lastRunId ?? ""}`;
  return `spec/${safeTaskIdForSpec(specId)}-${digest(revision)}`;
}

function isSatisfied(spec: SpecLoopSpecState): boolean {
  return (
    spec.status === "pass" ||
    spec.status === "done" ||
    spec.terminalDisposition === true
  );
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
    "aks-spec-verification-loop";
  const statePath = defaultSpecLoopStatePath(appDir);
  const { state } = loadSpecLoopState({
    appDir,
    projectDir,
    loopTaskId,
    windowSize: 5,
    statePath,
    refreshFromProject: false,
  });
  const graph = readGraph(appDir);
  const remaining = Object.entries(state.specs)
    .filter(([, spec]) => !isSatisfied(spec))
    .sort(([left], [right]) => {
      const leftPriority = state.prioritySpecIds.indexOf(left);
      const rightPriority = state.prioritySpecIds.indexOf(right);
      if (leftPriority >= 0 || rightPriority >= 0) {
        return (
          (leftPriority < 0 ? Number.MAX_SAFE_INTEGER : leftPriority) -
          (rightPriority < 0 ? Number.MAX_SAFE_INTEGER : rightPriority)
        );
      }
      return left.localeCompare(right);
    });

  if (remaining.length === 0) {
    const summary = `Spec loop ${loopTaskId} converged: all ${Object.keys(state.specs).length} specs passed or reached a reviewed terminal disposition.`;
    return ctx.done(summary, {
      state: "converged",
      summary,
      evidence: [`spec-loop-state:${statePath}`],
      actions: [],
    });
  }

  const representedTaskIds = [
    ...new Set(
      remaining
        .map(([, spec]) => spec.taskId)
        .filter((taskId): taskId is string => represented(graph, taskId)),
    ),
  ];
  const actionBudget = Math.min(12, Math.max(1, state.windowSize || 5));
  const actions: ProjectAppTaskAction[] = remaining
    .filter(([, spec]) => !represented(graph, spec.taskId))
    .slice(0, actionBudget)
    .map(([specId, spec]) => ({
      kind: "create-task",
      id: workId(specId, spec),
      parentId: loopTaskId,
      goal: `Reconcile ${specId} from its current ${spec.status} evidence to a passing live result, an exact wait, or a reviewed terminal disposition.`,
      mode: "achieve",
      owner: "aks-explorer",
      input: {
        specId,
        loopTaskId,
        statePath,
        status: spec.status,
        lastRunId: spec.lastRunId,
        lastResultPath: spec.lastResultPath,
        diagnosis: spec.diagnosis,
        resumeCondition: spec.resumeCondition,
      },
      outputs: [statePath, "../aks-rp-e2e/runs/test-results/"],
      acceptance: [
        "Current source, model, runner, and prior evidence are inspected before any rerun.",
        "A live pass is recorded, or one exact typed wait or reviewed terminal disposition preserves the next wake condition.",
        "The loop state is updated with evidence before this task converges.",
      ],
      priority: "P1",
    }));
  const conditions = representedTaskIds.slice(0, 64).map(childCondition);
  const summary = `Spec loop ${loopTaskId} has ${remaining.length} nonterminal spec(s): declared ${actions.length} bounded task action(s) and observed ${representedTaskIds.length} represented task(s).`;
  return ctx.done(summary, {
    state:
      actions.length > 0
        ? "converged"
        : conditions.length > 0
          ? "waiting"
          : "needs-owner",
    summary,
    evidence: [`spec-loop-state:${statePath}`],
    actions,
    ...(conditions.length > 0 ? { conditions } : {}),
  });
}
