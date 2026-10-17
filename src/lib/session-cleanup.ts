import type { SubagentManager } from "./manager.js";
import { readSessionProcessOwner, readSessionMetaRecoveryEvidence, type PersistedSession, type TaskBinding } from "./persistence.js";
import { isProcessInstanceAlive } from "./process-identity.js";
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
  const owner = readSessionProcessOwner(opts.persistDir, sessionId);
  if (owner && isProcessInstanceAlive(owner)) return true;
  const evidence = readSessionMetaRecoveryEvidence(opts.persistDir, sessionId);
  const meta = evidence.state === "absent" ? undefined : evidence.meta;
  if (meta?.detached !== true || typeof meta.pid !== "number" || !Number.isSafeInteger(meta.pid) || meta.pid < 1)
    return false;
  // A rejected instance cannot become live again through its reusable PID.
  // A different detached PID remains independent evidence of execution.
  if (owner?.pid === meta.pid) return false;
  // Legacy workers may have no marker. Use the existing process-instance check
  // with their start time, including after startup removes an exited marker.
  return isProcessInstanceAlive({
    pid: meta.pid,
    ...(typeof meta.startedAt === "number" && Number.isFinite(meta.startedAt) ? { recordedAt: meta.startedAt } : {}),
  });
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
