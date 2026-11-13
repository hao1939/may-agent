import { existsSync } from "node:fs";
import { join } from "node:path";
import type { SubagentManager } from "../../../lib/index.js";
import { getDb } from "../../../lib/db/connection.js";
import { readSessionLastActivityAt, updateSessionDb } from "../../../lib/db/sessions.js";
import {
  markSessionInactive,
  readSessionMeta,
  writeSessionMeta,
  sessionDir,
  type TaskBinding,
} from "../../../lib/persistence.js";
import type { drainPersistedSessionBashProcessGroups } from "../../../lib/tools/bash.js";
import { confirmSessionExecutionStopped, hasLiveSessionExecution, readSessionCleanupMeta } from "../../../lib/session-cleanup.js";
import { writeSessionResult } from "../../../lib/artifacts.js";
import type { AgentEvent, EventBus } from "../../core/events/bus.js";
import { appTaskSessionBinding } from "../../core/tasks/session-binding.js";
import type { TaskSessionRecovery } from "../../core/tasks/execution.js";

type TaskSessionAdapterOptions = {
  manager: SubagentManager;
  persistDir?: string;
  bus: EventBus;
  drainPersistedBashProcessGroups?: typeof drainPersistedSessionBashProcessGroups;
};

export function createTaskSessionRecovery(opts: TaskSessionAdapterOptions): TaskSessionRecovery {
  return {
    read: (id) => (opts.persistDir ? readSessionMeta(opts.persistDir, id) : null),
    isLive: (id) => hasLiveAppTaskSession(opts, id),
    lastActivityAt: (id) => (opts.persistDir ? readSessionLastActivityAt(opts.persistDir, id) : null),
    interrupt: (id, reason, taskId, expectedBinding) =>
      interruptSupersededAgentSession(opts, id, reason, taskId, expectedBinding),
    workflowInterrupted: (id) => workflowWasInterruptedByRestart(opts.persistDir, id),
  };
}

function workflowWasInterruptedByRestart(persistDir: string | undefined, workflowRunId: string | null): boolean {
  if (!persistDir || !workflowRunId) return false;
  const row = getDb(persistDir)
    .prepare("SELECT status, result_reason FROM workflow_runs WHERE runId = ?")
    .get(workflowRunId) as { status?: unknown; result_reason?: unknown } | undefined;
  return row?.status === "interrupted" && row.result_reason === "Process restarted";
}

function hasLiveAppTaskSession(opts: TaskSessionAdapterOptions, sessionId: string): boolean {
  const cleanSessionId = sessionId.trim();
  if (!cleanSessionId) return false;
  if (!opts.persistDir) return opts.manager.hasActiveSession(cleanSessionId);
  return hasLiveSessionExecution({ ...opts, persistDir: opts.persistDir }, cleanSessionId);
}

function interruptSupersededAgentSession(
  opts: TaskSessionAdapterOptions,
  sessionId: string,
  reason: string,
  taskId?: string,
  expectedBinding?: TaskBinding,
): boolean {
  const cleanSessionId = sessionId.trim();
  if (!cleanSessionId || !opts.persistDir) return false;
  if (expectedBinding && expectedBinding.taskId !== taskId) {
    throw new Error(`Cannot recover session ${cleanSessionId}: retained Task binding does not match the requested Task`);
  }
  const retainedAttempt = expectedBinding ? { ...expectedBinding, sessionId: cleanSessionId } : undefined;
  readSessionCleanupMeta(opts.persistDir, cleanSessionId, retainedAttempt);

  if (opts.manager.hasActiveSession(cleanSessionId)) {
    opts.manager.cancel(cleanSessionId);
    // cancel() signals a running invocation; the manager retains it until
    // execution and joined helper cleanup finish. Let ordinary recovery retry
    // after that fact changes, without releasing its claim or live marker.
    if (opts.manager.hasActiveSession(cleanSessionId)) {
      throw new Error(`Cannot recover session ${cleanSessionId}: managed execution cleanup is still pending`);
    }
  }
  const meta = confirmSessionExecutionStopped({ ...opts, persistDir: opts.persistDir }, cleanSessionId, retainedAttempt);

  if (meta && meta.status !== "running" && meta.status !== "idle") {
    // meta.json is authoritative. Repair only its known terminal lifecycle
    // fields in SQL; do not invent historical timing or rewrite retained
    // outcome/result evidence that may describe an accepted result.
    updateSessionDb(opts.persistDir, cleanSessionId, {
      status: meta.status,
      ...(meta.endedAt !== undefined ? { endedAt: meta.endedAt, lastActivityAt: meta.endedAt } : {}),
      ...(meta.error ? { error: meta.error } : {}),
    });
    markSessionInactive(opts.persistDir, cleanSessionId);
    return true;
  }

  if (!meta || existsSync(join(sessionDir(opts.persistDir, cleanSessionId), "result.json"))) {
    // Cleanup is a current execution fact, not a new result. Preserve saved
    // result bytes/descriptors and damaged metadata. In particular, do not emit
    // session.end: its normal persistence subscriber writes a new result.
    const confirmedAt = Date.now();
    if (meta) {
      writeSessionMeta(opts.persistDir, cleanSessionId, {
        ...meta,
        status: "interrupted",
        endedAt: confirmedAt,
        error: reason,
      });
    }
    const stale = getDb(opts.persistDir).prepare(
      "SELECT endedAt FROM sessions WHERE sessionId = ? AND status IN ('running', 'idle')",
    ).get(cleanSessionId) as { endedAt: number | null } | undefined;
    if (stale) {
      updateSessionDb(opts.persistDir, cleanSessionId, {
        status: "interrupted",
        endedAt: stale.endedAt ?? confirmedAt,
        lastActivityAt: confirmedAt,
      });
    }
    markSessionInactive(opts.persistDir, cleanSessionId);
    return true;
  }

  const resolvedTaskId = taskId?.trim() || appTaskSessionBinding(meta.taskBinding)?.taskId || null;
  const summary =
    `Runtime recovery interrupted agent session${resolvedTaskId ? ` for ${resolvedTaskId}` : ""}. ` +
    "Consult the Task's current state for accepted work and any remaining obligation.";
  const endedAt = Date.now();
  const resultArtifact = writeSessionResult(opts.persistDir, cleanSessionId, {
    status: "interrupted",
    outcome: "interrupted",
    error: reason,
    summary,
    endedAt,
  });
  writeSessionMeta(opts.persistDir, cleanSessionId, {
    ...meta,
    status: "interrupted",
    endedAt,
    error: reason,
  });
  updateSessionDb(opts.persistDir, cleanSessionId, {
    status: "interrupted",
    endedAt,
    error: reason,
    outcome: summary,
    lastActivityAt: endedAt,
    resultArtifact,
  });
  markSessionInactive(opts.persistDir, cleanSessionId);
  opts.bus.emit({
    type: "session.end",
    source: meta.source ?? "app-task-reconciler",
    owner: `agent:${meta.agent}`,
    timestamp: endedAt,
    data: {
      sessionId: cleanSessionId,
      agent: meta.agent,
      agentRelativeDir: meta.agentRelativeDir ?? undefined,
      outcome: "interrupted",
      summary,
      error: reason,
      durationMs: Math.max(0, endedAt - meta.startedAt),
      status: "interrupted",
      task: meta.task,
      parentSessionId: meta.parentSessionId,
      workflowRunId: meta.workflowRunId,
      projectId: meta.projectId,
      kind: meta.kind,
      requestId: meta.requestId,
      stepLabel: meta.stepLabel,
      opCount: meta.opCount,
    },
  } as AgentEvent);
  return true;
}
