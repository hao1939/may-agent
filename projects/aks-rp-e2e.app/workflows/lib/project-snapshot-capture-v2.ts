import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import {
  normalizeTaskTreeInPlace,
  taskRevision,
  type TaskTree,
} from "./task-tree-store.ts";
import {
  buildProjectSnapshotV2,
  snapshotReviewIdentityV2,
  type ProjectSnapshotV2,
  type SnapshotAssignment,
  type SnapshotAttemptHeartbeat,
  type SnapshotDeliveryGap,
  type SnapshotLoop,
  type SnapshotReview,
  type SnapshotSession,
} from "./project-snapshot-v2.ts";

type JsonRecord = Record<string, unknown>;

export type RuntimeReviewerRowV2 = JsonRecord & {
  result?: unknown;
  ts?: unknown;
};

export type RuntimeProjectSnapshotCaptureV2 = {
  snapshot: ProjectSnapshotV2;
  tree: TaskTree;
  reviewerRows: RuntimeReviewerRowV2[];
};

export type RuntimeProjectSnapshotOptionsV2 = {
  appDir: string;
  treePath: string;
  stateDbPath: string;
  projectId?: string;
  nowMs?: number;
  sessionStartGraceMs?: number;
  staleNoActivityMs?: number;
  reviewGraceMs?: number;
};

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function readJson(path: string): JsonRecord {
  if (!existsSync(path)) return {};
  try {
    return record(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return {};
  }
}

function readJsonLines(path: string): RuntimeReviewerRowV2[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [record(JSON.parse(line))];
      } catch {
        return [];
      }
    });
}

function parseAssignments(path: string): SnapshotAssignment[] {
  return readJsonLines(path).flatMap((row) => {
    const taskId = text(row.taskId ?? row.task_id);
    const taskRevision =
      nonNegativeInteger(row.taskRevision ?? row.task_revision) ?? 0;
    const attemptId = text(row.attemptId ?? row.attempt_id);
    const sessionId = text(row.sessionId ?? row.session_id);
    const worker = text(row.worker);
    const assignedAt = text(row.assignedAt ?? row.assigned_at);
    if (!taskId || !attemptId || !sessionId || !worker || !assignedAt) {
      return [];
    }
    return [{ taskId, taskRevision, attemptId, sessionId, worker, assignedAt }];
  });
}

function snapshotReviewFromRow(
  row: RuntimeReviewerRowV2,
): SnapshotReview | null {
  if (row.result !== "project.task.reviewed") return null;
  const taskId = text(row.task_id ?? row.taskId);
  const taskRevision =
    nonNegativeInteger(row.task_revision ?? row.taskRevision) ?? 0;
  const attemptId = text(row.attempt_id ?? row.attemptId);
  const decision = text(row.decision);
  const ts = text(row.ts);
  if (!taskId || !attemptId || !decision || !ts) return null;
  return {
    reviewId: text(row.review_id ?? row.reviewId) ?? undefined,
    taskId,
    taskRevision,
    attemptId,
    decision,
    ts,
  };
}

function parseReviews(rows: RuntimeReviewerRowV2[]): SnapshotReview[] {
  return rows.flatMap((row) => {
    const review = snapshotReviewFromRow(row);
    return review ? [review] : [];
  });
}

function referencedSessionIds(
  tree: TaskTree,
  assignments: SnapshotAssignment[],
): string[] {
  return [
    ...Object.values(tree.tasks).flatMap((task) => {
      const state = String(task.state ?? task.status ?? "backlog");
      const sessionId = text(task.session_id);
      return state === "active" && sessionId ? [sessionId] : [];
    }),
    ...assignments.map((assignment) => assignment.sessionId),
  ].filter((value, index, all) => all.indexOf(value) === index);
}

function loadSessions(
  dbPath: string,
  sessionIds: string[],
): { available: boolean; sessions: SnapshotSession[] } {
  if (!existsSync(dbPath)) return { available: false, sessions: [] };
  const db = new Database(dbPath, { readonly: true });
  try {
    if (sessionIds.length === 0) {
      db.query("SELECT sessionId FROM sessions LIMIT 0").all();
      return { available: true, sessions: [] };
    }
    const placeholders = sessionIds.map(() => "?").join(", ");
    const rows = db
      .query(`SELECT * FROM sessions WHERE sessionId IN (${placeholders})`)
      .all(...sessionIds) as JsonRecord[];
    return {
      available: true,
      sessions: rows.flatMap((row) => {
        const sessionId = text(row.sessionId);
        const status = text(row.status);
        if (!sessionId || !status) return [];
        return [
          {
            sessionId,
            status,
            startedAt: number(row.startedAt),
            endedAt: number(row.endedAt),
            lastActivityAt: number(row.lastActivityAt),
            outcome: text(row.outcome),
            error: text(row.error),
          },
        ];
      }),
    };
  } catch {
    return { available: false, sessions: [] };
  } finally {
    db.close();
  }
}

