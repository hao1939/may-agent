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

export type TaskWorkspaceInput = {
  repoDir: string;
  workspaceRoot: string;
  taskId: string;
  generation: number;
  baseBranch: string;
  refreshRemote?: boolean;
  previous?: AppTaskWorkspace;
};
export type TaskWorkspaceAdmission =
  | { kind: "deferred"; constraint: TaskWorkspaceConstraint }
  | { kind: "ready" }
  /** Existing checkout transforms/sparse mode or unavailable source objects
   * prevent a safe byte estimate. Preserve ordinary preparation semantics. */
  | { kind: "unchecked" }
  /** No current observation: retain a previously known shortage and its date. */
  | { kind: "unavailable" };

/** Host-private worktree operations; core owns ordering and admission of their facts. */
export type TaskWorkspaces = {
  /** Read-only current-operation check before claiming. It never grants a
   * permit; prepare repeats the actual boundary check after admission. */
  admission?(input: TaskWorkspaceInput): Promise<TaskWorkspaceAdmission>;
  prepare(input: TaskWorkspaceInput): Promise<PreparedTaskWorkspace>;
  /** Inspect acceptance prerequisites without removing files, branches or refs. */
  inspect(prepared: PreparedTaskWorkspace): Promise<InspectedTaskWorkspace>;
  /** Preserve accepted local deliverables; integration requirements belong to App acceptance. */
  finalize(
    prepared: PreparedTaskWorkspace,
    outcome: "accepted" | "waiting" | "failed",
  ): Promise<FinalizedTaskWorkspace>;
};
