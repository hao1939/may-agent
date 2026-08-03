import { readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  ProjectAppTaskAction,
  WorkflowContext,
  WorkflowResult,
} from "@may-agent/sdk";

export const name = "unified-feature-loop-history-migration";
export const description =
  "Compact stale completed feature-compact holders into receipts.";

const legacyGroupId = "group/feature-compact";

type Resource = {
  metadata?: { generation?: number };
  spec?: { mode?: string; parentId?: string };
  status?: { phase?: string; conditionIds?: string[] };
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
    for (const taskId of [
      row.taskId,
      ...(row.frontierTaskIds ?? []),
      row.waitingFor?.taskId,
      ...(row.waitingFor?.representedTaskIds ?? []),
    ]) {
      if (typeof taskId === "string" && taskId.trim())
        taskIds.add(taskId.trim());
    }
  }
  return taskIds;
}

export function featureLoopHistoryMigrationActions(
  taskState: TaskState,
  featureState: FeatureState,
): ProjectAppTaskAction[] {
  const resources = taskState.resources ?? {};
  const current = currentTaskIds(featureState);
  const parentIds = new Set(
    Object.values(resources)
      .map((resource) => resource.spec?.parentId)
      .filter((parentId): parentId is string => Boolean(parentId)),
  );
  return Object.entries(resources)
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([taskId, resource]): ProjectAppTaskAction[] => {
      const generation = resource.metadata?.generation;
      if (
        current.has(taskId) ||
        resource.spec?.parentId !== legacyGroupId ||
        resource.spec.mode !== "maintain" ||
        resource.status?.phase !== "converged" ||
        (resource.status.conditionIds ?? []).length > 0 ||
        parentIds.has(taskId) ||
        !Number.isInteger(generation)
      ) {
        return [];
      }
      return [
        {
          kind: "close-task",
          taskId,
          expectedGeneration: generation as number,
          summary:
            "Compacted stale completed feature holder; the standing feature loop owns future reconciliation.",
        },
      ];
    })
    .slice(0, 16);
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  if (!ctx.appDir) {
    throw new Error("unified-feature-loop-history-migration requires appDir");
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
  const actions = featureLoopHistoryMigrationActions(taskState, featureState);
  const summary = `Compacted ${actions.length} stale completed feature holders into receipts.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: ["migration:feature-loop-history-v1"],
    actions,
  });
}