function parseEventData(value: unknown): JsonRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    return record(JSON.parse(value));
  } catch {
    return {};
  }
}

function eventTaskId(data: JsonRecord): string | null {
  const target = record(data.target);
  const nested = record(data.data);
  return text(
    target.taskId ??
      target.task_id ??
      data.taskId ??
      data.task_id ??
      nested.taskId ??
      nested.task_id,
  );
}

function eventProject(data: JsonRecord): string | null {
  const target = record(data.target);
  const nested = record(data.data);
  return text(target.project ?? data.project ?? nested.project);
}

function loadDeliveryGaps(
  dbPath: string,
  projectId: string,
  nowMs: number,
): { available: boolean; gaps: SnapshotDeliveryGap[] } {
  if (!existsSync(dbPath)) return { available: false, gaps: [] };
  const db = new Database(dbPath, { readonly: true });
  try {
    const rows = db
      .query(
        `SELECT id, event_type, status, delivery_status, timestamp, data, reason
         FROM events
         WHERE timestamp >= ?
           AND event_type IN ('project.task.assigned', 'project.task.completed', 'project.task.reviewed')`,
      )
      .all(nowMs - 24 * 60 * 60_000) as JsonRecord[];
    return {
      available: true,
      gaps: rows.flatMap((row) => {
        const data = parseEventData(row.data);
        if (eventProject(data) !== projectId) return [];
        const deliveryStatus = text(row.delivery_status) ?? "unknown";
        const status = text(row.status) ?? "unknown";
        const timestamp = number(row.timestamp) ?? 0;
        const overduePending =
          deliveryStatus === "pending" && nowMs - timestamp > 15 * 60_000;
        if (deliveryStatus !== "failed" && !overduePending) return [];
        return [
          {
            eventId: String(row.id),
            eventType: text(row.event_type) ?? "unknown",
            status,
            deliveryStatus,
            timestamp,
            taskId: eventTaskId(data) ?? undefined,
            reason: text(row.reason) ?? undefined,
          },
        ];
      }),
    };
  } catch {
    return { available: false, gaps: [] };
  } finally {
    db.close();
  }
}

function taskProgress(tree: TaskTree, taskId: string): JsonRecord {
  return record(record(tree.tasks[taskId]?.context).workflowProgress);
}

function loopSnapshot(input: {
  tree: TaskTree;
  taskId: string;
  workflow: string;
  statePath: string;
  collectionKey: string;
  terminalStatuses: string[];
}): { loop: SnapshotLoop; heartbeats: SnapshotAttemptHeartbeat[] } {
  const raw = readJson(input.statePath);
  const collection = raw[input.collectionKey];
  const items =
    collection && typeof collection === "object" && !Array.isArray(collection)
      ? Object.values(collection as JsonRecord).map(record)
      : [];
  const stateCounts: Record<string, number> = {};
  for (const item of items) {
    const status = text(item.status) ?? "unknown";
    stateCounts[status] = (stateCounts[status] ?? 0) + 1;
  }
  const progress = taskProgress(input.tree, input.taskId);
  const heartbeats = items.flatMap((item) => {
    const taskId = text(item.taskId ?? item.task_id);
    const attemptId = text(item.activeAttemptId ?? item.active_attempt_id);
    const sessionId = text(
      item.activeTaskSessionId ?? item.active_task_session_id,
    );
    const heartbeatAt = text(item.heartbeatAt ?? item.heartbeat_at);
    if (!taskId || !attemptId || !heartbeatAt) return [];
    const task = input.tree.tasks[taskId];
    if (!task) return [];
    const explicitRevision = nonNegativeInteger(
      item.taskRevision ?? item.task_revision,
    );
    const currentRevision = taskRevision(task);
    if (explicitRevision === null && currentRevision !== 0) return [];
    return [
      {
        taskId,
        taskRevision: explicitRevision ?? 0,
        attemptId,
        sessionId,
        workflow: input.workflow,
        heartbeatAt,
      },
    ];
  });
  return {
    loop: {
      taskId: input.taskId,
      workflow: input.workflow,
      statePath: input.statePath,
      stateExists: existsSync(input.statePath),
      completionReady:
        typeof progress.completionReady === "boolean"
          ? progress.completionReady
          : null,
      stateCounts,
      nonTerminalCount: items.filter(
        (item) =>
          !input.terminalStatuses.includes(text(item.status) ?? "unknown"),
      ).length,
      reportedUnrepresentedNonTerminalCount: number(
        progress.unrepresentedNonTerminalCount,
      ),
      updatedAt:
        text(progress.updatedAt ?? progress.updated_at) ??
        text(raw.updatedAt ?? raw.updated_at),
    },
    heartbeats,
  };
}

