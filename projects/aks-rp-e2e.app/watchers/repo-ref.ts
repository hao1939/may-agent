import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { AksObserverContext, AksObserverEvent } from "./context.js";

type RepoRefWatcherState = {
  refs?: Record<string, string>;
  checkedAt?: string;
};

type RepoRefObservation = {
  repoRef: string;
  commit: string;
  previousCommit: string | null;
  changed: boolean;
};

const projectId = "aks-rp-e2e";
const watchedRepoRefs = ["origin/dev", "origin/main"] as const;

function readState(path: string): RepoRefWatcherState {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveState(path: string, state: RepoRefWatcherState): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function runGit(
  projectDir: string,
  args: string[],
): Promise<{
  status: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve) => {
    execFile(
      "git",
      args,
      {
        cwd: projectDir,
        encoding: "utf8",
        timeout: 30_000,
        maxBuffer: 8 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        resolve({
          status: typeof error?.code === "number" ? error.code : error ? 1 : 0,
          stdout: stdout ?? "",
          stderr: stderr || error?.message || "",
        });
      },
    );
  });
}

async function fetchRemoteRef(
  projectDir: string,
  repoRef: string,
): Promise<void> {
  const [remote, ...branchParts] = repoRef.split("/");
  const branch = branchParts.join("/");
  if (!remote || !branch) return;
  await runGit(projectDir, ["fetch", remote, branch]);
}

export async function observeRepoRef(
  projectDir: string,
  repoRef: string,
  previousCommit?: string,
): Promise<RepoRefObservation | null> {
  await fetchRemoteRef(projectDir, repoRef);
  const resolved = await runGit(projectDir, ["rev-parse", "--verify", repoRef]);
  if (resolved.status !== 0) return null;
  const commit = resolved.stdout.trim();
  if (!commit) return null;
  return {
    repoRef,
    commit,
    previousCommit: previousCommit?.trim() || null,
    changed: Boolean(
      previousCommit &&
      previousCommit.trim() &&
      previousCommit.trim() !== commit,
    ),
  };
}

export function repoRefChangedEvent(
  observation: RepoRefObservation,
): AksObserverEvent {
  return {
    type: "aks.repo-ref.changed",
    source: "aks-repo-ref-watcher",
    target: { project: projectId },
    data: {
      project: projectId,
      repoRef: observation.repoRef,
      commit: observation.commit,
      ...(observation.previousCommit
        ? { previousCommit: observation.previousCommit }
        : {}),
    },
  };
}

export function repoRefObservedEvent(
  observation: RepoRefObservation,
): AksObserverEvent {
  return {
    type: "aks.repo-ref.observed",
    source: "aks-repo-ref-watcher",
    target: { project: projectId },
    data: {
      project: projectId,
      repoRef: observation.repoRef,
      commit: observation.commit,
      changed: observation.changed,
      ...(observation.previousCommit
        ? { previousCommit: observation.previousCommit }
        : {}),
    },
  };
}

/** Observe remote-tracking repo refs as levels and separately report actual advances. */
export async function observeRepoRefChanges(
  ctx: AksObserverContext,
): Promise<unknown> {
  const statePath = ctx.appPath(".state/watchers/repo-ref.json");
  const state = readState(statePath);
  const projectDir = ctx.appPath("../aks-rp-e2e");
  const checkedAt = new Date().toISOString();
  const observations: Array<RepoRefObservation | null> = [];
  // Fetches update one shared remote-tracking namespace, so keep them ordered
  // while allowing each subprocess to yield the event loop.
  for (const repoRef of watchedRepoRefs) {
    observations.push(
      await observeRepoRef(projectDir, repoRef, state.refs?.[repoRef]),
    );
  }

  saveState(statePath, {
    refs: {
      ...(state.refs ?? {}),
      ...Object.fromEntries(
        observations
          .filter((value): value is RepoRefObservation => value !== null)
          .map((value) => [value.repoRef, value.commit]),
      ),
    },
    checkedAt,
  });

  for (const observation of observations) {
    if (!observation) continue;
    ctx.emit(repoRefObservedEvent(observation));
    if (observation.changed) ctx.emit(repoRefChangedEvent(observation));
  }

  return {
    observed: observations.filter(Boolean).length,
    refs: observations.map(
      (observation, index) =>
        observation ?? {
          repoRef: watchedRepoRefs[index],
          changed: false,
          reason: "unresolved",
        },
    ),
  };
}
