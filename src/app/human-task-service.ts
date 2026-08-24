import type { AppRegistry } from "./app-registry.js";
import type { AppTaskAttempt, AppTaskCondition, AppTaskResource } from "./app-task-state.js";
import type { TaskCompletionReceipt } from "./app-task-store.js";
import type { SqliteDb } from "../lib/db.js";
import {
  displayTaskReferences,
  ensureTaskReferenceIndex,
  resolveTaskReference,
  taskReferenceDigest,
  type ResolvedTaskReference,
} from "./task-reference-index.js";

export type HumanTaskStatus = "pending" | "running" | "waiting" | "attention" | "done" | "cancelled";

export type HumanTaskProgress = {
  stage: string;
  message?: string;
  status?: string;
  updatedAt: number;
};

export type HumanTaskView = {
  appId: string;
  taskId: string;
  ref: string;
  status: HumanTaskStatus;
  generation: number;
  resourceVersion: number;
  outcome: string;
  summary?: string;
  response?: string;
  evidence?: string[];
  updatedAt: number;
  terminal: boolean;
  cancellable: boolean;
  execution?: { attemptId: string; sessionId?: string };
  progress?: HumanTaskProgress;
  waitingOn?: HumanTaskWait[];
};

export type HumanTaskWait =
  | {
      kind: "task";
      appId: string;
      taskId: string;
      ref: string;
      status: HumanTaskStatus;
      outcome: string;
    }
  | { kind: "app"; appId: string; status: "pending" | "running" | "waiting" }
  | { kind: "condition"; type: string; subject: string };

export type HumanTaskPage = { items: HumanTaskView[]; nextCursor?: string };

/** List cards stay small; `/task <ref>` is the exact detail read. */
export const HUMAN_TASK_LIST_TEXT_MAX_BYTES = 96;

export type HumanAppView = {
  id: string;
  owner: string;
  description?: string;
  activeTasks: number;
  attentionTasks: number;
  runningTasks: number;
  waitingTasks: number;
};

type TaskRow = {
  app_id?: string;
  task_id?: string;
  phase?: string;
  updated_at?: number;
  payload?: string;
  terminal?: number;
  attempt_json?: string | null;
};

type TaskProgressRow = { data?: string | null; timestamp?: number };

type TaskCursor = { updatedAt: number; appId: string; taskId: string; terminal: number };

type TaskCancellation = {
  appId: string;
  taskId: string;
  generation: number;
  resourceVersion: number;
  outcome: string;
  reason: string;
  summary: string;
  cancelledAt: string;
};

function parseJson<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function latestTaskProgress(db: SqliteDb, appId: string, taskId: string): HumanTaskProgress | null {
  let row: TaskProgressRow | null;
  try {
    row = db
      .prepare(
        `SELECT data, timestamp
         FROM events
         WHERE event_type = 'project.task.executor.progress'
           AND project_id = ? AND task_id = ?
           AND length(trim(coalesce(json_extract(data, '$.message'), ''))) > 0
         ORDER BY id DESC
         LIMIT 1`,
      )
      .get(appId, taskId) as TaskProgressRow | null;
  } catch {
    // Progress is optional observation. A missing or unavailable Event store
    // must not break the authoritative Task read or cancellation path.
    return null;
  }
  const data = parseJson<Record<string, unknown>>(row?.data);
  const rawStage = typeof data?.stage === "string" ? data.stage.trim() : "";
  const updatedAt = Number(row?.timestamp);
  if (!rawStage || !Number.isSafeInteger(updatedAt)) return null;
  const message = typeof data?.message === "string" ? data.message.trim() : "";
  const status = typeof data?.status === "string" ? data.status.trim() : "";
  return {
    stage: boundedUtf8Text(rawStage, 64),
    ...(message ? { message: boundedUtf8Text(message, 2_000) } : {}),
    ...(status ? { status: boundedUtf8Text(status, 64) } : {}),
    updatedAt,
  };
}

