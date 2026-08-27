import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { openDatabase, type SqliteDb } from "../lib/db.js";
import { getDb } from "../lib/requests.js";
import { advanceTaskResourceRevision, ensureTaskResourceSchema } from "../lib/db/task-resource-schema.js";
import { indexTaskReference } from "./task-reference-index.js";
import type { AppTaskAttempt, AppTaskCondition, AppTaskResource, AppTaskTrigger } from "./app-task-state.js";
import {
  normalizeTaskStateInPlace,
  normalizeTaskGroup,
  readTaskState,
  withTaskStateLock,
  type AppTaskAdmission,
  type TaskCompletionReceipt,
  type TaskGroup,
  type TaskStateConfig,
  type TaskTree,
} from "./app-task-store.js";

const TASK_RESOURCE_SCHEMA_VERSION = 2;
const MAX_CONTEXT_ATTEMPTS_PER_TASK = 16;

/**
 * Task rows share the Host database with events so a later fenced emit can
 * verify its attempt, persist the event, and record exact wakes in one SQLite
 * transaction. Resource locality comes from keyed rows, not another database.
 */
function epoch(value: string | undefined): number | null {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableValue(item)]),
  );
}

function json(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function parseJson<T>(value: unknown): T {
  if (typeof value !== "string") throw new Error("Task resource store contained non-text JSON");
  return JSON.parse(value) as T;
}

function transaction<T>(db: SqliteDb, operation: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = operation();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Preserve the original failure.
    }
    throw error;
  }
}

function eventKey(event: Record<string, unknown>): string {
  const eventId = Number(event.eventId);
  if (Number.isSafeInteger(eventId) && eventId > 0) return `event:${eventId}`;
  return `sha256:${createHash("sha256").update(json(event)).digest("hex")}`;
}

function taskChanged(resource: AppTaskResource, trigger: AppTaskTrigger | undefined): boolean {
  return (
    Boolean(trigger) ||
    (resource.status.phase !== "running" && resource.metadata.generation > resource.status.observedGeneration)
  );
}

export type IndexedTaskCandidate = {
  taskId: string;
  lane: "human" | "normal";
  ready: boolean;
  changed: boolean;
  nextCheckAt: number | null;
  leaseUntil: number | null;
};

export type IndexedTaskRecoveryCursor = {
  lane: "human" | "normal";
  updatedAt: number;
  taskId: string;
};

export type IndexedTaskCandidatePage = {
  items: IndexedTaskCandidate[];
  nextCursor: IndexedTaskRecoveryCursor | null;
};

export type TaskMutationFence = {
  taskId: string;
  resourceVersion: number;
  generation?: number;
  currentAttemptId?: string | null;
};

export type TaskResourceWrite = {
  resource: AppTaskResource;
  trigger?: AppTaskTrigger;
  ready: boolean;
  nextCheckAt?: number | null;
};

export type AppTaskResourceMutation = {
  fences: TaskMutationFence[];
  expectMissingTaskIds?: string[];
  tasks?: TaskResourceWrite[];
  deleteTaskIds?: string[];
  attempts?: AppTaskAttempt[];
  deleteAttemptIds?: string[];
  conditions?: AppTaskCondition[];
  deleteConditionIds?: string[];
  pruneConditionIds?: string[];
  receipts?: TaskCompletionReceipt[];
  deleteReceiptIds?: string[];
  admissions?: Array<{ taskId: string; value: AppTaskAdmission }>;
  deleteAdmissionIds?: string[];
};

export class AppTaskResourceStore {
  private constructor(
    private readonly db: SqliteDb,
    readonly appId: string,
    private readonly ownsDb: boolean,
  ) {}

  static fromDb(db: SqliteDb, appId: string): AppTaskResourceStore {
    const normalized = appId.trim().replace(/\.app$/, "");
    if (!normalized) throw new Error("Task resource store requires an App id");
    ensureTaskResourceSchema(db);
    db.prepare(
      `INSERT INTO app_task_store_meta(app_id, key, value) VALUES (?, 'schema_version', ?)
       ON CONFLICT(app_id, key) DO UPDATE SET value = excluded.value`,
    ).run(normalized, String(TASK_RESOURCE_SCHEMA_VERSION));
    db.prepare("INSERT OR IGNORE INTO app_task_store_meta(app_id, key, value) VALUES (?, 'revision', '0')").run(
      normalized,
    );
    return new AppTaskResourceStore(db, normalized, false);
  }

  /** Discover an already-cut-over App without creating or activating state. */
  static activeFromDb(db: SqliteDb, appId: string): AppTaskResourceStore | null {
    const normalized = appId.trim().replace(/\.app$/, "");
    if (!normalized) return null;
    const row = db
      .prepare("SELECT value FROM app_task_store_meta WHERE app_id = ? AND key = 'authority'")
      .get(normalized) as { value?: string } | null;
    return row?.value === "resources" ? new AppTaskResourceStore(db, normalized, false) : null;
  }

  static openStandalone(path: string, appId = "test"): AppTaskResourceStore {
    const db = openDatabase(path);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA busy_timeout = 5000");
    db.exec("PRAGMA foreign_keys = ON");
    const store = AppTaskResourceStore.fromDb(db, appId);
    return new AppTaskResourceStore(db, store.appId, true);
  }

  close(): void {
    if (this.ownsDb) this.db.close();
  }

  private meta(key: string): string | null {
    const row = this.db
      .prepare("SELECT value FROM app_task_store_meta WHERE app_id = ? AND key = ?")
      .get(this.appId, key) as { value?: string } | null;
    return row?.value ?? null;
  }

  private setMeta(key: string, value: string): void {
    this.db
      .prepare("INSERT OR REPLACE INTO app_task_store_meta(app_id, key, value) VALUES (?, ?, ?)")
      .run(this.appId, key, value);
  }

  private putTask(
    resource: AppTaskResource,
    trigger: AppTaskTrigger | undefined,
    ready: boolean,
    nextCheckAt: number | null,
  ): void {
    const activeAttempt = resource.status.currentAttemptId;
    const leaseUntil = activeAttempt
      ? ((
          this.db
            .prepare("SELECT lease_until FROM app_task_attempts WHERE app_id = ? AND attempt_id = ?")
            .get(this.appId, activeAttempt) as { lease_until?: number | null } | null
        )?.lease_until ?? null)
      : null;
    this.db
      .prepare(
        `INSERT INTO app_tasks (
         app_id, task_id, generation, resource_version, observed_generation, phase, lane,
         changed, ready, next_check_at, lease_until, current_attempt_id, updated_at, resource_json, trigger_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(app_id, task_id) DO UPDATE SET
         generation=excluded.generation, resource_version=excluded.resource_version,
         observed_generation=excluded.observed_generation, phase=excluded.phase, lane=excluded.lane,
         changed=excluded.changed, ready=excluded.ready, next_check_at=excluded.next_check_at,
         lease_until=excluded.lease_until, current_attempt_id=excluded.current_attempt_id,
         updated_at=excluded.updated_at,
         resource_json=excluded.resource_json, trigger_json=excluded.trigger_json`,
      )
      .run(
        this.appId,
        resource.metadata.id,
        resource.metadata.generation,
        resource.metadata.resourceVersion,
        resource.status.observedGeneration,
        resource.status.phase,
        resource.status.lane ?? "normal",
        taskChanged(resource, trigger) ? 1 : 0,
        ready ? 1 : 0,
        nextCheckAt,
        leaseUntil,
        resource.status.currentAttemptId ?? null,
        epoch(resource.status.updatedAt) ?? Date.now(),
        json(resource),
        trigger ? json(trigger) : null,
      );
    indexTaskReference(this.db, this.appId, resource.metadata.id);
    this.putTaskRelations(resource);
  }

