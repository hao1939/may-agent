import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { ProjectAppContext, ProjectAppEvent } from "@may-agent/sdk";

type Worktree = { path: string; prunable: boolean };

type WorkspaceIntegrityObservation = {
  checkedAt: string;
  fingerprint: string;
  canonical: {
    branch: string;
    head: string;
    expectedHead: string;
    clean: boolean;
    healthy: boolean;
  };
  counts: {
    worktrees: number;
    dirty: number;
    prunable: number;
    activeAttemptWorktrees: number;
    unownedDirty: number;
    workspaceBytes: number;
  };
  anomalies: Array<{ path: string; kind: string }>;
};

function git(cwd: string, args: string[]): { status: number; stdout: string } {
  const result = spawnSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    timeout: 60_000,
  });
  return { status: result.status ?? 1, stdout: result.stdout?.trim() ?? "" };
}

function worktrees(repoDir: string): Worktree[] {
  return git(repoDir, ["worktree", "list", "--porcelain"])
    .stdout.split(/\n\n+/)
    .flatMap((block) => {
      const lines = block.split("\n");
      const path = lines.find((line) => line.startsWith("worktree "))?.slice(9);
      return path
        ? [
            {
              path: resolve(path),
              prunable: lines.some((line) => line.startsWith("prunable")),
            },
          ]
        : [];
    });
}

function directoryBytes(path: string): number {
  const result = spawnSync("du", ["-sk", path], {
    encoding: "utf8",
    timeout: 60_000,
  });
  const kib = Number(result.stdout?.trim().split(/\s+/)[0]);
  return Number.isFinite(kib) ? kib * 1024 : 0;
}

export function observeWorkspaceIntegrity(
  appDir: string,
  repoDir: string,
): WorkspaceIntegrityObservation {
  const state = JSON.parse(
    readFileSync(resolve(appDir, ".state/tasks/state.json"), "utf8"),
  );
  const activePaths = new Set<string>(
    Object.values(state.attempts ?? {}).flatMap((value: unknown) => {
      const attempt = value as {
        state?: unknown;
        workspace?: { path?: unknown };
      };
      return attempt.state === "running" &&
        typeof attempt.workspace?.path === "string"
        ? [resolve(attempt.workspace.path)]
        : [];
    }),
  );
  const entries = worktrees(repoDir);
  const anomalies: WorkspaceIntegrityObservation["anomalies"] = [];
  let dirty = 0;
  let prunable = 0;
  let unownedDirty = 0;
  for (const entry of entries) {
    if (entry.prunable || !existsSync(entry.path)) {
      prunable += 1;
      anomalies.push({ path: entry.path, kind: "prunable" });
      continue;
    }
    if (
      git(entry.path, ["status", "--porcelain=v1", "--untracked-files=all"])
        .stdout
    ) {
      dirty += 1;
      if (!activePaths.has(entry.path)) {
        unownedDirty += 1;
        anomalies.push({ path: entry.path, kind: "unowned-dirty" });
      }
    }
  }
  const branch = git(repoDir, ["branch", "--show-current"]).stdout;
  const head = git(repoDir, ["rev-parse", "HEAD"]).stdout;
  const expectedHead = git(repoDir, ["rev-parse", "origin/dev"]).stdout;
  const clean = !git(repoDir, [
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
  ]).stdout;
  const canonical = {
    branch,
    head,
    expectedHead,
    clean,
    healthy: branch === "dev" && head === expectedHead && clean,
  };
  if (!canonical.healthy)
    anomalies.unshift({ path: resolve(repoDir), kind: "canonical-unhealthy" });
  const counts = {
    worktrees: entries.length,
    dirty,
    prunable,
    activeAttemptWorktrees: activePaths.size,
    unownedDirty,
    workspaceBytes: directoryBytes("/app/worktrees/aks-rp-e2e"),
  };
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        canonical,
        counts: { ...counts, workspaceBytes: undefined },
        anomalies,
      }),
    )
    .digest("hex");
  return {
    checkedAt: new Date().toISOString(),
    fingerprint,
    canonical,
    counts,
    anomalies,
  };
}

export function workspaceIntegrityChangedEvent(
  observation: WorkspaceIntegrityObservation,
): ProjectAppEvent {
  return {
    type: "aks.workspace.integrity.changed",
    source: "aks-workspace-integrity-watcher",
    target: { project: "aks-rp-e2e" },
    data: observation,
  };
}

export async function observeWorkspaceIntegrityChanges(
  ctx: ProjectAppContext,
): Promise<unknown> {
  const statePath = ctx.appPath(".state/watchers/workspace-integrity.json");
  const previous = existsSync(statePath)
    ? JSON.parse(readFileSync(statePath, "utf8"))
    : {};
  const observation = observeWorkspaceIntegrity(
    ctx.appPath("."),
    ctx.appPath("../aks-rp-e2e"),
  );
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(observation, null, 2)}\n`);
  const changed = previous.fingerprint !== observation.fingerprint;
  if (changed) ctx.emit(workspaceIntegrityChangedEvent(observation));
  return { changed, ...observation };
}
