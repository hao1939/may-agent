import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import type { SubagentManager } from "../../lib/index.js";
import type { CronEntry } from "../../lib/cron-tool.js";
import type { EventEnvelope } from "../../lib/handler-context.js";
import { Check, Errors } from "typebox/value";
import { buildRuntimeCtx } from "../../lib/runtime-ctx.js";
import { importRuntimeModule } from "../../lib/runtime-import.js";
import { inspectWorkflowDefinition, runWorkflowDirect, WorkflowHandlerUnavailable } from "../../lib/workflow-tool.js";
import { getDb, updateSessionDb } from "../../lib/requests.js";
import { createQueryService } from "../../lib/query-service.js";
import { markSessionInactive, readSessionMeta, writeSessionMeta } from "../../lib/persistence.js";
import {
  admitProjectAppTaskHandlerResult,
  admitProjectAppTaskVerificationResult,
  loadProjectReadModel,
  matchesEventSelector,
  projectAppExecutionPaths,
  projectAppTaskOwnerResultSchema,
  projectRuntimePaths,
  readTaskState,
  refreshProjectTaskTreeProjection,
  type ProjectApp,
  type ProjectAppContext,
  type ProjectAppConditionSpec,
  type ProjectAppEvent as AppEvent,
  type ProjectAppEventTarget as EventTarget,
  type ProjectAppTaskAction,
  type ProjectAppTaskAcceptanceBasis,
  type ProjectAppTaskHandlerResult,
  type ProjectAppTaskIntent,
  type ProjectAppTaskVerifier,
  type ProjectAppExecutionPaths,
} from "@may-agent/sdk";
import { Cron } from "../cron.js";
import { ProjectAppTaskController } from "../project-app-task-controller.js";
import { trackProjectAppConditionEvent } from "../project-app-condition-tracker.js";
import {
  childEventTrace,
  EVENT_INGRESS_SOURCE,
  EVENT_ROW_ID,
  type AgentEvent,
  type DeliveryResult,
  type EventBus,
} from "../event-bus.js";
import {
  acknowledgeProjectAppTaskRecoveryAttention,
  claimObservedProjectAppTask,
  completeProjectAppTask,
  deferProjectAppTask,
  listHandlerUnavailableProjectAppTasks,
  markProjectAppTaskAttention,
  listProjectAppTaskIntents,
  listRunnableProjectAppTaskIds,
  isProjectAppTaskActionStaleError,
  observeProjectAppTaskIntent,
  pendingProjectAppTaskRecoveryAttention,
  readProjectAppTaskChildContext,
  readProjectAppTaskIntent,
  readProjectAppTaskTrigger,
  recordProjectAppTaskTrigger,
  releaseHandlerUnavailableProjectAppTask,
  repairPreviousRuntimeRecoveryAttention,
  repairRunningProjectAppTasksWithoutAttempt,
  recoverableProjectAppTaskAttempts,
  releaseInterruptedProjectAppTaskAttempt,
  releaseStaleProjectAppTaskResult,
  recordProjectAppTaskAttemptSession,
  recordProjectAppTaskAttemptWorkspace,
  taskReconciliationConfig,
  PROJECT_APP_TASK_RECOVERY_OWNER,
  type ProjectAppTaskChildContext,
  type ProjectAppTaskClaim,
} from "../project-app-task-reconciler.js";
import {
  finalizeProjectTaskWorkspace,
  prepareProjectTaskWorkspace,
  type PreparedTaskWorkspace,
} from "../project-task-workspace.js";

type ProjectReadModel = {
  id: string;
  path: string;
  name: string;
  owner: string;
  status: string;
  type: string;
  priority: string | null;
};

const PROJECT_APP_TASK_OWNER_TIMEOUT_MS = 15 * 60_000;

export interface ProjectAppDescriptor {
  id: string;
  appDir: string;
  projectDir: string;
  owner: string;
  app: ProjectApp;
  reconciliationPaused: boolean;
}

export interface ProjectAppLoaderOptions {
  projectsRoot: string;
  projectRoot: string;
  persistDir?: string;
  agentsRoot?: string;
  sharedRoot?: string;
  manager: SubagentManager;
  bus: EventBus;
  agentCrons: Map<string, Cron>;
  /**
   * Called when an app-local agent used by the app is not yet registered.
   * The app brings its own agents; this callback registers one from its
   * project-local agent.json. Returns true if registration succeeded.
   */
  registerLocalAgent?: (agentName: string, appDir: string, agentDir?: string) => Promise<boolean>;
}

export interface ProjectAppWatcher {
  close(): void;
  scanNow(): Promise<boolean>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function configuredAgentName(agentDir: string, fallback: string): string | null {
  const configPath = join(agentDir, "agent.json");
  if (!existsSync(configPath)) return fallback;
  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8")) as { name?: string; disabled?: boolean };
    if (config.disabled) return null;
    return typeof config.name === "string" && config.name.trim() ? config.name.trim() : fallback;
  } catch {
    return fallback;
  }
}

