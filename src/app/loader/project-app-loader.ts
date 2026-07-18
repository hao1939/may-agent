import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import type { SubagentManager } from "../../lib/index.js";
import type { CronEntry } from "../../lib/cron-tool.js";
import type { EventEnvelope } from "../../lib/handler-context.js";
import { buildRuntimeCtx } from "../../lib/runtime-ctx.js";
import { importRuntimeModule } from "../../lib/runtime-import.js";
import { runWorkflowDirect } from "../../lib/workflow-tool.js";
import { getDb } from "../../lib/requests.js";
import {
  loadProjectReadModel,
  type EventSelector,
  type ProjectApp,
  type ProjectAppContext,
  type ProjectAppEvent as AppEvent,
  type ProjectAppEventTarget as EventTarget,
  type ProjectAppTaskCapability,
  type ProjectAppTaskHandlerResult,
  type ProjectAppTaskIntent,
  type ProjectAppTaskRoute,
} from "@may-agent/sdk";
import { Cron } from "../cron.js";
import { childEventTrace, EVENT_ROW_ID, type AgentEvent, type EventBus } from "../event-bus.js";
import {
  claimProjectAppTask,
  completeProjectAppTask,
  deferProjectAppTask,
  markProjectAppTaskAttention,
  observeProjectAppTaskConditions,
  recoverableProjectAppTaskAttempts,
  taskReconciliationConfig,
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
  /**
   * Backward-compatible name for older callers. Prefer registerLocalAgent.
   */
  registerOwnerAgent?: (ownerName: string, appDir: string) => Promise<boolean>;
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
    throw new Error("Project app workflow handlers require persistDir, agentsRoot, and sharedRoot");
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
  projectWorkflowDir: string;
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
    projectWorkflowDir: join(descriptor.appDir, "workflows"),
    guardsDir: join(agentDir, "guards"),
    sharedGuardsDir: join(runtime.sharedRoot, "guards"),
  };
}

