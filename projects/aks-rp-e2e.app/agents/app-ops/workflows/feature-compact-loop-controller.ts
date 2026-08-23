import { createHash } from "node:crypto";
import { join } from "node:path";
import {
  workflowResultVersion,
  type ExecutionResult,
  type TaskAction,
  type WorkflowContext,
  type WorkflowIoContract,
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
import { syncFeatureCompactProjections } from "./lib/feature-compact-projection-sync.ts";
import { publishFocusMetrics } from "./lib/focus-metric-publication.ts";
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
      parent_id?: string;
      hasLiveChildren?: boolean;
      input?: Record<string, unknown>;
    }
  >;
};

function graphFromContext(ctx: WorkflowContext): Graph {
  const children = ctx.reconciliation?.children;
  if (!children) return {};
  return {
    tasks: Object.fromEntries(
      [...children.live, ...children.completed].map((child) => [
        child.taskId,
        {
          phase: child.status,
          input: child.input,
          parent_id: child.parentId,
          hasLiveChildren: child.hasLiveChildren,
        },
      ]),
    ),
  };
}

function representedTaskState(graph: Graph, taskId: string): string {
  return String(
    graph.tasks?.[taskId]?.phase ?? graph.tasks?.[taskId]?.state ?? "unknown",
  );
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

function representationReview(item: FeatureCompactItemState, graph: Graph) {
  const taskIds = structuredRepresentationHolderIds(item);
  if (taskIds.length === 0) return undefined;
  return {
    source: "parent-direct-children-and-completion-receipts",
    tasks: taskIds.map((taskId) => ({
      taskId,
      status: graph.tasks?.[taskId]
        ? representedTaskState(graph, taskId)
        : "not-a-current-direct-child-or-receipt",
    })),
  };
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
  const hasLiveChild = task.hasLiveChildren === true;
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

export async function execute(ctx: WorkflowContext): Promise<ExecutionResult> {
  const projectDir =
    ctx.workspace?.projectRoot ??
    field(ctx, "project") ??
    "/app/projects/aks-rp-e2e";
  const appDir = resolveAppDir(
    projectDir,
    ctx.workspace?.appRoot ?? field(ctx, "app"),
  );
  try {
    const publishedFocus = publishFocusMetrics({
      metrics: ctx.metrics,
      appDir,
      projectDir,
      measuredBy: "workflow:feature-compact-loop-controller",
    });
    if (publishedFocus.length) {
      ctx.log.info(
        `Published ${publishedFocus.length} domain focus metrics during the durable-loop pulse.`,
      );
    }
  } catch (error) {
    ctx.log.warn(
      `Metric publication failed during the durable-loop pulse: ${String(error)}`,
    );
  }

  const trigger = parseTriggerEvent(ctx);
  const loopTaskId =
    triggerString(trigger, "taskId") ||
    triggerString(trigger, "task_id") ||
    "aks-feature-compact-loop";
  syncFeatureCompactProjections(
    appDir,
    ctx.reconciliation?.children.live ?? [],
  );
  const frontierTarget = Math.min(12, frontierLimit(ctx, 3));
  const reconciliationTask = parseReconciliationTaskPayload(ctx);
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
        : field(ctx, "refillEnabled") !== "false";
  const graph = graphFromContext(ctx);
  const statePath = defaultFeatureCompactLoopStatePath(appDir);
  const { state } = loadFeatureCompactLoopState({
    appDir,
    projectDir,
    loopTaskId,
    windowSize: frontierTarget,
    statePath,
    refreshFromProject: true,
    taskViews: graph.tasks,
  });
  state.windowSize = frontierTarget;
  saveFeatureCompactLoopState(statePath, state, {
    pruneAbsentFeatureKeys: true,
  });
  const proofContext = { appDir, projectDir, statePath };
  const historicalIds = new Set(Object.keys(graph.tasks ?? {}));
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
  const actions: TaskAction[] = remaining
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
      const reviewedRepresentation = representationReview(item, graph);
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
        agent: "aks-explorer",
        workflow: "feature-compact-reconciliation",
        input: {
          featureKey,
          capabilityId: item.capabilityId,
          loopId: featureCompactLoopTaskId,
          workKey: featureKey,
          statePath,
          packetPath: item.packetPath,
          workRevision: revision,
          ...(reviewedRepresentation
            ? { representationReview: reviewedRepresentation }
            : {}),
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
              "When present, use input.representationReview as the fenced parent direct-child/receipt evidence for every cited holder; do not query task persistence or the task-tree CLI.",
              "If the cited evidence names an existing source branch, commit, dispatch metadata file, or task worktree, inspect that exact branch/worktree in place; do not copy its delta into the shared canonical dev checkout just to review it.",
              "Treat any cited task id marked not-a-current-direct-child-or-receipt in representationReview as stale history; do not return an action that references it.",
              "If current evidence proves the accepted live result, fill the missing structured proof fields and preserve done.",
              "Otherwise move the item to the exact truthful pending, blocked, or reviewed terminal state without launching an unchanged rerun.",
              "If review shows an executable compact plan, spec, carrier, or runner source must change, rebind the same task to spec-live-reconciliation with the complete feature specIds, livePlanPath, fixed target, and any prepared sourceBranch/sourceCommit instead of editing or publishing from the shared canonical checkout. Use domain-task-execution only for a truly source-only patch that requires no live behavior proof.",
            ]
          : repairsRepresentation
            ? [
                "Inspect the current feature-compact row, feature packet, compact artifacts, and cited evidence before changing anything.",
                "Use input.representationReview as the fenced parent direct-child/receipt evidence for every cited holder; do not query task persistence or the task-tree CLI.",
                "If the cited evidence names an existing source branch, commit, dispatch metadata file, or task worktree, inspect that exact branch/worktree in place; do not copy its delta into the shared canonical dev checkout just to review it.",
                "Treat any cited task id marked not-a-current-direct-child-or-receipt in representationReview as stale history; do not return an action that references it.",
                "A cited completed receipt is immutable; use one new deterministic holder ID and repoint the feature row instead of attempting to recreate a completed ID.",
                "If the current exact wait/frontier is still truthful, recreate or repoint exactly one live holder task and update the feature-compact row to that holder instead of reopening a broad unchanged compact rerun.",
                "If the prior exact wait/frontier is stale, replace it with the smallest truthful current pending task, exact wait, reviewed terminal disposition, or done state using current evidence.",
                "A feature-level holder represents only the workRevision it carries. Preserve still-true narrower waits, but do not let an older or subset-scoped wait hide materially changed runnable work in the same feature.",
                "Do not relaunch the whole unchanged compact package merely because the prior holder finished or disappeared; repair the representation first.",
                "If review shows an executable compact plan, spec, carrier, or runner source must change, rebind the same task to spec-live-reconciliation with the complete feature specIds, livePlanPath, fixed target, and any prepared sourceBranch/sourceCommit instead of editing or publishing from the shared canonical checkout. Use domain-task-execution only for a truly source-only patch that requires no live behavior proof.",
              ]
            : [
                ...learnedCompactVerificationAcceptance,
                "Do not query or reference historical task ids from a domain ledger; only the current task input and direct-child reconciliation facts carry task authority.",
                "Regenerate the feature-owned compact plan after each planner, spec, carrier, or cleanup repair; do not preserve stale cluster counts or split reasons.",
                "Keep repairing the smallest artificial split until every remaining split names a real immutable-property or logical-history conflict, then run the complete generated check suite before live dispatch.",
                "The feature-owned package covers its complete declared spec set.",
                "A live staging pass is recorded, or one exact typed wait or reviewed terminal disposition preserves the next wake condition.",
                "The compact loop state is updated with evidence before this task converges.",
              ],
        priority: "P1",
      } satisfies TaskAction;
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
    state: "needs-agent",
    summary,
    evidence: [`feature-compact-state:${statePath}`],
  });
}
