import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  resolveTaskTreePath,
  workflowResultVersion,
  type ProjectAppTaskAction,
  type WorkflowContext,
  type WorkflowIoContract,
  type WorkflowResult,
} from "@may-agent/sdk";
import {
  defaultFeatureCompactLoopStatePath,
  hasDurableLiveProof,
  loadFeatureCompactLoopState,
  missingDurableLiveProofFields,
  saveFeatureCompactLoopState,
  safeFeatureCompactTaskId,
  type FeatureCompactItemState,
} from "./lib/feature-compact-loop-store.ts";
import { publishFocusMetrics } from "./lib/focus-metric-publication.ts";
import { publishProjectMetrics } from "./lib/project-metric-publication.ts";
import {
  field,
  frontierLimit,
  parseReconciliationTaskPayload,
  parseTriggerEvent,
  resolveAppDir,
  triggerString,
} from "./lib/workflow-input.ts";
import {
  featureCompactLoopTaskId,
  learnedCompactVerificationAcceptance,
  loopFrontierAccounting,
} from "../../../task-loops.ts";

export const name = "feature-compact-loop-controller";
export const description =
  "Observe feature compact state and declare the next bounded reconciliation work.";
export const workflowContract: WorkflowIoContract = {
  workflow: name,
  version: "feature-compact-loop-controller-v3",
  input: {
    required: [
      "project.task.tick action=feature-compact-loop",
      "target.taskId",
    ],
    optional: ["frontierLimit"],
    description:
      "Reconcile one durable feature-compact responsibility from current state.",
  },
  output: {
    version: workflowResultVersion,
    fields: ["state", "summary", "evidence", "actions"],
    description:
      "Returns bounded desired task actions and then converges; it never assigns work or writes the task graph.",
  },
};

type Graph = {
  tasks?: Record<
    string,
    {
      phase?: string;
      state?: string;
      children?: string[];
      input?: Record<string, unknown>;
    }
  >;
};

type TaskState = {
  receipts?: Record<string, unknown>;
  resources?: Record<string, unknown>;
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

function representedTaskState(graph: Graph, taskId: string): string {
  return String(
    graph.tasks?.[taskId]?.phase ?? graph.tasks?.[taskId]?.state ?? "unknown",
  );
}

function readTaskState(appDir: string): TaskState {
  try {
    return JSON.parse(
      readFileSync(join(appDir, ".state", "tasks", "state.json"), "utf8"),
    ) as TaskState;
  } catch {
    return {};
  }
}

function historicalTaskIds(taskState: TaskState): string[] {
  return [
    ...Object.keys(taskState.receipts ?? {}),
    ...Object.keys(taskState.resources ?? {}),
  ];
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 10);
}

function workId(featureKey: string, revision: string): string {
  return `compact/${safeFeatureCompactTaskId(featureKey)}-${revision}`;
}

function proofRepairId(featureKey: string, revision: string): string {
  return `compact/repair-${safeFeatureCompactTaskId(featureKey)}-proof-${revision}`;
}

function representationRepairId(featureKey: string, revision: string): string {
  return `compact/repair-${safeFeatureCompactTaskId(featureKey)}-representation-${revision}`;
}

function hasStructuredRepresentation(item: FeatureCompactItemState): boolean {
  return Boolean(
    item.taskId ||
    (item.frontierTaskIds?.length ?? 0) > 0 ||
    item.waitingFor ||
    item.waitingCondition ||
    item.resumeCondition,
  );
}

function isAcceptedTerminalResidue(item: FeatureCompactItemState): boolean {
  return (
    typeof item.nextStepClassification === "string" &&
    item.nextStepClassification.startsWith("reviewed-terminal") &&
    !item.taskId &&
    (item.frontierTaskIds?.length ?? 0) === 0 &&
    !item.waitingFor &&
    !item.waitingCondition &&
    typeof item.resumeCondition === "string" &&
    item.resumeCondition.trim().length > 0
  );
}

