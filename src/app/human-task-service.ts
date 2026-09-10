import type { AppRegistry } from "./core/apps/registry.js";
import type { AppTaskAttempt, AppTaskCancellation, AppTaskCondition, AppTaskResource } from "./app-task-state.js";
import type { TaskCompletionReceipt } from "./app-task-store.js";
import type { SqliteDb } from "../lib/db.js";
import {
  displayTaskReferences,
  ensureTaskReferenceIndex,
  resolveTaskReference,
  taskReferenceDigest,
  type ResolvedTaskReference,
} from "./task-reference-index.js";

export type HumanTaskStatus = "pending" | "running" | "waiting" | "attention" | "up-to-date" | "done" | "cancelled";

export type HumanTaskProgress = {
  stage: string;
  message?: string;
  status?: string;
  updatedAt: number;
};

/** Human work is a derived view of one Task's explicit open Condition. */
export type HumanTaskAction = {
  requestedAction: string;
  /** When the current human-owned Condition began, when known. */
  since?: number;
  /** Exact Task that owns the Condition when it is below the viewed Task. */
  task?: { appId: string; taskId: string; ref: string };
};

export type HumanTaskView = {
  appId: string;
  taskId: string;
  ref: string;
  status: HumanTaskStatus;
  generation: number;
  resourceVersion: number;
  outcome: string;
  /** Exact completion criteria. Detail reads only; compact lists omit them. */
  acceptance?: string[];
  /** Plain explanation of the current lifecycle state. */
  statusDetail?: string;
  summary?: string;
  response?: string;
  evidence?: string[];
  updatedAt: number;
  terminal: boolean;
  cancellable: boolean;
  execution?: { attemptId: string; sessionId?: string };
  progress?: HumanTaskProgress;
  waitingOn?: HumanTaskWait[];
  requestedBy?: HumanTaskLink;
  humanAction?: HumanTaskAction;
  /** Exact, bounded diagnostics; never included in compact list cards. */
  diagnostics?: HumanTaskDiagnostics;
  history?: HumanTaskHistory[];
  historyTruncated?: boolean;
  historyError?: string;
};

export type HumanTaskHistory = {
  eventId: number;
  eventType: string;
  timestamp: number;
  attemptId?: string;
  generation?: number;
  summary?: string;
  disposition?: string;
  handler?: string;
};

export type HumanTaskDiagnostics = Pick<
  AppTaskResource["spec"],
  "parentId" | "owner" | "mode" | "priority" | "workflow" | "executor" | "category" | "outputs"
> & {
  observedGeneration: number;
  ready: boolean;
  attemptCount: number;
  attempt?: Pick<AppTaskAttempt, "handler" | "state" | "reason" | "startedAt" | "trigger">;
  conditions: Array<{ id: string; condition: AppTaskCondition | null }>;
  conditionsTruncated: boolean;
  dependencies: Array<{ id: string; status: HumanTaskStatus | "missing" | "group" }>;
  dependenciesTruncated: boolean;
};

export type HumanTaskLink = {
  appId: string;
  taskId: string;
  ref: string;
  status: HumanTaskStatus;
  outcome: string;
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

export type HumanTaskPage = { items: HumanTaskView[]; nextCursor?: string; total?: number };

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
  ready?: number | null;
  attempt_json?: string | null;
  human_conditions_json?: string | null;
};

type TaskProgressRow = { data?: string | null; timestamp?: number };

type TaskCursor = { updatedAt: number; appId: string; taskId: string; terminal: number };

