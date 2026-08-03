import { readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  ProjectAppTaskAction,
  WorkflowContext,
  WorkflowResult,
} from "@may-agent/sdk";

export const name = "unified-task-tick-migration";
export const description =
  "Retire the fixed legacy compact holders that use task-tick Conditions as a scheduler.";

const taskTickHolderIds = new Set([
  "hold-compact-ccp-metricsserver-reviewed-exception-ha-frontier-3d7512da55-20260730",
  "hold-compact-rp-cluster-lifecycle-reviewed-frontier-21fa9b3201-20260729",
]);

type StateSnapshot = {
  resources?: Record<
    string,
    {
      metadata?: { generation?: number };
      spec?: { mode?: string; parentId?: string };
      status?: { phase?: string; conditionIds?: string[] };
    }
  >;
  conditions?: Record<string, { spec?: { type?: string } }>;
};

export function taskTickHolderCloseActions(
  state: StateSnapshot,
): ProjectAppTaskAction[] {
  const resources = state.resources ?? {};
  const conditions = state.conditions ?? {};
  const parentIdsWithLiveChildren = new Set(
    Object.values(resources)
      .map((resource) => resource.spec?.parentId)
      .filter((value): value is string => Boolean(value)),
  );

  return [...taskTickHolderIds]
    .sort()
    .flatMap((taskId): ProjectAppTaskAction[] => {
      const resource = resources[taskId];
      const generation = resource?.metadata?.generation;
      const hasTaskTickCondition = (resource?.status?.conditionIds ?? []).some(
        (conditionId) =>
          conditions[conditionId]?.spec?.type === "project.task.tick",
      );
      if (
        resource?.spec?.mode !== "maintain" ||
        resource?.status?.phase !== "waiting" ||
        !Number.isInteger(generation) ||
        !hasTaskTickCondition ||
        parentIdsWithLiveChildren.has(taskId)
      ) {
        return [];
      }
      return [
        {
          kind: "close-task",
          taskId,
          expectedGeneration: generation as number,
          summary:
            "Retired legacy compact holder; timer or semantic events wake the standing feature loop directly.",
        },
      ];
    });
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  if (!ctx.appDir) throw new Error("unified-task-tick-migration requires appDir");
  const state = JSON.parse(
    readFileSync(join(ctx.appDir, ".state", "tasks", "state.json"), "utf8"),
  ) as StateSnapshot;
  const actions = taskTickHolderCloseActions(state);
  const summary = `Retired ${actions.length} legacy task-tick compact holders.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: ["migration:task-tick-holders-v1"],
    actions,
  });
}