function structuredRepresentationHolderIds(
  item: FeatureCompactItemState,
): string[] {
  if (item.status === "done") {
    return [];
  }
  const waitingFor = item.waitingFor ?? {};
  const waitingTaskId =
    typeof waitingFor.taskId === "string" ? waitingFor.taskId : undefined;
  const representedTaskIds = Array.isArray(waitingFor.representedTaskIds)
    ? waitingFor.representedTaskIds.filter(
        (taskId): taskId is string => typeof taskId === "string",
      )
    : [];
  return [
    item.taskId,
    ...(item.frontierTaskIds ?? []),
    waitingTaskId,
    ...representedTaskIds,
  ].filter((taskId): taskId is string => Boolean(taskId));
}

function desiredTaskId(
  featureKey: string,
  item: FeatureCompactItemState,
  revision: string,
  proofContext: { appDir: string; projectDir: string; statePath: string },
): string {
  if (item.status === "done" && !hasDurableLiveProof(item, proofContext)) {
    return proofRepairId(featureKey, revision);
  }
  if (item.status !== "done" && hasStructuredRepresentation(item)) {
    return representationRepairId(featureKey, revision);
  }
  return workId(featureKey, revision);
}

function workRevision(item: {
  status: string;
  inputFingerprint?: string | null;
  errorFingerprint?: string | null;
  updatedAt: string;
}): string {
  return digest(
    [
      item.status,
      item.inputFingerprint ?? "",
      item.errorFingerprint ?? "",
      item.updatedAt,
    ].join(":"),
  );
}

function representsCurrentWork(
  graph: Graph,
  taskId: string,
  featureKey: string,
  revision: string,
): boolean {
  const task = graph.tasks?.[taskId];
  if (!task) return false;
  const input = task.input ?? {};
  const ownsFeature =
    (input.loopId === featureCompactLoopTaskId &&
      input.workKey === featureKey) ||
    (input.loopTaskId === featureCompactLoopTaskId &&
      input.featureKey === featureKey);
  return ownsFeature && input.workRevision === revision;
}

function representsInFlightFeatureTransition(
  graph: Graph,
  taskId: string,
  featureKey: string,
): boolean {
  const task = graph.tasks?.[taskId];
  if (!task) return false;
  const phase = representedTaskState(graph, taskId).trim().toLowerCase();
  const hasLiveChild = (task.children ?? []).some(
    (childId) =>
      Boolean(graph.tasks?.[childId]) &&
      !isTerminalRepresentationPhase(representedTaskState(graph, childId)),
  );
  if (phase !== "running" && !(phase === "waiting" && hasLiveChild)) {
    return false;
  }
  const input = task.input ?? {};
  const ownsFeature =
    (input.loopId === featureCompactLoopTaskId &&
      input.workKey === featureKey) ||
    (input.loopTaskId === featureCompactLoopTaskId &&
      input.featureKey === featureKey);
  return (
    ownsFeature &&
    typeof input.workRevision === "string" &&
    Boolean(input.workRevision.trim())
  );
}

function isTerminalRepresentationPhase(phase: string): boolean {
  return new Set(["closed", "converged", "done"]).has(
    phase.trim().toLowerCase(),
  );
}

