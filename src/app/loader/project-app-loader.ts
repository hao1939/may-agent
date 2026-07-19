import { createHash } from "node:crypto";
import { Type } from "@earendil-works/pi-ai";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import type { SubagentManager } from "../../lib/index.js";
import type { CronEntry } from "../../lib/cron-tool.js";
import type { EventEnvelope } from "../../lib/handler-context.js";
import { buildRuntimeCtx } from "../../lib/runtime-ctx.js";
import { importRuntimeModule } from "../../lib/runtime-import.js";
import { runWorkflowDirect, WorkflowHandlerUnavailable } from "../../lib/workflow-tool.js";
import { getDb } from "../../lib/requests.js";
import { createQueryService } from "../../lib/query-service.js";
import {
  loadProjectReadModel,
  matchesEventSelector,
  projectRuntimePaths,
  readTaskTree,
  type ProjectApp,
  type ProjectAppContext,
  type ProjectAppConditionSpec,
  type ProjectAppEvent as AppEvent,
  type ProjectAppEventTarget as EventTarget,
  type ProjectAppTaskAction,
  type ProjectAppTaskIntent,
} from "@may-agent/sdk";
import { Cron } from "../cron.js";
import { ProjectAppTaskController } from "../project-app-task-controller.js";
import { isTypedProjectAppConditionSubject, trackProjectAppConditionEvent } from "../project-app-condition-tracker.js";
import { childEventTrace, EVENT_ROW_ID, type AgentEvent, type EventBus } from "../event-bus.js";
import {
  acknowledgeProjectAppTaskRecoveryAttention,
  claimProjectAppTask,
  completeProjectAppTask,
  deferProjectAppTask,
  markProjectAppTaskAttention,
  listProjectAppTaskIntents,
  listRunnableProjectAppTaskIds,
  observeProjectAppTaskIntent,
  pendingProjectAppTaskRecoveryAttention,
  readProjectAppTaskIntent,
  readProjectAppTaskTrigger,
  repairPreviousRuntimeRecoveryAttention,
  recoverableProjectAppTaskAttempts,
  releaseInterruptedProjectAppTaskAttempt,
  taskReconciliationConfig,
  PROJECT_APP_TASK_RECOVERY_OWNER,
  type ProjectAppTaskClaim,
} from "../project-app-task-reconciler.js";

type ProjectReadModel = {
  id: string;
  path: string;
  name: string;
  owner: string;
  status: string;
  type: string;
  priority: string | null;
};

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
    if (entry.name === "shared" || entry.name === "gym") continue;
    if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
    const name = configuredAgentName(join(agentsRoot, entry.name), entry.name);
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