  /** Refresh only the exact structural links declared by one Task. */
  private putTaskRelations(resource: AppTaskResource): void {
    const taskId = resource.metadata.id;
    this.db.prepare("DELETE FROM app_task_relations WHERE app_id = ? AND source_task_id = ?").run(this.appId, taskId);
    const insert = this.db.prepare(
      `INSERT OR IGNORE INTO app_task_relations(
         app_id, source_task_id, relation_kind, target_task_id
       ) VALUES (?, ?, ?, ?)`,
    );
    const parentId = resource.spec.parentId?.trim();
    if (parentId) insert.run(this.appId, taskId, "parent", parentId);
    for (const dependencyId of new Set((resource.spec.dependsOn ?? []).map((id) => id.trim()).filter(Boolean))) {
      insert.run(this.appId, taskId, "dependency", dependencyId);
    }
  }

  /** Refresh only one Task's normalized Condition links. */
  private putTaskConditionRoutes(resource: AppTaskResource): void {
    this.db
      .prepare("DELETE FROM app_task_condition_routes WHERE app_id = ? AND task_id = ?")
      .run(this.appId, resource.metadata.id);
    for (const conditionId of new Set(resource.status.conditionIds ?? [])) {
      this.db
        .prepare(
          `INSERT OR IGNORE INTO app_task_condition_routes(app_id, task_id, condition_id)
           SELECT ?, ?, ?
           WHERE EXISTS (
             SELECT 1 FROM app_task_conditions WHERE app_id = ? AND condition_id = ?
           )`,
        )
        .run(this.appId, resource.metadata.id, conditionId, this.appId, conditionId);
    }
  }