function localAgents(appDir: string): Array<{ dirName: string; name: string }> {
  const agentsRoot = join(appDir, "agents");
  if (!existsSync(agentsRoot)) return [];
  const agents: Array<{ dirName: string; name: string }> = [];
  for (const entry of readdirSync(agentsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
    const agentDir = join(agentsRoot, entry.name);
    if (!existsSync(join(agentDir, "agent.json"))) continue;
    const name = configuredAgentName(agentDir, entry.name);
    if (name) agents.push({ dirName: entry.name, name });
  }
  return agents;
}

function localAgentDir(appDir: string, agentName: string): string | undefined {
  const match = localAgents(appDir).find((agent) => agent.name === agentName);
  return match ? join(appDir, "agents", match.dirName) : undefined;
}

export function inferProjectAppOwner(appDir: string): string {
  const agents = localAgents(appDir);
  if (agents.length === 0) {
    throw new Error(`Project app ${appDir} has no local agents; cannot infer project owner`);
  }
  if (agents.length === 1) return agents[0]!.name;

  for (const conventional of ["owner", "project-owner"]) {
    const match = agents.find((agent) => agent.dirName === conventional);
    if (match) return match.name;
  }

  throw new Error(
    `Project app ${appDir} has multiple local agents (${agents.map((agent) => agent.dirName).join(", ")}) and no agents/owner or agents/project-owner directory`,
  );
}

export function listProjectAppDirs(projectsRoot: string): string[] {
  if (!existsSync(projectsRoot)) return [];
  const dirs: string[] = [];
  for (const entry of readdirSync(projectsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.endsWith(".app")) continue;
    const appDir = resolve(projectsRoot, entry.name);
    if (existsSync(join(appDir, "app.ts")) || existsSync(join(appDir, "app.js"))) {
      dirs.push(appDir);
    }
  }
  return dirs.sort();
}

function appIdFromDir(appDir: string): string {
  const name = basename(appDir);
  return name.endsWith(".app") ? name.slice(0, -".app".length) : name;
}

function configuredProjectAppOwner(app: ProjectApp, appDir: string): string {
  const owner = typeof app.owner === "string" ? app.owner.trim() : "";
  if (owner) return owner.replace(/^agent:/, "");
  return inferProjectAppOwner(appDir);
}

async function loadProjectApp(appDir: string): Promise<ProjectApp> {
  const tsPath = join(appDir, "app.ts");
  const jsPath = join(appDir, "app.js");
  const modulePath = existsSync(tsPath) ? tsPath : jsPath;
  const mod = await importRuntimeModule<{ default?: ProjectApp } & ProjectApp>(modulePath);
  return mod.default ?? mod;
}

function domainProjectDir(projectsRoot: string, appDir: string, appId: string, app: ProjectApp): string {
  const localPath = typeof app.workspace?.localPath === "string" ? app.workspace.localPath.trim() : "";
  if (localPath) return resolve(appDir, localPath);
  const sibling = resolve(projectsRoot, appId);
  return existsSync(sibling) ? sibling : appDir;
}

function readJsonObject(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function projectReadModel(projectRoot: string, descriptor: ProjectAppDescriptor): ProjectReadModel {
  const projectJson = loadProjectReadModel(descriptor.appDir);
  const id = typeof projectJson.id === "string" && projectJson.id.trim() ? projectJson.id.trim() : descriptor.id;
  const owner =
    typeof projectJson.owner === "string" && projectJson.owner.trim()
      ? projectJson.owner.trim().replace(/^agent:/, "")
      : descriptor.owner;
  const status =
    typeof projectJson.status === "string" && projectJson.status.trim() ? projectJson.status.trim() : "active";
  const type =
    typeof projectJson.type === "string" && projectJson.type.trim() ? projectJson.type.trim() : "project-app";
  const priority =
    typeof projectJson.priority === "string" && projectJson.priority.trim() ? projectJson.priority.trim() : null;
  const relativePath = relative(projectRoot, descriptor.appDir).replace(/\\/g, "/");
  return {
    id,
    path: relativePath && !relativePath.startsWith("..") ? relativePath : descriptor.appDir,
    name: id,
    owner,
    status,
    type,
    priority,
  };
}

function syncProjectReadModel(opts: ProjectAppLoaderOptions, descriptor: ProjectAppDescriptor): void {
  if (!opts.persistDir) return;
  const model = projectReadModel(opts.projectRoot, descriptor);
  const db = getDb(opts.persistDir);
  db.run(
    `INSERT INTO projects (id, path, name, owner, status, type, workflow, priority, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       path = excluded.path,
       name = excluded.name,
       owner = excluded.owner,
       status = excluded.status,
       type = excluded.type,
       workflow = excluded.workflow,
       priority = COALESCE(excluded.priority, projects.priority),
       updated_at = excluded.updated_at`,
    [model.id, model.path, model.name, model.owner, model.status, model.type, "", model.priority, Date.now()],
  );
}

const envelopeFieldNames = new Set([
  "type",
  "source",
  "owner",
  "timestamp",
  "visibility",
  "trace",
  "urgency",
  "ttlMs",
  "ttl_ms",
  "target",
  "action",
  "data",
]);

function normalizeEvent(event: AppEvent, defaults: { source: string; owner: string }): EventEnvelope {
  const type = typeof event.type === "string" ? event.type : "project.event";
  const source = typeof event.source === "string" ? event.source : defaults.source;
  const timestamp = typeof event.timestamp === "number" ? event.timestamp : Date.now();
  const urgency = typeof event.urgency === "string" ? event.urgency : undefined;
  const action = typeof event.action === "string" && event.action.trim() ? event.action.trim() : undefined;
  const ttlMs =
    typeof event.ttl_ms === "number" ? event.ttl_ms : typeof event.ttlMs === "number" ? event.ttlMs : undefined;
  const target = isRecord(event.target) ? (event.target as EventTarget) : undefined;
  const visibility = event.visibility === "detail" ? "detail" : event.visibility === "default" ? "default" : undefined;
  const trace = isRecord(event.trace) ? (event.trace as EventEnvelope["trace"]) : undefined;
  const flatPayload = Object.fromEntries(Object.entries(event).filter(([key]) => !envelopeFieldNames.has(key)));
  const data = {
    ...(isRecord(event.data) ? event.data : {}),
    ...flatPayload,
  };
  if (target?.project && typeof data.project !== "string") data.project = target.project;
  if (target?.taskId && typeof data.taskId !== "string") data.taskId = target.taskId;
  if (target?.taskId && typeof data.task_id !== "string") data.task_id = target.taskId;
  if (target && !isRecord(data.target)) data.target = target;
  const owner = inferEventOwner(event.owner, target, defaults.owner);
  return {
    type,
    source,
    owner,
    timestamp,
    ...(urgency ? { urgency: urgency as EventEnvelope["urgency"] } : {}),
    ...(action ? { action } : {}),
    ...(typeof ttlMs === "number" ? { ttl_ms: ttlMs } : {}),
    ...(target ? { target } : {}),
    ...(visibility ? { visibility } : {}),
    ...(trace ? { trace } : {}),
    data,
  };
}

function normalizeOwnerIdentity(owner: unknown, fallback: unknown = "may"): string {
  const value =
    typeof owner === "string" && owner.trim()
      ? owner.trim()
      : typeof fallback === "string" && fallback.trim()
        ? fallback.trim()
        : "may";
  if (
    value.startsWith("agent:") ||
    value.startsWith("human:") ||
    value.startsWith("project:") ||
    value.startsWith("task:")
  ) {
    return value;
  }
  if (value.toLowerCase() === "human") return "human:operator";
  return `agent:${value}`;
}

function ownerFromTarget(target: EventTarget | undefined): string | undefined {
  if (target?.human === true) return "human:operator";
  if (target?.project && typeof target.project === "string" && target.project.trim()) {
    return `project:${target.project.trim()}`;
  }
  return undefined;
}

function inferEventOwner(owner: unknown, target: EventTarget | undefined, fallback: unknown): string {
  if (typeof owner === "string" && owner.trim()) return normalizeOwnerIdentity(owner);
  return ownerFromTarget(target) ?? normalizeOwnerIdentity(fallback);
}

function requireWorkflowRuntimeOptions(opts: ProjectAppLoaderOptions): {
  persistDir: string;
  agentsRoot: string;
  sharedRoot: string;
} {
  if (!opts.persistDir || !opts.agentsRoot || !opts.sharedRoot) {
    throw new Error("Project app task workflows require persistDir, agentsRoot, and sharedRoot");
  }
  return {
    persistDir: opts.persistDir,
    agentsRoot: opts.agentsRoot,
    sharedRoot: opts.sharedRoot,
  };
}

function appWorkflowRuntimePaths(
  opts: ProjectAppLoaderOptions,
  descriptor: ProjectAppDescriptor,
  agentName: string,
): {
  agentsRoot: string;
  workflowDir: string;
  guardsDir: string;
  sharedGuardsDir: string;
} {
  const runtime = requireWorkflowRuntimeOptions(opts);
  const appAgentDir = localAgentDir(descriptor.appDir, agentName);
  const globalAgentDir = join(runtime.agentsRoot, agentName);
  const agentDir = appAgentDir ?? globalAgentDir;
  return {
    agentsRoot: appAgentDir ? join(descriptor.appDir, "agents") : runtime.agentsRoot,
    workflowDir: join(agentDir, "workflows"),
    guardsDir: join(agentDir, "guards"),
    sharedGuardsDir: join(runtime.sharedRoot, "guards"),
  };
}

function flattenEvent(event: AgentEvent): Record<string, unknown> {
  const record = event as unknown as Record<string, unknown>;
  const data = isRecord(record.data) ? record.data : {};
  const persistedEventId = (event as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID];
  return {
    ...data,
    ...record,
    data,
    ...(Number.isInteger(persistedEventId) && Number(persistedEventId) > 0
      ? { eventId: Number(persistedEventId) }
      : {}),
  };
}

function projectValue(event: Record<string, unknown>): string {
  const direct = event.project ?? event.projectId;
  if (typeof direct === "string") return direct;
  if (isRecord(event.target)) {
    const targetedProject = event.target.project;
    if (typeof targetedProject === "string") return targetedProject;
  }
  const path = event.projectPath;
  if (typeof path === "string") {
    const normalized = path.replace(/\\/g, "/");
    const tail = normalized.split("/").filter(Boolean).pop() ?? "";
    return tail.endsWith(".app") ? tail.slice(0, -".app".length) : tail;
  }
  return "";
}

function isProjectScopedForApp(event: Record<string, unknown>, appId: string): boolean {
  const project = projectValue(event);
  return project === appId || project === `${appId}.app`;
}

function ownerValue(event: Record<string, unknown>): string {
  const owner = typeof event.owner === "string" ? event.owner.trim() : "";
  return owner.startsWith("agent:") ? owner.slice("agent:".length) : owner;
}

function isMetricFeedbackEvent(event: Record<string, unknown>): boolean {
  return event.type === "metric.breach" || event.type === "metric.recovered" || event.type === "metric.stalled";
}

function metricEventId(event: Record<string, unknown>): string {
  const metricId = event.metricId ?? event.metric_id;
  return typeof metricId === "string" ? metricId : "";
}

function metricAlertId(event: Record<string, unknown>): number | string | null {
  const alertId = event.alertId ?? event.alert_id;
  return typeof alertId === "number" || typeof alertId === "string" ? alertId : null;
}

function shouldOfferToApp(app: ProjectApp, event: Record<string, unknown>): boolean {
  if ((app.events ?? []).some((selector) => matchesEventSelector(selector, event))) return true;
  if (app.tasks?.accepts.some((selector) => matchesEventSelector(selector, event))) return true;
  return false;
}

function makeContext(
  opts: ProjectAppLoaderOptions,
  descriptor: ProjectAppDescriptor,
  parentEvent?: AgentEvent,
): ProjectAppContext {
  return {
    appPath: (path: string) => resolve(descriptor.appDir, path),
    emit: (event) => {
      const envelope = normalizeEvent(event, {
        source: `project-app:${descriptor.id}`,
        owner: `agent:${descriptor.owner}`,
      });
      if (envelope.type === "project.owner.requested" && parentEvent?.type === "project.comment.created") {
        const inputEventId = Number((parentEvent as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID]);
        if (Number.isInteger(inputEventId) && inputEventId > 0) {
          if (envelope.data.inputEventId === undefined) envelope.data.inputEventId = inputEventId;
          if (envelope.data.inputEventType === undefined) envelope.data.inputEventType = parentEvent.type;
        }
      }
      if (!envelope.trace && parentEvent) {
        const trace = childEventTrace(parentEvent);
        if (trace) envelope.trace = trace;
      }
      return opts.bus.emit(envelope as unknown as AgentEvent) as unknown as AppEvent;
    },
    noop: (reason: string) => ({ type: "noop", reason }),
    ...(opts.persistDir ? { query: createQueryService({ getDb: () => getDb(opts.persistDir!) }) } : {}),
  };
}

function ensureOwnerCron(opts: ProjectAppLoaderOptions, descriptor: ProjectAppDescriptor): Cron {
  const existing = opts.agentCrons.get(descriptor.owner);
  if (existing) return existing;

  const stateDir = join(descriptor.appDir, ".state");
  mkdirSync(stateDir, { recursive: true });
  const cron = new Cron(
    join(stateDir, "project-app.cron.json"),
    opts.manager,
    () => {
      throw new Error(`No active ${descriptor.owner} session`);
    },
    (msg) => opts.bus.emit({ type: "info", message: `[cron:${descriptor.owner}] ${msg}` }),
    opts.projectRoot,
    undefined,
    (event) => opts.bus.emit(event as AgentEvent),
  );
  cron.load();
  // Do NOT subscribeToBus or start here — cron-startup.ts owns activation
  // for all crons (agent-level and app-level) in one centralized loop.
  opts.agentCrons.set(descriptor.owner, cron);
  return cron;
}

function requiredAppAgentNames(descriptor: ProjectAppDescriptor): string[] {
  return [descriptor.owner];
}

async function ensureAppAgentRegistered(
  opts: ProjectAppLoaderOptions,
  descriptor: ProjectAppDescriptor,
  agentName: string,
): Promise<boolean> {
  if (opts.manager.hasAgent(agentName)) return true;

  const agentDir = localAgentDir(descriptor.appDir, agentName);
  const registered = opts.registerLocalAgent
    ? await opts.registerLocalAgent(agentName, descriptor.appDir, agentDir)
    : false;

  return registered || opts.manager.hasAgent(agentName);
}

const projectAppScheduleSyntheticNamesByCron = new WeakMap<Cron, Map<string, Set<string>>>();

function rememberProjectAppNames(
  tracker: WeakMap<Cron, Map<string, Set<string>>>,
  cron: Cron,
  appId: string,
  currentNames: Set<string>,
): void {
  let byApp = tracker.get(cron);
  if (!byApp) {
    byApp = new Map();
    tracker.set(cron, byApp);
  }
  const previousNames = byApp.get(appId) ?? new Set<string>();
  for (const previousName of previousNames) {
    if (!currentNames.has(previousName)) {
      cron.removeSyntheticEntry(previousName);
    }
  }
  byApp.set(appId, currentNames);
}

function pruneProjectAppNames(
  tracker: WeakMap<Cron, Map<string, Set<string>>>,
  agentCrons: Map<string, Cron>,
  activeCronAppIds: Map<Cron, Set<string>>,
): void {
  for (const cron of agentCrons.values()) {
    const byApp = tracker.get(cron);
    if (!byApp) continue;
    const activeAppIds = activeCronAppIds.get(cron) ?? new Set<string>();
    for (const [appId, names] of byApp) {
      if (activeAppIds.has(appId)) continue;
      for (const name of names) {
        cron.removeSyntheticEntry(name);
      }
      byApp.delete(appId);
    }
  }
}

type TaskCapabilityRun = {
  handlerResult: NormalizedTaskHandlerResult;
  runId: string | null;
  verifier?: { name: string; sourcePath: string; verify: ProjectAppTaskVerifier };
  unavailable?: boolean;
};

type WorkflowCapability = {
  workflow: string;
  agent?: string;
  task: string;
};

type NormalizedTaskHandlerResult = {
  /** `error` is an attempt/runtime outcome, never a valid handler decision. */
  state: "converged" | "waiting" | "needs-owner" | "error";
  summary: string;
  evidence: string[];
  actions: ProjectAppTaskAction[];
  conditions?: ProjectAppConditionSpec[];
};

export function normalizeTaskHandlerResult(
  output: unknown,
  fallback: { type: "done" | "blocked"; summary: string; runId: string | null },
  options: {
    allowNeedsOwner?: boolean;
    defaultParentId?: string;
    rootParentAliases?: string[];
  } = {},
): NormalizedTaskHandlerResult {
  if (output === undefined && fallback.type === "blocked") {
    return {
      state: "error",
      summary: fallback.summary,
      evidence: fallback.runId ? [`workflow-run:${fallback.runId}`] : [],
      actions: [],
    };
  }
  const admission = admitProjectAppTaskHandlerResult(output, {
    allowNeedsOwner: options.allowNeedsOwner ?? true,
    defaultParentId: options.defaultParentId ?? "project",
    rootParentAliases: options.rootParentAliases,
  });
  if (!admission.ok) {
    return {
      state: "error",
      summary: `Handler result was rejected: ${admission.error}`,
      evidence: fallback.runId ? [`workflow-run:${fallback.runId}`] : [],
      actions: [],
    };
  }
  return {
    ...admission.result,
    actions: admission.result.actions ?? [],
  };
}

async function runTaskCapability(input: {
  opts: ProjectAppLoaderOptions;
  descriptor: ProjectAppDescriptor;
  capability: WorkflowCapability;
  intent: ProjectAppTaskIntent;
  claim: ProjectAppTaskClaim;
  defaultParentId: string;
  executionPaths: ProjectAppExecutionPaths;
  declaredOutputPaths: string[];
  childContext: ProjectAppTaskChildContext;
  event?: EventEnvelope;
  fallbackReason?: string;
}): Promise<TaskCapabilityRun> {
  const { opts, descriptor, capability, intent, claim, event } = input;
  const runtime = requireWorkflowRuntimeOptions(opts);
  const agentName = capability.agent ?? claim.owner;
  const trace = childEventTrace(event);
  const paths = appWorkflowRuntimePaths(opts, descriptor, agentName);
  const task = [
    capability.task,
    `app: ${descriptor.appDir}`,
    `project: ${descriptor.projectDir}`,
    "",
    "## Reconciliation Task",
    "```json",
    JSON.stringify(
      {
        appId: descriptor.id,
        taskId: claim.taskId,
        generation: claim.generation,
        resourceVersion: claim.resourceVersion,
        owner: claim.owner,
        handler: claim.handler,
        mode: claim.mode,
        outcome: intent.outcome,
        acceptance: intent.acceptance,
        input: intent.input ?? {},
        children: input.childContext,
        paths: input.executionPaths,
        declaredOutputs: input.declaredOutputPaths,
        fallbackReason: input.fallbackReason ?? null,
      },
      null,
      2,
    ),
    "```",
    ...(event ? ["", "## Trigger Event", "```json", JSON.stringify(event, null, 2), "```"] : []),
  ].join("\n");

  opts.bus.emit({
    type: "handler.workflow_dispatched",
    source: `agent:${agentName}`,
    owner: `agent:${claim.owner}`,
    target: { project: descriptor.id, taskId: claim.taskId },
    data: {
      handler: claim.handler,
      workflow: capability.workflow,
      source: agentName,
      projectId: descriptor.id,
      recoveryOwner: PROJECT_APP_TASK_RECOVERY_OWNER,
      taskId: claim.taskId,
      taskGeneration: claim.generation,
      workflowRunId: null,
      status: "started",
    },
    ...(trace ? { trace } : {}),
  } as AgentEvent);

  try {
    const runtimeCtx = buildRuntimeCtx({
      bus: opts.bus,
      persistDir: runtime.persistDir,
      projectRoot: opts.projectRoot,
      agentsRoot: paths.agentsRoot,
      sharedRoot: runtime.sharedRoot,
      projectsRoot: opts.projectsRoot,
      agentName,
    });
    const { result, runId, verifier } = await runWorkflowDirect({
      workflowName: capability.workflow,
      task,
      manager: opts.manager,
      runtimeCtx,
      agentName,
      persistDir: runtime.persistDir,
      workflowDir: paths.workflowDir,
      guardsDir: paths.guardsDir,
      sharedGuardsDir: paths.sharedGuardsDir,
      projectId: descriptor.id,
      taskBinding: {
        taskId: claim.taskId,
        generation: claim.generation,
      },
      trace,
      executionPaths: input.executionPaths,
    });
    const done = result.type === "done";
    const summary = done ? result.summary : result.reason;
    const handlerResult = normalizeTaskHandlerResult(
      done ? result.output : undefined,
      {
        type: done ? "done" : "blocked",
        summary,
        runId,
      },
      {
        allowNeedsOwner: true,
        defaultParentId: input.defaultParentId,
        rootParentAliases: [input.descriptor.id, basename(input.descriptor.projectDir)],
      },
    );
    opts.bus.emit({
      type: "handler.workflow_dispatched",
      source: `agent:${agentName}`,
      owner: `agent:${claim.owner}`,
      target: { project: descriptor.id, taskId: claim.taskId },
      data: {
        handler: claim.handler,
        workflow: capability.workflow,
        source: agentName,
        projectId: descriptor.id,
        taskId: claim.taskId,
        taskGeneration: claim.generation,
        workflowRunId: runId,
        status: done ? "done" : "blocked",
        disposition: handlerResult.state,
        ...(done ? { summary } : { reason: summary }),
      },
      ...(trace ? { trace } : {}),
    } as unknown as AgentEvent);
    return {
      handlerResult,
      runId,
      ...(verifier
        ? {
            verifier: {
              ...verifier,
              verify: verifier.verify as ProjectAppTaskVerifier,
            },
          }
        : {}),
    };
  } catch (error) {
    const summary = error instanceof Error ? error.message : String(error);
    const unavailable = error instanceof WorkflowHandlerUnavailable;
    opts.bus.emit({
      type: "handler.workflow_dispatched",
      source: `agent:${agentName}`,
      owner: `agent:${claim.owner}`,
      target: { project: descriptor.id, taskId: claim.taskId },
      data: {
        handler: claim.handler,
        workflow: capability.workflow,
        source: agentName,
        projectId: descriptor.id,
        taskId: claim.taskId,
        taskGeneration: claim.generation,
        workflowRunId: null,
        status: "blocked",
        reason: summary,
      },
      ...(trace ? { trace } : {}),
    } as unknown as AgentEvent);
    return {
      handlerResult: {
        state: "error",
        summary,
        evidence: [],
        actions: [],
      },
      runId: null,
      ...(unavailable ? { unavailable: true } : {}),
    };
  }
}

function interruptSupersededOwnerSession(
  opts: ProjectAppLoaderOptions,
  sessionId: string,
  reason: string,
): void {
  const cleanSessionId = sessionId.trim();
  if (!cleanSessionId) return;
  if (opts.manager.hasActiveSession(cleanSessionId)) {
    opts.manager.cancel(cleanSessionId);
    return;
  }

  const meta = opts.persistDir ? readSessionMeta(opts.persistDir, cleanSessionId) : null;
  if (!meta || (meta.status !== "running" && meta.status !== "idle")) return;
  const endedAt = Date.now();
  writeSessionMeta(opts.persistDir!, cleanSessionId, {
    ...meta,
    status: "interrupted",
    endedAt,
    error: reason,
  });
  updateSessionDb(opts.persistDir!, cleanSessionId, {
    status: "interrupted",
    endedAt,
    error: reason,
    outcome: reason,
    lastActivityAt: endedAt,
  });
  markSessionInactive(opts.persistDir!, cleanSessionId);
  opts.bus.emit({
    type: "session.end",
    source: meta.source ?? "project-app-task-reconciler",
    owner: `agent:${meta.agent}`,
    timestamp: endedAt,
    data: {
      sessionId: cleanSessionId,
      agent: meta.agent,
      outcome: "interrupted",
      summary: reason,
      error: reason,
      durationMs: Math.max(0, endedAt - meta.startedAt),
      status: "interrupted",
      task: meta.task,
      parentSessionId: meta.parentSessionId,
      workflowRunId: meta.workflowRunId,
      projectId: meta.projectId,
      kind: meta.kind,
      requestId: meta.requestId,
      stepLabel: meta.stepLabel,
    },
  } as AgentEvent);
}

async function runTaskOwner(input: {
  opts: ProjectAppLoaderOptions;
  descriptor: ProjectAppDescriptor;
  intent: ProjectAppTaskIntent;
  claim: ProjectAppTaskClaim;
  defaultParentId: string;
  executionPaths: ProjectAppExecutionPaths;
  declaredOutputPaths: string[];
  childContext: ProjectAppTaskChildContext;
  event?: EventEnvelope;
  fallbackReason?: string;
}): Promise<TaskCapabilityRun> {
  const { opts, descriptor, intent, claim, event } = input;
  const trace = childEventTrace(event);
  const prompt = [
    `You are the accountable owner for Agent App ${descriptor.id}.`,
    "Resolve the task from current evidence and, for achieve tasks, perform the bounded work required by the outcome and acceptance when your tools can do it. Do not edit task-tree storage directly.",
    "Return your decision through finish().result using state, summary, evidence, actions, and conditions.",
    "",
    "## Required final call shape",
    "Call finish() exactly once as your final action. The session status only says whether the agent turn succeeded; the task decision must be inside result.state.",
    "A completion without result leaves this task unresolved.",
    "Converged example:",
    "```json",
    JSON.stringify(
      {
        status: "success",
        summary: "Task converged with evidence.",
        result: {
          state: "converged",
          summary: "Task converged with evidence.",
          evidence: ["path/or/run/proof"],
          actions: [],
        },
      },
      null,
      2,
    ),
    "```",
    "Waiting example:",
    "```json",
    JSON.stringify(
      {
        status: "success",
        summary: "Waiting for an exact observable condition.",
        result: {
          state: "waiting",
          summary: "Waiting for an exact observable condition.",
          evidence: ["queued pipeline-run:123"],
          actions: [],
          conditions: [
            {
              id: "pipeline-run:123-completed",
              type: "pipeline.run.completed",
              subject: "pipeline-run:123",
              expected: { field: "state", equals: "completed" },
            },
          ],
        },
      },
      null,
      2,
    ),
    "```",
    'You are already the resolved owner; do not return state "needs-owner". Decide converged or waiting. Waiting requires exact Conditions or live direct children.',
    "Valid states for this owner result are exactly: converged or waiting.",
    'For mode "achieve", missing evidence is work to do, not by itself a reason to create another task. If the task asks to queue, run, publish, verify, inspect, or repair something, either do that concrete work now and report the evidence, or absorb the failed carrier through a converged result with exact failure evidence and a bounded successor/escalation action.',
    "Create a successor task only when this carrier cannot do the work because the target is stale, the task is too broad for one bounded attempt, or a real evidenced blocker requires different follow-up.",
    "Use waiting only when there is a real machine-observable wake event or live direct child work. Every authored Condition must be an object with id, type, subject, and expected.",
    'For a decomposition parent that creates child task actions and cannot yet satisfy its own acceptance, return state "waiting". Infrastructure tracks live direct children and wakes this parent when a child converges or needs attention; do not author task lifecycle Conditions or return "converged" merely because child tasks were declared.',
    'Conditions belong only to the current task when you return state "waiting". If you return state "converged" with a successor wait task action, put the wake facts in that task action input/acceptance and omit top-level conditions.',
    "Condition subjects must use typed forms the app can observe, for example task:<taskId>, session:<sessionId>, workflow-run:<runId>, pipeline-run:<runId>, metric:<metricId>, alert:<alertId>, or project:<projectId>.",
    "Do not put blocker prose, resumeCondition, requiredEvidence, allowedChangedFiles, or other human notes directly in conditions. Put that detail in summary/evidence, or create/update a concrete follow-up task.",
    "If no exact machine-observable Condition exists, do not return waiting. Return converged with exact evidence and supported successor/escalation actions when this carrier is finished; execution errors are reported by the runtime, not as a fourth task state.",
    "Use actions only for supported task-tree mutations.",
    "An executable parent relationship expresses decomposition and aggregate ownership. Infrastructure runs children independently and wakes the parent on meaningful child transitions; the parent still decides aggregate acceptance.",
    "Use dependsOn for execution ordering. Use a structural group when a node has no independently reconcilable outcome.",
    "Do not close an achieve task while it still contains live child tasks; finish or relocate the represented children first.",
    "",
    "Allowed actions:",
    '- create a task: { kind: "create-task", id, outcome, acceptance, parentId?, mode?, outputs?, priority?, owner?, workflow?, input?, dependsOn?, category? }',
    '  Defaults: parentId is the app root, mode is "achieve", outputs is [], and priority is "P2".',
    '- update a task: { kind: "update-task", taskId, expectedGeneration, parentId?, outcome?, mode?, outputs?, acceptance?, priority?, owner?, workflow?, input?, dependsOn?, category? }',
    "  Set owner, workflow, or category to null to clear that explicit binding.",
    '- close a task: { kind: "close-task", taskId, expectedGeneration, summary }',
    '- unblock a task: { kind: "unblock-task", taskId, expectedGeneration, reason }',
    'For ordinary owner-handled project/domain work, omit workflow. Do not use workflow: "project"; workflow may only name a real app-local workflow.',
    "Do not invent action names such as task.dispatch-existing-review, focus.update, noop, or task.batch-priority.",
    "Do not include an action for the current Reconciliation Task taskId; the controller closes or waits that carrier automatically from your state.",
    "If no task-tree mutation is needed, return actions: [] and put the explanation in summary/evidence.",
    "",
    "## Reconciliation Task",
    "```json",
    JSON.stringify(
      {
        appId: descriptor.id,
        taskId: claim.taskId,
        generation: claim.generation,
        resourceVersion: claim.resourceVersion,
        owner: claim.owner,
        mode: claim.mode,
        outcome: intent.outcome,
        acceptance: intent.acceptance,
        input: intent.input ?? {},
        children: input.childContext,
        paths: input.executionPaths,
        declaredOutputs: input.declaredOutputPaths,
        fallbackReason: input.fallbackReason ?? null,
      },
      null,
      2,
    ),
    "```",
    ...(event ? ["", "## Trigger Observation", "```json", JSON.stringify(event, null, 2), "```"] : []),
  ].join("\n");

  const ownerOptions = {
    source: "project-app-task-owner",
    projectId: descriptor.id,
    recoveryOwner: PROJECT_APP_TASK_RECOVERY_OWNER,
    trace,
    requireFinish: true,
    outputSchema: projectAppTaskOwnerResultSchema,
    toolPolicy: "full" as const,
    timeout: PROJECT_APP_TASK_OWNER_TIMEOUT_MS,
  };
  const result =
    typeof opts.manager.run === "function" &&
    typeof opts.manager.waitFor === "function" &&
    typeof opts.manager.progress === "function"
      ? await (async () => {
          const sessionId = opts.manager.run(claim.owner, prompt, {
            source: ownerOptions.source,
            kind: "call",
            projectId: ownerOptions.projectId,
            recoveryOwner: ownerOptions.recoveryOwner,
            trace: ownerOptions.trace,
            requireFinish: ownerOptions.requireFinish,
            outputSchema: ownerOptions.outputSchema,
            toolPolicy: ownerOptions.toolPolicy,
            timeoutMs: ownerOptions.timeout,
          });
          recordProjectAppTaskAttemptSession(taskReconciliationConfig({
            appDir: descriptor.appDir,
            projectDir: descriptor.projectDir,
            owner: descriptor.owner,
            maxConcurrent: descriptor.app.budget?.maxConcurrent ?? 1,
          }), claim, sessionId);
          const waited = await opts.manager.waitFor(sessionId);
          return {
            ...waited,
            messages: opts.manager.progress(sessionId, 1000),
          };
        })()
      : await opts.manager.callAgent(claim.owner, prompt, ownerOptions);
  const done = result.status === "done";
  const handlerResult = normalizeTaskHandlerResult(
    done ? result.structuredResult : undefined,
    {
      type: done ? "done" : "blocked",
      summary:
        firstNonEmptyString(result.finishResult?.summary, result.lastAssistantText, result.error) ??
        `Owner session ${result.sessionId || "unknown"} returned no result`,
      runId: result.sessionId || null,
    },
    {
      allowNeedsOwner: false,
      defaultParentId: input.defaultParentId,
      rootParentAliases: [input.descriptor.id, basename(input.descriptor.projectDir)],
    },
  );
  return { handlerResult, runId: result.sessionId || null };
}

function emitTaskReconciliationEvent(
  opts: ProjectAppLoaderOptions,
  descriptor: ProjectAppDescriptor,
  event: EventEnvelope | undefined,
  type: string,
  taskId: string,
  data: Record<string, unknown>,
): void {
  const persistedEventId = Number((event as Record<string, unknown> | undefined)?.eventId);
  const trace =
    Number.isInteger(persistedEventId) && persistedEventId > 0
      ? {
          traceId:
            event?.trace && typeof event.trace === "object" && typeof event.trace.traceId === "string"
              ? event.trace.traceId
              : `event:${persistedEventId}`,
          parentEventId: persistedEventId,
        }
      : childEventTrace(event);
  opts.bus.emit({
    type,
    source: `project-app:${descriptor.id}:task-reconciler`,
    owner: `agent:${descriptor.owner}`,
    target: { project: descriptor.id, taskId },
    data: { project: descriptor.id, taskId, ...data },
    ...(trace ? { trace } : {}),
  } as unknown as AgentEvent);
}

function emitOwnerResultForTask(
  opts: ProjectAppLoaderOptions,
  descriptor: ProjectAppDescriptor,
  trigger: EventEnvelope | undefined,
  taskId: string,
  summary: string,
  disposition: string,
): void {
  if (trigger?.type !== "project.owner.requested" && trigger?.type !== "project.comment.created") return;
  const triggerRecord = trigger as unknown as Record<string, unknown>;
  for (const intent of ownerIntentRefs(triggerRecord)) {
    if (opts.persistDir) {
      const existing = getDb(opts.persistDir)
        .prepare(
          `SELECT id
           FROM events
           WHERE event_type = 'project.owner.reviewed'
             AND json_extract(data, '$.openEventId') = ?
           LIMIT 1`,
        )
        .get(intent.eventId) as { id?: unknown } | undefined;
      if (Number(existing?.id) > 0) continue;
    }
    opts.bus.emit({
      type: "project.owner.reviewed",
      source: `project-app:${descriptor.id}:task-reconciler`,
      owner: `agent:${descriptor.owner}`,
      target: { project: descriptor.id, taskId },
      data: {
        openEventId: intent.eventId,
        openEventType: intent.eventType,
        project: descriptor.id,
        projectId: descriptor.id,
        disposition: "task-updated",
        taskDisposition: disposition,
        summary,
        taskRefs: [{ projectId: descriptor.id, taskId }],
      },
      trace: {
        traceId:
          trigger.trace && typeof trigger.trace === "object" && typeof trigger.trace.traceId === "string"
            ? trigger.trace.traceId
            : `event:${intent.eventId}`,
        parentEventId: Number(triggerRecord.eventId) || intent.eventId,
        links: [{ eventId: intent.eventId, type: "closure", label: "project.owner.reviewed" }],
      },
    } as unknown as AgentEvent);
  }
}

type OwnerIntentRef = {
  eventId: number;
  eventType: string;
  data?: Record<string, unknown>;
};

function isOwnerIntentType(value: unknown): value is "project.owner.requested" | "project.comment.created" {
  return value === "project.owner.requested" || value === "project.comment.created";
}

function ownerIntentRefs(event: Record<string, unknown>): OwnerIntentRef[] {
  const declared = Array.isArray(event.ownerIntentRefs) ? event.ownerIntentRefs : [];
  const refs: OwnerIntentRef[] = declared.flatMap((value) => {
    if (!isRecord(value)) return [];
    const eventId = Number(value.eventId);
    return Number.isInteger(eventId) && eventId > 0 && isOwnerIntentType(value.eventType)
      ? [{ eventId, eventType: value.eventType, ...(isRecord(value.data) ? { data: value.data } : {}) }]
      : [];
  });
  const inputEventId = Number(event.inputEventId);
  if (Number.isInteger(inputEventId) && inputEventId > 0) {
    const inputEventType = typeof event.inputEventType === "string" ? event.inputEventType : "project.comment.created";
    if (!isOwnerIntentType(inputEventType)) return [...new Map(refs.map((ref) => [ref.eventId, ref])).values()];
    refs.push({
      eventId: inputEventId,
      eventType: inputEventType,
      ...(isRecord(event.data) ? { data: event.data } : {}),
    });
  } else {
    const eventId = Number(event.eventId);
    if (Number.isInteger(eventId) && eventId > 0 && isOwnerIntentType(event.type)) {
      refs.push({ eventId, eventType: event.type, ...(isRecord(event.data) ? { data: event.data } : {}) });
    }
  }
  return [...new Map(refs.map((ref) => [ref.eventId, ref])).values()];
}

function taskTriggerWithOwnerIntents(
  config: ReturnType<typeof taskReconciliationConfig>,
  taskId: string,
  event: Record<string, unknown>,
): Record<string, unknown> {
  const previous = readProjectAppTaskTrigger(config, taskId);
  const isOwnerIntent = isOwnerIntentType(event.type);
  const previousIsOwnerIntent = isOwnerIntentType(previous?.type);
  if (!isOwnerIntent) return previousIsOwnerIntent ? previous : event;
  const refs = [...(previous ? ownerIntentRefs(previous) : []), ...ownerIntentRefs(event)];
  return {
    ...event,
    ownerIntentRefs: [...new Map(refs.map((ref) => [ref.eventId, ref])).values()],
  };
}

function recoverStaleTaskResult(
  config: ReturnType<typeof taskReconciliationConfig>,
  claim: ProjectAppTaskClaim,
): { staleRecovery: "released" | "superseded" | "missing"; reconcileTaskIds: string[] } {
  const recovery = releaseStaleProjectAppTaskResult(
    config,
    claim,
    `Stale reconciliation result for ${claim.taskId} was rejected; retrying from current task evidence`,
  );
  return {
    staleRecovery: recovery.status,
    reconcileTaskIds: recovery.status === "missing" ? [] : [claim.taskId],
  };
}

function recoverStaleTaskActionResult(
  config: ReturnType<typeof taskReconciliationConfig>,
  claim: ProjectAppTaskClaim,
  error: unknown,
): { staleRecovery: "released" | "superseded" | "missing"; reconcileTaskIds: string[] } | null {
  if (!isProjectAppTaskActionStaleError(error)) return null;
  const recovery = releaseStaleProjectAppTaskResult(
    config,
    claim,
    `Stale handler action for ${error.taskId} was rejected; retrying ${claim.taskId} from current task evidence`,
  );
  return {
    staleRecovery: recovery.status,
    reconcileTaskIds: recovery.status === "missing" ? [] : [claim.taskId],
  };
}

async function establishTaskAcceptance(input: {
  descriptor: ProjectAppDescriptor;
  intent: ProjectAppTaskIntent;
  claim: ProjectAppTaskClaim;
  capability: TaskCapabilityRun;
  executionPaths: ProjectAppExecutionPaths;
}): Promise<
  { ok: true; acceptanceBasis: ProjectAppTaskAcceptanceBasis } | { ok: false; summary: string; evidence: string[] }
> {
  const { descriptor, intent, claim, capability } = input;
  const workflow = claim.handler.startsWith("workflow:");
  if (!workflow) {
    return {
      ok: true,
      acceptanceBasis: {
        method: "owner-judgment",
        evidence: [...capability.handlerResult.evidence],
      },
    };
  }
  if (!capability.verifier) {
    return {
      ok: true,
      acceptanceBasis: {
        method: "workflow-contract",
        evidence: [
          ...capability.handlerResult.evidence,
          ...(capability.runId ? [`workflow-run:${capability.runId}`] : []),
        ],
      },
    };
  }

  try {
    const raw = await capability.verifier.verify(
      {
        appId: descriptor.id,
        taskId: claim.taskId,
        generation: claim.generation,
        appDir: descriptor.appDir,
        projectDir: descriptor.projectDir,
        workspaceDir: input.executionPaths.workspaceDir,
        intent: structuredClone(intent),
      },
      capability.handlerResult as ProjectAppTaskHandlerResult,
    );
    const admitted = admitProjectAppTaskVerificationResult(raw);
    if (!admitted.ok) {
      return {
        ok: false,
        summary: `Verifier ${capability.verifier.name} returned an invalid result: ${admitted.error}`,
        evidence: capability.runId ? [`workflow-run:${capability.runId}`] : [],
      };
    }
    if (!admitted.result.accepted) {
      return {
        ok: false,
        summary: admitted.result.summary,
        evidence: admitted.result.evidence,
      };
    }
    return {
      ok: true,
      acceptanceBasis: {
        method: "deterministic",
        verifier: capability.verifier.name,
        evidence: admitted.result.evidence,
      },
    };
  } catch (error) {
    return {
      ok: false,
      summary: `Verifier ${capability.verifier.name} failed: ${error instanceof Error ? error.message : String(error)}`,
      evidence: capability.runId ? [`workflow-run:${capability.runId}`] : [],
    };
  }
}

async function reconcileTask(input: {
  opts: ProjectAppLoaderOptions;
  descriptor: ProjectAppDescriptor;
  taskId: string;
  reason?: string;
}): Promise<string[]> {
  const { opts, descriptor } = input;

  const config = taskReconciliationConfig({
    appDir: descriptor.appDir,
    projectDir: descriptor.projectDir,
    owner: descriptor.owner,
    maxConcurrent: descriptor.app.budget?.maxConcurrent ?? 1,
  });
  const defaultParentId = readTaskState(config).root_task_id;
  if (!defaultParentId) {
    throw new Error(`Project app ${descriptor.id} has no root task group for convention defaults`);
  }
  const primary = claimObservedProjectAppTask(config, {
    taskId: input.taskId,
    appOwner: descriptor.owner,
    handler: "auto",
    reason: input.reason ?? "task-controller",
    isOwnerRunnable: (owner) => opts.manager.hasAgent(owner),
  });
  if (primary.kind !== "claimed") {
    const skip =
      primary.kind === "busy"
        ? { reason: "attempt-active", attemptId: primary.attemptId }
        : primary.kind === "waiting"
          ? primary.dependencyIds?.length
            ? { reason: "dependencies-open", dependencyIds: primary.dependencyIds }
            : primary.childIds?.length
              ? { reason: "children-open", childIds: primary.childIds }
              : { reason: "conditions-open", conditionIds: primary.conditionIds }
          : primary.kind === "attention"
            ? { reason: "attention-required", generation: primary.generation, summary: primary.summary }
            : { reason: "already-completed", generation: primary.generation };
    emitTaskReconciliationEvent(opts, descriptor, undefined, "project.task.reconcile.skipped", input.taskId, {
      route: "task-controller",
      ...skip,
    });
    return [];
  }
  for (const sessionId of primary.supersededSessionIds ?? []) {
    interruptSupersededOwnerSession(
      opts,
      sessionId,
      `Task ${primary.taskId} superseded an orphaned owner session while recovering the current generation`,
    );
  }
  const intent = primary.intent;
  const event = primary.trigger as EventEnvelope | undefined;
  const childContext = readProjectAppTaskChildContext(config, primary.taskId);
  let executionPaths = projectAppExecutionPaths(descriptor.appDir, descriptor.projectDir);
  const declaredOutputPaths = primary.declaredOutputPaths;
  emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconcile.started", intent.id, {
    route: "task-controller",
    generation: primary.generation,
    attemptId: primary.attemptId,
    handler: primary.handler,
    owner: primary.owner,
  });

  const workflowKey = primary.handler.startsWith("workflow:") ? primary.handler.slice("workflow:".length) : "";
  let taskWorkspace: PreparedTaskWorkspace | undefined;
  let workspaceFinalized = false;
  const finalizeWorkspace = (outcome: "accepted" | "waiting" | "failed") => {
    if (!taskWorkspace || workspaceFinalized) return { ok: true as const };
    try {
      const finalized = finalizeProjectTaskWorkspace(taskWorkspace, outcome);
      workspaceFinalized = true;
      recordProjectAppTaskAttemptWorkspace(config, primary, finalized.metadata);
      return finalized;
    } catch (error) {
      workspaceFinalized = true;
      taskWorkspace.metadata.disposition = "retained-for-recovery";
      recordProjectAppTaskAttemptWorkspace(config, primary, taskWorkspace.metadata);
      return {
        ok: false as const,
        metadata: taskWorkspace.metadata,
        reason: `Task workspace finalization failed and was retained for recovery: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  };
  let primaryResult: TaskCapabilityRun | undefined;
  if (workflowKey) {
    const workflowPaths = appWorkflowRuntimePaths(opts, descriptor, primary.owner);
    const definition = await inspectWorkflowDefinition(workflowPaths.workflowDir, workflowKey);
    if (
      definition.workspace === "task" ||
      (typeof definition.workspace === "object" && definition.workspace.kind === "task")
    ) {
      try {
        if (descriptor.app.workspace?.kind !== "git") {
          throw new Error(`Workflow ${workflowKey} requires a task worktree but app workspace is not Git`);
        }
        const previous = Object.values(readTaskState(config).attempts ?? {})
          .filter(
            (attempt) =>
              attempt.taskId === primary.taskId &&
              attempt.taskGeneration === primary.generation &&
              attempt.workspace?.kind === "task-worktree",
          )
          .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0]?.workspace;
        taskWorkspace = prepareProjectTaskWorkspace({
          repoDir: descriptor.projectDir,
          workspaceRoot: join(opts.projectRoot, "worktrees", descriptor.id),
          taskId: primary.taskId,
          generation: primary.generation,
          baseBranch:
            typeof definition.workspace === "object"
              ? definition.workspace.baseBranch
              : (descriptor.app.workspace.branch ?? "dev"),
          previous,
        });
        executionPaths = { ...executionPaths, workspaceDir: taskWorkspace.metadata.path };
        if (!recordProjectAppTaskAttemptWorkspace(config, primary, taskWorkspace.metadata)) {
          throw new Error(`Task attempt ${primary.attemptId} became stale while preparing its workspace`);
        }
      } catch (error) {
        primaryResult = {
          handlerResult: {
            state: "error",
            summary: `Task workspace preparation failed: ${error instanceof Error ? error.message : String(error)}`,
            evidence: [],
            actions: [],
          },
          runId: null,
        };
      }
    }
    primaryResult ??= await runTaskCapability({
      opts,
      descriptor,
      capability: {
        workflow: workflowKey,
        agent: primary.owner,
        task: `Reconcile task through workflow ${workflowKey}`,
      },
      intent,
      claim: primary,
      defaultParentId,
      executionPaths,
      declaredOutputPaths,
      childContext,
      event,
    });
  } else {
    primaryResult = await runTaskOwner({
      opts,
      descriptor,
      intent,
      claim: primary,
      defaultParentId,
      executionPaths,
      declaredOutputPaths,
      childContext,
      event,
      ...(primary.handoff
        ? {
            fallbackReason: `${primary.handoff.reason}: ${primary.handoff.summary}${
              primary.handoff.evidence.length
                ? `\nHandoff evidence:\n${primary.handoff.evidence.map((entry) => `- ${entry}`).join("\n")}`
                : ""
            }`,
          }
        : {}),
    });
  }

  if (!primaryResult) throw new Error(`Task ${primary.taskId} produced no handler result`);

  const primaryHandlerResult = primaryResult.handlerResult;
  if (primaryResult.unavailable) {
    emitTaskReconciliationEvent(opts, descriptor, event, "project.task.handler.unavailable", intent.id, {
      generation: primary.generation,
      handler: primary.handler,
      condition: "HandlerUnavailable",
      reason: primaryHandlerResult.summary,
    });
  }
  if (primaryHandlerResult.state === "converged") {
    const accepted = await establishTaskAcceptance({
      descriptor,
      intent,
      claim: primary,
      capability: primaryResult,
      executionPaths,
    });
    const acceptanceBasis = accepted.ok ? accepted.acceptanceBasis : undefined;
    if (!accepted.ok) {
      primaryHandlerResult.state = "error";
      primaryHandlerResult.summary = accepted.summary;
      primaryHandlerResult.evidence = accepted.evidence;
      emitTaskReconciliationEvent(opts, descriptor, event, "project.task.verification.failed", intent.id, {
        generation: primary.generation,
        attemptId: primary.attemptId,
        handler: primary.handler,
        summary: accepted.summary,
        evidence: accepted.evidence,
        workflowRunId: primaryResult.runId,
      });
    } else {
      const finalized = finalizeWorkspace("accepted");
      if (!finalized.ok) {
        primaryHandlerResult.state = "error";
        primaryHandlerResult.summary = finalized.reason ?? "Task workspace finalization failed";
        primaryHandlerResult.evidence = [taskWorkspace?.metadata.path ?? executionPaths.workspaceDir];
      }
    }
    if (primaryHandlerResult.state === "converged" && acceptanceBasis) {
      try {
        const apply = completeProjectAppTask(config, primary, {
          summary: primaryHandlerResult.summary,
          evidence: primaryHandlerResult.evidence,
          actions: primaryHandlerResult.actions,
          acceptanceBasis,
        });
        const stale = apply.status === "stale" ? recoverStaleTaskResult(config, primary) : null;
        emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
          generation: primary.generation,
          attemptId: primary.attemptId,
          handler: primary.handler,
          disposition: apply.status === "applied" ? "converged" : "stale",
          outcome: intent.outcome,
          mode: intent.mode,
          owner: intent.owner ?? descriptor.owner,
          ...(intent.workflow ? { workflow: intent.workflow } : {}),
          acceptance: intent.acceptance,
          input: intent.input ?? {},
          summary: primaryHandlerResult.summary,
          evidence: primaryHandlerResult.evidence,
          acceptanceBasis,
          actionsApplied: apply.actionsApplied,
          ...(stale ? { staleRecovery: stale.staleRecovery } : {}),
          workflowRunId: primaryResult.runId,
        });
        emitOwnerResultForTask(
          opts,
          descriptor,
          event,
          intent.id,
          primaryHandlerResult.summary,
          apply.status === "applied" ? "converged" : "stale",
        );
        return stale?.reconcileTaskIds ?? apply.dependentTaskIds;
      } catch (error) {
        const stale = recoverStaleTaskActionResult(config, primary, error);
        if (stale) {
          const summary = error instanceof Error ? error.message : String(error);
          emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
            generation: primary.generation,
            attemptId: primary.attemptId,
            handler: primary.handler,
            disposition: "stale",
            outcome: intent.outcome,
            mode: intent.mode,
            owner: intent.owner ?? descriptor.owner,
            ...(intent.workflow ? { workflow: intent.workflow } : {}),
            input: intent.input ?? {},
            summary,
            evidence: primaryHandlerResult.evidence,
            staleRecovery: stale.staleRecovery,
            workflowRunId: primaryResult.runId,
          });
          emitOwnerResultForTask(opts, descriptor, event, intent.id, summary, "stale");
          return stale.reconcileTaskIds;
        }
        primaryHandlerResult.state = "error";
        primaryHandlerResult.summary = `Handler actions were rejected: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
  }

  if (primaryHandlerResult.state === "waiting") {
    const finalized = finalizeWorkspace("waiting");
    if (!finalized.ok) {
      primaryHandlerResult.state = "error";
      primaryHandlerResult.summary = finalized.reason ?? "Task workspace finalization failed";
      primaryHandlerResult.evidence = [taskWorkspace?.metadata.path ?? executionPaths.workspaceDir];
    }
  }

  if (primaryHandlerResult.state === "waiting") {
    try {
      const apply = deferProjectAppTask(config, primary, {
        disposition: primaryHandlerResult.state,
        summary: primaryHandlerResult.summary,
        evidence: primaryHandlerResult.evidence,
        actions: primaryHandlerResult.actions,
        conditions: primaryHandlerResult.conditions,
      });
      const stale = apply.status === "stale" ? recoverStaleTaskResult(config, primary) : null;
      emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
        generation: primary.generation,
        attemptId: primary.attemptId,
        handler: primary.handler,
        disposition: apply.status === "applied" ? primaryHandlerResult.state : "stale",
        input: intent.input ?? {},
        summary: primaryHandlerResult.summary,
        evidence: primaryHandlerResult.evidence,
        actionsApplied: apply.actionsApplied,
        ...(stale ? { staleRecovery: stale.staleRecovery } : {}),
        workflowRunId: primaryResult.runId,
      });
      emitOwnerResultForTask(
        opts,
        descriptor,
        event,
        intent.id,
        primaryHandlerResult.summary,
        apply.status === "applied" ? primaryHandlerResult.state : "stale",
      );
      return stale?.reconcileTaskIds ?? apply.reconcileTaskIds;
    } catch (error) {
      const stale = recoverStaleTaskActionResult(config, primary, error);
      if (stale) {
        const summary = error instanceof Error ? error.message : String(error);
        emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
          generation: primary.generation,
          attemptId: primary.attemptId,
          handler: primary.handler,
          disposition: "stale",
          input: intent.input ?? {},
          summary,
          evidence: primaryHandlerResult.evidence,
          staleRecovery: stale.staleRecovery,
          workflowRunId: primaryResult.runId,
        });
        emitOwnerResultForTask(opts, descriptor, event, intent.id, summary, "stale");
        return stale.reconcileTaskIds;
      }
      primaryHandlerResult.state = "error";
      primaryHandlerResult.summary = `Handler result was rejected: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  finalizeWorkspace("failed");

  const ownerHandoff = Boolean(workflowKey && primaryHandlerResult.state === "needs-owner");
  const attention = markProjectAppTaskAttention(config, primary, {
    summary: primaryHandlerResult.summary,
    evidence: primaryHandlerResult.evidence,
    reason: primaryResult.unavailable
      ? "HandlerUnavailable"
      : primaryHandlerResult.state === "needs-owner"
        ? "needs-owner"
        : "handler-blocked",
    wakeParent: !ownerHandoff,
  });
  if (!ownerHandoff) {
    emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
      generation: primary.generation,
      attemptId: primary.attemptId,
      handler: primary.handler,
      disposition: "attention",
      input: intent.input ?? {},
      summary: primaryHandlerResult.summary,
    });
    emitOwnerResultForTask(opts, descriptor, event, intent.id, primaryHandlerResult.summary, "attention");
    return attention.status === "applied" && attention.parentTaskId ? [attention.parentTaskId] : [];
  }
  emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
    generation: primary.generation,
    attemptId: primary.attemptId,
    handler: primary.handler,
    disposition: "owner-handoff",
    input: intent.input ?? {},
    summary: primaryHandlerResult.summary,
  });
  return [intent.id];
}

function installSchedules(opts: ProjectAppLoaderOptions, cron: Cron, descriptor: ProjectAppDescriptor): number {
  let count = 0;
  const currentNames = new Set<string>();
  for (const schedule of descriptor.app.schedules ?? []) {
    const entryName = `${descriptor.id}-schedule-${schedule.id}`;
    currentNames.add(entryName);
    const entry: CronEntry = {
      name: entryName,
      enabled: schedule.enabled !== false,
      intervalMs: schedule.intervalMs,
      description: `Project app schedule ${descriptor.id}/${schedule.id}`,
      agent: descriptor.owner,
      handler: "__project_app_schedule__",
    };
    cron.registerHandler(entryName, async () => {
      for (const event of schedule.emits) {
        const envelope = normalizeEvent(event, {
          source: `project-app:${descriptor.id}:schedule:${schedule.id}`,
          owner: `agent:${descriptor.owner}`,
        });
        opts.bus.emit(envelope as unknown as AgentEvent);
      }
    });
    cron.addSyntheticEntry(entry);
    count++;
  }
  rememberProjectAppNames(projectAppScheduleSyntheticNamesByCron, cron, descriptor.id, currentNames);
  return count;
}

const appRouterDescriptorsByBus = new WeakMap<EventBus, ProjectAppDescriptor[]>();

export type ProjectAppActionDescription = {
  id: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

function loadedProjectAppDescriptor(bus: EventBus, projectId: string): ProjectAppDescriptor | undefined {
  const normalized = projectId.trim().replace(/\.app$/, "");
  return (appRouterDescriptorsByBus.get(bus) ?? []).find((descriptor) => descriptor.id === normalized);
}

export function describeLoadedProjectAppActions(bus: EventBus, projectId: string): ProjectAppActionDescription[] {
  const descriptor = loadedProjectAppDescriptor(bus, projectId);
  if (!descriptor) throw new Error(`Project app ${projectId} is not loaded`);
  return Object.entries(descriptor.app.actions ?? {}).map(([id, action]) => ({
    id,
    description: action.description,
    inputSchema: structuredClone(action.inputSchema) as Record<string, unknown>,
  }));
}

export function invokeLoadedProjectAppAction(input: {
  bus: EventBus;
  projectId: string;
  actionId: string;
  params: unknown;
  idempotencyKey?: string;
  ingressSource?: string;
}): { eventId: number; eventType: string } {
  const descriptor = loadedProjectAppDescriptor(input.bus, input.projectId);
  if (!descriptor) throw new Error(`Project app ${input.projectId} is not loaded`);
  const action = descriptor.app.actions?.[input.actionId];
  if (!action) throw new Error(`Project app ${descriptor.id} has no action ${input.actionId}`);
  if (!Check(action.inputSchema, input.params)) {
    const first = [...Errors(action.inputSchema, input.params)][0];
    throw new Error(`Invalid input for ${descriptor.id}.${input.actionId}: ${first?.message ?? "schema mismatch"}`);
  }
  const semantic = normalizeEvent(action.event(input.params), {
    source: `project-app:${descriptor.id}:action:${input.actionId}`,
    owner: `agent:${descriptor.owner}`,
  }) as AgentEvent;
  const semanticRecord = semantic as unknown as Record<string, unknown>;
  const data = isRecord(semanticRecord.data) ? semanticRecord.data : {};
  semanticRecord.data = {
    ...data,
    project: projectValue(flattenEvent(semantic)) || descriptor.id,
    ...(input.idempotencyKey?.trim() ? { idempotencyKey: input.idempotencyKey.trim() } : {}),
  };
  if (input.ingressSource) {
    Object.defineProperty(semanticRecord, EVENT_INGRESS_SOURCE, {
      value: input.ingressSource,
      configurable: true,
    });
  }
  const emitted = input.bus.emit(semantic);
  const eventId = Number(emitted[EVENT_ROW_ID]);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    throw new Error(`Action ${descriptor.id}.${input.actionId} did not produce a persisted semantic event`);
  }
  return { eventId, eventType: semantic.type };
}
const appTaskControllersByBus = new WeakMap<EventBus, Map<string, ProjectAppTaskController>>();

function taskIdFromEvent(event: Record<string, unknown>): string {
  const direct = event.taskId ?? event.task_id;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const target = isRecord(event.target) ? event.target : {};
  return typeof target.taskId === "string" ? target.taskId.trim() : "";
}

function isTaskWakeEvent(event: Record<string, unknown>): boolean {
  const type = typeof event.type === "string" ? event.type : "";
  return ![
    "handler.workflow_dispatched",
    "project.task.handler.recovered",
    "project.task.handler.unavailable",
    "project.task.reconcile.started",
    "project.task.reconcile.skipped",
    "project.task.reconciled",
    "project.task.verification.failed",
  ].includes(type);
}

function projectAppTaskDelivery(descriptor: ProjectAppDescriptor, taskId: string, note: string): DeliveryResult {
  return {
    accepted: true,
    by: `project-app:${descriptor.id}:task-reconciler`,
    route: "direct",
    note: `${note}: ${taskId}`,
  };
}

function installConventionTaskControllers(
  opts: ProjectAppLoaderOptions,
  descriptors: ProjectAppDescriptor[],
): Map<string, ProjectAppTaskController> {
  const previousControllers = appTaskControllersByBus.get(opts.bus);
  const startAfterByApp = new Map<string, Promise<void>>();
  for (const [appId, controller] of previousControllers ?? []) {
    controller.close();
    startAfterByApp.set(appId, controller.whenDrained());
  }
  const controllers = new Map<string, ProjectAppTaskController>();

  for (const descriptor of descriptors) {
    const tasks = descriptor.app.tasks;
    if (!tasks || descriptor.reconciliationPaused) continue;
    const config = taskReconciliationConfig({
      appDir: descriptor.appDir,
      projectDir: descriptor.projectDir,
      owner: descriptor.owner,
      maxConcurrent: descriptor.app.budget?.maxConcurrent ?? 1,
    });
    try {
      refreshProjectTaskTreeProjection(config);
    } catch (error) {
      opts.bus.emit({
        type: "info",
        message: `[project-app:${descriptor.id}] Could not refresh task read projection: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
    let controller: ProjectAppTaskController;
    controller = new ProjectAppTaskController({
      maxConcurrent: descriptor.app.budget?.maxConcurrent ?? 1,
      startAfter: startAfterByApp.get(descriptor.id),
      maxRetries: 3,
      resync: {
        intervalMs: tasks.resyncIntervalMs ?? 60_000,
        taskIds: () => listRunnableProjectAppTaskIds(config),
      },
      reconcile: async (taskId) => {
        const dependentTaskIds = await reconcileTask({
          opts,
          descriptor,
          taskId,
          reason: "task-controller",
        });
        for (const dependentTaskId of dependentTaskIds) {
          controller.enqueue(dependentTaskId);
        }
      },
      onError: (taskId, error, willRetry) => {
        opts.bus.emit({
          type: "handler.failed",
          source: "cron",
          owner: `agent:${descriptor.owner}`,
          data: {
            handler: `project-app-task-controller:${taskId}`,
            agent: descriptor.owner,
            error: `${error instanceof Error ? error.message : String(error)}; willRetry=${willRetry}`,
            durationMs: 0,
          },
        });
      },
    });
    controllers.set(descriptor.id, controller);
  }

  appTaskControllersByBus.set(opts.bus, controllers);
  return controllers;
}

