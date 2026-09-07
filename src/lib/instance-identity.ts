import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

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

export function createIdentityWriter(opts: {
  persistDir: string;
  instanceLabel: string;
}): (data: Partial<InstanceIdentity>) => void {
  const identityPath = resolve(opts.persistDir, "instances", opts.instanceLabel, "identity.json");
  return (data: Partial<InstanceIdentity>) => {
    const dir = resolve(opts.persistDir, "instances", opts.instanceLabel);
    mkdirSync(dir, { recursive: true });
    writeFileSync(identityPath, JSON.stringify(data, null, 2));
  };
}
