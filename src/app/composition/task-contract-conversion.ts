import { matchesEventSelector, type AppDefinition } from "@may-agent/sdk";
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";
import type { SqliteDb } from "../../lib/db.js";
import { advanceTaskResourceRevision } from "../../lib/db/task-resource-schema.js";
import { stateTransaction } from "../../lib/db/transaction.js";
import { readSessionMetaRecoveryEvidence } from "../../lib/persistence.js";
import { hasLiveSessionExecution } from "../../lib/session-cleanup.js";
import { canonicalAppEvent } from "../canonical-app-event.js";
import { assertValidAppInput } from "../core/apps/definition-validation.js";
import { loadPersistedEvent } from "../core/events/persisted.js";
import { getAppEventAdmissionPlan, resolveAppEventAdmissionCommand } from "../core/state/app-event-admission-store.js";

function assertConversionSessionFilesClean(persistDir: string, affectedApps: ReadonlySet<string>): void {
  const sessions = join(persistDir, "sessions");
  if (!existsSync(sessions)) return;
  if (!lstatSync(sessions).isDirectory()) throw new Error("Session state requires explicit recovery");
  for (const entry of readdirSync(sessions, { withFileTypes: true })) {
    if (!entry.isDirectory()) throw new Error("Unknown session artifact requires explicit recovery");
    const directory = join(sessions, entry.name);
    if (["[STARTED]", "bash-process-groups.json"].some((name) => existsSync(join(directory, name)))) {
      throw new Error("Retained execution markers or descendants require confirmed cleanup");
    }
    if (hasLiveSessionExecution({ persistDir, manager: { hasActiveSession: () => false } }, entry.name)) {
      throw new Error("Retained session execution requires confirmed cleanup");
    }
    const activePath = join(directory, "[ACTIVE]");
    const hasActiveMarker = existsSync(activePath);
    if (hasActiveMarker && readFileSync(activePath, "utf8").trim().length > 0) {
      throw new Error("Retained execution markers or descendants require confirmed cleanup");
    }
    const evidence = readSessionMetaRecoveryEvidence(persistDir, entry.name);
    if (evidence.state === "corrupt") {
      throw new Error("Retained session execution requires confirmed cleanup");
    }
    if (evidence.state === "valid") {
      const boundApp =
        typeof evidence.meta.taskBinding?.appId === "string"
          ? evidence.meta.taskBinding.appId
          : evidence.meta.projectId;
      if (boundApp && affectedApps.has(boundApp) && (hasActiveMarker || evidence.meta.status === "running")) {
        throw new Error("Retained session execution requires confirmed cleanup");
      }
    }
  }
}

/** Explicit offline format conversion. Never called by startup or recovery. */
export function convertStoppedTaskContracts(input: {
  db: SqliteDb;
  persistDir: string;
  apps: readonly AppDefinition[];
}) {
  const { db, persistDir } = input;
  const mainFile = db.prepare("PRAGMA database_list").all().find((row) => row.name === "main")?.file;
  if (typeof mainFile !== "string" || !mainFile || realpathSync(mainFile) !== realpathSync(join(persistDir, "may.db"))) {
    throw new Error("Offline Task contract conversion requires the exact database and session state directory");
  }
  const preliminaryAffectedApps = new Set<string>([
    ...db
      .prepare(
        `SELECT DISTINCT app_id FROM app_tasks
         WHERE json_extract(resource_json, '$.spec.executor') = 'conversation'`,
      )
      .all()
      .map((row) => String(row.app_id)),
    ...db
      .prepare(
        `SELECT DISTINCT app_id FROM app_event_admission_commands
         WHERE route_kind = 'unresolved' AND status = 'pending'
           AND json_extract(payload, '$.resolveTask') = 1`,
      )
      .all()
      .map((row) => String(row.app_id)),
  ]);
  assertConversionSessionFilesClean(persistDir, preliminaryAffectedApps);
  return stateTransaction(db, () => {
    const affectedApps = new Set<string>([
      ...db
        .prepare(
          `SELECT DISTINCT app_id FROM app_tasks
           WHERE json_extract(resource_json, '$.spec.executor') = 'conversation'`,
        )
        .all()
        .map((row) => String(row.app_id)),
      ...db
        .prepare(
          `SELECT DISTINCT app_id FROM app_event_admission_commands
           WHERE route_kind = 'unresolved' AND status = 'pending'
             AND json_extract(payload, '$.resolveTask') = 1`,
        )
        .all()
        .map((row) => String(row.app_id)),
    ]);
    if (db.prepare("SELECT 1 FROM task_execution_reservations WHERE released_at IS NULL LIMIT 1").get()) {
      throw new Error("Retained execution reservations require confirmed cleanup before converting");
    }
    for (const appId of affectedApps) {
      if (db.prepare("SELECT 1 FROM app_task_attempts WHERE app_id = ? AND state = 'running' LIMIT 1").get(appId)) {
        throw new Error(`Retained running attempts in App ${appId} require ordinary recovery before converting`);
      }
    }
    if (
      db
        .prepare(
          "SELECT 1 FROM app_task_attempts WHERE json_extract(attempt_json, '$.pendingSettlement.report.conversation') IS NOT NULL LIMIT 1",
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
        if (command.subscriptionIds.length)
          throw new Error(`Settle mixed subscription/Task admission for ${command.appId}/${eventId} with the previous Host`);
        const app = apps.get(command.appId);
        if (!app) throw new Error(`Missing App ${command.appId} for retained event ${eventId}`);
        const saved = loadPersistedEvent(db, Number(eventId), persistDir);
        if (!saved) throw new Error(`Missing or invalid original event ${eventId}`);
        const event = canonicalAppEvent(saved);
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