function flattenEvent(event: AgentEvent): Record<string, unknown> {
  const record = event as unknown as Record<string, unknown>;
  const data = isRecord(record.data) ? record.data : {};
  return { ...data, ...record, data };
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

function selectorProject(selector: Exclude<EventSelector, string>): string {
  return typeof selector.target?.project === "string" && selector.target.project.trim()
    ? selector.target.project.trim()
    : typeof selector.project === "string" && selector.project.trim()
      ? selector.project.trim()
      : "";
}

function taskIdValue(event: Record<string, unknown>): string {
  const direct = event.taskId ?? event.task_id;
  if (typeof direct === "string") return direct;
  if (isRecord(event.target)) {
    const targetedTaskId = event.target.taskId;
    if (typeof targetedTaskId === "string") return targetedTaskId;
  }
  return "";
}

function matchesSelector(selector: EventSelector, event: Record<string, unknown>, appId: string): boolean {
  if (typeof selector === "string") return event.type === selector;
  if (event.type !== selector.type) return false;
  const project = selectorProject(selector);
  if (project && projectValue(event) !== project) return false;
  if (selector.target?.taskId && taskIdValue(event) !== selector.target.taskId) return false;
  if (selector.owner && ownerValue(event) !== selector.owner.replace(/^agent:/, "")) return false;
  if (selector.urgency && event.urgency !== selector.urgency) return false;
  if (selector.actions?.length) {
    const action = typeof event.action === "string" ? event.action : "";
    if (!selector.actions.includes(action)) return false;
  }
  if (selector.metricIds?.length) {
    const metricId = typeof event.metricId === "string" ? event.metricId : "";
    if (!selector.metricIds.includes(metricId)) return false;
  }
  return true;
}

function eventTypeFromSelector(selector: EventSelector): string | null {
  if (typeof selector === "string") return selector;
  return typeof selector.type === "string" && selector.type.trim() ? selector.type.trim() : null;
}

function handlerAccepts(handler: NonNullable<ProjectApp["workflowHandlers"]>[number]): EventSelector[] {
  return handler.accepts;
}

function handlerAcceptedEventTypes(handler: NonNullable<ProjectApp["workflowHandlers"]>[number]): string[] {
  return [
    ...new Set(
      handlerAccepts(handler)
        .map(eventTypeFromSelector)
        .filter((type): type is string => Boolean(type)),
    ),
  ];
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

function isOwnerMetricFeedbackForApp(event: Record<string, unknown>, appOwner: string): boolean {
  const owner = ownerValue(event);
  const project = projectValue(event);
  return isMetricFeedbackEvent(event) && (owner === appOwner || (!!project && owner === `project:${project}`));
}

function shouldOfferToApp(app: ProjectApp, event: Record<string, unknown>, appId: string, appOwner: string): boolean {
  if ((app.events ?? []).some((selector) => matchesSelector(selector, event, appId))) return true;
  if (hasExplicitWorkflowHandler(app, event, appId)) return true;
  if (hasExplicitTaskRoute(app, event, appId)) return true;
  return isOwnerMetricFeedbackForApp(event, appOwner);
}

function hasExplicitWorkflowHandler(app: ProjectApp, event: Record<string, unknown>, appId: string): boolean {
  return (
    typeof event.type === "string" &&
    (app.workflowHandlers ?? []).some((handler) => {
      if (handler.enabled === false) return false;
      return handlerAccepts(handler).some((selector) => matchesSelector(selector, event, appId));
    })
  );
}

function routeAccepts(route: ProjectAppTaskRoute): EventSelector[] {
  return route.accepts;
}

function routeAcceptedEventTypes(route: ProjectAppTaskRoute): string[] {
  return [
    ...new Set(
      routeAccepts(route)
        .map(eventTypeFromSelector)
        .filter((type): type is string => Boolean(type)),
    ),
  ];
}

function hasExplicitTaskRoute(app: ProjectApp, event: Record<string, unknown>, appId: string): boolean {
  return (app.taskRoutes ?? []).some(
    (route) =>
      route.enabled !== false && routeAccepts(route).some((selector) => matchesSelector(selector, event, appId)),
  );
}

function makeContext(opts: ProjectAppLoaderOptions, descriptor: ProjectAppDescriptor): ProjectAppContext {
  return {
    workspacePath: (path: string) => resolve(descriptor.projectDir, path),
    workspaceCwd: () => descriptor.projectDir,
    projectPath: (path: string) => resolve(descriptor.projectDir, path),
    appPath: (path: string) => resolve(descriptor.appDir, path),
    readJson: async <T = unknown>(path: string) => {
      const absolute = resolve(descriptor.appDir, path);
      return JSON.parse(readFileSync(absolute, "utf-8")) as T;
    },
    importModule: async <T = Record<string, unknown>>(path: string) => importRuntimeModule<T>(resolve(path)),
    startSession: (input) =>
      opts.manager.run(input.agent, input.task, {
        source: "project-app",
        kind: "job",
        projectId: descriptor.id,
        ...(input.timeoutMs ? { timeoutMs: input.timeoutMs } : {}),
      }),
    emit: (event) => {
      const envelope = normalizeEvent(event, {
        source: `project-app:${descriptor.id}`,
        owner: `agent:${descriptor.owner}`,
      });
      opts.bus.emit(envelope as unknown as AgentEvent);
      return envelope;
    },
    noop: (reason: string) => ({ type: "noop", reason }),
  };
}

function ownerFallbackTask(descriptor: ProjectAppDescriptor, event: Record<string, unknown>): string {
  const metricFeedback = isMetricFeedbackEvent(event);
  return [
    `Project app: ${descriptor.id}`,
    `App path: ${descriptor.appDir}`,
    `Project path: ${descriptor.projectDir}`,
    "",
    metricFeedback
      ? "A metric feedback event reached this app owner but no explicit app handler accepted it. Review the metric alert, decide whether the project/task tree, metric definition, or owner context needs to change, and take the smallest useful action."
      : "A project-scoped event has no explicit app workflow handler. Review the event, decide whether the task tree, project model, or project artifacts need to change, and take the smallest useful action.",
    "",
    "## Event",
    "```json",
    JSON.stringify(event, null, 2),
    "```",
  ].join("\n");
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
  const names = new Set<string>([descriptor.owner]);
  for (const handler of descriptor.app.workflowHandlers ?? []) {
    const agentName = handler.handler.agent ?? descriptor.owner;
    if (agentName.trim()) names.add(agentName.trim());
  }
  const ownerEntryAgent = descriptor.app.ownerEntry?.agent;
  if (ownerEntryAgent?.trim()) names.add(ownerEntryAgent.trim());
  for (const capability of Object.values(descriptor.app.taskWorkflows ?? {})) {
    if (capability.agent?.trim()) names.add(capability.agent.trim());
  }
  return [...names];
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
    : opts.registerOwnerAgent
      ? await opts.registerOwnerAgent(agentName, descriptor.appDir)
      : false;

  return registered || opts.manager.hasAgent(agentName);
}

const projectAppWorkflowSyntheticNamesByCron = new WeakMap<Cron, Map<string, Set<string>>>();
const projectAppTaskRouteSyntheticNamesByCron = new WeakMap<Cron, Map<string, Set<string>>>();
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

function installWorkflowHandlers(opts: ProjectAppLoaderOptions, cron: Cron, descriptor: ProjectAppDescriptor): number {
  let count = 0;
  const currentNames = new Set<string>();
  for (const handler of descriptor.app.workflowHandlers ?? []) {
    currentNames.add(handler.name);
    const workflow = handler.handler;
    const agentName = workflow.agent ?? descriptor.owner;
    const projectId = workflow.projectId ?? descriptor.id;
    const entry: CronEntry = {
      name: handler.name,
      enabled: handler.enabled !== false,
      description: handler.description,
      maxConcurrentTriggers: handler.maxConcurrentTriggers,
      on: handlerAcceptedEventTypes(handler),
      context: handler.context,
      agent: agentName,
      handler: {
        workflow: workflow.workflow,
        agent: agentName,
        projectId,
        includeEvent: workflow.includeEvent,
        task: workflow.task,
        timeoutMs: workflow.timeoutMs,
      },
    };
    // Register a workflow-backed handler so resolveMode() succeeds when
    // event-subscribed entries are triggered from the bus.  Without this,
    // crons that lack a handlerResolver (project-app owner crons) silently
    // drop event-triggered dispatches because no JS handler is registered.
    const workflowName = workflow.workflow;
    const taskText = workflow.task;
    const includeEvent = workflow.includeEvent;
    const handlerName = handler.name;
    cron.registerHandler(handlerName, async (event?: EventEnvelope) => {
      if (event) {
        const flattened = flattenEvent(event as unknown as AgentEvent);
        if (!handlerAccepts(handler).some((selector) => matchesSelector(selector, flattened, descriptor.id))) return;
      }
      const runtime = requireWorkflowRuntimeOptions(opts);
      const trace = childEventTrace(event);
      const paths = appWorkflowRuntimePaths(opts, descriptor, agentName);
      const task =
        includeEvent && event
          ? `${taskText}\n\n## Trigger Event\n\`\`\`json\n${JSON.stringify(event, null, 2)}\n\`\`\``
          : taskText;
      opts.bus.emit({
        type: "handler.workflow_dispatched",
        source: `agent:${agentName}`,
        owner: `agent:${agentName}`,
        data: {
          handler: handlerName,
          workflow: workflowName,
          source: agentName,
          projectId,
          workflowRunId: null,
          status: "started",
        },
        ...(trace ? { trace } : {}),
      } as AgentEvent);
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
        workflowName,
        task,
        manager: opts.manager,
        runtimeCtx,
        agentName,
        persistDir: runtime.persistDir,
        workflowDir: paths.workflowDir,
        projectWorkflowDir: paths.projectWorkflowDir,
        guardsDir: paths.guardsDir,
        sharedGuardsDir: paths.sharedGuardsDir,
        projectId,
        trace,
      });
      // Always emit the dispatch event for observability — even on failure.
      opts.bus.emit({
        type: "handler.workflow_dispatched",
        source: `agent:${agentName}`,
        owner: `agent:${agentName}`,
        data: {
          handler: handlerName,
          workflow: workflowName,
          source: agentName,
          projectId,
          workflowRunId: runId,
          status: result.type === "done" ? "done" : "blocked",
          summary: result.type === "done" ? result.summary : undefined,
          reason: result.type === "blocked" ? result.reason : undefined,
        },
        ...(trace ? { trace } : {}),
      } as AgentEvent);
      // When the workflow is blocked, throw so cron's .catch() path fires. This triggers
      // handler.failed + exponential backoff in drainQueuedEventTrigger,
      // preventing tight error→drain→error cascades for opCount=0 session
      // errors that runWorkflowDirect resolves instead of rejecting.
      if (result.type !== "done") {
        const reason = result.reason;
        throw new Error(
          `Workflow "${workflowName}" did not complete: type=${result.type}${reason ? `, reason=${reason}` : ""}`,
        );
      }
    });
    cron.addSyntheticEntry(entry);
    count++;
  }

  rememberProjectAppNames(projectAppWorkflowSyntheticNamesByCron, cron, descriptor.id, currentNames);
  return count;
}

