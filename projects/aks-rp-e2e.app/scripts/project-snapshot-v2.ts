#!/usr/bin/env bun

import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Database } from "bun:sqlite";
import {
  summarizeTaskTree,
  type TaskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import { buildProjectHealth } from "./project-health.ts";
import {
  normalizeTaskTreeInPlace,
  taskRevision,
  type TaskNode,
  type TaskTree,
} from "../workflows/lib/task-tree-store.ts";
import {
  buildProjectSnapshotV2,
  compareFrontiersV2,
  type ProjectSnapshotV2Input,
  type SnapshotAssignment,
  type SnapshotAttemptHeartbeat,
  type SnapshotDeliveryGap,
  type SnapshotLoop,
  type SnapshotReview,
  type SnapshotSession,
} from "../workflows/lib/project-snapshot-v2.ts";

type JsonRecord = Record<string, unknown>;

type CliOptions = {
  appDir: string;
  projectDir: string;
  stateDbPath: string;
  projectId: string;
  json: boolean;
};

function cliOptions(argv: string[]): CliOptions {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const defaultAppDir = resolve(currentDir, "..");
  const option = (name: string): string | null => {
    const index = argv.indexOf(name);
    return index >= 0 && argv[index + 1] ? argv[index + 1] : null;
  };
  const appDir = resolve(option("--app") ?? defaultAppDir);
  return {
    appDir,
    projectDir: resolve(
      option("--project") ?? join(appDir, "..", "aks-rp-e2e"),
    ),
    stateDbPath: resolve(
      option("--state-db") ?? process.env.MAY_DB_PATH ?? "/app/.state/may.db",
    ),
    projectId: option("--project-id") ?? "aks-rp-e2e",
    json: argv.includes("--json"),
  };
}

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

function readJsonLines(path: string): JsonRecord[] {
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

function fileHash(path: string): string | null {
  if (!existsSync(path)) return null;
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sourceFingerprint(path: string): string | null {
  if (!existsSync(path)) return null;
  const stat = statSync(path);
  if (/\.(?:db|sqlite|sqlite3)$/i.test(path)) {
    return createHash("sha256")
      .update(`${stat.size}:${stat.mtimeMs}`)
      .digest("hex");
  }
  return fileHash(path);
}

function sourceMeta(
  paths: string[],
): NonNullable<ProjectSnapshotV2Input["sourceMeta"]> {
  return Object.fromEntries(
    paths.map((path) => {
      const available = existsSync(path);
      return [
        path,
        {
          path,
          available,
          updatedAt: available ? statSync(path).mtime.toISOString() : null,
          size: available ? statSync(path).size : null,
          fingerprint: available ? sourceFingerprint(path) : null,
        },
      ];
    }),
  );
}

function taskTreePath(appDir: string): string {
  const runtime = join(appDir, ".state", "tasks", "tree.json");
  if (existsSync(runtime)) return runtime;
  return join(appDir, "tasks", "tree.json");
}

function loadTree(path: string): TaskTree {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as TaskTree;
  return normalizeTaskTreeInPlace(parsed);
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
    if (!taskId || !attemptId || !sessionId || !worker || !assignedAt)
      return [];
    return [{ taskId, taskRevision, attemptId, sessionId, worker, assignedAt }];
  });
}

function parseReviews(path: string): SnapshotReview[] {
  return readJsonLines(path).flatMap((row) => {
    const taskId = text(row.task_id ?? row.taskId);
    const taskRevision =
      nonNegativeInteger(row.task_revision ?? row.taskRevision) ?? 0;
    const attemptId = text(row.attempt_id ?? row.attemptId);
    const decision = text(row.decision);
    const ts = text(row.ts);
    if (!taskId || !attemptId || !decision || !ts) return [];
    return [{ taskId, taskRevision, attemptId, decision, ts }];
  });
}

function referencedSessionIds(
  tree: TaskTree,
  assignments: SnapshotAssignment[],
): string[] {
  return [
    ...Object.values(tree.tasks)
      .filter((task) => String(task.state ?? task.status) === "active")
      .flatMap((task) =>
        text(task.session_id) ? [text(task.session_id)!] : [],
      ),
    ...assignments.map((assignment) => assignment.sessionId),
  ].filter((value, index, all) => all.indexOf(value) === index);
}

function loadSessions(dbPath: string, sessionIds: string[]): SnapshotSession[] {
  if (!existsSync(dbPath) || sessionIds.length === 0) return [];
  const db = new Database(dbPath, { readonly: true });
  try {
    const placeholders = sessionIds.map(() => "?").join(", ");
    const rows = db
      .query(
        `SELECT sessionId, status, startedAt, endedAt, lastActivityAt, outcome, error
         FROM sessions
         WHERE sessionId IN (${placeholders})`,
      )
      .all(...sessionIds) as JsonRecord[];
    return rows.flatMap((row) => {
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
    });
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
  const nestedData = record(data.data);
  return text(
    target.taskId ??
      target.task_id ??
      data.taskId ??
      data.task_id ??
      nestedData.taskId ??
      nestedData.task_id,
  );
}

function eventProject(data: JsonRecord): string | null {
  const target = record(data.target);
  const nestedData = record(data.data);
  return text(target.project ?? data.project ?? nestedData.project);
}

function loadDeliveryGaps(
  dbPath: string,
  projectId: string,
  nowMs: number,
): SnapshotDeliveryGap[] {
  if (!existsSync(dbPath)) return [];
  const db = new Database(dbPath, { readonly: true });
  try {
    const since = nowMs - 24 * 60 * 60_000;
    const rows = db
      .query(
        `SELECT id, event_type, status, delivery_status, timestamp, data, reason
         FROM events
         WHERE timestamp >= ?
           AND event_type IN ('project.task.assigned', 'project.task.completed', 'project.task.reviewed')`,
      )
      .all(since) as JsonRecord[];
    return rows.flatMap((row) => {
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
    });
  } finally {
    db.close();
  }
}

function statusCounts(items: JsonRecord[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const status = text(item.status) ?? "unknown";
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
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
}): { loop: SnapshotLoop; attemptHeartbeats: SnapshotAttemptHeartbeat[] } {
  const raw = readJson(input.statePath);
  const collectionValue = raw[input.collectionKey];
  const items =
    collectionValue && typeof collectionValue === "object"
      ? Object.values(collectionValue as JsonRecord).map(record)
      : [];
  const counts = statusCounts(items);
  const progress = taskProgress(input.tree, input.taskId);
  const completionReady =
    typeof progress.completionReady === "boolean"
      ? progress.completionReady
      : null;
  const reported = number(progress.unrepresentedNonTerminalCount);
  const attemptHeartbeats = items.flatMap((item) => {
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
      completionReady,
      stateCounts: counts,
      nonTerminalCount: items.filter(
        (item) =>
          !input.terminalStatuses.includes(text(item.status) ?? "unknown"),
      ).length,
      reportedUnrepresentedNonTerminalCount: reported,
      updatedAt:
        text(progress.updatedAt ?? progress.updated_at) ??
        text(raw.updatedAt ?? raw.updated_at),
    },
    attemptHeartbeats,
  };
}

function loadLoops(
  appDir: string,
  tree: TaskTree,
): { loops: SnapshotLoop[]; attemptHeartbeats: SnapshotAttemptHeartbeat[] } {
  const captures = [
    loopSnapshot({
      tree,
      taskId: "aks-spec-verification-loop",
      workflow: "spec-loop-controller",
      statePath: join(appDir, ".state", "spec-loop", "state.json"),
      collectionKey: "specs",
      terminalStatuses: ["pass"],
    }),
    loopSnapshot({
      tree,
      taskId: "aks-feature-reference-loop",
      workflow: "feature-reference-loop-controller",
      statePath: join(appDir, ".state", "feature-reference-loop", "state.json"),
      collectionKey: "features",
      terminalStatuses: ["done"],
    }),
    loopSnapshot({
      tree,
      taskId: "aks-feature-compact-loop",
      workflow: "feature-compact-loop-controller",
      statePath: join(appDir, ".state", "feature-compact-loop", "state.json"),
      collectionKey: "features",
      terminalStatuses: ["done"],
    }),
  ];
  return {
    loops: captures.map((capture) => capture.loop),
    attemptHeartbeats: captures.flatMap((capture) => capture.attemptHeartbeats),
  };
}

function config(options: CliOptions, treePath: string): TaskTreeConfig {
  return {
    appDir: options.appDir,
    projectDir: options.projectDir,
    treePath,
    journalPath: join(options.appDir, ".state", "journal.jsonl"),
    worker: "aks-explorer",
    maxConcurrent: 80,
  };
}

export function captureProjectSnapshotV2(options: CliOptions) {
  const nowMs = Date.now();
  const treePath = taskTreePath(options.appDir);
  const assignmentPath = join(
    options.appDir,
    ".state",
    "task-assignments.jsonl",
  );
  const reviewPath = join(options.appDir, ".state", "task-reviewer-runs.jsonl");
  const loopPaths = [
    join(options.appDir, ".state", "spec-loop", "state.json"),
    join(options.appDir, ".state", "feature-reference-loop", "state.json"),
    join(options.appDir, ".state", "feature-compact-loop", "state.json"),
  ];
  const journalPath = join(options.appDir, ".state", "journal.jsonl");
  const plannerPath = join(options.appDir, ".state", "planner-runs.jsonl");
  const sourcePaths = [
    treePath,
    assignmentPath,
    reviewPath,
    journalPath,
    plannerPath,
    ...loopPaths,
  ];
  const stabilityPaths = [treePath, assignmentPath, reviewPath, ...loopPaths];
  const beforeHashes = Object.fromEntries(
    stabilityPaths.map((path) => [path, fileHash(path)]),
  );
  const tree = loadTree(treePath);
  const assignments = parseAssignments(assignmentPath);
  const reviews = parseReviews(reviewPath);
  const sessions = loadSessions(
    options.stateDbPath,
    referencedSessionIds(tree, assignments),
  );
  const loopCapture = loadLoops(options.appDir, tree);
  const stateDbAvailable = existsSync(options.stateDbPath);
  const loopSourcesAvailable = loopPaths.every((path) => existsSync(path));
  const snapshot = buildProjectSnapshotV2({
    projectId: options.projectId,
    tree,
    assignments,
    sessions,
    reviews,
    loops: loopCapture.loops,
    attemptHeartbeats: loopCapture.attemptHeartbeats,
    deliveryGaps: loadDeliveryGaps(
      options.stateDbPath,
      options.projectId,
      nowMs,
    ),
    sourceCoverage: {
      assignments: existsSync(assignmentPath) ? "available" : "unavailable",
      sessions: stateDbAvailable ? "available" : "unavailable",
      reviews: "available",
      controllers: loopSourcesAvailable ? "available" : "unavailable",
      controllerLiveness: loopSourcesAvailable ? "available" : "unavailable",
      delivery: stateDbAvailable ? "available" : "unavailable",
    },
    nowMs,
    sourceMeta: sourceMeta([...sourcePaths, options.stateDbPath]),
  });
  const current = summarizeTaskTree(config(options, treePath));
  const structuralTaskIds = new Set(
    Object.values(tree.tasks).flatMap((task) => {
      const parentId = text(task.parent_id);
      return parentId ? [parentId] : [];
    }),
  );
  const parity = compareFrontiersV2(snapshot, current.frontier, {
    ignoredCurrentOnly: {
      blocked: current.frontier.blocked.filter((taskId) =>
        structuralTaskIds.has(taskId),
      ),
    },
  });
  const health = buildProjectHealth({
    appDir: options.appDir,
    projectDir: options.projectDir,
    nowMs,
  });
  const healthParity = {
    frontier: compareFrontiersV2(snapshot, {
      runnable: health.frontier.runnable,
      waiting: health.frontier.waiting,
      active: health.frontier.active,
      review: health.frontier.review,
      blocked: health.frontier.blockedSample,
    }),
    counts: {
      matches:
        snapshot.frontier.counts.runnable === health.frontier.counts.runnable &&
        snapshot.frontier.counts.waiting === health.frontier.counts.waiting &&
        snapshot.frontier.counts.active === health.frontier.counts.active &&
        snapshot.frontier.counts.review === health.frontier.counts.review &&
        snapshot.frontier.counts.blocked === health.frontier.counts.blocked &&
        snapshot.frontier.counts.backlog === health.frontier.counts.backlog &&
        snapshot.frontier.counts.done === health.frontier.counts.done &&
        snapshot.frontier.counts.total === health.frontier.counts.total &&
        snapshot.frontier.counts.leafTotal === health.frontier.counts.leafTotal,
      v2: snapshot.frontier.counts,
      current: health.frontier.counts,
    },
    controllers: snapshot.controllers.map((controller) => {
      const currentLoop = health.loops.find(
        (loop) => loop.taskId === controller.taskId,
      );
      const matches = Boolean(
        currentLoop &&
        currentLoop.completionReady === controller.completionReady &&
        currentLoop.unrepresentedNonTerminalCount ===
          controller.reportedUnrepresentedNonTerminalCount &&
        JSON.stringify(currentLoop.stateCounts) ===
          JSON.stringify(controller.stateCounts),
      );
      return {
        taskId: controller.taskId,
        matches,
        v2: {
          completionReady: controller.completionReady,
          unrepresentedNonTerminalCount:
            controller.reportedUnrepresentedNonTerminalCount,
          stateCounts: controller.stateCounts,
        },
        current: currentLoop
          ? {
              completionReady: currentLoop.completionReady,
              unrepresentedNonTerminalCount:
                currentLoop.unrepresentedNonTerminalCount,
              stateCounts: currentLoop.stateCounts,
            }
          : null,
      };
    }),
  };
  const afterHashes = Object.fromEntries(
    stabilityPaths.map((path) => [path, fileHash(path)]),
  );
  const changedPaths = stabilityPaths.filter(
    (path) => beforeHashes[path] !== afterHashes[path],
  );
  const unchanged = stabilityPaths.every(
    (path) => beforeHashes[path] === afterHashes[path],
  );
  return {
    snapshot,
    parity,
    healthParity,
    noWriteVerification: {
      readOnlyByConstruction: true,
      stableInputs: unchanged,
      unchanged,
      changedPaths,
      interpretation: unchanged
        ? ("stable-inputs" as const)
        : ("concurrent-input-change" as const),
      beforeHashes,
      afterHashes,
    },
  };
}

function formatSummary(
  result: ReturnType<typeof captureProjectSnapshotV2>,
): string {
  const { snapshot, parity, noWriteVerification } = result;
  const parityNotes = Object.entries(parity)
    .filter(([, value]) => !value.matches)
    .map(
      ([key, value]) =>
        `${key}(${value.reason}; v2-only=${value.v2Only.length}, current-only=${value.currentOnly.length})`,
    );
  const compatible = Object.values(parity).every((value) => value.compatible);
  const parityStatus = !noWriteVerification.stableInputs
    ? "inconclusive (input generation changed during capture)"
    : parityNotes.length === 0
      ? "exact"
      : `${compatible ? "compatible" : "mismatch"}; ${parityNotes.join("; ")}`;
  const invariantCounts: Record<string, number> = {};
  for (const finding of snapshot.invariants) {
    invariantCounts[finding.type] = (invariantCounts[finding.type] ?? 0) + 1;
  }
  const sourceEntries = Object.values(snapshot.sourceMeta ?? {});
  const controllerMatches = result.healthParity.controllers.filter(
    (controller) => controller.matches,
  ).length;
  return [
    `${snapshot.version} ${snapshot.capturedAt}`,
    `frontier: runnable=${snapshot.frontier.counts.runnable} waiting=${snapshot.frontier.counts.waiting} active=${snapshot.frontier.counts.active} review=${snapshot.frontier.counts.review} blocked=${snapshot.frontier.counts.blocked}`,
    `parity: ${parityStatus}`,
    `mirror: active=${snapshot.mirrorDrift.active.matches} review=${snapshot.mirrorDrift.review.matches} waiting=${snapshot.mirrorDrift.waiting.matches} runnable=${snapshot.mirrorDrift.runnable.matches}`,
    `health: counts=${result.healthParity.counts.matches} controllers=${controllerMatches}/${result.healthParity.controllers.length}`,
    `sources: available=${sourceEntries.filter((source) => source.available).length} missing=${sourceEntries.filter((source) => !source.available).length}`,
    `invariants: ${JSON.stringify(invariantCounts)}`,
    `read-only: by-construction; inputs=${noWriteVerification.interpretation}${
      noWriteVerification.changedPaths.length > 0
        ? ` (${noWriteVerification.changedPaths.length} changed)`
        : ""
    }`,
  ].join("\n");
}

if (import.meta.main) {
  const options = cliOptions(process.argv.slice(2));
  const result = captureProjectSnapshotV2(options);
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else console.log(formatSummary(result));
}
