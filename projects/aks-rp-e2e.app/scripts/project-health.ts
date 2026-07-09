import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  peekTaskAssignments,
  summarizeTaskTree,
  taskTreeConfig,
} from "../workflows/lib/task-tree-tools.ts";
import {
  readTaskTree,
  type TaskNode,
  type TaskTree,
} from "../workflows/lib/task-tree-store.ts";
import appManifest from "../app.ts";

type JsonObject = Record<string, unknown>;

type JsonLine = JsonObject & {
  ts?: string;
  kind?: string;
  task_id?: string;
  status?: string;
  decision?: string;
};

type SignalSeverity = "info" | "warn" | "critical";
type HealthStatus = "complete" | "moving" | "attention" | "stalled";

type EventSelector =
  | string
  | {
      type?: string;
      target?: {
        project?: string;
        taskId?: string;
      };
      owner?: string;
      actions?: string[];
    };

type WorkflowRoute = {
  name?: string;
  enabled?: boolean;
  accepts?: unknown;
  on?: unknown;
  emits?: unknown;
};

type Schedule = {
  id?: string;
  emits?: Array<Record<string, unknown>>;
  event?: Record<string, unknown>;
};

type ProjectAction = {
  event?: (params?: unknown) => Record<string, unknown>;
};

type ProjectAppManifest = {
  workflowHandlers?: WorkflowRoute[];
  schedules?: Schedule[];
  actions?: Record<string, ProjectAction>;
  eventGraph?: {
    externalEvents?: string[];
    limits?: {
      maxHandlersPerEvent?: number;
    };
  };
};

export type ProjectHealthSignal = {
  severity: SignalSeverity;
  code: string;
  message: string;
  taskIds?: string[];
};

export type ActivePipelineWaitReport = {
  featureKey: string;
  runId: string;
  runUrl: string | null;
  runStatus: string | null;
  runTitle: string | null;
  watchedCondition: string;
  expectedArtifact: string;
  owner: string;
  nextCheckAt: string | null;
  fallbackAt: string | null;
};

export type ProcessGraphReport = {
  available: boolean;
  reason: string | null;
  routeCount: number;
  emittedEventCount: number;
  consumedEventCount: number;
  externalEventCount: number;
  unhandledEvents: string[];
  multiRouteEvents: Array<{
    event: string;
    routes: string[];
  }>;
  actionErrors: string[];
};

export type ProjectHealthReport = {
  capturedAt: string;
  status: HealthStatus;
  summary: string;
  appDir: string;
  projectDir: string;
  flow: string[];
  frontier: {
    roots: string[];
    runnable: string[];
    waiting: string[];
    active: string[];
    review: string[];
    blockedSample: string[];
    counts: {
      runnable: number;
      waiting: number;
      active: number;
      review: number;
      blocked: number;
      backlog: number;
      done: number;
      total: number;
      leafTotal: number;
    };
  };
  movement: {
    lookbackMinutes: number;
    lastJournalAt: string | null;
    lastPlannerAt: string | null;
    lastReviewerAt: string | null;
    journal: Record<string, number>;
    plannerRuns: number;
    reviewerRuns: number;
    tasksMarkedDone24h: number;
    workerCompleted24h: number;
    reviewDecisions24h: Record<string, number>;
  };
  processGraph: ProcessGraphReport;
  loops: Array<{
    taskId: string;
    state: string;
    workflow: string | null;
    completionReady: boolean | null;
    reason: string | null;
    pending: number | null;
    running: number | null;
    done: number | null;
    error: number | null;
    unrepresentedNonTerminalCount: number | null;
    activePipelineFeatureKeys: string[];
    activePipelineWaits: ActivePipelineWaitReport[];
    stateCounts: Record<string, number>;
    updatedAt: string | null;
  }>;
  assignments: {
    queued: number;
    taskIds: string[];
  };
  staleActiveTaskIds: string[];
  signals: ProjectHealthSignal[];
  nextActions: string[];
};

type BuildProjectHealthOptions = {
  appDir?: string;
  projectDir?: string;
  worker?: string;
  maxConcurrent?: number;
  nowMs?: number;
  lookbackMinutes?: number;
  staleActiveMinutes?: number;
};

type ProjectHealthBaseReport = Omit<
  ProjectHealthReport,
  "status" | "summary" | "signals" | "nextActions"
>;

const defaultAppDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const durableLoopTasks = [
  {
    taskId: "aks-spec-verification-loop",
    workflow: "spec-loop-controller",
    statePath: ".state/spec-loop/state.json",
    collectionKey: "specs",
  },
  {
    taskId: "aks-feature-reference-loop",
    workflow: "feature-reference-loop-controller",
    statePath: ".state/feature-reference-loop/state.json",
    collectionKey: "features",
  },
  {
    taskId: "aks-feature-compact-loop",
    workflow: "feature-compact-loop-controller",
    statePath: ".state/feature-compact-loop/state.json",
    collectionKey: "features",
  },
] as const;

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  return process.argv[index + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function numberOption(name: string, fallback: number): number {
  const raw = option(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readJson<T>(path: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

function readJsonl(path: string, limit = 2000): JsonLine[] {
  if (!existsSync(path)) return [];
  try {
    const lines = readFileSync(path, "utf-8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    return lines
      .slice(Math.max(0, lines.length - limit))
      .map((line) => JSON.parse(line) as JsonLine)
      .filter((row) => row && typeof row === "object");
  } catch {
    return [];
  }
}

function parseTime(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function taskState(task: TaskNode | undefined): string {
  const raw = String(task?.state ?? task?.status ?? "backlog");
  if (raw === "accepted") return "done";
  if (raw === "ready" || raw === "proposed") return "backlog";
  if (raw === "claimed_done" || raw === "rejected") return "review";
  if (raw === "superseded" || raw === "cancelled") return "done";
  return raw;
}

function isLeafTask(task: TaskNode): boolean {
  return Array.isArray(task.children) ? task.children.length === 0 : true;
}

function objectValue(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function eventTypeFromSelector(selector: EventSelector): string | null {
  if (typeof selector === "string") return selector;
  return typeof selector.type === "string" && selector.type.trim()
    ? selector.type.trim()
    : null;
}

function routeSelectors(route: WorkflowRoute): EventSelector[] {
  const raw = route.accepts ?? route.on;
  return Array.isArray(raw) ? (raw as EventSelector[]) : [];
}

function routeInputEvents(route: WorkflowRoute): string[] {
  return routeSelectors(route)
    .map(eventTypeFromSelector)
    .filter((event): event is string => Boolean(event));
}

function selectorConflictKey(selector: EventSelector): string | null {
  if (typeof selector === "string") return selector;
  const type = eventTypeFromSelector(selector);
  if (!type) return null;
  const target = selector.target;
  const targetParts = [
    target?.project ? `project=${target.project}` : "",
    target?.taskId ? `taskId=${target.taskId}` : "",
  ].filter(Boolean);
  const owner = selector.owner ? `owner=${selector.owner}` : "";
  const actions =
    Array.isArray(selector.actions) && selector.actions.length
      ? `actions=${selector.actions.join("|")}`
      : "";
  const qualifiers = [...targetParts, owner, actions].filter(Boolean);
  return qualifiers.length ? `${type} [${qualifiers.join(",")}]` : type;
}

function eventTarget(event: Record<string, unknown>): JsonObject {
  return objectValue(event.target);
}

function selectorMatchesEvent(
  selector: EventSelector,
  event: Record<string, unknown>,
): boolean {
  const eventType = stringValue(event.type);
  if (!eventType) return false;
  if (typeof selector === "string") return selector === eventType;
  if (selector.type !== eventType) return false;

  const selectorProject = selector.target?.project;
  if (
    typeof selectorProject === "string" &&
    eventTarget(event).project !== selectorProject
  ) {
    return false;
  }

  const selectorTaskId = selector.target?.taskId;
  if (
    typeof selectorTaskId === "string" &&
    eventTarget(event).taskId !== selectorTaskId
  ) {
    return false;
  }

  if (selector.actions?.length) {
    return (
      typeof event.action === "string" &&
      selector.actions.includes(event.action)
    );
  }
  return true;
}

function selectorConsumesEventType(
  selector: EventSelector,
  eventType: string,
): boolean {
  return eventTypeFromSelector(selector) === eventType;
}

function scheduleEvents(schedule: Schedule): Array<Record<string, unknown>> {
  return Array.isArray(schedule.emits)
    ? schedule.emits
    : schedule.event
      ? [schedule.event]
      : [];
}

function addMapValue(map: Map<string, string[]>, key: string, value: string) {
  const values = map.get(key) ?? [];
  values.push(value);
  map.set(key, values);
}

function actionEvents(projectApp: ProjectAppManifest): {
  emitted: Array<{ action: string; event: string }>;
  errors: string[];
} {
  const emitted: Array<{ action: string; event: string }> = [];
  const errors: string[] = [];
  for (const [actionName, action] of Object.entries(projectApp.actions ?? {})) {
    if (typeof action.event !== "function") continue;
    try {
      const event = action.event({
        taskId: "health-check",
        problemKey: "health-check",
      });
      if (typeof event?.type === "string" && event.type.trim()) {
        emitted.push({ action: actionName, event: event.type.trim() });
      } else {
        errors.push(`action ${actionName} did not return event.type`);
      }
    } catch (err) {
      errors.push(
        `action ${actionName} could not be evaluated: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return { emitted, errors };
}

export function buildProcessGraphReport(
  projectApp: ProjectAppManifest,
): ProcessGraphReport {
  const routes = (projectApp.workflowHandlers ?? []).filter(
    (route) => route.enabled !== false,
  );
  const selectors = routes.flatMap(routeSelectors);
  const consumedEvents = new Set<string>();
  const routeSelectorConsumers = new Map<string, string[]>();
  for (const route of routes) {
    for (const event of routeInputEvents(route)) {
      consumedEvents.add(event);
    }
    for (const selector of routeSelectors(route)) {
      const key = selectorConflictKey(selector);
      if (key) addMapValue(routeSelectorConsumers, key, route.name ?? "route");
    }
  }

  const externalEvents = new Set(projectApp.eventGraph?.externalEvents ?? []);
  const eventObjectHandled = (event: Record<string, unknown>) => {
    const type = stringValue(event.type);
    return Boolean(
      type &&
      (externalEvents.has(type) ||
        selectors.some((selector) => selectorMatchesEvent(selector, event))),
    );
  };
  const eventTypeHandled = (eventType: string) =>
    externalEvents.has(eventType) ||
    selectors.some((selector) =>
      selectorConsumesEventType(selector, eventType),
    );
  const unhandledEvents: string[] = [];
  let emittedEventCount = 0;

  for (const schedule of projectApp.schedules ?? []) {
    for (const emitted of scheduleEvents(schedule)) {
      const event = stringValue(emitted.type);
      if (!event) continue;
      emittedEventCount += 1;
      if (!eventObjectHandled(emitted)) {
        unhandledEvents.push(
          `schedule ${schedule.id ?? "unnamed"} emits ${event}`,
        );
      }
    }
  }

  const actionResult = actionEvents(projectApp);
  for (const action of actionResult.emitted) {
    emittedEventCount += 1;
    if (!eventTypeHandled(action.event)) {
      unhandledEvents.push(`action ${action.action} emits ${action.event}`);
    }
  }

  for (const route of routes) {
    const emits = Array.isArray(route.emits) ? route.emits : [];
    for (const emitted of emits) {
      if (typeof emitted !== "string" || !emitted.trim()) continue;
      emittedEventCount += 1;
      if (!eventTypeHandled(emitted)) {
        unhandledEvents.push(
          `route ${route.name ?? "unnamed"} emits ${emitted}`,
        );
      }
    }
  }

  const maxRoutes = projectApp.eventGraph?.limits?.maxHandlersPerEvent ?? 1;
  const multiRouteEvents = [...routeSelectorConsumers.entries()]
    .filter(([, routesForEvent]) => routesForEvent.length > maxRoutes)
    .map(([event, routesForEvent]) => ({
      event,
      routes: routesForEvent,
    }));

  return {
    available: true,
    reason: null,
    routeCount: routes.length,
    emittedEventCount,
    consumedEventCount: consumedEvents.size,
    externalEventCount: externalEvents.size,
    unhandledEvents: unhandledEvents.sort((a, b) => a.localeCompare(b)),
    multiRouteEvents: multiRouteEvents.sort((a, b) =>
      a.event.localeCompare(b.event),
    ),
    actionErrors: actionResult.errors.sort((a, b) => a.localeCompare(b)),
  };
}

function unavailableProcessGraph(reason: string): ProcessGraphReport {
  return {
    available: false,
    reason,
    routeCount: 0,
    emittedEventCount: 0,
    consumedEventCount: 0,
    externalEventCount: 0,
    unhandledEvents: [],
    multiRouteEvents: [],
    actionErrors: [],
  };
}

function stringArrayValue(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function activePipelineWaitsValue(value: unknown): ActivePipelineWaitReport[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): ActivePipelineWaitReport | null => {
      const record = objectValue(item);
      const featureKey = stringValue(record.featureKey);
      const runId = stringValue(record.runId);
      if (!featureKey || !runId) return null;
      return {
        featureKey,
        runId,
        runUrl: stringValue(record.runUrl),
        runStatus: stringValue(record.runStatus),
        runTitle: stringValue(record.runTitle),
        watchedCondition:
          stringValue(record.watchedCondition) ||
          `Azure DevOps run ${runId} reaches completed status`,
        expectedArtifact:
          stringValue(record.expectedArtifact) ||
          ".state/feature-compact-loop/artifacts/<runId>/",
        owner: stringValue(record.owner) || "feature-compact-loop-controller",
        nextCheckAt: stringValue(record.nextCheckAt),
        fallbackAt: stringValue(record.fallbackAt),
      };
    })
    .filter((item): item is ActivePipelineWaitReport => Boolean(item));
}

function directFeatureCompactActivePipelineWaits(
  appDir: string,
): ActivePipelineWaitReport[] {
  const state = readJson<JsonObject | null>(
    join(appDir, ".state", "feature-compact-loop", "state.json"),
    null,
  );
  const features = objectValue(state?.features);
  return Object.entries(features)
    .map(([featureKey, raw]): ActivePipelineWaitReport | null => {
      const feature = objectValue(raw);
      const runId = stringValue(feature.activeWorkflowRunId);
      if (!runId) return null;
      return {
        featureKey,
        runId,
        runUrl: stringValue(feature.lastWorkflowRunUrl),
        runStatus: null,
        runTitle: null,
        watchedCondition: `Azure DevOps run ${runId} reaches completed status`,
        expectedArtifact:
          stringValue(feature.lastResultPath) ||
          ".state/feature-compact-loop/artifacts/<runId>/",
        owner: "feature-compact-loop-controller",
        nextCheckAt: stringValue(feature.nextCheckAt),
        fallbackAt: stringValue(feature.fallbackAt),
      };
    })
    .filter((item): item is ActivePipelineWaitReport => Boolean(item))
    .sort((a, b) => a.featureKey.localeCompare(b.featureKey));
}

function mergeActivePipelineWaits(
  left: ActivePipelineWaitReport[],
  right: ActivePipelineWaitReport[],
): ActivePipelineWaitReport[] {
  const merged = new Map<string, ActivePipelineWaitReport>();
  for (const wait of [...left, ...right]) {
    merged.set(`${wait.featureKey}:${wait.runId}`, {
      ...(merged.get(`${wait.featureKey}:${wait.runId}`) ?? {}),
      ...wait,
    });
  }
  return [...merged.values()].sort((a, b) =>
    a.featureKey === b.featureKey
      ? a.runId.localeCompare(b.runId)
      : a.featureKey.localeCompare(b.featureKey),
  );
}

function sample(values: string[], limit = 8): string[] {
  return values.slice(0, limit);
}

function latestTs(rows: JsonLine[]): string | null {
  let latest: { ms: number; ts: string } | null = null;
  for (const row of rows) {
    const ms = parseTime(row.ts);
    if (ms == null) continue;
    if (!latest || ms > latest.ms) latest = { ms, ts: row.ts! };
  }
  return latest?.ts ?? null;
}

function rowsSince(rows: JsonLine[], sinceMs: number): JsonLine[] {
  return rows.filter((row) => {
    const ms = parseTime(row.ts);
    return ms != null && ms >= sinceMs;
  });
}

function countBy<T extends string>(values: T[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function taskLastActivityMs(task: TaskNode): number | null {
  const trace = objectValue(task.trace);
  const taskRecord = objectValue(task);
  const candidates = [
    taskRecord.updated_at,
    trace.worker_started_at,
    trace.assigned_at,
    trace.completed_at,
    trace.reviewed_at,
  ];
  let latest: number | null = null;
  for (const candidate of candidates) {
    const ms = parseTime(candidate);
    if (ms == null) continue;
    latest = latest == null ? ms : Math.max(latest, ms);
  }
  return latest;
}

function activeJournalActivityByTask(
  rows: JsonLine[],
  sinceMs: number,
): Set<string> {
  const active = new Set<string>();
  for (const row of rowsSince(rows, sinceMs)) {
    const taskId = stringValue(row.task_id);
    if (!taskId) continue;
    active.add(taskId);
  }
  return active;
}

function staleActiveTasks(input: {
  tree: TaskTree;
  journalRows: JsonLine[];
  nowMs: number;
  staleActiveMs: number;
}): string[] {
  const recentTaskActivity = activeJournalActivityByTask(
    input.journalRows,
    input.nowMs - input.staleActiveMs,
  );
  return Object.values(input.tree.tasks ?? {})
    .filter((task) => isLeafTask(task) && taskState(task) === "active")
    .filter((task) => {
      if (recentTaskActivity.has(task.id)) return false;
      const last = taskLastActivityMs(task);
      return last == null || input.nowMs - last > input.staleActiveMs;
    })
    .map((task) => task.id)
    .sort((a, b) => a.localeCompare(b));
}

function loopStateCounts(
  appDir: string,
  loop: (typeof durableLoopTasks)[number],
): Record<string, number> {
  const state = readJson<JsonObject | null>(join(appDir, loop.statePath), null);
  const collection = objectValue(state?.[loop.collectionKey]);
  const statuses: string[] = [];
  for (const value of Object.values(collection)) {
    const record = objectValue(value);
    statuses.push(String(record.status ?? "unknown"));
  }
  return countBy(statuses);
}

function taskWorkflowProgress(task: TaskNode | undefined): JsonObject {
  return objectValue(objectValue(task?.context).workflowProgress);
}

function buildLoopReports(appDir: string, tree: TaskTree) {
  return durableLoopTasks.map((loop) => {
    const task = tree.tasks?.[loop.taskId];
    const progress = taskWorkflowProgress(task);
    const directActivePipelineWaits =
      loop.taskId === "aks-feature-compact-loop"
        ? directFeatureCompactActivePipelineWaits(appDir)
        : [];
    const activePipelineWaits = mergeActivePipelineWaits(
      activePipelineWaitsValue(progress.activePipelineWaits),
      directActivePipelineWaits,
    );
    const activePipelineFeatureKeys = [
      ...new Set([
        ...stringArrayValue(progress.activePipelineFeatureKeys),
        ...activePipelineWaits.map((wait) => wait.featureKey),
      ]),
    ].sort((a, b) => a.localeCompare(b));
    return {
      taskId: loop.taskId,
      state: taskState(task),
      workflow:
        typeof task?.workflow === "string" && task.workflow.trim()
          ? task.workflow
          : loop.workflow,
      completionReady:
        typeof progress.completionReady === "boolean"
          ? progress.completionReady
          : null,
      reason: stringValue(progress.reason),
      pending: numberValue(progress.pending),
      running: numberValue(progress.running),
      done: numberValue(progress.done),
      error: numberValue(progress.error),
      unrepresentedNonTerminalCount: numberValue(
        progress.unrepresentedNonTerminalCount,
      ),
      activePipelineFeatureKeys,
      activePipelineWaits,
      stateCounts: loopStateCounts(appDir, loop),
      updatedAt: stringValue(progress.updatedAt),
    };
  });
}

function buildSignals(input: {
  report: ProjectHealthBaseReport;
  incompleteLoops: string[];
  recentMovementCount: number;
}): ProjectHealthSignal[] {
  const signals: ProjectHealthSignal[] = [];
  const frontier = input.report.frontier;

  if (frontier.counts.active > 0) {
    signals.push({
      severity: "info",
      code: "frontier.active",
      message: `${frontier.counts.active} active frontier item(s) are currently being worked.`,
      taskIds: sample(frontier.active),
    });
  }

  if (frontier.roots.length !== 1) {
    signals.push({
      severity: "warn",
      code: "task-tree.root-count",
      message: `Task tree should have exactly one root, found ${frontier.roots.length}: ${frontier.roots.join(", ") || "none"}.`,
      taskIds: sample(frontier.roots),
    });
  }

  if (frontier.counts.review > 0) {
    signals.push({
      severity: "warn",
      code: "frontier.review-pending",
      message: `${frontier.counts.review} task(s) are waiting for review.`,
      taskIds: sample(frontier.review),
    });
  }

  if (frontier.counts.waiting > 0) {
    signals.push({
      severity: "info",
      code: "frontier.waiting",
      message: `${frontier.counts.waiting} runnable-looking task(s) are waiting on dependency or capacity gates.`,
      taskIds: sample(frontier.waiting),
    });
  }

  if (input.report.assignments.queued > 0) {
    signals.push({
      severity: "warn",
      code: "assignment.queue-not-empty",
      message: `${input.report.assignments.queued} assignment row(s) are queued but not yet consumed by workers.`,
      taskIds: sample(input.report.assignments.taskIds),
    });
  }

  if (input.report.processGraph.unhandledEvents.length > 0) {
    signals.push({
      severity: "critical",
      code: "route.unhandled-event",
      message: `${input.report.processGraph.unhandledEvents.length} emitted event(s) have no route or declared boundary.`,
    });
  }

  if (input.report.processGraph.multiRouteEvents.length > 0) {
    signals.push({
      severity: "warn",
      code: "route.multi-route",
      message: `${input.report.processGraph.multiRouteEvents.length} route selector(s) have more consumers than the app graph allows.`,
    });
  }

  if (input.report.processGraph.actionErrors.length > 0) {
    signals.push({
      severity: "warn",
      code: "route.action-read-error",
      message: `${input.report.processGraph.actionErrors.length} action event producer(s) could not be evaluated for the static route graph.`,
    });
  }

  if (input.report.staleActiveTaskIds.length > 0) {
    signals.push({
      severity: "critical",
      code: "frontier.stale-active",
      message: `${input.report.staleActiveTaskIds.length} active task(s) have no recent task activity.`,
      taskIds: sample(input.report.staleActiveTaskIds),
    });
  }

  if (
    frontier.counts.runnable === 0 &&
    frontier.counts.active === 0 &&
    frontier.counts.review === 0 &&
    frontier.counts.waiting === 0 &&
    input.incompleteLoops.length > 0
  ) {
    signals.push({
      severity: "critical",
      code: "loop.incomplete-without-frontier",
      message: `Incomplete durable loop(s) have no executable frontier: ${input.incompleteLoops.join(", ")}.`,
      taskIds: input.incompleteLoops,
    });
  }

  if (
    input.recentMovementCount === 0 &&
    (frontier.counts.active > 0 ||
      frontier.counts.review > 0 ||
      frontier.counts.runnable > 0 ||
      frontier.counts.waiting > 0)
  ) {
    signals.push({
      severity: "warn",
      code: "movement.quiet-frontier",
      message: `No task, planner, or reviewer movement was observed in the last ${input.report.movement.lookbackMinutes} minute(s).`,
    });
  }

  if (
    frontier.counts.runnable === 0 &&
    frontier.counts.active === 0 &&
    frontier.counts.review === 0 &&
    frontier.counts.waiting === 0 &&
    frontier.counts.blocked > 0 &&
    input.incompleteLoops.length === 0
  ) {
    signals.push({
      severity: "warn",
      code: "frontier.blocked-only",
      message: `${frontier.counts.blocked} blocked leaf task(s) remain and no executable frontier is exposed.`,
      taskIds: sample(frontier.blockedSample),
    });
  }

  return signals;
}

function chooseStatus(input: {
  frontier: ProjectHealthReport["frontier"];
  signals: ProjectHealthSignal[];
  incompleteLoopCount: number;
  total: number;
}): HealthStatus {
  if (
    input.total > 0 &&
    input.frontier.counts.runnable === 0 &&
    input.frontier.counts.waiting === 0 &&
    input.frontier.counts.active === 0 &&
    input.frontier.counts.review === 0 &&
    input.frontier.counts.blocked === 0 &&
    input.incompleteLoopCount === 0
  ) {
    return "complete";
  }
  if (input.signals.some((signal) => signal.severity === "critical")) {
    return "stalled";
  }
  if (
    input.signals.some((signal) => signal.severity === "warn") ||
    input.frontier.counts.runnable > 0 ||
    input.frontier.counts.waiting > 0
  ) {
    return "attention";
  }
  return "moving";
}

function buildNextActions(report: Omit<ProjectHealthReport, "nextActions">) {
  const actions: string[] = [];
  const critical = report.signals.filter(
    (signal) => signal.severity === "critical",
  );
  if (critical.length > 0) {
    actions.push(
      `Address critical health signal ${critical[0].code}: ${critical[0].message}`,
    );
  }
  const rootCount = report.signals.find(
    (signal) => signal.code === "task-tree.root-count",
  );
  if (rootCount) {
    actions.push(
      `Repair or intentionally archive the extra task-tree root(s): ${sample(rootCount.taskIds ?? [], 5).join(", ")}.`,
    );
  }
  if (report.frontier.counts.review > 0) {
    actions.push(
      `Review ${report.frontier.counts.review} pending task claim(s): ${sample(report.frontier.review, 5).join(", ")}.`,
    );
  }
  if (report.frontier.counts.active > 0) {
    actions.push(
      `Let active work finish or inspect stale active leaves: ${sample(report.frontier.active, 5).join(", ")}.`,
    );
  }
  if (report.frontier.counts.waiting > 0) {
    actions.push(
      `Inspect waiting leaves for capacity/dependency gates: ${sample(report.frontier.waiting, 5).join(", ")}.`,
    );
  }
  if (actions.length === 0 && report.frontier.counts.blocked > 0) {
    actions.push(
      `Review exact blocked waits and resume only when their named conditions land: ${sample(report.frontier.blockedSample, 5).join(", ")}.`,
    );
  }
  if (actions.length === 0) {
    actions.push("No immediate action from the live task frontier.");
  }
  return actions;
}

export function buildProjectHealth(
  options: BuildProjectHealthOptions = {},
): ProjectHealthReport {
  const appDir = resolve(
    options.appDir ??
      process.env.AKS_RP_E2E_APP_DIR ??
      process.env.APP_DIR ??
      defaultAppDir,
  );
  const projectDir = resolve(
    options.projectDir ??
      process.env.PROJECT_DIR ??
      join(appDir, "..", "aks-rp-e2e"),
  );
  const nowMs = options.nowMs ?? Date.now();
  const lookbackMinutes = options.lookbackMinutes ?? 30;
  const staleActiveMinutes = options.staleActiveMinutes ?? 30;
  const config = taskTreeConfig({
    appDir,
    projectDir,
    worker: options.worker ?? process.env.WORKER ?? "aks-explorer",
    maxConcurrent:
      options.maxConcurrent ??
      (Number.parseInt(process.env.MAX_CONCURRENT ?? "", 10) || 1),
  });

  const tree = readTaskTree(config);
  const summary = summarizeTaskTree(config);
  const assignments = peekTaskAssignments(config);
  const journalRows = readJsonl(join(appDir, ".state", "journal.jsonl"));
  const plannerRows = readJsonl(join(appDir, ".state", "planner-runs.jsonl"));
  const reviewerRows = readJsonl(
    join(appDir, ".state", "task-reviewer-runs.jsonl"),
  );
  const sinceMs = nowMs - lookbackMinutes * 60 * 1000;
  const dayAgoMs = nowMs - 24 * 60 * 60 * 1000;
  const recentJournal = rowsSince(journalRows, sinceMs);
  const recentPlanner = rowsSince(plannerRows, sinceMs);
  const recentReviewer = rowsSince(reviewerRows, sinceMs);
  const journalCounts = countBy(
    recentJournal.map((row) => String(row.kind ?? "unknown")),
  );
  const dayJournal = rowsSince(journalRows, dayAgoMs);
  const dayReviewer = rowsSince(reviewerRows, dayAgoMs);
  const loops = buildLoopReports(appDir, tree);
  const incompleteLoops = loops
    .filter((loop) => loop.completionReady === false)
    .map((loop) => loop.taskId);
  const staleActiveTaskIds = staleActiveTasks({
    tree,
    journalRows,
    nowMs,
    staleActiveMs: staleActiveMinutes * 60 * 1000,
  });
  const processGraph =
    appDir === defaultAppDir
      ? buildProcessGraphReport(appManifest as ProjectAppManifest)
      : unavailableProcessGraph(
          "Static app manifest readout is available for the default app directory only.",
        );
  const frontier = {
    roots: summary.roots ?? [],
    runnable: summary.frontier.runnable ?? [],
    waiting: summary.frontier.waiting ?? [],
    active: summary.frontier.active ?? [],
    review: summary.frontier.review ?? [],
    blockedSample: sample(summary.frontier.blocked ?? [], 20),
    counts: {
      runnable: (summary.frontier.runnable ?? []).length,
      waiting: (summary.frontier.waiting ?? []).length,
      active: (summary.frontier.active ?? []).length,
      review: (summary.frontier.review ?? []).length,
      blocked: Number(summary.counts?.blocked ?? 0),
      backlog: Number(summary.counts?.backlog ?? 0),
      done: Number(summary.counts?.done ?? 0),
      total: Number(summary.total ?? 0),
      leafTotal: Number(summary.leaf_total ?? 0),
    },
  };
  const movement = {
    lookbackMinutes,
    lastJournalAt: latestTs(journalRows),
    lastPlannerAt: latestTs(plannerRows),
    lastReviewerAt: latestTs(reviewerRows),
    journal: journalCounts,
    plannerRuns: recentPlanner.length,
    reviewerRuns: recentReviewer.length,
    tasksMarkedDone24h: dayJournal.filter(
      (row) => row.kind === "task_marked_done",
    ).length,
    workerCompleted24h: dayJournal.filter(
      (row) => row.kind === "task_worker_completed",
    ).length,
    reviewDecisions24h: countBy(
      dayReviewer.map((row) => String(row.decision ?? "unknown")),
    ),
  };
  const baseReport = {
    capturedAt: new Date(nowMs).toISOString(),
    appDir,
    projectDir,
    flow: [
      "project.planning.requested wakes the planner",
      "planner assigns runnable task-tree leaves or pulses durable loop roots",
      "task-worker runs the task workflow and writes a structured completion claim",
      "task-reviewer judges the claim",
      "planner applies accept, redo, follow-up, block, or escalation back to the task tree",
    ],
    frontier,
    movement,
    processGraph,
    loops,
    assignments: {
      queued: assignments.length,
      taskIds: assignments.map((assignment) => assignment.taskId),
    },
    staleActiveTaskIds,
  };
  const recentMovementCount =
    recentJournal.length + recentPlanner.length + recentReviewer.length;
  const signals = buildSignals({
    report: baseReport,
    incompleteLoops,
    recentMovementCount,
  });
  const status = chooseStatus({
    frontier,
    signals,
    incompleteLoopCount: incompleteLoops.length,
    total: frontier.counts.total,
  });
  const reportWithoutActions = {
    ...baseReport,
    status,
    summary: `${status}: ${frontier.counts.active} active, ${frontier.counts.review} review, ${frontier.counts.waiting} waiting, ${frontier.counts.runnable} runnable, ${frontier.counts.blocked} blocked leaf task(s); ${recentMovementCount} movement event(s) in the last ${lookbackMinutes} minute(s).`,
    signals,
  };
  return {
    ...reportWithoutActions,
    nextActions: buildNextActions(reportWithoutActions),
  };
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

export function formatProjectHealth(report: ProjectHealthReport): string {
  const lines: string[] = [];
  lines.push(`Project health: ${report.status}`);
  lines.push(report.summary);
  lines.push("");
  lines.push("How it runs:");
  for (const step of report.flow) lines.push(`- ${step}`);
  lines.push("");
  lines.push("Frontier:");
  lines.push(
    `- active=${report.frontier.counts.active}, review=${report.frontier.counts.review}, waiting=${report.frontier.counts.waiting}, runnable=${report.frontier.counts.runnable}, blocked=${report.frontier.counts.blocked}`,
  );
  lines.push(`- roots: ${formatList(report.frontier.roots)}`);
  lines.push(
    `- active tasks: ${formatList(sample(report.frontier.active, 6))}`,
  );
  lines.push(
    `- waiting tasks: ${formatList(sample(report.frontier.waiting, 6))}`,
  );
  lines.push("");
  lines.push("Movement:");
  lines.push(
    `- last journal=${report.movement.lastJournalAt ?? "none"}, planner=${report.movement.lastPlannerAt ?? "none"}, reviewer=${report.movement.lastReviewerAt ?? "none"}`,
  );
  lines.push(
    `- last ${report.movement.lookbackMinutes}m: planner runs=${report.movement.plannerRuns}, reviewer runs=${report.movement.reviewerRuns}, journal events=${Object.values(report.movement.journal).reduce((sum, count) => sum + count, 0)}`,
  );
  lines.push(
    `- last 24h: marked done=${report.movement.tasksMarkedDone24h}, worker completed=${report.movement.workerCompleted24h}`,
  );
  lines.push("");
  lines.push("Process graph:");
  if (report.processGraph.available) {
    lines.push(
      `- routes=${report.processGraph.routeCount}, consumed events=${report.processGraph.consumedEventCount}, emitted events=${report.processGraph.emittedEventCount}, external boundaries=${report.processGraph.externalEventCount}`,
    );
    lines.push(
      `- unhandled=${report.processGraph.unhandledEvents.length}, multi-route=${report.processGraph.multiRouteEvents.length}, action read errors=${report.processGraph.actionErrors.length}`,
    );
  } else {
    lines.push(`- unavailable: ${report.processGraph.reason ?? "unknown"}`);
  }
  lines.push("");
  lines.push("Loops:");
  for (const loop of report.loops) {
    lines.push(
      `- ${loop.taskId}: state=${loop.state}, completionReady=${String(loop.completionReady)}, pending=${loop.pending ?? "?"}, running=${loop.running ?? "?"}, done=${loop.done ?? "?"}, error=${loop.error ?? "?"}`,
    );
  }
  lines.push("");
  lines.push("Signals:");
  if (report.signals.length === 0) {
    lines.push("- none");
  } else {
    for (const signal of report.signals) {
      lines.push(`- ${signal.severity} ${signal.code}: ${signal.message}`);
    }
  }
  lines.push("");
  lines.push("Next actions:");
  for (const action of report.nextActions) lines.push(`- ${action}`);
  return lines.join("\n");
}

function usage(): never {
  console.error(`Usage:
  bun run health [--json] [--lookback-minutes N] [--stale-active-minutes N]

Environment:
  AKS_RP_E2E_APP_DIR=/app/projects/aks-rp-e2e.app
  PROJECT_DIR=/app/projects/aks-rp-e2e
  WORKER=aks-explorer
  MAX_CONCURRENT=5`);
  process.exit(2);
}

if (import.meta.main) {
  if (hasFlag("--help") || hasFlag("-h")) usage();
  const report = buildProjectHealth({
    lookbackMinutes: numberOption("--lookback-minutes", 30),
    staleActiveMinutes: numberOption("--stale-active-minutes", 30),
  });
  if (hasFlag("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatProjectHealth(report));
  }
}
