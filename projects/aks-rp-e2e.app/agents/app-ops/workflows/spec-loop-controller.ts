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
  loadSpecs,
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

type GraphTask = {
  id?: string;
  state?: string;
  goal?: string;
  summary?: string;
  result?: string;
  acceptance?: unknown;
  conflict_scope?: unknown;
};

type GraphResource = {
  status?: {
    phase?: string;
    conditionIds?: string[];
  };
};

type Graph = {
  tasks?: Record<string, GraphTask>;
  resources?: Record<string, GraphResource>;
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
    taskId && (graph.tasks?.[taskId] || graph.resources?.[taskId]),
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function openTask(task: GraphTask | null | undefined): boolean {
  const state = String(task?.state ?? "")
    .trim()
    .toLowerCase();
  return !["done", "closed", "converged"].includes(state);
}

function representedTaskState(graph: Graph, taskId: string): string {
  const phase = String(graph.resources?.[taskId]?.status?.phase ?? "")
    .trim()
    .toLowerCase();
  if (phase) return phase;
  return String(graph.tasks?.[taskId]?.state ?? "backlog")
    .trim()
    .toLowerCase();
}

function canWaitForRepresentedTask(graph: Graph, taskId: string): boolean {
  const state = representedTaskState(graph, taskId);
  return !["attention", "review", "failed", "error"].includes(state);
}

function familyPrefixesForSpec(specId: string): string[] {
  const body = specId.replace(/^spec\./, "");
  const segments = body.split(".").filter(Boolean);
  const prefixes = new Set<string>();
  if (segments.length >= 1) prefixes.add(segments[0]!);
  if (segments.length >= 2) prefixes.add(`${segments[0]}.${segments[1]}`);
  if (segments.length >= 2) prefixes.add(`${segments[0]}-${segments[1]}`);
  return [...prefixes].map((value) => value.toLowerCase());
}

function featureKeysBySpecId(projectDir: string): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const spec of loadSpecs(projectDir)) {
    const match = spec.file.match(/^features\/([^/]+)\/specs\//);
    const featureKey = match?.[1]?.trim();
    if (!featureKey) continue;
    const existing = map.get(spec.id) ?? [];
    if (!existing.includes(featureKey)) existing.push(featureKey);
    map.set(spec.id, existing);
  }
  return map;
}

function taskRepresentsSpec(
  task: GraphTask,
  specId: string,
  featureKeys: string[],
): boolean {
  const scopes = Array.isArray(task.conflict_scope)
    ? task.conflict_scope.filter(
        (value): value is string => typeof value === "string",
      )
    : [];
  if (scopes.includes(`spec:${specId}`)) return true;

  const loweredScopes = scopes.map((value) => value.toLowerCase());
  if (
    featureKeys.some(
      (featureKey) =>
        loweredScopes.includes(`feature:${featureKey.toLowerCase()}`) ||
        loweredScopes.includes(`feature-compact:${featureKey.toLowerCase()}`),
    )
  ) {
    return true;
  }

  const familyPrefixes = familyPrefixesForSpec(specId);
  if (
    loweredScopes.some((scope) => {
      const token = scope.split(":").pop()?.trim().toLowerCase();
      return Boolean(token && familyPrefixes.includes(token));
    })
  ) {
    return true;
  }

  const matcher = new RegExp(
    `(^|[^A-Za-z0-9_.-])${escapeRegExp(specId)}([^A-Za-z0-9_.-]|$)`,
  );
  const evidenceFields = [
    task.goal,
    task.summary,
    task.result,
    ...(Array.isArray(task.acceptance)
      ? task.acceptance.filter(
          (value): value is string => typeof value === "string",
        )
      : []),
  ].filter((value): value is string => typeof value === "string");
  return evidenceFields.some((value) => matcher.test(value));
}

function collectReferencedTaskIds(
  value: unknown,
  ids: Set<string> = new Set(),
): Set<string> {
  if (!value || typeof value !== "object") return ids;
  if (Array.isArray(value)) {
    for (const entry of value) collectReferencedTaskIds(entry, ids);
    return ids;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (
      typeof entry === "string" &&
      ["taskid", "task_id"].some((suffix) => key.toLowerCase().endsWith(suffix))
    ) {
      ids.add(entry);
      continue;
    }
    collectReferencedTaskIds(entry, ids);
  }
  return ids;
}

function representedTaskIdsForSpec(
  graph: Graph,
  specId: string,
  spec: SpecLoopSpecState,
  featureKeys: string[],
): string[] {
  const representedTaskIds = new Set<string>();
  for (const taskId of collectReferencedTaskIds(spec)) {
    if (represented(graph, taskId)) representedTaskIds.add(taskId);
  }
  for (const [taskId, task] of Object.entries(graph.tasks ?? {})) {
    if (!openTask(task)) continue;
    if (taskRepresentsSpec(task, specId, featureKeys)) {
      representedTaskIds.add(taskId);
    }
  }
  return [...representedTaskIds];
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 10);
}

function workId(specId: string): string {
  return `spec/${safeTaskIdForSpec(specId)}`;
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
  const projectDir =
    ctx.projectDir ?? field(ctx.task, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir =
    ctx.appDir ?? resolveAppDir(projectDir, field(ctx.task, "app"));
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
  const specFeatureKeys = featureKeysBySpecId(projectDir);
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

  const representedBySpec = new Map(
    remaining.map(([specId, spec]) => [
      specId,
      representedTaskIdsForSpec(
        graph,
        specId,
        spec,
        specFeatureKeys.get(specId) ?? [],
      ),
    ]),
  );
  const representedTaskIds = [
    ...new Set([...representedBySpec.values()].flatMap((taskIds) => taskIds)),
  ];
  const waitableRepresentedTaskIds = representedTaskIds.filter((taskId) =>
    canWaitForRepresentedTask(graph, taskId),
  );
  const attentionRepresentedTaskIds = representedTaskIds.filter(
    (taskId) => !canWaitForRepresentedTask(graph, taskId),
  );
  const actionBudget = Math.min(12, Math.max(1, state.windowSize || 5));
  const actions: ProjectAppTaskAction[] = remaining
    .filter(([specId]) => (representedBySpec.get(specId) ?? []).length === 0)
    .slice(0, actionBudget)
    .map(([specId, spec]) => ({
      kind: "create-task",
      id: workId(specId),
      parentId: loopTaskId,
      outcome: `Reconcile ${specId} to a passing live result, an exact wait, or a reviewed terminal disposition.`,
      mode: "achieve",
      owner: "aks-explorer",
      input: {
        specId,
        loopTaskId,
        statePath,
      },
      outputs: [statePath, "../aks-rp-e2e/runs/test-results/"],
      acceptance: [
        "Current source, model, runner, and prior evidence are inspected before any rerun.",
        "A live pass is recorded, or one exact typed wait or reviewed terminal disposition preserves the next wake condition.",
        "The loop state is updated with evidence before this task converges.",
      ],
      priority: "P1",
    }));
  const conditions =
    actions.length === 0 && attentionRepresentedTaskIds.length === 0
      ? waitableRepresentedTaskIds.slice(0, 64).map(childCondition)
      : [];
  const summary = `Spec loop ${loopTaskId} has ${remaining.length} nonterminal spec(s): declared ${actions.length} bounded task action(s), observed ${representedTaskIds.length} represented task(s), and found ${attentionRepresentedTaskIds.length} represented review/attention task(s) that require owner repair rather than passive waiting.`;
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
