import {
  type ExecutionResult,
  type TaskAction,
  type TaskReconcileResult,
  type WorkflowContext,
} from "@may-agent/sdk";
import { legacyBranchReconciliationTaskId } from "../../../task-loops.ts";
import {
  legacyBranchInventory,
  legacyBranchWorkRevision,
  safeLegacyBranchFamily,
  type LegacyBranchInventoryRow,
} from "./lib/legacy-branch-inventory.ts";

export const name = "legacy-branch-reconciliation-controller";
export const description =
  "Observe unattached legacy AKS branches and declare one verification-first child at a time.";

const verificationOwner = "aks-explorer";
const verificationWorkflow = "legacy-branch-verification";

const retryableAttentionSummaries = new Set([
  "Legacy branch family base changed; retry from current origin/dev",
  "Legacy branch family closeout failed safely",
  "Legacy branch family closeout requires owner review",
  "Legacy branch family closeout failed; owner review required",
  "Legacy branch base changed; retry verification against current origin/dev",
  "Legacy branch verification closeout failed safely",
  "Legacy branch merge conflict requires focused repair",
  "Legacy branch verification failed",
  "Handler result was rejected: evidence exceeds the 32-entry limit",
  "Connection error.",
  'Workflow "legacy-branch-verification" not found.',
  "Owner convergence was rejected because workflow legacy-branch-verification handed off without a verifier",
]);

export function retryableAttentionSummary(summary: string): boolean {
  if (retryableAttentionSummaries.has(summary)) return true;
  if (summary.startsWith("Legacy branch convergence rejected:")) return true;
  if (
    summary.startsWith("Recorded source ") &&
    summary.includes("requires owner judgment")
  ) {
    return true;
  }
  if (!summary.startsWith("Task workspace preparation failed:")) return false;
  return /\b(429|503)\b|connection|temporar|timed?\s*out|could not resolve|tls/i.test(
    summary,
  );
}

function verificationTaskId(row: LegacyBranchInventoryRow): string {
  const revision = legacyBranchWorkRevision([row]);
  return `ops/verify-legacy-branch-${safeLegacyBranchFamily(row.branch)}-${revision}`;
}

function createVerificationTask(
  parentId: string,
  row: LegacyBranchInventoryRow,
): Extract<TaskAction, { kind: "create-task" }> {
  const revision = legacyBranchWorkRevision([row]);
  return {
    kind: "create-task",
    id: verificationTaskId(row),
    parentId,
    outcome: `Apply ${row.branch} to current origin/dev, rerun its conventional verification, merge and remove it on pass, or retain it with exact conflict/failure evidence.`,
    mode: "achieve",
    outputs: row.files,
    agent: verificationOwner,
    workflow: verificationWorkflow,
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
      "A superseded or terminally rejected branch is complete only after its local and remote source refs are removed; if the refs must be retained, keep the task waiting on an exact blocker instead of converging it.",
      "A conflict or verification failure keeps the source refs and records the exact failing command or conflict for focused repair.",
      "Do not touch attached or dirty recovery worktrees in this clean-branch task.",
    ],
    priority: "P0",
    category: "ops",
  };
}