function recoverInterruptedProjectAppTasks(
  opts: ProjectAppLoaderOptions,
  descriptors: ProjectAppDescriptor[],
  controllers: Map<string, ProjectAppTaskController>,
): void {
  for (const descriptor of descriptors) {
    if (!descriptor.app.tasks) continue;
    const controller = controllers.get(descriptor.id);
    const config = taskReconciliationConfig({
      appDir: descriptor.appDir,
      projectDir: descriptor.projectDir,
      owner: descriptor.owner,
      maxConcurrent: descriptor.app.budget?.maxConcurrent ?? 1,
    });
    for (const recovery of recoverableProjectAppTaskAttempts(config)) {
      if (recovery.trigger) {
        if (controller && !descriptor.reconciliationPaused) controller.enqueue(recovery.taskId);
        continue;
      }
      const released = releaseInterruptedProjectAppTaskAttempt(
        config,
        recovery.taskId,
        `Interrupted reconciliation ${recovery.taskId} cannot resume because its previous runtime did not persist the trigger packet`,
      );
      for (const sessionId of released.sessionIds) {
        interruptSupersededOwnerSession(
          opts,
          sessionId,
          `Recovered task ${recovery.taskId} interrupted an orphaned owner session from a previous runtime`,
        );
      }
    }
    const missingAttemptRepairs = repairRunningProjectAppTasksWithoutAttempt(config);
    for (const repair of missingAttemptRepairs) {
      if (controller && !descriptor.reconciliationPaused) controller.enqueue(repair.taskId);
    }
    const repairs = repairPreviousRuntimeRecoveryAttention(config);
    if (repairs.length > 0) {
      opts.bus.emit({
        type: "project.task.recovery.repaired",
        source: `project-app:${descriptor.id}:task-recovery`,
        owner: `agent:${descriptor.owner}`,
        target: { project: descriptor.id },
        data: {
          project: descriptor.id,
          repaired: repairs.length,
          requeued: repairs.filter((repair) => repair.disposition === "requeued").length,
          retired: repairs.filter((repair) => repair.disposition === "retired").length,
          taskIds: repairs.slice(0, 50).map((repair) => repair.taskId),
        },
      } as unknown as AgentEvent);
      for (const repair of repairs) {
        if (repair.disposition === "requeued" && controller && !descriptor.reconciliationPaused) {
          controller.enqueue(repair.taskId);
        }
      }
    }
    const attentions = pendingProjectAppTaskRecoveryAttention(config);
    if (attentions.length === 0) continue;
    if (!descriptor.reconciliationPaused) {
      opts.bus.emit({
        type: "project.owner.requested",
        source: `project-app:${descriptor.id}:task-recovery`,
        owner: `agent:${descriptor.owner}`,
        target: { project: descriptor.id },
        urgency: "high",
        data: {
          project: descriptor.id,
          reason: "project-app-task-recovery-attention",
          taskIds: attentions.map((attention) => attention.taskId),
          summaries: Object.fromEntries(attentions.map((attention) => [attention.taskId, attention.summary])),
          instruction:
            "Some task attempts were active in a previous runtime but cannot be resumed because no trigger packet was persisted. Reconcile these review/attention tasks from fresh evidence, release stale capacity, and assign only bounded runnable follow-up work.",
        },
      } as unknown as AgentEvent);
      for (const attention of attentions) acknowledgeProjectAppTaskRecoveryAttention(config, attention.taskId);
    }
  }
}