  importPausedSnapshot(
    treeInput: TaskTree,
    sourceRevision: string,
    readyTaskIds: Iterable<string> = [],
    options: { activate?: boolean; finalLifecycle?: "active" | "paused" } = {},
  ): void {
    const tree = normalizeTaskStateInPlace(structuredClone(treeInput));
    if (tree.project_lifecycle !== "paused") throw new Error("Task resource import requires project_lifecycle=paused");
    if (tree.project && tree.project.replace(/\.app$/, "") !== this.appId) {
      throw new Error(`Task snapshot project ${tree.project} does not match App ${this.appId}`);
    }
    const ready = new Set(readyTaskIds);
    transaction(this.db, () => {
      const currentAuthority = this.meta("authority");
      if (currentAuthority === "resources") {
        throw new Error(`Task resource authority for ${this.appId} is already active`);
      }
      if (options.activate && currentAuthority) {
        throw new Error(`Task resource bootstrap for ${this.appId} found existing ${currentAuthority} authority`);
      }
      for (const table of [
        "app_task_events",
        "app_task_relations",
        "app_task_attempts",
        "app_task_condition_routes",
        "app_task_conditions",
        "app_task_receipts",
        "app_task_groups",
        "app_task_admissions",
        "app_tasks",
      ]) {
        this.db.prepare(`DELETE FROM ${table} WHERE app_id = ?`).run(this.appId);
      }

      for (const resource of Object.values(tree.resources ?? {})) {
        const trigger = tree.taskTriggers?.[resource.metadata.id];
        this.putTask(resource, trigger, ready.has(resource.metadata.id), null);
        for (const entry of trigger?.events ??
          (trigger ? [{ event: trigger.event, observedAt: trigger.observedAt }] : [])) {
          this.db
            .prepare(
              `INSERT OR IGNORE INTO app_task_events(app_id, task_id, event_key, observed_at, event_json)
             VALUES (?, ?, ?, ?, ?)`,
            )
            .run(
              this.appId,
              resource.metadata.id,
              eventKey(entry.event),
              epoch(entry.observedAt) ?? 0,
              json(entry.event),
            );
        }
      }
      for (const attempt of Object.values(tree.attempts ?? {})) {
        this.db
          .prepare(
            `INSERT INTO app_task_attempts(
             app_id, attempt_id, task_id, task_generation, state, lease_until, started_at, attempt_json
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            this.appId,
            attempt.metadata.id,
            attempt.taskId,
            attempt.taskGeneration,
            attempt.state,
            epoch(attempt.lease?.expiresAt),
            epoch(attempt.startedAt) ?? 0,
            json(attempt),
          );
        if (attempt.state === "running" && attempt.lease?.expiresAt) {
          this.db
            .prepare("UPDATE app_tasks SET lease_until = ? WHERE app_id = ? AND task_id = ?")
            .run(epoch(attempt.lease.expiresAt), this.appId, attempt.taskId);
        }
      }
      for (const condition of Object.values(tree.conditions ?? {})) {
        this.db
          .prepare("INSERT INTO app_task_conditions(app_id, condition_id, state, condition_json) VALUES (?, ?, ?, ?)")
          .run(this.appId, condition.metadata.id, condition.status.state, json(condition));
      }
      for (const resource of Object.values(tree.resources ?? {})) this.putTaskConditionRoutes(resource);
      for (const receipt of Object.values(tree.receipts ?? {})) {
        this.db
          .prepare(
            `INSERT INTO app_task_receipts(app_id, receipt_id, parent_id, completed_at, receipt_json)
           VALUES (?, ?, ?, ?, ?)`,
          )
          .run(this.appId, receipt.metadata.id, receipt.parentId, epoch(receipt.completedAt) ?? 0, json(receipt));
        indexTaskReference(this.db, this.appId, receipt.metadata.id);
      }
      for (const [id, group] of Object.entries(tree.groups ?? {})) {
        this.db
          .prepare("INSERT INTO app_task_groups(app_id, group_id, group_json) VALUES (?, ?, ?)")
          .run(this.appId, id, json(group));
      }
      for (const [taskId, admission] of Object.entries(tree.appTaskAdmissions ?? {})) {
        this.db
          .prepare("INSERT INTO app_task_admissions(app_id, task_id, admission_json) VALUES (?, ?, ?)")
          .run(this.appId, taskId, json(admission));
      }
      this.setMeta(
        "app_metadata",
        json({
          version: tree.version,
          project: tree.project,
          updated_at: tree.updated_at,
          project_lifecycle: options.finalLifecycle ?? tree.project_lifecycle,
          root_task_id: tree.root_task_id,
        }),
      );
      this.setMeta("source_revision", sourceRevision);
      this.setMeta("imported_at", new Date().toISOString());
      this.setMeta("authority", options.activate ? "resources" : "shadow");
      if (options.activate) this.setMeta("activated_at", new Date().toISOString());
      this.bumpRevision();
    });
  }

  /** Atomically establish resource authority for a brand-new App seed. */
  bootstrapSnapshot(treeInput: TaskTree, sourceRevision: string): void {
    const tree = structuredClone(treeInput);
    const finalLifecycle = tree.project_lifecycle === "paused" ? "paused" : "active";
    tree.project_lifecycle = "paused";
    this.importPausedSnapshot(tree, sourceRevision, [], { activate: true, finalLifecycle });
  }

  sourceRevision(): string | null {
    return this.meta("source_revision");
  }

  isActive(): boolean {
    return this.meta("authority") === "resources";
  }

  revision(): number {
    const value = Number(this.meta("revision"));
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  }

  private bumpRevision(): void {
    advanceTaskResourceRevision(this.db, this.appId);
  }

  activate(expectedSourceRevision: string): void {
    transaction(this.db, () => {
      const sourceRevision = this.sourceRevision();
      if (!sourceRevision || sourceRevision !== expectedSourceRevision) {
        throw new Error(
          `Task resource activation revision mismatch: expected ${expectedSourceRevision}, found ${sourceRevision ?? "none"}`,
        );
      }
      this.setMeta("authority", "resources");
      this.setMeta("activated_at", new Date().toISOString());
    });
  }

  setProjectLifecycle(lifecycle: "active" | "paused"): void {
    transaction(this.db, () => {
      if (!this.isActive()) throw new Error("Task resource lifecycle requires active resource authority");
      const rawMetadata = this.meta("app_metadata");
      if (!rawMetadata) throw new Error("Task resource store has no App metadata");
      this.setMeta(
        "app_metadata",
        json({ ...parseJson<Record<string, unknown>>(rawMetadata), project_lifecycle: lifecycle }),
      );
      this.bumpRevision();
    });
  }

  rootTaskId(): string | null {
    const rawMetadata = this.meta("app_metadata");
    if (!rawMetadata) return null;
    const value = parseJson<Record<string, unknown>>(rawMetadata).root_task_id;
    return typeof value === "string" && value.trim() ? value : null;
  }

  projectLifecycle(): "active" | "paused" | null {
    const rawMetadata = this.meta("app_metadata");
    if (!rawMetadata) return null;
    const value = parseJson<Record<string, unknown>>(rawMetadata).project_lifecycle;
    return value === "active" || value === "paused" ? value : null;
  }

  readTask(taskId: string): AppTaskResource | null {
    const row = this.db
      .prepare("SELECT resource_json FROM app_tasks WHERE app_id = ? AND task_id = ?")
      .get(this.appId, taskId) as { resource_json?: string } | null;
    return row?.resource_json ? parseJson<AppTaskResource>(row.resource_json) : null;
  }

  readTrigger(taskId: string): AppTaskTrigger | null {
    const row = this.db
      .prepare("SELECT trigger_json FROM app_tasks WHERE app_id = ? AND task_id = ?")
      .get(this.appId, taskId) as { trigger_json?: string | null } | null;
    return row?.trigger_json ? parseJson<AppTaskTrigger>(row.trigger_json) : null;
  }

  readAttempt(attemptId: string): AppTaskAttempt | null {
    const row = this.db
      .prepare("SELECT attempt_json FROM app_task_attempts WHERE app_id = ? AND attempt_id = ?")
      .get(this.appId, attemptId) as { attempt_json?: string } | null;
    return row?.attempt_json ? parseJson<AppTaskAttempt>(row.attempt_json) : null;
  }

  readReceipt(taskId: string): TaskCompletionReceipt | null {
    const row = this.db
      .prepare("SELECT receipt_json FROM app_task_receipts WHERE app_id = ? AND receipt_id = ?")
      .get(this.appId, taskId) as { receipt_json?: string } | null;
    return row?.receipt_json ? parseJson<TaskCompletionReceipt>(row.receipt_json) : null;
  }

  readTaskConditions(taskId: string): AppTaskCondition[] {
    const rows = this.db
      .prepare(
        `SELECT conditions.condition_json
         FROM app_task_condition_routes routes
         JOIN app_task_conditions conditions
           ON conditions.app_id = routes.app_id AND conditions.condition_id = routes.condition_id
         WHERE routes.app_id = ? AND routes.task_id = ?
         ORDER BY routes.condition_id`,
      )
      .all(this.appId, taskId) as Array<{ condition_json?: string }>;
    return rows.flatMap((row) => (row.condition_json ? [parseJson<AppTaskCondition>(row.condition_json)] : []));
  }

  isCancelled(taskId: string): boolean {
    return Boolean(
      this.db
        .prepare("SELECT 1 AS cancelled FROM app_task_cancellations WHERE app_id = ? AND task_id = ?")
        .get(this.appId, taskId),
    );
  }

  readConditionRoutes(eventType: string): Array<{ condition: AppTaskCondition; taskIds: string[] }> {
    const rows = this.db
      .prepare(
        `SELECT c.condition_id, c.condition_json, linked.task_id
         FROM app_task_conditions c
         JOIN app_task_condition_routes linked
           ON linked.app_id = c.app_id AND linked.condition_id = c.condition_id
         JOIN app_tasks task
           ON task.app_id = linked.app_id AND task.task_id = linked.task_id
         WHERE c.app_id = ? AND json_extract(c.condition_json, '$.spec.type') = ?
           AND c.state <> 'true'
           AND task.phase IN ('waiting', 'running')
         ORDER BY c.condition_id, linked.task_id`,
      )
      .all(this.appId, eventType) as Array<{
      condition_id?: string;
      condition_json?: string;
      task_id?: string;
    }>;
    const routes = new Map<string, { condition: AppTaskCondition; taskIds: string[] }>();
    for (const row of rows) {
      if (!row.condition_id || !row.condition_json || !row.task_id) continue;
      const route = routes.get(row.condition_id) ?? {
        condition: parseJson<AppTaskCondition>(row.condition_json),
        taskIds: [],
      };
      route.taskIds.push(row.task_id);
      routes.set(row.condition_id, route);
    }
    return [...routes.values()];
  }

  /** One event-type-first lookup across all resource-backed Apps. */
  readConditionRoutesForAllApps(
    eventType: string,
  ): Array<{ appId: string; condition: AppTaskCondition; taskIds: string[] }> {
    const rows = this.db
      .prepare(
        `SELECT c.app_id, c.condition_id, c.condition_json, linked.task_id
         FROM app_task_conditions c INDEXED BY idx_app_task_conditions_type_app
         JOIN app_task_condition_routes linked
           ON linked.app_id = c.app_id AND linked.condition_id = c.condition_id
         JOIN app_tasks task
           ON task.app_id = linked.app_id AND task.task_id = linked.task_id
         WHERE json_extract(c.condition_json, '$.spec.type') = ?
           AND c.state <> 'true'
           AND task.phase IN ('waiting', 'running')
         ORDER BY c.app_id, c.condition_id, linked.task_id`,
      )
      .all(eventType) as Array<{
      app_id?: string;
      condition_id?: string;
      condition_json?: string;
      task_id?: string;
    }>;
    const routes = new Map<string, { appId: string; condition: AppTaskCondition; taskIds: string[] }>();
    for (const row of rows) {
      if (!row.app_id || !row.condition_id || !row.condition_json || !row.task_id) continue;
      const key = `${row.app_id}\0${row.condition_id}`;
      const route = routes.get(key) ?? {
        appId: row.app_id,
        condition: parseJson<AppTaskCondition>(row.condition_json),
        taskIds: [],
      };
      route.taskIds.push(row.task_id);
      routes.set(key, route);
    }
    return [...routes.values()];
  }

  readOpenConditionReplayScope(conditionIds?: Iterable<string>): { eventTypes: string[]; taskIds: string[] } {
    const ids = conditionIds ? [...new Set([...conditionIds].map((id) => id.trim()).filter(Boolean))] : [];
    const rows = this.db
      .prepare(
        `SELECT DISTINCT json_extract(c.condition_json, '$.spec.type') AS event_type, linked.task_id
         FROM app_task_conditions c
         JOIN app_task_condition_routes linked
           ON linked.app_id = c.app_id AND linked.condition_id = c.condition_id
         WHERE c.app_id = ? AND c.state <> 'true'
           ${ids.length ? `AND c.condition_id IN (${ids.map(() => "?").join(", ")})` : ""}`,
      )
      .all(this.appId, ...ids) as Array<{ event_type?: unknown; task_id?: unknown }>;
    return {
      eventTypes: [
        ...new Set(
          rows.flatMap((row) => (typeof row.event_type === "string" && row.event_type.trim() ? [row.event_type] : [])),
        ),
      ],
      taskIds: [...new Set(rows.flatMap((row) => (typeof row.task_id === "string" ? [row.task_id] : [])))],
    };
  }

  listTaskIds(input: {
    after?: string | null;
    statuses?: ReadonlySet<"pending" | "running" | "waiting" | "attention" | "done"> | null;
    limit: number;
  }): string[] {
    const after = input.after ?? "";
    const statuses = input.statuses ? [...input.statuses] : [];
    const includeDone = !input.statuses || input.statuses.has("done");
    const livePhases = input.statuses
      ? statuses.flatMap((status) =>
          status === "done" ? ["converged"] : status === "pending" ? ["pending"] : [status],
        )
      : ["pending", "running", "waiting", "attention", "converged"];
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (livePhases.length > 0) {
      clauses.push(
        `SELECT task_id AS id FROM app_tasks
         WHERE app_id = ? AND task_id > ? AND phase IN (${livePhases.map(() => "?").join(", ")})
           AND NOT EXISTS (
             SELECT 1 FROM app_task_cancellations c
             WHERE c.app_id = app_tasks.app_id AND c.task_id = app_tasks.task_id
           )`,
      );
      values.push(this.appId, after, ...livePhases);
    }
    if (includeDone) {
      clauses.push("SELECT receipt_id AS id FROM app_task_receipts WHERE app_id = ? AND receipt_id > ?");
      values.push(this.appId, after);
    }
    if (clauses.length === 0) return [];
    values.push(Math.max(1, Math.floor(input.limit)));
    return (
      this.db.prepare(`SELECT id FROM (${clauses.join(" UNION ")}) ORDER BY id LIMIT ?`).all(...values) as Array<{
        id?: string;
      }>
    ).flatMap((row) => (row.id ? [row.id] : []));
  }

  private jsonMap<T>(table: string, key: string, column: string): Record<string, T> {
    return Object.fromEntries(
      (
        this.db.prepare(`SELECT ${key}, ${column} FROM ${table} WHERE app_id = ?`).all(this.appId) as Array<
          Record<string, unknown>
        >
      ).flatMap((row) =>
        typeof row[key] === "string" && typeof row[column] === "string"
          ? [[row[key] as string, parseJson<T>(row[column])]]
          : [],
      ),
    );
  }

  readSnapshot(): TaskTree {
    const rawMetadata = this.meta("app_metadata");
    if (!rawMetadata) throw new Error("Task resource store has no imported App metadata");
    const metadata = parseJson<Record<string, unknown>>(rawMetadata);
    const resources: Record<string, AppTaskResource> = {};
    const taskTriggers: Record<string, AppTaskTrigger> = {};
    for (const row of this.db
      .prepare("SELECT task_id, resource_json, trigger_json FROM app_tasks WHERE app_id = ?")
      .all(this.appId) as Array<{ task_id?: string; resource_json?: string; trigger_json?: string | null }>) {
      if (!row.task_id || !row.resource_json) continue;
      resources[row.task_id] = parseJson<AppTaskResource>(row.resource_json);
      if (row.trigger_json) taskTriggers[row.task_id] = parseJson<AppTaskTrigger>(row.trigger_json);
    }
    return {
      ...(typeof metadata.version === "number" ? { version: metadata.version } : {}),
      ...(typeof metadata.project === "string" ? { project: metadata.project } : {}),
      ...(typeof metadata.updated_at === "string" ? { updated_at: metadata.updated_at } : {}),
      ...(typeof metadata.project_lifecycle === "string" ? { project_lifecycle: metadata.project_lifecycle } : {}),
      ...(typeof metadata.root_task_id === "string" ? { root_task_id: metadata.root_task_id } : {}),
      resources,
      taskTriggers,
      attempts: this.jsonMap<AppTaskAttempt>("app_task_attempts", "attempt_id", "attempt_json"),
      conditions: this.jsonMap<AppTaskCondition>("app_task_conditions", "condition_id", "condition_json"),
      receipts: this.jsonMap<TaskCompletionReceipt>("app_task_receipts", "receipt_id", "receipt_json"),
      groups: Object.fromEntries(
        Object.entries(this.jsonMap<TaskGroup>("app_task_groups", "group_id", "group_json")).map(([id, group]) => [
          id,
          normalizeTaskGroup(id, group),
        ]),
      ),
      appTaskAdmissions: this.jsonMap<AppTaskAdmission>("app_task_admissions", "task_id", "admission_json"),
    };
  }

  /**
   * Read the bounded graph needed to reconcile named tasks. This includes
   * their parent chain, direct children, dependencies, attempts, Conditions,
   * and completed direct children, but never unrelated App history.
   */
  readTaskContext(input: {
    taskIds: Iterable<string>;
    admissionIds?: Iterable<string>;
    conditionIds?: Iterable<string>;
  }): TaskTree {
    const rawMetadata = this.meta("app_metadata");
    if (!rawMetadata) throw new Error("Task resource store has no imported App metadata");
    const metadata = parseJson<Record<string, unknown>>(rawMetadata);
    const requested = new Set([...input.taskIds].map((id) => id.trim()).filter(Boolean));
    const resources: Record<string, AppTaskResource> = {};
    const taskTriggers: Record<string, AppTaskTrigger> = {};
    const pending = new Set(requested);

    while (pending.size > 0) {
      const ids = [...pending];
      pending.clear();
      const rows = this.db
        .prepare(
          `SELECT task_id, resource_json, trigger_json FROM app_tasks
           WHERE app_id = ? AND task_id IN (${ids.map(() => "?").join(", ")})`,
        )
        .all(this.appId, ...ids) as Array<{
        task_id?: string;
        resource_json?: string;
        trigger_json?: string | null;
      }>;
      for (const row of rows) {
        if (!row.task_id || !row.resource_json || resources[row.task_id]) continue;
        const resource = parseJson<AppTaskResource>(row.resource_json);
        resources[row.task_id] = resource;
        if (row.trigger_json) taskTriggers[row.task_id] = parseJson<AppTaskTrigger>(row.trigger_json);
        for (const relatedId of [resource.spec.parentId, ...(resource.spec.dependsOn ?? [])]) {
          if (relatedId && !resources[relatedId]) pending.add(relatedId);
        }
      }
    }

    if (requested.size > 0) {
      const relatedTo = [...requested];
      const rows = this.db
        .prepare(
          `SELECT DISTINCT task.task_id, task.resource_json, task.trigger_json
           FROM app_task_relations relation
           JOIN app_tasks task
             ON task.app_id = relation.app_id AND task.task_id = relation.source_task_id
           WHERE relation.app_id = ?
             AND relation.target_task_id IN (${relatedTo.map(() => "?").join(", ")})`,
        )
        .all(this.appId, ...relatedTo) as Array<{
        task_id?: string;
        resource_json?: string;
        trigger_json?: string | null;
      }>;
      for (const row of rows) {
        if (!row.task_id || !row.resource_json) continue;
        resources[row.task_id] = parseJson<AppTaskResource>(row.resource_json);
        if (row.trigger_json) taskTriggers[row.task_id] = parseJson<AppTaskTrigger>(row.trigger_json);
      }
    }

    const requestedConditionIds = [...new Set([...(input.conditionIds ?? [])].map((id) => id.trim()).filter(Boolean))];
    if (requestedConditionIds.length > 0) {
      const rows = this.db
        .prepare(
          `SELECT DISTINCT task.task_id, task.resource_json, task.trigger_json
           FROM app_task_condition_routes route
           JOIN app_tasks task
             ON task.app_id = route.app_id AND task.task_id = route.task_id
           WHERE route.app_id = ?
             AND route.condition_id IN (${requestedConditionIds.map(() => "?").join(", ")})`,
        )
        .all(this.appId, ...requestedConditionIds) as Array<{
        task_id?: string;
        resource_json?: string;
        trigger_json?: string | null;
      }>;
      for (const row of rows) {
        if (!row.task_id || !row.resource_json) continue;
        resources[row.task_id] = parseJson<AppTaskResource>(row.resource_json);
        if (row.trigger_json) taskTriggers[row.task_id] = parseJson<AppTaskTrigger>(row.trigger_json);
      }
    }

    const taskIds = Object.keys(resources);
    const attempts = taskIds.length
      ? Object.fromEntries(
          (
            this.db
              .prepare(
                `SELECT attempt_id, attempt_json FROM (
                   SELECT attempt_id, attempt_json,
                     ROW_NUMBER() OVER (PARTITION BY task_id ORDER BY started_at DESC, attempt_id DESC) AS position
                   FROM app_task_attempts
                   WHERE app_id = ? AND task_id IN (${taskIds.map(() => "?").join(", ")})
                 ) WHERE position <= ?`,
              )
              .all(this.appId, ...taskIds, MAX_CONTEXT_ATTEMPTS_PER_TASK) as Array<{
              attempt_id?: string;
              attempt_json?: string;
            }>
          ).flatMap((row) =>
            row.attempt_id && row.attempt_json
              ? [[row.attempt_id, parseJson<AppTaskAttempt>(row.attempt_json)] as const]
              : [],
          ),
        )
      : {};
    const conditionIds = [
      ...new Set([
        ...Object.values(resources).flatMap((resource) => resource.status.conditionIds ?? []),
        ...(input.conditionIds ?? []),
      ]),
    ];
    const conditions = conditionIds.length
      ? Object.fromEntries(
          (
            this.db
              .prepare(
                `SELECT condition_id, condition_json FROM app_task_conditions
                 WHERE app_id = ? AND condition_id IN (${conditionIds.map(() => "?").join(", ")})`,
              )
              .all(this.appId, ...conditionIds) as Array<{ condition_id?: string; condition_json?: string }>
          ).flatMap((row) =>
            row.condition_id && row.condition_json
              ? [[row.condition_id, parseJson<AppTaskCondition>(row.condition_json)] as const]
              : [],
          ),
        )
      : {};
    const dependencyIds = new Set(Object.values(resources).flatMap((resource) => resource.spec.dependsOn ?? []));
    const receiptIds = new Set([...requested, ...dependencyIds]);
    const receiptRows = [
      ...(receiptIds.size
        ? (this.db
            .prepare(
              `SELECT receipt_id, receipt_json FROM app_task_receipts
               WHERE app_id = ? AND receipt_id IN (${[...receiptIds].map(() => "?").join(", ")})`,
            )
            .all(this.appId, ...receiptIds) as Array<{ receipt_id?: string; receipt_json?: string }>)
        : []),
      ...(requested.size
        ? (this.db
            .prepare(
              `SELECT receipt_id, receipt_json FROM app_task_receipts
               WHERE app_id = ? AND parent_id IN (${[...requested].map(() => "?").join(", ")})`,
            )
            .all(this.appId, ...requested) as Array<{ receipt_id?: string; receipt_json?: string }>)
        : []),
    ];
    const receipts = Object.fromEntries(
      receiptRows.flatMap((row) =>
        row.receipt_id && row.receipt_json
          ? [[row.receipt_id, parseJson<TaskCompletionReceipt>(row.receipt_json)] as const]
          : [],
      ),
    );
    const admissions = [...(input.admissionIds ?? [])];
    const appTaskAdmissions = admissions.length
      ? Object.fromEntries(
          (
            this.db
              .prepare(
                `SELECT task_id, admission_json FROM app_task_admissions
                 WHERE app_id = ? AND task_id IN (${admissions.map(() => "?").join(", ")})`,
              )
              .all(this.appId, ...admissions) as Array<{ task_id?: string; admission_json?: string }>
          ).flatMap((row) =>
            row.task_id && row.admission_json
              ? [[row.task_id, parseJson<AppTaskAdmission>(row.admission_json)] as const]
              : [],
          ),
        )
      : {};

    const groups: Record<string, TaskGroup> = {};
    let pendingGroupIds = [
      ...new Set([
        ...[...requested].filter((id) => !resources[id]),
        ...Object.values(resources).flatMap((resource) =>
          resource.spec.parentId && !resources[resource.spec.parentId] ? [resource.spec.parentId] : [],
        ),
      ]),
    ];
    while (pendingGroupIds.length > 0) {
      const rows = this.db
        .prepare(
          `SELECT group_id, group_json FROM app_task_groups
           WHERE app_id = ? AND group_id IN (${pendingGroupIds.map(() => "?").join(", ")})`,
        )
        .all(this.appId, ...pendingGroupIds) as Array<{ group_id?: string; group_json?: string }>;
      pendingGroupIds = [];
      for (const row of rows) {
        if (!row.group_id || !row.group_json || groups[row.group_id]) continue;
        const group = normalizeTaskGroup(row.group_id, parseJson<TaskGroup>(row.group_json));
        groups[row.group_id] = group;
        if (group.parent_id && !groups[group.parent_id] && !resources[group.parent_id]) {
          pendingGroupIds.push(group.parent_id);
        }
      }
    }

    return {
      ...(typeof metadata.version === "number" ? { version: metadata.version } : {}),
      ...(typeof metadata.project === "string" ? { project: metadata.project } : {}),
      ...(typeof metadata.updated_at === "string" ? { updated_at: metadata.updated_at } : {}),
      ...(typeof metadata.project_lifecycle === "string" ? { project_lifecycle: metadata.project_lifecycle } : {}),
      ...(typeof metadata.root_task_id === "string" ? { root_task_id: metadata.root_task_id } : {}),
      resources,
      taskTriggers,
      attempts,
      conditions,
      receipts,
      groups,
      appTaskAdmissions,
    };
  }

  listRecoveryCandidates(now = Date.now(), limit = 256, after?: IndexedTaskRecoveryCursor): IndexedTaskCandidatePage {
    const boundedLimit = Math.max(1, Math.min(10_000, Math.floor(limit)));
    const afterRank = after?.lane === "normal" ? 1 : 0;
    const afterClause = after
      ? `AND (
          CASE lane WHEN 'human' THEN 0 ELSE 1 END > ?
          OR (CASE lane WHEN 'human' THEN 0 ELSE 1 END = ? AND updated_at > ?)
          OR (CASE lane WHEN 'human' THEN 0 ELSE 1 END = ? AND updated_at = ? AND task_id > ?)
        )`
      : "";
    const fields = `task_id, lane, ready, changed, next_check_at, lease_until, updated_at`;
    const branchValues = (dueAt?: number): unknown[] => [
      this.appId,
      ...(dueAt === undefined ? [] : [dueAt]),
      ...(after ? [afterRank, afterRank, after.updatedAt, afterRank, after.updatedAt, after.taskId] : []),
    ];
    const rows = this.db
      .prepare(
        `SELECT * FROM (
           SELECT ${fields} FROM app_tasks INDEXED BY idx_app_tasks_ready
             WHERE app_id = ? AND ready = 1
               AND NOT EXISTS (
                 SELECT 1 FROM app_task_cancellations cancelled
                 WHERE cancelled.app_id = app_tasks.app_id AND cancelled.task_id = app_tasks.task_id
               ) ${afterClause}
           UNION
           SELECT ${fields} FROM app_tasks INDEXED BY idx_app_tasks_changed
             WHERE app_id = ? AND changed = 1
               AND NOT EXISTS (
                 SELECT 1 FROM app_task_cancellations cancelled
                 WHERE cancelled.app_id = app_tasks.app_id AND cancelled.task_id = app_tasks.task_id
               ) ${afterClause}
           UNION
           SELECT ${fields} FROM app_tasks INDEXED BY idx_app_tasks_due
             WHERE app_id = ? AND next_check_at <= ?
               AND NOT EXISTS (
                 SELECT 1 FROM app_task_cancellations cancelled
                 WHERE cancelled.app_id = app_tasks.app_id AND cancelled.task_id = app_tasks.task_id
               ) ${afterClause}
           UNION
           SELECT ${fields} FROM app_tasks INDEXED BY idx_app_tasks_expired
             WHERE app_id = ? AND lease_until <= ?
               AND NOT EXISTS (
                 SELECT 1 FROM app_task_cancellations cancelled
                 WHERE cancelled.app_id = app_tasks.app_id AND cancelled.task_id = app_tasks.task_id
               ) ${afterClause}
         )
         ORDER BY CASE lane WHEN 'human' THEN 0 ELSE 1 END, updated_at, task_id LIMIT ?`,
      )
      .all(...branchValues(), ...branchValues(), ...branchValues(now), ...branchValues(now), boundedLimit) as Array<
      Record<string, unknown>
    >;
    const items: IndexedTaskCandidate[] = rows.map((row) => ({
      taskId: String(row.task_id),
      lane: row.lane === "human" ? "human" : "normal",
      ready: row.ready === 1,
      changed: row.changed === 1,
      nextCheckAt: typeof row.next_check_at === "number" ? row.next_check_at : null,
      leaseUntil: typeof row.lease_until === "number" ? row.lease_until : null,
    }));
    const last = rows.at(-1);
    return {
      items,
      nextCursor:
        rows.length === boundedLimit && last
          ? {
              lane: last.lane === "human" ? "human" : "normal",
              updatedAt: Number(last.updated_at),
              taskId: String(last.task_id),
            }
          : null,
    };
  }

  nextDueAt(): number | null {
    const row = this.db
      .prepare(
        `SELECT MIN(next_check_at) AS due_at FROM app_tasks
         WHERE app_id = ? AND next_check_at IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM app_task_cancellations cancelled
             WHERE cancelled.app_id = app_tasks.app_id AND cancelled.task_id = app_tasks.task_id
           )`,
      )
      .get(this.appId) as { due_at?: number | null } | null;
    return typeof row?.due_at === "number" ? row.due_at : null;
  }

  listTaskIdsByPhase(phases: readonly string[], limit = 256): string[] {
    if (phases.length === 0) return [];
    const boundedLimit = Math.max(1, Math.min(10_000, Math.floor(limit)));
    return (
      this.db
        .prepare(
          `SELECT task_id FROM app_tasks
           WHERE app_id = ? AND phase IN (${phases.map(() => "?").join(", ")})
             AND NOT EXISTS (
               SELECT 1 FROM app_task_cancellations c
               WHERE c.app_id = app_tasks.app_id AND c.task_id = app_tasks.task_id
             )
           ORDER BY updated_at, task_id LIMIT ?`,
        )
        .all(this.appId, ...phases, boundedLimit) as Array<{ task_id?: string }>
    ).flatMap((row) => (row.task_id ? [row.task_id] : []));
  }

  hasUnfinishedTasks(): boolean {
    return Boolean(
      this.db
        .prepare(
          `SELECT 1 AS unfinished FROM app_tasks
           WHERE app_id = ? AND phase <> 'converged'
             AND NOT EXISTS (
               SELECT 1 FROM app_task_cancellations c
               WHERE c.app_id = app_tasks.app_id AND c.task_id = app_tasks.task_id
             )
           LIMIT 1`,
        )
        .get(this.appId),
    );
  }

  /** Exact failed attempts that one later successful agent session may repair. */
  listHandlerExecutionRecoveryTaskIds(agent: string, limit = 256): string[] {
    const normalizedAgent = agent.trim();
    if (!normalizedAgent) return [];
    const boundedLimit = Math.max(1, Math.min(10_000, Math.floor(limit)));
    return (
      this.db
        .prepare(
          `SELECT failed.task_id
           FROM app_task_attempts failed INDEXED BY idx_app_task_attempts_execution_failure
           JOIN app_tasks task
             ON task.app_id = failed.app_id AND task.task_id = failed.task_id
           WHERE failed.app_id = ?
             AND json_extract(failed.attempt_json, '$.owner') = ?
             AND json_extract(failed.attempt_json, '$.failureReason')
               IN ('HandlerExecutionFailed', 'handler-blocked')
             AND task.phase = 'attention'
             AND failed.task_generation = task.generation
             AND typeof(json_extract(failed.attempt_json, '$.finishedAt')) = 'text'
             AND json_extract(failed.attempt_json, '$.finishedAt') <> ''
             AND typeof(json_extract(failed.attempt_json, '$.sessionId')) = 'text'
             AND json_extract(failed.attempt_json, '$.sessionId') <> ''
             AND (
               json_extract(failed.attempt_json, '$.failureReason') = 'HandlerExecutionFailed'
               OR json_extract(failed.attempt_json, '$.handler') =
                 'owner:' || json_extract(failed.attempt_json, '$.owner')
             )
             AND failed.attempt_id = (
               SELECT latest.attempt_id
               FROM app_task_attempts latest INDEXED BY idx_app_task_attempts_task
               WHERE latest.app_id = failed.app_id
                 AND latest.task_id = failed.task_id
                 AND latest.task_generation = failed.task_generation
               ORDER BY latest.started_at DESC, latest.attempt_id DESC
               LIMIT 1
             )
             AND NOT EXISTS (
               SELECT 1 FROM app_task_cancellations cancelled
               WHERE cancelled.app_id = task.app_id AND cancelled.task_id = task.task_id
             )
           ORDER BY failed.started_at, failed.task_id
           LIMIT ?`,
        )
        .all(this.appId, normalizedAgent, boundedLimit) as Array<{ task_id?: string }>
    ).flatMap((row) => (row.task_id ? [row.task_id] : []));
  }

  listLiveTaskIds(excludeTaskId: string, limit = 64): string[] {
    const boundedLimit = Math.max(1, Math.min(1_000, Math.floor(limit)));
    return (
      this.db
        .prepare(
          `SELECT task_id FROM app_tasks
           WHERE app_id = ? AND task_id <> ? AND phase <> 'converged'
             AND NOT EXISTS (
               SELECT 1 FROM app_task_cancellations c
               WHERE c.app_id = app_tasks.app_id AND c.task_id = app_tasks.task_id
             )
           ORDER BY updated_at DESC, task_id LIMIT ?`,
        )
        .all(this.appId, excludeTaskId, boundedLimit) as Array<{ task_id?: string }>
    ).flatMap((row) => (row.task_id ? [row.task_id] : []));
  }

  /** Fenced single-task update; no App-wide state is read or serialized. */
  replaceTask(input: {
    expectedResourceVersion: number;
    resource: AppTaskResource;
    trigger?: AppTaskTrigger;
    ready: boolean;
    nextCheckAt?: number | null;
  }): boolean {
    return this.commit({
      fences: [{ taskId: input.resource.metadata.id, resourceVersion: input.expectedResourceVersion }],
      tasks: [input],
    });
  }

  /** Apply one bounded transition after checking every named task fence. */
  commit(mutation: AppTaskResourceMutation): boolean {
    if (!mutation.fences.length && !mutation.expectMissingTaskIds?.length) {
      throw new Error("Task resource mutation requires at least one existing or missing-task fence");
    }
    return transaction(this.db, () => {
      for (const fence of mutation.fences) {
        const current = this.db
          .prepare(
            `SELECT resource_version, generation, current_attempt_id
             FROM app_tasks WHERE app_id = ? AND task_id = ?`,
          )
          .get(this.appId, fence.taskId) as {
          resource_version?: number;
          generation?: number;
          current_attempt_id?: string | null;
        } | null;
        if (
          current?.resource_version !== fence.resourceVersion ||
          (fence.generation !== undefined && current.generation !== fence.generation) ||
          (fence.currentAttemptId !== undefined && current.current_attempt_id !== fence.currentAttemptId)
        ) {
          return false;
        }
      }
      for (const taskId of new Set(mutation.expectMissingTaskIds ?? [])) {
        const existing = this.db
          .prepare("SELECT 1 AS present FROM app_tasks WHERE app_id = ? AND task_id = ?")
          .get(this.appId, taskId);
        if (existing) return false;
      }

      for (const taskId of new Set(mutation.deleteTaskIds ?? [])) {
        this.db
          .prepare("DELETE FROM app_task_condition_routes WHERE app_id = ? AND task_id = ?")
          .run(this.appId, taskId);
        this.db.prepare("DELETE FROM app_tasks WHERE app_id = ? AND task_id = ?").run(this.appId, taskId);
      }
      for (const write of mutation.tasks ?? []) {
        this.putTask(write.resource, write.trigger, write.ready, write.nextCheckAt ?? null);
        this.db
          .prepare("DELETE FROM app_task_events WHERE app_id = ? AND task_id = ?")
          .run(this.appId, write.resource.metadata.id);
        const trigger = write.trigger;
        for (const entry of trigger?.events ??
          (trigger ? [{ event: trigger.event, observedAt: trigger.observedAt }] : [])) {
          this.db
            .prepare(
              `INSERT OR IGNORE INTO app_task_events(app_id, task_id, event_key, observed_at, event_json)
             VALUES (?, ?, ?, ?, ?)`,
            )
            .run(
              this.appId,
              write.resource.metadata.id,
              eventKey(entry.event),
              epoch(entry.observedAt) ?? 0,
              json(entry.event),
            );
        }
      }
      for (const attemptId of new Set(mutation.deleteAttemptIds ?? [])) {
        this.db.prepare("DELETE FROM app_task_attempts WHERE app_id = ? AND attempt_id = ?").run(this.appId, attemptId);
      }
      for (const attempt of mutation.attempts ?? []) {
        this.db
          .prepare(
            `INSERT INTO app_task_attempts(
             app_id, attempt_id, task_id, task_generation, state, lease_until, started_at, attempt_json
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(app_id, attempt_id) DO UPDATE SET
             task_id=excluded.task_id, task_generation=excluded.task_generation,
             state=excluded.state, lease_until=excluded.lease_until,
             started_at=excluded.started_at, attempt_json=excluded.attempt_json`,
          )
          .run(
            this.appId,
            attempt.metadata.id,
            attempt.taskId,
            attempt.taskGeneration,
            attempt.state,
            epoch(attempt.lease?.expiresAt),
            epoch(attempt.startedAt) ?? 0,
            json(attempt),
          );
        if (attempt.state === "running") {
          this.db
            .prepare("UPDATE app_tasks SET lease_until = ? WHERE app_id = ? AND task_id = ? AND current_attempt_id = ?")
            .run(epoch(attempt.lease?.expiresAt), this.appId, attempt.taskId, attempt.metadata.id);
        }
      }
      for (const conditionId of new Set(mutation.deleteConditionIds ?? [])) {
        this.db
          .prepare("DELETE FROM app_task_condition_routes WHERE app_id = ? AND condition_id = ?")
          .run(this.appId, conditionId);
        this.db
          .prepare("DELETE FROM app_task_conditions WHERE app_id = ? AND condition_id = ?")
          .run(this.appId, conditionId);
      }
      for (const condition of mutation.conditions ?? []) {
        this.db
          .prepare(
            `INSERT INTO app_task_conditions(app_id, condition_id, state, condition_json) VALUES (?, ?, ?, ?)
           ON CONFLICT(app_id, condition_id) DO UPDATE SET
             state=excluded.state, condition_json=excluded.condition_json`,
          )
          .run(this.appId, condition.metadata.id, condition.status.state, json(condition));
      }
      for (const write of mutation.tasks ?? []) this.putTaskConditionRoutes(write.resource);
      for (const conditionId of new Set(mutation.pruneConditionIds ?? [])) {
        this.db
          .prepare(
            `DELETE FROM app_task_conditions
             WHERE app_id = ? AND condition_id = ?
               AND NOT EXISTS (
                 SELECT 1 FROM app_task_condition_routes route
                 WHERE route.app_id = app_task_conditions.app_id
                   AND route.condition_id = app_task_conditions.condition_id
               )`,
          )
          .run(this.appId, conditionId);
      }
      for (const receiptId of new Set(mutation.deleteReceiptIds ?? [])) {
        this.db.prepare("DELETE FROM app_task_receipts WHERE app_id = ? AND receipt_id = ?").run(this.appId, receiptId);
      }
      for (const receipt of mutation.receipts ?? []) {
        this.db
          .prepare(
            `INSERT INTO app_task_receipts(app_id, receipt_id, parent_id, completed_at, receipt_json)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(app_id, receipt_id) DO UPDATE SET
             parent_id=excluded.parent_id, completed_at=excluded.completed_at, receipt_json=excluded.receipt_json`,
          )
          .run(this.appId, receipt.metadata.id, receipt.parentId, epoch(receipt.completedAt) ?? 0, json(receipt));
        indexTaskReference(this.db, this.appId, receipt.metadata.id);
      }
      for (const admissionId of new Set(mutation.deleteAdmissionIds ?? [])) {
        this.db
          .prepare("DELETE FROM app_task_admissions WHERE app_id = ? AND task_id = ?")
          .run(this.appId, admissionId);
      }
      for (const admission of mutation.admissions ?? []) {
        this.db
          .prepare(
            `INSERT INTO app_task_admissions(app_id, task_id, admission_json) VALUES (?, ?, ?)
           ON CONFLICT(app_id, task_id) DO UPDATE SET admission_json=excluded.admission_json`,
          )
          .run(this.appId, admission.taskId, json(admission.value));
      }
      this.bumpRevision();
      return true;
    });
  }

  setRecoveryState(
    taskId: string,
    input: { ready?: boolean; changed?: boolean; nextCheckAt?: number | null },
  ): boolean {
    const assignments: string[] = [];
    const assignmentValues: unknown[] = [];
    const changedPredicates: string[] = [];
    const expectedValues: unknown[] = [];
    if (input.ready !== undefined) {
      assignments.push("ready = ?");
      assignmentValues.push(input.ready ? 1 : 0);
      changedPredicates.push("ready IS NOT ?");
      expectedValues.push(input.ready ? 1 : 0);
    }
    if (input.changed !== undefined) {
      assignments.push("changed = ?");
      assignmentValues.push(input.changed ? 1 : 0);
      changedPredicates.push("changed IS NOT ?");
      expectedValues.push(input.changed ? 1 : 0);
    }
    if (input.nextCheckAt !== undefined) {
      assignments.push("next_check_at = ?");
      assignmentValues.push(input.nextCheckAt);
      changedPredicates.push("next_check_at IS NOT ?");
      expectedValues.push(input.nextCheckAt);
    }
    if (!assignments.length) return false;
    const changed =
      this.db
        .prepare(
          `UPDATE app_tasks SET ${assignments.join(", ")}
           WHERE app_id = ? AND task_id = ?
             AND (${changedPredicates.join(" OR ")})
             AND NOT EXISTS (
               SELECT 1 FROM app_task_cancellations cancelled
               WHERE cancelled.app_id = app_tasks.app_id AND cancelled.task_id = app_tasks.task_id
             )`,
        )
        .run(...assignmentValues, this.appId, taskId, ...expectedValues).changes > 0;
    return changed;
  }

  shadowCompare(treeInput: TaskTree): string[] {
    const tree = normalizeTaskStateInPlace(structuredClone(treeInput));
    const snapshot = this.readSnapshot();
    const mismatches: string[] = [];
    const registries: Array<[string, unknown, unknown]> = [
      ["resources", tree.resources ?? {}, snapshot.resources ?? {}],
      ["triggers", tree.taskTriggers ?? {}, snapshot.taskTriggers ?? {}],
      ["attempts", tree.attempts ?? {}, snapshot.attempts ?? {}],
      ["conditions", tree.conditions ?? {}, snapshot.conditions ?? {}],
      ["receipts", tree.receipts ?? {}, snapshot.receipts ?? {}],
      ["groups", tree.groups ?? {}, snapshot.groups ?? {}],
      ["admissions", tree.appTaskAdmissions ?? {}, snapshot.appTaskAdmissions ?? {}],
    ];
    for (const [name, source, stored] of registries) if (json(source) !== json(stored)) mismatches.push(name);
    if (tree.project !== snapshot.project) mismatches.push("metadata:project");
    if (tree.project_lifecycle !== snapshot.project_lifecycle) mismatches.push("metadata:lifecycle");
    if (tree.root_task_id !== snapshot.root_task_id) mismatches.push("metadata:root-task");
    return mismatches.sort();
  }
}

function appIdFor(config: TaskStateConfig, tree: TaskTree): string {
  return (tree.project?.trim() || basename(config.appDir).replace(/\.app$/, "")).replace(/\.app$/, "");
}

export function importPausedTaskStateToResourceStore(
  config: TaskStateConfig,
  persistDir: string,
  readyTaskIds: Iterable<string> = [],
  options: { activate?: boolean; expectedSourceRevision?: string } = {},
): { appId: string; sourceRevision: string; mismatches: string[] } {
  return withTaskStateLock(config, () => {
    const tree = readTaskState(config);
    const runningAttempts = Object.values(tree.attempts ?? {}).filter((attempt) => attempt.state === "running");
    if (runningAttempts.length) {
      throw new Error(
        `Task resource migration requires drained attempts; still running: ${runningAttempts
          .slice(0, 8)
          .map((attempt) => attempt.metadata.id)
          .join(", ")}`,
      );
    }
    const sourceRevision = createHash("sha256").update(readFileSync(config.statePath)).digest("hex");
    if (options.expectedSourceRevision && sourceRevision !== options.expectedSourceRevision) {
      throw new Error(
        `Task resource source revision mismatch: expected ${options.expectedSourceRevision}, found ${sourceRevision}`,
      );
    }
    const appId = appIdFor(config, tree);
    const store = AppTaskResourceStore.fromDb(getDb(persistDir), appId);
    store.importPausedSnapshot(tree, sourceRevision, readyTaskIds);
    const mismatches = store.shadowCompare(tree);
    if (options.activate) {
      if (mismatches.length) throw new Error(`Task resource shadow comparison failed: ${mismatches.join(", ")}`);
      const currentRevision = createHash("sha256").update(readFileSync(config.statePath)).digest("hex");
      if (currentRevision !== sourceRevision) throw new Error("Task state changed during resource activation");
      store.activate(sourceRevision);
    }
    return { appId, sourceRevision, mismatches };
  });
}