function makeContext(opts: ProjectAppLoaderOptions, descriptor: ProjectAppDescriptor): ProjectAppContext {
  return {
    appPath: (path: string) => resolve(descriptor.appDir, path),
    emit: (event) => {
      const envelope = normalizeEvent(event, {
        source: `project-app:${descriptor.id}`,
        owner: `agent:${descriptor.owner}`,
      });
      opts.bus.emit(envelope as unknown as AgentEvent);
      return envelope;
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
  unavailable?: boolean;
};

type WorkflowCapability = {
  workflow: string;
  agent?: string;
  task: string;
};

type NormalizedTaskHandlerResult = {
  state: "converged" | "waiting" | "needs-owner" | "failed";
  summary: string;
  evidence: string[];
  actions: ProjectAppTaskAction[];
  conditions?: ProjectAppConditionSpec[];
};

const taskStates = new Set(["converged", "waiting", "needs-owner"]);
const taskModes = new Set(["achieve", "maintain"]);
const taskPriorities = new Set(["P0", "P1", "P2", "P3"]);
const ownerTaskActionSchema = Type.Union([
  Type.Object({
    kind: Type.Literal("create-task"),
    id: Type.String(),
    parentId: Type.String(),
    goal: Type.String(),
    mode: Type.Union([Type.Literal("achieve"), Type.Literal("maintain")]),
    outputs: Type.Array(Type.String()),
    acceptance: Type.Array(Type.String()),
    priority: Type.Optional(
      Type.Union([Type.Literal("P0"), Type.Literal("P1"), Type.Literal("P2"), Type.Literal("P3")]),
    ),
    owner: Type.Optional(Type.String()),
    workflow: Type.Optional(Type.String()),
    input: Type.Optional(Type.Any()),
    dependsOn: Type.Optional(Type.Array(Type.String())),
  }),
  Type.Object({
    kind: Type.Literal("update-task"),
    taskId: Type.String(),
    expectedGeneration: Type.Number(),
    goal: Type.Optional(Type.String()),
    mode: Type.Optional(Type.Union([Type.Literal("achieve"), Type.Literal("maintain")])),
    outputs: Type.Optional(Type.Array(Type.String())),
    acceptance: Type.Optional(Type.Array(Type.String())),
  }),
  Type.Object({
    kind: Type.Literal("close-task"),
    taskId: Type.String(),
    expectedGeneration: Type.Number(),
    summary: Type.String(),
  }),
  Type.Object({
    kind: Type.Literal("unblock-task"),
    taskId: Type.String(),
    expectedGeneration: Type.Number(),
    reason: Type.String(),
  }),
]);
const ownerTaskResultSchema = Type.Object({
  state: Type.Union([Type.Literal("converged"), Type.Literal("waiting"), Type.Literal("needs-owner")]),
  summary: Type.String(),
  evidence: Type.Array(Type.String()),
  actions: Type.Optional(Type.Array(ownerTaskActionSchema)),
  conditions: Type.Optional(Type.Array(Type.Any())),
});

function validProjectAppConditionSpec(value: unknown): value is ProjectAppConditionSpec {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || !value.id.trim()) return false;
  if (typeof value.type !== "string" || !value.type.trim()) return false;
  if (typeof value.subject !== "string" || !isTypedProjectAppConditionSubject(value.subject.trim())) return false;
  if (!("expected" in value)) return false;
  if (value.owner !== undefined && (typeof value.owner !== "string" || !value.owner.trim())) {
    return false;
  }
  return true;
}

function normalizedConditions(conditions: unknown[] | undefined): ProjectAppConditionSpec[] {
  return (conditions ?? []).filter(validProjectAppConditionSpec).map((condition) => ({
    ...condition,
    id: condition.id.trim(),
    type: condition.type.trim(),
    subject: condition.subject.trim(),
    ...(condition.owner !== undefined ? { owner: condition.owner.trim() } : {}),
  }));
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function validExpectedGeneration(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function invalidProjectAppTaskActionReason(value: unknown, index: number): string | null {
  if (!isRecord(value)) return `actions[${index}] must be an object`;
  const kind = value.kind;
  if (!["create-task", "update-task", "close-task", "unblock-task"].includes(String(kind))) {
    return `actions[${index}].kind must be one of create-task, update-task, close-task, unblock-task`;
  }

  if (kind === "create-task") {
    if (!nonEmptyString(value.id)) return `actions[${index}].id must be a non-empty string`;
    if (!nonEmptyString(value.parentId)) return `actions[${index}].parentId must be a non-empty string`;
    if (!nonEmptyString(value.goal)) return `actions[${index}].goal must be a non-empty string`;
    if (!taskModes.has(String(value.mode))) return `actions[${index}].mode must be achieve or maintain`;
    if (!stringArray(value.outputs)) return `actions[${index}].outputs must be a string array`;
    if (!stringArray(value.acceptance) || value.acceptance.length === 0) {
      return `actions[${index}].acceptance must be a non-empty string array`;
    }
    if (value.priority !== undefined && !taskPriorities.has(String(value.priority))) {
      return `actions[${index}].priority must be P0, P1, P2, or P3`;
    }
    if (value.owner !== undefined && !nonEmptyString(value.owner)) {
      return `actions[${index}].owner must be a non-empty string when present`;
    }
    if (value.workflow !== undefined && !nonEmptyString(value.workflow)) {
      return `actions[${index}].workflow must be a non-empty string when present`;
    }
    if (typeof value.workflow === "string" && value.workflow.trim() === "project") {
      return `actions[${index}].workflow must name a real workflow; omit workflow for owner-handled project work`;
    }
    if (value.dependsOn !== undefined && !stringArray(value.dependsOn)) {
      return `actions[${index}].dependsOn must be a string array when present`;
    }
    return null;
  }

  if (!nonEmptyString(value.taskId)) return `actions[${index}].taskId must be a non-empty string`;
  if (!validExpectedGeneration(value.expectedGeneration)) {
    return `actions[${index}].expectedGeneration must be a positive integer`;
  }
  if (kind === "update-task") {
    if (value.goal !== undefined && !nonEmptyString(value.goal)) {
      return `actions[${index}].goal must be a non-empty string when present`;
    }
    if (value.mode !== undefined && !taskModes.has(String(value.mode))) {
      return `actions[${index}].mode must be achieve or maintain when present`;
    }
    if (value.outputs !== undefined && !stringArray(value.outputs)) {
      return `actions[${index}].outputs must be a string array when present`;
    }
    if (value.acceptance !== undefined && !stringArray(value.acceptance)) {
      return `actions[${index}].acceptance must be a string array when present`;
    }
    return null;
  }
  if (kind === "close-task" && !nonEmptyString(value.summary)) {
    return `actions[${index}].summary must be a non-empty string`;
  }
  if (kind === "unblock-task" && !nonEmptyString(value.reason)) {
    return `actions[${index}].reason must be a non-empty string`;
  }
  return null;
}

export function normalizeTaskHandlerResult(
  output: unknown,
  fallback: { type: "done" | "blocked"; summary: string; runId: string | null },
): NormalizedTaskHandlerResult {
  if (!isRecord(output)) {
    return {
      state: "failed",
      summary:
        fallback.type === "blocked"
          ? fallback.summary
          : "Workflow returned an invalid task handler result: expected an object",
      evidence: fallback.runId ? [`workflow-run:${fallback.runId}`] : [],
      actions: [],
    };
  }
  const state = output.state;
  const summary = output.summary;
  const evidence = output.evidence;
  const actions = output.actions;
  const conditions = output.conditions;
  if (
    typeof state !== "string" ||
    !taskStates.has(state) ||
    typeof summary !== "string" ||
    !summary.trim() ||
    !Array.isArray(evidence) ||
    !evidence.every((entry) => typeof entry === "string") ||
    (actions !== undefined && !Array.isArray(actions)) ||
    (conditions !== undefined && !Array.isArray(conditions))
  ) {
    return {
      state: "failed",
      summary: "Workflow returned an invalid task handler result envelope",
      evidence: fallback.runId ? [`workflow-run:${fallback.runId}`] : [],
      actions: [],
    };
  }

  const conditionList = conditions ?? [];
  const invalidConditionIndex = conditionList.findIndex((condition) => !validProjectAppConditionSpec(condition));
  if (invalidConditionIndex >= 0) {
    return {
      state: "failed",
      summary: `Workflow returned an invalid Condition at conditions[${invalidConditionIndex}]`,
      evidence: fallback.runId ? [`workflow-run:${fallback.runId}`] : [],
      actions: [],
    };
  }
  const exactConditions = normalizedConditions(conditionList);
  const normalizedState = state as NormalizedTaskHandlerResult["state"];
  const normalizedSummary = summary.trim();
  const actionList = actions ?? [];
  for (let index = 0; index < actionList.length; index += 1) {
    const reason = invalidProjectAppTaskActionReason(actionList[index], index);
    if (reason) {
      return {
        state: "failed",
        summary: `Workflow returned an invalid task action: ${reason}`,
        evidence: fallback.runId ? [`workflow-run:${fallback.runId}`] : [],
        actions: [],
      };
    }
  }
  const normalizedActions = actionList as ProjectAppTaskAction[];

  if (normalizedState === "waiting" && exactConditions.length === 0) {
    return {
      state: "failed",
      summary: "Workflow returned waiting without an exact Condition",
      evidence: fallback.runId ? [`workflow-run:${fallback.runId}`] : [],
      actions: [],
    };
  }
  if (normalizedState !== "waiting" && exactConditions.length > 0) {
    return {
      state: "failed",
      summary: `Workflow returned Conditions with non-waiting state ${normalizedState}`,
      evidence: fallback.runId ? [`workflow-run:${fallback.runId}`] : [],
      actions: [],
    };
  }

  return {
    state: normalizedState,
    summary: normalizedSummary,
    evidence: [...evidence],
    actions: normalizedActions,
    conditions: exactConditions,
  };
}

async function runTaskCapability(input: {
  opts: ProjectAppLoaderOptions;
  descriptor: ProjectAppDescriptor;
  capability: WorkflowCapability;
  intent: ProjectAppTaskIntent;
  claim: ProjectAppTaskClaim;
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
    const { result, runId } = await runWorkflowDirect({
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
      trace,
    });
    const done = result.type === "done";
    const summary = done ? result.summary : result.reason;
    const handlerResult = normalizeTaskHandlerResult(done ? result.output : undefined, {
      type: done ? "done" : "blocked",
      summary,
      runId,
    });
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
    return { handlerResult, runId };
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
        state: unavailable ? "needs-owner" : "failed",
        summary,
        evidence: [],
        actions: [],
      },
      runId: null,
      ...(unavailable ? { unavailable: true } : {}),
    };
  }
}

async function runTaskOwner(input: {
  opts: ProjectAppLoaderOptions;
  descriptor: ProjectAppDescriptor;
  intent: ProjectAppTaskIntent;
  claim: ProjectAppTaskClaim;
  event?: EventEnvelope;
  fallbackReason?: string;
}): Promise<TaskCapabilityRun> {
  const { opts, descriptor, intent, claim, event } = input;
  const trace = childEventTrace(event);
  const prompt = [
    `You are the accountable owner for Agent App ${descriptor.id}.`,
    "Reconcile the task from current evidence. Do not edit task-tree storage directly.",
    "Return your decision through finish().result using state, summary, evidence, actions, and conditions.",
    "You are already the resolved owner; do not return state \"needs-owner\". Decide converged, waiting with exact Conditions, or failed with evidence.",
    "Use waiting only with exact Conditions. Use actions only for supported task-tree mutations.",
    "",
    "Allowed actions:",
    '- create a task: { kind: "create-task", id, parentId, goal, mode, outputs, acceptance, priority?, owner?, workflow?, input?, dependsOn? }',
    '- update a task: { kind: "update-task", taskId, expectedGeneration, goal?, mode?, outputs?, acceptance? }',
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
        fallbackReason: input.fallbackReason ?? null,
      },
      null,
      2,
    ),
    "```",
    ...(event ? ["", "## Trigger Observation", "```json", JSON.stringify(event, null, 2), "```"] : []),
  ].join("\n");

  const result = await opts.manager.callAgent(claim.owner, prompt, {
    source: "project-app-task-owner",
    projectId: descriptor.id,
    recoveryOwner: PROJECT_APP_TASK_RECOVERY_OWNER,
    trace,
    requireFinish: true,
    outputSchema: ownerTaskResultSchema,
    toolPolicy: "full",
  });
  const handlerResult = normalizeTaskHandlerResult(result.structuredResult, {
    type: result.status === "done" ? "done" : "blocked",
    summary:
      result.finishResult?.summary ??
      result.lastAssistantText ??
      result.error ??
      `Owner session ${result.sessionId || "unknown"} returned no result`,
    runId: result.sessionId || null,
  });
  if (handlerResult.state === "needs-owner") {
    return {
      handlerResult: {
        state: "failed",
        summary: "The resolved owner cannot hand the task back to itself",
        evidence: handlerResult.evidence ?? [],
        actions: [],
      },
      runId: result.sessionId || null,
    };
  }
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
  const trace = childEventTrace(event);
  opts.bus.emit({
    type,
    source: `project-app:${descriptor.id}:task-reconciler`,
    owner: `agent:${descriptor.owner}`,
    target: { project: descriptor.id, taskId },
    data: { project: descriptor.id, taskId, ...data },
    ...(trace ? { trace } : {}),
  } as unknown as AgentEvent);
}