async function requeueRepairedProjectAppTaskHandlers(
  opts: ProjectAppLoaderOptions,
  descriptors: ProjectAppDescriptor[],
  controllers: Map<string, ProjectAppTaskController>,
): Promise<void> {
  const availability = new Map<string, boolean>();
  for (const descriptor of descriptors) {
    const controller = controllers.get(descriptor.id);
    if (!controller || !descriptor.app.tasks || descriptor.reconciliationPaused) continue;
    const config = taskReconciliationConfig({
      appDir: descriptor.appDir,
      projectDir: descriptor.projectDir,
      owner: descriptor.owner,
      maxConcurrent: descriptor.app.budget?.maxConcurrent ?? 1,
    });
    for (const candidate of listHandlerUnavailableProjectAppTasks(config, descriptor.owner)) {
      const paths = appWorkflowRuntimePaths(opts, descriptor, candidate.owner);
      const key = `${paths.workflowDir}\0${candidate.workflow}`;
      let available = availability.get(key);
      if (available === undefined) {
        available = (await inspectWorkflowDefinition(paths.workflowDir, candidate.workflow)).available;
        availability.set(key, available);
      }
      if (!available) continue;
      if (!releaseHandlerUnavailableProjectAppTask(config, candidate.taskId)) continue;
      controller.enqueue(candidate.taskId);
      opts.bus.emit({
        type: "project.task.handler.recovered",
        source: `project-app:${descriptor.id}:task-recovery`,
        owner: `agent:${candidate.owner}`,
        target: { project: descriptor.id, taskId: candidate.taskId },
        data: {
          project: descriptor.id,
          taskId: candidate.taskId,
          handler: `workflow:${candidate.workflow}`,
          reason: "workflow-binding-resolved-after-app-reload",
        },
      } as unknown as AgentEvent);
    }
  }
}

