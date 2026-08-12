import { existsSync, realpathSync } from "node:fs";

export type WriteDispatchPaths = {
  workspaceDir?: string | null;
  projectDir: string;
  cwd: string;
};

/** Refuse write-capable agent execution in the shared canonical checkout. */
export function assertIsolatedWriteDispatch(input: WriteDispatchPaths): void {
  if (!input.workspaceDir || !existsSync(input.workspaceDir)) {
    throw new Error(
      `Write-producing agent dispatch requires an existing task workspace: ${input.workspaceDir ?? "missing"}`,
    );
  }

  const workspace = realpathSync(input.workspaceDir);
  const project = realpathSync(input.projectDir);
  const cwd = realpathSync(input.cwd);
  if (workspace === project) {
    throw new Error(
      `Write-producing agent dispatch refused canonical workspace ${workspace}`,
    );
  }
  if (cwd === project) {
    throw new Error(
      `Write-producing agent dispatch refused canonical execution cwd ${cwd}`,
    );
  }
}
