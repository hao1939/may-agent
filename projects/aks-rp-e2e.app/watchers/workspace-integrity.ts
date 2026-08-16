import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { AksObserverContext, AksObserverEvent } from "./context.js";

type Worktree = { path: string; branch?: string; prunable: boolean };

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
    taskWorktrees: number;
    unownedDirty: number;
    workspaceBytes: number;
  };
  anomalies: Array<{ path: string; kind: string }>;
};

function command(
  executable: string,
  args: string[],
): Promise<{ status: number; stdout: string }> {
  return new Promise((resolve) => {
    execFile(
      executable,
      args,
      {
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
        timeout: 60_000,
      },
      (error, stdout) => {
        resolve({
          status: typeof error?.code === "number" ? error.code : error ? 1 : 0,
          stdout: stdout?.trim() ?? "",
        });
      },
    );
  });
}

function git(cwd: string, args: string[]) {
  return command("git", ["-C", cwd, ...args]);
}

async function worktrees(repoDir: string): Promise<Worktree[]> {
  return (await git(repoDir, ["worktree", "list", "--porcelain"])).stdout
    .split(/\n\n+/)
    .flatMap((block) => {
      const lines = block.split("\n");
      const path = lines.find((line) => line.startsWith("worktree "))?.slice(9);
      const branch = lines.find((line) => line.startsWith("branch "))?.slice(7);
      return path
        ? [
            {
              path: resolve(path),
              ...(branch ? { branch } : {}),
              prunable: lines.some((line) => line.startsWith("prunable")),
            },
          ]
        : [];
    });
}

async function directoryBytes(path: string): Promise<number> {
  const result = await command("du", ["-sk", path]);
  const kib = Number(result.stdout.split(/\s+/)[0]);
  return Number.isFinite(kib) ? kib * 1024 : 0;
}

function normalizePath(path: string): string {
  return resolve(path).replace(/\/+$/, "");
}

const LIVE_TASK_PHASES = new Set([
  "pending",
  "running",
  "waiting",
  "attention",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function liveWorkspaceClaims(taskProjectionPath?: string): Set<string> {
  if (!taskProjectionPath || !existsSync(taskProjectionPath)) return new Set();
  try {
    const projection: unknown = JSON.parse(
      readFileSync(taskProjectionPath, "utf8"),
    );
    if (!isRecord(projection) || !isRecord(projection.tasks)) return new Set();
    const claims = new Set<string>();
    for (const task of Object.values(projection.tasks)) {
      if (!isRecord(task) || !LIVE_TASK_PHASES.has(String(task.phase)))
        continue;
      const input = isRecord(task.input) ? task.input : undefined;
      if (
        typeof input?.workspacePath !== "string" ||
        !input.workspacePath.trim()
      )
        continue;
      claims.add(normalizePath(input.workspacePath));
    }
    return claims;
  } catch {
    // The projection is atomically replaced, but fail open to anomaly reporting
    // if a missing, stale, or malformed read is ever observed.
    return new Set();
  }
}

export async function observeWorkspaceIntegrity(
  repoDir: string,
  taskProjectionPath?: string,
): Promise<WorkspaceIntegrityObservation> {
  const entries = await worktrees(repoDir);
  const taskPaths = new Set([
    ...liveWorkspaceClaims(taskProjectionPath),
    ...entries
      .filter(({ branch }) => branch?.startsWith("refs/heads/task/"))
      .map(({ path }) => normalizePath(path)),
  ]);
  const anomalies: WorkspaceIntegrityObservation["anomalies"] = [];
  let dirty = 0;
  let prunable = 0;
  let unownedDirty = 0;
  const entryStatuses = await Promise.all(
    entries.map(async (entry) => ({
      entry,
      status:
        entry.prunable || !existsSync(entry.path)
          ? ""
          : (
              await git(entry.path, [
                "status",
                "--porcelain=v1",
                "--untracked-files=all",
              ])
            ).stdout,
    })),
  );
  for (const { entry, status } of entryStatuses) {
    if (entry.prunable || !existsSync(entry.path)) {
      prunable += 1;
      anomalies.push({ path: entry.path, kind: "prunable" });
      continue;
    }
    if (status) {
      dirty += 1;
      const normalizedEntryPath = normalizePath(entry.path);
      if (!taskPaths.has(normalizedEntryPath)) {
        unownedDirty += 1;
        anomalies.push({ path: entry.path, kind: "unowned-dirty" });
      }
    }
  }
  const [branchResult, headResult, expectedHeadResult, statusResult, bytes] =
    await Promise.all([
      git(repoDir, ["branch", "--show-current"]),
      git(repoDir, ["rev-parse", "HEAD"]),
      git(repoDir, ["rev-parse", "origin/dev"]),
      git(repoDir, ["status", "--porcelain=v1", "--untracked-files=all"]),
      directoryBytes("/app/worktrees/aks-rp-e2e"),
    ]);
  const branch = branchResult.stdout;
  const head = headResult.stdout;
  const expectedHead = expectedHeadResult.stdout;
  const clean = !statusResult.stdout;
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
    taskWorktrees: taskPaths.size,
    unownedDirty,
    workspaceBytes: bytes,
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
): AksObserverEvent {
  return {
    type: "aks.workspace.integrity.changed",
    source: "aks-workspace-integrity-watcher",
    target: { project: "aks-rp-e2e" },
    data: observation,
  };
}

export async function observeWorkspaceIntegrityChanges(
  ctx: AksObserverContext,
): Promise<unknown> {
  const statePath = ctx.appPath(".state/watchers/workspace-integrity.json");
  const previous = existsSync(statePath)
    ? JSON.parse(readFileSync(statePath, "utf8"))
    : {};
  const observation = await observeWorkspaceIntegrity(
    ctx.appPath("../aks-rp-e2e"),
    ctx.appPath(".state/tasks/tree.json"),
  );
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(observation, null, 2)}\n`);
  const changed = previous.fingerprint !== observation.fingerprint;
  if (changed) ctx.record(workspaceIntegrityChangedEvent(observation));
  return { changed, ...observation };
}
