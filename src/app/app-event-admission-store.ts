import type { AppInput, TaskIntent } from "@may-agent/sdk";
import type { SqliteDb } from "../lib/db.js";

export type AppEventAdmissionRoute =
  | {
      appId: string;
      kind: "inbox";
      routeId: string;
      input: AppInput;
      /** Exact wakes for already-existing tasks are additive to inbox ownership. */
      conditionTaskIds: string[];
    }
  | {
      appId: string;
      kind: "task";
      routeId: string;
      intent: TaskIntent | null;
      conditionTaskIds: string[];
    }
  | {
      appId: string;
      kind: "exact-task";
      routeId: string;
      targetedTaskId: string;
      conditionTaskIds: string[];
    };

export type AppEventAdmissionCommand = AppEventAdmissionRoute & {
  payloadVersion: number;
  status: "pending" | "admitted" | "superseded";
  lastError?: string;
  admittedAt?: number;
};

export type AppEventAdmissionPlan = {
  eventId: number;
  registrySnapshotId: string;
  registryGeneration: number;
  status: "pending" | "completed" | "superseded";
  commands: AppEventAdmissionCommand[];
  lastError?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
};

type Row = Record<string, unknown>;

export const APP_EVENT_ADMISSION_PAYLOAD_VERSION = 2;

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid App event admission ${field}`);
  }
  return value.trim();
}

function requiredPositiveInteger(value: unknown, field: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid App event admission ${field}`);
  }
  return parsed;
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function serializeRoute(route: AppEventAdmissionRoute): string {
  switch (route.kind) {
    case "inbox":
      return JSON.stringify({ input: route.input, conditionTaskIds: route.conditionTaskIds });
    case "task":
      return JSON.stringify({
        intent: route.intent,
        conditionTaskIds: route.conditionTaskIds,
      });
    case "exact-task":
      return JSON.stringify({
        targetedTaskId: route.targetedTaskId,
        conditionTaskIds: route.conditionTaskIds,
      });
  }
}

function parsePayload(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") {
    throw new Error("Invalid App event admission payload");
  }
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("payload is not an object");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(
      `Invalid App event admission payload JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function stringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Invalid App event admission ${field}`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

function commandFromRow(row: Row): AppEventAdmissionCommand {
  const appId = requiredText(row.app_id, "app_id");
  const routeId = requiredText(row.route_id, "route_id");
  const kind = requiredText(row.route_kind, "route_kind");
  const status = requiredText(row.status, "command status") as AppEventAdmissionCommand["status"];
  const payloadVersion = requiredPositiveInteger(row.payload_version, "payload_version");
  if (payloadVersion !== 1 && payloadVersion !== APP_EVENT_ADMISSION_PAYLOAD_VERSION) {
    throw new Error(`Unsupported App event admission payload version: ${payloadVersion}`);
  }
  const payload = parsePayload(row.payload);
  const common = {
    appId,
    routeId,
    payloadVersion,
    status,
    lastError: optionalText(row.last_error),
    admittedAt: optionalNumber(row.admitted_at),
  };
  if (kind === "inbox") {
    const input = payload.input;
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error("Invalid App event admission inbox input");
    }
    return {
      ...common,
      kind,
      input: input as AppInput,
      conditionTaskIds:
        payloadVersion === 1 && payload.conditionTaskIds === undefined
          ? []
          : stringList(payload.conditionTaskIds, "conditionTaskIds"),
    };
  }
  if (kind === "task") {
    const intent = payload.intent;
    if (intent !== null && (!intent || typeof intent !== "object" || Array.isArray(intent))) {
      throw new Error("Invalid App event admission task intent");
    }
    return {
      ...common,
      kind,
      intent: intent as TaskIntent | null,
      conditionTaskIds: stringList(payload.conditionTaskIds, "conditionTaskIds"),
    };
  }
  if (kind === "exact-task") {
    return {
      ...common,
      kind,
      targetedTaskId: requiredText(payload.targetedTaskId, "targetedTaskId"),
      conditionTaskIds: stringList(payload.conditionTaskIds, "conditionTaskIds"),
    };
  }
  throw new Error(`Invalid App event admission route_kind: ${kind}`);
}

function withTransaction<T>(db: SqliteDb, operation: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function getAppEventAdmissionPlan(db: SqliteDb, eventId: number): AppEventAdmissionPlan | null {
  const plan = db
    .prepare(
      `SELECT event_id, registry_snapshot_id, registry_generation, status, last_error,
              created_at, updated_at, completed_at
       FROM app_event_admission_plans
       WHERE event_id = ?`,
    )
    .get(eventId);
  if (!plan) return null;
  const commands = db
    .prepare(
      `SELECT app_id, route_kind, route_id, payload_version, payload, status, last_error,
              admitted_at, updated_at
       FROM app_event_admission_commands
       WHERE event_id = ?
       ORDER BY app_id`,
    )
    .all(eventId)
    .map(commandFromRow);
  return {
    eventId: requiredPositiveInteger(plan.event_id, "event_id"),
    registrySnapshotId: requiredText(plan.registry_snapshot_id, "registry_snapshot_id"),
    registryGeneration: requiredPositiveInteger(plan.registry_generation, "registry_generation"),
    status: requiredText(plan.status, "plan status") as AppEventAdmissionPlan["status"],
    commands,
    lastError: optionalText(plan.last_error),
    createdAt: Number(plan.created_at),
    updatedAt: Number(plan.updated_at),
    completedAt: optionalNumber(plan.completed_at),
  };
}

/**
 * Read a bounded slice of the durable admission journal for recovery.
 *
 * `updatedBefore` is the retry fence: a failed plan is not visible again until
 * its cooldown has elapsed. New plans still enter through the event fast path
 * and do not wait for this recovery read.
 */
export function listPendingAppEventAdmissionPlans(
  db: SqliteDb,
  options: { updatedBefore?: number; limit?: number } = {},
): AppEventAdmissionPlan[] {
  const limit = options.limit ?? 100;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
    throw new Error("App event admission recovery limit must be an integer between 1 and 500");
  }
  const hasRetryFence = options.updatedBefore !== undefined;
  if (hasRetryFence && !Number.isFinite(options.updatedBefore)) {
    throw new Error("App event admission recovery fence must be finite");
  }
  return db
    .prepare(
      `SELECT event_id
       FROM app_event_admission_plans
       WHERE status = 'pending'${hasRetryFence ? " AND updated_at <= ?" : ""}
       ORDER BY updated_at, event_id
       LIMIT ?`,
    )
    .all(...(hasRetryFence ? [options.updatedBefore!, limit] : [limit]))
    .map((row) => getAppEventAdmissionPlan(db, requiredPositiveInteger(row.event_id, "event_id")))
    .filter((plan): plan is AppEventAdmissionPlan => plan !== null);
}

