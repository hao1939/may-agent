import { readFileSync } from "node:fs";
import { join } from "node:path";

import type {
  ProjectAppTaskAction,
  WorkflowContext,
  WorkflowResult,
} from "@may-agent/sdk";

export const name = "unified-finite-holder-migration";
export const description =
  "Compact converged hold/wait history and make live finite holders achieve resources.";

const maxActions = 16;
const finiteHolderPattern = /(^|\/)(hold|wait)-/;

type Resource = {
  metadata?: { generation?: number };
  spec?: { mode?: string; parentId?: string };
  status?: { phase?: string; conditionIds?: string[] };
};

type TaskState = {
  resources?: Record<string, Resource>;
};

export function finiteHolderMigrationActions(
  state: TaskState,
): ProjectAppTaskAction[] {
  const resources = state.resources ?? {};
  const liveParents = new Set(
    Object.values(resources)
      .map((resource) => resource.spec?.parentId)
      .filter((value): value is string => Boolean(value)),
  );

  return Object.entries(resources)
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([taskId, resource]): ProjectAppTaskAction[] => {
      const generation = resource.metadata?.generation;
      const phase = resource.status?.phase;
      if (
        taskId.startsWith("runtime/") ||
        !finiteHolderPattern.test(taskId) ||
        resource.spec?.mode !== "maintain" ||
        !Number.isInteger(generation)
      ) {
        return [];
      }

      if (
        phase === "converged" &&
        !liveParents.has(taskId) &&
        (resource.status?.conditionIds ?? []).length === 0
      ) {
        return [
          {
            kind: "close-task",
            taskId,
            expectedGeneration: generation as number,
            summary:
              "Compacted finite converged hold/wait history; Git, journal, and the task receipt retain the audit trail.",
          },
        ];
      }

      if (phase === "pending" || phase === "waiting") {
        return [
          {
            kind: "update-task",
            taskId,
            expectedGeneration: generation as number,
            mode: "achieve",
          },
        ];
      }

      return [];
    })
    .slice(0, maxActions);
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  if (!ctx.appDir) {
    throw new Error("unified-finite-holder-migration requires appDir");
  }
  const state = JSON.parse(
    readFileSync(join(ctx.appDir, ".state", "tasks", "state.json"), "utf8"),
  ) as TaskState;
  const actions = finiteHolderMigrationActions(state);
  const closed = actions.filter(
    (action) => action.kind === "close-task",
  ).length;
  const reclassified = actions.length - closed;
  const summary = `Migrated ${actions.length} finite holders: ${closed} compacted and ${reclassified} changed to achieve.`;
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: [
      `finite-holder-actions:${actions.length}`,
      `finite-holder-closed:${closed}`,
      `finite-holder-reclassified:${reclassified}`,
    ],
    actions,
  });
}
