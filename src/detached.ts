/**
 * Detached sub-agent spawning.
 *
 * Launches a new may.ts process as a fully independent OS process
 * (detached, unref'd). The child survives the caller's restart.
 *
 * Design: agents/shared/detached-subagent-design.md
 * Review: agents/bob/workspace/detached-subagent-review-v3.md
 */

import { spawn } from "node:child_process";
import { openSync, closeSync, mkdirSync } from "node:fs";
import { resolve, join } from "node:path";

export interface SpawnDetachedOpts {
  projectRoot: string;
  agentName: string;
  task: string;
  sessionId: string;
  parentSessionId?: string;
  parentAgentName?: string;
}

export function spawnDetachedAgent(opts: SpawnDetachedOpts): { pid: number | undefined } {
  const instanceName = `job-${opts.sessionId}`;

  // Bob's review: DO NOT use stdio:"ignore" — redirect to log file for debugging launch failures
  const logDir = join(opts.projectRoot, ".state/logs");
  mkdirSync(logDir, { recursive: true });
  const logFd = openSync(join(logDir, `detached-${opts.sessionId}.log`), "a");

  // Filter out --inspect flags to avoid port conflicts with child processes
  const execArgv = process.execArgv.filter((a) => !a.startsWith("--inspect"));

  const proc = spawn(
    process.execPath,
    [...execArgv, resolve(opts.projectRoot, "run/may.ts"), "--task", opts.task, "--socket"],
    {
      cwd: opts.projectRoot,
      stdio: ["ignore", logFd, logFd],
      detached: true,
      env: {
        ...process.env,
        AGENT: opts.agentName,
        INSTANCE: instanceName,
        SESSION_ID: opts.sessionId,
        ...(opts.parentSessionId ? { PARENT_SESSION_ID: opts.parentSessionId } : {}),
        ...(opts.parentAgentName ? { PARENT_AGENT: opts.parentAgentName } : {}),
      },
    },
  );
  proc.unref();
  closeSync(logFd);
  return { pid: proc.pid };
}
