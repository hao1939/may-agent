import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import type { SubagentManager } from "../../lib/index.js";
import type { CronEntry } from "../../lib/cron-tool.js";
import type { EventEnvelope } from "../../lib/handler-context.js";
import { importRuntimeModule } from "../../lib/runtime-import.js";
import { Cron } from "../cron.js";
import type { AgentEvent, EventBus } from "../event-bus.js";

type EventSelector =
  | string
  | {
      type: string;
      project?: string;
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
    event: Record<string, unknown>;
  }>;
  workflowHandlers?: Array<{
    name: string;
    enabled?: boolean;
    description?: string;
    intervalMs?: number;
    offsetMs?: number;
    maxConcurrentTriggers?: number;
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
  onEvent?: (ctx: ProjectAppContext, event: Record<string, unknown>) => Promise<unknown> | unknown;
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

function normalizeEvent(event: Record<string, unknown>, defaults: { source: string; owner: string }): EventEnvelope {
  const type = typeof event.type === "string" ? event.type : "project.event";
  const source = typeof event.source === "string" ? event.source : defaults.source;
  const owner = typeof event.owner === "string" ? event.owner : defaults.owner;
  const timestamp = typeof event.timestamp === "number" ? event.timestamp : Date.now();
  const data = isRecord(event.data)
    ? event.data
    : Object.fromEntries(
        Object.entries(event).filter(
          ([key]) => !["type", "source", "owner", "timestamp", "urgency", "ttl_ms"].includes(key),
        ),
      );
  return { type, source, owner, timestamp, data };
}

function flattenEvent(event: AgentEvent): Record<string, unknown> {
  const record = event as unknown as Record<string, unknown>;
  const data = isRecord(record.data) ? record.data : {};
  return { ...data, ...record, data };
}

function projectValue(event: Record<string, unknown>): string {
  const direct = event.project ?? event.projectId;
  if (typeof direct === "string") return direct;
  const path = event.projectPath;
  if (typeof path === "string") {
    const normalized = path.replace(/\\/g, "/");
    const tail = normalized.split("/").filter(Boolean).pop() ?? "";
    return tail.endsWith(".app") ? tail.slice(0, -".app".length) : tail;
  }
  return "";
}

function matchesSelector(selector: EventSelector, event: Record<string, unknown>, appId: string): boolean {
  if (typeof selector === "string") return event.type === selector;
  if (event.type !== selector.type) return false;
  if (selector.project && projectValue(event) !== selector.project) return false;
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
    (app.workflowHandlers ?? []).some((handler) => handler.enabled !== false && (handler.on ?? []).includes(eventType))
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

function installWorkflowHandlers(cron: Cron, descriptor: ProjectAppDescriptor): number {
  let count = 0;
  const currentNames = new Set<string>();
  for (const handler of descriptor.app.workflowHandlers ?? []) {
    currentNames.add(handler.name);
    const workflow = handler.handler;
    const entry: CronEntry = {
      name: handler.name,
      enabled: handler.enabled !== false,
      description: handler.description,
      intervalMs: handler.intervalMs,
      offsetMs: handler.offsetMs,
      maxConcurrentTriggers: handler.maxConcurrentTriggers,
      on: handler.on ?? [],
      context: handler.context,
      agent: workflow.agent ?? descriptor.owner,
      handler: {
        workflow: workflow.workflow,
        agent: workflow.agent ?? descriptor.owner,
        projectId: workflow.projectId ?? descriptor.id,
        includeEvent: workflow.includeEvent,
        task: workflow.task,
        timeoutMs: workflow.timeoutMs,
      },
    };
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
    const entryName = `${descriptor.id}-${schedule.id}`;
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
      const envelope = normalizeEvent(schedule.event, {
        source: `project-app:${descriptor.id}:schedule:${schedule.id}`,
        owner: `agent:${descriptor.owner}`,
      });
      opts.bus.emit(envelope as unknown as AgentEvent);
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
  opts.bus.subscribe((rawEvent) => {
  const event = flattenEvent(rawEvent);
    for (const descriptor of appRouterDescriptorsByBus.get(opts.bus) ?? []) {
      if (!shouldOfferToApp(descriptor.app, event, descriptor.id, descriptor.owner)) continue;
      const ownerMetricFeedback = isOwnerMetricFeedbackForApp(event, descriptor.owner);
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
          const result = descriptor.app.onEvent ? await descriptor.app.onEvent(ctx, event) : undefined;
          if (result !== undefined) return;
          if (hasExplicitWorkflowHandler(descriptor.app, event.type)) return;
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
    const cron = ensureOwnerCron(opts, descriptor);
    const activeAppIds = activeCronAppIds.get(cron) ?? new Set<string>();
    activeAppIds.add(descriptor.id);
    activeCronAppIds.set(cron, activeAppIds);
    entries += installWorkflowHandlers(cron, descriptor);
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