function encodeCursor(cursor: TaskCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(value: string): TaskCursor {
  try {
    const decoded = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<TaskCursor>;
    if (
      !Number.isSafeInteger(decoded.updatedAt) ||
      typeof decoded.appId !== "string" ||
      !decoded.appId ||
      typeof decoded.taskId !== "string" ||
      !decoded.taskId ||
      !(decoded.terminal === 0 || decoded.terminal === 1 || decoded.terminal === 2)
    ) {
      throw new Error("invalid cursor fields");
    }
    return decoded as TaskCursor;
  } catch {
    throw new Error("Invalid Task cursor");
  }
}

function normalizeAppId(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/\.app$/, "");
  return normalized || undefined;
}

function taskStatus(phase: string | undefined, terminal: boolean): HumanTaskStatus {
  if (terminal || phase === "converged") return "done";
  if (phase === "pending" || phase === "running" || phase === "waiting" || phase === "attention") return phase;
  throw new Error(`Invalid Task phase: ${String(phase)}`);
}

function boundedUtf8Text(value: string, maxBytes: number): string {
  if (Buffer.byteLength(value, "utf8") <= maxBytes) return value;
  const suffix = "…";
  const budget = maxBytes - Buffer.byteLength(suffix, "utf8");
  let bytes = 0;
  let result = "";
  for (const character of value) {
    const size = Buffer.byteLength(character, "utf8");
    if (bytes + size > budget) break;
    result += character;
    bytes += size;
  }
  return result + suffix;
}

function listCard(view: HumanTaskView): HumanTaskView {
  const { response: _response, evidence: _evidence, ...card } = view;
  return {
    ...card,
    outcome: boundedUtf8Text(view.outcome, HUMAN_TASK_LIST_TEXT_MAX_BYTES),
    ...(view.summary ? { summary: boundedUtf8Text(view.summary, HUMAN_TASK_LIST_TEXT_MAX_BYTES) } : {}),
  };
}

function projectTask(row: TaskRow, ref: string, detail = true): HumanTaskView | null {
  const appId = row.app_id;
  const taskId = row.task_id;
  if (!appId || !taskId) return null;
  const terminal = row.terminal !== 0;
  if (row.terminal === 2) {
    const cancellation = parseJson<TaskCancellation>(row.payload);
    if (!cancellation) return null;
    const view: HumanTaskView = {
      appId,
      taskId,
      ref,
      status: "cancelled",
      generation: cancellation.generation,
      resourceVersion: cancellation.resourceVersion,
      outcome: cancellation.outcome,
      summary: cancellation.summary,
      updatedAt: row.updated_at ?? Date.parse(cancellation.cancelledAt),
      terminal: true,
      cancellable: false,
    };
    return detail ? view : listCard(view);
  }
  if (terminal) {
    const receipt = parseJson<TaskCompletionReceipt>(row.payload);
    if (!receipt) return null;
    const view: HumanTaskView = {
      appId,
      taskId,
      ref,
      status: "done",
      generation: receipt.metadata.generation,
      resourceVersion: receipt.metadata.resourceVersion,
      outcome: receipt.outcome,
      summary: receipt.summary,
      ...(receipt.response ? { response: receipt.response } : {}),
      ...(receipt.evidence ? { evidence: [...receipt.evidence] } : {}),
      updatedAt: row.updated_at ?? Date.parse(receipt.completedAt),
      terminal: true,
      cancellable: false,
    };
    return detail ? view : listCard(view);
  }
  const resource = parseJson<AppTaskResource>(row.payload);
  if (!resource) return null;
  const attempt = parseJson<AppTaskAttempt>(row.attempt_json);
  const view: HumanTaskView = {
    appId,
    taskId,
    ref,
    status: taskStatus(row.phase, false),
    generation: resource.metadata.generation,
    resourceVersion: resource.metadata.resourceVersion,
    outcome: resource.spec.outcome,
    ...(resource.status.summary ? { summary: resource.status.summary } : {}),
    ...(resource.status.response ? { response: resource.status.response } : {}),
    ...(resource.status.evidence ? { evidence: [...resource.status.evidence] } : {}),
    updatedAt: row.updated_at ?? Date.parse(resource.status.updatedAt),
    terminal: false,
    cancellable: resource.spec.mode !== "maintain",
    ...(resource.status.currentAttemptId
      ? {
          execution: {
            attemptId: resource.status.currentAttemptId,
            ...(attempt?.sessionId ? { sessionId: attempt.sessionId } : {}),
          },
        }
      : {}),
  };
  return detail ? view : listCard(view);
}

