import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  readdirSync,
  rmSync,
  rmdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { SubagentManager } from "../lib/index.js";
import type { EventEnvelope } from "../lib/handler-context.js";
import { buildRuntimeCtx } from "../lib/runtime-ctx.js";
import { inspectWorkflowDefinition, runWorkflowDirect, WorkflowHandlerUnavailable } from "../lib/workflow-tool.js";
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
import { cacheTaskStateReads, readTaskState, type TaskTree } from "./app-task-store.js";
import { appTaskExecutionPaths, withAppTaskWorkspace, type AppTaskExecutionPaths } from "./app-task-output-paths.js";
import type { TaskListOptions, TaskPage, TaskView } from "@may-agent/sdk/app";
import { listRuntimeTaskViews, readRuntimeTaskView } from "./app-read.js";
import { appOwnerReviewEvent } from "./app-input-event.js";
import { getAppInboxItem } from "./app-inbox-store.js";
import { canonicalAppEvent } from "./canonical-app-event.js";
import type { AppRegistry, AppRegistrySnapshot } from "./app-registry.js";
import { AppTaskController, type AppTaskDispatch } from "./app-task-controller.js";
import { AppTaskRecoveryScheduler } from "./app-task-recovery.js";
import { AppTaskResourceStore } from "./app-task-resource-store.js";
import { createAppTaskEvents, type AppTaskEmission, type AppTaskEvents } from "./app-task-emitter.js";
import { executeTaskWithCli, type TaskCliTool } from "./app-task-cli-executor.js";
import { HostCapacity } from "./host-capacity.js";
import type { AppTaskQueueOptions } from "./app-task-queue.js";
import {
  matchingAppTaskConditionTaskIds,
  trackAppTaskConditionEventForTasks,
  trackAppTaskConditionEvents,
} from "./app-task-condition-tracker.js";
import { childEventTrace, EVENT_ROW_ID, type AgentEvent, type DeliveryResult, type EventBus } from "./event-bus.js";
import {
  acknowledgeAppTaskRecoveryAttention,
  associateAppTaskSession,
  claimObservedAppTask,
  completeAppTask,
  deferAppTask,
  listHandlerExecutionFailedAppTasks,
  listHandlerUnavailableAppTasks,
  listWorkspacePreparationFailedAppTasks,
  markAppTaskAttention,
  pendingAppTaskRecoveryAttention,
  listAppTaskIntents,
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
  releaseHandlerUnavailableAppTask,
  releaseWorkspacePreparationFailedAppTask,
  repairPreviousRuntimeRecoveryAttention,
  repairRunningAppTasksWithoutAttempt,
  recoverableAppTaskAttempts,
  expiredAgentSessionAppTaskAttempt,
  terminalAgentSessionAppTaskClaim,
  releaseInterruptedAppTaskAttempt,
  releaseLateTerminalWorkflowAppTaskAttempt,
  releaseTerminalSessionExpiredAppTaskAttempt,
  releaseStaleAppTaskResult,
  recordAppTaskAttemptSession,
  recordAppTaskAttemptWorkspace,
  taskReconciliationConfig,
  renewAppTaskAttemptLease,
  APP_TASK_ATTEMPT_LEASE_DURATION_MS,
  APP_TASK_RECOVERY_OWNER,
  type AppTaskAttemptRecovery,
  type AppTaskChildContext,
  type AppTaskClaim,
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
const APP_TASK_CLI_TIMEOUT_MS = 30 * 60_000;

export interface AppTaskRuntimeDescriptor {
  id: string;
  appDir: string;
  projectDir: string;
  agent: string;
  app: AppDefinition;
  reconciliationPaused: boolean;
  /** Present only when this App has completed the guarded resource-store cutover. */
  resourceStore?: AppTaskResourceStore;
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
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function parseAppTaskSessionBinding(
  task: unknown,
): { appId: string; taskId: string; generation: number } | null {
  if (typeof task !== "string" || !task.includes("## Reconciliation Task")) return null;
  const blocks = task.matchAll(/## Reconciliation Task\s*```json\s*([\s\S]*?)```/g);
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block[1] ?? "") as unknown;
      if (!isRecord(parsed)) continue;
      const appId = typeof parsed.appId === "string" ? parsed.appId.trim().replace(/\.app$/, "") : "";
      const taskId = typeof parsed.taskId === "string" ? parsed.taskId.trim() : "";
      const generation = parsed.generation;
      if (appId && taskId && typeof generation === "number" && Number.isInteger(generation) && generation > 0) {
        return { appId, taskId, generation };
      }
    } catch {
      // A malformed prompt block is not a task binding.
    }
  }
  return null;
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
    binding: parseAppTaskSessionBinding(meta.task),
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

function readJsonObject(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
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

function requiredAppAgentNames(descriptor: AppTaskRuntimeDescriptor): string[] {
  return [descriptor.agent];
}

async function ensureAppAgentRegistered(
  opts: AppTaskRuntimeOptions,
  descriptor: AppTaskRuntimeDescriptor,
  agentName: string,
): Promise<boolean> {
  if (opts.manager.hasAgent(agentName)) return true;

  const agentDir = localAgentDir(descriptor.appDir, agentName);
  const registered = opts.registerLocalAgent
    ? await opts.registerLocalAgent(agentName, descriptor.appDir, agentDir)
    : false;

  return registered || opts.manager.hasAgent(agentName);
}

type TaskCapabilityRun = {
  handlerResult: NormalizedTaskHandlerResult;
  runId: string | null;
  verifier?: { name: string; sourcePath: string; verify: AppTaskVerifier };
  unavailable?: boolean;
  executionFailed?: boolean;
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
  summary: string;
  response?: string;
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
          summary: `Handler result was rejected: actions[${index}] ${problem}`,
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
  config: ReturnType<typeof taskReconciliationConfig>;
  descriptor: AppTaskRuntimeDescriptor;
  taskId: string;
  sessionId: string;
  onRejected?: (error: unknown) => void;
}): PersistedTerminalAgentResultConsumption | null {
  const raw = readPersistedTerminalAgentResult(input.persistDir, input.sessionId);
  if (raw === undefined) return null;
  const claim = terminalAgentSessionAppTaskClaim(input.config, input.taskId, input.sessionId);
  if (!claim) return null;
  const defaultParentId = readTaskState(input.config).root_task_id;
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
      recoveryOwner: APP_TASK_RECOVERY_OWNER,
      ...(descriptor.resourceStore ? { taskEmitter: input.taskEvents } : {}),
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
      },
    );
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
      ...(!done ? { executionFailed: true } : {}),
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
    ...(input.event ? { event: input.event } : {}),
    execute: (attempt, taskEvents) => executeTaskCapability({ ...input, attempt, taskEvents }),
  });
}