function ensureFreshTaskId(
  baseId: string,
  terminalHistoryIds: string[],
): string {
  const occupied = new Set(terminalHistoryIds);
  if (!occupied.has(baseId)) {
    return baseId;
  }
  const seed = [...occupied].sort().join(":");
  for (let attempt = 1; attempt < 1000; attempt += 1) {
    const candidate = `${baseId}-${digest(`${seed}:${attempt}`)}`;
    if (!occupied.has(candidate)) {
      return candidate;
    }
  }
  return `${baseId}-${digest(`${seed}:overflow`)}`;
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectDir =
    ctx.projectDir ?? field(ctx.task, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir = resolveAppDir(
    projectDir,
    ctx.appDir ?? field(ctx.task, "app"),
  );
  try {
    const publishedFocus = publishFocusMetrics({
      metrics: ctx.metrics,
      appDir,
      projectDir,
      measuredBy: "workflow:feature-compact-loop-controller",
    });
    const publishedProject = publishProjectMetrics({
      metrics: ctx.metrics,
      appDir,
      projectDir,
      measuredBy: "workflow:feature-compact-loop-controller",
    });
    if (publishedFocus.length || publishedProject.length) {
      ctx.log(
        `Published ${publishedFocus.length} focus metrics and ${publishedProject.length} project metrics during the durable-loop pulse.`,
      );
    }
  } catch (error) {
    ctx.log(
      `Metric publication failed during the durable-loop pulse: ${String(error)}`,
    );
  }

  const trigger = parseTriggerEvent(ctx.task);
  const loopTaskId =
    triggerString(trigger, "taskId") ||
    triggerString(trigger, "task_id") ||
    "aks-feature-compact-loop";
  const frontierTarget = Math.min(12, frontierLimit(ctx.task, 3));
  const reconciliationTask = parseReconciliationTaskPayload(ctx.task);
  const structuredInput =
    reconciliationTask?.input &&
    typeof reconciliationTask.input === "object" &&
    !Array.isArray(reconciliationTask.input)
      ? (reconciliationTask.input as Record<string, unknown>)
      : null;
  const structuredRefillEnabled = structuredInput?.refillEnabled;
  const refillEnabled =
    typeof structuredRefillEnabled === "boolean"
      ? structuredRefillEnabled
      : typeof structuredRefillEnabled === "string"
        ? structuredRefillEnabled.trim().toLowerCase() !== "false"
        : field(ctx.task, "refillEnabled") !== "false";
  const statePath = defaultFeatureCompactLoopStatePath(appDir);
  const { state } = loadFeatureCompactLoopState({
    appDir,
    projectDir,
    loopTaskId,
    windowSize: frontierTarget,
    statePath,
    refreshFromProject: true,
  });
  state.windowSize = frontierTarget;
  saveFeatureCompactLoopState(statePath, state, {
    pruneAbsentFeatureKeys: true,
  });
  const graph = readGraph(appDir);
  const taskState = readTaskState(appDir);
  const proofContext = { appDir, projectDir, statePath };
  const historicalIds = new Set(historicalTaskIds(taskState));
  const remaining = Object.entries(state.features)
    .filter(
      ([, item]) =>
        !hasDurableLiveProof(item, proofContext) &&
        !isAcceptedTerminalResidue(item),
    )
    .sort(([left, leftItem], [right, rightItem]) => {
      const leftRepair = leftItem.status === "done" ? 0 : 1;
      const rightRepair = rightItem.status === "done" ? 0 : 1;
      return (
        leftRepair - rightRepair ||
        leftItem.updatedAt.localeCompare(rightItem.updatedAt) ||
        left.localeCompare(right)
      );
    });

  if (remaining.length === 0) {
    const summary = `Feature compact loop ${loopTaskId} converged: all ${Object.keys(state.features).length} feature packages have live proof or an accepted reviewed terminal disposition.`;
    return ctx.done(summary, {
      state: "converged",
      summary,
      evidence: [`feature-compact-state:${statePath}`],
      actions: [],
    });
  }

  const representedByFeature = new Map(
    remaining.map(([featureKey, item]) => {
      const revision = workRevision(item);
      const ids = new Set<string>();
      for (const taskId of Object.keys(graph.tasks ?? {})) {
        if (
          representsCurrentWork(graph, taskId, featureKey, revision) ||
          representsInFlightFeatureTransition(graph, taskId, featureKey)
        ) {
          ids.add(taskId);
        }
      }
      for (const taskId of structuredRepresentationHolderIds(item)) {
        if (graph.tasks?.[taskId]) ids.add(taskId);
      }
      const all = [...ids];
      const terminal = all.filter((taskId) =>
        isTerminalRepresentationPhase(representedTaskState(graph, taskId)),
      );
      const live = all.filter((taskId) => !terminal.includes(taskId));
      return [featureKey, { all, live, terminal }] as const;
    }),
  );
  const representedTaskIds = [
    ...new Set([...representedByFeature.values()].flatMap(({ all }) => all)),
  ];
  const accounting = loopFrontierAccounting(
    representedTaskIds.map((taskId) => ({
      taskId,
      phase: representedTaskState(graph, taskId),
    })),
    frontierTarget,
  );
  const actionBudget = refillEnabled ? accounting.available : 0;
  const actions: ProjectAppTaskAction[] = remaining
    .filter(([featureKey]) => {
      const representation = representedByFeature.get(featureKey);
      return (representation?.live.length ?? 0) === 0;
    })
    .slice(0, actionBudget)
    .map(([featureKey, item]) => {
      const revision = workRevision(item);
      const missingProofFields = missingDurableLiveProofFields(
        item,
        proofContext,
      );
      const repairsLegacyProof =
        item.status === "done" && missingProofFields.length > 0;
      const repairsRepresentation =
        item.status !== "done" && hasStructuredRepresentation(item);
      const baseTaskId = desiredTaskId(
        featureKey,
        item,
        revision,
        proofContext,
      );
      const taskId = ensureFreshTaskId(baseTaskId, [
        ...(representedByFeature.get(featureKey)?.terminal ?? []),
        ...historicalIds,
      ]);
      return {
        kind: "create-task",
        id: taskId,
        parentId: featureCompactLoopTaskId,
        outcome: repairsLegacyProof
          ? `Repair the accepted proof record for feature compact package ${featureKey} without launching an unchanged live rerun.`
          : repairsRepresentation
            ? `Repair the feature-compact representation for ${featureKey}: the ledger already records an exact wait/frontier shape, but no live holder task currently represents that nonterminal feature.`
            : `Reconcile feature compact package ${featureKey} to live-proven done, an exact wait, or a reviewed terminal disposition.`,
        mode: "achieve",
        owner: "aks-explorer",
        workflow: "feature-compact-reconciliation",
        input: {
          featureKey,
          capabilityId: item.capabilityId,
          loopId: featureCompactLoopTaskId,
          workKey: featureKey,
          statePath,
          packetPath: item.packetPath,
          workRevision: revision,
          ...(repairsLegacyProof
            ? { repair: "legacy-proof", missingProofFields }
            : repairsRepresentation
              ? { repair: "representation" }
              : {}),
        },
        outputs: [statePath, `../aks-rp-e2e/features/${featureKey}/compact/`],
        acceptance: repairsLegacyProof
          ? [
              "Inspect the existing compact result and cited evidence before changing the ledger.",
              "Before declaring that no exact wait exists or clearing taskId/frontierTaskIds, query every cited holder with the app's canonical helper (`cd ../aks-rp-e2e.app && bun run task-tree show <task-id> --json`) and inspect its returned resource status plus condition objects. A failed ad hoc JSON parse is unknown, never evidence that a task or Condition is absent.",
              "If the cited evidence names an existing source branch, commit, dispatch metadata file, or task worktree, inspect that exact branch/worktree in place; do not copy its delta into the shared canonical dev checkout just to review it.",
              "Treat any taskId, frontierTaskIds, waitingFor.taskId, or waitingFor.representedTaskIds that the canonical task-tree helper proves absent as stale history; do not return an action that references a missing task id.",
              "If current evidence proves the accepted live result, fill the missing structured proof fields and preserve done.",
              "Otherwise move the item to the exact truthful pending, blocked, or reviewed terminal state without launching an unchanged rerun.",
              "If review shows an executable compact plan, spec, carrier, or runner source must change, rebind the same task to spec-live-reconciliation with the complete feature specIds, livePlanPath, fixed target, and any prepared sourceBranch/sourceCommit instead of editing or publishing from the shared canonical checkout. Use domain-task-execution only for a truly source-only patch that requires no live behavior proof.",
            ]
          : repairsRepresentation
            ? [
                "Inspect the current feature-compact row, feature packet, compact artifacts, and cited evidence before changing anything.",
                "Before declaring that no exact wait exists or clearing taskId/frontierTaskIds, query every cited holder with the app's canonical helper (`cd ../aks-rp-e2e.app && bun run task-tree show <task-id> --json`) and inspect its returned resource status plus condition objects. A failed ad hoc JSON parse is unknown, never evidence that a task or Condition is absent.",
                "If the cited evidence names an existing source branch, commit, dispatch metadata file, or task worktree, inspect that exact branch/worktree in place; do not copy its delta into the shared canonical dev checkout just to review it.",
                "Treat any taskId, frontierTaskIds, waitingFor.taskId, or waitingFor.representedTaskIds that the canonical task-tree helper proves absent as stale history; do not return an action that references a missing task id.",
                "Before creating a replacement holder, check .state/tasks/state.json receipts as well as the live tree. A completed task ID is immutable; use one new deterministic holder ID and repoint the feature row instead of attempting to recreate a completed ID.",
                "If the current exact wait/frontier is still truthful, recreate or repoint exactly one live holder task and update the feature-compact row to that holder instead of reopening a broad unchanged compact rerun.",
                "If the prior exact wait/frontier is stale, replace it with the smallest truthful current pending task, exact wait, reviewed terminal disposition, or done state using current evidence.",
                "A feature-level holder represents only the workRevision it carries. Preserve still-true narrower waits, but do not let an older or subset-scoped wait hide materially changed runnable work in the same feature.",
                "Do not relaunch the whole unchanged compact package merely because the prior holder finished or disappeared; repair the representation first.",
                "If review shows an executable compact plan, spec, carrier, or runner source must change, rebind the same task to spec-live-reconciliation with the complete feature specIds, livePlanPath, fixed target, and any prepared sourceBranch/sourceCommit instead of editing or publishing from the shared canonical checkout. Use domain-task-execution only for a truly source-only patch that requires no live behavior proof.",
              ]
            : [
                ...learnedCompactVerificationAcceptance,
                "Treat any taskId, frontierTaskIds, waitingFor.taskId, or waitingFor.representedTaskIds that the canonical task-tree helper proves absent as stale history; do not return an action that references a missing task id.",
                "Regenerate the feature-owned compact plan after each planner, spec, carrier, or cleanup repair; do not preserve stale cluster counts or split reasons.",
                "Keep repairing the smallest artificial split until every remaining split names a real immutable-property or logical-history conflict, then run the complete generated check suite before live dispatch.",
                "The feature-owned package covers its complete declared spec set.",
                "A live staging pass is recorded, or one exact typed wait or reviewed terminal disposition preserves the next wake condition.",
                "The compact loop state is updated with evidence before this task converges.",
              ],
        priority: "P1",
      } satisfies ProjectAppTaskAction;
    });
  const summary = `Feature compact loop ${loopTaskId} has ${remaining.length} nonterminal feature(s): ${refillEnabled ? "refill enabled" : "refill paused for the selector-first master-validation campaign"}; declared ${actions.length} bounded task action(s), observed ${accounting.actionableTaskIds.length} actionable, ${accounting.waitingTaskIds.length} waiting, ${accounting.attentionTaskIds.length} attention, and ${accounting.terminalTaskIds.length} stale terminal representation(s).`;
  if (
    actions.length > 0 ||
    accounting.actionableTaskIds.length > 0 ||
    accounting.waitingTaskIds.length > 0
  ) {
    return ctx.done(summary, {
      state: "converged",
      summary,
      evidence: [`feature-compact-state:${statePath}`],
      actions,
    });
  }
  return ctx.done(summary, {
    state: "needs-owner",
    summary,
    evidence: [`feature-compact-state:${statePath}`],
  });
}