function attachAppEventRouter(opts: ProjectAppLoaderOptions, descriptors: ProjectAppDescriptor[]): void {
  const existing = appRouterDescriptorsByBus.get(opts.bus);
  if (existing) {
    existing.splice(0, existing.length, ...descriptors);
    return;
  }

  appRouterDescriptorsByBus.set(opts.bus, descriptors);
  opts.bus.subscribe((rawEvent): DeliveryResult | void => {
    const event = flattenEvent(rawEvent);
    for (const descriptor of appRouterDescriptorsByBus.get(opts.bus) ?? []) {
      if (descriptor.reconciliationPaused) continue;
      const taskController = appTaskControllersByBus.get(opts.bus)?.get(descriptor.id);
      if (
        descriptor.app.tasks &&
        (isProjectScopedForApp(event, descriptor.id) || ownerValue(event) === descriptor.owner)
      ) {
        const config = taskReconciliationConfig({
          appDir: descriptor.appDir,
          projectDir: descriptor.projectDir,
          owner: descriptor.owner,
          maxConcurrent: descriptor.app.budget?.maxConcurrent ?? 1,
        });
        const conditionWakes = trackProjectAppConditionEvent(config, event);
        for (const wake of conditionWakes) {
          taskController?.enqueue(wake.taskId);
        }
      }
      if (taskController && descriptor.app.tasks) {
        const appAcceptsTaskEvent = descriptor.app.tasks.accepts.some((selector) =>
          matchesEventSelector(selector, event),
        );
        const isRuntimeTaskWake = event.type === "project.task.tick";
        const targetedTaskId =
          (appAcceptsTaskEvent || isRuntimeTaskWake) &&
          isProjectScopedForApp(event, descriptor.id) &&
          isTaskWakeEvent(event)
            ? taskIdFromEvent(event)
            : "";
        if (targetedTaskId) {
          const config = taskReconciliationConfig({
            appDir: descriptor.appDir,
            projectDir: descriptor.projectDir,
            owner: descriptor.owner,
            maxConcurrent: descriptor.app.budget?.maxConcurrent ?? 1,
          });
          const existingIntent = readProjectAppTaskIntent(config, targetedTaskId);
          if (existingIntent && appAcceptsTaskEvent) {
            const resolved = descriptor.app.tasks.resolve(event);
            if (resolved?.id === targetedTaskId) {
              const trigger = taskTriggerWithOwnerIntents(config, targetedTaskId, event);
              observeProjectAppTaskIntent(config, {
                intent: resolved,
                appOwner: descriptor.owner,
                trigger,
              });
            }
          }
          const triggerResult = recordProjectAppTaskTrigger(
            config,
            targetedTaskId,
            taskTriggerWithOwnerIntents(config, targetedTaskId, event),
          );
          if (triggerResult.kind === "recorded") {
            taskController.enqueue(targetedTaskId);
            return projectAppTaskDelivery(descriptor, targetedTaskId, "existing targeted task wake accepted");
          }
          if (triggerResult.kind === "waiting") {
            return projectAppTaskDelivery(
              descriptor,
              targetedTaskId,
              "existing targeted task remains asleep on open Conditions",
            );
          }
          if (readProjectAppTaskIntent(config, targetedTaskId)) {
            return projectAppTaskDelivery(
              descriptor,
              targetedTaskId,
              "existing targeted task remains asleep on open Conditions",
            );
          }
          if (appAcceptsTaskEvent) {
            const resolved = descriptor.app.tasks.resolve(event);
            if (resolved?.id === targetedTaskId) {
              const trigger = taskTriggerWithOwnerIntents(config, targetedTaskId, event);
              const observation = observeProjectAppTaskIntent(config, {
                intent: resolved,
                appOwner: descriptor.owner,
                trigger,
              });
              if (observation.kind === "observed") taskController.enqueue(observation.taskId);
              return projectAppTaskDelivery(descriptor, targetedTaskId, "new targeted task wake accepted");
            }
          }
          // An explicit task target is the complete routing decision. The app
          // resolver may materialize exactly that target, but must not turn a
          // targeted wake into unrelated broad work.
          continue;
        }
        if (appAcceptsTaskEvent) {
          const intent = descriptor.app.tasks.resolve(event);
          if (intent) {
            const config = taskReconciliationConfig({
              appDir: descriptor.appDir,
              projectDir: descriptor.projectDir,
              owner: descriptor.owner,
              maxConcurrent: descriptor.app.budget?.maxConcurrent ?? 1,
            });
            const observation = observeProjectAppTaskIntent(config, {
              intent,
              appOwner: descriptor.owner,
              trigger: taskTriggerWithOwnerIntents(config, intent.id, event),
            });
            if (observation.kind === "observed") taskController.enqueue(observation.taskId);
            return projectAppTaskDelivery(descriptor, observation.taskId, "resolved task event accepted");
          }
          continue;
        }
      }
      const projectCommentForApp =
        event.type === "project.comment.created" && isProjectScopedForApp(event, descriptor.id);
      if (!projectCommentForApp && !shouldOfferToApp(descriptor.app, event)) continue;
      if (isMetricFeedbackEvent(event)) {
        const eventOwner = ownerValue(event);
        opts.bus.emit({
          type: "metric.feedback.routed",
          source: "project-app-loader",
          owner: `agent:${eventOwner || descriptor.owner}`,
          data: {
            metricId: metricEventId(event),
            alertId: metricAlertId(event),
            project: projectValue(event) || null,
            appId: descriptor.id,
            appPath: descriptor.appDir,
            route: "owner-app",
            eventType: event.type,
          },
        } as AgentEvent);
      }
      void Promise.resolve()
        .then(async () => {
          const ctx = makeContext(opts, descriptor, rawEvent);
          const closeInbox = (route: string): void => {
            const openEventId = (rawEvent as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID];
            if (!Number.isInteger(openEventId) || Number(openEventId) <= 0) return;
            opts.bus.emit({
              type: "owner.inbox.reviewed",
              source: `project-app:${descriptor.id}`,
              owner: `agent:${descriptor.owner}`,
              data: { openEventId, openEventType: event.type, reviewedBy: descriptor.owner, route },
              trace: {
                traceId: rawEvent.trace?.traceId ?? `event:${openEventId}`,
                parentEventId: openEventId,
                links: [{ eventId: openEventId, type: "closure", label: "owner.inbox.reviewed" }],
              },
            } as any);
          };
          const result =
            typeof descriptor.app.onEvent === "function" ? await descriptor.app.onEvent(ctx, event) : undefined;
          if (projectCommentForApp) {
            const resultEvent = isRecord(result) && typeof result.type === "string" ? result : null;
            if (!resultEvent) {
              ctx.emit({
                type: "project.owner.requested",
                target: { project: descriptor.id },
                data: {
                  project: descriptor.id,
                  projectId: descriptor.id,
                  reason: "project-comment",
                  comment: typeof event.comment === "string" ? event.comment : "",
                  inputEventId: event.eventId ?? null,
                },
              });
              closeInbox("app-owner-request");
            } else if (resultEvent.type !== "project.owner.requested") {
              const openEventId = Number((rawEvent as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID]);
              if (Number.isInteger(openEventId) && openEventId > 0) {
                const resultTarget = isRecord(resultEvent.target) ? resultEvent.target : {};
                const taskId = typeof resultTarget.taskId === "string" ? resultTarget.taskId : "";
                opts.bus.emit({
                  type: "project.owner.reviewed",
                  source: `project-app:${descriptor.id}`,
                  owner: `agent:${descriptor.owner}`,
                  target: { project: descriptor.id, ...(taskId ? { taskId } : {}) },
                  data: {
                    openEventId,
                    openEventType: "project.comment.created",
                    project: descriptor.id,
                    projectId: descriptor.id,
                    disposition: taskId ? "task-updated" : resultEvent.type === "noop" ? "no-op" : "answered",
                    summary:
                      typeof resultEvent.reason === "string"
                        ? resultEvent.reason
                        : `App handled project intent through ${resultEvent.type}`,
                    taskRefs: taskId ? [{ projectId: descriptor.id, taskId }] : [],
                  },
                  trace: {
                    traceId: rawEvent.trace?.traceId ?? `event:${openEventId}`,
                    parentEventId: openEventId,
                    links: [{ eventId: openEventId, type: "closure", label: "project.owner.reviewed" }],
                  },
                } as unknown as AgentEvent);
              }
            }
          }
          if (result !== undefined) {
            closeInbox("app-onEvent");
          }
        })
        .catch((err) => {
          opts.bus.emit({
            type: "handler.failed",
            source: "cron",
            owner: `agent:${descriptor.owner}`,
            data: {
              handler: "project-app-event-router",
              agent: descriptor.owner,
              error: err instanceof Error ? err.message : String(err),
              durationMs: 0,
            },
          });
        });
    }
  });
}

