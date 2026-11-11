import { matchesEventSelector, type AppDefinition, type AppEvent } from "@may-agent/sdk";
import type { SqliteDb } from "../../lib/db.js";
import { advanceTaskResourceRevision } from "../../lib/db/task-resource-schema.js";
import { stateTransaction } from "../../lib/db/transaction.js";
import { assertValidAppInput } from "../core/apps/definition-validation.js";
import { getAppEventAdmissionPlan, resolveAppEventAdmissionCommand } from "../core/state/app-event-admission-store.js";
import { assertOfflineWorkloadExecution, assertOfflineWorkloadFiles } from "./install-retained-workload-state.js";

/** Explicit offline format conversion. Never called by startup or recovery. */
export function convertStoppedTaskContracts(input: {
  db: SqliteDb;
  persistDir: string;
  apps: readonly AppDefinition[];
}) {
  const { db, persistDir } = input;
  assertOfflineWorkloadFiles(db, persistDir);
  return stateTransaction(db, () => {
    assertOfflineWorkloadExecution(db);
    if (
      db
        .prepare(
          "SELECT 1 FROM app_task_attempts WHERE json_extract(attempt_json, '$.pendingSettlement.conversation') IS NOT NULL LIMIT 1",
        )
        .get()
    )
      throw new Error("Settle retained Conversation proposals with the previous Host before converting");
    if (
      db
        .prepare(
          "SELECT 1 FROM app_event_admission_commands WHERE status = 'pending' AND route_kind = 'task' AND json_extract(payload, '$.intent.executor') = 'conversation' LIMIT 1",
        )
        .get()
    )
      throw new Error("Settle frozen Conversation admission commands with the previous Host before converting");
    const apps = new Map(input.apps.map((app) => [app.id, app]));
    const rows = db
      .prepare(
        `SELECT app_id, task_id, resource_json FROM app_tasks
      WHERE json_extract(resource_json, '$.spec.executor') = 'conversation'`,
      )
      .all();
    for (const row of rows) {
      const appId = String(row.app_id);
      if (
        !db
          .prepare(
            "SELECT 1 FROM app_inbox_items WHERE app_id = ? AND execution_task_id = ? AND conversation_id IS NOT NULL LIMIT 1",
          )
          .get(appId, row.task_id)
      )
        throw new Error(
          `Retained Conversation Task ${appId}/${row.task_id} has no saved input context; inspect with the previous Host`,
        );
      if (apps.get(appId)?.conversation?.mode !== "task")
        throw new Error(`Load the current Conversation App for ${appId} before converting`);
      const resource = JSON.parse(String(row.resource_json));
      resource.spec.executor = "agent";
      resource.metadata.resourceVersion++;
      // Mechanical method translation: preserve obligation, generation, readiness,
      // accepted results and every input/Request identity. No work is admitted here.
      db.prepare(`UPDATE app_tasks SET resource_version = ?, resource_json = ? WHERE app_id = ? AND task_id = ?`).run(
        resource.metadata.resourceVersion,
        JSON.stringify(resource),
        appId,
        row.task_id,
      );
      advanceTaskResourceRevision(db, appId);
    }
    let routes = 0;
    const events = db
      .prepare(
        `SELECT DISTINCT event_id FROM app_event_admission_commands
      WHERE route_kind = 'unresolved' AND status = 'pending'`,
      )
      .all();
    for (const { event_id: eventId } of events) {
      const plan = getAppEventAdmissionPlan(db, Number(eventId))!;
      for (const command of plan.commands) {
        if (command.kind !== "unresolved" || command.status !== "pending" || !command.resolveTask) continue;
        const app = apps.get(command.appId);
        if (!app) throw new Error(`Missing App ${command.appId} for retained event ${eventId}`);
        const row = db.prepare("SELECT envelope_json FROM events WHERE id = ?").get(eventId);
        if (typeof row?.envelope_json !== "string") throw new Error(`Missing original envelope for event ${eventId}`);
        const event = JSON.parse(row.envelope_json) as AppEvent<Record<string, unknown>>;
        const subscriptions = (app.subscriptions ?? []).filter(({ event: selector }) =>
          matchesEventSelector(selector, event),
        );
        if (!subscriptions.length)
          throw new Error(`No current subscription maps retained event ${command.appId}/${eventId}`);
        const translated = subscriptions.flatMap((subscription) => {
          const value = subscription.toInput(event);
          if (value === null) return [];
          assertValidAppInput(app, value);
          return [{ id: subscription.id, input: value }];
        });
        if (translated.length > 1) throw new Error(`Ambiguous converted route for ${command.appId}/${eventId}`);
        const common = { appId: command.appId, conditionTaskIds: command.conditionTaskIds };
        const selected = translated[0];
        resolveAppEventAdmissionCommand(db, {
          eventId: Number(eventId),
          registrySnapshotId: "offline-task-contract-conversion",
          now: Date.now(),
          route: selected
            ? { ...common, kind: "inbox", routeId: selected.id, input: selected.input }
            : command.conditionTaskIds.length
              ? { ...common, kind: "task", routeId: command.routeId, intent: null }
              : { ...common, kind: "noop", routeId: command.routeId },
        });
        routes++;
      }
    }
    return { tasks: rows.length, routes };
  });
}
