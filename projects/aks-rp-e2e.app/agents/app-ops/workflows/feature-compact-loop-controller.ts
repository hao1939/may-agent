import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
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
import {
  field,
  maxConcurrent,
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
    fields: ["state", "summary", "evidence", "actions"],
    description:
      "Returns bounded desired task actions and then converges; it never assigns work or writes the task graph.",
  },
};

type Graph = {
  tasks?: Record<string, { phase?: string }>;
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

function representedTaskNeedsOwner(graph: Graph, taskId: string): boolean {
  return graph.tasks?.[taskId]?.phase === "attention";
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 10);
}

function workId(featureKey: string): string {
  return `compact/${safeFeatureCompactTaskId(featureKey)}`;
}

function proofRepairId(featureKey: string): string {
  return `compact/repair-${safeFeatureCompactTaskId(featureKey)}-proof`;
}

function desiredTaskId(
  featureKey: string,
  item: FeatureCompactItemState,
): string {
  return item.status === "done" && !hasDurableLiveProof(item)
    ? proofRepairId(featureKey)
    : workId(featureKey);
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

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectDir =
    ctx.projectDir ?? field(ctx.task, "project") ?? "/app/projects/aks-rp-e2e";
  const appDir =
    ctx.appDir ?? resolveAppDir(projectDir, field(ctx.task, "app"));
  const trigger = parseTriggerEvent(ctx.task);
  const loopTaskId =
    triggerString(trigger, "taskId") ||
    triggerString(trigger, "task_id") ||
    "aks-feature-compact-loop";
  const frontierTarget = Math.min(12, maxConcurrent(ctx.task, trigger, 3));
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
  const remaining = Object.entries(state.features)
    .filter(([, item]) => !hasDurableLiveProof(item))
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
        .flatMap(([featureKey, item]) => [
          desiredTaskId(featureKey, item),
          item.taskId,
          ...(item.frontierTaskIds ?? []),
        ])
        .filter((taskId): taskId is string => represented(graph, taskId)),
    ),
  ];
  const attentionTaskIds = representedTaskIds.filter((taskId) =>
    representedTaskNeedsOwner(graph, taskId),
  );
  const progressingTaskIds = representedTaskIds.filter(
    (taskId) => !representedTaskNeedsOwner(graph, taskId),
  );
  const configuredCapacity = Math.min(12, Math.max(1, state.windowSize || 1));
  const actionBudget = Math.max(
    0,
    configuredCapacity - representedTaskIds.length,
  );
  const actions: ProjectAppTaskAction[] = remaining
    .filter(
      ([featureKey, item]) =>
        !represented(graph, desiredTaskId(featureKey, item)) &&
        !represented(graph, item.taskId) &&
        !(item.frontierTaskIds ?? []).some((taskId) =>
          represented(graph, taskId),
        ),
    )
    .slice(0, actionBudget)
    .map(([featureKey, item]) => {
      const missingProofFields = missingDurableLiveProofFields(item);
      const repairsLegacyProof =
        item.status === "done" && missingProofFields.length > 0;
      return {
        kind: "create-task",
        id: desiredTaskId(featureKey, item),
        parentId: "group/feature-compact",
        outcome: repairsLegacyProof
          ? `Repair the accepted proof record for feature compact package ${featureKey} without launching an unchanged live rerun.`
          : `Reconcile feature compact package ${featureKey} to live-proven done, an exact wait, or a reviewed terminal disposition.`,
        mode: "achieve",
        owner: "aks-explorer",
        input: {
          featureKey,
          capabilityId: item.capabilityId,
          loopTaskId,
          statePath,
          packetPath: item.packetPath,
          workRevision: workRevision(item),
          ...(repairsLegacyProof
            ? { repair: "legacy-proof", missingProofFields }
            : {}),
        },
        outputs: [statePath, `../aks-rp-e2e/features/${featureKey}/compact/`],
        acceptance: repairsLegacyProof
          ? [
              "Inspect the existing compact result and cited evidence before changing the ledger.",
              "If current evidence proves the accepted live result, fill the missing structured proof fields and preserve done.",
              "Otherwise move the item to the exact truthful pending, blocked, or reviewed terminal state without launching an unchanged rerun.",
            ]
          : [
              "The feature-owned package covers its complete declared spec set.",
              "A live staging pass is recorded, or one exact typed wait or reviewed terminal disposition preserves the next wake condition.",
              "The compact loop state is updated with evidence before this task converges.",
            ],
        priority: "P1",
      } satisfies ProjectAppTaskAction;
    });
  const summary = `Feature compact loop ${loopTaskId} has ${remaining.length} nonterminal feature(s): declared ${actions.length} bounded task action(s), observed ${progressingTaskIds.length} progressing represented task(s), and found ${attentionTaskIds.length} represented attention task(s).`;
  if (actions.length > 0 || representedTaskIds.length > 0) {
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
    actions: [],
  });
}