function validatePreparedProjectApp(descriptor: ProjectAppDescriptor): void {
  const { app, id } = descriptor;
  const concurrency = app.budget?.maxConcurrent ?? 1;
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    throw new Error(`Project app ${id} maxConcurrent must be a positive integer`);
  }
  if (app.tasks) {
    const resyncIntervalMs = app.tasks.resyncIntervalMs ?? 60_000;
    if (!Number.isFinite(resyncIntervalMs) || resyncIntervalMs <= 0) {
      throw new Error(`Project app ${id} task resyncIntervalMs must be positive`);
    }
  }
  const scheduleIds = new Set<string>();
  for (const schedule of app.schedules ?? []) {
    if (!schedule.id?.trim()) throw new Error(`Project app ${id} has a schedule without an id`);
    if (scheduleIds.has(schedule.id)) throw new Error(`Project app ${id} has duplicate schedule ${schedule.id}`);
    scheduleIds.add(schedule.id);
    if (typeof schedule.intervalMs !== "number" || !Number.isFinite(schedule.intervalMs) || schedule.intervalMs <= 0) {
      throw new Error(`Project app ${id} schedule ${schedule.id} intervalMs must be positive`);
    }
    if (!Array.isArray(schedule.emits) || schedule.emits.length === 0) {
      throw new Error(`Project app ${id} schedule ${schedule.id} must emit at least one event`);
    }
  }
}

