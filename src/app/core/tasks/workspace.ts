import type { AppTaskWorkspace } from "../../app-task-state.js";

export type PreparedTaskWorkspace = {
  repoDir: string;
  metadata: AppTaskWorkspace;
};

export type FinalizedTaskWorkspace = {
  ok: boolean;
  metadata: AppTaskWorkspace;
  reason?: string;
};

/** Host-private worktree operations; core owns ordering and admission of their evidence. */
export type TaskWorkspaces = {
  prepare(input: {
    repoDir: string;
    workspaceRoot: string;
    taskId: string;
    generation: number;
    baseBranch: string;
    refreshRemote?: boolean;
    previous?: AppTaskWorkspace;
  }): Promise<PreparedTaskWorkspace>;
  finalize(
    prepared: PreparedTaskWorkspace,
    outcome: "accepted" | "waiting" | "failed",
  ): Promise<FinalizedTaskWorkspace>;
};
