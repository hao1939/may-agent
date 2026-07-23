import { readFileSync } from "node:fs";
import { join } from "node:path";
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

export const name = "legacy-branch-reconciliation-controller";
export const description =
  "Observe unattached legacy AKS branches and declare one verification-first integration task at a time.";
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
      "Declares at most one exact-branch verification task; it never mutates Git refs itself.",
  },
};

type GraphTask = {
  generation?: number;
  phase?: string;
  state?: string;
  summary?: string;
  input?: Record<string, unknown>;
};

type PersistedAttempt = {
  taskId?: string;
  handler?: string;
  summary?: string;
  failureReason?: string;
};

type PersistedTaskState = {
  attempts?: Record<string, PersistedAttempt>;
};

const retryableAttentionSummaries = new Set([
  "Legacy branch family base changed; retry from current origin/dev",
  // Compatibility for the two reviews that lost the initial three-writer race.
  "Legacy branch family closeout failed safely",
  // Compatibility for the app-monitoring review rejected by the removed
  // whole-commit patch-equivalence check.
  "Legacy branch family closeout requires owner review",
  "Legacy branch family closeout failed; owner review required",
  "Legacy branch base changed; retry verification against current origin/dev",
  "Legacy branch verification closeout failed safely",
  // Compatibility for attention created before branch verification learned to
  // repair conflicts and failed checks inside the same task.
  "Legacy branch merge conflict requires focused repair",
  "Legacy branch verification failed",
]);

function configuredFrontierLimit(raw: string, fallback: number): number {
  const match = raw.match(/^frontierLimit:\s*(.+)$/m);
  const configured = Number.parseInt(match?.[1]?.trim() ?? "", 10);
  return Math.max(1, Number.isFinite(configured) ? configured : fallback);
}

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

function readTaskState(appDir: string): PersistedTaskState {
  try {
    return JSON.parse(
      readFileSync(join(appDir, ".state", "tasks", "state.json"), "utf8"),
    ) as PersistedTaskState;
  } catch {
    return {};
  }
}

function taskAttemptsFor(
  taskId: string,
  persistedState: PersistedTaskState,
): PersistedAttempt[] {
  return Object.values(persistedState.attempts ?? {}).filter(
    (attempt) => attempt.taskId === taskId,
  );
}

function retryableAttentionTask(
  taskId: string,
  task: GraphTask,
  persistedState: PersistedTaskState,
): boolean {
  const summary = String(task.summary ?? "");
  if (retryableAttentionSummaries.has(summary)) return true;
  if (summary !== "Connection error.") return false;
  return taskAttemptsFor(taskId, persistedState).some(
    (attempt) =>
      attempt.handler === "workflow:legacy-branch-verification" &&
      attempt.failureReason === "needs-owner" &&
      String(attempt.summary ?? "").includes("owner judgment in the same task"),
  );
}

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  const projectDir = ctx.projectDir ?? "/app/projects/aks-rp-e2e";
  const appDir = ctx.appDir ?? "/app/projects/aks-rp-e2e.app";
  const rows = legacyBranchInventory(projectDir);
  const tasks = readTasks(appDir);
  const persistedState = readTaskState(appDir);
  const represented = Object.entries(tasks).filter(
    ([, task]) => task.input?.loopId === legacyBranchReconciliationTaskId,
  );
  const accounting = loopFrontierAccounting(
    represented.map(([taskId, task]) => ({
      taskId,
      phase: task.phase ?? task.state,
    })),
    Math.min(1, configuredFrontierLimit(ctx.task, 1)),
  );
  const representedBranches = new Set(
    represented.flatMap(([, task]) => {
      const branches = task.input?.branches;
      if (!Array.isArray(branches)) return [];
      return branches.flatMap((branch) => {
        if (!branch || typeof branch !== "object" || Array.isArray(branch))
          return [];
        const name = (branch as Record<string, unknown>).branch;
        return typeof name === "string" && name ? [name] : [];
      });
    }),
  );
  const byFamily = new Map<string, typeof rows>();
  const presentBranches = new Set(rows.map((row) => row.branch));
  for (const row of rows) {
    const familyRows = byFamily.get(row.family) ?? [];
    familyRows.push(row);
    byFamily.set(row.family, familyRows);
  }

  const retryActions: ProjectAppTaskAction[] = represented
    .filter(([taskId, task]) => {
      const workKey = String(task.input?.workKey ?? "");
      return (
        (task.phase ?? task.state) === "attention" &&
        retryableAttentionTask(taskId, task, persistedState) &&
        (byFamily.has(workKey) || presentBranches.has(workKey)) &&
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
      reason: "Retry the same branch verification against current origin/dev",
    }));
  const unresolvedAttention = represented.filter(
    ([, task]) =>
      (task.phase ?? task.state) === "attention" &&
      (byFamily.has(String(task.input?.workKey ?? "")) ||
        Array.isArray(task.input?.branches)),
  );
  const createBudget = unresolvedAttention.length
    ? 0
    : Math.max(0, accounting.available - retryActions.length);
  const createActions: ProjectAppTaskAction[] = rows
    .filter((row) => !representedBranches.has(row.branch))
    .sort(
      (left, right) =>
        left.family.localeCompare(right.family) ||
        left.branch.localeCompare(right.branch),
    )
    .slice(0, createBudget)
    .map((row) => {
      const revision = legacyBranchWorkRevision([row]);
      return {
        kind: "create-task",
        id: `ops/verify-legacy-branch-${safeLegacyBranchFamily(row.branch)}-${revision}`,
        parentId: "group/app-operations",
        outcome: `Apply ${row.branch} to current origin/dev, rerun its conventional verification, merge and remove it on pass, or retain it with exact conflict/failure evidence.`,
        mode: "achieve",
        owner: "aks-explorer",
        workflow: "legacy-branch-verification",
        input: {
          loopId: legacyBranchReconciliationTaskId,
          workKey: row.branch,
          workRevision: revision,
          baseRef: "origin/dev",
          branches: [
            {
              branch: row.branch,
              head: row.head,
              files: row.files,
            },
          ],
        },
        acceptance: [
          "Apply the exact source head to current origin/dev in the task-owned clean worktree.",
          "Run changed check-mode carriers/tests plus the repository scenario and runner guards without accepting new failures over the current base.",
          "A passing candidate reaches origin/dev by checked fast-forward and its local/remote source refs are removed.",
          "An already represented branch is removed without creating an empty merge.",
          "A conflict or verification failure keeps the source refs and records the exact failing command or conflict for focused repair.",
          "Do not touch attached or dirty recovery worktrees in this clean-branch task.",
        ],
        priority: "P0",
      };
    });
  const actions = [...retryActions, ...createActions];

  const summary = rows.length
    ? `Legacy branch reconciliation found ${rows.length} unattached branch(es) with patches outside origin/dev across ${byFamily.size} family/families; declared ${createActions.length} verification task(s), retried ${retryActions.length} transient attention task(s), and observed ${accounting.actionableTaskIds.length} already actionable.`
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