type TaskCapabilityRun = {
  handlerResult: ProjectAppTaskHandlerResult;
  runId: string | null;
};

const taskDispositions = new Set(["converged", "progressing", "waiting", "needs-owner", "failed"]);

function normalizeTaskHandlerResult(
  output: unknown,
  fallback: { type: "done" | "blocked"; summary: string; runId: string | null },
): ProjectAppTaskHandlerResult {
  if (output === undefined && fallback.type === "done") {
    return {
      disposition: "converged",
      summary: fallback.summary,
      evidence: fallback.runId ? [`workflow-run:${fallback.runId}`] : [],
      actions: [],
    };
  }
  if (!isRecord(output)) {
    return {
      disposition: "failed",
      summary:
        fallback.type === "blocked"
          ? fallback.summary
          : "Workflow returned an invalid task handler result: expected an object",
      evidence: fallback.runId ? [`workflow-run:${fallback.runId}`] : [],
      actions: [],
    };
  }
  const disposition = output.disposition;
  const summary = output.summary;
  const evidence = output.evidence;
  const actions = output.actions;
  const conditions = output.conditions;
  if (
    typeof disposition !== "string" ||
    !taskDispositions.has(disposition) ||
    typeof summary !== "string" ||
    !summary.trim() ||
    !Array.isArray(evidence) ||
    !evidence.every((entry) => typeof entry === "string") ||
    (actions !== undefined && !Array.isArray(actions)) ||
    (conditions !== undefined && !Array.isArray(conditions))
  ) {
    return {
      disposition: "failed",
      summary: "Workflow returned an invalid task handler result envelope",
      evidence: fallback.runId ? [`workflow-run:${fallback.runId}`] : [],
      actions: [],
    };
  }
  return {
    disposition: disposition as ProjectAppTaskHandlerResult["disposition"],
    summary: summary.trim(),
    evidence: [...evidence],
    actions: (actions ?? []) as ProjectAppTaskHandlerResult["actions"],
    conditions: (conditions ?? []) as ProjectAppTaskHandlerResult["conditions"],
  };
}