function loadLoops(
  appDir: string,
  tree: TaskTree,
): {
  available: boolean;
  loops: SnapshotLoop[];
  heartbeats: SnapshotAttemptHeartbeat[];
} {
  const definitions = [
    {
      taskId: "aks-spec-verification-loop",
      workflow: "spec-loop-controller",
      statePath: join(appDir, ".state", "spec-loop", "state.json"),
      collectionKey: "specs",
      terminalStatuses: ["pass"],
    },
    {
      taskId: "aks-feature-reference-loop",
      workflow: "feature-reference-loop-controller",
      statePath: join(appDir, ".state", "feature-reference-loop", "state.json"),
      collectionKey: "features",
      terminalStatuses: ["done"],
    },
    {
      taskId: "aks-feature-compact-loop",
      workflow: "feature-compact-loop-controller",
      statePath: join(appDir, ".state", "feature-compact-loop", "state.json"),
      collectionKey: "features",
      terminalStatuses: ["done"],
    },
  ];
  const captures = definitions.map((definition) =>
    loopSnapshot({ tree, ...definition }),
  );
  return {
    available: definitions.every((definition) =>
      existsSync(definition.statePath),
    ),
    loops: captures.map((capture) => capture.loop),
    heartbeats: captures.flatMap((capture) => capture.heartbeats),
  };
}

export function captureRuntimeProjectSnapshotV2(
  options: RuntimeProjectSnapshotOptionsV2,
): RuntimeProjectSnapshotCaptureV2 | null {
  if (!existsSync(options.treePath)) return null;
  const nowMs = options.nowMs ?? Date.now();
  const assignmentPath = join(
    options.appDir,
    ".state",
    "task-assignments.jsonl",
  );
  const reviewPath = join(options.appDir, ".state", "task-reviewer-runs.jsonl");
  const tree = normalizeTaskTreeInPlace(
    JSON.parse(readFileSync(options.treePath, "utf8")) as TaskTree,
  );
  const assignments = parseAssignments(assignmentPath);
  const reviewerRows = readJsonLines(reviewPath);
  const reviews = parseReviews(reviewerRows);
  const sessionCapture = loadSessions(
    options.stateDbPath,
    referencedSessionIds(tree, assignments),
  );
  const loopCapture = loadLoops(options.appDir, tree);
  const deliveryCapture = loadDeliveryGaps(
    options.stateDbPath,
    options.projectId ?? "aks-rp-e2e",
    nowMs,
  );
  const sourceMeta = Object.fromEntries(
    [options.treePath, assignmentPath, reviewPath, options.stateDbPath].map(
      (path) => {
        const available = existsSync(path);
        return [
          path,
          {
            path,
            available,
            updatedAt: available ? statSync(path).mtime.toISOString() : null,
            size: available ? statSync(path).size : null,
          },
        ];
      },
    ),
  );
  return {
    tree,
    reviewerRows,
    snapshot: buildProjectSnapshotV2({
      projectId: options.projectId ?? "aks-rp-e2e",
      tree,
      assignments,
      sessions: sessionCapture.sessions,
      reviews,
      loops: loopCapture.loops,
      attemptHeartbeats: loopCapture.heartbeats,
      deliveryGaps: deliveryCapture.gaps,
      sourceCoverage: {
        assignments: existsSync(assignmentPath) ? "available" : "unavailable",
        sessions: sessionCapture.available ? "available" : "unavailable",
        reviews: existsSync(reviewPath) ? "available" : "unavailable",
        controllers: loopCapture.available ? "available" : "unavailable",
        controllerLiveness: loopCapture.available ? "available" : "unavailable",
        delivery: deliveryCapture.available ? "available" : "unavailable",
      },
      nowMs,
      sessionStartGraceMs: options.sessionStartGraceMs,
      staleNoActivityMs: options.staleNoActivityMs,
      reviewGraceMs: options.reviewGraceMs,
      sourceMeta,
    }),
  };
}

export function findRuntimeReviewerRowV2(
  rows: RuntimeReviewerRowV2[],
  input: {
    taskId: string;
    taskRevision: number;
    attemptId: string;
    decisionId: string;
  },
): RuntimeReviewerRowV2 | null {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const row = rows[index]!;
    const review = snapshotReviewFromRow(row);
    if (!review) continue;
    if (
      review.taskId === input.taskId &&
      review.taskRevision === input.taskRevision &&
      review.attemptId === input.attemptId &&
      snapshotReviewIdentityV2(review) === input.decisionId
    ) {
      return row;
    }
  }
  return null;
}