function rowIdentity(row: TaskRow): { appId: string; taskId: string } | null {
  return row.app_id && row.task_id ? { appId: row.app_id, taskId: row.task_id } : null;
}

function readTaskRow(db: SqliteDb, appId: string, taskId: string): TaskRow | null {
  return db
    .prepare(
      `SELECT t.app_id, t.task_id, t.phase, t.updated_at, t.resource_json AS payload, 0 AS terminal,
         a.attempt_json
       FROM app_tasks t
       LEFT JOIN app_task_attempts a
         ON a.app_id = t.app_id AND a.attempt_id = t.current_attempt_id
       WHERE t.app_id = ? AND t.task_id = ?
       UNION ALL
       SELECT r.app_id, r.receipt_id AS task_id, 'done' AS phase, r.completed_at AS updated_at,
         r.receipt_json AS payload, 1 AS terminal, NULL AS attempt_json
       FROM app_task_receipts r
       WHERE r.app_id = ? AND r.receipt_id = ?
       UNION ALL
       SELECT c.app_id, c.task_id, 'cancelled' AS phase, c.requested_at AS updated_at,
         c.cancellation_json AS payload, 2 AS terminal, NULL AS attempt_json
       FROM app_task_cancellations c
       WHERE c.app_id = ? AND c.task_id = ?
       ORDER BY terminal DESC LIMIT 1`,
    )
    .get(appId, taskId, appId, taskId, appId, taskId) as TaskRow | null;
}

function taskWaits(db: SqliteDb, appId: string, taskId: string): HumanTaskWait[] {
  const rows = db
    .prepare(
      `SELECT condition.condition_json
       FROM app_task_condition_routes route
       JOIN app_task_conditions condition
         ON condition.app_id = route.app_id AND condition.condition_id = route.condition_id
       WHERE route.app_id = ? AND route.task_id = ? AND condition.state != 'true'
       ORDER BY route.condition_id
       LIMIT 20`,
    )
    .all(appId, taskId) as Array<{ condition_json?: string }>;
  const conditions = rows.flatMap((row) => {
    const condition = parseJson<AppTaskCondition>(row.condition_json);
    return condition ? [condition] : [];
  });
  const taskIdentities: Array<{ appId: string; taskId: string }> = [];
  const unresolved: HumanTaskWait[] = [];
  for (const condition of conditions) {
    const requestId =
      condition.spec.type === "app.dependency.completed" && condition.spec.subject.startsWith("id:")
        ? condition.spec.subject.slice(3)
        : "";
    const request = requestId
      ? (db
          .prepare(
            "SELECT app_id, status, lease_owner, waiting_on_kind, waiting_on_id FROM app_inbox_items WHERE id = ?",
          )
          .get(requestId) as {
          app_id?: string;
          status?: string;
          lease_owner?: string | null;
          waiting_on_kind?: string | null;
          waiting_on_id?: string | null;
        } | null)
      : null;
    if (request?.app_id && request.waiting_on_kind === "task" && request.waiting_on_id) {
      taskIdentities.push({ appId: request.app_id, taskId: request.waiting_on_id });
      continue;
    }
    if (request?.app_id) {
      unresolved.push({
        kind: "app",
        appId: request.app_id,
        status: request.status === "pending" ? "pending" : request.lease_owner ? "running" : "waiting",
      });
      continue;
    }
    unresolved.push({
      kind: "condition",
      type: condition.spec.type,
      subject: requestId ? "responsible App request" : condition.spec.subject,
    });
  }
  const refs = displayTaskReferences(db, taskIdentities);
  const tasks = taskIdentities.flatMap((identity) => {
    const row = readTaskRow(db, identity.appId, identity.taskId);
    const ref = refs.get(`${identity.appId}\0${identity.taskId}`);
    const view = row && ref ? projectTask(row, ref, false) : null;
    return view
      ? [
          {
            kind: "task" as const,
            appId: view.appId,
            taskId: view.taskId,
            ref: view.ref,
            status: view.status,
            outcome: view.outcome,
          },
        ]
      : [];
  });
  return [...tasks, ...unresolved];
}