async function runTaskCapability(input: {
  opts: ProjectAppLoaderOptions;
  descriptor: ProjectAppDescriptor;
  capability: ProjectAppTaskCapability;
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
    "",
    "## Reconciliation Task",
    "```json",
    JSON.stringify(
      {
        appId: descriptor.id,
        taskId: claim.taskId,
        generation: claim.generation,
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
      projectWorkflowDir: paths.projectWorkflowDir,
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
        disposition: handlerResult.disposition,
        ...(done ? { summary } : { reason: summary }),
      },
      ...(trace ? { trace } : {}),
    } as AgentEvent);
    return { handlerResult, runId };
  } catch (error) {
    const summary = error instanceof Error ? error.message : String(error);
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
    } as AgentEvent);
    return {
      handlerResult: {
        disposition: "failed",
        summary,
        evidence: [],
        actions: [],
      },
      runId: null,
    };
  }
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
  } as AgentEvent);
}

async function reconcileTaskRoute(input: {
  opts: ProjectAppLoaderOptions;
  descriptor: ProjectAppDescriptor;
  route: ProjectAppTaskRoute;
  event?: EventEnvelope;
  reason?: string;
}): Promise<void> {
  const { opts, descriptor, route, event } = input;
  const flattened = event ? flattenEvent(event as unknown as AgentEvent) : {};
  const intent = route.resolve(flattened);
  if (!intent) {
    emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconcile.skipped", route.name, {
      route: route.name,
      reason: "route-produced-no-task",
    });
    return;
  }

  const config = taskReconciliationConfig({
    appDir: descriptor.appDir,
    projectDir: descriptor.projectDir,
    owner: descriptor.owner,
    maxConcurrent: descriptor.app.budget?.maxConcurrent ?? 1,
  });
  const workflowKey = intent.workflow?.trim() || "";
  const primaryCapability = workflowKey ? descriptor.app.taskWorkflows?.[workflowKey] : descriptor.app.ownerEntry;
  const primaryHandler = workflowKey ? `workflow:${workflowKey}` : "owner";
  const primary = claimProjectAppTask(config, {
    intent,
    appOwner: descriptor.owner,
    handler: primaryHandler,
    reason: input.reason ?? event?.type ?? route.name,
    trigger: event as unknown as Record<string, unknown> | undefined,
  });
  if (primary.kind !== "claimed") {
    const skip =
      primary.kind === "busy"
        ? { reason: "attempt-active", attemptId: primary.attemptId }
        : primary.kind === "waiting"
          ? { reason: "conditions-open", conditionIds: primary.conditionIds }
          : { reason: "already-completed", generation: primary.generation };
    emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconcile.skipped", intent.id, {
      route: route.name,
      ...skip,
    });
    return;
  }

  emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconcile.started", intent.id, {
    route: route.name,
    generation: primary.generation,
    attemptId: primary.attemptId,
    handler: primary.handler,
    owner: primary.owner,
  });

  let primaryResult: TaskCapabilityRun;
  if (!primaryCapability) {
    primaryResult = {
      handlerResult: {
        disposition: "needs-owner",
        summary: workflowKey
          ? `Task workflow is not declared: ${workflowKey}`
          : `App ${descriptor.id} has no ownerEntry`,
        evidence: [],
        actions: [],
      },
      runId: null,
    };
    emitTaskReconciliationEvent(opts, descriptor, event, "project.task.handler.unavailable", intent.id, {
      generation: primary.generation,
      handler: primary.handler,
      reason: primaryResult.handlerResult.summary,
    });
  } else {
    primaryResult = await runTaskCapability({
      opts,
      descriptor,
      capability: primaryCapability,
      intent,
      claim: primary,
      event,
    });
  }

  const primaryHandlerResult = primaryResult.handlerResult;
  if (primaryHandlerResult.disposition === "converged") {
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
      return;
    } catch (error) {
      primaryHandlerResult.disposition = "failed";
      primaryHandlerResult.summary = `Handler actions were rejected: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  if (primaryHandlerResult.disposition === "progressing" || primaryHandlerResult.disposition === "waiting") {
    try {
      const apply = deferProjectAppTask(config, primary, {
        disposition: primaryHandlerResult.disposition,
        summary: primaryHandlerResult.summary,
        evidence: primaryHandlerResult.evidence,
        actions: primaryHandlerResult.actions,
        conditions: primaryHandlerResult.conditions,
      });
      emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
        generation: primary.generation,
        attemptId: primary.attemptId,
        handler: primary.handler,
        disposition: apply.status === "applied" ? primaryHandlerResult.disposition : "stale",
        summary: primaryHandlerResult.summary,
        evidence: primaryHandlerResult.evidence,
        actionsApplied: apply.actionsApplied,
        workflowRunId: primaryResult.runId,
      });
      return;
    } catch (error) {
      primaryHandlerResult.disposition = "failed";
      primaryHandlerResult.summary = `Handler result was rejected: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  markProjectAppTaskAttention(config, primary, {
    summary: primaryHandlerResult.summary,
    reason: primaryCapability ? "handler-blocked" : "handler-unavailable",
  });
  if (!workflowKey || !descriptor.app.ownerEntry) {
    emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
      generation: primary.generation,
      attemptId: primary.attemptId,
      handler: primary.handler,
      disposition: "attention",
      summary: primaryHandlerResult.summary,
    });
    return;
  }

  const fallback = claimProjectAppTask(config, {
    intent,
    appOwner: descriptor.owner,
    handler: `owner:${primary.owner}`,
    reason: "workflow-fallback",
    trigger: event as unknown as Record<string, unknown> | undefined,
  });
  if (fallback.kind !== "claimed") {
    emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
      generation: primary.generation,
      handler: primary.handler,
      disposition: "attention",
      summary: primaryHandlerResult.summary,
      fallback: fallback.kind,
    });
    return;
  }

  emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconcile.started", intent.id, {
    route: route.name,
    generation: fallback.generation,
    attemptId: fallback.attemptId,
    handler: fallback.handler,
    owner: fallback.owner,
    fallbackFrom: primary.handler,
  });
  const fallbackResult = await runTaskCapability({
    opts,
    descriptor,
    capability: descriptor.app.ownerEntry,
    intent,
    claim: fallback,
    event,
    fallbackReason: primaryHandlerResult.summary,
  });
  const fallbackHandlerResult = fallbackResult.handlerResult;
  if (fallbackHandlerResult.disposition === "converged") {
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
      return;
    } catch (error) {
      fallbackHandlerResult.disposition = "failed";
      fallbackHandlerResult.summary = `Owner actions were rejected: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  if (fallbackHandlerResult.disposition === "progressing" || fallbackHandlerResult.disposition === "waiting") {
    try {
      const apply = deferProjectAppTask(config, fallback, {
        disposition: fallbackHandlerResult.disposition,
        summary: fallbackHandlerResult.summary,
        evidence: fallbackHandlerResult.evidence,
        actions: fallbackHandlerResult.actions,
        conditions: fallbackHandlerResult.conditions,
      });
      emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
        generation: fallback.generation,
        attemptId: fallback.attemptId,
        handler: fallback.handler,
        disposition: apply.status === "applied" ? fallbackHandlerResult.disposition : "stale",
        summary: fallbackHandlerResult.summary,
        evidence: fallbackHandlerResult.evidence,
        actionsApplied: apply.actionsApplied,
        workflowRunId: fallbackResult.runId,
        fallbackFrom: primary.handler,
      });
      return;
    } catch (error) {
      fallbackHandlerResult.disposition = "failed";
      fallbackHandlerResult.summary = `Owner result was rejected: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  markProjectAppTaskAttention(config, fallback, {
    summary: fallbackHandlerResult.summary,
    reason: "owner-entry-blocked",
  });
  emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
    generation: fallback.generation,
    attemptId: fallback.attemptId,
    handler: fallback.handler,
    disposition: "attention",
    summary: fallbackHandlerResult.summary,
    fallbackFrom: primary.handler,
  });
}