async function reconcileTaskIntent(input: {
  opts: ProjectAppLoaderOptions;
  descriptor: ProjectAppDescriptor;
  intent: ProjectAppTaskIntent;
  event?: EventEnvelope;
  reason?: string;
}): Promise<string[]> {
  const { opts, descriptor, intent, event } = input;
  const flattened = event ? flattenEvent(event as unknown as AgentEvent) : {};

  const config = taskReconciliationConfig({
    appDir: descriptor.appDir,
    projectDir: descriptor.projectDir,
    owner: descriptor.owner,
    maxConcurrent: descriptor.app.budget?.maxConcurrent ?? 1,
  });
  const workflowKey = intent.workflow?.trim() || "";
  const primaryHandler = workflowKey ? `workflow:${workflowKey}` : "owner";
  const primary = claimProjectAppTask(config, {
    intent,
    appOwner: descriptor.owner,
    handler: primaryHandler,
    reason: input.reason ?? event?.type ?? "task-controller",
    trigger: event ? flattened : undefined,
  });
  if (primary.kind !== "claimed") {
    const skip =
      primary.kind === "busy"
        ? { reason: "attempt-active", attemptId: primary.attemptId }
        : primary.kind === "waiting"
          ? primary.dependencyIds?.length
            ? { reason: "dependencies-open", dependencyIds: primary.dependencyIds }
            : { reason: "conditions-open", conditionIds: primary.conditionIds }
          : primary.kind === "attention"
            ? { reason: "attention-required", generation: primary.generation, summary: primary.summary }
            : { reason: "already-completed", generation: primary.generation };
    emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconcile.skipped", intent.id, {
      route: "task-controller",
      ...skip,
    });
    return [];
  }
  emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconcile.started", intent.id, {
    route: "task-controller",
    generation: primary.generation,
    attemptId: primary.attemptId,
    handler: primary.handler,
    owner: primary.owner,
  });

  let primaryResult: TaskCapabilityRun;
  if (!workflowKey) {
    primaryResult = await runTaskOwner({ opts, descriptor, intent, claim: primary, event });
  } else {
    primaryResult = await runTaskCapability({
      opts,
      descriptor,
      capability: {
        workflow: workflowKey,
        agent: primary.owner,
        task: `Reconcile task through workflow ${workflowKey}`,
      },
      intent,
      claim: primary,
      event,
    });
  }

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
    try {
      const apply = completeProjectAppTask(config, primary, {
        summary: primaryHandlerResult.summary,
        evidence: primaryHandlerResult.evidence,
        actions: primaryHandlerResult.actions,
      });
      emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
        generation: primary.generation,
        attemptId: primary.attemptId,
        handler: primary.handler,
        disposition: apply.status === "applied" ? "converged" : "stale",
        summary: primaryHandlerResult.summary,
        evidence: primaryHandlerResult.evidence,
        actionsApplied: apply.actionsApplied,
        workflowRunId: primaryResult.runId,
      });
      return apply.dependentTaskIds;
    } catch (error) {
      primaryHandlerResult.state = "failed";
      primaryHandlerResult.summary = `Handler actions were rejected: ${error instanceof Error ? error.message : String(error)}`;
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
      emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
        generation: primary.generation,
        attemptId: primary.attemptId,
        handler: primary.handler,
        disposition: apply.status === "applied" ? primaryHandlerResult.state : "stale",
        summary: primaryHandlerResult.summary,
        evidence: primaryHandlerResult.evidence,
        actionsApplied: apply.actionsApplied,
        workflowRunId: primaryResult.runId,
      });
      return apply.reconcileTaskIds;
    } catch (error) {
      primaryHandlerResult.state = "failed";
      primaryHandlerResult.summary = `Handler result was rejected: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  markProjectAppTaskAttention(config, primary, {
    summary: primaryHandlerResult.summary,
    reason: primaryResult.unavailable
      ? "HandlerUnavailable"
      : primaryHandlerResult.state === "needs-owner"
        ? "needs-owner"
        : "handler-blocked",
  });
  if (!workflowKey) {
    emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
      generation: primary.generation,
      attemptId: primary.attemptId,
      handler: primary.handler,
      disposition: "attention",
      summary: primaryHandlerResult.summary,
    });
    return [];
  }

  const fallback = claimProjectAppTask(config, {
    intent,
    appOwner: descriptor.owner,
    handler: `owner:${primary.owner}`,
    reason: "workflow-fallback",
    trigger: event ? flattened : undefined,
  });
  if (fallback.kind !== "claimed") {
    emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
      generation: primary.generation,
      handler: primary.handler,
      disposition: "attention",
      summary: primaryHandlerResult.summary,
      fallback: fallback.kind,
    });
    return [];
  }

  emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconcile.started", intent.id, {
    route: "task-controller",
    generation: fallback.generation,
    attemptId: fallback.attemptId,
    handler: fallback.handler,
    owner: fallback.owner,
    fallbackFrom: primary.handler,
  });
  const fallbackResult = await runTaskOwner({
    opts,
    descriptor,
    intent,
    claim: fallback,
    event,
    fallbackReason: primaryHandlerResult.summary,
  });
  const fallbackHandlerResult = fallbackResult.handlerResult;
  if (fallbackHandlerResult.state === "converged") {
    try {
      const apply = completeProjectAppTask(config, fallback, {
        summary: fallbackHandlerResult.summary,
        evidence: fallbackHandlerResult.evidence,
        actions: fallbackHandlerResult.actions,
      });
      emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
        generation: fallback.generation,
        attemptId: fallback.attemptId,
        handler: fallback.handler,
        disposition: apply.status === "applied" ? "converged" : "stale",
        summary: fallbackHandlerResult.summary,
        evidence: fallbackHandlerResult.evidence,
        actionsApplied: apply.actionsApplied,
        workflowRunId: fallbackResult.runId,
        fallbackFrom: primary.handler,
      });
      return apply.dependentTaskIds;
    } catch (error) {
      fallbackHandlerResult.state = "failed";
      fallbackHandlerResult.summary = `Owner actions were rejected: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  if (fallbackHandlerResult.state === "waiting") {
    try {
      const apply = deferProjectAppTask(config, fallback, {
        disposition: fallbackHandlerResult.state,
        summary: fallbackHandlerResult.summary,
        evidence: fallbackHandlerResult.evidence,
        actions: fallbackHandlerResult.actions,
        conditions: fallbackHandlerResult.conditions,
      });
      emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
        generation: fallback.generation,
        attemptId: fallback.attemptId,
        handler: fallback.handler,
        disposition: apply.status === "applied" ? fallbackHandlerResult.state : "stale",
        summary: fallbackHandlerResult.summary,
        evidence: fallbackHandlerResult.evidence,
        actionsApplied: apply.actionsApplied,
        workflowRunId: fallbackResult.runId,
        fallbackFrom: primary.handler,
      });
      return apply.reconcileTaskIds;
    } catch (error) {
      fallbackHandlerResult.state = "failed";
      fallbackHandlerResult.summary = `Owner result was rejected: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  markProjectAppTaskAttention(config, fallback, {
    summary: fallbackHandlerResult.summary,
    reason: "owner-handler-failed",
  });
  emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
    generation: fallback.generation,
    attemptId: fallback.attemptId,
    handler: fallback.handler,
    disposition: "attention",
    summary: fallbackHandlerResult.summary,
    fallbackFrom: primary.handler,
  });
  return [];
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
    "project.task.reconcile.started",
    "project.task.reconcile.skipped",
    "project.task.reconciled",
  ].includes(type);
}

function installConventionTaskControllers(
  opts: ProjectAppLoaderOptions,
  descriptors: ProjectAppDescriptor[],
): Map<string, ProjectAppTaskController> {
  for (const controller of appTaskControllersByBus.get(opts.bus)?.values() ?? []) controller.close();
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
    let controller: ProjectAppTaskController;
    controller = new ProjectAppTaskController({
      maxConcurrent: descriptor.app.budget?.maxConcurrent ?? 1,
      maxRetries: 3,
      resync: {
        intervalMs: tasks.resyncIntervalMs ?? 60_000,
        taskIds: () => listRunnableProjectAppTaskIds(config),
      },
      reconcile: async (taskId) => {
        const intent = readProjectAppTaskIntent(config, taskId);
        if (!intent) return;
        const trigger = readProjectAppTaskTrigger(config, taskId);
        const dependentTaskIds = await reconcileTaskIntent({
          opts,
          descriptor,
          intent,
          event: trigger as EventEnvelope | undefined,
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
      releaseInterruptedProjectAppTaskAttempt(
        config,
        recovery.taskId,
        `Interrupted reconciliation ${recovery.taskId} cannot resume because its previous runtime did not persist the trigger packet`,
      );
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

async function dispatchProjectAppAction(
  opts: ProjectAppLoaderOptions,
  descriptor: ProjectAppDescriptor,
  rawEvent: AgentEvent,
  event: Record<string, unknown>,
): Promise<boolean> {
  if (event.type !== "project.action.invoked" || !isProjectScopedForApp(event, descriptor.id)) return false;

  const actionName = typeof event.action === "string" ? event.action.trim() : "";
  const action = actionName ? descriptor.app.actions?.[actionName] : undefined;
  const trace = childEventTrace(rawEvent);
  if (!action) {
    opts.bus.emit({
      type: "project.action.rejected",
      source: `project-app:${descriptor.id}`,
      owner: `agent:${descriptor.owner}`,
      target: { project: descriptor.id },
      data: {
        project: descriptor.id,
        action: actionName || null,
        reason: actionName ? "unknown-action" : "missing-action",
      },
      ...(trace ? { trace } : {}),
    } as unknown as AgentEvent);
    return true;
  }

  const params = isRecord(event.params) ? event.params : {};
  const emitted = normalizeEvent(action.event(params), {
    source: `project-app:${descriptor.id}:action:${actionName}`,
    owner: `agent:${descriptor.owner}`,
  });
  opts.bus.emit(emitted as unknown as AgentEvent);

  opts.bus.emit({
    type: "project.action.accepted",
    source: `project-app:${descriptor.id}`,
    owner: `agent:${descriptor.owner}`,
    target: { project: descriptor.id },
    data: { project: descriptor.id, action: actionName },
    ...(trace ? { trace } : {}),
  } as unknown as AgentEvent);
  return true;
}

function attachAppEventRouter(opts: ProjectAppLoaderOptions, descriptors: ProjectAppDescriptor[]): void {
  const existing = appRouterDescriptorsByBus.get(opts.bus);
  if (existing) {
    existing.splice(0, existing.length, ...descriptors);
    return;
  }

  appRouterDescriptorsByBus.set(opts.bus, descriptors);
  opts.bus.subscribe((rawEvent): void => {
    const event = flattenEvent(rawEvent);
    for (const descriptor of appRouterDescriptorsByBus.get(opts.bus) ?? []) {
      if (descriptor.reconciliationPaused) continue;
      const taskController = appTaskControllersByBus.get(opts.bus)?.get(descriptor.id);
      if (event.type === "project.action.invoked" && isProjectScopedForApp(event, descriptor.id)) {
        void dispatchProjectAppAction(opts, descriptor, rawEvent, event).catch((err) => {
          opts.bus.emit({
            type: "handler.failed",
            source: "cron",
            owner: `agent:${descriptor.owner}`,
            data: {
              handler: "project-app-action",
              agent: descriptor.owner,
              error: err instanceof Error ? err.message : String(err),
              durationMs: 0,
            },
          });
        });
        continue;
      }
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
        for (const wake of conditionWakes) taskController?.enqueue(wake.taskId);
      }
      if (taskController && descriptor.app.tasks) {
        const targetedTaskId =
          isProjectScopedForApp(event, descriptor.id) && isTaskWakeEvent(event) ? taskIdFromEvent(event) : "";
        if (
          targetedTaskId &&
          readProjectAppTaskIntent(
            taskReconciliationConfig({
              appDir: descriptor.appDir,
              projectDir: descriptor.projectDir,
              owner: descriptor.owner,
              maxConcurrent: descriptor.app.budget?.maxConcurrent ?? 1,
            }),
            targetedTaskId,
          )
        ) {
          taskController.enqueue(targetedTaskId);
        }
        if (descriptor.app.tasks.accepts.some((selector) => matchesEventSelector(selector, event))) {
          const intent = descriptor.app.tasks.resolve(event);
          if (intent) {
            const observation = observeProjectAppTaskIntent(
              taskReconciliationConfig({
                appDir: descriptor.appDir,
                projectDir: descriptor.projectDir,
                owner: descriptor.owner,
                maxConcurrent: descriptor.app.budget?.maxConcurrent ?? 1,
              }),
              { intent, appOwner: descriptor.owner, trigger: event },
            );
            if (observation.kind === "observed") taskController.enqueue(observation.taskId);
          }
          continue;
        }
      }
      if (!shouldOfferToApp(descriptor.app, event)) continue;
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
          const ctx = makeContext(opts, descriptor);
          const result =
            typeof descriptor.app.onEvent === "function" ? await descriptor.app.onEvent(ctx, event) : undefined;
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

function projectAppLifecycle(appDir: string): string {
  try {
    const tree = JSON.parse(readFileSync(projectRuntimePaths(appDir).taskTreePath, "utf8")) as {
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
