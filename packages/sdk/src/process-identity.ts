import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";

type ProcessIdentityGlobal = typeof globalThis & {
  __mayAgentProcessIdentity?: string;
};

export type ProcessInstance = {
  pid: number;
  processIdentity: string;
  processStartedAt?: number;
};

export type PersistedProcessInstance = {
  pid?: unknown;
  processIdentity?: unknown;
  processStartedAt?: unknown;
  recordedAt?: unknown;
};

const processIdentityGlobal = globalThis as ProcessIdentityGlobal;
const processIdentity = processIdentityGlobal.__mayAgentProcessIdentity ?? randomUUID();
processIdentityGlobal.__mayAgentProcessIdentity = processIdentity;

function processStartedAt(pid: number): number | undefined {
  try {
    const value = statSync(`/proc/${pid}`).ctimeMs;
    return Number.isFinite(value) && value > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

export function currentProcessInstance(): ProcessInstance {
  const startedAt = processStartedAt(process.pid);
  return {
    pid: process.pid,
    processIdentity,
    ...(startedAt === undefined ? {} : { processStartedAt: startedAt }),
  };
}

/**
 * Check a persisted process owner without trusting a reusable PID alone.
 * `recordedAt` lets Linux hosts reject legacy PID-only records written before
 * process-instance identity was available.
 */
export function isProcessInstanceAlive(record: PersistedProcessInstance): boolean {
  const pid = Number(record.pid);
  if (!Number.isInteger(pid) || pid <= 0) return false;

  const current = currentProcessInstance();
  if (pid === current.pid && typeof record.processIdentity === "string") {
    if (record.processIdentity !== current.processIdentity) return false;
  }
  try {
    process.kill(pid, 0);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
  }

  const liveStartedAt = processStartedAt(pid);
  const persistedStartedAt = Number(record.processStartedAt);
  if (
    liveStartedAt !== undefined &&
    Number.isFinite(persistedStartedAt) &&
    persistedStartedAt > 0 &&
    persistedStartedAt !== liveStartedAt
  ) {
    return false;
  }
  const recordedAt = typeof record.recordedAt === "string" ? Date.parse(record.recordedAt) : Number(record.recordedAt);
  if (liveStartedAt !== undefined && Number.isFinite(recordedAt) && recordedAt + 1_000 < liveStartedAt) {
    return false;
  }
  return true;
}