export class HumanTaskService {
  constructor(
    private readonly db: SqliteDb,
    private readonly registry: Pick<AppRegistry, "snapshot">,
    private readonly options: {
      onCancelled?: (input: { appId: string; taskId: string; sessionId?: string; reason: string }) => void;
    } = {},
  ) {
    ensureTaskReferenceIndex(db);
  }

  listApps(appId?: string): HumanAppView[] {
    const selected = normalizeAppId(appId);
    const counts = this.db
      .prepare(
        `SELECT app_id,
           COUNT(*) AS active_tasks,
           SUM(CASE WHEN phase = 'attention' THEN 1 ELSE 0 END) AS attention_tasks,
           SUM(CASE WHEN phase = 'running' THEN 1 ELSE 0 END) AS running_tasks,
           SUM(CASE WHEN phase = 'waiting' THEN 1 ELSE 0 END) AS waiting_tasks
         FROM app_tasks
         WHERE phase IN ('pending', 'running', 'waiting', 'attention')
           AND NOT EXISTS (
             SELECT 1 FROM app_task_cancellations c
             WHERE c.app_id = app_tasks.app_id AND c.task_id = app_tasks.task_id
           )
         GROUP BY app_id`,
      )
      .all() as Array<Record<string, unknown>>;
    const byApp = new Map(counts.map((row) => [String(row.app_id), row]));
    return this.registry.snapshot().entries.flatMap((entry) => {
      const definition = entry.definition;
      if (selected && definition.id !== selected) return [];
      const count = byApp.get(definition.id);
      return [
        {
          id: definition.id,
          owner: definition.owner,
          ...(definition.description ? { description: definition.description } : {}),
          activeTasks: Number(count?.active_tasks ?? 0),
          attentionTasks: Number(count?.attention_tasks ?? 0),
          runningTasks: Number(count?.running_tasks ?? 0),
          waitingTasks: Number(count?.waiting_tasks ?? 0),
        },
      ];
    });
  }

  listTasks(
    input: {
      appId?: string;
      includeDone?: boolean;
      status?: HumanTaskStatus[];
      limit?: number;
      cursor?: string;
    } = {},
  ): HumanTaskPage {
    const limit = input.limit ?? 30;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new Error("Task list limit must be an integer between 1 and 100");
    }
    const valid = new Set<HumanTaskStatus>(["pending", "running", "waiting", "attention", "done", "cancelled"]);
    if (input.status?.some((status) => !valid.has(status))) throw new Error("Invalid Task status filter");
    const statuses = input.status ? new Set(input.status) : null;
    const includeLive = !statuses || [...statuses].some((status) => status !== "done" && status !== "cancelled");
    const includeDone = input.includeDone === true || statuses?.has("done") === true;
    const includeCancelled = input.includeDone === true || statuses?.has("cancelled") === true;
    const livePhases = statuses
      ? [...statuses].flatMap((status) => (status === "done" || status === "cancelled" ? [] : [status]))
      : ["pending", "running", "waiting", "attention"];
    const appId = normalizeAppId(input.appId);
    const parts: string[] = [];
    const values: unknown[] = [];
    if (includeLive && livePhases.length > 0) {
      parts.push(
        `SELECT t.app_id, t.task_id, t.phase, t.updated_at, t.resource_json AS payload, 0 AS terminal,
           a.attempt_json
         FROM app_tasks t
         LEFT JOIN app_task_attempts a
           ON a.app_id = t.app_id AND a.attempt_id = t.current_attempt_id
         WHERE t.phase IN (${livePhases.map(() => "?").join(", ")})
           AND NOT EXISTS (
             SELECT 1 FROM app_task_cancellations c WHERE c.app_id = t.app_id AND c.task_id = t.task_id
           )${appId ? " AND t.app_id = ?" : ""}`,
      );
      values.push(...livePhases, ...(appId ? [appId] : []));
    }
    if (includeDone) {
      parts.push(
        `SELECT r.app_id, r.receipt_id AS task_id, 'done' AS phase, r.completed_at AS updated_at,
           r.receipt_json AS payload, 1 AS terminal, NULL AS attempt_json
         FROM app_task_receipts r
         WHERE NOT EXISTS (
           SELECT 1 FROM app_task_cancellations c WHERE c.app_id = r.app_id AND c.task_id = r.receipt_id
         )${appId ? " AND r.app_id = ?" : ""}`,
      );
      if (appId) values.push(appId);
    }
    if (includeCancelled) {
      parts.push(
        `SELECT c.app_id, c.task_id, 'cancelled' AS phase, c.requested_at AS updated_at,
           c.cancellation_json AS payload, 2 AS terminal, NULL AS attempt_json
         FROM app_task_cancellations c${appId ? " WHERE c.app_id = ?" : ""}`,
      );
      if (appId) values.push(appId);
    }
    if (parts.length === 0) return { items: [] };

