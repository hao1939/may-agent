import { readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  ProjectAppTaskAction,
  WorkflowContext,
  WorkflowResult,
} from "@may-agent/sdk";

export const name = "unified-feature-loop-residue-migration";
export const description =
  "Move remaining unfinished feature siblings under their executable standing loop.";

const featureLoopTaskId = "aks-feature-compact-loop";
const legacyGroupId = "group/feature-compact";

type Resource = {
  metadata?: { generation?: number };
  spec?: { mode?: string; parentId?: string };
  status?: { phase?: string };
};

type TaskState = {
  resources?: Record<string, Resource>;
};

export function featureLoopResidueMigrationActions(
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
        taskId === featureLoopTaskId ||
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
          parentId: featureLoopTaskId,
          ...(resource.spec.mode === "maintain"
            ? { mode: "achieve" as const }
            : {}),
        },
      ];
    });
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  if (!ctx.appDir) {
    throw new Error("unified-feature-loop-residue-migration requires appDir");
  }
  const taskState = JSON.parse(
    readFileSync(join(ctx.appDir, ".state", "tasks", "state.json"), "utf8"),
  ) as TaskState;
  const actions = featureLoopResidueMigrationActions(taskState);
  const summary = `Moved ${actions.length} remaining feature resources under the executable feature loop.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: ["migration:feature-loop-residue-v1"],
    actions,
  });
}