async function prepareProjectAppDescriptors(opts: ProjectAppLoaderOptions): Promise<ProjectAppDescriptor[]> {
  const descriptors: ProjectAppDescriptor[] = [];
  const ids = new Set<string>();
  for (const appDir of listProjectAppDirs(opts.projectsRoot)) {
    const app = await loadProjectApp(appDir);
    const id = typeof app.id === "string" && app.id.trim() ? app.id.trim() : appIdFromDir(appDir);
    if (ids.has(id)) throw new Error(`Duplicate project app id: ${id}`);
    ids.add(id);
    const descriptor: ProjectAppDescriptor = {
      id,
      appDir,
      projectDir: domainProjectDir(opts.projectsRoot, appDir, id, app),
      owner: configuredProjectAppOwner(app, appDir),
      app,
      reconciliationPaused: false,
    };
    descriptor.reconciliationPaused = descriptor.app.tasks
      ? projectAppLifecycle(descriptor.appDir) === "paused"
      : false;
    validatePreparedProjectApp(descriptor);
    descriptors.push(descriptor);
  }
  return descriptors;
}

async function commitProjectAppDescriptors(
  opts: ProjectAppLoaderOptions,
  prepared: ProjectAppDescriptor[],
): Promise<{ installed: ProjectAppDescriptor[]; entries: number }> {
  const installed: ProjectAppDescriptor[] = [];
  let entries = 0;
  const activeCronAppIds = new Map<Cron, Set<string>>();
  for (const descriptor of prepared) {
    const { id } = descriptor;
    let missingAgent = "";
    for (const agentName of requiredAppAgentNames(descriptor)) {
      if (!(await ensureAppAgentRegistered(opts, descriptor, agentName))) {
        missingAgent = agentName;
        break;
      }
    }
    if (missingAgent) {
      opts.bus.emit({
        type: "info",
        message: `[project-app] Skipping ${id}: required app agent "${missingAgent}" not registered and local registration failed`,
      });
      continue;
    }
    syncProjectReadModel(opts, descriptor);
    const cron = ensureOwnerCron(opts, descriptor);
    const activeAppIds = activeCronAppIds.get(cron) ?? new Set<string>();
    activeAppIds.add(descriptor.id);
    activeCronAppIds.set(cron, activeAppIds);
    if (descriptor.reconciliationPaused) {
      rememberProjectAppNames(projectAppScheduleSyntheticNamesByCron, cron, descriptor.id, new Set());
      installed.push(descriptor);
      continue;
    }
    entries += installSchedules(opts, cron, descriptor);
    installed.push(descriptor);
  }

  pruneProjectAppNames(projectAppScheduleSyntheticNamesByCron, opts.agentCrons, activeCronAppIds);
  const controllers = installConventionTaskControllers(opts, installed);

  if (installed.length > 0 || appRouterDescriptorsByBus.has(opts.bus)) {
    attachAppEventRouter(opts, installed);
  }
  recoverInterruptedProjectAppTasks(opts, installed, controllers);
  await requeueRepairedProjectAppTaskHandlers(opts, installed, controllers);

  return { installed, entries };
}

