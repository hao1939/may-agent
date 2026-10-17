import type { SubagentManager } from "./manager.js";
import { readActiveSessionProcessId, readSessionMetaRecoveryEvidence, type PersistedSession, type TaskBinding } from "./persistence.js";
import { drainPersistedSessionBashProcessGroups } from "./tools/bash.js";

type SessionCleanupOptions = {
  manager: Pick<SubagentManager, "hasActiveSession">;
  persistDir: string;
  drainPersistedBashProcessGroups?: typeof drainPersistedSessionBashProcessGroups;
};

/** Admit cleanup before cancellation, descendant drain, or persistence writes. */
export function readSessionCleanupMeta(
  persistDir: string,
  sessionId: string,
  retainedAttempt?: TaskBinding & { sessionId: string },
): PersistedSession | null {
  const evidence = readSessionMetaRecoveryEvidence(persistDir, sessionId);
  const fields = evidence.state === "absent" ? undefined : evidence.meta;
  const copied = fields?.taskBinding;
  if (retainedAttempt && copied && typeof copied === "object" && !Array.isArray(copied)) {
    const { sessionId: _ownerSessionId, ...binding } = retainedAttempt;
    if (Object.entries(binding).some(
      ([key, value]) => (copied as Record<string, unknown>)[key] !== undefined &&
        (copied as Record<string, unknown>)[key] !== value,
    )) {
      throw new Error(`Cannot recover session ${sessionId}: session Task binding does not match the retained attempt`);
    }
  }
  if (evidence.state === "valid") return evidence.meta;
  // Missing history is recoverable for the exact Task execution, but a copied
  // helper scope cannot substitute for the helper's own execution evidence.
  if (retainedAttempt?.sessionId === sessionId) return null;
  throw new Error(`Cannot recover session ${sessionId}: no retained Task binding and no valid session metadata`);
}

/** Execution ownership is independent of whether its history is readable or terminal. */
export function hasLiveSessionExecution(opts: SessionCleanupOptions, sessionId: string): boolean {
  if (opts.manager.hasActiveSession(sessionId)) return true;
  if (readActiveSessionProcessId(opts.persistDir, sessionId) !== null) return true;
  const evidence = readSessionMetaRecoveryEvidence(opts.persistDir, sessionId);
  const meta = evidence.state === "absent" ? undefined : evidence.meta;
  // Older detached workers may have only their metadata PID. Preserve that
  // evidence too; unrelated damage cannot establish that the worker stopped.
  if (meta?.detached !== true || typeof meta.pid !== "number" || !Number.isSafeInteger(meta.pid) || meta.pid < 1)
    return false;
  try {
    process.kill(meta.pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

/**
 * Shared prerequisite for startup and Task recovery. Callers retain execution
 * markers, results and claims until this returns. Cancellation is a separate
 * request; this operation only confirms exit and drains retained descendants.
 */
export function confirmSessionExecutionStopped(
  opts: SessionCleanupOptions,
  sessionId: string,
  retainedAttempt?: TaskBinding & { sessionId: string },
): PersistedSession | null {
  const meta = readSessionCleanupMeta(opts.persistDir, sessionId, retainedAttempt);
  if (hasLiveSessionExecution(opts, sessionId))
    throw new Error(`Cannot supersede session ${sessionId}: its external owner is still live`);
  if (!(opts.drainPersistedBashProcessGroups ?? drainPersistedSessionBashProcessGroups)(opts.persistDir, sessionId)) {
    throw new Error(
      `Cannot recover session ${sessionId}: one or more durable bash process groups did not exit after bounded SIGTERM/SIGKILL drain`,
    );
  }
  return meta;
}
