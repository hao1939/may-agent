import { readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  ProjectAppTaskAction,
  WorkflowContext,
  WorkflowResult,
} from "@may-agent/sdk/legacy";

export const name = "unified-feature-loop-ownership-migration";
export const description =
  "Move current feature-compact siblings under their executable standing loop.";

const featureLoopTaskId = "aks-feature-compact-loop";
const legacyGroupId = "group/feature-compact";
const maxActions = 20;

type Resource = {
  metadata?: { generation?: number };
  spec?: { mode?: string; parentId?: string };
  status?: { phase?: string };
};

type TaskState = {
  resources?: Record<string, Resource>;
};

type FeatureRow = {
  taskId?: string | null;
  frontierTaskIds?: string[];
  waitingFor?: {
    taskId?: string | null;
    representedTaskIds?: string[];
  } | null;
};

type FeatureState = {
  features?: Record<string, FeatureRow>;
};

function currentTaskIds(featureState: FeatureState): Set<string> {
  const taskIds = new Set<string>();
  for (const row of Object.values(featureState.features ?? {})) {
    const candidates = [
      row.taskId,
      ...(row.frontierTaskIds ?? []),
      row.waitingFor?.taskId,
      ...(row.waitingFor?.representedTaskIds ?? []),
    ];
    for (const taskId of candidates) {
      if (typeof taskId === "string" && taskId.trim())
        taskIds.add(taskId.trim());
    }
  }
  return taskIds;
}

export function featureLoopOwnershipMigrationActions(
  taskState: TaskState,
  featureState: FeatureState,
): ProjectAppTaskAction[] {
  const resources = taskState.resources ?? {};
  return [...currentTaskIds(featureState)]
    .sort()
    .flatMap((taskId): ProjectAppTaskAction[] => {
      const resource = resources[taskId];
      const generation = resource?.metadata?.generation;
      if (
        resource?.spec?.parentId !== legacyGroupId ||
        !["achieve", "maintain"].includes(resource.spec.mode ?? "") ||
        !["pending", "waiting"].includes(resource.status?.phase ?? "") ||
        !Number.isInteger(generation)
      ) {
        return [];
      }
      return [
        {
          kind: "update-task",
          taskId,
          expectedGeneration: generation as number,
          parentId: featureLoopTaskId,
          ...(resource.spec.mode === "maintain"
            ? { mode: "achieve" as const }
            : {}),
        },
      ];
    })
    .slice(0, maxActions);
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  if (!ctx.appDir) {
    throw new Error("unified-feature-loop-ownership-migration requires appDir");
  }
  const taskState = JSON.parse(
    readFileSync(join(ctx.appDir, ".state", "tasks", "state.json"), "utf8"),
  ) as TaskState;
  const featureState = JSON.parse(
    readFileSync(
      join(ctx.appDir, ".state", "feature-compact-loop", "state.json"),
      "utf8",
    ),
  ) as FeatureState;
  const actions = featureLoopOwnershipMigrationActions(taskState, featureState);
  const summary = `Moved ${actions.length} current feature-compact tasks under the executable feature loop.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: ["migration:feature-loop-current-v1"],
    actions,
  });
}
