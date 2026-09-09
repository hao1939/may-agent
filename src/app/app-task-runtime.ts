import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { isDeepStrictEqual, promisify } from "node:util";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import {
  chmod as chmodAsync,
  lstat as lstatAsync,
  mkdir as mkdirAsync,
  readFile as readFileAsync,
  readlink as readlinkAsync,
  rm as rmAsync,
  rmdir as rmdirAsync,
  symlink as symlinkAsync,
  writeFile as writeFileAsync,
} from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { Check } from "typebox/value";
import type { SubagentManager } from "../lib/index.js";
import type { SubagentDefinition } from "../lib/types.js";
import type { EventEnvelope } from "../lib/handler-context.js";
import { buildRuntimeCtx } from "../lib/runtime-ctx.js";
import { inspectWorkflowDefinition, runWorkflowDirect, WorkflowHandlerUnavailable } from "../lib/workflow-tool.js";
import { createTaskHandlerAvailability } from "./adapters/executors/handler-availability.js";
import { recoverUnavailableTaskHandlers } from "./core/tasks/handler-recovery.js";
import { getDb, readSessionLastActivityAt, updateSessionDb } from "../lib/requests.js";
import {
  appendSessionMessage,
  markSessionInactive,
  readActiveSessionProcessId,
  readSessionMeta,
  readSessionMessages,
  writeSessionMeta,
} from "../lib/persistence.js";
import { extractFinishParams } from "../lib/agent-result.js";
import { readLatestCheckpoint } from "../lib/tools/checkpoint.js";
import { drainPersistedSessionBashProcessGroups } from "../lib/tools/bash.js";
import { STATE_CHANGING_TOOLS } from "../lib/manager-utils.js";
import { writeSessionResult } from "../lib/artifacts.js";
import {
  admitTaskReconcileResult as admitAppTaskHandlerResult,
  admitTaskVerificationResult as admitAppTaskVerificationResult,
  taskAgentResultSchema as appTaskAgentResultSchema,
  type AppDefinition,
  type AppRequest,
  type AppTaskAttachment,
  type Condition as AppTaskConditionSpec,
  type TaskAction as AppTaskAction,
  type TaskAppDependency,
  type TaskAcceptanceBasis as AppTaskAcceptanceBasis,
  type TaskAttempt,
  type TaskExecutor,
  type TaskExecutorName,
  type TaskIntent as AppTaskIntent,
  type TaskReconcileResult as AppTaskHandlerResult,
  type TaskVerifier as AppTaskVerifier,
} from "@may-agent/sdk";
import { loadProjectReadModel, projectRuntimePaths } from "./app-task-runtime-state.js";
import {
  cacheTaskSnapshots,
  ResourceTaskMutationStaleError,
  type AppTaskContext,
  type TaskTree,
} from "./app-task-store.js";
import { appTaskExecutionPaths, withAppTaskWorkspace, type AppTaskExecutionPaths } from "./app-task-output-paths.js";
import type {
  TaskDetail,
  TaskListOptions,
  TaskOutcomePage,
  TaskOutcomeProjection,
  TaskPage,
} from "@may-agent/sdk/app";
import {
  createRuntimeAppRead,
  listRuntimeTaskOutcomeViews,
  listRuntimeTaskViews,
  readRuntimeTaskView,
} from "./app-read.js";
import { appOwnerReviewEvent } from "./app-input-event.js";
import { getAppInboxItem, listOpenAppInboxItemsByIdempotencyPrefix } from "./app-inbox-store.js";
import { canonicalAppEvent } from "./canonical-app-event.js";
import { appDependencyCatalog } from "./app-dependency-catalog.js";
import {
  projectAppTaskChildPromptContext,
  projectAppTaskReconciliationEvents,
  readAppTaskWaitPromptContext,
} from "./app-task-context.js";
import type { AppRegistry, AppRegistrySnapshot } from "./app-registry.js";
import { AppTaskController, type AppTaskDispatch } from "./app-task-controller.js";
import { AppTaskRecoveryScheduler } from "./app-task-recovery.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { createAppTaskEvents, type AppTaskEmission, type AppTaskEvents } from "./app-task-emitter.js";
import { HostCapacity } from "./host-capacity.js";
import type { AppTaskQueueOptions } from "./app-task-queue.js";
import {
  matchingAppTaskConditionTaskIds,
  matchesAppTaskCondition,
  trackAppTaskConditionEventForTasks,
} from "./app-task-condition-tracker.js";
import {
  childEventTrace,
  eventData,
  EVENT_DELIVERY_RESULT,
  EVENT_ROW_ID,
  type AgentEvent,
  type DeliveryResult,
  type EventBus,
} from "./event-bus.js";
import {
  acknowledgeAppTaskRecoveryAttention,
  assertAppTaskEffectFresh,
  assertAppTaskClaimCurrent,
  hasPendingAppTaskEvidence,
  associateAppTaskSession,
  claimObservedAppTask,
  cancelAppTask,
  completeAppTask,
  deferAppTask,
  listHandlerExecutionFailedAppTasks,
  markAppTaskAttention,
  pendingAppTaskRecoveryAttention,
  isAppTaskActionStaleError,
  isAppTaskConverged,
  observeAppTaskIntent,
  appTaskQueueEntries,
  readAppTaskChildContext,
  readAppTaskLiveSnapshot,
  readAppTaskIntent,
  readAppTaskTrigger,
  readPendingAppTaskTrigger,
  recordAppTaskTrigger,
  releaseHandlerExecutionFailedAppTask,
  repairPreviousRuntimeRecoveryAttention,
  repairUnadmittedAppDependencyWaits,
  repairRunningAppTasksWithoutAttempt,
  recoverableAppTaskAttempts,
  expiredAgentSessionAppTaskAttempt,
  terminalAgentSessionAppTaskClaim,
  releaseInterruptedAppTaskAttempt,
  releaseLateTerminalWorkflowAppTaskAttempt,
  releaseTerminalSessionExpiredAppTaskAttempt,
  releaseStaleAppTaskResult,
  retryFailedAppTask,
  recordAppTaskAttemptSession,
  recordAppTaskAttemptWorkspace,
  appTaskContext,
  renewAppTaskAttemptLease,
  APP_TASK_ATTEMPT_LEASE_DURATION_MS,
  APP_TASK_RECOVERY_OWNER,
  type AppTaskAttemptRecovery,
  type AppTaskChildContext,
  type AppTaskClaim,
  type AppTaskObservationResult,
} from "./app-task-reconciler.js";
import { finalizeAppTaskWorkspace, prepareAppTaskWorkspace, type PreparedTaskWorkspace } from "./app-task-workspace.js";

type ProjectReadModel = {
  id: string;
  path: string;
  name: string;
  owner: string;
  status: string;
  type: string;
  priority: string | null;
};

type AppTaskTiming = {
  dispatch: AppTaskDispatch;
  claimMs?: number;
  contextBuildMs?: number;
  providerStartMs?: number;
  providerMs?: number;
  resultPersistenceMs: number;
  promptBytes?: number;
  attemptId?: string;
  generation?: number;
  outcome?: "completed" | "failed";
};

type AppTaskExecutionObserver = {
  providerStarted(promptBytes: number): void;
  providerFinished(): void;
};

function publishAppTaskTiming(
  opts: AppTaskRuntimeOptions,
  descriptor: AppTaskRuntimeDescriptor,
  taskId: string,
  timing: AppTaskTiming,
): void {
  const finishedAt = Date.now();
  const timer = setTimeout(() => {
    opts.bus.emit({
      type: "project.task.reconcile.profiled",
      source: `app-task:${descriptor.id}:observer`,
      owner: `agent:${descriptor.agent}`,
      target: { appId: descriptor.id },
      data: {
        project: descriptor.id,
        taskId,
        attemptId: timing.attemptId,
        generation: timing.generation,
        lane: timing.dispatch.lane,
        enqueuedAt: timing.dispatch.enqueuedAt,
        startedAt: timing.dispatch.startedAt,
        finishedAt,
        readyWaitMs: timing.dispatch.readyWaitMs,
        claimMs: timing.claimMs,
        contextBuildMs: timing.contextBuildMs,
        providerStartMs: timing.providerStartMs,
        providerMs: timing.providerMs,
        resultPersistenceMs: timing.resultPersistenceMs,
        promptBytes: timing.promptBytes,
        totalMs: Math.max(0, finishedAt - timing.dispatch.startedAt),
        outcome: timing.outcome,
      },
    } as unknown as AgentEvent);
  }, 0);
  timer.unref?.();
}

const APP_TASK_AGENT_TIMEOUT_MS = 15 * 60_000;
const APP_TASK_WORKFLOW_TIMEOUT_MS = 30 * 60_000;
const APP_DEPENDENCY_REVIEW_AFTER_MS = 300_000;

export interface AppTaskRuntimeDescriptor {
  id: string;
  appDir: string;
  projectDir: string;
  agent: string;
  app: AppDefinition;
  reconciliationPaused: boolean;
  /** Canonical Task authority; descriptor construction refuses legacy JSON state. */
  resourceStore: AppTaskResourceStore;
}

export interface AppTaskRuntimeOptions {
  projectsRoot: string;
  projectRoot: string;
  persistDir?: string;
  agentsRoot?: string;
  sharedRoot?: string;
  manager: SubagentManager;
  bus: EventBus;
  hostCapacity: HostCapacity;
  /**
   * Optional execution boundary for one claimed Task attempt. Production uses
   * an isolated process; tests and explicit single-process tools may omit it.
   * The canonical Task resource remains the scheduling and fencing authority.
   */
  executeAttempt?: (input: { appId: string; taskId: string; dispatch: AppTaskDispatch }) => Promise<string[]>;
  /** Optional process boundary for the startup repair pass. */
  executeRecovery?: () => Promise<void>;
  /** Install descriptors and routing without starting local controllers. */
  installControllers?: boolean;
  /** Limit descriptor preparation to exact Apps in a one-attempt worker. */
  taskAppIds?: readonly string[];
  /** The parent publishes read models; execution workers reuse them. */
  syncReadModels?: boolean;
  /** Optional host adapters selected by Task intent. Built-ins remain replaceable. */
  executors?: Readonly<Record<string, TaskExecutor>>;
  appRegistry?: AppRegistry;
  /** Prospective canonical generation used during one coordinated reload. */
  appRegistrySnapshot?: AppRegistrySnapshot;
  /** Final synchronous publication step inside the atomic generation boundary. */
  afterCommit?: (result: { installed: AppTaskRuntimeDescriptor[] }) => void;
  /** Do not execute queued App work until daemon startup has fenced sessions. */
  startAfter?: PromiseLike<void>;
  /** Override only for deterministic recovery tests. */
  drainPersistedBashProcessGroups?: typeof drainPersistedSessionBashProcessGroups;
  /**
   * Called when an app-local agent used by the app is not yet registered.
   * The app brings its own agents; this callback registers one from its
   * project-local agent.json. Returns true if registration succeeded.
   */
  registerLocalAgent?: (agentName: string, appDir: string, agentDir?: string) => Promise<boolean>;
  /** Internal immutable agent catalog published with this definition generation. */
  agentDefinitions?: ReadonlyMap<string, SubagentDefinition>;
}