export async function installProjectApps(
  opts: ProjectAppLoaderOptions,
): Promise<{ installed: ProjectAppDescriptor[]; entries: number }> {
  const prepared = await prepareProjectAppDescriptors(opts);
  const previous = [...(appRouterDescriptorsByBus.get(opts.bus) ?? [])];
  try {
    return await commitProjectAppDescriptors(opts, prepared);
  } catch (error) {
    if (previous.length > 0) {
      try {
        await commitProjectAppDescriptors(opts, previous);
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          "Project app reload failed and the previous app set could not be restored",
        );
      }
    }
    throw error;
  }
}

function hashFile(path: string): string {
  try {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  } catch {
    return "";
  }
}

function hashWorkflowFiles(workflowDir: string): string[] {
  const files: string[] = [];
  const pending = [workflowDir];
  while (pending.length > 0) {
    const dir = pending.pop()!;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const entryPath = join(dir, entry.name);
      if (entry.isDirectory()) pending.push(entryPath);
      else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
        files.push(`${entryPath}\t${hashFile(entryPath)}`);
      }
    }
  }
  return files.sort();
}

function projectAppLifecycle(appDir: string): string {
  try {
    const paths = projectRuntimePaths(appDir);
    const tree = JSON.parse(readFileSync(paths.taskStatePath, "utf8")) as {
      project_lifecycle?: unknown;
    };
    return typeof tree.project_lifecycle === "string" ? tree.project_lifecycle.trim() : "";
  } catch {
    return "";
  }
}

export function projectAppHostFingerprint(projectsRoot: string): string {
  const parts: string[] = [];
  for (const appDir of listProjectAppDirs(projectsRoot)) {
    const tsPath = join(appDir, "app.ts");
    const jsPath = join(appDir, "app.js");
    const manifestPath = existsSync(tsPath) ? tsPath : jsPath;
    parts.push(`${appDir}\t${manifestPath}\t${hashFile(manifestPath)}`);
    parts.push(`${appDir}\tproject_lifecycle\t${projectAppLifecycle(appDir)}`);
    for (const agent of localAgents(appDir)) {
      const agentDir = join(appDir, "agents", agent.dirName);
      const configPath = join(agentDir, "agent.json");
      parts.push(`${appDir}\t${configPath}\t${hashFile(configPath)}`);
      parts.push(...hashWorkflowFiles(join(agentDir, "workflows")));
    }
  }
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

export function startProjectAppWatcher(
  opts: ProjectAppLoaderOptions,
  watcherOpts: { intervalMs?: number } = {},
): ProjectAppWatcher {
  const intervalMs = Math.max(1_000, watcherOpts.intervalMs ?? 5_000);
  let closed = false;
  let inFlight = false;
  let lastFingerprint = projectAppHostFingerprint(opts.projectsRoot);

  const scanNow = async (): Promise<boolean> => {
    if (closed || inFlight) return false;
    const nextFingerprint = projectAppHostFingerprint(opts.projectsRoot);
    if (nextFingerprint === lastFingerprint) return false;
    inFlight = true;
    try {
      const result = await installProjectApps(opts);
      lastFingerprint = nextFingerprint;
      opts.bus.emit({
        type: "info",
        message: `[project-app] Auto-reloaded ${result.installed.length} app(s), ${result.entries} trigger(s)`,
      });
      return true;
    } catch (err) {
      opts.bus.emit({
        type: "info",
        message: `[project-app] Auto-reload failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      return false;
    } finally {
      inFlight = false;
    }
  };

  const timer = setInterval(() => {
    void scanNow();
  }, intervalMs);
  timer.unref();

  return {
    close: () => {
      closed = true;
      clearInterval(timer);
    },
    scanNow,
  };
}