function installTaskRoutes(opts: ProjectAppLoaderOptions, cron: Cron, descriptor: ProjectAppDescriptor): number {
  const routes = descriptor.app.taskRoutes ?? [];
  if (routes.length > 0 && !descriptor.app.ownerEntry) {
    throw new Error(`Project app ${descriptor.id} declares taskRoutes without ownerEntry`);
  }
  let count = 0;
  const currentNames = new Set<string>();
  for (const route of routes) {
    currentNames.add(route.name);
    const entry: CronEntry = {
      name: route.name,
      enabled: route.enabled !== false,
      description: route.description,
      maxConcurrentTriggers: route.maxConcurrentTriggers,
      on: routeAcceptedEventTypes(route),
      context: [],
      agent: descriptor.owner,
      handler: {
        workflow: "__project_task_reconcile__",
        agent: descriptor.owner,
        projectId: descriptor.id,
        includeEvent: true,
        task: `Reconcile project task through route ${route.name}`,
        timeoutMs: 0,
      },
    };
    cron.registerHandler(route.name, async (event?: EventEnvelope) => {
      if (event) {
        const flattened = flattenEvent(event as unknown as AgentEvent);
        if (!routeAccepts(route).some((selector) => matchesSelector(selector, flattened, descriptor.id))) return;
      }
      await reconcileTaskRoute({ opts, descriptor, route, event });
    });
    cron.addSyntheticEntry(entry);
    count++;
  }
  const recoveryConfig = taskReconciliationConfig({
    appDir: descriptor.appDir,
    projectDir: descriptor.projectDir,
    owner: descriptor.owner,
    maxConcurrent: descriptor.app.budget?.maxConcurrent ?? 1,
  });
  for (const wake of recoverableProjectAppTaskAttempts(recoveryConfig)) {
    const flattened = flattenEvent(wake.trigger as unknown as AgentEvent);
    const route = routes.find(
      (candidate) =>
        candidate.enabled !== false &&
        routeAccepts(candidate).some((selector) => matchesSelector(selector, flattened, descriptor.id)) &&
        candidate.resolve(flattened)?.id === wake.taskId,
    );
    if (!route) continue;
    void reconcileTaskRoute({
      opts,
      descriptor,
      route,
      event: wake.trigger as unknown as EventEnvelope,
      reason: `attempt-recovery:${wake.taskId}`,
    }).catch((err) => {
      opts.bus.emit({
        type: "handler.failed",
        source: "cron",
        owner: `agent:${descriptor.owner}`,
        data: {
          handler: route.name,
          agent: descriptor.owner,
          error: err instanceof Error ? err.message : String(err),
          durationMs: 0,
        },
      });
    });
  }
  rememberProjectAppNames(projectAppTaskRouteSyntheticNamesByCron, cron, descriptor.id, currentNames);
  return count;
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
      if (isProjectScopedForApp(event, descriptor.id) || ownerValue(event) === descriptor.owner) {
        const config = taskReconciliationConfig({
          appDir: descriptor.appDir,
          projectDir: descriptor.projectDir,
          owner: descriptor.owner,
          maxConcurrent: descriptor.app.budget?.maxConcurrent ?? 1,
        });
        const conditionWakes = observeProjectAppTaskConditions(config, event);
        for (const wake of conditionWakes) {
          const route: ProjectAppTaskRoute = {
            name: `condition:${wake.conditionId}`,
            enabled: true,
            description: `Resume ${wake.taskId} after Condition ${wake.conditionId} changed`,
            accepts: [String(event.type ?? "")],
            resolve: () => wake.intent,
          };
          void reconcileTaskRoute({
            opts,
            descriptor,
            route,
            event: rawEvent as EventEnvelope,
            reason: wake.recovery ? `condition-recovery:${wake.conditionId}` : `condition:${wake.conditionId}`,
          }).catch((err) => {
            opts.bus.emit({
              type: "handler.failed",
              source: "cron",
              owner: `agent:${descriptor.owner}`,
              data: {
                handler: route.name,
                agent: descriptor.owner,
                error: err instanceof Error ? err.message : String(err),
                durationMs: 0,
              },
            });
          });
        }
      }
      if (!shouldOfferToApp(descriptor.app, event, descriptor.id, descriptor.owner)) continue;
      const ownerMetricFeedback = isOwnerMetricFeedbackForApp(event, descriptor.owner);
      const hasAppEventHandler = typeof descriptor.app.onEvent === "function";
      const hasWorkflowHandler = hasExplicitWorkflowHandler(descriptor.app, event, descriptor.id);
      const hasTaskRoute = hasExplicitTaskRoute(descriptor.app, event, descriptor.id);
      const routedMetricFeedback =
        isMetricFeedbackEvent(event) && (ownerMetricFeedback || hasWorkflowHandler || hasTaskRoute);
      if (routedMetricFeedback) {
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
      if (hasWorkflowHandler || hasTaskRoute) continue;
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
            return;
          }
          if (!isProjectScopedForApp(event, descriptor.id) && !ownerMetricFeedback) return;

          const sessionId = opts.manager.runAgent(descriptor.owner, ownerFallbackTask(descriptor, event), {
            source: "project-app:fallback",
            projectId: descriptor.id,
            trace: childEventTrace(event),
          });
          const trace = childEventTrace(event);
          opts.bus.emit({
            type: "handler.workflow_dispatched",
            source: "project-app-loader",
            owner: `agent:${descriptor.owner}`,
            data: {
              handler: "project-owner-fallback",
              workflow: "owner-session",
              source: descriptor.owner,
              projectId: descriptor.id,
              workflowRunId: sessionId,
              status: "started",
              eventType: event.type,
            },
            ...(trace ? { trace } : {}),
          } as AgentEvent);
          closeInbox("owner-fallback-session");
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

export async function installProjectApps(
  opts: ProjectAppLoaderOptions,
): Promise<{ installed: ProjectAppDescriptor[]; entries: number }> {
  const installed: ProjectAppDescriptor[] = [];
  let entries = 0;
  const activeCronAppIds = new Map<Cron, Set<string>>();

  for (const appDir of listProjectAppDirs(opts.projectsRoot)) {
    const app = await loadProjectApp(appDir);
    const id = typeof app.id === "string" && app.id.trim() ? app.id.trim() : appIdFromDir(appDir);
    const descriptor: ProjectAppDescriptor = {
      id,
      appDir,
      projectDir: domainProjectDir(opts.projectsRoot, appDir, id, app),
      owner: configuredProjectAppOwner(app, appDir),
      app,
    };

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
    entries += installWorkflowHandlers(opts, cron, descriptor);
    entries += installTaskRoutes(opts, cron, descriptor);
    entries += installSchedules(opts, cron, descriptor);
    installed.push(descriptor);
  }

  pruneProjectAppNames(projectAppWorkflowSyntheticNamesByCron, opts.agentCrons, activeCronAppIds);
  pruneProjectAppNames(projectAppTaskRouteSyntheticNamesByCron, opts.agentCrons, activeCronAppIds);
  pruneProjectAppNames(projectAppScheduleSyntheticNamesByCron, opts.agentCrons, activeCronAppIds);

  if (installed.length > 0 || appRouterDescriptorsByBus.has(opts.bus)) {
    attachAppEventRouter(opts, installed);
  }

  return { installed, entries };
}

function hashFile(path: string): string {
  try {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  } catch {
    return "";
  }
}

function projectAppManifestFingerprint(projectsRoot: string): string {
  const parts: string[] = [];
  for (const appDir of listProjectAppDirs(projectsRoot)) {
    const tsPath = join(appDir, "app.ts");
    const jsPath = join(appDir, "app.js");
    const manifestPath = existsSync(tsPath) ? tsPath : jsPath;
    parts.push(`${appDir}\t${manifestPath}\t${hashFile(manifestPath)}`);
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
  let lastFingerprint = projectAppManifestFingerprint(opts.projectsRoot);

  const scanNow = async (): Promise<boolean> => {
    if (closed || inFlight) return false;
    const nextFingerprint = projectAppManifestFingerprint(opts.projectsRoot);
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
