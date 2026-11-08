import type { AppTaskWorkspace } from "./app-task-state.js";

/** Observed prerequisite for one exact checkout, never a filesystem permit or
 * a declaration about unrelated operations on the same Host. */
export type TaskWorkspaceConstraint = {
  resource: "workspace";
  reason: "workspace-capacity";
  generation: number;
  repoDir: string;
  destinationPath: string;
  commit: string;
  requiredBytes: number;
  availableBytes: number;
  observedAt: number;
  retryAt: number;
};

export class TaskWorkspaceDeferredError extends Error {
  constructor(readonly constraint: TaskWorkspaceConstraint) {
    super(`Insufficient worktree capacity for ${constraint.repoDir}: ${constraint.availableBytes} bytes available, ${constraint.requiredBytes} bytes required for ${constraint.commit}`);
    this.name = "TaskWorkspaceDeferredError";
  }
}

export type PreparedTaskWorkspace = {
  repoDir: string;
  metadata: AppTaskWorkspace;
};

export type FinalizedTaskWorkspace = {
  ok: boolean;
  metadata: AppTaskWorkspace;
  reason?: string;
};

export type InspectedTaskWorkspace = FinalizedTaskWorkspace & { removable: boolean };

/** Host-private worktree operations; core owns ordering and admission of their facts. */
export type TaskWorkspaces = {
  /** Read-only recheck of a retained exact-operation constraint. Missing or
   * failed observation stays unknown; prepare still fences the actual checkout. */
  sampleCapacity?(constraint: TaskWorkspaceConstraint): Promise<{ availableBytes: number; observedAt: number }>;
  prepare(input: {
    repoDir: string;
    workspaceRoot: string;
    taskId: string;
    generation: number;
    baseBranch: string;
    refreshRemote?: boolean;
    previous?: AppTaskWorkspace;
  }): Promise<PreparedTaskWorkspace>;
  /** Inspect acceptance prerequisites without removing files, branches or refs. */
  inspect(prepared: PreparedTaskWorkspace): Promise<InspectedTaskWorkspace>;
  /** Preserve accepted local deliverables; integration requirements belong to App acceptance. */
  finalize(
    prepared: PreparedTaskWorkspace,
    outcome: "accepted" | "waiting" | "failed",
  ): Promise<FinalizedTaskWorkspace>;
};
