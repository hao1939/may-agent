import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Session kind: chat (human-owned), job (fire-and-forget, auto-resumed), call (parent-owned). */
export type SessionKind = "chat" | "job" | "call";

/** Exact fenced App Task attempt shared by Runtime persistence projections. */
export interface TaskBinding {
  appId: string;
  taskId: string;
  generation: number;
  attemptId: string;
}

/** Durable setsid process groups currently owned by one exact session. */
export interface PersistedBashProcessGroups {
  pgids: number[];
}

export function sessionDir(persistDir: string, sessionId: string): string {
  return join(persistDir, "sessions", sessionId);
}

export function ensureSessionDir(persistDir: string, sessionId: string): void {
  mkdirSync(sessionDir(persistDir, sessionId), { recursive: true });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function bashProcessGroupsPath(persistDir: string, sessionId: string): string {
  return join(sessionDir(persistDir, sessionId), "bash-process-groups.json");
}

/**
 * Read durable setsid groups for an exact session. Legacy sessions have no
 * sidecar and intentionally dual-read as an empty set. Damaged evidence must
 * block cleanup rather than authorize releasing execution capacity.
 */
export function readSessionBashProcessGroups(persistDir: string, sessionId: string): number[] {
  if (!existsSync(bashProcessGroupsPath(persistDir, sessionId))) return [];
  try {
    const parsed: unknown = JSON.parse(readFileSync(bashProcessGroupsPath(persistDir, sessionId), "utf-8"));
    if (
      !isRecord(parsed) ||
      !Array.isArray(parsed.pgids) ||
      !parsed.pgids.every(
        (pgid: unknown): pgid is number => typeof pgid === "number" && Number.isSafeInteger(pgid) && pgid > 0,
      )
    ) {
      throw new Error("Expected a list of positive process-group IDs");
    }
    return [...new Set<number>(parsed.pgids)];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new Error(`Cannot read bash process-group evidence for session ${sessionId}`, { cause: error });
  }
}

function writeSessionBashProcessGroups(persistDir: string, sessionId: string, pgids: number[]): void {
  const normalized = [...new Set(pgids)].sort((a, b) => a - b);
  const filePath = bashProcessGroupsPath(persistDir, sessionId);
  if (normalized.length === 0) {
    try {
      rmSync(filePath);
    } catch {
      // Legacy or already-drained sessions may not have a sidecar.
    }
    return;
  }
  ensureSessionDir(persistDir, sessionId);
  const tmpPath = `${filePath}.tmp.${process.pid}`;
  writeFileSync(tmpPath, JSON.stringify({ pgids: normalized }, null, 2), "utf-8");
  renameSync(tmpPath, filePath);
}

export function addSessionBashProcessGroup(persistDir: string, sessionId: string, pgid: number): void {
  if (!Number.isInteger(pgid) || pgid <= 0) throw new Error(`Invalid bash process group: ${pgid}`);
  writeSessionBashProcessGroups(persistDir, sessionId, [...readSessionBashProcessGroups(persistDir, sessionId), pgid]);
}

/** Remove a group only after the caller has confirmed that the full group exited. */
export function removeSessionBashProcessGroup(persistDir: string, sessionId: string, pgid: number): void {
  writeSessionBashProcessGroups(
    persistDir,
    sessionId,
    readSessionBashProcessGroups(persistDir, sessionId).filter((candidate) => candidate !== pgid),
  );
}
