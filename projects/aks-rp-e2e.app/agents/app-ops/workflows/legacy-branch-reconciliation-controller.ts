import { readFileSync } from "node:fs";
import {
  resolveTaskTreePath,
  workflowResultVersion,
  type ProjectAppTaskAction,
  type WorkflowContext,
  type WorkflowIoContract,
  type WorkflowResult,
} from "@may-agent/sdk";
import {
  legacyBranchReconciliationTaskId,
  loopFrontierAccounting,
} from "../../../task-loops.ts";
import {
  legacyBranchInventory,
  legacyBranchWorkRevision,
  safeLegacyBranchFamily,
} from "./lib/legacy-branch-inventory.ts";
import { frontierLimit } from "./lib/workflow-input.ts";

export const name = "legacy-branch-reconciliation-controller";
export const description =
  "Observe unattached legacy AKS branches and declare bounded integrate-or-reject family reviews.";
export const workflowContract: WorkflowIoContract = {
  workflow: name,
  version: "legacy-branch-reconciliation-controller-v1",
  input: {
    required: ["project.task.tick action=legacy-branch-reconciliation"],
    optional: ["frontierLimit"],
    description: "Reconcile the finite legacy branch migration frontier.",
  },
  output: {
    version: workflowResultVersion,
    fields: ["state", "summary", "evidence", "actions"],
    description:
      "Declares at most the available family-review frontier; it never mutates Git refs itself.",
  },
};

type GraphTask = {
  generation?: number;
  phase?: string;
  state?: string;
  summary?: string;
  input?: Record<string, unknown>;
};

const retryableAttentionSummaries = new Set([
  "Legacy branch family base changed; retry from current origin/dev",
  // Compatibility for the two reviews that lost the initial three-writer race.
  "Legacy branch family closeout failed safely",
]);

function readTasks(appDir: string): Record<string, GraphTask> {
  try {
    const graph = JSON.parse(
      readFileSync(resolveTaskTreePath(appDir), "utf8"),
    ) as {
      tasks?: Record<string, GraphTask>;
    };
    return graph.tasks ?? {};
  } catch {
    return {};
  }
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectDir = ctx.projectDir ?? "/app/projects/aks-rp-e2e";
  const appDir = ctx.appDir ?? "/app/projects/aks-rp-e2e.app";
  const rows = legacyBranchInventory(projectDir);
  const tasks = readTasks(appDir);
  const represented = Object.entries(tasks).filter(
    ([, task]) => task.input?.loopId === legacyBranchReconciliationTaskId,
  );
  const accounting = loopFrontierAccounting(
    represented.map(([taskId, task]) => ({
      taskId,
      phase: task.phase ?? task.state,
    })),
    Math.min(1, frontierLimit(ctx.task, 1)),
  );
  const representedFamilies = new Set(
    represented.map(([, task]) => String(task.input?.workKey ?? "")),
  );
  const byFamily = new Map<string, typeof rows>();
  for (const row of rows) {
    const familyRows = byFamily.get(row.family) ?? [];
    familyRows.push(row);
    byFamily.set(row.family, familyRows);
  }

  const retryActions: ProjectAppTaskAction[] = represented
    .filter(([, task]) => {
      const family = String(task.input?.workKey ?? "");
      return (
        (task.phase ?? task.state) === "attention" &&
        retryableAttentionSummaries.has(String(task.summary ?? "")) &&
        byFamily.has(family) &&
        Number.isInteger(task.generation) &&
        Number(task.generation) > 0
      );
    })
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, accounting.available)
    .map(([taskId, task]) => ({
      kind: "unblock-task" as const,
      taskId,
      expectedGeneration: Number(task.generation),
      reason: "Retry the same branch-family review against current origin/dev",
    }));
  const createActions: ProjectAppTaskAction[] = [...byFamily.entries()]
    .filter(([family]) => !representedFamilies.has(family))
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, Math.max(0, accounting.available - retryActions.length))
    .map(([family, familyRows]) => {
      const batch = familyRows
        .sort((left, right) => left.branch.localeCompare(right.branch))
        .slice(0, 8);
      const revision = legacyBranchWorkRevision(batch);
      return {
        kind: "create-task",
        id: `ops/reconcile-legacy-branch-${safeLegacyBranchFamily(family)}-${revision}`,
        parentId: "group/app-operations",
        outcome: `Review the bounded ${family} legacy branch family against current origin/dev; integrate the valuable final change or explicitly reject it, then remove every represented branch ref.`,
        mode: "achieve",
        owner: "aks-explorer",
        workflow: "legacy-branch-family-reconciliation",
        input: {
          loopId: legacyBranchReconciliationTaskId,
          workKey: family,
          workRevision: revision,
          baseRef: "origin/dev",
          branches: batch.map((row) => ({
            branch: row.branch,
            head: row.head,
            files: row.files,
          })),
        },
        acceptance: [
          "Review the actual patch content and current origin/dev; branch naming or remote storage is not a disposition.",
          "Collapse redo, repair, and publication variants into one current coherent result.",
          "Accepted changes are verified and reach origin/dev; rejected changes have a concrete evidence-backed reason.",
          "Every represented local and origin branch ref is removed only after the integrate-or-reject decision is durable.",
          "Do not touch attached or dirty recovery worktrees in this clean-branch task.",
        ],
        priority: "P0",
      };
    });
  const actions = [...retryActions, ...createActions];

  const summary = rows.length
    ? `Legacy branch reconciliation found ${rows.length} unattached branch(es) with patches outside origin/dev across ${byFamily.size} family/families; declared ${createActions.length} review task(s), retried ${retryActions.length} transient attention task(s), and observed ${accounting.actionableTaskIds.length} already actionable.`
    : "Legacy clean-branch reconciliation converged: no unattached local branch has a patch outside origin/dev. Attached recovery work remains a separate explicit review frontier.";
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: [
      `base-ref:origin/dev`,
      `unattached-novel-branches:${rows.length}`,
      `families:${byFamily.size}`,
    ],
    actions,
  });
}