export async function execute(
  ctx: WorkflowContext,
): Promise<ExecutionResult<TaskReconcileResult> | ExecutionResult> {
  const reconciliation = ctx.reconciliation;
  const projectDir = ctx.workspace?.projectRoot;
  if (!reconciliation || !projectDir) {
    return ctx.blocked(
      "Legacy branch reconciliation requires a durable task and project workspace",
      {
        hasReconciliation: Boolean(reconciliation),
        projectDir,
      },
    );
  }

  const rows = legacyBranchInventory(projectDir).sort(
    (left, right) =>
      left.family.localeCompare(right.family) ||
      left.branch.localeCompare(right.branch),
  );
  // Direct-child ownership is the controller's bounded authority. Completed
  // child receipts intentionally omit workflow implementation details.
  const live = reconciliation.children.live;
  const completed = reconciliation.children.completed;
  const representedIds = new Set(
    [...live, ...completed].map((child) => child.taskId),
  );
  const misrouted = live
    .filter(
      (child) =>
        child.status !== "running" &&
        (child.agent !== verificationOwner ||
          child.workflow !== verificationWorkflow),
    )
    .sort((left, right) => left.taskId.localeCompare(right.taskId))[0];
  const retryable = live
    .filter(
      (child) =>
        child.status === "attention" &&
        retryableAttentionSummary(child.summary ?? ""),
    )
    .sort((left, right) => left.taskId.localeCompare(right.taskId))[0];

  if (misrouted) {
    const action: TaskAction = {
      kind: "update-task",
      taskId: misrouted.taskId,
      expectedGeneration: misrouted.generation,
      agent: verificationOwner,
      workflow: verificationWorkflow,
    };
    const summary = `Restoring ${misrouted.taskId} to the ${verificationOwner}-owned ${verificationWorkflow} route before reconciliation.`;
    return ctx.done(summary, {
      state: "waiting",
      summary,
      evidence: [
        `repair-child-route:${misrouted.taskId}@${misrouted.generation}`,
        `previous-agent:${misrouted.agent || "missing"}`,
        `previous-workflow:${misrouted.workflow || "missing"}`,
        `child-state:${misrouted.status}`,
      ],
      actions: [action],
    });
  }

  if (retryable) {
    const action: TaskAction = {
      kind: "unblock-task",
      taskId: retryable.taskId,
      expectedGeneration: retryable.generation,
      reason: "Retry the same branch verification against current origin/dev",
    };
    const summary = `Retrying ${retryable.taskId} from bounded child state; no global task-store scan is required.`;
    return ctx.done(summary, {
      state: "waiting",
      summary,
      evidence: [
        `retry-child:${retryable.taskId}@${retryable.generation}`,
        `retry-summary:${retryable.summary ?? "missing"}`,
      ],
      actions: [action],
    });
  }

  if (live.length > 0) {
    const summary = `Legacy branch reconciliation is waiting for ${live.length} bounded verification child task(s).`;
    return ctx.done(summary, {
      state: "waiting",
      summary,
      evidence: live.map(
        (child) => `child:${child.taskId}@${child.generation}:${child.status}`,
      ),
      actions: [],
    });
  }

  const staleCompleted = rows.find((row) =>
    representedIds.has(verificationTaskId(row)),
  );
  if (staleCompleted) {
    const taskId = verificationTaskId(staleCompleted);
    const summary = `Completed verification child ${taskId} still has source branch ${staleCompleted.branch}; completion and Git inventory disagree.`;
    return ctx.done(summary, {
      state: "needs-agent",
      summary,
      evidence: [
        `completed-child:${taskId}`,
        `remaining-branch:${staleCompleted.branch}@${staleCompleted.head}`,
      ],
    });
  }

  const next = rows.find((row) => !representedIds.has(verificationTaskId(row)));
  if (next) {
    const action = createVerificationTask(reconciliation.taskId, next);
    const summary = `Legacy branch reconciliation found ${rows.length} unattached branch(es); declared ${action.id} for ${next.branch}@${next.head}.`;
    return ctx.done(summary, {
      state: "waiting",
      summary,
      evidence: [
        "base-ref:origin/dev",
        `unattached-novel-branches:${rows.length}`,
        `declared-child:${action.id}`,
        `source:${next.branch}@${next.head}`,
      ],
      actions: [action],
    });
  }

  const summary =
    "Legacy clean-branch reconciliation converged: no unattached local branch has a patch outside origin/dev. Attached recovery work remains a separate explicit review frontier.";
  return ctx.done(summary, {
    state: "converged",
    summary,
    evidence: ["base-ref:origin/dev", "unattached-novel-branches:0"],
    actions: [],
  });
}
