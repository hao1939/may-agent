import { readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  ProjectAppTaskAction,
  WorkflowContext,
  WorkflowResult,
} from "@may-agent/sdk";
import { parseReconciliationTaskPayload } from "./lib/workflow-input.ts";

export const name = "unified-scenario-loop-ownership-migration";
export const description =
  "Move legacy scenario-normalization siblings under their executable standing loop.";

const scenarioLoopTaskId = "scenario-normalization";
const legacyGroupId = "group/scenario-normalization";

type Resource = {
  metadata?: { generation?: number };
  spec?: { mode?: string; parentId?: string };
  status?: { phase?: string };
};

type TaskState = { resources?: Record<string, Resource> };

export function scenarioLoopOwnershipMigrationActions(
  taskState: TaskState,
): ProjectAppTaskAction[] {
  const resources = taskState.resources ?? {};
  const parentIds = new Set(
    Object.values(resources)
      .map((resource) => resource.spec?.parentId)
      .filter((parentId): parentId is string => Boolean(parentId)),
  );
  return Object.entries(resources)
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([taskId, resource]): ProjectAppTaskAction[] => {
      const generation = resource.metadata?.generation;
      const unfinished = ["pending", "waiting"].includes(
        resource.status?.phase ?? "",
      );
      if (
        taskId === scenarioLoopTaskId ||
        resource.spec?.parentId !== legacyGroupId ||
        !["achieve", "maintain"].includes(resource.spec.mode ?? "") ||
        (!unfinished && !parentIds.has(taskId)) ||
        !Number.isInteger(generation)
      ) {
        return [];
      }
      return [
        {
          kind: "update-task",
          taskId,
          expectedGeneration: generation as number,
          parentId: scenarioLoopTaskId,
          ...(resource.spec.mode === "maintain"
            ? { mode: "achieve" as const }
            : {}),
        },
      ];
    })
    .slice(0, 16);
}

export function scenarioLoopOwnershipMigrationBatch(rawTask: string): number {
  const payload = parseReconciliationTaskPayload(rawTask);
  const input = payload?.input;
  const rawBatch =
    input && typeof input === "object"
      ? Number.parseInt(
          String((input as Record<string, unknown>).batch ?? "1"),
          10,
        )
      : 1;
  return Number.isInteger(rawBatch) && rawBatch > 0 ? rawBatch : 1;
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  if (!ctx.appDir) {
    throw new Error(
      "unified-scenario-loop-ownership-migration requires appDir",
    );
  }
  const taskState = JSON.parse(
    readFileSync(join(ctx.appDir, ".state", "tasks", "state.json"), "utf8"),
  ) as TaskState;
  const batch = scenarioLoopOwnershipMigrationBatch(ctx.task);
  const actions = scenarioLoopOwnershipMigrationActions(taskState);
  const summary = `Moved ${actions.length} scenario resources under the executable scenario loop in batch ${batch}.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: ["migration:scenario-loop-ownership-v1", `batch:${batch}`],
    actions,
  });
}
