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
import { Cron } from "../cron.js";
import type { AgentEvent, DeliveryResult, EventBus } from "../event-bus.js";

type EventUrgency = "low" | "normal" | "high" | "immediate";

type EventTarget = {
  project?: string;
  taskId?: string;
  owner?: string;
  sessionId?: string;
  human?: boolean;
};

type AppEvent = {
  type?: string;
  target?: EventTarget;
  source?: string;
  owner?: string;
  urgency?: EventUrgency;
  ttlMs?: number;
  ttl_ms?: number;
  timestamp?: number;
  data?: Record<string, unknown>;
  params?: Record<string, unknown>;
  [key: string]: unknown;
};

type EventSelector =
  | string
  | {
      type: string;
      target?: EventTarget;
      project?: string;
      owner?: string;
      urgency?: EventUrgency;
      actions?: string[];
      metricIds?: string[];
    };

type ProjectAppContext = {
  projectPath(path: string): string;
  appPath(path: string): string;
  readJson<T = unknown>(path: string): Promise<T>;
  importModule<T = Record<string, unknown>>(path: string): Promise<T>;
  startSession(input: { agent: string; task: string; timeoutMs?: number }): unknown;
  emit(event: Record<string, unknown>): unknown;
  noop(reason: string): unknown;
};

type ProjectApp = {
  id?: string;
  version?: number;
  owner?: string;
  workspace?: {
    localPath?: string;
  };
  schedules?: Array<{
    id: string;
    enabled?: boolean;
    intervalMs?: number;
    emits?: AppEvent[];
    event?: AppEvent;
  }>;
  workflowHandlers?: Array<{
    name: string;
    enabled?: boolean;
    description?: string;
    maxConcurrentTriggers?: number;
    accepts?: EventSelector[];
    on?: string[];
    handler: {
      workflow: string;
      agent?: string;
      projectId?: string;
      includeEvent?: boolean;
      task: string;
      timeoutMs?: number;
    };
    context?: string[];
  }>;
  events?: EventSelector[];
  onEvent?:
    | ((ctx: ProjectAppContext, event: Record<string, unknown>) => Promise<unknown> | unknown)
    | { kind: "generated-workflow-handlers"; handlers?: unknown[] };
};

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
   * Called when an app's owner agent is not yet registered.
   * The app brings its own agent — this callback registers it from the
   * project-local agent.json. Returns true if registration succeeded.
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
  const projectJson = readJsonObject(join(descriptor.appDir, "project.json"));
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
  "urgency",
  "ttlMs",
  "ttl_ms",
  "target",
  "data",
]);