    const cursor = input.cursor ? decodeCursor(input.cursor) : null;
    const cursorClause = cursor
      ? `WHERE updated_at < ? OR
         (updated_at = ? AND app_id > ?) OR
         (updated_at = ? AND app_id = ? AND task_id > ?) OR
         (updated_at = ? AND app_id = ? AND task_id = ? AND terminal > ?)`
      : "";
    if (cursor) {
      values.push(
        cursor.updatedAt,
        cursor.updatedAt,
        cursor.appId,
        cursor.updatedAt,
        cursor.appId,
        cursor.taskId,
        cursor.updatedAt,
        cursor.appId,
        cursor.taskId,
        cursor.terminal,
      );
    }
    values.push(limit + 1);
    const rows = this.db
      .prepare(
        `SELECT * FROM (${parts.join(" UNION ALL ")})
         ${cursorClause}
         ORDER BY updated_at DESC, app_id, task_id, terminal
         LIMIT ?`,
      )
      .all(...values) as TaskRow[];
    const pageRows = rows.slice(0, limit);
    const identities = pageRows.flatMap((row) => (rowIdentity(row) ? [rowIdentity(row)!] : []));
    const refs = displayTaskReferences(this.db, identities);
    const items = pageRows.flatMap((row) => {
      const identity = rowIdentity(row);
      if (!identity) return [];
      const ref = refs.get(`${identity.appId}\0${identity.taskId}`);
      const view = ref ? projectTask(row, ref, false) : null;
      return view ? [view] : [];
    });
    const last = pageRows.at(-1);
    return {
      items,
      ...(rows.length > limit && last?.app_id && last.task_id && Number.isSafeInteger(last.updated_at)
        ? {
            nextCursor: encodeCursor({
              updatedAt: last.updated_at!,
              appId: last.app_id,
              taskId: last.task_id,
              terminal: last.terminal === 2 ? 2 : last.terminal === 1 ? 1 : 0,
            }),
          }
        : {}),
    };
  }

  getTask(input: { ref?: string; appId?: string; taskId?: string }): HumanTaskView | null {
    let identity: ResolvedTaskReference;
    if (input.ref) {
      const resolved = resolveTaskReference(this.db, input.ref);
      if (resolved.kind === "missing") return null;
      if (resolved.kind === "ambiguous") {
        throw new Error(
          `Ambiguous Task reference ${input.ref}: ${resolved.candidates
            .map((candidate) => `${candidate.appId}/${candidate.taskId}`)
            .join(", ")}`,
        );
      }
      identity = resolved.task;
    } else {
      const appId = normalizeAppId(input.appId);
      const taskId = input.taskId?.trim();
      if (!appId || !taskId) throw new Error("Task read requires ref or App and Task ids");
      identity = { appId, taskId, digest: taskReferenceDigest(appId, taskId) };
    }
    const row = readTaskRow(this.db, identity.appId, identity.taskId);
    if (!row) return null;
    const refs = displayTaskReferences(this.db, [{ appId: identity.appId, taskId: identity.taskId }]);
    const view = projectTask(row, refs.get(`${identity.appId}\0${identity.taskId}`) ?? identity.digest.slice(0, 8));
    if (!view || view.terminal) return view;
    const progress = latestTaskProgress(this.db, identity.appId, identity.taskId);
    const waitingOn = view.status === "waiting" ? taskWaits(this.db, identity.appId, identity.taskId) : [];
    return {
      ...view,
      ...(progress ? { progress } : {}),
      ...(waitingOn.length > 0 ? { waitingOn } : {}),
    };
  }

  cancelTask(input: { ref?: string; appId?: string; taskId?: string; reason?: string }): HumanTaskView {
    const resolved = this.getTask(input);
    if (!resolved) throw new Error("Task was not found");
    let cancelledSessionId: string | undefined;
    let reason = input.reason?.trim() || "human requested cancellation";
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const current = this.getTask({ appId: resolved.appId, taskId: resolved.taskId });
      if (!current) throw new Error("Task disappeared before cancellation");
      if (current.status === "cancelled") {
        this.db.exec("COMMIT");
        return current;
      }
      if (current.terminal) throw new Error(`Task ${current.ref} is already terminal`);
      if (!current.cancellable) {
        throw new Error(`Task ${current.ref} is maintained and does not allow generic cancellation`);
      }

      const now = Date.now();
      const cancelledAt = new Date(now).toISOString();
      const taskRow = this.db
        .prepare("SELECT resource_json, current_attempt_id FROM app_tasks WHERE app_id = ? AND task_id = ?")
        .get(current.appId, current.taskId) as { resource_json?: string; current_attempt_id?: string | null } | null;
      const resource = parseJson<AppTaskResource>(taskRow?.resource_json);
      if (!resource || resource.metadata.resourceVersion !== current.resourceVersion) {
        throw new Error("Task changed before cancellation; read it again and retry");
      }
      const attemptId = taskRow?.current_attempt_id ?? undefined;
      const attemptRow = attemptId
        ? (this.db
            .prepare("SELECT attempt_json FROM app_task_attempts WHERE app_id = ? AND attempt_id = ?")
            .get(current.appId, attemptId) as { attempt_json?: string } | null)
        : null;
      const attempt = parseJson<AppTaskAttempt>(attemptRow?.attempt_json);
      const nextVersion = resource.metadata.resourceVersion + 1;
      const summary = `Cancelled by human: ${reason}`;
      const cancellation: TaskCancellation = {
        appId: current.appId,
        taskId: current.taskId,
        generation: resource.metadata.generation,
        resourceVersion: nextVersion,
        outcome: resource.spec.outcome,
        reason,
        summary,
        cancelledAt,
      };
      resource.metadata.resourceVersion = nextVersion;
      resource.status.phase = "attention";
      resource.status.currentAttemptId = undefined;
      resource.status.summary = summary;
      resource.status.updatedAt = cancelledAt;
      if (attempt) {
        attempt.metadata.resourceVersion += 1;
        attempt.state = "interrupted";
        attempt.reason = summary;
        attempt.summary = summary;
        attempt.finishedAt = cancelledAt;
      }

      this.db
        .prepare(
          `INSERT INTO app_task_cancellations(app_id, task_id, requested_at, reason, cancellation_json)
         VALUES (?, ?, ?, ?, ?)`,
        )
        .run(current.appId, current.taskId, now, reason, JSON.stringify(cancellation));
      const updated = this.db
        .prepare(
          `UPDATE app_tasks SET resource_version = ?, phase = 'attention', changed = 0, ready = 0,
           next_check_at = NULL, lease_until = NULL, current_attempt_id = NULL, updated_at = ?,
           resource_json = ?, trigger_json = NULL
         WHERE app_id = ? AND task_id = ? AND resource_version = ?`,
        )
        .run(nextVersion, now, JSON.stringify(resource), current.appId, current.taskId, current.resourceVersion);
      if (updated.changes !== 1) throw new Error("Task changed before cancellation; read it again and retry");
      if (attempt) {
        this.db
          .prepare(
            `UPDATE app_task_attempts SET state = 'interrupted', lease_until = NULL, attempt_json = ?
           WHERE app_id = ? AND attempt_id = ?`,
          )
          .run(JSON.stringify(attempt), current.appId, attempt.metadata.id);
      }
      cancelledSessionId = attempt?.sessionId;
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    this.options.onCancelled?.({
      appId: resolved.appId,
      taskId: resolved.taskId,
      ...(cancelledSessionId ? { sessionId: cancelledSessionId } : {}),
      reason,
    });
    return this.getTask({ appId: resolved.appId, taskId: resolved.taskId })!;
  }
}