function parseJson<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function latestTaskProgress(
  db: SqliteDb,
  appId: string,
  taskId: string,
  attemptId: string | undefined,
): HumanTaskProgress | null {
  if (!attemptId) return null;
  let row: TaskProgressRow | null;
  try {
    row = db
      .prepare(
        `SELECT data, timestamp
         FROM events
         WHERE event_type = 'project.task.executor.progress'
           AND project_id = ? AND task_id = ? AND attempt_id = ?
           AND length(trim(coalesce(json_extract(data, '$.message'), ''))) > 0
         ORDER BY id DESC
         LIMIT 1`,
      )
      .get(appId, taskId, attemptId) as TaskProgressRow | null;
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

// A wake can queue the next cycle without rewriting the last accepted phase.
// Project that work consistently in exact reads, lists, and status filters.
const LIVE_TASK_PHASE_SQL = `CASE
  WHEN t.phase = 'converged' AND (t.ready = 1 OR t.changed = 1) THEN 'pending'
  ELSE t.phase END`;

function taskStatus(phase: string | undefined, terminal: boolean): HumanTaskStatus {
  if (terminal) return "done";
  if (phase === "converged") return "up-to-date";
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
  const { acceptance: _acceptance, response: _response, evidence: _evidence, ...card } = view;
  return {
    ...card,
    outcome: boundedUtf8Text(view.outcome, HUMAN_TASK_LIST_TEXT_MAX_BYTES),
    ...(view.summary ? { summary: boundedUtf8Text(view.summary, HUMAN_TASK_LIST_TEXT_MAX_BYTES) } : {}),
  };
}

function taskStatusDetail(
  status: HumanTaskStatus,
  input: { ready?: number | null; attempt?: AppTaskAttempt | null } = {},
): string {
  switch (status) {
    case "pending":
      return input.ready === 1
        ? "Accepted and ready to start; no attempt is running."
        : "Accepted and waiting to become runnable.";
    case "running":
      return input.attempt?.state === "running" ? "An attempt is working on it now." : "The App is working on it.";
    case "waiting":
      return "Waiting for the facts or work shown below.";
    case "attention":
      return "The App needs review or recovery.";
    case "up-to-date":
      return "Current work is reconciled; this maintained Task will wake when relevant facts change.";
    case "done":
      return "Completed.";
    case "cancelled":
      return "Cancelled.";
  }
}

const HUMAN_OWNER_SQL = `(lower(json_extract(human_condition.condition_json, '$.spec.owner')) = 'human'
      OR lower(json_extract(human_condition.condition_json, '$.spec.owner')) LIKE 'human:%'
      OR lower(json_extract(human_condition.condition_json, '$.spec.owner')) = 'hao')`;

const HUMAN_CONDITIONS_SQL = `(SELECT json_group_array(json(human_condition.condition_json))
  FROM app_task_condition_routes human_route
  JOIN app_task_conditions human_condition
    ON human_condition.app_id = human_route.app_id
   AND human_condition.condition_id = human_route.condition_id
  WHERE human_route.app_id = t.app_id
    AND human_route.task_id = t.task_id
    AND human_condition.state != 'true'
    AND ${HUMAN_OWNER_SQL}
  ORDER BY human_route.condition_id)`;

function humanConditions(row: TaskRow): AppTaskCondition[] {
  const parsed = parseJson<unknown[]>(row.human_conditions_json);
  return Array.isArray(parsed)
    ? parsed.filter((condition): condition is AppTaskCondition =>
        Boolean(
          condition &&
          typeof condition === "object" &&
          !Array.isArray(condition) &&
          (condition as AppTaskCondition).spec &&
          typeof (condition as AppTaskCondition).spec.type === "string",
        ),
      )
    : [];
}

function naturalList(values: string[]): string {
  if (values.length < 2) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} or ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, or ${values.at(-1)}`;
}

function conditionAction(condition: AppTaskCondition): string {
  if (condition.spec.requestedAction?.trim()) return condition.spec.requestedAction.trim();
  const expected =
    condition.spec.expected && typeof condition.spec.expected === "object" && !Array.isArray(condition.spec.expected)
      ? (condition.spec.expected as Record<string, unknown>)
      : {};
  const choices = Array.isArray(expected.anyOf)
    ? expected.anyOf.filter((choice): choice is string => typeof choice === "string" && Boolean(choice.trim()))
    : [];
  if (condition.spec.type === "project.approval.submitted" && choices.length > 0) {
    const approvalId =
      typeof expected.approvalId === "string" && expected.approvalId.trim()
        ? expected.approvalId.trim()
        : condition.spec.subject;
    return `Choose ${naturalList(choices)} for ${approvalId}.`;
  }
  return "";
}

function withHumanAction(view: HumanTaskView, conditions: AppTaskCondition[]): HumanTaskView {
  const actions = [...new Set(conditions.map(conditionAction).filter(Boolean))];
  const timestamps = conditions
    .map((condition) => Date.parse(condition.status.createdAt ?? ""))
    .filter(Number.isFinite);
  return {
    ...view,
    humanAction: {
      requestedAction: boundedUtf8Text(
        actions.length > 0 ? actions.join(" ") : view.summary?.trim() || view.outcome,
        240,
      ),
      ...(timestamps.length > 0 ? { since: Math.min(...timestamps) } : {}),
    },
  };
}

type HumanConditionOwner = { appId: string; taskId: string; conditions: AppTaskCondition[] };

/** Follow only exact App-request Task links in one bounded database read. */
function reachableHumanConditionOwners(
  db: SqliteDb,
  roots: { appId: string; taskId: string } | { activeAppId?: string },
): HumanConditionOwner[] {
  const explicitRoot = "taskId" in roots;
  const rows = db
    .prepare(
      `WITH RECURSIVE reachable(app_id, task_id) AS (
         ${
           explicitRoot
             ? "SELECT ? AS app_id, ? AS task_id"
             : `SELECT task.app_id, task.task_id
              FROM app_tasks task
              WHERE task.phase IN ('pending', 'running', 'waiting', 'attention', 'converged')
                AND NOT EXISTS (
                  SELECT 1 FROM app_task_receipts receipt
                  WHERE receipt.app_id = task.app_id AND receipt.receipt_id = task.task_id
                    AND json_extract(receipt.receipt_json, '$.metadata.generation') >= task.generation
                )
                AND NOT EXISTS (
                  SELECT 1 FROM app_task_cancellations cancellation
                  WHERE cancellation.app_id = task.app_id AND cancellation.task_id = task.task_id
                )
                ${roots.activeAppId ? "AND task.app_id = ?" : ""}`
         }
         UNION
         SELECT request.app_id, request.waiting_on_id
         FROM reachable parent
         JOIN app_task_condition_routes route
           ON route.app_id = parent.app_id AND route.task_id = parent.task_id
         JOIN app_task_conditions condition
           ON condition.app_id = route.app_id AND condition.condition_id = route.condition_id
         JOIN app_inbox_items request
           ON condition.condition_id = 'app-request:' || request.id
          AND json_extract(condition.condition_json, '$.spec.subject') = 'id:' || request.id
         WHERE condition.state != 'true'
           AND request.waiting_on_kind = 'task' AND request.waiting_on_id IS NOT NULL
         LIMIT 1000
       )
       SELECT reachable.app_id, reachable.task_id, human_condition.condition_json
       FROM reachable
       JOIN app_task_condition_routes human_route
         ON human_route.app_id = reachable.app_id AND human_route.task_id = reachable.task_id
       JOIN app_task_conditions human_condition
         ON human_condition.app_id = human_route.app_id
        AND human_condition.condition_id = human_route.condition_id
       WHERE human_condition.state != 'true' AND ${HUMAN_OWNER_SQL}
       ORDER BY reachable.app_id, reachable.task_id, human_route.condition_id`,
    )
    .all(...(explicitRoot ? [roots.appId, roots.taskId] : roots.activeAppId ? [roots.activeAppId] : [])) as Array<{
    app_id?: string;
    task_id?: string;
    condition_json?: string;
  }>;
  const owners = new Map<string, HumanConditionOwner>();
  for (const row of rows) {
    if (!row.app_id || !row.task_id) continue;
    const condition = parseJson<AppTaskCondition>(row.condition_json);
    if (!condition) continue;
    const key = `${row.app_id}\0${row.task_id}`;
    const owner = owners.get(key) ?? { appId: row.app_id, taskId: row.task_id, conditions: [] };
    owner.conditions.push(condition);
    owners.set(key, owner);
  }
  return [...owners.values()];
}

function descendantHumanAction(db: SqliteDb, view: HumanTaskView): HumanTaskAction | undefined {
  const owners = reachableHumanConditionOwners(db, { appId: view.appId, taskId: view.taskId });
  const owner = owners.find((candidate) => candidate.appId !== view.appId || candidate.taskId !== view.taskId);
  if (!owner) return undefined;
  const refs = displayTaskReferences(db, [{ appId: owner.appId, taskId: owner.taskId }]);
  const leaf = readTaskRow(db, owner.appId, owner.taskId);
  const ref = refs.get(`${owner.appId}\0${owner.taskId}`);
  if (!leaf || !ref) return undefined;
  const leafView = projectTask(leaf, ref, false);
  if (!leafView) return undefined;
  const projected = withHumanAction(leafView, owner.conditions).humanAction;
  return projected ? { ...projected, task: { appId: owner.appId, taskId: owner.taskId, ref } } : undefined;
}

function projectTask(row: TaskRow, ref: string, detail = true): HumanTaskView | null {
  const appId = row.app_id;
  const taskId = row.task_id;
  if (!appId || !taskId) return null;
  const terminal = row.terminal !== 0;
  if (row.terminal === 2) {
    const cancellation = parseJson<AppTaskCancellation>(row.payload);
    if (!cancellation) return null;
    const view: HumanTaskView = {
      appId,
      taskId,
      ref,
      status: "cancelled",
      generation: cancellation.generation,
      resourceVersion: cancellation.resourceVersion,
      outcome: cancellation.outcome,
      statusDetail: taskStatusDetail("cancelled"),
      summary: cancellation.summary,
      ...(cancellation.response ? { response: cancellation.response } : {}),
      ...(cancellation.result ? { result: structuredClone(cancellation.result) } : {}),
      ...(cancellation.evidence ? { evidence: [...cancellation.evidence] } : {}),
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
      ...(Array.isArray(receipt.acceptance) ? { acceptance: [...receipt.acceptance] } : {}),
      statusDetail: taskStatusDetail("done"),
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
  const status = taskStatus(row.phase, false);
  const observationIsCurrent =
    status !== "running" ||
    (attempt?.state === "running" &&
      resource.status.observedGeneration === resource.metadata.generation &&
      resource.status.observedAttemptId === resource.status.currentAttemptId);
  const view: HumanTaskView = {
    appId,
    taskId,
    ref,
    status,
    generation: resource.metadata.generation,
    resourceVersion: resource.metadata.resourceVersion,
    outcome: resource.spec.outcome,
    acceptance: [...resource.spec.acceptance],
    statusDetail: taskStatusDetail(status, { ready: row.ready, attempt }),
    ...(observationIsCurrent && resource.status.summary ? { summary: resource.status.summary } : {}),
    ...(observationIsCurrent && resource.status.response ? { response: resource.status.response } : {}),
    ...(observationIsCurrent && resource.status.evidence ? { evidence: [...resource.status.evidence] } : {}),
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
  // Preserve cancellation semantics, but an older completion cannot hide a
  // revised live Task (including the generation/version needed by retry).
  return db
    .prepare(
      `SELECT * FROM (
       SELECT t.app_id, t.task_id, ${LIVE_TASK_PHASE_SQL} AS phase, t.updated_at, t.resource_json AS payload, 0 AS terminal,
         t.ready, a.attempt_json, ${HUMAN_CONDITIONS_SQL} AS human_conditions_json,
         t.generation AS current_generation
       FROM app_tasks t
       LEFT JOIN app_task_attempts a
         ON a.app_id = t.app_id AND a.attempt_id = t.current_attempt_id
       WHERE t.app_id = ? AND t.task_id = ?
       UNION ALL
       SELECT r.app_id, r.receipt_id AS task_id, 'done' AS phase, r.completed_at AS updated_at,
         r.receipt_json AS payload, 1 AS terminal, NULL AS ready, NULL AS attempt_json, NULL AS human_conditions_json,
         json_extract(r.receipt_json, '$.metadata.generation') AS current_generation
       FROM app_task_receipts r
       WHERE r.app_id = ? AND r.receipt_id = ?
       UNION ALL
       SELECT c.app_id, c.task_id, 'cancelled' AS phase, c.requested_at AS updated_at,
         c.cancellation_json AS payload, 2 AS terminal, NULL AS ready, NULL AS attempt_json, NULL AS human_conditions_json,
         json_extract(c.cancellation_json, '$.generation') AS current_generation
       FROM app_task_cancellations c
       WHERE c.app_id = ? AND c.task_id = ?
       ) ORDER BY (terminal = 2) DESC, current_generation DESC, terminal DESC LIMIT 1`,
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

function taskRequester(db: SqliteDb, appId: string, taskId: string): HumanTaskLink | null {
  const row = db
    .prepare(
      `SELECT route.app_id, route.task_id
       FROM app_inbox_items request
       JOIN app_task_condition_routes route
         ON route.condition_id = 'app-request:' || request.id
       JOIN app_task_conditions condition
         ON condition.app_id = route.app_id AND condition.condition_id = route.condition_id
       WHERE request.app_id = ?
         AND request.waiting_on_kind = 'task' AND request.waiting_on_id = ?
         AND request.source_kind = 'app'
         AND json_extract(condition.condition_json, '$.spec.subject') = 'id:' || request.id
       ORDER BY request.created_at DESC
       LIMIT 1`,
    )
    .get(appId, taskId) as { app_id?: string; task_id?: string } | null;
  if (!row?.app_id || !row.task_id) return null;
  const parent = readTaskRow(db, row.app_id, row.task_id);
  if (!parent) return null;
  const refs = displayTaskReferences(db, [{ appId: row.app_id, taskId: row.task_id }]);
  const view = projectTask(parent, refs.get(`${row.app_id}\0${row.task_id}`) ?? "");
  return view
    ? {
        appId: view.appId,
        taskId: view.taskId,
        ref: view.ref,
        status: view.status,
        outcome: view.outcome,
      }
    : null;
}

// Detail reads inspect only the selected Task and a bounded set of direct links.
// Do not project a partial graph as though it were a complete scheduler snapshot.
const TASK_DETAIL_LINK_LIMIT = 100;
const TASK_HISTORY_LIMIT = 20;

function taskDiagnostics(db: SqliteDb, row: TaskRow): HumanTaskDiagnostics {
  const { spec, status } = JSON.parse(row.payload!) as AppTaskResource;
  const { parentId, owner, mode, priority, workflow, executor, category, outputs } = spec;
  const conditionIds = status.conditionIds ?? [];
  const dependencyIds = spec.dependsOn ?? [];
  const attempt = parseJson<AppTaskAttempt>(row.attempt_json);
  const count = db
    .prepare("SELECT COUNT(*) AS count FROM app_task_attempts WHERE app_id = ? AND task_id = ?")
    .get(row.app_id!, row.task_id!) as { count: number };
  return {
    parentId,
    owner,
    mode,
    priority,
    workflow,
    executor,
    category,
    outputs,
    observedGeneration: status.observedGeneration,
    ready: row.ready === 1,
    attemptCount: count.count,
    ...(attempt
      ? {
          attempt: {
            handler: attempt.handler,
            state: attempt.state,
            reason: attempt.reason,
            startedAt: attempt.startedAt,
            ...(attempt.trigger ? { trigger: attempt.trigger } : {}),
          },
        }
      : {}),
    conditions: conditionIds.slice(0, TASK_DETAIL_LINK_LIMIT).map((id) => {
      const condition = db
        .prepare("SELECT condition_json FROM app_task_conditions WHERE app_id = ? AND condition_id = ?")
        .get(row.app_id!, id) as { condition_json: string } | null;
      return { id, condition: parseJson<AppTaskCondition>(condition?.condition_json) };
    }),
    conditionsTruncated: conditionIds.length > TASK_DETAIL_LINK_LIMIT,
    dependencies: dependencyIds.slice(0, TASK_DETAIL_LINK_LIMIT).map((id) => {
      const dependency = readTaskRow(db, row.app_id!, id);
      const group =
        !dependency &&
        db.prepare("SELECT 1 FROM app_task_groups WHERE app_id = ? AND group_id = ?").get(row.app_id!, id);
      return {
        id,
        status: dependency
          ? dependency.terminal === 2
            ? "cancelled"
            : taskStatus(dependency.phase, dependency.terminal === 1)
          : group
            ? "group"
            : "missing",
      };
    }),
    dependenciesTruncated: dependencyIds.length > TASK_DETAIL_LINK_LIMIT,
  };
}

function taskHistory(
  db: SqliteDb,
  appId: string,
  taskId: string,
): Pick<HumanTaskView, "history" | "historyTruncated" | "historyError"> {
  try {
    const rows = db
      .prepare(
        `SELECT id, event_type, timestamp, attempt_id, handler, data FROM events
      WHERE project_id = ? AND task_id = ? AND event_type LIKE 'project.task.%'
      ORDER BY timestamp DESC, id DESC LIMIT ?`,
      )
      .all(appId, taskId, TASK_HISTORY_LIMIT + 1) as Array<{
      id: number;
      event_type: string;
      timestamp: number;
      attempt_id: string | null;
      handler: string | null;
      data: string;
    }>;
    return {
      history: rows.slice(0, TASK_HISTORY_LIMIT).map((row) => {
        const data = parseJson<Record<string, unknown>>(row.data) ?? {};
        return {
          eventId: row.id,
          eventType: row.event_type,
          timestamp: row.timestamp,
          ...(row.attempt_id ? { attemptId: row.attempt_id } : {}),
          ...(row.handler ? { handler: row.handler } : {}),
          ...(typeof data.generation === "number" ? { generation: data.generation } : {}),
          ...(typeof data.summary === "string" ? { summary: data.summary } : {}),
          ...(typeof data.disposition === "string" ? { disposition: data.disposition } : {}),
        };
      }),
      historyTruncated: rows.length > TASK_HISTORY_LIMIT,
    };
  } catch (error) {
    // History is evidence, not authority for the current Task's state.
    return { historyError: error instanceof Error ? error.message : String(error) };
  }
}

export class HumanTaskService {
  constructor(
    private readonly db: SqliteDb,
    private readonly registry: Pick<AppRegistry, "snapshot">,
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
         WHERE phase IN ('pending', 'running', 'waiting', 'attention', 'converged')
           AND NOT EXISTS (
             SELECT 1 FROM app_task_receipts r
             WHERE r.app_id = app_tasks.app_id AND r.receipt_id = app_tasks.task_id
               AND json_extract(r.receipt_json, '$.metadata.generation') >= app_tasks.generation
           )
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
      humanActionOnly?: boolean;
      status?: HumanTaskStatus[];
      limit?: number;
      cursor?: string;
    } = {},
  ): HumanTaskPage {
    const limit = input.limit ?? 30;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new Error("Task list limit must be an integer between 1 and 100");
    }
    const valid = new Set<HumanTaskStatus>([
      "pending",
      "running",
      "waiting",
      "attention",
      "up-to-date",
      "done",
      "cancelled",
    ]);
    if (input.status?.some((status) => !valid.has(status))) throw new Error("Invalid Task status filter");
    const statuses = input.status ? new Set(input.status) : null;
    const humanActionOnly = input.humanActionOnly === true;
    const includeLive = !statuses || [...statuses].some((status) => status !== "done" && status !== "cancelled");
    const includeDone =
      !humanActionOnly && ((!statuses && input.includeDone === true) || statuses?.has("done") === true);
    const includeCancelled =
      !humanActionOnly && ((!statuses && input.includeDone === true) || statuses?.has("cancelled") === true);
    const livePhases = statuses
      ? [...statuses].flatMap((status) =>
          status === "done" || status === "cancelled" ? [] : [status === "up-to-date" ? "converged" : status],
        )
      : ["pending", "running", "waiting", "attention", "converged"];
    const appId = normalizeAppId(input.appId);
    const humanOwners = humanActionOnly
      ? reachableHumanConditionOwners(this.db, appId ? { activeAppId: appId } : {})
      : [];
    const humanOwnerKeys = new Set(humanOwners.map((owner) => `${owner.appId}\0${owner.taskId}`));
    if (humanActionOnly && humanOwnerKeys.size === 0) return { items: [], total: 0 };
    const humanOwnerClause = humanActionOnly
      ? ` AND (${[...humanOwnerKeys].map(() => "(t.app_id = ? AND t.task_id = ?)").join(" OR ")})`
      : "";
    const humanOwnerValues = humanActionOnly
      ? [...humanOwnerKeys].flatMap((key) => {
          const [ownerAppId, ownerTaskId] = key.split("\0");
          return [ownerAppId, ownerTaskId];
        })
      : [];
    const parts: string[] = [];
    const values: unknown[] = [];
    if (includeLive && livePhases.length > 0) {
      parts.push(
        `SELECT t.app_id, t.task_id, ${LIVE_TASK_PHASE_SQL} AS phase, t.updated_at, t.resource_json AS payload, 0 AS terminal,
           t.ready, a.attempt_json, ${HUMAN_CONDITIONS_SQL} AS human_conditions_json
         FROM app_tasks t
         LEFT JOIN app_task_attempts a
           ON a.app_id = t.app_id AND a.attempt_id = t.current_attempt_id
         WHERE (${LIVE_TASK_PHASE_SQL}) IN (${livePhases.map(() => "?").join(", ")})
           AND NOT EXISTS (
             SELECT 1 FROM app_task_receipts r WHERE r.app_id = t.app_id AND r.receipt_id = t.task_id
               AND json_extract(r.receipt_json, '$.metadata.generation') >= t.generation
           )
           AND NOT EXISTS (
             SELECT 1 FROM app_task_cancellations c WHERE c.app_id = t.app_id AND c.task_id = t.task_id
           )${appId && !humanActionOnly ? " AND t.app_id = ?" : ""}${humanOwnerClause}`,
      );
      values.push(...livePhases, ...(appId && !humanActionOnly ? [appId] : []), ...humanOwnerValues);
    }
    if (includeDone) {
      parts.push(
        `SELECT r.app_id, r.receipt_id AS task_id, 'done' AS phase, r.completed_at AS updated_at,
           r.receipt_json AS payload, 1 AS terminal, NULL AS ready, NULL AS attempt_json, NULL AS human_conditions_json
         FROM app_task_receipts r
         WHERE NOT EXISTS (
           SELECT 1 FROM app_task_cancellations c WHERE c.app_id = r.app_id AND c.task_id = r.receipt_id
         ) AND NOT EXISTS (
           SELECT 1 FROM app_tasks t WHERE t.app_id = r.app_id AND t.task_id = r.receipt_id
             AND t.generation > json_extract(r.receipt_json, '$.metadata.generation')
         )${appId ? " AND r.app_id = ?" : ""}`,
      );
      if (appId) values.push(appId);
    }
    if (includeCancelled) {
      parts.push(
        `SELECT c.app_id, c.task_id, 'cancelled' AS phase, c.requested_at AS updated_at,
           c.cancellation_json AS payload, 2 AS terminal, NULL AS ready, NULL AS attempt_json, NULL AS human_conditions_json
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
      if (!view) return [];
      const conditions = row.terminal === 0 ? humanConditions(row) : [];
      return [conditions.length > 0 ? withHumanAction(view, conditions) : view];
    });
    const total = humanActionOnly ? humanOwnerKeys.size : undefined;
    const last = pageRows.at(-1);
    return {
      items,
      ...(total === undefined ? {} : { total }),
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
    if (!view) return null;
    const requestedBy = taskRequester(this.db, identity.appId, identity.taskId);
    const linkedView = {
      ...view,
      ...(requestedBy ? { requestedBy } : {}),
      ...taskHistory(this.db, identity.appId, identity.taskId),
    };
    if (view.terminal) return linkedView;
    const progress = latestTaskProgress(this.db, identity.appId, identity.taskId, view.execution?.attemptId);
    const waitingOn = view.status === "waiting" ? taskWaits(this.db, identity.appId, identity.taskId) : [];
    const detail = {
      ...linkedView,
      diagnostics: taskDiagnostics(this.db, row),
      ...(progress ? { progress } : {}),
      ...(waitingOn.length > 0 ? { waitingOn } : {}),
    };
    const conditions = humanConditions(row);
    if (conditions.length > 0) return withHumanAction(detail, conditions);
    const inheritedAction = descendantHumanAction(this.db, detail);
    return inheritedAction ? { ...detail, humanAction: inheritedAction } : detail;
  }
}
