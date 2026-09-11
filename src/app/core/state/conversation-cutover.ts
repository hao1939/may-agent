import type { AppDefinition } from "@may-agent/sdk";
import { stateTransaction } from "../../../lib/db/transaction.js";
import { appTaskSpecHash, observeAppTaskIntent } from "../tasks/app-task-reconciler.js";
import type { AppTaskAttempt } from "../tasks/app-task-state.js";
import type { AppTaskContext } from "../tasks/app-task-store.js";
import { getAppInboxItem } from "./app-inbox-store.js";
import { admitConversationTaskInput, conversationTaskId, conversationTaskIntent } from "./conversation-task-turns.js";

/**
 * Offline upgrade only. The operator must stop the old Host and every worker
 * before calling this operation; SQLite lease expiry cannot prove quiescence.
 * Retained execution is evidence for safe redo, never a decision to replay.
 */
export function migrateConversationInputs(
  config: AppTaskContext,
  input: { app: Readonly<AppDefinition>; conversationId: string; oldRuntimeStopped: boolean; now?: number },
) {
  const { app, conversationId } = input;
  if (!input.oldRuntimeStopped)
    throw new Error("Conversation cutover requires the old Host and all workers to be stopped");
  if (app.id !== config.resourceStore.appId || !app.requests || !conversationId.trim())
    throw new Error("Conversation cutover requires its exact App and Conversation");
  const store = config.resourceStore;
  const db = store.db;
  return stateTransaction(db, () => {
    const taskId = conversationTaskId(app.id, conversationId);
    const rows = db
      .prepare(
        `SELECT id, lease_generation FROM app_inbox_items
      WHERE app_id = ? AND conversation_id = ? AND execution_task_id IS NULL
      ORDER BY COALESCE(conversation_seq, created_at), created_at, id`,
      )
      .all(app.id, conversationId);
    const items = rows
      .map((row) => getAppInboxItem(db, String(row.id))!)
      .filter((item) => !app.requests!.inputKinds || app.requests!.inputKinds.includes(item.input.kind));
    const generations = new Map(rows.map((row) => [String(row.id), Number(row.lease_generation)]));
    if (!items.length) return { taskId, migrated: 0, pending: 0 };
    if (store.readTask(taskId) || store.isCancelled(taskId))
      throw new Error("A Task already owns this Conversation; refusing to replace its state during cutover");
    const now = input.now ?? Date.now();
    const stamp = new Date(now).toISOString();
    const intent = { ...conversationTaskIntent(config), id: taskId };
    observeAppTaskIntent(config, { appAgent: config.agent, intent });
    const resource = store.readTask(taskId)!;
    const attempts: AppTaskAttempt[] = [];
    let pending = 0;
    // Link and fence the whole selected batch before using normal admission.
    // The enclosing transaction prevents a half-converted Conversation.
    for (const item of items) {
      const failed = item.handling?.phase === "failed";
      const stopped = item.handling?.phase === "stopped";
      const redo = !stopped && (item.status !== "done" || failed);
      if (item.startedAt !== undefined || item.sessionId || item.handling || item.result) {
        const summary =
          item.handling?.phase === "decided"
            ? `Prior inbox decision was saved; its effects may be incomplete: ${item.handling.decision.summary}`
            : (item.result?.summary ??
              (item.handling?.phase === "failed" || item.handling?.phase === "stopped"
                ? item.handling.reason
                : "Prior inbox execution did not settle"));
        attempts.push({
          metadata: { id: `inbox:${item.id}:${generations.get(item.id)!}`, resourceVersion: 1 },
          taskId,
          taskGeneration: resource.metadata.generation,
          specHash: appTaskSpecHash(intent, config.agent),
          owner: config.agent,
          handler: "retired:conversation-inbox",
          runtimeId: "retired:conversation-inbox",
          state: failed ? "failed" : redo ? "interrupted" : "completed",
          reason: "Execution evidence imported during offline Conversation cutover",
          failureReason: redo ? "LegacyConversationInterrupted" : undefined,
          summary,
          sessionId: item.sessionId,
          startedAt: new Date(item.startedAt ?? item.createdAt).toISOString(),
          finishedAt: new Date(item.completedAt ?? item.updatedAt).toISOString(),
          events: [{ observedAt: stamp, event: { type: "conversation.input.retired", data: { input: item } } }],
        });
      }
      db.run(
        `UPDATE app_inbox_items SET execution_task_id = ?, lease_generation = lease_generation + 1,
        lease_owner = NULL, lease_expires_at = NULL, available_at = NULL, review_at = NULL,
        status = ?, completed_at = ?, changed_at = ?, updated_at = ? WHERE id = ?`,
        [taskId, redo ? "pending" : "done", redo ? null : (item.completedAt ?? now), now, now, item.id],
      );
      if (redo) pending++;
    }
    // An empty migrated Conversation rests without manufacturing an accepted
    // result. Historical inbox results remain in their original records.
    const version = resource.metadata.resourceVersion;
    resource.metadata.resourceVersion++;
    resource.status = {
      ...resource.status,
      phase: "converged",
      observedGeneration: resource.metadata.generation,
      updatedAt: stamp,
    };
    if (
      !store.commit({ fences: [{ taskId, resourceVersion: version }], tasks: [{ resource, ready: false }], attempts })
    )
      throw new Error("Conversation cutover lost its Task fence");
    for (const item of items) {
      if (getAppInboxItem(db, item.id)!.status === "done") continue;
      admitConversationTaskInput(config, { ...item, conversationId, intent: conversationTaskIntent(config) });
    }
    return { taskId, migrated: items.length, pending };
  });
}
