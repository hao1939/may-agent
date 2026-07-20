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
  frontierLimit,
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
  version: "feature-compact-loop-controller-v2",
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
    { phase?: string; state?: string; input?: Record<string, unknown> }
  >;
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
  return Boolean(taskId && graph.tasks?.[taskId]);
}

function representedTaskState(graph: Graph, taskId: string): string {
  return String(
    graph.tasks?.[taskId]?.phase ?? graph.tasks?.[taskId]?.state ?? "unknown",
  );
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
  const frontierTarget = Math.min(12, frontierLimit(ctx.task, 3));
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
    const summary = `Feature compact loop ${loopTaskId} converged: all ${Object.keys(state.features).length} feature packages have live proof.`;
    return ctx.done(summary, {
      state: "converged",
      summary,
      evidence: [`feature-compact-state:${statePath}`],
      actions: [],
    });
  }

  const representedByFeature = new Map(
    remaining.map(([featureKey, item]) => {
      const ids = new Set(
        [
          desiredTaskId(featureKey, item),
          item.taskId,
          ...(item.frontierTaskIds ?? []),
        ].filter((taskId): taskId is string => represented(graph, taskId)),
      );
      for (const [taskId, task] of Object.entries(graph.tasks ?? {})) {
        if (
          (task.input?.loopId === featureCompactLoopTaskId &&
            task.input?.workKey === featureKey) ||
          (task.input?.loopTaskId === featureCompactLoopTaskId &&
            task.input?.featureKey === featureKey)
        ) {
          ids.add(taskId);
        }
      }
      return [featureKey, [...ids]] as const;
    }),
  );
  const representedTaskIds = [
    ...new Set(
      [...representedByFeature.values()].flatMap((taskIds) => taskIds),
    ),
  ];
  const accounting = loopFrontierAccounting(
    representedTaskIds.map((taskId) => ({
      taskId,
      phase: representedTaskState(graph, taskId),
    })),
    frontierTarget,
  );
  const actionBudget = accounting.available;
  const actions: ProjectAppTaskAction[] = remaining
    .filter(
      ([featureKey]) =>
        (representedByFeature.get(featureKey) ?? []).length === 0,
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
          loopId: featureCompactLoopTaskId,
          workKey: featureKey,
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
              "Inspect the existing compact result, cited evidence, and current .state/tasks/tree.json before changing the ledger.",
              "Treat any taskId, frontierTaskIds, waitingFor.taskId, or waitingFor.representedTaskIds that are absent from the current .state/tasks/tree.json as stale history; do not return an action that references a missing task id.",
              "If current evidence proves the accepted live result, fill the missing structured proof fields and preserve done.",
              "Otherwise move the item to the exact truthful pending, blocked, or reviewed terminal state without launching an unchanged rerun.",
            ]
          : [
              ...learnedCompactVerificationAcceptance,
              "Treat any taskId, frontierTaskIds, waitingFor.taskId, or waitingFor.representedTaskIds that are absent from the current .state/tasks/tree.json as stale history; do not return an action that references a missing task id.",
              "The feature-owned package covers its complete declared spec set.",
              "A live staging pass is recorded, or one exact typed wait or reviewed terminal disposition preserves the next wake condition.",
              "The compact loop state is updated with evidence before this task converges.",
            ],
        priority: "P1",
      } satisfies ProjectAppTaskAction;
    });
  const summary = `Feature compact loop ${loopTaskId} has ${remaining.length} nonterminal feature(s): declared ${actions.length} bounded task action(s), observed ${accounting.actionableTaskIds.length} actionable, ${accounting.waitingTaskIds.length} waiting, ${accounting.attentionTaskIds.length} attention, and ${accounting.terminalTaskIds.length} stale terminal representation(s).`;
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