export function createAppEventAdmissionPlan(
  db: SqliteDb,
  input: {
    eventId: number;
    registrySnapshotId: string;
    registryGeneration: number;
    routes: AppEventAdmissionRoute[];
    now?: number;
  },
): AppEventAdmissionPlan {
  requiredPositiveInteger(input.eventId, "eventId");
  requiredText(input.registrySnapshotId, "registrySnapshotId");
  requiredPositiveInteger(input.registryGeneration, "registryGeneration");
  if (input.routes.length === 0) {
    throw new Error("App event admission plan requires at least one route");
  }
  const appIds = new Set<string>();
  for (const route of input.routes) {
    requiredText(route.appId, "route appId");
    requiredText(route.routeId, "route routeId");
    if (appIds.has(route.appId)) {
      throw new Error(`App event admission plan has multiple routes for App ${route.appId}`);
    }
    appIds.add(route.appId);
    serializeRoute(route);
  }

  const existing = getAppEventAdmissionPlan(db, input.eventId);
  if (existing) return existing;
  const now = input.now ?? Date.now();
  withTransaction(db, () => {
    db.prepare(
      `INSERT INTO app_event_admission_plans
         (event_id, registry_snapshot_id, registry_generation, status, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
    ).run(input.eventId, input.registrySnapshotId, input.registryGeneration, now, now);
    const insert = db.prepare(
      `INSERT INTO app_event_admission_commands
         (event_id, app_id, route_kind, route_id, payload_version, payload, status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    );
    for (const route of input.routes) {
      insert.run(
        input.eventId,
        route.appId,
        route.kind,
        route.routeId,
        APP_EVENT_ADMISSION_PAYLOAD_VERSION,
        serializeRoute(route),
        now,
      );
    }
  });
  const created = getAppEventAdmissionPlan(db, input.eventId);
  if (!created) throw new Error("App event admission plan was not persisted");
  return created;
}

export function markAppEventAdmissionCommandAdmitted(
  db: SqliteDb,
  input: { eventId: number; appId: string; now?: number },
): void {
  const now = input.now ?? Date.now();
  const updated = db
    .prepare(
      `UPDATE app_event_admission_commands
       SET status = 'admitted', last_error = NULL, admitted_at = COALESCE(admitted_at, ?), updated_at = ?
       WHERE event_id = ? AND app_id = ? AND status = 'pending'`,
    )
    .run(now, now, input.eventId, input.appId);
  if (updated.changes === 0) {
    const row = db
      .prepare(
        `SELECT status FROM app_event_admission_commands
         WHERE event_id = ? AND app_id = ?`,
      )
      .get(input.eventId, input.appId);
    if (row?.status !== "admitted") {
      throw new Error(`App event admission command ${input.eventId}/${input.appId} is unavailable`);
    }
  }
}

export function recordAppEventAdmissionCommandFailure(
  db: SqliteDb,
  input: { eventId: number; appId: string; error: unknown; now?: number },
): void {
  const now = input.now ?? Date.now();
  const message = input.error instanceof Error ? input.error.message : String(input.error);
  db.prepare(
    `UPDATE app_event_admission_commands
     SET last_error = ?, updated_at = ?
     WHERE event_id = ? AND app_id = ? AND status = 'pending'`,
  ).run(message, now, input.eventId, input.appId);
  db.prepare(
    `UPDATE app_event_admission_plans
     SET last_error = ?, updated_at = ?
     WHERE event_id = ? AND status = 'pending'`,
  ).run(message, now, input.eventId);
}

export function completeAppEventAdmissionPlan(db: SqliteDb, eventId: number, now = Date.now()): boolean {
  const pending = db
    .prepare(
      `SELECT 1 AS found FROM app_event_admission_commands
       WHERE event_id = ? AND status = 'pending' LIMIT 1`,
    )
    .get(eventId);
  if (pending) return false;
  const updated = db
    .prepare(
      `UPDATE app_event_admission_plans
       SET status = 'completed', last_error = NULL,
           completed_at = COALESCE(completed_at, ?), updated_at = ?
       WHERE event_id = ? AND status = 'pending'`,
    )
    .run(now, now, eventId);
  if (updated.changes > 0) return true;
  return (
    db.prepare(`SELECT status FROM app_event_admission_plans WHERE event_id = ?`).get(eventId)?.status === "completed"
  );
}