/** Project the exact persisted attempt batch onto the public workflow contract. */
export function projectAppTaskReconciliationEvents(claim: AppTaskClaim): {
  items: Array<{
    eventId?: number;
    observedAt: string;
    event: ReturnType<typeof canonicalAppEvent>;
  }>;
  throughEventId?: number;
  truncated: boolean;
} {
  const items = claim.events.map((entry) => {
    const eventId = Number(entry.event.eventId);
    return {
      ...(Number.isSafeInteger(eventId) && eventId > 0 ? { eventId } : {}),
      observedAt: entry.observedAt,
      event: canonicalAppEvent(entry.event as AgentEvent),
    };
  });
  const eventIds = items.flatMap((item) => (item.eventId === undefined ? [] : [item.eventId]));
  return {
    items,
    ...(eventIds.length === items.length && eventIds.length > 0 ? { throughEventId: Math.max(...eventIds) } : {}),
    truncated: claim.eventsTruncated,
  };
}

type RuntimeTaskAttempt = {
  attempt: TaskAttempt;
  events: AppTaskEvents;
  close(): void;
};

/** Build the one fenced Task interface shared by every executor adapter. */
function runtimeTaskAttempt(input: {
  opts: AppTaskRuntimeOptions;
  descriptor: AppTaskRuntimeDescriptor;
  claim: AppTaskClaim;
  cwd: string;
  event?: EventEnvelope;
}): RuntimeTaskAttempt {
  const { opts, descriptor, claim } = input;
  const task = readRuntimeTaskView(
    {
      executionPaths: { appDir: descriptor.appDir, projectDir: descriptor.projectDir },
      taskStateConfig: appTaskConfig(descriptor),
    },
    claim.taskId,
  );
  if (!task || task.generation !== claim.generation) {
    throw new Error(`Task ${descriptor.id}/${claim.taskId} is no longer current`);
  }
  const events = createAppTaskEvents({
    bus: opts.bus,
    appId: descriptor.id,
    claim,
    ...(input.event ? { parentEvent: input.event as AgentEvent } : {}),
  });
  const subscriptions = new Set<() => void>();
  let closed = false;
  return {
    events,
    attempt: {
      appId: descriptor.id,
      attemptId: claim.attemptId,
      resourceVersion: claim.resourceVersion,
      task: structuredClone(task),
      cwd: input.cwd,
      events: projectAppTaskReconciliationEvents(claim),
      async publish(localKey, event) {
        if (closed) throw new Error(`Task ${descriptor.id}/${claim.taskId} attempt is closed`);
        const { localKey: _embeddedLocalKey, source: _source, ...emitted } = event;
        return { eventId: events.publish(localKey, emitted as AppTaskEmission) };
      },
      onEvent(listener) {
        if (closed) throw new Error(`Task ${descriptor.id}/${claim.taskId} attempt is closed`);
        const unsubscribe = events.onEvent((incoming) => listener(canonicalAppEvent(incoming)));
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
    close() {
      if (closed) return;
      closed = true;
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
}): AppTaskConditionSpec[] {
  const dependencyIds = new Set<string>();
  for (const dependency of input.dependencies) {
    if (dependencyIds.has(dependency.id)) {
      throw new Error(`Task result declares App dependency ${dependency.id} more than once`);
    }
    dependencyIds.add(dependency.id);
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

  for (const dependency of input.dependencies) {
    const direct = existing.filter(
      ({ condition, requestId }) =>
        dependency.id === requestId || dependency.id === condition.id || dependency.id === `app-request:${requestId}`,
    );
    const exact = existing.filter(
      ({ item }) => item && item.appId === dependency.appId && isDeepStrictEqual(item.input, dependency.input),
    );
    const candidates = direct.length > 0 ? direct : exact;
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
  }
  for (let index = 0; index < newDependencies.length; index += 1) {
    const dependency = newDependencies[index]!;
    const duplicate = newDependencies
      .slice(0, index)
      .find(
        (candidate) => candidate.appId === dependency.appId && isDeepStrictEqual(candidate.input, dependency.input),
      );
    if (duplicate) {
      throw new Error(
        `App dependencies ${duplicate.id} and ${dependency.id} request the same ${dependency.appId} outcome`,
      );
    }
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
          targetInput: dependency.input,
        }),
      )
      .digest("hex")
      .slice(0, 24);
    const requestId = `appdep_${identity}`;
    const idempotencyKey = `task-dependency:${input.descriptor.id}:${input.claim.taskId}:${input.claim.generation}:${dependency.id}:${identity}`;
    input.opts.bus.emit({
      type: "app.input.requested",
      source: `app-task:${input.descriptor.id}`,
      owner: `app:${dependency.appId}`,
      data: {
        requestId,
        appId: dependency.appId,
        input: dependency.input,
        source: { kind: "app", id: input.descriptor.id },
        idempotencyKey,
      },
    });
    admitted.set(dependency.id, {
      id: `app-request:${requestId}`,
      type: "app.dependency.completed",
      subject: `id:${requestId}`,
      expected: { field: "status", equals: "done" },
    });
  }

  return input.dependencies.map((dependency) => matches.get(dependency.id)?.condition ?? admitted.get(dependency.id)!);
}

function openTaskAppDependencyConditions(
  config: ReturnType<typeof taskReconciliationConfig>,
  taskId: string,
): AppTaskConditionSpec[] {
  const tree = readTaskState(config, { taskIds: [taskId] });
  const resource = tree.resources?.[taskId];
  return (resource?.status.conditionIds ?? []).flatMap((conditionId) => {
    const condition = tree.conditions?.[conditionId];
    if (!condition || condition.status.state === "true" || condition.spec.type !== "app.dependency.completed") {
      return [];
    }
    return [{ id: condition.metadata.id, ...structuredClone(condition.spec) }];
  });
}

function mergeTaskConditions(conditions: AppTaskConditionSpec[]): AppTaskConditionSpec[] {
  const merged = new Map<string, AppTaskConditionSpec>();
  for (const condition of conditions) {
    const current = merged.get(condition.id);
    if (current && !isDeepStrictEqual(current, condition)) {
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

function extractReconciliationTaskId(taskPrompt: string | undefined): string | null {
  if (!taskPrompt) return null;
  const match = taskPrompt.match(/"taskId"\s*:\s*"([^"]+)"/);
  return match?.[1]?.trim() || null;
}

function summarizeInterruptedAgentRecovery(input: {
  meta: { task?: string; source?: string };
  persistDir: string;
  sessionId: string;
  reason: string;
  repairedPendingTools: string[];
  taskId?: string;
}): { summary: string; taskId: string | null; evidence: string[] } {
  const taskId = input.taskId?.trim()
    ? input.taskId.trim()
    : input.meta.source === "app-task-agent" ||
        input.meta.source === "app-task-owner" ||
        input.meta.source === "project-app-task-owner"
      ? extractReconciliationTaskId(input.meta.task)
      : null;
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

export type CanonicalAgentResidueCleanupPlan = {
  guard: CanonicalUntrackedResidueGuard;
  expectedIndexData: Buffer;
  restoreIndex: boolean;
  files: Map<string, PlannedResidueFileRestore>;
};

function gitPathSet(projectDir: string, args: string[]): Set<string> {
  const output = execFileSync("git", ["-C", projectDir, ...args]);
  return new Set(output.toString("utf8").split("\0").filter(Boolean));
}

function canonicalUntrackedFiles(projectDir: string): Set<string> {
  return gitPathSet(projectDir, ["ls-files", "--others", "--exclude-standard", "--full-name", "-z"]);
}

function canonicalDirtyTrackedFiles(projectDir: string): Set<string> {
  return new Set([
    ...gitPathSet(projectDir, ["ls-files", "--modified", "--deleted", "-z"]),
    ...gitPathSet(projectDir, ["diff", "--cached", "--name-only", "-z"]),
  ]);
}

function safeResiduePath(projectDir: string, relativePath: string): string {
  const absolutePath = resolve(projectDir, relativePath);
  const fromRoot = relative(projectDir, absolutePath);
  if (!fromRoot || fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
    throw new Error(`Refusing to access unsafe agent residue path: ${relativePath}`);
  }
  return absolutePath;
}

function snapshotResidueFile(projectDir: string, relativePath: string): ResidueFileSnapshot {
  const absolutePath = safeResiduePath(projectDir, relativePath);
  if (!existsSync(absolutePath)) return { exists: false };
  const stat = lstatSync(absolutePath);
  if (stat.isSymbolicLink()) return { exists: true, kind: "symlink", target: readlinkSync(absolutePath) };
  return { exists: true, kind: "file", data: readFileSync(absolutePath), mode: stat.mode };
}

function restoreResidueFile(projectDir: string, relativePath: string, snapshot: ResidueFileSnapshot): void {
  const absolutePath = safeResiduePath(projectDir, relativePath);
  if (existsSync(absolutePath)) rmSync(absolutePath, { recursive: true, force: true });
  if (!snapshot.exists) return;
  mkdirSync(dirname(absolutePath), { recursive: true });
  if (snapshot.kind === "symlink") {
    symlinkSync(snapshot.target, absolutePath);
    return;
  }
  writeFileSync(absolutePath, snapshot.data);
  chmodSync(absolutePath, snapshot.mode);
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
export function beginCanonicalAgentResidueGuard(paths: AppTaskExecutionPaths): CanonicalUntrackedResidueGuard | null {
  if (paths.workspaceDir !== paths.projectDir) return null;
  try {
    const topLevel = resolve(
      execFileSync("git", ["-C", paths.projectDir, "rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim(),
    );
    if (topLevel !== resolve(paths.projectDir)) return null;
    const rawIndexPath = execFileSync("git", ["-C", paths.projectDir, "rev-parse", "--git-path", "index"], {
      encoding: "utf8",
    }).trim();
    const indexPath = isAbsolute(rawIndexPath) ? rawIndexPath : resolve(paths.projectDir, rawIndexPath);
    const dirtyTrackedPaths = canonicalDirtyTrackedFiles(paths.projectDir);
    const untrackedPaths = canonicalUntrackedFiles(paths.projectDir);
    const indexData = readFileSync(indexPath);
    const dirtyTracked = new Map(
      [...dirtyTrackedPaths].map((path) => [path, snapshotResidueFile(paths.projectDir, path)] as const),
    );
    const untracked = new Map(
      [...untrackedPaths].map((path) => [path, snapshotResidueFile(paths.projectDir, path)] as const),
    );
    return {
      projectDir: paths.projectDir,
      indexPath,
      indexData,
      indexMode: lstatSync(indexPath).mode,
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
      "The correlated deploy succeeded. Do not deploy again. Verify that loadedArtifactSha equals artifactSha, health is healthy, targetedWake is true, and duplicateDeploy is false; then complete agent reconciliation.",
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

export function planCanonicalAgentResidueCleanup(
  guard: CanonicalUntrackedResidueGuard | null,
): CanonicalAgentResidueCleanupPlan | null {
  if (!guard || !existsSync(guard.indexPath)) return null;

  const expectedIndexData = readFileSync(guard.indexPath);
  const dirtyTrackedPaths = canonicalDirtyTrackedFiles(guard.projectDir);
  const untrackedPaths = canonicalUntrackedFiles(guard.projectDir);
  const currentPaths = new Set([
    ...guard.dirtyTracked.keys(),
    ...guard.untracked.keys(),
    ...dirtyTrackedPaths,
    ...untrackedPaths,
  ]);
  const files = new Map<string, PlannedResidueFileRestore>();
  for (const path of currentPaths) {
    const expected = snapshotResidueFile(guard.projectDir, path);
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

function restoreResidueFileFromBaselineIndex(guard: CanonicalUntrackedResidueGuard, relativePath: string): void {
  const temporaryIndex = `${guard.indexPath}.agent-residue-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(temporaryIndex, guard.indexData);
    chmodSync(temporaryIndex, guard.indexMode);
    execFileSync("git", ["-C", guard.projectDir, "checkout-index", "--force", "--", relativePath], {
      env: { ...process.env, GIT_INDEX_FILE: temporaryIndex },
    });
  } finally {
    rmSync(temporaryIndex, { force: true });
  }
}

export function applyCanonicalAgentResidueCleanup(plan: CanonicalAgentResidueCleanupPlan | null): string[] {
  if (!plan) return [];
  const { guard } = plan;
  const restored: string[] = [];

  for (const [relativePath, filePlan] of plan.files) {
    const current = snapshotResidueFile(guard.projectDir, relativePath);
    if (!residueSnapshotsEqual(current, filePlan.expected)) continue;
    if (filePlan.restore === "index") {
      restoreResidueFileFromBaselineIndex(guard, relativePath);
    } else {
      restoreResidueFile(guard.projectDir, relativePath, filePlan.restore);
    }
    restored.push(`file:${relativePath}`);
    if (filePlan.restore === "index" || filePlan.restore.exists) continue;
    let parent = dirname(safeResiduePath(guard.projectDir, relativePath));
    while (parent !== guard.projectDir) {
      try {
        rmdirSync(parent);
      } catch {
        break;
      }
      parent = dirname(parent);
    }
  }

  if (
    plan.restoreIndex &&
    existsSync(guard.indexPath) &&
    readFileSync(guard.indexPath).equals(plan.expectedIndexData)
  ) {
    writeFileSync(guard.indexPath, guard.indexData);
    chmodSync(guard.indexPath, guard.indexMode);
    restored.push("index");
  }
  return restored;
}

export function finishCanonicalAgentResidueGuard(guard: CanonicalUntrackedResidueGuard | null): string[] {
  return applyCanonicalAgentResidueCleanup(planCanonicalAgentResidueCleanup(guard));
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

/** Compact bounded-agent rules; the finish tool schema enforces field-level detail. */
export function appTaskAgentProtocol(appId: string): string {
  return [
    `You are the bounded agent for one Task attempt owned by App ${appId}.`,
    "Perform the next bounded work needed by the task outcome and acceptance. Use current evidence and tools; do not edit Host task storage.",
    "Finish exactly once with finish().result. The tool schema is authoritative. A successful session without result does not resolve the task.",
    "Return state converged only when current evidence satisfies this task. Include a direct response when a caller is owed one.",
    "Return state waiting only for an exact observable Condition, a live direct child, or a typed App dependency. Otherwise do the bounded work now or report supported attention through the runtime failure path.",
    "For another App outcome, return a stable dependency { id, appId, input }. Runtime publishes and correlates it; do not publish app.input.requested yourself.",
    "Required decomposition creates direct children and keeps this task waiting. A successor is independent work after this task already converged. dependsOn expresses execution order.",
    "Task actions must use the schema, expected generations, and real task IDs. Do not mutate the current task with an action; your result advances it. Completed receipts are immutable.",
    "After first acceptance-critical evidence, checkpoint a concise summary, next step, and exact artifact/session paths. Refresh only when those facts change, then finish promptly.",
    "For unresolved human work, give an exact useful response or a bounded wait with reviewAfterMs of at least 60000. Do not expose delivery or Host internals.",
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
        paths: input.executionPaths,
        declaredOutputs: input.declaredOutputPaths,
        fallbackReason: input.fallbackReason ?? null,
      },
      null,
      2,
    ),
    "```",
    ...(/deploy|restart/i.test(intent.outcome) ||
    input.declaredOutputPaths.some((path) => path.includes("deploy-receipts"))
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
    toolPolicy: "full" as const,
    timeout: APP_TASK_AGENT_TIMEOUT_MS,
    executionRoot: input.executionPaths.workspaceDir,
  };
  const dispatchAgent = async () =>
    typeof opts.manager.run === "function" &&
    typeof opts.manager.waitFor === "function" &&
    typeof opts.manager.progress === "function"
      ? await (async () => {
          const sessionId = opts.manager.run(claim.agent, prompt, {
            source: agentOptions.source,
            kind: "call",
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
          });
          recordAppTaskAttemptSession(appTaskConfig(descriptor), claim, sessionId);
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
          }
        })()
      : await opts.manager.callAgent(claim.agent, prompt, agentOptions);
  const residueGuard = beginCanonicalAgentResidueGuard(input.executionPaths);
  let restoredAgentResidue: string[] = [];
  let result: Awaited<ReturnType<typeof dispatchAgent>>;
  try {
    input.observer?.providerStarted(Buffer.byteLength(prompt));
    result = await dispatchAgent();
  } finally {
    input.observer?.providerFinished();
    const cleanupPlan = planCanonicalAgentResidueCleanup(residueGuard);
    restoredAgentResidue = applyCanonicalAgentResidueCleanup(cleanupPlan);
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

function appTaskCliProtocol(appId: string): string {
  return [
    `You are the bounded CLI executor for one Task attempt owned by App ${appId}.`,
    "Perform the next concrete work needed by the Task. The Task resource, not this CLI process or native session, owns status and retries.",
    "Do not edit Host task storage. Use the supplied workspace and paths only.",
    "Your final response must be exactly one JSON object with no Markdown fence or surrounding prose.",
    'Return {"state":"converged"|"waiting","summary":"...","response":"...","evidence":[...],"actions":[],"conditions":[],"dependencies":[]}.',
    "Omit optional fields when unused. Converge only when the acceptance criteria are supported by current evidence.",
    "Wait only for an exact observable Condition, a live direct child, or a typed App dependency; otherwise complete one bounded useful step now.",
    "Task events that arrive after this process starts remain durable and will wake the next attempt; do not invent a separate work lifecycle.",
    DEPENDENCY_OBSERVATION_AUTHORITY_INSTRUCTION,
  ].join("\n");
}

async function executeTaskCli(input: {
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
  tool: TaskCliTool;
}): Promise<TaskCapabilityRun> {
  const { opts, descriptor, intent, claim } = input;
  if (!opts.persistDir) {
    return {
      handlerResult: {
        state: "error",
        summary: `Task executor ${input.tool} requires the Host persistence directory`,
        evidence: [],
        actions: [],
      },
      runId: null,
      unavailable: true,
    };
  }
  const reconciliationEvents = input.attempt.events;
  const prompt = [
    appTaskCliProtocol(descriptor.id),
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
        executor: input.tool,
        mode: claim.mode,
        outcome: intent.outcome,
        acceptance: intent.acceptance,
        input: intent.input ?? {},
        children: projectAppTaskChildPromptContext(input.childContext),
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
  const residueGuard = beginCanonicalAgentResidueGuard(input.executionPaths);
  let restoredResidue: string[] = [];
  let execution: Awaited<ReturnType<typeof executeTaskWithCli>>;
  try {
    input.observer?.providerStarted(Buffer.byteLength(prompt));
    execution = await executeTaskWithCli({
      bus: opts.bus,
      persistDir: opts.persistDir,
      appId: descriptor.id,
      taskId: claim.taskId,
      generation: claim.generation,
      attemptId: claim.attemptId,
      owner: claim.agent,
      tool: input.tool,
      cwd: input.executionPaths.workspaceDir,
      prompt,
      timeoutMs: APP_TASK_CLI_TIMEOUT_MS,
      ...(childEventTrace(input.event) ? { trace: childEventTrace(input.event) } : {}),
    });
  } finally {
    input.observer?.providerFinished();
    restoredResidue = finishCanonicalAgentResidueGuard(residueGuard);
  }
  if (execution.status === "failed") {
    return {
      handlerResult: {
        state: "error",
        summary: execution.summary,
        evidence: execution.evidence,
        actions: [],
      },
      runId: execution.cliTaskId,
      executionFailed: true,
    };
  }
  const normalized = normalizeTaskHandlerResult(
    execution.result,
    { type: "done", summary: `${input.tool} CLI completed`, runId: execution.cliTaskId },
    {
      allowNeedsAgent: false,
      defaultParentId: input.defaultParentId,
      rootParentAliases: [input.descriptor.id, basename(input.descriptor.projectDir)],
      validateAction: input.descriptor.app.tasks?.validateAction,
    },
  );
  normalized.evidence = [...new Set([...normalized.evidence, ...execution.evidence])];
  const handlerResult = rejectConvergedDirectAgentResidue(normalized, restoredResidue);
  return {
    handlerResult,
    runId: execution.cliTaskId,
    ...(handlerResult.state === "error" ? { executionFailed: true } : {}),
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
  event?: EventEnvelope;
  execute: (attempt: TaskAttempt, events: AppTaskEvents) => Promise<TaskCapabilityRun>;
}): Promise<TaskCapabilityRun> {
  const taskAttempt = runtimeTaskAttempt({
    opts: input.opts,
    descriptor: input.descriptor,
    claim: input.claim,
    cwd: input.executionPaths.workspaceDir,
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
    return await input.execute(taskAttempt.attempt, taskAttempt.events);
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
    ...(input.event ? { event: input.event } : {}),
    execute: (attempt) => executeTaskAgent({ ...input, attempt }),
  });
}

async function runTaskCli(input: Omit<Parameters<typeof executeTaskCli>[0], "attempt">): Promise<TaskCapabilityRun> {
  return runTaskExecutorAttempt({
    opts: input.opts,
    descriptor: input.descriptor,
    claim: input.claim,
    executionPaths: input.executionPaths,
    ...(input.event ? { event: input.event } : {}),
    execute: (attempt) => executeTaskCli({ ...input, attempt }),
  });
}

async function runRegisteredTaskExecutor(input: {
  opts: AppTaskRuntimeOptions;
  descriptor: AppTaskRuntimeDescriptor;
  claim: AppTaskClaim;
  defaultParentId: string;
  executionPaths: AppTaskExecutionPaths;
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

const MAX_PROMPT_CHILD_TEXT = 256;
const MAX_PROMPT_CHILD_EVIDENCE = 2;

function boundedPromptChildText(value: string): string {
  return value.length <= MAX_PROMPT_CHILD_TEXT ? value : `${value.slice(0, MAX_PROMPT_CHILD_TEXT - 3)}...`;
}

/**
 * Keep agent/workflow prompts decision-ready without copying each child Task's
 * full input and Condition definitions into every parent attempt. Exact child
 * resources remain available through the scoped Task read API.
 */
export function projectAppTaskChildPromptContext(context: AppTaskChildContext) {
  const evidence = (items: string[]) =>
    items.slice(0, MAX_PROMPT_CHILD_EVIDENCE).map((item) => boundedPromptChildText(item));
  return {
    live: context.live.map((child) => ({
      taskId: child.taskId,
      generation: child.generation,
      phase: child.phase,
      outcome: boundedPromptChildText(child.outcome),
      ...(child.agent ? { agent: child.agent } : {}),
      ...(child.workflow ? { workflow: child.workflow } : {}),
      ...(child.executor ? { executor: child.executor } : {}),
      ...(child.priority ? { priority: child.priority } : {}),
      ...(child.category ? { category: child.category } : {}),
      ...(child.dependsOn?.length ? { dependsOn: child.dependsOn } : {}),
      ...(child.readiness
        ? {
            readiness: {
              ...child.readiness,
              reason: boundedPromptChildText(child.readiness.reason),
            },
          }
        : {}),
      ...(child.latestAttempt
        ? {
            latestAttempt: {
              ...child.latestAttempt,
              ...(child.latestAttempt.failureReason
                ? { failureReason: boundedPromptChildText(child.latestAttempt.failureReason) }
                : {}),
            },
          }
        : {}),
      hasLiveChildren: child.hasLiveChildren,
      ...(child.updatedAt ? { updatedAt: child.updatedAt } : {}),
      ...(child.summary ? { summary: boundedPromptChildText(child.summary) } : {}),
      evidence: evidence(child.evidence),
    })),
    completed: context.completed.map((child) => ({
      taskId: child.taskId,
      generation: child.generation,
      outcome: boundedPromptChildText(child.outcome),
      agent: child.agent,
      ...(child.workflow ? { workflow: child.workflow } : {}),
      ...(child.executor ? { executor: child.executor } : {}),
      ...(child.priority ? { priority: child.priority } : {}),
      summary: boundedPromptChildText(child.summary),
      evidence: evidence(child.evidence),
      completedAt: child.completedAt,
    })),
    note: "This is a bounded status summary. Use tasks.get for a child's exact input or Conditions.",
  };
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
  config: ReturnType<typeof taskReconciliationConfig>,
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
  config: ReturnType<typeof taskReconciliationConfig>,
  claim: AppTaskClaim,
  error: unknown,
): { staleRecovery: "released" | "superseded" | "missing"; reconcileTaskIds: string[] } | null {
  if (!isAppTaskActionStaleError(error)) return null;
  const recovery = releaseStaleAppTaskResult(
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
      return operation();
    } finally {
      timing.resultPersistenceMs += Math.max(0, performance.now() - startedAt);
    }
  };

  try {
    const config = appTaskConfig(descriptor);
    const claimStartedAt = performance.now();
    const defaultParentId = config.resourceStore?.rootTaskId() ?? readTaskState(config).root_task_id;
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
        const active = readTaskState(config, { taskIds: [input.taskId] }).attempts?.[primary.attemptId ?? ""];
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
        recordAppTaskAttemptWorkspace(config, primary, finalized.metadata);
        return finalized;
      } catch (error) {
        workspaceFinalized = true;
        taskWorkspace.metadata.disposition = "retained-for-recovery";
        recordAppTaskAttemptWorkspace(config, primary, taskWorkspace.metadata);
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
      const workflowPaths = appWorkflowRuntimePaths(opts, descriptor, primary.agent);
      const definition = await inspectWorkflowDefinition(workflowPaths.workflowDir, workflowKey);
      if (
        definition.workspace === "task" ||
        (typeof definition.workspace === "object" && definition.workspace.kind === "task")
      ) {
        try {
          if (descriptor.app.workspace?.kind !== "git") {
            throw new Error(`Workflow ${workflowKey} requires a task worktree but app workspace is not Git`);
          }
          const previous = Object.values(readTaskState(config, { taskIds: [primary.taskId] }).attempts ?? {})
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
              typeof definition.workspace === "object"
                ? definition.workspace.baseBranch
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
      if (descriptor.app.workspace?.kind === "git") {
        try {
          const previous = Object.values(readTaskState(config, { taskIds: [primary.taskId] }).attempts ?? {})
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
            baseBranch: descriptor.app.workspace.branch ?? "dev",
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
      const registered = opts.executors?.[executorKey];
      if (registered) {
        primaryResult ??= await runRegisteredTaskExecutor({
          opts,
          descriptor,
          claim: primary,
          defaultParentId,
          executionPaths,
          event,
          observer,
          name: executorKey,
          execute: registered,
        });
      } else if (executorKey === "codex" || executorKey === "claude") {
        primaryResult ??= await runTaskCli({
          opts,
          descriptor,
          intent,
          claim: primary,
          defaultParentId,
          executionPaths,
          declaredOutputPaths,
          childContext,
          event,
          tool: executorKey,
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
        const finalized = await finalizeWorkspace("accepted");
        if (!finalized.ok) {
          primaryHandlerResult.state = "error";
          primaryHandlerResult.summary = finalized.reason ?? "Task workspace finalization failed";
          primaryHandlerResult.evidence = [taskWorkspace?.metadata.path ?? executionPaths.workspaceDir];
        }
      }
      if (primaryHandlerResult.state === "converged" && acceptanceBasis) {
        try {
          const apply = persistResult(() =>
            completeAppTask(config, primary, {
              summary: primaryHandlerResult.summary,
              response: primaryHandlerResult.response,
              evidence: primaryHandlerResult.evidence,
              actions: primaryHandlerResult.actions,
              acceptanceBasis,
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
            evidence: primaryHandlerResult.evidence,
            acceptanceBasis,
            actionsApplied: apply.actionsApplied,
            ...(stale ? { staleRecovery: stale.staleRecovery } : {}),
            workflowRunId: primaryResult.runId,
          });
          if (apply.status === "applied" && appliedDisposition === "converged") {
            emitAppTaskDependencyCompleted(opts, descriptor, intent.id);
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
      const finalized = await finalizeWorkspace("waiting");
      if (!finalized.ok) {
        primaryHandlerResult.state = "error";
        primaryHandlerResult.summary = finalized.reason ?? "Task workspace finalization failed";
        primaryHandlerResult.evidence = [taskWorkspace?.metadata.path ?? executionPaths.workspaceDir];
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
            })
          : [];
        const conditions = mergeTaskConditions([
          ...existingAppDependencyConditions,
          ...(primaryHandlerResult.conditions ?? []),
          ...dependencyConditions,
        ]);
        primaryHandlerResult.conditions = conditions.length > 0 ? conditions : undefined;
      } catch (error) {
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
            evidence: primaryHandlerResult.evidence,
            actions: primaryHandlerResult.actions,
            conditions: primaryHandlerResult.conditions,
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
    const attention = persistResult(() =>
      markAppTaskAttention(config, primary, {
        summary: primaryHandlerResult.summary,
        evidence: primaryHandlerResult.evidence,
        reason: primaryResult.unavailable
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
    if (attention.status === "applied") emitAppTaskDependencyUpdated(opts, descriptor, intent.id);
    if (!agentHandoff) {
      emitTaskReconciliationEvent(opts, descriptor, event, "project.task.reconciled", intent.id, {
        generation: primary.generation,
        attemptId: primary.attemptId,
        handler: primary.handler,
        disposition: "attention",
        input: intent.input ?? {},
        summary: primaryHandlerResult.summary,
      });
      return attention.status === "applied" && attention.parentTaskId ? [attention.parentTaskId] : [];
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
    timing.outcome = "failed";
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

function appTaskDelivery(descriptor: AppTaskRuntimeDescriptor, taskId: string, note: string): DeliveryResult {
  return {
    accepted: true,
    by: `app-task:${descriptor.id}:task-reconciler`,
    route: "direct",
    note: `${note}: ${taskId}`,
  };
}

function admitResolvedAppTaskEvent(input: {
  opts: AppTaskRuntimeOptions;
  descriptor: AppTaskRuntimeDescriptor;
  controller?: AppTaskController;
  event: Record<string, unknown>;
  intent: AppTaskIntent | null;
  targetedTaskId?: string;
  conditionTaskIds?: string[];
}): DeliveryResult | undefined {
  const { opts, descriptor, controller, event, intent } = input;
  const targetedTaskId = input.targetedTaskId?.trim() ?? "";
  const config = appTaskConfig(descriptor);
  const selectedConditionTaskIds = [
    ...new Set((input.conditionTaskIds ?? []).map((taskId) => taskId.trim()).filter(Boolean)),
  ];
  const conditionWakes = trackAppTaskConditionEventForTasks(config, event, selectedConditionTaskIds);
  if (controller) {
    for (const wake of conditionWakes) {
      enqueueAppTask(controller, config, wake.taskId, { front: true });
    }
  }
  // A frozen Condition route is idempotent admission authority. On recovery,
  // its task may already have consumed the fact or left its wait. Accept that
  // no-op instead of retrying the immutable plan forever. Exact targets with
  // no selected Condition remain strict existing-task references below.
  const conditionDelivery = selectedConditionTaskIds.length
    ? appTaskDelivery(
        descriptor,
        (conditionWakes.length ? conditionWakes.map((wake) => wake.taskId) : selectedConditionTaskIds).join(","),
        conditionWakes.length ? "task Condition event accepted" : "task Condition event already observed",
      )
    : undefined;
  if (targetedTaskId) {
    const existingIntent = readAppTaskIntent(config, targetedTaskId);
    if (existingIntent && intent?.id === targetedTaskId) {
      const observation = observeAppTaskIntent(config, {
        intent,
        appAgent: descriptor.agent,
        trigger: event,
      });
      interruptSupersededObservationSessions(opts, observation);
    }
    const triggerResult = recordAppTaskTrigger(config, targetedTaskId, event);
    if (triggerResult.kind === "recorded") {
      if (controller) enqueueAppTask(controller, config, targetedTaskId, { front: true, promote: true });
      return appTaskDelivery(descriptor, targetedTaskId, "existing targeted task wake accepted");
    }
    if (triggerResult.kind === "waiting") {
      return appTaskDelivery(descriptor, targetedTaskId, "existing targeted task remains asleep on open Conditions");
    }
    if (readAppTaskIntent(config, targetedTaskId)) {
      return appTaskDelivery(descriptor, targetedTaskId, "existing targeted task remains asleep on open Conditions");
    }
    // An exact target is a reference to existing durable work, never creation
    // authority. Desired task creation is admitted only through App policy.
    return conditionDelivery;
  }
  if (!intent) return conditionDelivery;
  const observation = observeAppTaskIntent(config, {
    intent,
    appAgent: descriptor.agent,
    trigger: event,
  });
  interruptSupersededObservationSessions(opts, observation);
  if (controller && observation.kind === "observed") {
    enqueueAppTask(controller, config, observation.taskId, {
      front: event.type === "project.comment.created",
    });
  }
  return appTaskDelivery(descriptor, observation.taskId, "resolved task event accepted");
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
    opts,
    descriptor,
    controller,
    event: flattenEvent(input.event),
    intent: input.intent,
    targetedTaskId: input.targetedTaskId,
    conditionTaskIds: input.conditionTaskIds,
  });
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
  return matchingAppTaskConditionTaskIds(appTaskConfig(descriptor), flattenEvent(input.event), allowed);
}

function isOpenProjectCondition(value: unknown): value is { spec: { type: string } } {
  if (!isRecord(value) || !isRecord(value.spec) || !isRecord(value.status)) return false;
  return typeof value.spec.type === "string" && value.status.state !== "true";
}

function replayPersistedConditionEvents(
  opts: AppTaskRuntimeOptions,
  descriptor: AppTaskRuntimeDescriptor,
  config: ReturnType<typeof taskReconciliationConfig>,
  input: { conditionIds?: string[] } = {},
): string[] {
  if (!opts.persistDir) return [];
  const resourceScope = config.resourceStore?.readOpenConditionReplayScope(input.conditionIds);
  const tree = resourceScope ? null : readTaskState(config);
  const relevantIds = input.conditionIds?.length ? new Set(input.conditionIds) : null;
  const eventTypes = resourceScope?.eventTypes ?? [
    ...new Set(
      Object.entries(tree?.conditions ?? {})
        .filter(([id, value]) => (!relevantIds || relevantIds.has(id)) && isOpenProjectCondition(value))
        .map(([, value]) => value.spec.type.trim())
        .filter(Boolean),
    ),
  ];
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

  if (!resourceScope) return trackAppTaskConditionEvents(config, events).map((wake) => wake.taskId);
  const allowed = new Set(resourceScope.taskIds);
  const wakes = events.flatMap((event) => {
    const taskIds = matchingAppTaskConditionTaskIds(config, event).filter((taskId) => allowed.has(taskId));
    return trackAppTaskConditionEventForTasks(config, event, taskIds);
  });
  return [...new Set(wakes.map((wake) => wake.taskId))];
}

export function appControllerStartGate(
  previousControllers: ReadonlyMap<string, Pick<AppTaskController, "whenDrained">> | undefined,
  appId: string,
  runtimeStartAfter?: PromiseLike<void>,
): PromiseLike<void> | undefined {
  const previousAppDrained = previousControllers?.get(appId)?.whenDrained();
  if (previousAppDrained && runtimeStartAfter) {
    return Promise.all([previousAppDrained, runtimeStartAfter]).then(() => undefined);
  }
  return previousAppDrained ?? runtimeStartAfter;
}

function installConventionTaskControllers(
  opts: AppTaskRuntimeOptions,
  descriptors: AppTaskRuntimeDescriptor[],
): Map<string, AppTaskController> {
  const previousControllers = appTaskControllersByBus.get(opts.bus);
  for (const scheduler of appTaskRecoverySchedulersByBus.get(opts.bus)?.values() ?? []) scheduler.close();
  for (const controller of previousControllers?.values() ?? []) {
    controller.close();
  }
  const controllers = new Map<string, AppTaskController>();
  const recoverySchedulers = new Map<string, AppTaskRecoveryScheduler>();

  for (const descriptor of descriptors) {
    const tasks = descriptor.app.tasks;
    if (!tasks || descriptor.reconciliationPaused) continue;
    const config = appTaskConfig(descriptor);
    let recoveryScheduler: AppTaskRecoveryScheduler | undefined;
    const controller = new AppTaskController({
      maxConcurrent: descriptor.app.tasks?.maxConcurrent ?? 1,
      capacity: opts.hostCapacity,
      // A superseded generation of this App may still own its task-state lock.
      // Other Apps are independent and must not hold this controller closed.
      startAfter: appControllerStartGate(previousControllers, descriptor.id, opts.startAfter),
      maxRetries: 3,
      reconcile: async (taskId, dispatch) => {
        const dependentTaskIds = await reconcileTask({
          opts,
          descriptor,
          taskId,
          dispatch,
          reason: "task-controller",
        });
        const dependentEntries = new Map(
          appTaskQueueEntries(config, dependentTaskIds).map((entry) => [entry.taskId, entry]),
        );
        for (const dependentTaskId of dependentTaskIds) {
          const activeController = appTaskControllersByBus.get(opts.bus)?.get(descriptor.id) ?? controller;
          // A same-task result is an immediate continuation, such as a
          // workflow-to-agent handoff. Other children/dependents enter the
          // priority-ordered ordinary lane so continuation bursts stay bounded.
          activeController.enqueue(dependentTaskId, {
            front: dependentTaskId === taskId,
            priority: dependentEntries.get(dependentTaskId)?.options.priority,
          });
        }
        recoveryScheduler?.stateChanged();
      },
      onError: (taskId, error, willRetry) => {
        opts.bus.emit({
          type: "handler.failed",
          source: "cron",
          owner: `agent:${descriptor.agent}`,
          data: {
            handler: `app-task-controller:${taskId}`,
            agent: descriptor.agent,
            error: `${error instanceof Error ? error.message : String(error)}; willRetry=${willRetry}`,
            durationMs: 0,
          },
        });
      },
    });
    controllers.set(descriptor.id, controller);
    if (!config.resourceStore) throw new Error(`App ${descriptor.id} task resource authority is unavailable`);
    recoveryScheduler = new AppTaskRecoveryScheduler({
      source: config.resourceStore,
      safetyIntervalMs: tasks.resyncIntervalMs ?? 60_000,
      enqueue: (taskId, options) => {
        controller.enqueue(taskId, options);
      },
    });
    recoverySchedulers.set(descriptor.id, recoveryScheduler);
    recoveryScheduler.start();
  }

  appTaskControllersByBus.set(opts.bus, controllers);
  appTaskRecoverySchedulersByBus.set(opts.bus, recoverySchedulers);
  return controllers;
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

function enqueueAppTask(
  controller: AppTaskController,
  config: ReturnType<typeof taskReconciliationConfig>,
  taskId: string,
  overrides: AppTaskQueueOptions = {},
): boolean {
  const current = appTaskQueueEntries(config, [taskId])[0]?.options;
  return controller.enqueue(taskId, {
    ...current,
    ...overrides,
  });
}

const appTaskConfigs = new WeakMap<AppTaskRuntimeDescriptor, ReturnType<typeof taskReconciliationConfig>>();

function appTaskConfig(descriptor: AppTaskRuntimeDescriptor) {
  const existing = appTaskConfigs.get(descriptor);
  if (existing) return existing;
  const config = taskReconciliationConfig({
    appDir: descriptor.appDir,
    projectDir: descriptor.projectDir,
    agent: descriptor.agent,
    maxConcurrent: descriptor.app.tasks?.maxConcurrent ?? 1,
    resourceStore: descriptor.resourceStore,
  });
  cacheTaskStateReads(config);
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

  let intent: AppTaskIntent;
  if (input.attachment.kind === "existing") {
    const taskId = input.attachment.taskId.trim();
    if (!taskId) throw new Error("Existing task id must be non-empty");
    const existingIntent = readAppTaskIntent(config, taskId);
    if (!existingIntent) {
      if (isAppTaskConverged(config, taskId)) {
        return { taskId, isComplete: async () => true };
      }
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
      source: input.request.source.kind === "human" ? "human" : `app-inbox:${input.appId}`,
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
      lane: input.request.source.kind === "human" ? "human" : "normal",
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
export function readLoadedAppTaskView(input: { bus: EventBus; appDir: string; taskId: string }): TaskView | null {
  const normalizedAppDir = resolve(input.appDir);
  const descriptor = (appRouterDescriptorsByBus.get(input.bus) ?? []).find(
    (candidate) => resolve(candidate.appDir) === normalizedAppDir,
  );
  if (!descriptor) return null;
  return readRuntimeTaskView(
    {
      executionPaths: { appDir: descriptor.appDir, projectDir: descriptor.projectDir },
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
      executionPaths: { appDir: descriptor.appDir, projectDir: descriptor.projectDir },
      taskStateConfig: appTaskConfig(descriptor),
    },
    input.options,
  );
}

export function getLoadedAppTaskView(input: { bus: EventBus; appId: string; taskId: string }): TaskView | null {
  const descriptor = (appRouterDescriptorsByBus.get(input.bus) ?? []).find(
    (candidate) => candidate.id === input.appId.trim().replace(/\.app$/, ""),
  );
  if (!descriptor) throw new Error(`App ${input.appId} has no loaded Task runtime`);
  return readRuntimeTaskView(
    {
      executionPaths: { appDir: descriptor.appDir, projectDir: descriptor.projectDir },
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
  const state = readTaskState(appTaskConfig(descriptor), { taskIds: [input.binding.taskId] });
  const resource = state.resources?.[input.binding.taskId];
  const attempt = state.attempts?.[input.binding.attemptId];
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
    const runningRecoveryTaskIds = config.resourceStore?.listTaskIdsByPhase(["running"], 512);
    const attentionRecoveryTaskIds = config.resourceStore?.listTaskIdsByPhase(["attention"], 512);
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
        enqueueAppTask(controller, config, taskId, { front: true });
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
export function recoverInstalledAppTasks(bus: EventBus): void {
  const opts = appRouterOptionsByBus.get(bus);
  if (!opts) return;
  recoverInterruptedAppTasks(
    opts,
    appRouterDescriptorsByBus.get(bus) ?? [],
    appTaskControllersByBus.get(bus) ?? new Map(),
    true,
  );
}

async function requeueRepairedAppTaskHandlers(
  opts: AppTaskRuntimeOptions,
  descriptors: AppTaskRuntimeDescriptor[],
  controllers: Map<string, AppTaskController>,
): Promise<void> {
  const availability = new Map<string, boolean>();
  for (const descriptor of descriptors) {
    const controller = controllers.get(descriptor.id);
    if (!controller || !descriptor.app.tasks || descriptor.reconciliationPaused) continue;
    const config = appTaskConfig(descriptor);
    const attentionTaskIds = config.resourceStore?.listTaskIdsByPhase(["attention"], 512);
    for (const candidate of listWorkspacePreparationFailedAppTasks(config, descriptor.agent, attentionTaskIds)) {
      if (descriptor.app.workspace?.kind !== "git") continue;
      let baseBranch = descriptor.app.workspace.branch ?? "dev";
      if (candidate.workflow) {
        const paths = appWorkflowRuntimePaths(opts, descriptor, candidate.agent);
        const definition = await inspectWorkflowDefinition(paths.workflowDir, candidate.workflow);
        if (
          !definition.available ||
          (definition.workspace !== "task" &&
            !(typeof definition.workspace === "object" && definition.workspace.kind === "task"))
        ) {
          continue;
        }
        baseBranch =
          typeof definition.workspace === "object"
            ? definition.workspace.baseBranch
            : (descriptor.app.workspace.branch ?? "dev");
      }
      try {
        await prepareAppTaskWorkspace({
          repoDir: descriptor.projectDir,
          workspaceRoot: join(opts.projectRoot, "worktrees", descriptor.id),
          taskId: candidate.taskId,
          generation: candidate.generation,
          baseBranch,
          previous: candidate.previous,
        });
      } catch {
        continue;
      }
      if (!releaseWorkspacePreparationFailedAppTask(config, candidate.taskId, candidate.generation)) continue;
      enqueueAppTask(controller, config, candidate.taskId);
      opts.bus.emit({
        type: "project.task.handler.recovered",
        source: `app-task:${descriptor.id}:task-recovery`,
        owner: `agent:${candidate.agent}`,
        target: { appId: descriptor.id },
        data: {
          project: descriptor.id,
          taskId: candidate.taskId,
          handler: candidate.workflow ? `workflow:${candidate.workflow}` : `executor:${candidate.executor}`,
          reason: "task-workspace-preparation-succeeded-after-app-reload",
        },
      } as unknown as AgentEvent);
    }
    for (const candidate of listHandlerUnavailableAppTasks(config, descriptor.agent, attentionTaskIds)) {
      const paths = appWorkflowRuntimePaths(opts, descriptor, candidate.agent);
      const key = `${paths.workflowDir}\0${candidate.workflow}`;
      let available = availability.get(key);
      if (available === undefined) {
        available = (await inspectWorkflowDefinition(paths.workflowDir, candidate.workflow)).available;
        availability.set(key, available);
      }
      if (!available) continue;
      if (!releaseHandlerUnavailableAppTask(config, candidate.taskId)) continue;
      enqueueAppTask(controller, config, candidate.taskId);
      opts.bus.emit({
        type: "project.task.handler.recovered",
        source: `app-task:${descriptor.id}:task-recovery`,
        owner: `agent:${candidate.agent}`,
        target: { appId: descriptor.id },
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
      const sessionBinding = startedSessionId ? parseAppTaskSessionBinding(event.task) : null;
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
              enqueueAppTask(taskController, config, released.taskId, { front: true });
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
            config.resourceStore?.listHandlerExecutionRecoveryTaskIds(successfulAgent.agent, 512),
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
            enqueueAppTask(taskController, config, successfulAgent.binding.taskId, { front: true });
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
  if (app.tasks) {
    const resyncIntervalMs = app.tasks.resyncIntervalMs ?? 60_000;
    if (!Number.isFinite(resyncIntervalMs) || resyncIntervalMs <= 0) {
      throw new Error(`App ${id} task resyncIntervalMs must be positive`);
    }
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
      `App ${appId} still has legacy task state but no active resource authority; complete the guarded resource cutover before loading it`,
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
  const entries = opts.appRegistrySnapshot?.entries ?? opts.appRegistry?.snapshot().entries ?? [];
  for (const { appDir, definition: app } of entries) {
    if (!app.tasks) continue;
    const id = app.id;
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
    descriptors.push(descriptor);
  }
  return descriptors;
}

async function commitAppTaskRuntimeDescriptors(
  opts: AppTaskRuntimeOptions,
  prepared: AppTaskRuntimeDescriptor[],
  recovery: { includeFreshLeases: boolean },
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
    syncProjectReadModel(opts, descriptor);
    installed.push(descriptor);
  }

  const controllers = installConventionTaskControllers(opts, installed);

  if (installed.length > 0 || appRouterDescriptorsByBus.has(opts.bus)) {
    attachAppEventRouter(opts, installed);
  }
  recoverInterruptedAppTasks(opts, installed, controllers, recovery.includeFreshLeases);
  await requeueRepairedAppTaskHandlers(opts, installed, controllers);

  return { installed };
}

export async function installAppTaskRuntimes(
  opts: AppTaskRuntimeOptions,
  recovery: { includeFreshLeases?: boolean } = {},
): Promise<{ installed: AppTaskRuntimeDescriptor[] }> {
  const prepared = await prepareAppTaskRuntimeDescriptors(opts);
  const previous = [...(appRouterDescriptorsByBus.get(opts.bus) ?? [])];
  try {
    const result = await commitAppTaskRuntimeDescriptors(opts, prepared, {
      includeFreshLeases: recovery.includeFreshLeases === true,
    });
    opts.afterCommit?.(result);
    return result;
  } catch (error) {
    try {
      await commitAppTaskRuntimeDescriptors(opts, previous, { includeFreshLeases: false });
    } catch (rollbackError) {
      throw new AggregateError(
        [error, rollbackError],
        "App task runtime reload failed and the previous App set could not be restored",
      );
    }
    throw error;
  }
}
