import { randomUUID } from "node:crypto";
import { createExecutionUsage, type ExecutionUsage, type PreparationMeasurement } from "../execution-usage.js";
import type { AgentRuntimeListener } from "../agent-runner.js";
import type { SqliteDb } from "../db.js";
import { getDb } from "./connection.js";

export type UsageIdentity = {
  id: string;
  sessionId: string;
  agent: string;
  appId?: string;
  workflowRunId?: string;
  taskId?: string;
  attemptId?: string;
  configuredModel: string;
  startedAt: number;
};

export type UsageOutcome = "done" | "error" | "interrupted" | "preparation-error";

/** Replace a cumulative snapshot; repeating a write cannot add spend. */
export function saveExecutionUsage(
  db: SqliteDb,
  identity: UsageIdentity,
  usage: ExecutionUsage,
  outcome: UsageOutcome | null = null,
  now = Date.now(),
) {
  db.prepare(
    `INSERT INTO execution_usage
    (id, session_id, app_id, agent, workflow_run_id, task_id, attempt_id, configured_model,
     preparer, entry_hash, models, started_at, updated_at, outcome, duration_ms, data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET models = excluded.models, updated_at = excluded.updated_at,
      outcome = excluded.outcome, duration_ms = excluded.duration_ms, data = excluded.data`,
  ).run(
    identity.id,
    identity.sessionId,
    identity.appId ?? null,
    identity.agent,
    identity.workflowRunId ?? null,
    identity.taskId ?? null,
    identity.attemptId ?? null,
    identity.configuredModel,
    usage.preparation.preparer,
    usage.preparation.entryHash,
    JSON.stringify(usage.models.map((model) => [model.provider, model.model])),
    identity.startedAt,
    now,
    outcome,
    outcome ? Math.max(0, now - identity.startedAt) : null,
    JSON.stringify(usage),
  );
}

/** Optional reporting adapter. No retry, timer, or execution decision. */
export function observeExecutionUsage(
  persistDir: string,
  identity: Omit<UsageIdentity, "id" | "startedAt">,
  onError: (error: unknown) => void,
) {
  const record = { ...identity, id: randomUUID(), startedAt: Date.now() };
  let collector: ReturnType<typeof createExecutionUsage> | undefined;
  let reportedError = false;
  const save = (outcome: UsageOutcome | null = null) => {
    if (!collector) return;
    try {
      saveExecutionUsage(getDb(persistDir), record, collector.snapshot(), outcome);
    } catch (error) {
      if (!reportedError) {
        reportedError = true;
        try {
          onError(error);
        } catch {
          /* reporting remains optional */
        }
      }
    }
  };
  return {
    preparation(measurement: PreparationMeasurement) {
      collector = createExecutionUsage(measurement);
      save(measurement.failed ? "preparation-error" : null);
    },
    observe: ((event, state) => {
      collector?.observe(event, state);
      if (event.type === "message_end" && event.message.role === "assistant") save();
    }) satisfies AgentRuntimeListener,
    finish: (outcome: UsageOutcome) => save(outcome),
  };
}