function captureAgentDefinitions(opts: AppTaskRuntimeOptions): ReadonlyMap<string, SubagentDefinition> | undefined {
  const manager = opts.manager as SubagentManager & {
    agentNames?: () => string[];
    getAgentDefinition?: (name: string) => SubagentDefinition | undefined;
  };
  if (typeof manager.agentNames !== "function" || typeof manager.getAgentDefinition !== "function") return undefined;
  const definitions = new Map<string, SubagentDefinition>();
  for (const name of manager.agentNames()) {
    const definition = manager.getAgentDefinition(name);
    if (definition) definitions.set(name, definition);
  }
  return definitions;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function appTaskSessionBinding(value: unknown): { appId: string; taskId: string; generation: number } | null {
  if (!isRecord(value)) return null;
  const appId = typeof value.appId === "string" ? value.appId.trim().replace(/\.app$/, "") : "";
  const taskId = typeof value.taskId === "string" ? value.taskId.trim() : "";
  const generation = value.generation;
  return appId && taskId && typeof generation === "number" && Number.isInteger(generation) && generation > 0
    ? { appId, taskId, generation }
    : null;
}
function firstNonEmptyString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

type AppTaskSessionScope = {
  binding: { appId: string; taskId: string; generation: number } | null;
  workflowRunId: string | null;
};

function readAppTaskSessionScope(persistDir: string | undefined, sessionId: string): AppTaskSessionScope {
  if (!persistDir) {
    return {
      binding: null,
      workflowRunId: null,
    };
  }
  const meta = readSessionMeta(persistDir, sessionId);
  if (!meta) {
    return {
      binding: null,
      workflowRunId: null,
    };
  }
  return {
    binding: appTaskSessionBinding(meta.taskBinding),
    workflowRunId: firstNonEmptyString(meta.workflowRunId),
  };
}

function workflowWasInterruptedByRestart(persistDir: string | undefined, workflowRunId: string | null): boolean {
  if (!persistDir || !workflowRunId) return false;
  const row = getDb(persistDir)
    .prepare("SELECT status, result_reason FROM workflow_runs WHERE runId = ?")
    .get(workflowRunId) as { status?: unknown; result_reason?: unknown } | undefined;
  return row?.status === "interrupted" && row.result_reason === "Process restarted";
}

function taskRecoverySessionScopesMatch(
  appId: string,
  persistDir: string | undefined,
  failedSessionId: string | undefined,
  successfulSession: AppTaskSessionScope,
): boolean {
  if (!failedSessionId) return false;
  const failed = readAppTaskSessionScope(persistDir, failedSessionId);
  if (failed.binding && successfulSession.binding) {
    return (
      failed.binding.appId === appId &&
      successfulSession.binding.appId === appId &&
      failed.binding.taskId === successfulSession.binding.taskId &&
      failed.binding.generation === successfulSession.binding.generation
    );
  }
  return Boolean(
    failed.workflowRunId && successfulSession.workflowRunId && failed.workflowRunId === successfulSession.workflowRunId,
  );
}

function isProcessAlive(pid: number | undefined): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function hasLiveAppTaskSession(opts: AppTaskRuntimeOptions, sessionId: string): boolean {
  const cleanSessionId = sessionId.trim();
  if (!cleanSessionId) return false;
  if (opts.manager.hasActiveSession(cleanSessionId)) return true;
  if (!opts.persistDir) return false;
  const meta = readSessionMeta(opts.persistDir, cleanSessionId);
  if (!meta || (meta.status !== "running" && meta.status !== "idle")) return false;

  if (meta.detached && isProcessAlive(meta.pid)) return true;
  const leasePid = readActiveSessionProcessId(opts.persistDir, cleanSessionId);
  if (leasePid && isProcessAlive(leasePid)) return true;
  return false;
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

export function inferAppAgent(appDir: string): string {
  const agents = localAgents(appDir);
  if (agents.length === 0) {
    throw new Error(`App ${appDir} has no local agents; cannot infer its default agent`);
  }
  if (agents.length === 1) return agents[0]!.name;

  // Compatibility for Apps created before `agent` became explicit.
  for (const conventional of ["owner", "project-owner"]) {
    const match = agents.find((agent) => agent.dirName === conventional);
    if (match) return match.name;
  }

  throw new Error(
    `App ${appDir} has multiple local agents (${agents.map((agent) => agent.dirName).join(", ")}) and no configured default agent`,
  );
}

export function listAppDirs(projectsRoot: string): string[] {
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

function configuredAppAgent(app: AppDefinition, appDir: string): string {
  const agent = typeof app.agent === "string" ? app.agent.trim() : "";
  if (agent) return agent.replace(/^agent:/, "");
  const legacyOwner = typeof app.owner === "string" ? app.owner.trim() : "";
  if (legacyOwner) return legacyOwner.replace(/^agent:/, "");
  return inferAppAgent(appDir);
}

function domainProjectDir(projectsRoot: string, appDir: string, appId: string, app: AppDefinition): string {
  const localPath = typeof app.workspace?.localPath === "string" ? app.workspace.localPath.trim() : "";
  if (localPath) return resolve(appDir, localPath);
  const sibling = resolve(projectsRoot, appId);
  return existsSync(sibling) ? sibling : appDir;
}

function projectReadModel(projectRoot: string, descriptor: AppTaskRuntimeDescriptor): ProjectReadModel {
  const projectJson = loadProjectReadModel(descriptor.appDir);
  const id = typeof projectJson.id === "string" && projectJson.id.trim() ? projectJson.id.trim() : descriptor.id;
  const owner =
    typeof projectJson.owner === "string" && projectJson.owner.trim()
      ? projectJson.owner.trim().replace(/^agent:/, "")
      : descriptor.agent;
  const status =
    typeof projectJson.status === "string" && projectJson.status.trim() ? projectJson.status.trim() : "active";
  const type = typeof projectJson.type === "string" && projectJson.type.trim() ? projectJson.type.trim() : "agent-app";
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

function syncProjectReadModel(opts: AppTaskRuntimeOptions, descriptor: AppTaskRuntimeDescriptor): void {
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

function requireWorkflowRuntimeOptions(opts: AppTaskRuntimeOptions): {
  persistDir: string;
  agentsRoot: string;
  sharedRoot: string;
} {
  if (!opts.persistDir || !opts.agentsRoot || !opts.sharedRoot) {
    throw new Error("App task workflows require persistDir, agentsRoot, and sharedRoot");
  }
  return {
    persistDir: opts.persistDir,
    agentsRoot: opts.agentsRoot,
    sharedRoot: opts.sharedRoot,
  };
}

function appWorkflowRuntimePaths(
  opts: AppTaskRuntimeOptions,
  descriptor: AppTaskRuntimeDescriptor,
  agentName: string,
): {
  agentsRoot: string;
  workflowDir: string;
  guardsDir: string;
  sharedGuardsDir: string;
} {
  const runtime = requireWorkflowRuntimeOptions(opts);
  const sourceAppDir = join(opts.projectsRoot, basename(descriptor.appDir));
  const appAgentDir = localAgentDir(sourceAppDir, agentName);
  const globalAgentDir = join(runtime.agentsRoot, agentName);
  const agentDir = appAgentDir ?? globalAgentDir;
  return {
    agentsRoot: appAgentDir ? join(sourceAppDir, "agents") : runtime.agentsRoot,
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

/** Canonical durable Task event envelope plus its event-journal identity. */
function canonicalTaskEvent(event: AgentEvent): Record<string, unknown> {
  const canonical = canonicalAppEvent(event) as Record<string, unknown>;
  const envelope = event as unknown as Record<string, unknown>;
  const persistedEventId = (event as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID];
  const timestamp = envelope.timestamp;
  return {
    ...canonical,
    ...(typeof timestamp === "number" && Number.isFinite(timestamp)
      ? { timestamp }
      : typeof timestamp === "string" && timestamp.trim()
        ? { timestamp: timestamp.trim() }
        : {}),
    ...(Number.isInteger(persistedEventId) && Number(persistedEventId) > 0
      ? { eventId: Number(persistedEventId) }
      : {}),
  };
}

function requiredAppAgentNames(descriptor: AppTaskRuntimeDescriptor): string[] {
  return [descriptor.agent];
}

async function ensureAppAgentRegistered(
  opts: AppTaskRuntimeOptions,
  descriptor: AppTaskRuntimeDescriptor,
  agentName: string,
): Promise<boolean> {
  if (opts.manager.hasAgent(agentName)) return true;

  const agentDir = localAgentDir(join(opts.projectsRoot, basename(descriptor.appDir)), agentName);
  const registered = opts.registerLocalAgent
    ? await opts.registerLocalAgent(agentName, descriptor.appDir, agentDir)
    : false;

  return registered || opts.manager.hasAgent(agentName);
}

type TaskCapabilityRun = {
  handlerResult: NormalizedTaskHandlerResult;
  runId: string | null;
  /** Live Task events incorporated into this attempt's candidate result. */
  acceptedLiveEventIds?: number[];
  verifier?: { name: string; sourcePath: string; verify: AppTaskVerifier };
  unavailable?: boolean;
  executionFailed?: boolean;
  /** The workflow deliberately stopped; repeating it is not transport recovery. */
  handlerBlocked?: true;
  workspacePreparationFailed?: boolean;
};

type WorkflowCapability = {
  workflow: string;
  agent?: string;
  task: string;
};

type NormalizedTaskHandlerResult = {
  /** `error` is an attempt/runtime outcome, never a valid handler decision. */
  state: "converged" | "waiting" | "needs-agent" | "error";
  /** A rejected contract needs correction, not a transport retry. Host-only. */
  resultRejected?: true;
  summary: string;
  response?: string;
  result?: Record<string, unknown>;
  evidence: string[];
  actions: AppTaskAction[];
  conditions?: AppTaskConditionSpec[];
  dependencies?: TaskAppDependency[];
};

export function normalizeTaskHandlerResult(
  output: unknown,
  fallback: { type: "done" | "blocked"; summary: string; runId: string | null },
  options: {
    allowNeedsAgent?: boolean;
    defaultParentId?: string;
    rootParentAliases?: string[];
    validateAction?: (action: AppTaskAction) => string | null;
    validateCondition?: (condition: AppTaskConditionSpec) => string | null;
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
  const admission = admitAppTaskHandlerResult(output, {
    allowNeedsAgent: options.allowNeedsAgent ?? true,
    defaultParentId: options.defaultParentId ?? "project",
    rootParentAliases: options.rootParentAliases,
  });
  if (!admission.ok) {
    return {
      state: "error",
      resultRejected: true,
      summary: `Handler result was rejected: ${admission.error}`,
      evidence: fallback.runId ? [`workflow-run:${fallback.runId}`] : [],
      actions: [],
    };
  }
  const actions = admission.result.actions ?? [];
  if (options.validateAction) {
    for (let index = 0; index < actions.length; index += 1) {
      const problem = options.validateAction(actions[index]!);
      if (problem) {
        return {
          state: "error",
          resultRejected: true,
          summary: `Handler result was rejected: actions[${index}] ${problem}`,
          evidence: fallback.runId ? [`workflow-run:${fallback.runId}`] : [],
          actions: [],
        };
      }
    }
  }
  const conditions = admission.result.conditions ?? [];
  if (options.validateCondition) {
    for (let index = 0; index < conditions.length; index += 1) {
      const problem = options.validateCondition(conditions[index]!);
      if (problem) {
        return {
          state: "error",
          resultRejected: true,
          summary: `Handler result was rejected: conditions[${index}] ${problem}`,
          evidence: fallback.runId ? [`workflow-run:${fallback.runId}`] : [],
          actions: [],
        };
      }
    }
  }
  return {
    ...admission.result,
    actions,
  };
}

type PersistedTerminalAgentResultConsumption = {
  claim: AppTaskClaim;
  state: "converged" | "waiting";
  summary: string;
  response?: string;
  evidence: string[];
  actionsApplied: string[];
  reconcileTaskIds: string[];
};

function readPersistedTerminalAgentResult(persistDir: string | undefined, sessionId: string): unknown {
  if (!persistDir) return undefined;
  try {
    const artifact = JSON.parse(readFileSync(join(persistDir, "sessions", sessionId, "result.json"), "utf8")) as {
      status?: unknown;
      finishParams?: { status?: unknown; result?: unknown };
    };
    if (artifact.status !== "done" || artifact.finishParams?.status !== "success") return undefined;
    return artifact.finishParams.result;
  } catch {
    return undefined;
  }
}

export function consumePersistedTerminalAgentResult(input: {
  persistDir?: string;
  config: AppTaskContext;
  descriptor: AppTaskRuntimeDescriptor;
  taskId: string;
  sessionId: string;
  onRejected?: (error: unknown) => void;
}): PersistedTerminalAgentResultConsumption | null {
  const raw = readPersistedTerminalAgentResult(input.persistDir, input.sessionId);
  if (raw === undefined) return null;
  const claim = terminalAgentSessionAppTaskClaim(input.config, input.taskId, input.sessionId);
  if (!claim) return null;
  const defaultParentId = input.config.resourceStore.rootTaskId();
  if (!defaultParentId) return null;
  try {
    const result = normalizeTaskHandlerResult(
      raw,
      {
        type: "done",
        summary: `Recovered terminal agent result from session ${input.sessionId}`,
        runId: input.sessionId,
      },
      {
        allowNeedsAgent: false,
        defaultParentId,
        rootParentAliases: [input.descriptor.id, basename(input.descriptor.projectDir)],
        validateAction: input.descriptor.app.tasks?.validateAction,
        validateCondition: input.descriptor.app.tasks?.validateCondition,
      },
    );
    if (result.state === "converged") {
      const applied = completeAppTask(input.config, claim, {
        summary: result.summary,
        response: result.response,
        evidence: result.evidence,
        actions: result.actions,
        acceptanceBasis: { method: "agent-judgment", evidence: result.evidence },
      });
      if (applied.status !== "applied") return null;
      return {
        claim,
        state: "converged",
        summary: result.summary,
        ...(result.response ? { response: result.response } : {}),
        evidence: result.evidence,
        actionsApplied: applied.actionsApplied,
        reconcileTaskIds: applied.dependentTaskIds,
      };
    }
    if (result.state === "waiting") {
      const applied = deferAppTask(input.config, claim, {
        disposition: "waiting",
        summary: result.summary,
        response: result.response,
        result: result.result,
        evidence: result.evidence,
        actions: result.actions,
        conditions: result.conditions,
      });
      if (applied.status !== "applied") return null;
      return {
        claim,
        state: "waiting",
        summary: result.summary,
        evidence: result.evidence,
        actionsApplied: applied.actionsApplied,
        reconcileTaskIds: applied.reconcileTaskIds,
      };
    }
  } catch (error) {
    input.onRejected?.(error);
  }
  return null;
}

async function executeTaskCapability(input: {
  opts: AppTaskRuntimeOptions;
  descriptor: AppTaskRuntimeDescriptor;
  attempt: TaskAttempt;
  taskEvents: AppTaskEvents;
  capability: WorkflowCapability;
  intent: AppTaskIntent;
  claim: AppTaskClaim;
  defaultParentId: string;
  executionPaths: AppTaskExecutionPaths;
  declaredOutputPaths: string[];
  childContext: AppTaskChildContext;
  taskSnapshot: ReturnType<typeof readAppTaskLiveSnapshot>;
  event?: EventEnvelope;
  fallbackReason?: string;
  observer?: AppTaskExecutionObserver;
}): Promise<TaskCapabilityRun> {
  const { opts, descriptor, capability, intent, claim, event } = input;
  const reconciliationEvents = input.attempt.events;
  const runtime = requireWorkflowRuntimeOptions(opts);
  const agentName = capability.agent ?? claim.agent;
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
        agent: claim.agent,
        handler: claim.handler,
        mode: claim.mode,
        outcome: intent.outcome,
        acceptance: intent.acceptance,
        input: intent.input ?? {},
        children: projectAppTaskChildPromptContext(input.childContext),
        waits: input.attempt.waits,
        paths: input.executionPaths,
        declaredOutputs: input.declaredOutputPaths,
        fallbackReason: input.fallbackReason ?? null,
      },
      null,
      2,
    ),
    "```",
    ...(reconciliationEvents.items.length
      ? ["", "## New Events", "```json", JSON.stringify(reconciliationEvents, null, 2), "```"]
      : []),
  ].join("\n");

  opts.bus.emit({
    type: "handler.workflow_dispatched",
    source: `agent:${agentName}`,
    owner: `agent:${claim.agent}`,
    target: { appId: descriptor.id },
    data: {
      handler: claim.handler,
      workflow: capability.workflow,
      source: agentName,
      projectId: descriptor.id,
      recoveryOwner: APP_TASK_RECOVERY_OWNER,
      taskId: claim.taskId,
      taskGeneration: claim.generation,
      workflowRunId: null,
      status: "started",
    },
    ...(trace ? { trace } : {}),
  } as AgentEvent);

  let providerStarted = false;
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
    input.observer?.providerStarted(Buffer.byteLength(task));
    providerStarted = true;
    const { result, runId, verifier } = await runWorkflowDirect({
      workflowName: capability.workflow,
      task,
      manager: opts.manager,
      agentDefinitions: opts.agentDefinitions,
      runtimeCtx,
      read: createRuntimeAppRead({
        getDb: runtimeCtx.getDb,
        metrics: runtimeCtx.metrics,
        taskStateConfig: appTaskConfig(descriptor),
      }),
      agentName,
      persistDir: runtime.persistDir,
      workflowDir: paths.workflowDir,
      guardsDir: paths.guardsDir,
      sharedGuardsDir: paths.sharedGuardsDir,
      projectId: descriptor.id,
      taskBinding: {
        appId: descriptor.id,
        taskId: claim.taskId,
        generation: claim.generation,
        attemptId: claim.attemptId,
      },
      recoveryOwner: APP_TASK_RECOVERY_OWNER,
      taskEmitter: input.taskEvents,
      trace,
      executionPaths: input.executionPaths,
      workflowInput: intent.input ?? {},
      reconciliation: {
        appId: descriptor.id,
        taskId: claim.taskId,
        generation: claim.generation,
        resourceVersion: claim.resourceVersion,
        agent: claim.agent,
        owner: claim.agent,
        mode: claim.mode,
        outcome: intent.outcome,
        acceptance: intent.acceptance,
        input: intent.input ?? {},
        children: {
          live: input.childContext.live.map(({ phase, ...child }) => ({
            ...child,
            status: phase === "converged" ? "done" : phase,
          })),
          completed: input.childContext.completed.map((child) => ({
            ...child,
            status: "done" as const,
          })),
        },
        taskSnapshot: {
          live: input.taskSnapshot.live.map(({ phase, ...task }) => ({
            ...task,
            status: phase === "converged" ? "done" : phase,
          })),
          truncated: input.taskSnapshot.truncated,
        },
        events: reconciliationEvents,
      },
      executionTimeoutMs: APP_TASK_WORKFLOW_TIMEOUT_MS,
      signal: input.attempt.signal,
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
        allowNeedsAgent: true,
        defaultParentId: input.defaultParentId,
        rootParentAliases: [input.descriptor.id, basename(input.descriptor.projectDir)],
        validateAction: input.descriptor.app.tasks?.validateAction,
        validateCondition: input.descriptor.app.tasks?.validateCondition,
      },
    );
    // A deliberate blocker is not a transport retry, but its diagnostic
    // context must remain visible to the same Task and its parent. Keep one
    // bounded evidence entry; the full context remains on the workflow run.
    if (result.type === "blocked" && result.context !== undefined) {
      const context = JSON.stringify(result.context);
      handlerResult.evidence.push(
        Buffer.byteLength(context, "utf8") <= 8192
          ? `workflow-blocker-context:${context}`
          : `workflow-blocker-context:see workflow-run:${runId} (exceeds 8192-byte Task evidence bound)`,
      );
    }
    opts.bus.emit({
      type: "handler.workflow_dispatched",
      source: `agent:${agentName}`,
      owner: `agent:${claim.agent}`,
      target: { appId: descriptor.id },
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
      ...(!done ? { handlerBlocked: true as const } : {}),
      ...(verifier
        ? {
            verifier: {
              ...verifier,
              verify: verifier.verify as AppTaskVerifier,
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
      owner: `agent:${claim.agent}`,
      target: { appId: descriptor.id },
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
      ...(!unavailable ? { executionFailed: true } : {}),
    };
  } finally {
    if (providerStarted) input.observer?.providerFinished();
  }
}

async function runTaskCapability(
  input: Omit<Parameters<typeof executeTaskCapability>[0], "attempt" | "taskEvents">,
): Promise<TaskCapabilityRun> {
  return runTaskExecutorAttempt({
    opts: input.opts,
    descriptor: input.descriptor,
    claim: input.claim,
    executionPaths: input.executionPaths,
    declaredOutputPaths: input.declaredOutputPaths,
    childContext: input.childContext,
    ...(input.event ? { event: input.event } : {}),
    execute: (attempt, taskEvents) => executeTaskCapability({ ...input, attempt, taskEvents }),
  });
}

type RuntimeTaskAttempt = {
  attempt: TaskAttempt;
  events: AppTaskEvents;
  acceptedLiveEventIds(): number[];
  close(): void;
};

const MAX_TASK_ROLE_INSTRUCTIONS_BYTES = 48 * 1024;

function taskAttemptRole(opts: AppTaskRuntimeOptions, agent: string): TaskAttempt["role"] {
  const definition = opts.agentDefinitions?.get(agent);
  let instructions = definition?.systemPrompt?.trim() ?? "";
  const identityPath = definition?.agentDir ? join(definition.agentDir, "AGENTS.md") : "";
  if (!instructions && identityPath && existsSync(identityPath)) {
    instructions = readFileSync(identityPath, "utf8").trim();
  }
  if (!instructions) instructions = `Act as the selected May agent ${agent}.`;
  if (Buffer.byteLength(instructions) > MAX_TASK_ROLE_INSTRUCTIONS_BYTES) {
    instructions = `${instructions.slice(0, MAX_TASK_ROLE_INSTRUCTIONS_BYTES)}\n\n[Selected agent instructions truncated by Runtime.]`;
  }
  return { agent, instructions };
}

/** Build the one fenced Task interface shared by every executor adapter. */
function runtimeTaskAttempt(input: {
  opts: AppTaskRuntimeOptions;
  descriptor: AppTaskRuntimeDescriptor;
  claim: AppTaskClaim;
  cwd: string;
  declaredOutputPaths: string[];
  childContext: AppTaskChildContext;
  event?: EventEnvelope;
}): RuntimeTaskAttempt {
  const { opts, descriptor, claim } = input;
  const task = readRuntimeTaskView(
    {
      taskStateConfig: appTaskConfig(descriptor),
    },
    claim.taskId,
  );
  if (!task || task.generation !== claim.generation) {
    throw new ResourceTaskMutationStaleError();
  }
  const events = createAppTaskEvents({
    bus: opts.bus,
    appId: descriptor.id,
    claim,
    ...(input.event ? { parentEvent: input.event as AgentEvent } : {}),
  });
  const subscriptions = new Set<() => void>();
  const acceptedLiveEventIds = new Set<number>();
  const controller = new AbortController();
  let closed = false;
  const unsubscribeCancellation = events.onEvent((incoming) => {
    if (incoming.type !== "app.task.cancelled") return;
    const data = eventData(incoming) as Record<string, unknown>;
    if (data.attemptId !== claim.attemptId) return;
    const reason = typeof data.reason === "string" ? data.reason : "Task was cancelled";
    controller.abort(new Error(reason));
  });
  return {
    events,
    attempt: {
      appId: descriptor.id,
      attemptId: claim.attemptId,
      signal: controller.signal,
      resourceVersion: claim.resourceVersion,
      role: taskAttemptRole(opts, claim.agent),
      task: structuredClone(task),
      cwd: input.cwd,
      declaredOutputPaths: [...input.declaredOutputPaths],
      children: {
        live: input.childContext.live.map(({ phase, ...child }) => ({
          ...structuredClone(child),
          status: phase === "converged" ? "done" : phase,
        })),
        completed: input.childContext.completed.map((child) => ({
          ...structuredClone(child),
          status: "done" as const,
        })),
      },
      waits: structuredClone(
        readAppTaskWaitPromptContext(descriptor.resourceStore, opts.persistDir ? getDb(opts.persistDir) : null, claim.taskId),
      ),
      events: projectAppTaskReconciliationEvents(claim),
      resultSchema: structuredClone(appTaskAgentResultSchema) as unknown as Record<string, unknown>,
      async publish(localKey, event) {
        if (closed) throw new Error(`Task ${descriptor.id}/${claim.taskId} attempt is closed`);
        const { localKey: _embeddedLocalKey, source: _source, ...emitted } = event;
        return { eventId: events.publish(localKey, emitted as AppTaskEmission) };
      },
      onEvent(listener) {
        if (closed) throw new Error(`Task ${descriptor.id}/${claim.taskId} attempt is closed`);
        const unsubscribe = events.onEvent((incoming) => {
          const eventId = Number((incoming as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID]);
          listener(canonicalAppEvent(incoming), () => {
            if (closed || !Number.isSafeInteger(eventId) || eventId <= 0) return;
            acceptedLiveEventIds.add(eventId);
          });
        });
        let subscribed = true;
        const stop = () => {
          if (!subscribed) return;
          subscribed = false;
          subscriptions.delete(stop);
          unsubscribe();
        };
        subscriptions.add(stop);
        return stop;
      },
    },
    acceptedLiveEventIds: () => [...acceptedLiveEventIds].sort((left, right) => left - right),
    close() {
      if (closed) return;
      closed = true;
      unsubscribeCancellation();
      for (const unsubscribe of [...subscriptions]) unsubscribe();
    },
  };
}

export function admitTaskAppDependencies(input: {
  opts: AppTaskRuntimeOptions;
  descriptor: AppTaskRuntimeDescriptor;
  claim: AppTaskClaim;
  dependencies: TaskAppDependency[];
  existingConditions?: AppTaskConditionSpec[];
  acceptedLiveEventIds?: number[];
}): AppTaskConditionSpec[] {
  const dependencyIds = new Set<string>();
  for (const dependency of input.dependencies) {
    if (dependencyIds.has(dependency.id)) {
      throw new Error(`Task result declares App dependency ${dependency.id} more than once`);
    }
    dependencyIds.add(dependency.id);
    assertInstalledAppDependency(input.opts, input.descriptor.id, dependency);
  }

  const existing = (input.existingConditions ?? []).flatMap((condition) => {
    if (condition.type !== "app.dependency.completed" || !condition.id.startsWith("app-request:")) return [];
    const requestId = condition.subject.startsWith("id:") ? condition.subject.slice("id:".length) : "";
    if (!requestId || condition.id !== `app-request:${requestId}`) return [];
    const item = input.opts.persistDir ? getAppInboxItem(getDb(input.opts.persistDir), requestId) : null;
    return [{ condition, requestId, item }];
  });
  const matchedExisting = new Set<string>();
  const matches = new Map<string, (typeof existing)[number]>();
  const requestLineagePrefix = `task-dependency:${input.descriptor.id}:${input.claim.taskId}:${input.claim.generation}:`;
  const detachedOpenByApp = new Map<string, ReturnType<typeof listOpenAppInboxItemsByIdempotencyPrefix>>();
  const detachedOpenFor = (appId: string) => {
    const cached = detachedOpenByApp.get(appId);
    if (cached) return cached;
    const items = input.opts.persistDir
      ? listOpenAppInboxItemsByIdempotencyPrefix(getDb(input.opts.persistDir), {
          appId,
          sourceAppId: input.descriptor.id,
          prefix: requestLineagePrefix,
        })
      : [];
    detachedOpenByApp.set(appId, items);
    return items;
  };
  const detachedMatch = (item: ReturnType<typeof detachedOpenFor>[number]) => ({
    requestId: item.id,
    item,
    condition: {
      id: `app-request:${item.id}`,
      type: "app.dependency.completed",
      subject: `id:${item.id}`,
      expected: { field: "status", equals: "done" },
      owner: `app:${item.appId}`,
      reviewAfterMs: APP_DEPENDENCY_REVIEW_AFTER_MS,
    } satisfies AppTaskConditionSpec,
  });

  for (const dependency of input.dependencies) {
    const direct = existing.filter(
      ({ condition, requestId }) =>
        dependency.id === requestId || dependency.id === condition.id || dependency.id === `app-request:${requestId}`,
    );
    const exact = existing.filter(
      ({ item }) =>
        item &&
        item.appId === dependency.appId &&
        item.targetTaskId === dependency.taskId &&
        isDeepStrictEqual(item.input, dependency.input),
    );
    const detachedRequestId = dependency.id.replace(/^app-request:/, "");
    const detachedItem =
      direct.length === 0 && exact.length === 0 && input.opts.persistDir
        ? getAppInboxItem(getDb(input.opts.persistDir), detachedRequestId)
        : null;
    const detachedById =
      detachedItem &&
      detachedItem.status !== "done" &&
      detachedItem.source.kind === "app" &&
      detachedItem.source.id === input.descriptor.id &&
      detachedItem.idempotencyKey?.startsWith(requestLineagePrefix)
        ? [detachedMatch(detachedItem)]
        : [];
    const detachedByMeaning =
      direct.length === 0 && exact.length === 0 && detachedById.length === 0
        ? detachedOpenFor(dependency.appId)
            .filter(
              (item) => item.targetTaskId === dependency.taskId && isDeepStrictEqual(item.input, dependency.input),
            )
            .map(detachedMatch)
        : [];
    const candidates =
      direct.length > 0
        ? direct
        : exact.length > 0
          ? exact
          : detachedById.length > 0
            ? detachedById
            : detachedByMeaning;
    if (candidates.length > 1) {
      throw new Error(`App dependency ${dependency.id} ambiguously matches multiple open requests`);
    }
    const match = candidates[0];
    if (!match) continue;
    if (match.item && match.item.appId !== dependency.appId) {
      throw new Error(
        `App dependency ${dependency.id} refers to open request ${match.requestId} for App ${match.item.appId}, not ${dependency.appId}`,
      );
    }
    // A create-work request has no original targetTaskId. Once admitted, the
    // inbox records the Task it resolved to in waitingOn. Agents may echo that
    // observed Task while preserving the exact request ID; this is reuse, not
    // authority to retarget or create work.
    const resolvedCreatedTaskMatches = Boolean(
      match.item &&
      match.item.targetTaskId === undefined &&
      match.item.waitingOn?.kind === "task" &&
      match.item.waitingOn.id === dependency.taskId,
    );
    if (match.item && match.item.targetTaskId !== dependency.taskId && !resolvedCreatedTaskMatches) {
      throw new Error(
        `App dependency ${dependency.id} refers to open request ${match.requestId} for Task ${match.item.targetTaskId ?? "new work"}, not ${dependency.taskId ?? "new work"}`,
      );
    }
    if (matchedExisting.has(match.requestId)) {
      throw new Error(`Open App request ${match.requestId} is declared more than once`);
    }
    matchedExisting.add(match.requestId);
    matches.set(dependency.id, match);
  }

  const newDependencies = input.dependencies.filter((dependency) => !matches.has(dependency.id));
  for (const dependency of newDependencies) {
    const unresolvedExisting = existing.find(({ item, requestId }) => !item && !matchedExisting.has(requestId));
    if (unresolvedExisting) {
      throw new Error(
        `Cannot classify App dependency ${dependency.id} while open request ${unresolvedExisting.requestId} is unavailable`,
      );
    }
    const unredeclaredSameApp = existing.filter(
      ({ item, requestId }) => item?.appId === dependency.appId && !matchedExisting.has(requestId),
    );
    if (unredeclaredSameApp.length > 0) {
      throw new Error(
        `App dependency ${dependency.id} would replace open request ${unredeclaredSameApp[0]!.requestId}; redeclare that durable request before adding distinct ${dependency.appId} work`,
      );
    }
    const detachedOpen = detachedOpenFor(dependency.appId).find((item) => !matchedExisting.has(item.id));
    if (detachedOpen) {
      throw new Error(
        `App dependency ${dependency.id} would replace unlinked open request ${detachedOpen.id}; redeclare that durable request before adding distinct ${dependency.appId} work`,
      );
    }
  }
  for (let index = 0; index < newDependencies.length; index += 1) {
    const dependency = newDependencies[index]!;
    const duplicate = newDependencies
      .slice(0, index)
      .find(
        (candidate) =>
          candidate.appId === dependency.appId &&
          candidate.taskId === dependency.taskId &&
          isDeepStrictEqual(candidate.input, dependency.input),
      );
    if (duplicate) {
      throw new Error(
        `App dependencies ${duplicate.id} and ${dependency.id} request the same ${dependency.appId} outcome`,
      );
    }
  }
  if (newDependencies.length > 0) {
    assertAppTaskEffectFresh(appTaskConfig(input.descriptor), input.claim, input.acceptedLiveEventIds);
  }

  const admitted = new Map<string, AppTaskConditionSpec>();
  for (const dependency of newDependencies) {
    const identity = createHash("sha256")
      .update(
        JSON.stringify({
          appId: input.descriptor.id,
          taskId: input.claim.taskId,
          generation: input.claim.generation,
          dependencyId: dependency.id,
          targetAppId: dependency.appId,
          targetTaskId: dependency.taskId,
          targetInput: dependency.input,
        }),
      )
      .digest("hex")
      .slice(0, 24);
    const requestId = `appdep_${identity}`;
    const idempotencyKey = `task-dependency:${input.descriptor.id}:${input.claim.taskId}:${input.claim.generation}:${dependency.id}:${identity}`;
    const requested = input.opts.bus.emit({
      type: "app.input.requested",
      source: `app-task:${input.descriptor.id}`,
      owner: `app:${dependency.appId}`,
      data: {
        requestId,
        appId: dependency.appId,
        ...(dependency.taskId ? { targetTaskId: dependency.taskId } : {}),
        input: dependency.input,
        source: { kind: "app", id: input.descriptor.id },
        idempotencyKey,
      },
    });
    const delivery = requested[EVENT_DELIVERY_RESULT];
    if (!delivery) {
      throw new Error(
        `App dependency ${dependency.id} was not accepted by installed App ${dependency.appId}; the Task remains runnable`,
      );
    }
    admitted.set(dependency.id, {
      id: `app-request:${requestId}`,
      type: "app.dependency.completed",
      subject: `id:${requestId}`,
      expected: { field: "status", equals: "done" },
      owner: `app:${dependency.appId}`,
      reviewAfterMs: APP_DEPENDENCY_REVIEW_AFTER_MS,
    });
  }

  return input.dependencies.map((dependency) => {
    const condition = matches.get(dependency.id)?.condition ?? admitted.get(dependency.id)!;
    return {
      ...condition,
      owner: condition.owner ?? `app:${dependency.appId}`,
      reviewAfterMs: condition.reviewAfterMs ?? APP_DEPENDENCY_REVIEW_AFTER_MS,
    };
  });
}

function openTaskAppDependencyConditions(config: AppTaskContext, taskId: string): AppTaskConditionSpec[] {
  const tree = config.resourceStore.readTaskContext({ taskIds: [taskId] });
  const resource = tree.resources?.[taskId];
  return (resource?.status.conditionIds ?? []).flatMap((conditionId) => {
    const condition = tree.conditions?.[conditionId];
    if (!condition || condition.status.state === "true" || condition.spec.type !== "app.dependency.completed") {
      return [];
    }
    return [{ id: condition.metadata.id, ...structuredClone(condition.spec) }];
  });
}

export function mergeTaskConditions(
  conditions: AppTaskConditionSpec[],
  authoritativeIds: ReadonlySet<string> = new Set(),
): AppTaskConditionSpec[] {
  const merged = new Map<string, AppTaskConditionSpec>();
  for (const condition of conditions) {
    const current = merged.get(condition.id);
    if (current && !isDeepStrictEqual(current, condition)) {
      // Persisted Conditions are the reconciliation authority. An executor may
      // echo different advisory metadata from its bounded prompt, but the
      // observable identity must still match. Retargeting the subject, type, or
      // expected fact remains a conflict rather than silently changing a wait.
      if (
        authoritativeIds.has(condition.id) &&
        current.type === condition.type &&
        current.subject === condition.subject &&
        isDeepStrictEqual(current.expected, condition.expected)
      ) {
        continue;
      }
      throw new Error(`Task result conflicts with existing Condition ${condition.id}`);
    }
    merged.set(condition.id, condition);
  }
  return [...merged.values()];
}

function recoverPendingToolResultsFromTranscript(persistDir: string, sessionId: string): string[] {
  const messages = readSessionMessages(persistDir, sessionId) as any[];
  const last = messages[messages.length - 1] as any;
  if (last?.role !== "assistant" || !Array.isArray(last.content)) return [];

  const pendingToolCalls = last.content.filter((block: any) => {
    if (block?.type !== "toolCall" || typeof block.id !== "string") return false;
    if (block.name === "finish") return false;
    return !messages.some((message) => message?.role === "toolResult" && message.toolCallId === block.id);
  });
  if (pendingToolCalls.length === 0) return [];

  for (const call of pendingToolCalls) {
    const toolName = typeof call.name === "string" ? call.name : "tool";
    const repairText = STATE_CHANGING_TOOLS.has(toolName)
      ? `Tool call result was not persisted before runtime recovery interrupted this orphaned session. ${toolName} may have completed and mutated state; inspect side effects before retrying.`
      : "Tool call result was not persisted before runtime recovery interrupted this orphaned session.";
    appendSessionMessage(persistDir, sessionId, {
      role: "toolResult",
      toolCallId: call.id,
      toolName,
      isError: true,
      content: [{ type: "text", text: repairText }],
      timestamp: Date.now(),
    } as any);
  }

  return pendingToolCalls
    .map((call: any) => (typeof call.name === "string" ? call.name : "tool"))
    .filter((name: string, index: number, names: string[]) => names.indexOf(name) === index);
}

function summarizeInterruptedAgentRecovery(input: {
  meta: { taskBinding?: unknown };
  persistDir: string;
  sessionId: string;
  reason: string;
  repairedPendingTools: string[];
  taskId?: string;
}): { summary: string; taskId: string | null; evidence: string[] } {
  const taskId = input.taskId?.trim() || appTaskSessionBinding(input.meta.taskBinding)?.taskId || null;
  const summary = taskId
    ? `Agent session for ${taskId} was interrupted by runtime recovery before finish() persisted; the original app task was requeued and should be decided by the replacement attempt, not this recovery wrapper.`
    : "Agent session was interrupted by runtime recovery before finish() persisted; the original app task was requeued and should be decided by the replacement attempt, not this recovery wrapper.";
  const checkpoint = readLatestCheckpoint(input.persistDir, input.sessionId);
  const evidence = [
    ...(taskId ? [`task:${taskId}`] : []),
    `session:${input.sessionId}`,
    `artifact:sessions/${input.sessionId}/result.json`,
    `transcript:sessions/${input.sessionId}/session.jsonl`,
    checkpoint
      ? `checkpoint:checkpoints/${input.sessionId}.jsonl#step-${checkpoint.step}:${checkpoint.summary}`
      : `checkpoint:absent:${input.sessionId}`,
    `recovery-reason:${input.reason}`,
    ...(input.repairedPendingTools.length > 0
      ? [`recovered-pending-tools:${input.repairedPendingTools.join(",")}`]
      : []),
  ];
  return { summary, taskId, evidence };
}

function interruptSupersededAgentSession(
  opts: AppTaskRuntimeOptions,
  sessionId: string,
  reason: string,
  taskId?: string,
): void {
  const cleanSessionId = sessionId.trim();
  if (!cleanSessionId) return;
  if (opts.manager.hasActiveSession(cleanSessionId)) {
    opts.manager.cancel(cleanSessionId);
  } else if (hasLiveAppTaskSession(opts, cleanSessionId)) {
    throw new Error(`Cannot supersede session ${cleanSessionId}: its external owner is still live`);
  }

  const meta = opts.persistDir ? readSessionMeta(opts.persistDir, cleanSessionId) : null;

  // Replacement ownership cannot begin while the superseded exact session's
  // shell descendants remain live. Drain durable groups even when session meta
  // is already terminal: a terminal marker cannot prove descendant exit.
  // An unconfirmed drain preserves the durable session and PGID records and
  // stops recovery before terminal artifacts, session.end, attempt release,
  // requeue, or replacement execution.
  const confirmedDrained = opts.persistDir
    ? (opts.drainPersistedBashProcessGroups ?? drainPersistedSessionBashProcessGroups)(opts.persistDir, cleanSessionId)
    : true;
  if (!confirmedDrained) {
    throw new Error(
      `Cannot recover session ${cleanSessionId}: one or more durable bash process groups did not exit after bounded SIGTERM/SIGKILL drain`,
    );
  }
  if (!meta || (meta.status !== "running" && meta.status !== "idle")) return;

  // Capture a completed finish call before repairing genuinely pending tool
  // calls: finish() may be the final transcript entry, and synthesizing an
  // interruption result for it would hide the valid terminal decision.
  const recoveredFinish = opts.persistDir
    ? extractFinishParams(readSessionMessages(opts.persistDir, cleanSessionId) as any[])
    : null;
  const repairedPendingTools = opts.persistDir
    ? recoverPendingToolResultsFromTranscript(opts.persistDir, cleanSessionId)
    : [];
  const interruptedRecovery = summarizeInterruptedAgentRecovery({
    meta,
    persistDir: opts.persistDir!,
    sessionId: cleanSessionId,
    reason,
    repairedPendingTools,
    taskId,
  });
  const persistedFinish = recoveredFinish;
  const recoveredStatus: "done" | "error" | "interrupted" = recoveredFinish
    ? recoveredFinish.status === "failure"
      ? "error"
      : "done"
    : "interrupted";
  const recoveredSummary = persistedFinish?.summary ?? interruptedRecovery.summary;
  const endedAt = Date.now();
  const resultArtifact = writeSessionResult(opts.persistDir!, cleanSessionId, {
    status: recoveredStatus,
    outcome: recoveredStatus,
    ...(recoveredStatus === "interrupted" ? { error: reason } : {}),
    summary: recoveredSummary,
    finishParams: persistedFinish ?? undefined,
    ...(recoveredStatus === "interrupted"
      ? {
          recovery: {
            disposition: "requeued",
            summary: interruptedRecovery.summary,
            evidence: interruptedRecovery.evidence,
          },
        }
      : {}),
    endedAt,
  });
  writeSessionMeta(opts.persistDir!, cleanSessionId, {
    ...meta,
    status: recoveredStatus,
    endedAt,
    ...(recoveredStatus === "interrupted" ? { error: reason } : {}),
  });
  updateSessionDb(opts.persistDir!, cleanSessionId, {
    status: recoveredStatus,
    endedAt,
    ...(recoveredStatus === "interrupted" ? { error: reason } : {}),
    outcome: recoveredSummary,
    lastActivityAt: endedAt,
    resultArtifact,
  });
  markSessionInactive(opts.persistDir!, cleanSessionId);
  opts.bus.emit({
    type: "session.end",
    source: meta.source ?? "app-task-reconciler",
    owner: `agent:${meta.agent}`,
    timestamp: endedAt,
    data: {
      sessionId: cleanSessionId,
      agent: meta.agent,
      outcome: recoveredStatus,
      summary: recoveredSummary,
      ...(persistedFinish ? { finishParams: persistedFinish } : {}),
      ...(recoveredStatus === "interrupted" ? { error: reason } : {}),
      durationMs: Math.max(0, endedAt - meta.startedAt),
      status: recoveredStatus,
      task: meta.task,
      parentSessionId: meta.parentSessionId,
      workflowRunId: meta.workflowRunId,
      projectId: meta.projectId,
      kind: meta.kind,
      requestId: meta.requestId,
      stepLabel: meta.stepLabel,
      opCount: meta.opCount,
      ...(repairedPendingTools.length > 0 ? { recoveredPendingTools: repairedPendingTools } : {}),
    },
  } as AgentEvent);
}

function interruptSupersededObservationSessions(
  opts: AppTaskRuntimeOptions,
  observation: { taskId: string; generation: number; supersededSessionIds?: string[] },
): void {
  for (const sessionId of observation.supersededSessionIds ?? []) {
    interruptSupersededAgentSession(
      opts,
      sessionId,
      `Task ${observation.taskId} advanced to generation ${observation.generation}; the previous reconciliation session is obsolete`,
      observation.taskId,
    );
  }
}

function interruptSupersededActionSessions(opts: AppTaskRuntimeOptions, taskId: string, sessionIds: string[]): void {
  for (const sessionId of sessionIds) {
    interruptSupersededAgentSession(
      opts,
      sessionId,
      `Task ${taskId} applied a reconciliation action that superseded the session's task generation`,
      taskId,
    );
  }
}

type ResidueFileSnapshot =
  | { exists: false }
  | { exists: true; kind: "file"; data: Buffer; mode: number }
  | { exists: true; kind: "symlink"; target: string };

type CanonicalUntrackedResidueGuard = {
  projectDir: string;
  indexPath: string;
  indexData: Buffer;
  indexMode: number;
  dirtyTracked: Map<string, ResidueFileSnapshot>;
  untracked: Map<string, ResidueFileSnapshot>;
};

type PlannedResidueFileRestore = {
  expected: ResidueFileSnapshot;
  restore: ResidueFileSnapshot | "index";
};

const execFileAsync = promisify(execFile);

export type CanonicalAgentResidueCleanupPlan = {
  guard: CanonicalUntrackedResidueGuard;
  expectedIndexData: Buffer;
  restoreIndex: boolean;
  files: Map<string, PlannedResidueFileRestore>;
};

async function gitPathSet(projectDir: string, args: string[]): Promise<Set<string>> {
  const { stdout } = await execFileAsync("git", ["-C", projectDir, ...args], {
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
  return new Set(output.toString("utf8").split("\0").filter(Boolean));
}

async function canonicalUntrackedFiles(projectDir: string): Promise<Set<string>> {
  return gitPathSet(projectDir, ["ls-files", "--others", "--exclude-standard", "--full-name", "-z"]);
}

async function canonicalDirtyTrackedFiles(projectDir: string): Promise<Set<string>> {
  const [modified, staged] = await Promise.all([
    gitPathSet(projectDir, ["ls-files", "--modified", "--deleted", "-z"]),
    gitPathSet(projectDir, ["diff", "--cached", "--name-only", "-z"]),
  ]);
  return new Set([...modified, ...staged]);
}

function safeResiduePath(projectDir: string, relativePath: string): string {
  const absolutePath = resolve(projectDir, relativePath);
  const fromRoot = relative(projectDir, absolutePath);
  if (!fromRoot || fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
    throw new Error(`Refusing to access unsafe agent residue path: ${relativePath}`);
  }
  return absolutePath;
}

async function snapshotResidueFile(projectDir: string, relativePath: string): Promise<ResidueFileSnapshot> {
  const absolutePath = safeResiduePath(projectDir, relativePath);
  let stat;
  try {
    stat = await lstatAsync(absolutePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { exists: false };
    throw error;
  }
  if (stat.isSymbolicLink()) return { exists: true, kind: "symlink", target: await readlinkAsync(absolutePath) };
  return { exists: true, kind: "file", data: await readFileAsync(absolutePath), mode: stat.mode };
}

async function restoreResidueFile(
  projectDir: string,
  relativePath: string,
  snapshot: ResidueFileSnapshot,
): Promise<void> {
  const absolutePath = safeResiduePath(projectDir, relativePath);
  await rmAsync(absolutePath, { recursive: true, force: true });
  if (!snapshot.exists) return;
  await mkdirAsync(dirname(absolutePath), { recursive: true });
  if (snapshot.kind === "symlink") {
    await symlinkAsync(snapshot.target, absolutePath);
    return;
  }
  await writeFileAsync(absolutePath, snapshot.data);
  await chmodAsync(absolutePath, snapshot.mode);
}

function residueSnapshotsEqual(left: ResidueFileSnapshot, right: ResidueFileSnapshot): boolean {
  if (left.exists !== right.exists) return false;
  if (!left.exists || !right.exists) return true;
  if (left.kind !== right.kind) return false;
  if (left.kind === "symlink" && right.kind === "symlink") return left.target === right.target;
  return left.kind === "file" && right.kind === "file" && left.mode === right.mode && left.data.equals(right.data);
}

/**
 * Direct agent attempts are conventionally read-only. When their default
 * workspace is the canonical Git checkout, snapshot its index and residue so
 * agent-created tracked or untracked writes can be rolled back without
 * disturbing dirt that predated the attempt. Workflow task worktrees have a
 * distinct workspaceDir and bypass this guard.
 */
export async function beginCanonicalAgentResidueGuard(
  paths: AppTaskExecutionPaths,
): Promise<CanonicalUntrackedResidueGuard | null> {
  if (paths.workspaceDir !== paths.projectDir) return null;
  try {
    const topLevelResult = await execFileAsync("git", ["-C", paths.projectDir, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
    });
    const topLevel = resolve(topLevelResult.stdout.trim());
    if (topLevel !== resolve(paths.projectDir)) return null;
    const indexResult = await execFileAsync("git", ["-C", paths.projectDir, "rev-parse", "--git-path", "index"], {
      encoding: "utf8",
    });
    const rawIndexPath = indexResult.stdout.trim();
    const indexPath = isAbsolute(rawIndexPath) ? rawIndexPath : resolve(paths.projectDir, rawIndexPath);
    const [dirtyTrackedPaths, untrackedPaths, indexData, indexStat] = await Promise.all([
      canonicalDirtyTrackedFiles(paths.projectDir),
      canonicalUntrackedFiles(paths.projectDir),
      readFileAsync(indexPath),
      lstatAsync(indexPath),
    ]);
    const dirtyTracked = new Map<string, ResidueFileSnapshot>();
    for (const path of dirtyTrackedPaths) {
      dirtyTracked.set(path, await snapshotResidueFile(paths.projectDir, path));
    }
    const untracked = new Map<string, ResidueFileSnapshot>();
    for (const path of untrackedPaths) {
      untracked.set(path, await snapshotResidueFile(paths.projectDir, path));
    }
    return {
      projectDir: paths.projectDir,
      indexPath,
      indexData,
      indexMode: indexStat.mode,
      dirtyTracked,
      untracked,
    };
  } catch {
    return null;
  }
}

export type DeployReceipt = {
  version: 1;
  correlation: string;
  project: string;
  taskId: string;
  artifactSha: string;
  sourceCommit?: string;
  phase: "requested" | "succeeded" | "failed" | "rolled_back";
  requestedAt: string;
  verification: string;
  completedAt?: string;
  loadedArtifactSha?: string;
  health?: "healthy" | "unhealthy";
  /** Retained only when reading older receipts. New receipts do not model event delivery. */
  targetedWake?: boolean;
  duplicateDeploy?: boolean;
  failure?: string;
};

export function readDeployReceiptForTask(projectDir: string, taskId: string): DeployReceipt | null {
  const receiptDir = join(projectDir, ".state", "deploy-receipts");
  if (!existsSync(receiptDir)) return null;
  const receipts: DeployReceipt[] = [];
  for (const name of readdirSync(receiptDir)
    .filter((entry) => entry.endsWith(".json"))
    .sort()
    .reverse()) {
    try {
      const receipt = JSON.parse(readFileSync(join(receiptDir, name), "utf8")) as Partial<DeployReceipt>;
      if (
        receipt.version === 1 &&
        receipt.taskId === taskId &&
        typeof receipt.correlation === "string" &&
        typeof receipt.artifactSha === "string" &&
        ["requested", "succeeded", "failed", "rolled_back"].includes(receipt.phase ?? "")
      ) {
        receipts.push(receipt as DeployReceipt);
      }
    } catch {
      // A concurrent atomic rename or a legacy non-JSON artifact is not a receipt.
    }
  }
  return receipts.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0] ?? null;
}

export function deployReceiptPrompt(projectDir: string, taskId: string): string[] {
  const receipt = readDeployReceiptForTask(projectDir, taskId);
  if (!receipt) {
    return [
      "## Restart-aware deploy receipt",
      "No correlated deploy receipt exists for this task (legacy/absence branch). Do not blindly redeploy. Conservatively inspect the loaded artifact and runtime health; if deployment is still required, use a new correlation and deploy at most once.",
    ];
  }
  const encoded = JSON.stringify(receipt, null, 2);
  if (receipt.phase === "requested") {
    return [
      "## Restart-aware deploy receipt",
      "A correlated deploy is already requested. Do not deploy again. Wait for the supervisor to settle it and perform only the receipt's remaining verification step after a targeted wake.",
      "```json",
      encoded,
      "```",
    ];
  }
  if (receipt.phase === "succeeded") {
    return [
      "## Restart-aware deploy receipt",
      "The correlated deploy succeeded. Do not deploy again. Verify that loadedArtifactSha equals artifactSha, health is healthy, and duplicateDeploy is false; then complete agent reconciliation.",
      "```json",
      encoded,
      "```",
    ];
  }
  return [
    "## Restart-aware deploy receipt",
    `The correlated deploy ended in terminal phase ${receipt.phase}. Do not redeploy this correlation; surface the failure or rollback disposition explicitly.`,
    "```json",
    encoded,
    "```",
  ];
}

/** Exact durable wake that tells Runtime a deployment receipt is relevant. */
export function hasDeployReceiptWake(events: TaskAttempt["events"]): boolean {
  return events.items.some(({ event }) => event.data?.reason === "restart-aware-deploy-receipt");
}

export async function planCanonicalAgentResidueCleanup(
  guard: CanonicalUntrackedResidueGuard | null,
): Promise<CanonicalAgentResidueCleanupPlan | null> {
  if (!guard || !existsSync(guard.indexPath)) return null;

  const [expectedIndexData, dirtyTrackedPaths, untrackedPaths] = await Promise.all([
    readFileAsync(guard.indexPath),
    canonicalDirtyTrackedFiles(guard.projectDir),
    canonicalUntrackedFiles(guard.projectDir),
  ]);
  const currentPaths = new Set([
    ...guard.dirtyTracked.keys(),
    ...guard.untracked.keys(),
    ...dirtyTrackedPaths,
    ...untrackedPaths,
  ]);
  const files = new Map<string, PlannedResidueFileRestore>();
  for (const path of currentPaths) {
    const expected = await snapshotResidueFile(guard.projectDir, path);
    const baseline = guard.dirtyTracked.get(path) ?? guard.untracked.get(path);
    if (baseline) {
      if (!residueSnapshotsEqual(expected, baseline)) files.set(path, { expected, restore: baseline });
    } else if (dirtyTrackedPaths.has(path) || untrackedPaths.has(path)) {
      files.set(path, { expected, restore: untrackedPaths.has(path) ? { exists: false } : "index" });
    }
  }
  return {
    guard,
    expectedIndexData,
    restoreIndex: !expectedIndexData.equals(guard.indexData),
    files,
  };
}

async function restoreResidueFileFromBaselineIndex(
  guard: CanonicalUntrackedResidueGuard,
  relativePath: string,
): Promise<void> {
  const temporaryIndex = `${guard.indexPath}.agent-residue-${process.pid}-${Date.now()}`;
  try {
    await writeFileAsync(temporaryIndex, guard.indexData);
    await chmodAsync(temporaryIndex, guard.indexMode);
    await execFileAsync("git", ["-C", guard.projectDir, "checkout-index", "--force", "--", relativePath], {
      env: { ...process.env, GIT_INDEX_FILE: temporaryIndex },
    });
  } finally {
    await rmAsync(temporaryIndex, { force: true });
  }
}

export async function applyCanonicalAgentResidueCleanup(
  plan: CanonicalAgentResidueCleanupPlan | null,
): Promise<string[]> {
  if (!plan) return [];
  const { guard } = plan;
  const restored: string[] = [];

  for (const [relativePath, filePlan] of plan.files) {
    const current = await snapshotResidueFile(guard.projectDir, relativePath);
    if (!residueSnapshotsEqual(current, filePlan.expected)) continue;
    if (filePlan.restore === "index") {
      await restoreResidueFileFromBaselineIndex(guard, relativePath);
    } else {
      await restoreResidueFile(guard.projectDir, relativePath, filePlan.restore);
    }
    restored.push(`file:${relativePath}`);
    if (filePlan.restore === "index" || filePlan.restore.exists) continue;
    let parent = dirname(safeResiduePath(guard.projectDir, relativePath));
    while (parent !== guard.projectDir) {
      try {
        await rmdirAsync(parent);
      } catch {
        break;
      }
      parent = dirname(parent);
    }
  }

  if (
    plan.restoreIndex &&
    existsSync(guard.indexPath) &&
    (await readFileAsync(guard.indexPath)).equals(plan.expectedIndexData)
  ) {
    await writeFileAsync(guard.indexPath, guard.indexData);
    await chmodAsync(guard.indexPath, guard.indexMode);
    restored.push("index");
  }
  return restored;
}

export async function finishCanonicalAgentResidueGuard(
  guard: CanonicalUntrackedResidueGuard | null,
): Promise<string[]> {
  return applyCanonicalAgentResidueCleanup(await planCanonicalAgentResidueCleanup(guard));
}

export function rejectConvergedDirectAgentResidue(
  result: NormalizedTaskHandlerResult,
  restored: string[],
): NormalizedTaskHandlerResult {
  if (result.state !== "converged" || restored.length === 0) return result;
  return {
    state: "error",
    summary: "Direct-agent convergence was rejected because canonical workspace edits required cleanup",
    evidence: [...result.evidence, ...restored.map((entry) => `agent-residue-restored:${entry}`)],
    actions: [],
  };
}

export const DEPENDENCY_OBSERVATION_AUTHORITY_INSTRUCTION =
  "When a New Event contains an App request with a supplied dependency observation, treat that exact read-only observation (kind, id, status, summary, evidence, response, and result when present) as complete authority for the dependency in this attempt. Decide from it or preserve the responsible App and exact Task boundary; do not inspect Host-private task state, generated task-tree or Kanban projections, or substitute a deeper or different task. This restriction is request-scoped and does not weaken supported diagnostics when no dependency observation was supplied.";

export function hasSuppliedDependencyObservation(events: { items?: readonly unknown[] }): boolean {
  return (events.items ?? []).some((item) => {
    if (!isRecord(item) || !isRecord(item.event)) return false;
    const event = item.event;
    if (event.type !== "app.task.requested" || !isRecord(event.data) || !isRecord(event.data.request)) return false;
    return isRecord(event.data.request.dependency) && Object.keys(event.data.request.dependency).length > 0;
  });
}

function configuredRegistryEntries(opts: AppTaskRuntimeOptions): AppRegistrySnapshot["entries"] {
  return opts.appRegistrySnapshot?.entries ?? opts.appRegistry?.snapshot().entries ?? [];
}

function assertInstalledAppDependency(
  opts: AppTaskRuntimeOptions,
  sourceAppId: string,
  dependency: TaskAppDependency,
): void {
  if (dependency.appId === sourceAppId && !dependency.taskId) {
    throw new Error(
      `App dependency ${dependency.id} cannot create sibling work in its owning App ${sourceAppId}; create a direct child or name an exact existing Task`,
    );
  }
  const registryConfigured = Boolean(opts.appRegistrySnapshot || opts.appRegistry);
  if (!registryConfigured) return;
  const entries = configuredRegistryEntries(opts);
  const target = entries.find(({ definition }) => definition.id === dependency.appId)?.definition;
  if (!target?.task || !target.tasks) {
    throw new Error(`App dependency ${dependency.id} targets unavailable App ${dependency.appId}`);
  }
  if (!Check(target.inputSchema, dependency.input)) {
    throw new Error(`App dependency ${dependency.id} input is not accepted by installed App ${dependency.appId}`);
  }
}

/** Compact agent rules; the finish tool schema enforces field-level detail. */
export function appTaskAgentProtocol(appId: string): string {
  return [
    `You are the agent pursuing one Task goal owned by App ${appId}.`,
    "Keep working through as many internal turns and tool calls as needed to satisfy the task outcome and acceptance. Use current evidence and tools; do not edit Host task storage.",
    "Finish exactly once with finish().result only when the Task is complete or genuinely waiting for something external. The tool schema is authoritative. A successful session without result does not resolve the task.",
    "Return state converged only when current evidence satisfies this task. Include a direct response when a caller is owed one.",
    "Do not finish merely because one useful step or model turn ended.",
    "For App-defined machine-readable state or a domain decision, include result as an object; keep its human explanation in summary. A waiting Task may preserve a current decision there for its next reconciliation.",
    "Return state waiting only for an exact observable Condition, a live direct child, or a typed App dependency. Omit response while waiting; put operational progress in summary. Otherwise keep working now.",
    "For another App outcome, return a stable dependency { id, appId, input }. To continue an exact existing Task in that App, also include taskId. Runtime publishes and correlates it; do not publish app.input.requested yourself.",
    "Choose appId and input.kind from the Installed App catalog in this prompt. Satisfy its requiredData paths and fixedData literals, use dataTypes for any listed field, describe the desired outcome, constraints, and acceptance proof in input.data, and leave Task, workflow, executor, schedule, retry, and session choices to that App.",
    "Required decomposition creates direct children and keeps this task waiting. A successor is independent work after this task already converged. dependsOn expresses execution order.",
    "Task actions must use the schema, expected generations, and real task IDs. Do not mutate the current task with an action; your result advances it. Completed receipts are immutable.",
    "After first acceptance-critical evidence, checkpoint a concise summary, next step, and exact artifact/session paths. Refresh only when those facts change, then finish promptly.",
    "For unresolved human work, give an exact useful response or a bounded wait with reviewAfterMs of at least 60000. Do not expose delivery or Host internals.",
    "Treat new feedback as evidence for this Task. Address the human's actual concern against its goal and Open Waits, preserve a live relevant dependency by identity, and create different work only when the existing Task cannot fulfill the requested outcome.",
    DEPENDENCY_OBSERVATION_AUTHORITY_INSTRUCTION,
  ].join("\n");
}

const MAX_LIVE_TASK_EVENT_TEXT = 8 * 1024;

/** Compact live hint; the same event remains in the next durable Task batch. */
export function liveTaskEventMessage(event: AgentEvent): string {
  const projected = canonicalAppEvent(event);
  const eventId = Number((event as AgentEvent & { [EVENT_ROW_ID]?: number })[EVENT_ROW_ID]);
  const text = JSON.stringify({
    ...(Number.isSafeInteger(eventId) && eventId > 0 ? { eventId } : {}),
    event: projected,
  });
  const bounded = text.length <= MAX_LIVE_TASK_EVENT_TEXT ? text : `${text.slice(0, MAX_LIVE_TASK_EVENT_TEXT - 3)}...`;
  return [
    "A new durable event was addressed to this Task while you were working.",
    "Use it now when relevant; Runtime will also retain it for the next fenced reconciliation pass.",
    bounded,
  ].join("\n");
}

async function executeTaskAgent(input: {
  opts: AppTaskRuntimeOptions;
  descriptor: AppTaskRuntimeDescriptor;
  attempt: TaskAttempt;
  intent: AppTaskIntent;
  claim: AppTaskClaim;
  defaultParentId: string;
  executionPaths: AppTaskExecutionPaths;
  declaredOutputPaths: string[];
  childContext: AppTaskChildContext;
  event?: EventEnvelope;
  fallbackReason?: string;
  observer?: AppTaskExecutionObserver;
}): Promise<TaskCapabilityRun> {
  const { opts, descriptor, intent, claim, event } = input;
  const reconciliationEvents = input.attempt.events;
  const trace = childEventTrace(event);
  const dependencyCatalog = appDependencyCatalog(configuredRegistryEntries(opts), descriptor.id);
  const prompt = [
    appTaskAgentProtocol(descriptor.id),
    "",
    "## Reconciliation Task",
    "```json",
    JSON.stringify(
      {
        appId: descriptor.id,
        taskId: claim.taskId,
        generation: claim.generation,
        resourceVersion: claim.resourceVersion,
        agent: claim.agent,
        mode: claim.mode,
        outcome: intent.outcome,
        acceptance: intent.acceptance,
        input: intent.input ?? {},
        children: projectAppTaskChildPromptContext(input.childContext),
        waits: input.attempt.waits,
        paths: input.executionPaths,
        declaredOutputs: input.declaredOutputPaths,
        fallbackReason: input.fallbackReason ?? null,
      },
      null,
      2,
    ),
    "```",
    ...(dependencyCatalog.length
      ? [
          "",
          "## Installed Apps",
          "Choose the accountable App by responsibility. These are the currently installed typed dependency targets:",
          "```json",
          JSON.stringify(dependencyCatalog, null, 2),
          "```",
        ]
      : []),
    ...(hasDeployReceiptWake(reconciliationEvents) ||
    readDeployReceiptForTask(input.executionPaths.projectDir, claim.taskId)
      ? ["", ...deployReceiptPrompt(input.executionPaths.projectDir, claim.taskId)]
      : []),
    ...(reconciliationEvents.items.length
      ? ["", "## New Events", "```json", JSON.stringify(reconciliationEvents, null, 2), "```"]
      : []),
  ].join("\n");

  const agentOptions = {
    source: "app-task-agent",
    projectId: descriptor.id,
    recoveryOwner: APP_TASK_RECOVERY_OWNER,
    trace,
    requireFinish: true,
    outputSchema: appTaskAgentResultSchema,
    toolPolicy: hasSuppliedDependencyObservation(reconciliationEvents) ? ("full-no-tasks" as const) : ("full" as const),
    timeout: APP_TASK_AGENT_TIMEOUT_MS,
    executionRoot: input.executionPaths.workspaceDir,
  };
  const dispatchAgent = async () =>
    typeof opts.manager.run === "function" &&
    typeof opts.manager.waitFor === "function" &&
    typeof opts.manager.progress === "function"
      ? await (async () => {
          input.attempt.signal.throwIfAborted();
          const definition = opts.agentDefinitions?.get(claim.agent);
          const runOptions = {
            source: agentOptions.source,
            kind: "call" as const,
            projectId: agentOptions.projectId,
            taskBinding: {
              appId: descriptor.id,
              taskId: claim.taskId,
              generation: claim.generation,
              attemptId: claim.attemptId,
            },
            recoveryOwner: agentOptions.recoveryOwner,
            trace: agentOptions.trace,
            requireFinish: agentOptions.requireFinish,
            outputSchema: agentOptions.outputSchema,
            toolPolicy: agentOptions.toolPolicy,
            timeoutMs: agentOptions.timeout,
            executionRoot: agentOptions.executionRoot,
          };
          const sessionId = definition
            ? opts.manager.runDefinition(definition, prompt, runOptions)
            : opts.manager.run(claim.agent, prompt, runOptions);
          recordAppTaskAttemptSession(appTaskConfig(descriptor), claim, sessionId);
          const cancelSession = () => {
            try {
              opts.manager.cancel(sessionId);
            } catch {
              // The session may finish between Task cancellation and abort.
            }
          };
          input.attempt.signal.addEventListener("abort", cancelSession, { once: true });
          if (input.attempt.signal.aborted) cancelSession();
          const unsubscribe = input.attempt.onEvent((incoming) => {
            try {
              const event = incoming as AgentEvent;
              opts.manager.send(sessionId, liveTaskEventMessage(event), { trace: childEventTrace(event) });
            } catch {
              // The session may finish between event admission and this
              // optional live hint. Durable Task input remains authoritative.
            }
          });
          try {
            const waited = await opts.manager.waitFor(sessionId);
            return {
              ...waited,
              messages: opts.manager.progress(sessionId, 1000),
            };
          } finally {
            unsubscribe();
            input.attempt.signal.removeEventListener("abort", cancelSession);
          }
        })()
      : await opts.manager.callAgent(claim.agent, prompt, agentOptions);
  const residueGuard = await beginCanonicalAgentResidueGuard(input.executionPaths);
  let restoredAgentResidue: string[] = [];
  let result: Awaited<ReturnType<typeof dispatchAgent>>;
  try {
    input.observer?.providerStarted(Buffer.byteLength(prompt));
    result = await dispatchAgent();
  } finally {
    input.observer?.providerFinished();
    const cleanupPlan = await planCanonicalAgentResidueCleanup(residueGuard);
    restoredAgentResidue = await applyCanonicalAgentResidueCleanup(cleanupPlan);
  }
  const done = result.status === "done";
  const handlerResult = rejectConvergedDirectAgentResidue(
    normalizeTaskHandlerResult(
      done ? result.structuredResult : undefined,
      {
        type: done ? "done" : "blocked",
        summary:
          firstNonEmptyString(result.finishResult?.summary, result.lastAssistantText, result.error) ??
          `Agent session ${result.sessionId || "unknown"} returned no result`,
        runId: result.sessionId || null,
      },
      {
        allowNeedsAgent: false,
        defaultParentId: input.defaultParentId,
        rootParentAliases: [input.descriptor.id, basename(input.descriptor.projectDir)],
        validateAction: input.descriptor.app.tasks?.validateAction,
        validateCondition: input.descriptor.app.tasks?.validateCondition,
      },
    ),
    restoredAgentResidue,
  );
  return {
    handlerResult,
    runId: result.sessionId || null,
    ...(!done ? { executionFailed: true } : {}),
  };
}

/**
 * Give every agent/CLI executor the same fenced Task surface. Runtime owns
 * attempt lifetime and lease renewal; adapters only translate TaskAttempt to
 * their execution mechanism and return one Task result.
 */
async function runTaskExecutorAttempt(input: {
  opts: AppTaskRuntimeOptions;
  descriptor: AppTaskRuntimeDescriptor;
  claim: AppTaskClaim;
  executionPaths: AppTaskExecutionPaths;
  declaredOutputPaths: string[];
  childContext: AppTaskChildContext;
  event?: EventEnvelope;
  execute: (attempt: TaskAttempt, events: AppTaskEvents) => Promise<TaskCapabilityRun>;
}): Promise<TaskCapabilityRun> {
  const taskAttempt = runtimeTaskAttempt({
    opts: input.opts,
    descriptor: input.descriptor,
    claim: input.claim,
    cwd: input.executionPaths.workspaceDir,
    declaredOutputPaths: input.declaredOutputPaths,
    childContext: input.childContext,
    ...(input.event ? { event: input.event } : {}),
  });
  const leaseTimer = setInterval(
    () => {
      try {
        if (!renewAppTaskAttemptLease(appTaskConfig(input.descriptor), input.claim)) clearInterval(leaseTimer);
      } catch {
        clearInterval(leaseTimer);
      }
    },
    Math.floor(APP_TASK_ATTEMPT_LEASE_DURATION_MS / 3),
  );
  leaseTimer.unref();
  try {
    const result = await input.execute(taskAttempt.attempt, taskAttempt.events);
    const acceptedLiveEventIds = taskAttempt.acceptedLiveEventIds();
    return acceptedLiveEventIds.length > 0 ? { ...result, acceptedLiveEventIds } : result;
  } finally {
    clearInterval(leaseTimer);
    taskAttempt.close();
  }
}

async function runTaskAgent(
  input: Omit<Parameters<typeof executeTaskAgent>[0], "attempt">,
): Promise<TaskCapabilityRun> {
  return runTaskExecutorAttempt({
    opts: input.opts,
    descriptor: input.descriptor,
    claim: input.claim,
    executionPaths: input.executionPaths,
    declaredOutputPaths: input.declaredOutputPaths,
    childContext: input.childContext,
    ...(input.event ? { event: input.event } : {}),
    execute: (attempt) => executeTaskAgent({ ...input, attempt }),
  });
}

async function runRegisteredTaskExecutor(input: {
  opts: AppTaskRuntimeOptions;
  descriptor: AppTaskRuntimeDescriptor;
  claim: AppTaskClaim;
  defaultParentId: string;
  executionPaths: AppTaskExecutionPaths;
  declaredOutputPaths: string[];
  childContext: AppTaskChildContext;
  event?: EventEnvelope;
  observer?: AppTaskExecutionObserver;
  name: TaskExecutorName;
  execute: TaskExecutor;
}): Promise<TaskCapabilityRun> {
  return runTaskExecutorAttempt({
    opts: input.opts,
    descriptor: input.descriptor,
    claim: input.claim,
    executionPaths: input.executionPaths,
    declaredOutputPaths: input.declaredOutputPaths,
    childContext: input.childContext,
    ...(input.event ? { event: input.event } : {}),
    execute: async (attempt) => {
      const runId = `executor:${input.name}:${input.claim.attemptId}`;
      try {
        input.observer?.providerStarted(0);
        const result = await input.execute(attempt);
        return {
          handlerResult: normalizeTaskHandlerResult(
            result,
            { type: "done", summary: `${input.name} executor completed`, runId },
            {
              allowNeedsAgent: true,
              defaultParentId: input.defaultParentId,
              rootParentAliases: [input.descriptor.id, basename(input.descriptor.projectDir)],
              validateAction: input.descriptor.app.tasks?.validateAction,
              validateCondition: input.descriptor.app.tasks?.validateCondition,
            },
          ),
          runId,
        };
      } catch (error) {
        return {
          handlerResult: {
            state: "error",
            summary: `${input.name} executor failed: ${error instanceof Error ? error.message : String(error)}`,
            evidence: [],
            actions: [],
          },
          runId,
          executionFailed: true,
        };
      } finally {
        input.observer?.providerFinished();
      }
    },
  });
}

function emitTaskReconciliationEvent(
  opts: AppTaskRuntimeOptions,
  descriptor: AppTaskRuntimeDescriptor,
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
    source: `app-task:${descriptor.id}:task-reconciler`,
    owner: `agent:${descriptor.agent}`,
    target: { appId: descriptor.id },
    data: { project: descriptor.id, taskId, ...data },
    ...(trace ? { trace } : {}),
  } as unknown as AgentEvent);
}

function recoverStaleTaskResult(
  config: AppTaskContext,
  claim: AppTaskClaim,
): { staleRecovery: "released" | "superseded" | "missing"; reconcileTaskIds: string[] } {
  const recovery = releaseStaleAppTaskResult(
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
  config: AppTaskContext,
  claim: AppTaskClaim,
  error: unknown,
): { staleRecovery: "released" | "superseded" | "missing"; reconcileTaskIds: string[] } | null {
  if (!isAppTaskActionStaleError(error) && !(error instanceof ResourceTaskMutationStaleError)) {
    return null;
  }
  const recovery = releaseStaleAppTaskResult(
    config,
    claim,
    `Stale handler action for ${
      isAppTaskActionStaleError(error) ? error.taskId : claim.taskId
    } was rejected; retrying ${claim.taskId} from current task evidence`,
  );
  return {
    staleRecovery: recovery.status,
    reconcileTaskIds: recovery.status === "missing" ? [] : [claim.taskId],
  };
}

async function establishTaskAcceptance(input: {
  descriptor: AppTaskRuntimeDescriptor;
  intent: AppTaskIntent;
  claim: AppTaskClaim;
  capability: TaskCapabilityRun;
  executionPaths: AppTaskExecutionPaths;
}): Promise<
  { ok: true; acceptanceBasis: AppTaskAcceptanceBasis } | { ok: false; summary: string; evidence: string[] }
> {
  const { descriptor, intent, claim, capability } = input;
  const workflow = claim.handler.startsWith("workflow:");
  if (!capability.verifier) {
    if (!workflow) {
      return {
        ok: true,
        acceptanceBasis: {
          method: "agent-judgment",
          evidence: [...capability.handlerResult.evidence],
        },
      };
    }
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
    const verificationConfig = appTaskConfig(descriptor);
    const pendingTrigger = readPendingAppTaskTrigger(verificationConfig, claim.taskId);
    const raw = await capability.verifier.verify(
      {
        appId: descriptor.id,
        taskId: claim.taskId,
        generation: claim.generation,
        appRoot: descriptor.appDir,
        projectRoot: descriptor.projectDir,
        workspaceDir: input.executionPaths.workspaceDir,
        intent: structuredClone(intent),
        ...(pendingTrigger
          ? {
              pendingTrigger: canonicalAppEvent(pendingTrigger as AgentEvent),
            }
          : {}),
      },
      capability.handlerResult as AppTaskHandlerResult,
    );
    const admitted = admitAppTaskVerificationResult(raw);
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
  opts: AppTaskRuntimeOptions;
  descriptor: AppTaskRuntimeDescriptor;
  taskId: string;
  dispatch: AppTaskDispatch;
  reason?: string;
}): Promise<string[]> {
  const { opts, descriptor } = input;

  const timing: AppTaskTiming = {
    dispatch: input.dispatch,
    resultPersistenceMs: 0,
    outcome: "completed",
  };
  let providerStartedAt: number | undefined;
  const observer: AppTaskExecutionObserver = {
    providerStarted(promptBytes) {
      const now = Date.now();
      timing.promptBytes = promptBytes;
      timing.providerStartMs = Math.max(0, now - input.dispatch.startedAt);
      providerStartedAt = now;
    },
    providerFinished() {
      if (providerStartedAt !== undefined) timing.providerMs = Math.max(0, Date.now() - providerStartedAt);
    },
  };
  const persistResult = <T>(operation: () => T): T => {
    const startedAt = performance.now();
    try {
      try {
        return operation();
      } catch (error) {
        if (!(error instanceof ResourceTaskMutationStaleError)) throw error;
        // The failed transaction applied nothing. Re-read current resources
        // and recheck every claim/action fence once, without rerunning the
        // handler or replaying provider effects. Semantic staleness is not
        // transaction contention and must still return to reconciliation.
        return operation();
      }
    } finally {
      timing.resultPersistenceMs += Math.max(0, performance.now() - startedAt);
    }
  };
  let activeConfig: ReturnType<typeof appTaskConfig> | undefined;
  let activeClaim: AppTaskClaim | undefined;

  try {
    const config = appTaskConfig(descriptor);
    activeConfig = config;
    const claimStartedAt = performance.now();
    const defaultParentId = config.resourceStore.rootTaskId();
    if (!defaultParentId) {
      throw new Error(`App ${descriptor.id} has no root task group for convention defaults`);
    }
    const primary = claimObservedAppTask(config, {
      taskId: input.taskId,
      appAgent: descriptor.agent,
      handler: "auto",
      reason: input.reason ?? "task-controller",
      isAgentRunnable: (agent) => opts.manager.hasAgent(agent),
    });
    timing.claimMs = Math.max(0, performance.now() - claimStartedAt);
    if (primary.kind !== "claimed") {
      if (primary.kind === "busy") {
        const active = primary.attemptId ? config.resourceStore.readAttempt(primary.attemptId) : null;
        const terminalSession =
          active?.sessionId && opts.persistDir ? readSessionMeta(opts.persistDir, active.sessionId) : null;
        if (active?.sessionId && terminalSession?.status === "done" && !hasLiveAppTaskSession(opts, active.sessionId)) {
          const consumed = consumePersistedTerminalAgentResult({
            persistDir: opts.persistDir,
            config,
            descriptor,
            taskId: input.taskId,
            sessionId: active.sessionId,
            onRejected: (error) => {
              opts.bus.emit({
                type: "info",
                message: `[app-task:${descriptor.id}] Rejected terminal result for ${input.taskId}; the task will be retried: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              });
            },
          });
          if (consumed) {
            emitTaskReconciliationEvent(opts, descriptor, undefined, "project.task.reconciled", input.taskId, {
              route: "terminal-agent-result-recovery",
              generation: consumed.claim.generation,
              attemptId: consumed.claim.attemptId,
              handler: consumed.claim.handler,
              disposition: consumed.state,
              summary: consumed.summary,
              evidence: consumed.evidence,
              actionsApplied: consumed.actionsApplied,
              evidenceSessionId: active.sessionId,
            });
            if (consumed.state === "converged") emitAppTaskDependencyCompleted(opts, descriptor, input.taskId);
            return consumed.reconcileTaskIds;
          }
        }
        const leaseCheckAt = Date.now();
        const sessionActivity =
          active?.sessionId && opts.persistDir
            ? {
                sessionId: active.sessionId,
                lastActivityAt: readSessionLastActivityAt(opts.persistDir, active.sessionId),
              }
            : undefined;
        const expired = expiredAgentSessionAppTaskAttempt(config, input.taskId, leaseCheckAt, sessionActivity);
        const sessionId = expired?.sessionId;
        const session = sessionId && opts.persistDir ? readSessionMeta(opts.persistDir, sessionId) : null;
        const terminalStatus =
          session?.status === "done" || session?.status === "error" || session?.status === "interrupted"
            ? session.status
            : null;
        if (expired && sessionId && terminalStatus && !hasLiveAppTaskSession(opts, sessionId)) {
          const released = releaseTerminalSessionExpiredAppTaskAttempt(
            config,
            { ...expired, sessionId, terminalStatus },
            `Expired reconciliation ${input.taskId} lost its synchronous caller after agent session completion`,
            leaseCheckAt,
            sessionActivity,
          );
          if (released.released) {
            emitTaskReconciliationEvent(opts, descriptor, undefined, "project.task.recovery.requeued", input.taskId, {
              route: "task-controller",
              reason: "terminal-agent-session-expired-lease",
              attemptId: expired.attemptId,
              evidenceSessionId: sessionId,
              terminalStatus,
            });
            return [input.taskId];
          }
        }
      }
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
      if (primary.kind === "attention") emitAppTaskDependencyUpdated(opts, descriptor, input.taskId);
      return [];
    }
    activeClaim = primary;
    timing.attemptId = primary.attemptId;
    timing.generation = primary.generation;
    for (const sessionId of primary.supersededSessionIds ?? []) {
      interruptSupersededAgentSession(
        opts,
        sessionId,
        `Task ${primary.taskId} superseded an orphaned agent session while recovering the current generation`,
        primary.taskId,
      );
    }
    const intent = primary.intent;
    const event = primary.trigger as EventEnvelope | undefined;
    const contextStartedAt = performance.now();
    const childContext = readAppTaskChildContext(config, primary.taskId);
    const taskSnapshot = readAppTaskLiveSnapshot(config, primary.taskId);
    timing.contextBuildMs = Math.max(0, performance.now() - contextStartedAt);
    let executionPaths = appTaskExecutionPaths(descriptor.appDir, descriptor.projectDir);
    const declaredOutputPaths = primary.declaredOutputPaths;
    emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconcile.started", intent.id, {
      route: "task-controller",
      generation: primary.generation,
      attemptId: primary.attemptId,
      handler: primary.handler,
      owner: primary.agent,
    });

    // Claiming a task rewrites the canonical state plus its disposable route and
    // read projections. On large retained trees that synchronous durability
    // boundary is substantial. Yield before agent/workflow association can
    // perform another state rewrite, so HTTP readiness and accepted event
    // ingress get an observable turn inside one reconciliation (not merely
    // between separate claims).
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    const workflowKey = primary.handler.startsWith("workflow:") ? primary.handler.slice("workflow:".length) : "";
    const executorKey = primary.handler.startsWith("executor:")
      ? primary.handler.slice("executor:".length)
      : primary.handler.startsWith("cli:")
        ? primary.handler.slice("cli:".length)
        : "";
    let taskWorkspace: PreparedTaskWorkspace | undefined;
    let workspaceFinalized = false;
    const finalizeWorkspace = async (outcome: "accepted" | "waiting" | "failed") => {
      if (!taskWorkspace || workspaceFinalized) return { ok: true as const };
      try {
        const finalized = await finalizeAppTaskWorkspace(taskWorkspace, outcome);
        workspaceFinalized = true;
        persistResult(() => recordAppTaskAttemptWorkspace(config, primary, finalized.metadata));
        return finalized;
      } catch (error) {
        workspaceFinalized = true;
        taskWorkspace.metadata.disposition = "retained-for-recovery";
        persistResult(() => recordAppTaskAttemptWorkspace(config, primary, taskWorkspace!.metadata));
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
    const workflowWorkspace = workflowKey
      ? (await inspectWorkflowDefinition(appWorkflowRuntimePaths(opts, descriptor, primary.agent).workflowDir, workflowKey))
          .workspace
      : undefined;
    const workflowNeedsWorktree =
      workflowWorkspace === "task" || (typeof workflowWorkspace === "object" && workflowWorkspace.kind === "task");
    // Both execution paths share workspace lineage, admission fencing, and
    // failure handling. Only the workflow may override the App's base branch.
    if (workflowNeedsWorktree || (executorKey && descriptor.app.workspace?.kind === "git")) {
      try {
        if (descriptor.app.workspace?.kind !== "git") {
          throw new Error(`Workflow ${workflowKey} requires a task worktree but app workspace is not Git`);
        }
        const previous = Object.values(config.resourceStore.readTaskContext({ taskIds: [primary.taskId] }).attempts ?? {})
          .filter(
            (attempt) =>
              attempt.taskId === primary.taskId &&
              attempt.taskGeneration === primary.generation &&
              attempt.workspace?.kind === "task-worktree",
          )
          .sort((left, right) => right.startedAt.localeCompare(left.startedAt))[0]?.workspace;
        taskWorkspace = await prepareAppTaskWorkspace({
          repoDir: descriptor.projectDir,
          workspaceRoot: join(opts.projectRoot, "worktrees", descriptor.id),
          taskId: primary.taskId,
          generation: primary.generation,
          baseBranch:
            typeof workflowWorkspace === "object"
              ? workflowWorkspace.baseBranch
              : (descriptor.app.workspace.branch ?? "dev"),
          previous,
        });
        executionPaths = withAppTaskWorkspace(executionPaths, taskWorkspace.metadata.path);
        if (!recordAppTaskAttemptWorkspace(config, primary, taskWorkspace.metadata)) {
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
          workspacePreparationFailed: true,
        };
      }
    }
    if (workflowKey) {
      primaryResult ??= await runTaskCapability({
        opts,
        descriptor,
        capability: {
          workflow: workflowKey,
          agent: primary.agent,
          task: `Reconcile task through workflow ${workflowKey}`,
        },
        intent,
        claim: primary,
        defaultParentId,
        executionPaths,
        declaredOutputPaths,
        childContext,
        taskSnapshot,
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
        observer,
      });
    } else if (executorKey) {
      const registered = opts.executors?.[executorKey];
      if (registered) {
        primaryResult ??= await runRegisteredTaskExecutor({
          opts,
          descriptor,
          claim: primary,
          defaultParentId,
          executionPaths,
          declaredOutputPaths,
          childContext,
          event,
          observer,
          name: executorKey,
          execute: registered,
        });
      } else {
        primaryResult ??= {
          handlerResult: {
            state: "error",
            summary: `Task executor ${executorKey} is not registered`,
            evidence: [],
            actions: [],
          },
          runId: null,
          unavailable: true,
        };
      }
    } else {
      primaryResult = await runTaskAgent({
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
        observer,
      });
      if (primary.handoff && intent.workflow) {
        const workflowPaths = appWorkflowRuntimePaths(opts, descriptor, primary.agent);
        const definition = await inspectWorkflowDefinition(workflowPaths.workflowDir, intent.workflow);
        if (definition.verifier) {
          primaryResult.verifier = {
            ...definition.verifier,
            verify: definition.verifier.verify as AppTaskVerifier,
          };
        }
      }
    }

    if (!primaryResult) throw new Error(`Task ${primary.taskId} produced no handler result`);

    const primaryHandlerResult = primaryResult.handlerResult;
    const rejectStaleEffect = (error: unknown) => {
      const stale = recoverStaleTaskActionResult(config, primary, error);
      if (!stale) return null;
      emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
        generation: primary.generation,
        attemptId: primary.attemptId,
        handler: primary.handler,
        disposition: "stale",
        input: intent.input ?? {},
        summary: error instanceof Error ? error.message : String(error),
        evidence: primaryHandlerResult.evidence,
        staleRecovery: stale.staleRecovery,
        workflowRunId: primaryResult.runId,
      });
      return stale;
    };
    const fenceWorkspaceFinalization = async () => {
      if (!taskWorkspace) return null;
      try {
        assertAppTaskClaimCurrent(config, primary);
        return null;
      } catch (error) {
        await finalizeWorkspace("failed");
        const stale = rejectStaleEffect(error);
        if (!stale) throw error;
        return stale;
      }
    };
    if (
      primaryHandlerResult.state === "converged" &&
      primary.handoff?.reason === "needs-agent" &&
      intent.workflow &&
      !primaryResult.verifier
    ) {
      primaryHandlerResult.state = "error";
      primaryHandlerResult.summary = `Agent convergence was rejected because workflow ${intent.workflow} handed off without a verifier`;
    }
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
        const stale = await fenceWorkspaceFinalization();
        if (stale) return stale.reconcileTaskIds;
        // Keep reusable work when a newer observation still needs judgment.
        // Completion below records progress instead of granting acceptance.
        const finalized = await finalizeWorkspace(
          hasPendingAppTaskEvidence(config, primary, primaryResult.acceptedLiveEventIds) ? "waiting" : "accepted",
        );
        if (!finalized.ok) {
          // A retained dirty/unintegrated workspace needs inspection, not an
          // identical replay of the handler's already rejected completion.
          primaryResult.handlerBlocked = true;
          primaryHandlerResult.state = "error";
          primaryHandlerResult.summary = finalized.reason ?? "Task workspace finalization failed";
          primaryHandlerResult.evidence = [...primaryHandlerResult.evidence, taskWorkspace?.metadata.path ?? executionPaths.workspaceDir];
        }
      }
      if (primaryHandlerResult.state === "converged" && acceptanceBasis) {
        try {
          const apply = persistResult(() =>
            completeAppTask(config, primary, {
              summary: primaryHandlerResult.summary,
              response: primaryHandlerResult.response,
              result: primaryHandlerResult.result,
              evidence: primaryHandlerResult.evidence,
              actions: primaryHandlerResult.actions,
              acceptanceBasis,
              acceptedLiveEventIds: primaryResult.acceptedLiveEventIds,
            }),
          );
          const appliedDisposition = apply.taskContinues
            ? primaryHandlerResult.actions.some(
                (action) => action.kind === "update-task" && action.taskId === primary.taskId,
              )
              ? "revised"
              : "progress"
            : "converged";
          interruptSupersededActionSessions(opts, intent.id, apply.supersededSessionIds);
          const stale = apply.status === "stale" ? recoverStaleTaskResult(config, primary) : null;
          emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
            generation: primary.generation,
            attemptId: primary.attemptId,
            handler: primary.handler,
            disposition: apply.status === "applied" ? appliedDisposition : "stale",
            outcome: intent.outcome,
            mode: intent.mode,
            owner: intent.owner ?? descriptor.agent,
            ...(intent.workflow ? { workflow: intent.workflow } : {}),
            ...(intent.executor ? { executor: intent.executor } : {}),
            acceptance: intent.acceptance,
            input: intent.input ?? {},
            summary: primaryHandlerResult.summary,
            ...(primaryHandlerResult.response ? { response: primaryHandlerResult.response } : {}),
            ...(primaryHandlerResult.result ? { result: primaryHandlerResult.result } : {}),
            evidence: primaryHandlerResult.evidence,
            acceptanceBasis,
            actionsApplied: apply.actionsApplied,
            ...(stale ? { staleRecovery: stale.staleRecovery } : {}),
            workflowRunId: primaryResult.runId,
          });
          if (apply.status === "applied" && appliedDisposition === "converged") {
            emitAppTaskDependencyCompleted(opts, descriptor, intent.id);
          } else if (apply.status === "applied") {
            emitAppTaskDependencyUpdated(opts, descriptor, intent.id);
          }
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
              owner: intent.owner ?? descriptor.agent,
              ...(intent.workflow ? { workflow: intent.workflow } : {}),
              ...(intent.executor ? { executor: intent.executor } : {}),
              input: intent.input ?? {},
              summary,
              evidence: primaryHandlerResult.evidence,
              staleRecovery: stale.staleRecovery,
              workflowRunId: primaryResult.runId,
            });
            return stale.reconcileTaskIds;
          }
          primaryHandlerResult.state = "error";
          primaryHandlerResult.summary = `Handler actions were rejected: ${error instanceof Error ? error.message : String(error)}`;
        }
      }
    }

    if (primaryHandlerResult.state === "waiting") {
      const stale = await fenceWorkspaceFinalization();
      if (stale) return stale.reconcileTaskIds;
      const finalized = await finalizeWorkspace("waiting");
      if (!finalized.ok) {
        primaryResult.handlerBlocked = true;
        primaryHandlerResult.state = "error";
        primaryHandlerResult.summary = finalized.reason ?? "Task workspace finalization failed";
        primaryHandlerResult.evidence = [...primaryHandlerResult.evidence, taskWorkspace?.metadata.path ?? executionPaths.workspaceDir];
      }
    }

    if (primaryHandlerResult.state === "waiting") {
      try {
        const existingAppDependencyConditions = openTaskAppDependencyConditions(config, primary.taskId);
        const dependencyConditions = primaryHandlerResult.dependencies?.length
          ? admitTaskAppDependencies({
              opts,
              descriptor,
              claim: primary,
              dependencies: primaryHandlerResult.dependencies,
              existingConditions: existingAppDependencyConditions,
              acceptedLiveEventIds: primaryResult.acceptedLiveEventIds,
            })
          : [];
        const conditions = mergeTaskConditions(
          [...existingAppDependencyConditions, ...(primaryHandlerResult.conditions ?? []), ...dependencyConditions],
          new Set(existingAppDependencyConditions.map((condition) => condition.id)),
        );
        primaryHandlerResult.conditions = conditions.length > 0 ? conditions : undefined;
      } catch (error) {
        const stale = rejectStaleEffect(error);
        if (stale) {
          return stale.reconcileTaskIds;
        }
        primaryHandlerResult.state = "error";
        primaryHandlerResult.summary = `App dependency admission failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    if (primaryHandlerResult.state === "waiting") {
      try {
        const apply = persistResult(() =>
          deferAppTask(config, primary, {
            disposition: "waiting",
            summary: primaryHandlerResult.summary,
            response: primaryHandlerResult.response,
            result: primaryHandlerResult.result,
            evidence: primaryHandlerResult.evidence,
            actions: primaryHandlerResult.actions,
            conditions: primaryHandlerResult.conditions,
            acceptedLiveEventIds: primaryResult.acceptedLiveEventIds,
          }),
        );
        interruptSupersededActionSessions(opts, intent.id, apply.supersededSessionIds);
        const stale = apply.status === "stale" ? recoverStaleTaskResult(config, primary) : null;
        emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
          generation: primary.generation,
          attemptId: primary.attemptId,
          handler: primary.handler,
          disposition: apply.status === "applied" ? primaryHandlerResult.state : "stale",
          ...(primary.trigger?.type === "project.task.condition-review.missed"
            ? { reason: "condition-review-checkpoint-missed" }
            : {}),
          input: intent.input ?? {},
          summary: primaryHandlerResult.summary,
          ...(primaryHandlerResult.response ? { response: primaryHandlerResult.response } : {}),
          ...(primaryHandlerResult.result ? { result: primaryHandlerResult.result } : {}),
          evidence: primaryHandlerResult.evidence,
          actionsApplied: apply.actionsApplied,
          ...(stale ? { staleRecovery: stale.staleRecovery } : {}),
          workflowRunId: primaryResult.runId,
        });
        const replayedTaskIds =
          apply.status === "applied"
            ? replayPersistedConditionEvents(opts, descriptor, config, {
                conditionIds: primaryHandlerResult.conditions?.map((condition) => condition.id),
              })
            : [];
        if (apply.status === "applied") emitAppTaskDependencyUpdated(opts, descriptor, intent.id);
        return [...new Set([...(stale?.reconcileTaskIds ?? apply.reconcileTaskIds), ...replayedTaskIds])];
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
          return stale.reconcileTaskIds;
        }
        primaryHandlerResult.state = "error";
        primaryHandlerResult.summary = `Handler result was rejected: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    await finalizeWorkspace("failed");

    const agentHandoff = Boolean(workflowKey && primaryHandlerResult.state === "needs-agent");
    if (
      !primaryResult.unavailable &&
      !primaryResult.handlerBlocked &&
      !primaryResult.workspacePreparationFailed &&
      !agentHandoff &&
      !primaryHandlerResult.resultRejected
    ) {
      const summary = `${primaryHandlerResult.summary}; retrying the same Task`;
      const retry = releaseStaleAppTaskResult(config, primary, summary);
      if (retry.status !== "released") return [];
      emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
        generation: primary.generation,
        attemptId: primary.attemptId,
        handler: primary.handler,
        disposition: "retrying",
        input: intent.input ?? {},
        summary: primaryHandlerResult.summary,
      });
      throw new Error(primaryHandlerResult.summary);
    }
    let attention: ReturnType<typeof markAppTaskAttention>;
    try {
      attention = persistResult(() =>
        markAppTaskAttention(config, primary, {
          summary: primaryHandlerResult.summary,
          // A failed workspace/action admission must not report its proposed
          // Task mutations as accepted through the diagnostic path either.
          result: primaryHandlerResult.actions.length ? undefined : primaryHandlerResult.result,
          evidence: primaryHandlerResult.evidence,
          acceptedLiveEventIds: primaryResult.acceptedLiveEventIds,
          reason: primaryHandlerResult.resultRejected
            ? "HandlerResultInvalid"
            : primaryResult.unavailable
              ? "HandlerUnavailable"
              : primaryResult.executionFailed
                ? "HandlerExecutionFailed"
                : primaryResult.workspacePreparationFailed
                  ? "WorkspacePreparationFailed"
                  : primaryHandlerResult.state === "needs-agent"
                    ? "needs-agent"
                    : "handler-blocked",
          wakeParent: !agentHandoff,
        }),
      );
    } catch (error) {
      const stale = rejectStaleEffect(error);
      if (!stale) throw error;
      return stale.reconcileTaskIds;
    }
    if (attention.status === "applied") emitAppTaskDependencyUpdated(opts, descriptor, intent.id);
    if (!agentHandoff) {
      emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
        generation: primary.generation,
        attemptId: primary.attemptId,
        handler: primary.handler,
        disposition: attention.taskContinues ? "progress" : "attention",
        input: intent.input ?? {},
        summary: primaryHandlerResult.summary,
      });
      return attention.taskContinues
        ? [intent.id]
        : attention.status === "applied" && attention.parentTaskId ? [attention.parentTaskId] : [];
    }
    emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
      generation: primary.generation,
      attemptId: primary.attemptId,
      handler: primary.handler,
      disposition: "agent-handoff",
      input: intent.input ?? {},
      summary: primaryHandlerResult.summary,
    });
    return [intent.id];
  } catch (error) {
    if (activeConfig && activeClaim) {
      const stale = recoverStaleTaskActionResult(activeConfig, activeClaim, error);
      if (stale) {
        timing.outcome = "completed";
        emitTaskReconciliationEvent(
          opts,
          descriptor,
          activeClaim.trigger as EventEnvelope | undefined,
          "project.task.reconciled",
          activeClaim.taskId,
          {
            generation: activeClaim.generation,
            attemptId: activeClaim.attemptId,
            handler: activeClaim.handler,
            disposition: "stale",
            summary:
              "The claimed Task changed before executor startup; stale work was discarded without retrying it as a handler failure.",
            staleRecovery: stale.staleRecovery,
          },
        );
        return stale.reconcileTaskIds;
      }
    }
    timing.outcome = "failed";
    if (activeConfig && activeClaim) {
      const failedConfig = activeConfig;
      const failedClaim = activeClaim;
      const summary = `Task handler failed before returning a persistable result: ${
        error instanceof Error ? error.message : String(error)
      }`;
      try {
        const retry = persistResult(() => releaseStaleAppTaskResult(failedConfig, failedClaim, summary));
        if (retry.status === "released") {
          emitTaskReconciliationEvent(
            opts,
            descriptor,
            failedClaim.trigger as EventEnvelope | undefined,
            "project.task.reconciled",
            failedClaim.taskId,
            {
              generation: failedClaim.generation,
              attemptId: failedClaim.attemptId,
              handler: failedClaim.handler,
              disposition: "retrying",
              summary,
            },
          );
        }
      } catch {
        // Preserve the original failure. Recovery still fences attempts whose
        // persistence boundary itself is unavailable.
      }
    }
    throw error;
  } finally {
    publishAppTaskTiming(opts, descriptor, input.taskId, timing);
  }
}

const appRouterDescriptorsByBus = new WeakMap<EventBus, AppTaskRuntimeDescriptor[]>();
const appRouterOptionsByBus = new WeakMap<EventBus, AppTaskRuntimeOptions>();

function loadedAppTaskRuntimeDescriptor(bus: EventBus, projectId: string): AppTaskRuntimeDescriptor | undefined {
  const normalized = projectId.trim().replace(/\.app$/, "");
  return (appRouterDescriptorsByBus.get(bus) ?? []).find((descriptor) => descriptor.id === normalized);
}

const appTaskControllersByBus = new WeakMap<EventBus, Map<string, AppTaskController>>();
const appTaskRecoverySchedulersByBus = new WeakMap<EventBus, Map<string, AppTaskRecoveryScheduler>>();
type AppTaskControllerBinding = {
  descriptor: AppTaskRuntimeDescriptor;
  opts: AppTaskRuntimeOptions;
  recoveryScheduler?: AppTaskRecoveryScheduler;
};
const appTaskControllerBindingsByBus = new WeakMap<EventBus, Map<string, AppTaskControllerBinding>>();
const APP_TASK_RECOVERY_SAFETY_INTERVAL_MS = 60_000;

function appTaskDelivery(descriptor: AppTaskRuntimeDescriptor, taskId: string, note: string): DeliveryResult {
  return {
    accepted: true,
    by: `app-task:${descriptor.id}:task-reconciler`,
    route: "direct",
    note: `${note}: ${taskId}`,
  };
}

function appDependencyUpdateSubject(event: Record<string, unknown>): string | null {
  if (event.type !== "app.dependency.updated") return null;
  const data = isRecord(event.data) ? event.data : {};
  const id = data.kind === "app" && typeof data.id === "string" ? data.id.trim() : "";
  return id ? `id:${id}` : null;
}

function conditionSubjectCandidates(event: Record<string, unknown>): string[] {
  const containers = [event, isRecord(event.target) ? event.target : {}, isRecord(event.data) ? event.data : {}];
  const values = new Map<string, string>();
  for (const container of containers) {
    for (const [field, value] of Object.entries(container)) {
      if ((typeof value === "string" && value.trim()) || typeof value === "number" || typeof value === "boolean") {
        values.set(field, String(value).trim());
      }
    }
  }
  const candidates = new Set<string>();
  for (const [field, value] of values) candidates.add(`${field}:${value}`);
  const typed: Record<string, string[]> = {
    task: ["taskId", "task_id"],
    session: ["sessionId", "session_id"],
    "workflow-run": ["workflowRunId", "workflow_run_id", "runId"],
    metric: ["metricId", "metric_id"],
    alert: ["alertId", "alert_id"],
    project: ["project", "projectId", "project_id"],
    "pipeline-run": ["pipelineRunId", "pipeline_run_id", "runId", "run_id"],
    "pull-request": ["pullRequestId", "pull_request_id", "prId", "pr_id"],
  };
  for (const [kind, fields] of Object.entries(typed)) {
    const value = fields.map((field) => values.get(field)).find(Boolean);
    if (value) candidates.add(`${kind}:${value}`);
  }
  return [...candidates];
}

function appDependencyUpdateWakeTaskIds(
  config: AppTaskContext,
  event: Record<string, unknown>,
  allowedTaskIds?: Iterable<string>,
): string[] {
  const subject = appDependencyUpdateSubject(event);
  if (!subject) return [];
  const allowed = allowedTaskIds ? new Set(allowedTaskIds) : null;
  const routes = config.resourceStore.readConditionRoutes("app.dependency.completed");
  return [
    ...new Set(
      routes
        .filter(({ condition }) => condition.spec.subject === subject)
        .flatMap(({ taskIds }) => taskIds)
        .filter((taskId) => !allowed || allowed.has(taskId)),
    ),
  ].sort();
}

type AppTaskAdmissionResult = {
  delivery?: DeliveryResult;
  taskIds: string[];
  supersededSessionIds: string[];
};

function admitResolvedAppTaskEvent(input: {
  descriptor: AppTaskRuntimeDescriptor;
  controller?: AppTaskController;
  event: Record<string, unknown>;
  intent: AppTaskIntent | null;
  targetedTaskId?: string;
  conditionTaskIds?: string[];
  interruptSuperseded?(observation: AppTaskObservationResult): void;
}): AppTaskAdmissionResult {
  const { descriptor, controller, event, intent } = input;
  const targetedTaskId = input.targetedTaskId?.trim() ?? "";
  const config = appTaskConfig(descriptor);
  const selectedConditionTaskIds = [
    ...new Set((input.conditionTaskIds ?? []).map((taskId) => taskId.trim()).filter(Boolean)),
  ];
  const conditionWakes = trackAppTaskConditionEventForTasks(config, event, selectedConditionTaskIds);
  const dependencyUpdateWakes = appDependencyUpdateWakeTaskIds(config, event, selectedConditionTaskIds).flatMap(
    (taskId) => {
      const wake = recordAppTaskTrigger(config, taskId, event);
      return wake.kind === "recorded" ? [taskId] : [];
    },
  );
  if (controller) {
    for (const taskId of new Set([...conditionWakes.map((wake) => wake.taskId), ...dependencyUpdateWakes])) {
      enqueueAppTask(controller, config, taskId, { promote: true });
    }
  }
  const wokenTaskIds = new Set([...conditionWakes.map((wake) => wake.taskId), ...dependencyUpdateWakes]);
  // A frozen Condition route is idempotent admission authority. On recovery,
  // its task may already have consumed the fact or left its wait. Accept that
  // no-op instead of retrying the immutable plan forever. Exact targets with
  // no selected Condition remain strict existing-task references below.
  const conditionDelivery = selectedConditionTaskIds.length
    ? appTaskDelivery(
        descriptor,
        (conditionWakes.length || dependencyUpdateWakes.length
          ? [...new Set([...conditionWakes.map((wake) => wake.taskId), ...dependencyUpdateWakes])]
          : selectedConditionTaskIds
        ).join(","),
        conditionWakes.length || dependencyUpdateWakes.length
          ? "task dependency event accepted"
          : "task dependency event already observed",
      )
    : undefined;
  if (targetedTaskId) {
    // An exact target is feedback for existing work, not another declaration
    // of its goal. Re-observing the resolver's intent here both changed the
    // Task accidentally and loaded its complete subtree before a simple wake.
    const triggerResult = recordAppTaskTrigger(config, targetedTaskId, event);
    if (triggerResult.kind === "recorded") {
      wokenTaskIds.add(targetedTaskId);
      if (controller) enqueueAppTask(controller, config, targetedTaskId, { promote: true });
      return {
        delivery: appTaskDelivery(descriptor, targetedTaskId, "existing targeted task wake accepted"),
        taskIds: [...wokenTaskIds],
        supersededSessionIds: [],
      };
    }
    // An exact target is a reference to existing durable work, never creation
    // authority. Desired task creation is admitted only through App policy.
    return { delivery: conditionDelivery, taskIds: [...wokenTaskIds], supersededSessionIds: [] };
  }
  if (!intent) return { delivery: conditionDelivery, taskIds: [...wokenTaskIds], supersededSessionIds: [] };
  const observation = observeAppTaskIntent(config, {
    intent,
    appAgent: descriptor.agent,
    trigger: event,
  });
  input.interruptSuperseded?.(observation);
  if (observation.kind === "observed") wokenTaskIds.add(observation.taskId);
  if (controller && observation.kind === "observed") {
    enqueueAppTask(controller, config, observation.taskId, {
      promote: event.type === "project.comment.created",
    });
  }
  return {
    delivery: appTaskDelivery(descriptor, observation.taskId, "resolved task event accepted"),
    taskIds: [...wokenTaskIds],
    supersededSessionIds: observation.supersededSessionIds ?? [],
  };
}

/**
 * Host-private bridge from canonical event admission into the retained task
 * engine. Policy has already selected the App and resolved any desired intent.
 */
export function admitLoadedCanonicalAppTaskEvent(input: {
  bus: EventBus;
  appId: string;
  event: AgentEvent;
  intent: AppTaskIntent | null;
  targetedTaskId?: string;
  conditionTaskIds?: string[];
}): DeliveryResult | undefined {
  const descriptor = (appRouterDescriptorsByBus.get(input.bus) ?? []).find((candidate) => candidate.id === input.appId);
  if (!descriptor?.app.tasks) {
    throw new Error(`Canonical App ${input.appId} task capability is not loaded`);
  }
  const controller = appTaskControllersByBus.get(input.bus)?.get(descriptor.id);
  const opts = appRouterOptionsByBus.get(input.bus);
  if (!opts || (!controller && !descriptor.reconciliationPaused)) {
    throw new Error(`Canonical App ${input.appId} task reconciliation is not active`);
  }
  return admitResolvedAppTaskEvent({
    descriptor,
    controller,
    event: canonicalTaskEvent(input.event),
    intent: input.intent,
    targetedTaskId: input.targetedTaskId,
    conditionTaskIds: input.conditionTaskIds,
    interruptSuperseded: (observation) => interruptSupersededObservationSessions(opts, observation),
  }).delivery;
}

/**
 * Canonical Task admission without an in-process controller. A persistent
 * admission worker uses this boundary, then returns exact Task wakes to the
 * daemon's lightweight controllers.
 */
export function admitStandaloneCanonicalAppTaskEvent(input: {
  descriptor: AppTaskRuntimeDescriptor;
  event: AgentEvent;
  intent: AppTaskIntent | null;
  targetedTaskId?: string;
  conditionTaskIds?: string[];
}): AppTaskAdmissionResult {
  if (!input.descriptor.app.tasks) throw new Error(`App ${input.descriptor.id} has no Task capability`);
  if (input.descriptor.reconciliationPaused) throw new Error(`App ${input.descriptor.id} reconciliation is paused`);
  return admitResolvedAppTaskEvent({
    descriptor: input.descriptor,
    event: canonicalTaskEvent(input.event),
    intent: input.intent,
    targetedTaskId: input.targetedTaskId,
    conditionTaskIds: input.conditionTaskIds,
  });
}

/** Prepare only canonical Task state needed by the admission worker. */
export function standaloneAppTaskAdmissionDescriptors(input: {
  persistDir: string;
  projectsRoot: string;
  entries: AppRegistrySnapshot["entries"];
}): Map<string, AppTaskRuntimeDescriptor> {
  const descriptors = new Map<string, AppTaskRuntimeDescriptor>();
  for (const { appDir, definition: app } of input.entries) {
    if (!app.tasks) continue;
    const resourceStore = discoverAppTaskResourceStore(input.persistDir, app.id, appDir);
    const descriptor: AppTaskRuntimeDescriptor = {
      id: app.id,
      appDir,
      projectDir: domainProjectDir(input.projectsRoot, appDir, app.id, app),
      agent: configuredAppAgent(app, appDir),
      app,
      reconciliationPaused: resourceStore.projectLifecycle() === "paused",
      resourceStore,
    };
    validatePreparedAppTaskRuntime(descriptor);
    descriptors.set(descriptor.id, descriptor);
  }
  return descriptors;
}

/** Wake already-admitted Task identities without repeating their mutation. */
export function wakeLoadedAppTasks(input: {
  bus: EventBus;
  appId: string;
  taskIds: string[];
  supersededSessionIds?: string[];
}): void {
  const appId = input.appId.trim().replace(/\.app$/, "");
  const descriptor = loadedAppTaskRuntimeDescriptor(input.bus, appId);
  const controller = appTaskControllersByBus.get(input.bus)?.get(appId);
  if (!descriptor?.app.tasks || !controller || descriptor.reconciliationPaused) return;
  const config = appTaskConfig(descriptor);
  const opts = appRouterOptionsByBus.get(input.bus);
  const admittedTaskId = input.taskIds.at(-1);
  if (opts && admittedTaskId) {
    interruptSupersededObservationSessions(opts, {
      taskId: admittedTaskId,
      generation: descriptor.resourceStore.readTask(admittedTaskId)?.metadata.generation ?? 1,
      supersededSessionIds: input.supersededSessionIds,
    });
  }
  for (const taskId of new Set(input.taskIds.map((value) => value.trim()).filter(Boolean))) {
    enqueueAppTask(controller, config, taskId, { promote: true });
  }
}

/** Bounded exact-identity check used before asynchronously admitting feedback. */
export function hasLoadedAppTask(input: { bus: EventBus; appId: string; taskId: string }): boolean {
  const descriptor = loadedAppTaskRuntimeDescriptor(input.bus, input.appId.trim().replace(/\.app$/, ""));
  return Boolean(descriptor?.resourceStore.readTask(input.taskId.trim()));
}

/** Read-only canonical-state task-Condition preflight for the App coordinator. */
export function previewLoadedCanonicalAppTaskEvent(input: {
  bus: EventBus;
  appId: string;
  event: AgentEvent;
  targetedTaskId?: string;
}): string[] {
  const descriptor = (appRouterDescriptorsByBus.get(input.bus) ?? []).find((candidate) => candidate.id === input.appId);
  if (!descriptor?.app.tasks) return [];
  const allowed = input.targetedTaskId ? [input.targetedTaskId] : undefined;
  return matchingAppTaskConditionTaskIds(appTaskConfig(descriptor), canonicalTaskEvent(input.event), allowed);
}

/** Read-only event-type-first Condition preflight across loaded Task Apps. */
export function previewLoadedCanonicalAppTaskEventRoutes(input: {
  bus: EventBus;
  event: AgentEvent;
}): Array<{ appId: string; taskIds: string[] }> {
  const descriptors = (appRouterDescriptorsByBus.get(input.bus) ?? []).filter((descriptor) => descriptor.app.tasks);
  if (descriptors.length === 0) return [];
  const event = canonicalTaskEvent(input.event);
  const updateSubject = appDependencyUpdateSubject(event);
  const subjects = conditionSubjectCandidates(event);
  const matchesByApp = new Map<string, Set<string>>();
  const loadedApps = new Set(descriptors.map((descriptor) => descriptor.id));
  const store = descriptors[0]!.resourceStore;
  for (const route of store.readConditionRoutesForAllApps(String(event.type ?? ""), subjects)) {
    if (!loadedApps.has(route.appId) || !matchesAppTaskCondition(route.condition, event)) continue;
    const taskIds = matchesByApp.get(route.appId) ?? new Set<string>();
    for (const taskId of route.taskIds) taskIds.add(taskId);
    matchesByApp.set(route.appId, taskIds);
  }
  if (updateSubject) {
    for (const route of store.readConditionRoutesForAllApps("app.dependency.completed", [updateSubject])) {
      if (!loadedApps.has(route.appId) || route.condition.spec.subject !== updateSubject) continue;
      const taskIds = matchesByApp.get(route.appId) ?? new Set<string>();
      for (const taskId of route.taskIds) taskIds.add(taskId);
      matchesByApp.set(route.appId, taskIds);
    }
  }
  return [...matchesByApp]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([appId, taskIds]) => ({ appId, taskIds: [...taskIds].sort() }));
}

function replayPersistedConditionEvents(
  opts: AppTaskRuntimeOptions,
  descriptor: AppTaskRuntimeDescriptor,
  config: AppTaskContext,
  input: { conditionIds?: string[] } = {},
): string[] {
  if (!opts.persistDir) return [];
  const resourceScope = config.resourceStore.readOpenConditionReplayScope(input.conditionIds);
  const eventTypes = resourceScope.eventTypes;
  if (eventTypes.length === 0) return [];

  const placeholders = eventTypes.map(() => "?").join(", ");
  const db = getDb(opts.persistDir);
  const rows = db
    .prepare(
      `SELECT event_type, source, timestamp, data
       FROM events
       WHERE (
         project_id = ?
         OR (
           json_valid(data) = 1
           AND (
             json_extract(data, '$.project') = ?
             OR json_extract(data, '$.target.project') = ?
           )
         )
       )
         AND event_type IN (${placeholders})
       ORDER BY id DESC
       LIMIT 2000`,
    )
    .all(descriptor.id, descriptor.id, descriptor.id, ...eventTypes) as Array<{
    event_type?: unknown;
    source?: unknown;
    timestamp?: unknown;
    data?: unknown;
  }>;

  const events: Record<string, unknown>[] = [];
  for (const row of rows.reverse()) {
    if (typeof row.data !== "string" || !row.data.trim()) continue;
    try {
      const parsed = JSON.parse(row.data);
      if (!isRecord(parsed)) continue;
      const event: Record<string, unknown> = {
        ...parsed,
        type: typeof row.event_type === "string" ? row.event_type : parsed.type,
        ...(typeof row.source === "string" && row.source.trim() ? { source: row.source } : {}),
        ...(typeof row.timestamp === "number" ? { timestamp: row.timestamp } : {}),
      };
      events.push(event);
    } catch {
      // Ignore malformed persisted events; they cannot prove a Condition.
    }
  }

  const allowed = new Set(resourceScope.taskIds);
  const wakes = events.flatMap((event) => {
    const taskIds = matchingAppTaskConditionTaskIds(config, event).filter((taskId) => allowed.has(taskId));
    return trackAppTaskConditionEventForTasks(config, event, taskIds);
  });
  return [...new Set(wakes.map((wake) => wake.taskId))];
}

function installConventionTaskControllers(
  opts: AppTaskRuntimeOptions,
  descriptors: AppTaskRuntimeDescriptor[],
): Map<string, AppTaskController> {
  if (opts.installControllers === false) {
    const previous = appTaskControllersByBus.get(opts.bus);
    for (const scheduler of appTaskRecoverySchedulersByBus.get(opts.bus)?.values() ?? []) scheduler.close();
    for (const controller of previous?.values() ?? []) controller.close();
    const empty = new Map<string, AppTaskController>();
    appTaskControllersByBus.set(opts.bus, empty);
    appTaskRecoverySchedulersByBus.set(opts.bus, new Map());
    appTaskControllerBindingsByBus.set(opts.bus, new Map());
    return empty;
  }
  const controllers = appTaskControllersByBus.get(opts.bus) ?? new Map<string, AppTaskController>();
  const recoverySchedulers =
    appTaskRecoverySchedulersByBus.get(opts.bus) ?? new Map<string, AppTaskRecoveryScheduler>();
  const bindings = appTaskControllerBindingsByBus.get(opts.bus) ?? new Map<string, AppTaskControllerBinding>();
  const installedIds = new Set(
    descriptors.filter((descriptor) => descriptor.app.tasks).map((descriptor) => descriptor.id),
  );
  for (const previous of appRouterDescriptorsByBus.get(opts.bus) ?? []) {
    if (installedIds.has(previous.id)) continue;
    if (previous.resourceStore.hasUnfinishedTasks()) {
      throw new Error(`Cannot remove App ${previous.id} while it has unfinished Tasks`);
    }
  }

  for (const descriptor of descriptors) {
    const tasks = descriptor.app.tasks;
    if (!tasks) continue;
    const existingController = controllers.get(descriptor.id);
    const existingBinding = bindings.get(descriptor.id);
    if (existingController && existingBinding) {
      // Publication swaps one immutable definition pointer. A reconcile that
      // already started retains its local descriptor; the next one reads this.
      existingBinding.descriptor = descriptor;
      existingBinding.opts = opts;
      existingController.updateMaxConcurrent(descriptor.app.tasks?.maxConcurrent ?? 1);
      existingController.setEnabled(!descriptor.reconciliationPaused);
      continue;
    }
    if (descriptor.reconciliationPaused) continue;

    const binding: AppTaskControllerBinding = { descriptor, opts };
    const controller = new AppTaskController({
      maxConcurrent: descriptor.app.tasks?.maxConcurrent ?? 1,
      capacity: opts.hostCapacity,
      startAfter: opts.startAfter,
      maxRetries: 3,
      reconcile: async (taskId, dispatch) => {
        const activeDescriptor = binding.descriptor;
        const activeOpts = binding.opts;
        const config = appTaskConfig(activeDescriptor);
        const dependentTaskIds = activeOpts.executeAttempt
          ? await activeOpts.executeAttempt({ appId: activeDescriptor.id, taskId, dispatch })
          : await reconcileTask({
              opts: activeOpts,
              descriptor: activeDescriptor,
              taskId,
              dispatch,
              reason: "task-controller",
            });
        const dependentEntries = new Map(
          appTaskQueueEntries(config, dependentTaskIds).map((entry) => [entry.taskId, entry]),
        );
        for (const dependentTaskId of dependentTaskIds) {
          // A same-task result is an immediate continuation, such as a
          // workflow-to-agent handoff. Other children/dependents enter the
          // priority-ordered ordinary lane so continuation bursts stay bounded.
          controller.enqueue(dependentTaskId, {
            promote: dependentTaskId === taskId,
            priority: dependentEntries.get(dependentTaskId)?.options.priority,
          });
        }
        binding.recoveryScheduler?.stateChanged();
      },
      onError: (taskId, error, willRetry) => {
        const activeDescriptor = binding.descriptor;
        binding.opts.bus.emit({
          type: "handler.failed",
          source: "cron",
          owner: `agent:${activeDescriptor.agent}`,
          data: {
            handler: `app-task-controller:${taskId}`,
            agent: activeDescriptor.agent,
            error: `${error instanceof Error ? error.message : String(error)}; willRetry=${willRetry}`,
            durationMs: 0,
          },
        });
      },
    });
    controllers.set(descriptor.id, controller);
    bindings.set(descriptor.id, binding);
    const config = appTaskConfig(descriptor);
    const recoveryScheduler = new AppTaskRecoveryScheduler({
      source: config.resourceStore,
      safetyIntervalMs: APP_TASK_RECOVERY_SAFETY_INTERVAL_MS,
      enqueue: (taskId, options) => {
        enqueueAppTask(controller, config, taskId, options);
      },
    });
    binding.recoveryScheduler = recoveryScheduler;
    recoverySchedulers.set(descriptor.id, recoveryScheduler);
    recoveryScheduler.start();
  }

  for (const [appId, controller] of controllers) {
    if (installedIds.has(appId)) continue;
    controller.close();
    controllers.delete(appId);
    bindings.delete(appId);
    recoverySchedulers.get(appId)?.close();
    recoverySchedulers.delete(appId);
  }

  appTaskControllersByBus.set(opts.bus, controllers);
  appTaskRecoverySchedulersByBus.set(opts.bus, recoverySchedulers);
  appTaskControllerBindingsByBus.set(opts.bus, bindings);
  return controllers;
}

/** Execute one exact Task locally inside an already prepared worker process. */
export async function reconcileLoadedAppTaskOnce(input: {
  bus: EventBus;
  appId: string;
  taskId: string;
  dispatch: AppTaskDispatch;
}): Promise<string[]> {
  const descriptor = loadedAppTaskRuntimeDescriptor(input.bus, input.appId);
  const opts = appRouterOptionsByBus.get(input.bus);
  if (!descriptor?.app.tasks || !opts) {
    throw new Error(`App ${input.appId} has no loaded Task runtime`);
  }
  return reconcileTask({
    opts: { ...opts, agentDefinitions: captureAgentDefinitions(opts) },
    descriptor,
    taskId: input.taskId,
    dispatch: input.dispatch,
    reason: "task-worker-process",
  });
}

/**
 * Stop the task-controller generation currently attached to one process bus.
 * Closing is synchronous; the returned promise additionally waits for work
 * already inside a reconcile to release its resources.
 */
export async function closeInstalledAppTaskRuntimes(bus: EventBus): Promise<void> {
  const controllers = appTaskControllersByBus.get(bus);
  if (!controllers) return;

  appTaskControllersByBus.delete(bus);
  appTaskControllerBindingsByBus.delete(bus);
  for (const scheduler of appTaskRecoverySchedulersByBus.get(bus)?.values() ?? []) scheduler.close();
  appTaskRecoverySchedulersByBus.delete(bus);
  for (const controller of controllers.values()) controller.close();
  await Promise.all([...controllers.values()].map((controller) => controller.whenDrained()));

  // The event subscriber is process-scoped and intentionally remains attached
  // to the bus. Once in-flight reconciliation has drained, empty its selected
  // generation unless a newer controller generation was installed meanwhile.
  if (!appTaskControllersByBus.has(bus)) {
    appRouterDescriptorsByBus.get(bus)?.splice(0);
    appRouterOptionsByBus.delete(bus);
  }
}

export function retryLoadedFailedAppTask(input: {
  bus: EventBus;
  appId: string;
  taskId: string;
  expectedGeneration: number;
  expectedResourceVersion: number;
  controlKey?: string;
}): ReturnType<typeof retryFailedAppTask> & { queued: boolean } {
  const appId = input.appId.trim().replace(/\.app$/, "");
  const taskId = input.taskId.trim();
  if (!appId || !taskId) throw new Error("App Task retry requires exact appId and taskId");
  if (!Number.isSafeInteger(input.expectedGeneration) || input.expectedGeneration < 1) {
    throw new Error("App Task retry requires a positive integer expectedGeneration");
  }
  if (!Number.isSafeInteger(input.expectedResourceVersion) || input.expectedResourceVersion < 1) {
    throw new Error("App Task retry requires a positive integer expectedResourceVersion");
  }
  const descriptor = loadedAppTaskRuntimeDescriptor(input.bus, appId);
  if (!descriptor?.app.tasks) throw new Error(`App ${appId} has no loaded task runtime`);
  const controller = appTaskControllersByBus.get(input.bus)?.get(appId);
  if (!controller || descriptor.reconciliationPaused) {
    throw new Error(`App ${appId} task reconciliation is unavailable`);
  }
  const config = appTaskConfig(descriptor);
  const receipt = retryFailedAppTask(config, {
    appId,
    taskId,
    expectedGeneration: input.expectedGeneration,
    expectedResourceVersion: input.expectedResourceVersion,
    ...(input.controlKey ? { controlKey: input.controlKey } : {}),
  });
  const queued = enqueueAppTask(controller, config, taskId, { promote: true });
  return { ...receipt, queued };
}

export function cancelLoadedAppTask(input: {
  bus: EventBus;
  appId: string;
  taskId: string;
  expectedGeneration: number;
  expectedResourceVersion: number;
  reason: string;
  controlKey?: string;
}): ReturnType<typeof cancelAppTask> {
  const appId = input.appId.trim().replace(/\.app$/, "");
  const taskId = input.taskId.trim();
  if (!appId || !taskId) throw new Error("App Task cancellation requires exact appId and taskId");
  if (!Number.isSafeInteger(input.expectedGeneration) || input.expectedGeneration < 1) {
    throw new Error("App Task cancellation requires a positive integer expectedGeneration");
  }
  if (!Number.isSafeInteger(input.expectedResourceVersion) || input.expectedResourceVersion < 1) {
    throw new Error("App Task cancellation requires a positive integer expectedResourceVersion");
  }
  const descriptor = loadedAppTaskRuntimeDescriptor(input.bus, appId);
  if (!descriptor?.app.tasks) throw new Error(`App ${appId} has no loaded task runtime`);
  const result = cancelAppTask(appTaskConfig(descriptor), {
    appId,
    taskId,
    expectedGeneration: input.expectedGeneration,
    expectedResourceVersion: input.expectedResourceVersion,
    reason: input.reason,
    ...(input.controlKey ? { controlKey: input.controlKey } : {}),
  });
  if (result.applied) {
    input.bus.emit({
      type: "app.task.cancelled",
      source: "app-task-reconciler",
      owner: "human:operator",
      target: { appId, taskId },
      data: {
        appId,
        taskId,
        ...(result.cancelledAttemptId ? { attemptId: result.cancelledAttemptId } : {}),
        reason: result.cancellation.reason,
      },
    });
    input.bus.emit({
      type: "app.dependency.updated",
      source: "app-task-reconciler",
      owner: "human:operator",
      data: { kind: "task", id: taskId, appId },
    });
  }
  return result;
}

function enqueueAppTask(
  controller: AppTaskController,
  config: AppTaskContext,
  taskId: string,
  overrides: AppTaskQueueOptions = {},
): boolean {
  const current = appTaskQueueEntries(config, [taskId])[0]?.options;
  return controller.enqueue(taskId, {
    ...current,
    ...overrides,
  });
}

const appTaskConfigs = new WeakMap<AppTaskRuntimeDescriptor, AppTaskContext>();

function appTaskConfig(descriptor: AppTaskRuntimeDescriptor): AppTaskContext {
  const existing = appTaskConfigs.get(descriptor);
  if (existing) return existing;
  const config = appTaskContext({
    appDir: descriptor.appDir,
    projectDir: descriptor.projectDir,
    agent: descriptor.agent,
    maxConcurrent: descriptor.app.tasks?.maxConcurrent ?? 1,
    resourceStore: descriptor.resourceStore,
  });
  cacheTaskSnapshots(config);
  appTaskConfigs.set(descriptor, config);
  return config;
}

/**
 * Attach App-owned work to the canonical App that shares its .app directory.
 * The existing reconciler remains the sole owner of task validation, state,
 * concurrency, session fencing, and execution.
 */
export function attachLoadedAppTask(input: {
  bus: EventBus;
  appDir: string;
  appId: string;
  attachment: AppTaskAttachment;
  idempotencyKey: string;
  request: Readonly<AppRequest>;
}): { taskId: string; isComplete: () => Promise<boolean> } {
  const normalizedAppDir = resolve(input.appDir);
  const descriptor = (appRouterDescriptorsByBus.get(input.bus) ?? []).find(
    (candidate) => resolve(candidate.appDir) === normalizedAppDir,
  );
  if (!descriptor) {
    throw new Error(`App ${input.appId} has no loaded task runtime in ${normalizedAppDir}`);
  }
  if (!descriptor.app.tasks) {
    throw new Error(`App ${descriptor.id} does not declare task reconciliation`);
  }
  const controller = appTaskControllersByBus.get(input.bus)?.get(descriptor.id);
  if (!controller && !descriptor.reconciliationPaused) {
    throw new Error(`App ${descriptor.id} task reconciliation is not active`);
  }
  const loaderOptions = appRouterOptionsByBus.get(input.bus);
  if (!loaderOptions) throw new Error(`App ${descriptor.id} task runtime is not attached`);

  const idempotencyKey = input.idempotencyKey.trim();
  if (!idempotencyKey) throw new Error("App task idempotency key must be non-empty");
  const config = appTaskConfig(descriptor);
  const humanRequested = input.request.source.kind === "human" || input.request.humanRequested === true;

  let intent: AppTaskIntent;
  if (input.attachment.kind === "existing") {
    const taskId = input.attachment.taskId.trim();
    if (!taskId) throw new Error("Existing task id must be non-empty");
    if (isAppTaskConverged(config, taskId)) {
      throw new Error(`Task ${taskId} in App ${descriptor.id} is already complete; create distinct follow-up work`);
    }
    const existingIntent = readAppTaskIntent(config, taskId);
    if (!existingIntent) {
      throw new Error(`Task ${taskId} does not exist in App ${descriptor.id}`);
    }
    intent = existingIntent;
  } else {
    intent = input.attachment.intent;
  }

  const observation = observeAppTaskIntent(config, {
    intent,
    appAgent: descriptor.agent,
    admissionKey: idempotencyKey,
    trigger: {
      type: "app.task.requested",
      source: humanRequested ? "human" : `app-inbox:${input.appId}`,
      owner: `agent:${descriptor.agent}`,
      target: { project: descriptor.id, taskId: intent.id },
      idempotencyKey,
      data: {
        project: descriptor.id,
        taskId: intent.id,
        appId: input.appId,
        idempotencyKey,
        request: input.request,
      },
    },
  });
  interruptSupersededObservationSessions(loaderOptions, observation);
  if (controller && observation.kind === "observed") {
    enqueueAppTask(controller, config, observation.taskId, {
      lane: humanRequested ? "human" : "normal",
    });
  }
  return {
    taskId: observation.taskId,
    isComplete: async () =>
      isAppTaskConverged(config, observation.taskId, observation.generation) &&
      !readAppTaskTrigger(config, observation.taskId),
  };
}

/** Read the stable task projection for an inbox dependency after any restart. */
export function readLoadedAppTaskView(input: { bus: EventBus; appDir: string; taskId: string }): TaskDetail | null {
  const normalizedAppDir = resolve(input.appDir);
  const descriptor = (appRouterDescriptorsByBus.get(input.bus) ?? []).find(
    (candidate) => resolve(candidate.appDir) === normalizedAppDir,
  );
  if (!descriptor) return null;
  return readRuntimeTaskView(
    {
      taskStateConfig: appTaskConfig(descriptor),
    },
    input.taskId,
  );
}

export function listLoadedAppTaskViews(input: { bus: EventBus; appId: string; options?: TaskListOptions }): TaskPage {
  const descriptor = (appRouterDescriptorsByBus.get(input.bus) ?? []).find(
    (candidate) => candidate.id === input.appId.trim().replace(/\.app$/, ""),
  );
  if (!descriptor) throw new Error(`App ${input.appId} has no loaded Task runtime`);
  return listRuntimeTaskViews(
    {
      taskStateConfig: appTaskConfig(descriptor),
    },
    input.options,
  );
}

export function listLoadedAppTaskOutcomeViews(input: {
  bus: EventBus;
  appId: string;
  projection?: TaskOutcomeProjection;
}): TaskOutcomePage {
  const descriptor = (appRouterDescriptorsByBus.get(input.bus) ?? []).find(
    (candidate) => candidate.id === input.appId.trim().replace(/\.app$/, ""),
  );
  if (!descriptor) throw new Error(`App ${input.appId} has no loaded Task runtime`);
  return listRuntimeTaskOutcomeViews(
    {
      taskStateConfig: appTaskConfig(descriptor),
    },
    input.projection,
  );
}

export function getLoadedAppTaskView(input: { bus: EventBus; appId: string; taskId: string }): TaskDetail | null {
  const descriptor = (appRouterDescriptorsByBus.get(input.bus) ?? []).find(
    (candidate) => candidate.id === input.appId.trim().replace(/\.app$/, ""),
  );
  if (!descriptor) throw new Error(`App ${input.appId} has no loaded Task runtime`);
  return readRuntimeTaskView(
    {
      taskStateConfig: appTaskConfig(descriptor),
    },
    input.taskId,
  );
}

/** Publish one event from the currently fenced Task attempt used by an executor tool. */
export function publishLoadedAppTaskEvent(input: {
  bus: EventBus;
  binding: { appId: string; taskId: string; generation: number; attemptId: string };
  localKey: string;
  event: AppTaskEmission;
}): number {
  const appId = input.binding.appId.trim().replace(/\.app$/, "");
  const descriptor = (appRouterDescriptorsByBus.get(input.bus) ?? []).find((candidate) => candidate.id === appId);
  if (!descriptor) throw new Error(`App ${input.binding.appId} has no loaded Task runtime`);
  const resource = descriptor.resourceStore.readTask(input.binding.taskId);
  const attempt = descriptor.resourceStore.readAttempt(input.binding.attemptId);
  if (
    !resource ||
    resource.metadata.generation !== input.binding.generation ||
    resource.status.phase !== "running" ||
    resource.status.currentAttemptId !== input.binding.attemptId ||
    !attempt ||
    attempt.state !== "running" ||
    attempt.taskId !== input.binding.taskId ||
    attempt.taskGeneration !== input.binding.generation
  ) {
    throw new Error(`Task ${appId}/${input.binding.taskId} attempt is no longer current`);
  }
  return createAppTaskEvents({
    bus: input.bus,
    appId,
    claim: {
      taskId: input.binding.taskId,
      generation: input.binding.generation,
      attemptId: input.binding.attemptId,
      agent: attempt.owner,
    },
  }).publish(input.localKey, input.event);
}

function emitAppTaskDependencyCompleted(
  opts: AppTaskRuntimeOptions,
  descriptor: AppTaskRuntimeDescriptor,
  taskId: string,
): void {
  opts.bus.emit({
    type: "app.dependency.completed",
    source: `app-task:${descriptor.id}:task-reconciler`,
    owner: `agent:${descriptor.agent}`,
    data: { kind: "task", id: taskId, appId: descriptor.id },
  });
}

function emitAppTaskDependencyUpdated(
  opts: AppTaskRuntimeOptions,
  descriptor: AppTaskRuntimeDescriptor,
  taskId: string,
): void {
  opts.bus.emit({
    type: "app.dependency.updated",
    source: `app-task:${descriptor.id}:task-reconciler`,
    owner: `agent:${descriptor.agent}`,
    data: { kind: "task", id: taskId, appId: descriptor.id },
  });
}

function recoverInterruptedAppTasks(
  opts: AppTaskRuntimeOptions,
  descriptors: AppTaskRuntimeDescriptor[],
  controllers: Map<string, AppTaskController>,
  includeFreshLeases = false,
): void {
  for (const descriptor of descriptors) {
    if (!descriptor.app.tasks) continue;
    const controller = controllers.get(descriptor.id);
    const config = appTaskConfig(descriptor);
    const runningRecoveryTaskIds = config.resourceStore.listTaskIdsByPhase(["running"], 512);
    const attentionRecoveryTaskIds = config.resourceStore.listTaskIdsByPhase(["attention"], 512);
    const waitingRecoveryTaskIds = config.resourceStore.listTaskIdsByPhase(["waiting"], 512);
    const releaseRecovery = (recovery: AppTaskAttemptRecovery, reason?: string) => {
      if (recovery.sessionId) {
        interruptSupersededAgentSession(
          opts,
          recovery.sessionId,
          `Recovered task ${recovery.taskId} interrupted an orphaned agent session from a previous runtime`,
          recovery.taskId,
        );
      }
      const released = releaseInterruptedAppTaskAttempt(
        config,
        recovery,
        reason ?? `Interrupted reconciliation ${recovery.taskId} belonged to a previous runtime`,
      );
      if (released.released && controller && !descriptor.reconciliationPaused) {
        enqueueAppTask(controller, config, recovery.taskId);
      }
    };
    for (const recovery of recoverableAppTaskAttempts(config, Date.now(), includeFreshLeases, runningRecoveryTaskIds)) {
      if (recovery.sessionId && hasLiveAppTaskSession(opts, recovery.sessionId)) {
        continue;
      }
      const persistedSession =
        recovery.sessionId && opts.persistDir ? readSessionMeta(opts.persistDir, recovery.sessionId) : null;
      if (recovery.sessionId && persistedSession?.status === "done") {
        let rejection: string | undefined;
        const consumed = consumePersistedTerminalAgentResult({
          persistDir: opts.persistDir,
          config,
          descriptor,
          taskId: recovery.taskId,
          sessionId: recovery.sessionId,
          onRejected: (error) => {
            rejection = error instanceof Error ? error.message : String(error);
          },
        });
        if (consumed) {
          emitTaskReconciliationEvent(opts, descriptor, undefined, "project.task.reconciled", recovery.taskId, {
            route: "terminal-agent-result-recovery",
            generation: consumed.claim.generation,
            attemptId: consumed.claim.attemptId,
            handler: consumed.claim.handler,
            disposition: consumed.state,
            summary: consumed.summary,
            evidence: consumed.evidence,
            actionsApplied: consumed.actionsApplied,
            evidenceSessionId: recovery.sessionId,
          });
          if (consumed.state === "converged") emitAppTaskDependencyCompleted(opts, descriptor, recovery.taskId);
          for (const taskId of consumed.reconcileTaskIds) {
            if (controller && !descriptor.reconciliationPaused) enqueueAppTask(controller, config, taskId);
          }
          continue;
        }
        if (rejection) {
          releaseRecovery(recovery, `Rejected terminal result for ${recovery.taskId}: ${rejection}`);
          continue;
        }
      }
      releaseRecovery(recovery);
    }
    const missingAttemptRepairs = repairRunningAppTasksWithoutAttempt(config, runningRecoveryTaskIds);
    for (const repair of missingAttemptRepairs) {
      if (controller && !descriptor.reconciliationPaused) {
        enqueueAppTask(controller, config, repair.taskId);
      }
    }
    const appDb = opts.persistDir ? getDb(opts.persistDir) : undefined;
    const dependencyRepairs = appDb
      ? repairUnadmittedAppDependencyWaits(
          config,
          (requestId) => Boolean(getAppInboxItem(appDb, requestId)),
          waitingRecoveryTaskIds,
        )
      : [];
    for (const repair of dependencyRepairs) {
      if (controller && !descriptor.reconciliationPaused) {
        enqueueAppTask(controller, config, repair.taskId);
      }
    }
    const repairs = repairPreviousRuntimeRecoveryAttention(config, attentionRecoveryTaskIds);
    if (repairs.length > 0) {
      opts.bus.emit({
        type: "project.task.recovery.repaired",
        source: `app-task:${descriptor.id}:task-recovery`,
        owner: `agent:${descriptor.agent}`,
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
          enqueueAppTask(controller, config, repair.taskId);
        }
      }
    }
    for (const taskId of replayPersistedConditionEvents(opts, descriptor, config)) {
      if (controller && !descriptor.reconciliationPaused) {
        enqueueAppTask(controller, config, taskId, { promote: true });
      }
    }
    const attentions = pendingAppTaskRecoveryAttention(config, attentionRecoveryTaskIds);
    if (attentions.length > 0 && !descriptor.reconciliationPaused) {
      opts.bus.emit(
        appOwnerReviewEvent({
          appId: descriptor.id,
          source: `app-task:${descriptor.id}:task-recovery`,
          sourceId: `task-recovery:${descriptor.id}:${attentions
            .map((attention) => attention.taskId)
            .sort()
            .join(",")}`,
          data: {
            project: descriptor.id,
            reason: "app-task-recovery-attention",
            taskIds: attentions.map((attention) => attention.taskId),
            summaries: Object.fromEntries(attentions.map((attention) => [attention.taskId, attention.summary])),
            instruction:
              "Some task attempts were active in a previous runtime but cannot be resumed because no trigger packet was persisted. Reconcile these review/attention tasks from fresh evidence, release stale capacity, and assign only bounded runnable follow-up work.",
          },
        }),
      );
      for (const attention of attentions) acknowledgeAppTaskRecoveryAttention(config, attention.taskId);
    }
  }
}

/**
 * Run the canonical App task recovery path for the descriptors and task
 * controllers already installed on this event bus. Startup calls this before
 * generic stale-session resumption so task-owned sessions are reconciled by
 * their durable task state first.
 */
export async function recoverInstalledAppTasks(bus: EventBus): Promise<void> {
  const opts = appRouterOptionsByBus.get(bus);
  if (!opts) return;
  if (opts.executeRecovery) {
    await opts.executeRecovery();
    for (const scheduler of appTaskRecoverySchedulersByBus.get(bus)?.values() ?? []) scheduler.recover();
    return;
  }
  const descriptors = appRouterDescriptorsByBus.get(bus) ?? [];
  const controllers = appTaskControllersByBus.get(bus) ?? new Map();
  recoverInterruptedAppTasks(opts, descriptors, controllers, true);
  await requeueAvailableAppTaskHandlers(opts, descriptors, controllers);
}

async function requeueAvailableAppTaskHandlers(
  opts: AppTaskRuntimeOptions,
  descriptors: AppTaskRuntimeDescriptor[],
  controllers: Map<string, AppTaskController>,
): Promise<void> {
  for (const descriptor of descriptors) {
    const controller = controllers.get(descriptor.id);
    if (!descriptor.app.tasks || descriptor.reconciliationPaused) continue;
    const config = appTaskConfig(descriptor);
    await recoverUnavailableTaskHandlers({
      config,
      isAvailable: createTaskHandlerAvailability({
        executors: opts.executors,
        workflowDir: (agent) => appWorkflowRuntimePaths(opts, descriptor, agent).workflowDir,
      }),
      isCurrent: () => appRouterOptionsByBus.get(opts.bus) === opts,
      onRecovered: (candidate) => {
        // Isolated recovery repairs readiness without installing controllers;
        // the parent discovers the pending Task through its normal recovery pass.
        if (controller) enqueueAppTask(controller, config, candidate.taskId);
        opts.bus.emit({
          type: "project.task.handler.recovered",
          source: `app-task:${descriptor.id}:task-recovery`,
          owner: `agent:${candidate.agent}`,
          target: { appId: descriptor.id },
          data: {
            project: descriptor.id,
            taskId: candidate.taskId,
            handler: candidate.handler,
            reason: "handler-binding-available",
          },
        } as unknown as AgentEvent);
      },
    });
  }
}

function attachAppEventRouter(opts: AppTaskRuntimeOptions, descriptors: AppTaskRuntimeDescriptor[]): void {
  appRouterOptionsByBus.set(opts.bus, opts);
  const existing = appRouterDescriptorsByBus.get(opts.bus);
  if (existing) {
    existing.splice(0, existing.length, ...descriptors);
    return;
  }

  appRouterDescriptorsByBus.set(opts.bus, descriptors);
  opts.bus.listen(
    (rawEvent): void => {
      if (rawEvent.type !== "session.start" && rawEvent.type !== "session.end") return;
      const event = flattenEvent(rawEvent);
      const startedSessionId =
        event.type === "session.start" && typeof event.sessionId === "string" ? event.sessionId.trim() : "";
      const sessionBinding = startedSessionId ? appTaskSessionBinding(event.taskBinding) : null;
      if (sessionBinding) {
        const descriptor = (appRouterDescriptorsByBus.get(opts.bus) ?? []).find(
          (candidate) => candidate.id === sessionBinding.appId,
        );
        if (descriptor?.app.tasks) {
          const association = associateAppTaskSession(appTaskConfig(descriptor), sessionBinding, startedSessionId);
          if (association.status !== "recorded") {
            interruptSupersededAgentSession(
              opts,
              startedSessionId,
              association.status === "missing"
                ? `Task ${sessionBinding.taskId} no longer exists; the reconciliation session is obsolete`
                : `Task ${sessionBinding.taskId} generation ${sessionBinding.generation} was superseded before its reconciliation session started`,
              sessionBinding.taskId,
            );
          }
        }
      }
      const successfulAgent =
        event.type === "session.end" &&
        event.status === "done" &&
        typeof event.agent === "string" &&
        event.agent.trim() &&
        typeof event.sessionId === "string" &&
        event.sessionId.trim()
          ? (() => {
              const sessionId = event.sessionId.trim();
              const scope = readAppTaskSessionScope(opts.persistDir, sessionId);
              const eventAppId = firstNonEmptyString(
                event.projectId,
                isRecord(event.data) ? event.data.projectId : undefined,
              )?.replace(/\.app$/, "");
              return {
                agent: event.agent.trim(),
                sessionId,
                appId: scope.binding?.appId ?? eventAppId ?? null,
                observedAt: new Date(typeof event.timestamp === "number" ? event.timestamp : Date.now()).toISOString(),
                binding: scope.binding,
                workflowRunId: firstNonEmptyString(
                  scope.workflowRunId,
                  event.workflowRunId,
                  isRecord(event.data) ? event.data.workflowRunId : undefined,
                ),
              };
            })()
          : null;
      const hasTaskRecoveryScope = Boolean(successfulAgent?.binding || successfulAgent?.workflowRunId);
      for (const descriptor of appRouterDescriptorsByBus.get(opts.bus) ?? []) {
        if (descriptor.reconciliationPaused) continue;
        const taskController = appTaskControllersByBus.get(opts.bus)?.get(descriptor.id);
        if (successfulAgent && hasTaskRecoveryScope && taskController && descriptor.app.tasks) {
          // A terminal task session can repair only attempts in its own App.
          // Avoid synchronously loading every unrelated App's task tree on each
          // session.end; large canonical trees otherwise block control traffic.
          // Legacy sessions with no binding or project identity keep the
          // conservative all-App scan used before project scoping existed.
          if (successfulAgent.appId && successfulAgent.appId !== descriptor.id) continue;
          const config = appTaskConfig(descriptor);
          if (
            successfulAgent.binding?.appId === descriptor.id &&
            workflowWasInterruptedByRestart(opts.persistDir, successfulAgent.workflowRunId)
          ) {
            const released = releaseLateTerminalWorkflowAppTaskAttempt(
              config,
              successfulAgent.binding,
              successfulAgent.sessionId,
              `Late terminal session ${successfulAgent.sessionId} cannot reattach to restart-interrupted workflow ${successfulAgent.workflowRunId}`,
            );
            if (released.released) {
              enqueueAppTask(taskController, config, released.taskId, { promote: true });
              opts.bus.emit({
                type: "project.task.recovery.requeued",
                source: `app-task:${descriptor.id}:task-recovery`,
                owner: `agent:${successfulAgent.agent}`,
                target: { appId: descriptor.id },
                data: {
                  project: descriptor.id,
                  taskId: released.taskId,
                  reason: "late-terminal-session-after-workflow-restart",
                  evidenceSessionId: successfulAgent.sessionId,
                  evidenceWorkflowRunId: successfulAgent.workflowRunId,
                },
              } as unknown as AgentEvent);
            }
          }
          for (const candidate of listHandlerExecutionFailedAppTasks(
            config,
            config.resourceStore.listHandlerExecutionRecoveryTaskIds(successfulAgent.agent, 512),
          )) {
            if (candidate.agent !== successfulAgent.agent) continue;
            if (
              !taskRecoverySessionScopesMatch(descriptor.id, opts.persistDir, candidate.sessionId, {
                binding: successfulAgent.binding,
                workflowRunId: successfulAgent.workflowRunId,
              })
            ) {
              continue;
            }
            const legacySession = candidate.failureReason === "handler-blocked" ? candidate.sessionId : undefined;
            const allowLegacyHandlerBlocked = Boolean(
              legacySession && opts.persistDir && readSessionMeta(opts.persistDir, legacySession)?.status === "error",
            );
            if (
              !releaseHandlerExecutionFailedAppTask(config, candidate.taskId, {
                agent: successfulAgent.agent,
                sessionId: successfulAgent.sessionId,
                observedAt: successfulAgent.observedAt,
                allowLegacyHandlerBlocked,
              })
            ) {
              continue;
            }
            enqueueAppTask(taskController, config, candidate.taskId);
            opts.bus.emit({
              type: "project.task.handler.recovered",
              source: `app-task:${descriptor.id}:task-recovery`,
              owner: `agent:${candidate.agent}`,
              target: { appId: descriptor.id },
              data: {
                project: descriptor.id,
                taskId: candidate.taskId,
                handler: "agent-execution",
                reason: "agent-session-succeeded-after-handler-execution-failure",
                evidenceSessionId: successfulAgent.sessionId,
                ...(successfulAgent.workflowRunId ? { evidenceWorkflowRunId: successfulAgent.workflowRunId } : {}),
              },
            } as unknown as AgentEvent);
          }
          if (successfulAgent.binding?.appId === descriptor.id) {
            enqueueAppTask(taskController, config, successfulAgent.binding.taskId, { promote: true });
          }
        }
      }
      return undefined;
    },
    { label: "app-task-session", types: ["session.start", "session.end"] },
  );
}

function validatePreparedAppTaskRuntime(descriptor: AppTaskRuntimeDescriptor): void {
  const { app, id } = descriptor;
  const concurrency = app.tasks?.maxConcurrent ?? 1;
  if (!Number.isInteger(concurrency) || concurrency <= 0) {
    throw new Error(`App ${id} task maxConcurrent must be a positive integer`);
  }
}

function discoverAppTaskResourceStore(
  persistDir: string | undefined,
  appId: string,
  appDir: string,
): AppTaskResourceStore {
  if (!persistDir) throw new Error(`App ${appId} task runtime requires the Host persistence directory`);
  const db = getDb(persistDir);
  const active = AppTaskResourceStore.activeFromDb(db, appId);
  if (active) return active;
  if (existsSync(projectRuntimePaths(appDir).taskStatePath)) {
    throw new Error(
      `App ${appId} has unsupported historical JSON task state but no active resource authority; inspect that evidence outside the Host or restore the canonical resource database`,
    );
  }

  const seedPath = join(appDir, "tasks", "seed.json");
  const seedText = existsSync(seedPath) ? readFileSync(seedPath, "utf8") : "{}";
  const parsed = JSON.parse(seedText) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`App ${appId} task seed must be a JSON object`);
  }
  const seed = parsed as Record<string, unknown>;
  const tree = {
    ...seed,
    project: typeof seed.project === "string" && seed.project.trim() ? seed.project : appId,
    project_lifecycle: seed.project_lifecycle === "paused" ? "paused" : "active",
    groups: seed.groups && typeof seed.groups === "object" && !Array.isArray(seed.groups) ? seed.groups : {},
    resources:
      seed.resources && typeof seed.resources === "object" && !Array.isArray(seed.resources) ? seed.resources : {},
    tasks: {},
  } as TaskTree;
  const sourceRevision = `seed:${createHash("sha256").update(seedText).digest("hex")}`;
  const store = AppTaskResourceStore.fromDb(db, appId);
  store.bootstrapSnapshot(tree, sourceRevision);
  const bootstrapped = AppTaskResourceStore.activeFromDb(db, appId);
  if (!bootstrapped) throw new Error(`App ${appId} task resource bootstrap did not publish authority`);
  return bootstrapped;
}

async function prepareAppTaskRuntimeDescriptors(opts: AppTaskRuntimeOptions): Promise<AppTaskRuntimeDescriptor[]> {
  const descriptors: AppTaskRuntimeDescriptor[] = [];
  const ids = new Set<string>();
  const selectedIds = opts.taskAppIds ? new Set(opts.taskAppIds.map((id) => id.trim().replace(/\.app$/, ""))) : null;
  const entries = opts.appRegistrySnapshot?.entries ?? opts.appRegistry?.snapshot().entries ?? [];
  for (const { appDir, definition: app } of entries) {
    if (!app.tasks) continue;
    const id = app.id;
    if (selectedIds && !selectedIds.has(id)) continue;
    if (ids.has(id)) throw new Error(`Duplicate App task runtime id: ${id}`);
    ids.add(id);
    const resourceStore = discoverAppTaskResourceStore(opts.persistDir, id, appDir);
    const descriptor: AppTaskRuntimeDescriptor = {
      id,
      appDir,
      projectDir: domainProjectDir(opts.projectsRoot, appDir, id, app),
      agent: configuredAppAgent(app, appDir),
      app,
      reconciliationPaused: false,
      resourceStore,
    };
    descriptor.reconciliationPaused = resourceStore.projectLifecycle() === "paused";
    validatePreparedAppTaskRuntime(descriptor);
    resourceStore.setConfiguredMaxConcurrent(app.tasks.maxConcurrent ?? 1);
    descriptors.push(descriptor);
  }
  return descriptors;
}

async function commitAppTaskRuntimeDescriptors(
  opts: AppTaskRuntimeOptions,
  prepared: AppTaskRuntimeDescriptor[],
  recovery: { includeFreshLeases: boolean; deferred: boolean },
): Promise<{ installed: AppTaskRuntimeDescriptor[] }> {
  const installed: AppTaskRuntimeDescriptor[] = [];
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
        message: `[app-task] Skipping ${id}: required app agent "${missingAgent}" not registered and local registration failed`,
      });
      continue;
    }
    if (opts.syncReadModels !== false) syncProjectReadModel(opts, descriptor);
    installed.push(descriptor);
  }

  const controllers = installConventionTaskControllers(opts, installed);

  if (installed.length > 0 || appRouterDescriptorsByBus.has(opts.bus)) {
    attachAppEventRouter(opts, installed);
  }
  // This is the one synchronous publication boundary. Controller bindings,
  // App routing, agent definitions, and the public registry become visible in
  // one turn; queued reconciliation cannot run until the turn is released.
  opts.afterCommit?.({ installed });
  const agentDefinitions = captureAgentDefinitions(opts);
  if (agentDefinitions) {
    for (const descriptor of installed) {
      const binding = appTaskControllerBindingsByBus.get(opts.bus)?.get(descriptor.id);
      if (binding) binding.opts = { ...binding.opts, agentDefinitions };
    }
  }
  if (!recovery.deferred) {
    recoverInterruptedAppTasks(opts, installed, controllers, recovery.includeFreshLeases);
    await requeueAvailableAppTaskHandlers(opts, installed, controllers);
  }

  return { installed };
}

export async function installAppTaskRuntimes(
  opts: AppTaskRuntimeOptions,
  recovery: { includeFreshLeases?: boolean; deferRecovery?: boolean } = {},
): Promise<{ installed: AppTaskRuntimeDescriptor[] }> {
  const prepared = await prepareAppTaskRuntimeDescriptors(opts);
  const previous = [...(appRouterDescriptorsByBus.get(opts.bus) ?? [])];
  let published = false;
  try {
    return await commitAppTaskRuntimeDescriptors(
      {
        ...opts,
        afterCommit: (result) => {
          opts.afterCommit?.(result);
          published = true;
        },
      },
      prepared,
      {
        includeFreshLeases: recovery.includeFreshLeases === true,
        deferred: recovery.deferRecovery === true,
      },
    );
  } catch (error) {
    // Once publication succeeded, recovery errors must not roll the visible
    // generation backward. Normal indexed recovery will retry the work.
    if (published) throw error;
    try {
      await commitAppTaskRuntimeDescriptors({ ...opts, afterCommit: undefined }, previous, {
        includeFreshLeases: false,
        deferred: false,
      });
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "App task runtime reload failed and the previous App set could not be restored",
      );
    }
    throw error;
  }
}