function normalizeEvent(event: AppEvent, defaults: { source: string; owner: string }): EventEnvelope {
  const type = typeof event.type === "string" ? event.type : "project.event";
  const source = typeof event.source === "string" ? event.source : defaults.source;
  const owner = typeof event.owner === "string" ? event.owner : defaults.owner;
  const timestamp = typeof event.timestamp === "number" ? event.timestamp : Date.now();
  const urgency = typeof event.urgency === "string" ? event.urgency : undefined;
  const ttlMs =
    typeof event.ttl_ms === "number" ? event.ttl_ms : typeof event.ttlMs === "number" ? event.ttlMs : undefined;
  const target = isRecord(event.target) ? (event.target as EventTarget) : undefined;
  const flatPayload = Object.fromEntries(Object.entries(event).filter(([key]) => !envelopeFieldNames.has(key)));
  const data = {
    ...(isRecord(event.data) ? event.data : {}),
    ...flatPayload,
  };
  if (target?.project && typeof data.project !== "string") data.project = target.project;
  if (target?.taskId && typeof data.taskId !== "string") data.taskId = target.taskId;
  if (target?.taskId && typeof data.task_id !== "string") data.task_id = target.taskId;
  if (target && !isRecord(data.target)) data.target = target;
  return {
    type,
    source,
    owner,
    timestamp,
    ...(urgency ? { urgency: urgency as EventEnvelope["urgency"] } : {}),
    ...(typeof ttlMs === "number" ? { ttl_ms: ttlMs } : {}),
    ...(target ? { target } : {}),
    data,
  };
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
  if (selector.owner && ownerAgentValue(event) !== selector.owner.replace(/^agent:/, "")) return false;
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
  return handler.accepts ?? handler.on ?? [];
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

function ownerAgentValue(event: Record<string, unknown>): string {
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
  return isMetricFeedbackEvent(event) && ownerAgentValue(event) === appOwner;
}

function shouldOfferToApp(app: ProjectApp, event: Record<string, unknown>, appId: string, appOwner: string): boolean {
  if ((app.events ?? []).some((selector) => matchesSelector(selector, event, appId))) return true;
  if (isOwnerMetricFeedbackForApp(event, appOwner)) return true;
  return typeof event.type === "string" && event.type.startsWith("project.") && isProjectScopedForApp(event, appId);
}

function hasExplicitWorkflowHandler(app: ProjectApp, eventType: unknown): boolean {
  return (
    typeof eventType === "string" &&
    (app.workflowHandlers ?? []).some(
      (handler) => handler.enabled !== false && handlerAcceptedEventTypes(handler).includes(eventType),
    )
  );
}

function makeContext(opts: ProjectAppLoaderOptions, descriptor: ProjectAppDescriptor): ProjectAppContext {
  return {
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

const projectAppWorkflowSyntheticNamesByCron = new WeakMap<Cron, Map<string, Set<string>>>();
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
      } as AgentEvent);
      // When the workflow did not complete successfully (blocked, escalated,
      // interrupted), throw so cron's .catch() path fires. This triggers
      // handler.failed + exponential backoff in drainQueuedEventTrigger,
      // preventing tight error→drain→error cascades for opCount=0 session
      // errors that runWorkflowDirect resolves instead of rejecting.
      if (result.type !== "done") {
        const reason = result.type === "blocked" ? (result as { reason?: string }).reason : result.type;
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
      const events = schedule.emits ?? (schedule.event ? [schedule.event] : []);
      for (const event of events) {
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
  opts.bus.subscribe((rawEvent): DeliveryResult | void => {
    const event = flattenEvent(rawEvent);
    let accepted: DeliveryResult | undefined;
    for (const descriptor of appRouterDescriptorsByBus.get(opts.bus) ?? []) {
      if (!shouldOfferToApp(descriptor.app, event, descriptor.id, descriptor.owner)) continue;
      const ownerMetricFeedback = isOwnerMetricFeedbackForApp(event, descriptor.owner);
      const hasAppEventHandler = typeof descriptor.app.onEvent === "function";
      const hasWorkflowHandler = hasExplicitWorkflowHandler(descriptor.app, event.type);
      if (hasWorkflowHandler) continue;
      const shouldOwnerFallback =
        !hasWorkflowHandler && (isProjectScopedForApp(event, descriptor.id) || ownerMetricFeedback);
      if (hasAppEventHandler) {
        accepted ??= {
          accepted: true,
          by: `project-app:${descriptor.id}`,
          route: "direct",
          note: "project app onEvent accepted",
        };
      } else if (shouldOwnerFallback) {
        accepted ??= {
          accepted: true,
          by: `project-app:${descriptor.id}:owner-fallback`,
          route: "direct",
          note: "project app owner fallback session queued",
        };
      }
      if (ownerMetricFeedback) {
        opts.bus.emit({
          type: "metric.feedback.routed",
          source: "project-app-loader",
          owner: `agent:${descriptor.owner}`,
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
          if (result !== undefined) return;
          if (!isProjectScopedForApp(event, descriptor.id) && !ownerMetricFeedback) return;

          const sessionId = opts.manager.runAgent(descriptor.owner, ownerFallbackTask(descriptor, event), {
            source: "project-app:fallback",
            projectId: descriptor.id,
          });
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
          } as AgentEvent);
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
    return accepted;
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
    if (!opts.manager.hasAgent(descriptor.owner)) {
      // App brings its own agent — try to register from local agent.json
      const registered = opts.registerOwnerAgent ? await opts.registerOwnerAgent(descriptor.owner, appDir) : false;
      if (!registered) {
        opts.bus.emit({
          type: "info",
          message: `[project-app] Skipping ${id}: owner agent "${descriptor.owner}" not registered and local registration failed`,
        });
        continue;
      }
    }
    syncProjectReadModel(opts, descriptor);
    const cron = ensureOwnerCron(opts, descriptor);
    const activeAppIds = activeCronAppIds.get(cron) ?? new Set<string>();
    activeAppIds.add(descriptor.id);
    activeCronAppIds.set(cron, activeAppIds);
    entries += installWorkflowHandlers(opts, cron, descriptor);
    entries += installSchedules(opts, cron, descriptor);
    installed.push(descriptor);
  }

  pruneProjectAppNames(projectAppWorkflowSyntheticNamesByCron, opts.agentCrons, activeCronAppIds);
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
