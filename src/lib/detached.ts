/**
 * Detached sub-agent spawning.
 *
 * Launches a new may.ts process as a fully independent OS process
 * (detached, unref'd). The child survives the caller's restart.
 *
 * Design: agents/may/workspace/detached-subagent-design.md
 * Review: agents/bob/workspace/detached-subagent-review.md
 */

import { spawn } from "node:child_process";
import { openSync, closeSync, mkdirSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { getWorkerCommand } from "../app/bundle-mode.js";

export interface SpawnDetachedOpts {
  projectRoot: string;
  agentName: string;
  task: string;
  sessionId: string;
  parentSessionId?: string;
  parentAgentName?: string;
}

/** Shape of .state/instances/<name>/identity.json written by may.ts on startup. */
export interface InstanceIdentity {
  pid: number;
  agent: string;
  instance: string;
  socket: string;
  startedAt: string;
  startedBy: string;
  task: string | null;
  status: "running" | "done" | "error";
  exitCode?: number | null;
  endedAt?: string;
  duration?: string;
  sessionId?: string;
}

/**
 * Read the identity.json for a named instance.
 * Returns null if the file doesn't exist or can't be parsed.
 *
 * @param persistDir - The .state directory (e.g. /app/.state)
 * @param instanceName - Instance name (e.g. "job-s_1234_0")
 */
export function readIdentity(persistDir: string, instanceName: string): InstanceIdentity | null {
  const identityPath = resolve(persistDir, "instances", instanceName, "identity.json");
  try {
    return JSON.parse(readFileSync(identityPath, "utf-8")) as InstanceIdentity;
  } catch {
    return null;
  }
}

export function spawnDetachedAgent(opts: SpawnDetachedOpts): { pid: number | undefined } {
  const instanceName = `job-${opts.sessionId}`;

  // Bob's review: DO NOT use stdio:"ignore" — redirect to log file for debugging launch failures
  const logDir = join(opts.projectRoot, ".state/logs");
  mkdirSync(logDir, { recursive: true });
  const logFd = openSync(join(logDir, `detached-${opts.sessionId}.log`), "a");

  // Use getWorkerCommand for bundle-mode compatibility.
  const mayTsPath = resolve(opts.projectRoot, "src/app/may.ts");
  const workerArgs = ["--task", opts.task, "--socket"];
  const cmd = getWorkerCommand(workerArgs, mayTsPath);

  const proc = spawn(cmd.cmd, cmd.args, {
    cwd: opts.projectRoot,
    stdio: ["ignore", logFd, logFd],
    detached: true,
    env: {
      ...cmd.env,
      AGENT: opts.agentName,
      INSTANCE: instanceName,
      SESSION_ID: opts.sessionId,
      ...(opts.parentSessionId ? { PARENT_SESSION_ID: opts.parentSessionId } : {}),
      ...(opts.parentAgentName ? { PARENT_AGENT: opts.parentAgentName } : {}),
    },
  });
  proc.unref();
  closeSync(logFd);
  return { pid: proc.pid };
}
