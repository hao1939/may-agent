import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
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
  taskOwnerResultSchema as appTaskOwnerResultSchema,
  type AppDefinition,
  type AppRequest,
  type AppTaskAttachment,
  type Condition as AppTaskConditionSpec,
  type TaskAction as AppTaskAction,
  type TaskAcceptanceBasis as AppTaskAcceptanceBasis,
  type TaskIntent as AppTaskIntent,
  type TaskReconcileResult as AppTaskHandlerResult,
  type TaskVerifier as AppTaskVerifier,
} from "@may-agent/sdk";
import { loadProjectReadModel, projectRuntimePaths } from "./app-task-runtime-state.js";
import {
  cacheTaskStateReads,
  readTaskState,
  refreshAppTaskTreeProjection,
} from "./app-task-store.js";
import { appTaskExecutionPaths, withAppTaskWorkspace, type AppTaskExecutionPaths } from "./app-task-output-paths.js";
import type { TaskView } from "@may-agent/sdk/app";
import { readRuntimeTaskView } from "./app-read.js";
import { appOwnerReviewEvent } from "./app-input-event.js";
import { canonicalAppEvent } from "./canonical-app-event.js";
import type { AppRegistry, AppRegistrySnapshot } from "./app-registry.js";
import { AppTaskController } from "./app-task-controller.js";
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
  listRunnableAppTaskQueueEntries,
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
  expiredOwnerSessionAppTaskAttempt,
  terminalOwnerSessionAppTaskClaim,
  releaseInterruptedAppTaskAttempt,
  releaseLateTerminalWorkflowAppTaskAttempt,
  releaseTerminalSessionExpiredAppTaskAttempt,
  releaseStaleAppTaskResult,
  recordAppTaskAttemptSession,
  recordAppTaskAttemptWorkspace,
  claimFreshAppTaskSessionsForStartup,
  taskReconciliationConfig,
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

const APP_TASK_OWNER_TIMEOUT_MS = 15 * 60_000;
const APP_TASK_WORKFLOW_TIMEOUT_MS = 30 * 60_000;

export interface AppTaskRuntimeDescriptor {
  id: string;
  appDir: string;
  projectDir: string;
  owner: string;
  app: AppDefinition;
  reconciliationPaused: boolean;
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
  appRegistry?: AppRegistry;
  /** Prospective canonical generation used during one coordinated reload. */
  appRegistrySnapshot?: AppRegistrySnapshot;
  /** Final synchronous publication step inside the atomic generation boundary. */
  afterCommit?: (result: { installed: AppTaskRuntimeDescriptor[] }) => void;
  /** Do not execute queued App work until daemon startup has fenced sessions. */
  startAfter?: PromiseLike<void>;
  /**
   * Called when an app-local agent used by the app is not yet registered.
   * The app brings its own agents; this callback registers one from its
   * project-local agent.json. Returns true if registration succeeded.
   */
  registerLocalAgent?: (agentName: string, appDir: string, agentDir?: string) => Promise<boolean>;
}

export interface AppTaskRuntimeWatcher {
  close(): void;
  scanNow(): Promise<boolean>;
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

export function inferAppOwner(appDir: string): string {
  const agents = localAgents(appDir);
  if (agents.length === 0) {
    throw new Error(`App ${appDir} has no local agents; cannot infer its owner`);
  }
  if (agents.length === 1) return agents[0]!.name;

  for (const conventional of ["owner", "project-owner"]) {
    const match = agents.find((agent) => agent.dirName === conventional);
    if (match) return match.name;
  }

  throw new Error(
    `App ${appDir} has multiple local agents (${agents.map((agent) => agent.dirName).join(", ")}) and no agents/owner or agents/project-owner directory`,
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

function configuredAppOwner(app: AppDefinition, appDir: string): string {
  const owner = typeof app.owner === "string" ? app.owner.trim() : "";
  if (owner) return owner.replace(/^agent:/, "");
  return inferAppOwner(appDir);
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
      : descriptor.owner;
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
  return [descriptor.owner];
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
  state: "converged" | "waiting" | "needs-owner" | "error";
  summary: string;
  evidence: string[];
  actions: AppTaskAction[];
  conditions?: AppTaskConditionSpec[];
};

export function normalizeTaskHandlerResult(
  output: unknown,
  fallback: { type: "done" | "blocked"; summary: string; runId: string | null },
  options: {
    allowNeedsOwner?: boolean;
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

type PersistedTerminalOwnerResultConsumption = {
  claim: AppTaskClaim;
  state: "converged" | "waiting";
  summary: string;
  evidence: string[];
  actionsApplied: string[];
  reconcileTaskIds: string[];
};

function readPersistedTerminalOwnerResult(persistDir: string | undefined, sessionId: string): unknown {
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

export function consumePersistedTerminalOwnerResult(input: {
  persistDir?: string;
  config: ReturnType<typeof taskReconciliationConfig>;
  descriptor: AppTaskRuntimeDescriptor;
  taskId: string;
  sessionId: string;
}): PersistedTerminalOwnerResultConsumption | null {
  const raw = readPersistedTerminalOwnerResult(input.persistDir, input.sessionId);
  if (raw === undefined) return null;
  const claim = terminalOwnerSessionAppTaskClaim(input.config, input.taskId, input.sessionId);
  if (!claim) return null;
  const defaultParentId = readTaskState(input.config).root_task_id;
  if (!defaultParentId) return null;
  const result = normalizeTaskHandlerResult(
    raw,
    { type: "done", summary: `Recovered terminal owner result from session ${input.sessionId}`, runId: input.sessionId },
    {
      allowNeedsOwner: false,
      defaultParentId,
      rootParentAliases: [input.descriptor.id, basename(input.descriptor.projectDir)],
      validateAction: input.descriptor.app.tasks?.validateAction,
    },
  );
  if (result.state === "converged") {
    const applied = completeAppTask(input.config, claim, {
      summary: result.summary,
      evidence: result.evidence,
      actions: result.actions,
      acceptanceBasis: { method: "owner-judgment", evidence: result.evidence },
    });
    if (applied.status !== "applied") return null;
    return {
      claim,
      state: "converged",
      summary: result.summary,
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
  return null;
}

async function runTaskCapability(input: {
  opts: AppTaskRuntimeOptions;
  descriptor: AppTaskRuntimeDescriptor;
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
      recoveryOwner: APP_TASK_RECOVERY_OWNER,
      trace,
      executionPaths: input.executionPaths,
      workflowInput: intent.input ?? {},
      reconciliation: {
        appId: descriptor.id,
        taskId: claim.taskId,
        generation: claim.generation,
        resourceVersion: claim.resourceVersion,
        owner: claim.owner,
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
        ...(event ? { trigger: canonicalAppEvent(event as AgentEvent) } : {}),
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
        allowNeedsOwner: true,
        defaultParentId: input.defaultParentId,
        rootParentAliases: [input.descriptor.id, basename(input.descriptor.projectDir)],
        validateAction: input.descriptor.app.tasks?.validateAction,
      },
    );
    opts.bus.emit({
      type: "handler.workflow_dispatched",
      source: `agent:${agentName}`,
      owner: `agent:${claim.owner}`,
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
      owner: `agent:${claim.owner}`,
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
  }
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

function summarizeInterruptedOwnerRecovery(input: {
  meta: { task?: string; source?: string };
  persistDir: string;
  sessionId: string;
  reason: string;
  repairedPendingTools: string[];
  taskId?: string;
}): { summary: string; taskId: string | null; evidence: string[] } {
  const taskId = input.taskId?.trim()
    ? input.taskId.trim()
    : input.meta.source === "app-task-owner" || input.meta.source === "project-app-task-owner"
      ? extractReconciliationTaskId(input.meta.task)
      : null;
  const summary = taskId
    ? `Owner session for ${taskId} was interrupted by runtime recovery before finish() persisted; the original app task was requeued and should be decided by the replacement attempt, not this recovery wrapper.`
    : "Owner session was interrupted by runtime recovery before finish() persisted; the original app task was requeued and should be decided by the replacement attempt, not this recovery wrapper.";
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

function interruptSupersededOwnerSession(
  opts: AppTaskRuntimeOptions,
  sessionId: string,
  reason: string,
  taskId?: string,
): void {
  const cleanSessionId = sessionId.trim();
  if (!cleanSessionId) return;
  if (opts.manager.hasActiveSession(cleanSessionId)) {
    opts.manager.cancel(cleanSessionId);
    return;
  }
  if (hasLiveAppTaskSession(opts, cleanSessionId)) return;

  const meta = opts.persistDir ? readSessionMeta(opts.persistDir, cleanSessionId) : null;
  if (!meta || (meta.status !== "running" && meta.status !== "idle")) return;

  // Replacement ownership cannot begin while the superseded exact session's
  // shell descendants remain live.
  drainPersistedSessionBashProcessGroups(opts.persistDir!, cleanSessionId);

  // Capture a completed finish call before repairing genuinely pending tool
  // calls: finish() may be the final transcript entry, and synthesizing an
  // interruption result for it would hide the valid terminal decision.
  const recoveredFinish = opts.persistDir
    ? extractFinishParams(readSessionMessages(opts.persistDir, cleanSessionId) as any[])
    : null;
  const repairedPendingTools = opts.persistDir
    ? recoverPendingToolResultsFromTranscript(opts.persistDir, cleanSessionId)
    : [];
  const interruptedRecovery = summarizeInterruptedOwnerRecovery({
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
    interruptSupersededOwnerSession(
      opts,
      sessionId,
      `Task ${observation.taskId} advanced to generation ${observation.generation}; the previous reconciliation session is obsolete`,
      observation.taskId,
    );
  }
}

function interruptSupersededActionSessions(opts: AppTaskRuntimeOptions, taskId: string, sessionIds: string[]): void {
  for (const sessionId of sessionIds) {
    interruptSupersededOwnerSession(
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
  startIdentity: string;
  dirtyTracked: Map<string, ResidueFileSnapshot>;
  untracked: Map<string, ResidueFileSnapshot>;
};

function gitPathSet(projectDir: string, args: string[]): Set<string> {
  const output = execFileSync("git", ["-C", projectDir, ...args]);
  return new Set(output.toString("utf8").split("\0").filter(Boolean));
}

function canonicalUntrackedFiles(projectDir: string): Set<string> {
  return gitPathSet(projectDir, ["ls-files", "--others", "--exclude-standard", "--full-name", "-z"]);
}

function safeResiduePath(projectDir: string, relativePath: string): string {
  const absolutePath = resolve(projectDir, relativePath);
  const fromRoot = relative(projectDir, absolutePath);
  if (!fromRoot || fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
    throw new Error(`Refusing to access unsafe owner residue path: ${relativePath}`);
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

function residueSnapshotIdentity(
  status: Buffer,
  index: Buffer,
  dirtyTracked: Map<string, ResidueFileSnapshot>,
  untracked: Map<string, ResidueFileSnapshot>,
): string {
  const hash = createHash("sha256");
  hash.update(status);
  hash.update(index);
  const paths = [...new Set([...dirtyTracked.keys(), ...untracked.keys()])].sort();
  for (const path of paths) {
    hash.update("\0path\0");
    hash.update(path);
    const snapshot = dirtyTracked.get(path) ?? untracked.get(path);
    if (!snapshot?.exists) {
      hash.update("\0missing\0");
    } else if (snapshot.kind === "symlink") {
      hash.update("\0symlink\0");
      hash.update(snapshot.target);
    } else {
      hash.update("\0file\0");
      hash.update(String(snapshot.mode));
      hash.update(snapshot.data);
    }
  }
  return hash.digest("hex");
}

function canonicalResidueIdentity(projectDir: string, indexPath: string): string {
  const status = execFileSync("git", ["-C", projectDir, "status", "--porcelain=v1", "-z"]);
  const index = readFileSync(indexPath);
  const dirtyTrackedPaths = gitPathSet(projectDir, ["ls-files", "--modified", "--deleted", "-z"]);
  const untrackedPaths = canonicalUntrackedFiles(projectDir);
  const dirtyTracked = new Map(
    [...dirtyTrackedPaths].map((path) => [path, snapshotResidueFile(projectDir, path)] as const),
  );
  const untracked = new Map([...untrackedPaths].map((path) => [path, snapshotResidueFile(projectDir, path)] as const));
  return residueSnapshotIdentity(status, index, dirtyTracked, untracked);
}

/**
 * Direct owner attempts are conventionally read-only. When their default
 * workspace is the canonical Git checkout, snapshot its index and residue so
 * owner-created tracked or untracked writes can be rolled back without
 * disturbing dirt that predated the attempt. Workflow task worktrees have a
 * distinct workspaceDir and bypass this guard.
 */
export function beginCanonicalOwnerResidueGuard(paths: AppTaskExecutionPaths): CanonicalUntrackedResidueGuard | null {
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
    const status = execFileSync("git", ["-C", paths.projectDir, "status", "--porcelain=v1", "-z"]);
    const dirtyTrackedPaths = gitPathSet(paths.projectDir, ["ls-files", "--modified", "--deleted", "-z"]);
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
      startIdentity: residueSnapshotIdentity(status, indexData, dirtyTracked, untracked),
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
      "The correlated deploy succeeded. Do not deploy again. Verify that loadedArtifactSha equals artifactSha, health is healthy, targetedWake is true, and duplicateDeploy is false; then complete owner reconciliation.",
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

export function finishCanonicalOwnerResidueGuard(guard: CanonicalUntrackedResidueGuard | null): string[] {
  if (!guard) return [];

  // Restoration is safe only while the canonical checkout still has the exact
  // index, status, and dirty-file bytes captured at attempt start. A concurrent
  // cleanup, reset, fast-forward, or different dirty transition is authoritative
  // and must never be overwritten by this attempt's stale snapshot.
  if (!existsSync(guard.indexPath)) return [];
  if (canonicalResidueIdentity(guard.projectDir, guard.indexPath) !== guard.startIdentity) return [];

  if (!readFileSync(guard.indexPath).equals(guard.indexData)) {
    writeFileSync(guard.indexPath, guard.indexData);
    chmodSync(guard.indexPath, guard.indexMode);
  }
  execFileSync("git", ["-C", guard.projectDir, "checkout-index", "--all", "--force"]);
  for (const [relativePath, snapshot] of guard.dirtyTracked) {
    restoreResidueFile(guard.projectDir, relativePath, snapshot);
  }

  const created = [...canonicalUntrackedFiles(guard.projectDir)].filter((path) => !guard.untracked.has(path));
  for (const relativePath of created) {
    const absolutePath = safeResiduePath(guard.projectDir, relativePath);
    if (existsSync(absolutePath)) unlinkSync(absolutePath);
    let parent = dirname(absolutePath);
    while (parent !== guard.projectDir) {
      try {
        rmdirSync(parent);
      } catch {
        break;
      }
      parent = dirname(parent);
    }
  }
  for (const [relativePath, snapshot] of guard.untracked) {
    restoreResidueFile(guard.projectDir, relativePath, snapshot);
  }
  return created;
}

async function runTaskOwner(input: {
  opts: AppTaskRuntimeOptions;
  descriptor: AppTaskRuntimeDescriptor;
  intent: AppTaskIntent;
  claim: AppTaskClaim;
  defaultParentId: string;
  executionPaths: AppTaskExecutionPaths;
  declaredOutputPaths: string[];
  childContext: AppTaskChildContext;
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
              type: "pipeline-run.state",
              subject: "pipeline-run:123",
              expected: { field: "state", equals: "completed" },
              reviewAfterMs: 3600000,
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
    "Loss-prevention checkpoint discipline: immediately after gathering the first acceptance-critical evidence, call checkpoint() once with a concise evidence summary, the next bounded step, and exact artifact/session paths a replacement owner needs. Refresh it only when those facts materially change, then call finish() as soon as the decision is supportable.",
    "Startup recovery exposes the latest durable checkpoint to the replacement prompt. If no checkpoint was persisted, recovery records that absence explicitly; never infer a resumable decision from checkpoint absence.",
    'For mode "achieve", missing evidence is work to do, not by itself a reason to create another task. If the task asks to queue, run, publish, verify, inspect, or repair something, do that concrete work now and report the evidence. Return "converged" only when this task\'s own outcome and acceptance are satisfied or its contract explicitly accepts the evidenced terminal disposition.',
    "When different bounded work is required before this task can satisfy acceptance, create that work as a direct child with parentId equal to the current Reconciliation Task taskId and return waiting. A sibling successor does not complete the current task.",
    "Create a successor task only when this carrier cannot do the work because the target is stale, the task is too broad for one bounded attempt, or a real evidenced blocker requires different follow-up. If that successor is required for current acceptance, it is a direct child and the current task remains waiting.",
    "Use waiting only when there is a real machine-observable wake event or live direct child work. Every authored Condition must be an object with id, type, subject, and expected.",
    "When an unresolved human request depends on a Condition, set reviewAfterMs to a bounded interval of at least 60000. Missing that checkpoint wakes you to review and steer the same task; it does not send a routine human update.",
    "A condition-review trigger includes reviewAttempt and finalReview. By the final unchanged review, change the approach or leave a proved event-driven blocker without another timer; the controller removes a repeated timer after the third review so an unchanged wait cannot spin forever.",
    'For a decomposition parent that creates child task actions and cannot yet satisfy its own acceptance, return state "waiting". Infrastructure tracks live direct children and wakes this parent when a child converges or needs attention; do not author task lifecycle Conditions or return "converged" merely because child tasks were declared.',
    'Conditions belong only to the current task when you return state "waiting". A converged task may create only independent successor work after its own acceptance is already satisfied; put that successor\'s wake facts in its task action input/acceptance and omit top-level conditions.',
    "Condition subjects must use typed forms the app can observe, for example task:<taskId>, session:<sessionId>, workflow-run:<runId>, pipeline-run:<runId>, metric:<metricId>, alert:<alertId>, or project:<projectId>.",
    "Do not put blocker prose, resumeCondition, requiredEvidence, allowedChangedFiles, or other human notes directly in conditions. Put that detail in summary/evidence, or create/update a concrete follow-up task.",
    "If no exact machine-observable Condition exists, do not return waiting. Return converged with exact evidence and supported successor/escalation actions when this carrier is finished; execution errors are reported by the runtime, not as a fourth task state.",
    "Use actions only for supported task-tree mutations.",
    "An executable parent relationship expresses decomposition and aggregate ownership. Infrastructure runs children independently and wakes the parent on meaningful child transitions; the parent still decides aggregate acceptance.",
    "Use dependsOn for execution ordering. Use a structural group when a node has no independently reconcilable outcome.",
    "Do not close an achieve task while it still contains live child tasks; finish or relocate the represented children first.",
    "A completed task receipt is immutable. Do not update, unblock, or recreate its task ID; represent correction or renewed work as a new linked task.",
    "",
    "Allowed actions:",
    '- create a task: { kind: "create-task", id, outcome, acceptance, parentId?, mode?, outputs?, priority?, owner?, workflow?, input?, dependsOn?, category? }',
    '  Defaults: parentId is the app root, mode is "achieve", outputs is [], and priority is "P2".',
    '  Created task ids must not start with "runtime/"; that namespace is reserved for reconciler-owned event tasks.',
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
    ...(/deploy|restart/i.test(intent.outcome) ||
    input.declaredOutputPaths.some((path) => path.includes("deploy-receipts"))
      ? ["", ...deployReceiptPrompt(input.executionPaths.projectDir, claim.taskId)]
      : []),
    ...(event ? ["", "## Trigger Observation", "```json", JSON.stringify(event, null, 2), "```"] : []),
  ].join("\n");

  const ownerOptions = {
    source: "app-task-owner",
    projectId: descriptor.id,
    recoveryOwner: APP_TASK_RECOVERY_OWNER,
    trace,
    requireFinish: true,
    outputSchema: appTaskOwnerResultSchema,
    toolPolicy: "full" as const,
    timeout: APP_TASK_OWNER_TIMEOUT_MS,
    executionRoot: input.executionPaths.workspaceDir,
  };
  const dispatchOwner = async () =>
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
            executionRoot: ownerOptions.executionRoot,
          });
          recordAppTaskAttemptSession(
            taskReconciliationConfig({
              appDir: descriptor.appDir,
              projectDir: descriptor.projectDir,
              owner: descriptor.owner,
              maxConcurrent: descriptor.app.tasks?.maxConcurrent ?? 1,
            }),
            claim,
            sessionId,
          );
          const waited = await opts.manager.waitFor(sessionId);
          return {
            ...waited,
            messages: opts.manager.progress(sessionId, 1000),
          };
        })()
      : await opts.manager.callAgent(claim.owner, prompt, ownerOptions);
  const residueGuard = beginCanonicalOwnerResidueGuard(input.executionPaths);
  let result: Awaited<ReturnType<typeof dispatchOwner>>;
  try {
    result = await dispatchOwner();
  } finally {
    finishCanonicalOwnerResidueGuard(residueGuard);
  }
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
      validateAction: input.descriptor.app.tasks?.validateAction,
    },
  );
  return {
    handlerResult,
    runId: result.sessionId || null,
    ...(!done ? { executionFailed: true } : {}),
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
    owner: `agent:${descriptor.owner}`,
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
          method: "owner-judgment",
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
    const verificationConfig = taskReconciliationConfig({
      appDir: descriptor.appDir,
      projectDir: descriptor.projectDir,
      owner: descriptor.owner,
      maxConcurrent: descriptor.app.tasks?.maxConcurrent ?? 1,
    });
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
  reason?: string;
}): Promise<string[]> {
  const { opts, descriptor } = input;

  const config = taskReconciliationConfig({
    appDir: descriptor.appDir,
    projectDir: descriptor.projectDir,
    owner: descriptor.owner,
    maxConcurrent: descriptor.app.tasks?.maxConcurrent ?? 1,
  });
  const defaultParentId = readTaskState(config).root_task_id;
  if (!defaultParentId) {
    throw new Error(`App ${descriptor.id} has no root task group for convention defaults`);
  }
  const primary = claimObservedAppTask(config, {
    taskId: input.taskId,
    appOwner: descriptor.owner,
    handler: "auto",
    reason: input.reason ?? "task-controller",
    isOwnerRunnable: (owner) => opts.manager.hasAgent(owner),
  });
  if (primary.kind !== "claimed") {
    if (primary.kind === "busy") {
      const active = readTaskState(config).attempts?.[primary.attemptId ?? ""];
      const terminalSession = active?.sessionId && opts.persistDir ? readSessionMeta(opts.persistDir, active.sessionId) : null;
      if (
        active?.sessionId &&
        terminalSession?.status === "done" &&
        !hasLiveAppTaskSession(opts, active.sessionId)
      ) {
        const consumed = consumePersistedTerminalOwnerResult({
          persistDir: opts.persistDir,
          config,
          descriptor,
          taskId: input.taskId,
          sessionId: active.sessionId,
        });
        if (consumed) {
          emitTaskReconciliationEvent(opts, descriptor, undefined, "project.task.reconciled", input.taskId, {
            route: "terminal-owner-result-recovery",
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
          ? { sessionId: active.sessionId, lastActivityAt: readSessionLastActivityAt(opts.persistDir, active.sessionId) }
          : undefined;
      const expired = expiredOwnerSessionAppTaskAttempt(config, input.taskId, leaseCheckAt, sessionActivity);
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
          `Expired reconciliation ${input.taskId} lost its synchronous caller after owner session completion`,
          leaseCheckAt,
          sessionActivity,
        );
        if (released.released) {
          emitTaskReconciliationEvent(
            opts,
            descriptor,
            undefined,
            "project.task.recovery.requeued",
            input.taskId,
            {
              route: "task-controller",
              reason: "terminal-owner-session-expired-lease",
              attemptId: expired.attemptId,
              evidenceSessionId: sessionId,
              terminalStatus,
            },
          );
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
    return [];
  }
  for (const sessionId of primary.supersededSessionIds ?? []) {
    interruptSupersededOwnerSession(
      opts,
      sessionId,
      `Task ${primary.taskId} superseded an orphaned owner session while recovering the current generation`,
      primary.taskId,
    );
  }
  const intent = primary.intent;
  const event = primary.trigger as EventEnvelope | undefined;
  const childContext = readAppTaskChildContext(config, primary.taskId);
  const taskSnapshot = readAppTaskLiveSnapshot(config, primary.taskId);
  let executionPaths = appTaskExecutionPaths(descriptor.appDir, descriptor.projectDir);
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
      const finalized = finalizeAppTaskWorkspace(taskWorkspace, outcome);
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
        taskWorkspace = prepareAppTaskWorkspace({
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
        agent: primary.owner,
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
    if (primary.handoff && intent.workflow) {
      const workflowPaths = appWorkflowRuntimePaths(opts, descriptor, primary.owner);
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
    primary.handoff?.reason === "needs-owner" &&
    intent.workflow &&
    !primaryResult.verifier
  ) {
    primaryHandlerResult.state = "error";
    primaryHandlerResult.summary = `Owner convergence was rejected because workflow ${intent.workflow} handed off without a verifier`;
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
      const finalized = finalizeWorkspace("accepted");
      if (!finalized.ok) {
        primaryHandlerResult.state = "error";
        primaryHandlerResult.summary = finalized.reason ?? "Task workspace finalization failed";
        primaryHandlerResult.evidence = [taskWorkspace?.metadata.path ?? executionPaths.workspaceDir];
      }
    }
    if (primaryHandlerResult.state === "converged" && acceptanceBasis) {
      try {
        const apply = completeAppTask(config, primary, {
          summary: primaryHandlerResult.summary,
          evidence: primaryHandlerResult.evidence,
          actions: primaryHandlerResult.actions,
          acceptanceBasis,
        });
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
            owner: intent.owner ?? descriptor.owner,
            ...(intent.workflow ? { workflow: intent.workflow } : {}),
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
    const finalized = finalizeWorkspace("waiting");
    if (!finalized.ok) {
      primaryHandlerResult.state = "error";
      primaryHandlerResult.summary = finalized.reason ?? "Task workspace finalization failed";
      primaryHandlerResult.evidence = [taskWorkspace?.metadata.path ?? executionPaths.workspaceDir];
    }
  }

  if (primaryHandlerResult.state === "waiting") {
    try {
      const apply = deferAppTask(config, primary, {
        disposition: primaryHandlerResult.state,
        summary: primaryHandlerResult.summary,
        evidence: primaryHandlerResult.evidence,
        actions: primaryHandlerResult.actions,
        conditions: primaryHandlerResult.conditions,
      });
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

  finalizeWorkspace("failed");

  const ownerHandoff = Boolean(workflowKey && primaryHandlerResult.state === "needs-owner");
  const attention = markAppTaskAttention(config, primary, {
    summary: primaryHandlerResult.summary,
    evidence: primaryHandlerResult.evidence,
    reason: primaryResult.unavailable
      ? "HandlerUnavailable"
      : primaryResult.executionFailed
        ? "HandlerExecutionFailed"
        : primaryResult.workspacePreparationFailed
          ? "WorkspacePreparationFailed"
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

const appRouterDescriptorsByBus = new WeakMap<EventBus, AppTaskRuntimeDescriptor[]>();
const appRouterOptionsByBus = new WeakMap<EventBus, AppTaskRuntimeOptions>();

function loadedAppTaskRuntimeDescriptor(bus: EventBus, projectId: string): AppTaskRuntimeDescriptor | undefined {
  const normalized = projectId.trim().replace(/\.app$/, "");
  return (appRouterDescriptorsByBus.get(bus) ?? []).find((descriptor) => descriptor.id === normalized);
}

const appTaskControllersByBus = new WeakMap<EventBus, Map<string, AppTaskController>>();

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
  const conditionWakes = trackAppTaskConditionEventForTasks(config, event, input.conditionTaskIds ?? []);
  if (controller) {
    for (const wake of conditionWakes) {
      enqueueAppTask(controller, config, wake.taskId, { front: true });
    }
  }
  const conditionDelivery = conditionWakes.length
    ? appTaskDelivery(descriptor, conditionWakes.map((wake) => wake.taskId).join(","), "task Condition event accepted")
    : undefined;
  if (targetedTaskId) {
    const existingIntent = readAppTaskIntent(config, targetedTaskId);
    if (existingIntent && intent?.id === targetedTaskId) {
      const observation = observeAppTaskIntent(config, {
        intent,
        appOwner: descriptor.owner,
        trigger: event,
      });
      interruptSupersededObservationSessions(opts, observation);
    }
    const triggerResult = recordAppTaskTrigger(config, targetedTaskId, event);
    if (triggerResult.kind === "recorded") {
      if (controller) enqueueAppTask(controller, config, targetedTaskId, { front: true });
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
    appOwner: descriptor.owner,
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
  const tree = readTaskState(config);
  const relevantIds = input.conditionIds?.length ? new Set(input.conditionIds) : null;
  const eventTypes = [
    ...new Set(
      Object.entries(tree.conditions ?? {})
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

  return trackAppTaskConditionEvents(config, events).map((wake) => wake.taskId);
}

function installConventionTaskControllers(
  opts: AppTaskRuntimeOptions,
  descriptors: AppTaskRuntimeDescriptor[],
): Map<string, AppTaskController> {
  const previousControllers = appTaskControllersByBus.get(opts.bus);
  for (const controller of previousControllers?.values() ?? []) {
    controller.close();
  }
  const previousControllersDrained = previousControllers?.size
    ? Promise.all([...previousControllers.values()].map((controller) => controller.whenDrained())).then(() => undefined)
    : undefined;
  const startAfter =
    previousControllersDrained && opts.startAfter
      ? Promise.all([previousControllersDrained, opts.startAfter]).then(() => undefined)
      : (previousControllersDrained ?? opts.startAfter);
  const controllers = new Map<string, AppTaskController>();

  for (const descriptor of descriptors) {
    const tasks = descriptor.app.tasks;
    if (!tasks || descriptor.reconciliationPaused) continue;
    const config = taskReconciliationConfig({
      appDir: descriptor.appDir,
      projectDir: descriptor.projectDir,
      owner: descriptor.owner,
      maxConcurrent: descriptor.app.tasks?.maxConcurrent ?? 1,
    });
    try {
      // Every canonical state save refreshes this disposable projection. On
      // startup, preserve a projection already newer than its source instead
      // of parsing and serializing the entire historical task tree again.
      refreshAppTaskTreeProjection(config, { ifStaleOnly: true });
    } catch (error) {
      opts.bus.emit({
        type: "info",
        message: `[app-task:${descriptor.id}] Could not refresh task read projection: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
    const controller = new AppTaskController({
      maxConcurrent: descriptor.app.tasks?.maxConcurrent ?? 1,
      capacity: opts.hostCapacity,
      // A superseded generation may still be finishing a reconcile that owns
      // the task-state lock. Queue the replacement immediately, but do not let
      // it claim work until every previous controller has drained.
      startAfter,
      maxRetries: 3,
      resync: {
        intervalMs: tasks.resyncIntervalMs ?? 60_000,
        tasks: () => listRunnableAppTaskQueueEntries(config),
      },
      reconcile: async (taskId) => {
        const dependentTaskIds = await reconcileTask({
          opts,
          descriptor,
          taskId,
          reason: "task-controller",
        });
        const dependentEntries = new Map(
          appTaskQueueEntries(config, dependentTaskIds).map((entry) => [entry.taskId, entry]),
        );
        for (const dependentTaskId of dependentTaskIds) {
          const activeController = appTaskControllersByBus.get(opts.bus)?.get(descriptor.id) ?? controller;
          // A same-task result is an immediate continuation, such as a
          // workflow-to-owner handoff. Other children/dependents enter the
          // priority-ordered ordinary lane so continuation bursts stay bounded.
          activeController.enqueue(dependentTaskId, {
            front: dependentTaskId === taskId,
            priority: dependentEntries.get(dependentTaskId)?.options.priority,
          });
        }
      },
      onError: (taskId, error, willRetry) => {
        opts.bus.emit({
          type: "handler.failed",
          source: "cron",
          owner: `agent:${descriptor.owner}`,
          data: {
            handler: `app-task-controller:${taskId}`,
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

/**
 * Stop the task-controller generation currently attached to one process bus.
 * Closing is synchronous; the returned promise additionally waits for work
 * already inside a reconcile to release its resources.
 */
export async function closeInstalledAppTaskRuntimes(bus: EventBus): Promise<void> {
  const controllers = appTaskControllersByBus.get(bus);
  if (!controllers) return;

  appTaskControllersByBus.delete(bus);
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

function appTaskConfig(descriptor: AppTaskRuntimeDescriptor) {
  return taskReconciliationConfig({
    appDir: descriptor.appDir,
    projectDir: descriptor.projectDir,
    owner: descriptor.owner,
    maxConcurrent: descriptor.app.tasks?.maxConcurrent ?? 1,
  });
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
    appOwner: descriptor.owner,
    admissionKey: idempotencyKey,
    trigger: {
      type: "app.task.requested",
      source: input.request.source.kind === "human" ? "human" : `app-inbox:${input.appId}`,
      owner: `agent:${descriptor.owner}`,
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
    enqueueAppTask(controller, config, observation.taskId);
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
    { executionPaths: { appDir: descriptor.appDir, projectDir: descriptor.projectDir } },
    input.taskId,
  );
}

function emitAppTaskDependencyCompleted(
  opts: AppTaskRuntimeOptions,
  descriptor: AppTaskRuntimeDescriptor,
  taskId: string,
): void {
  opts.bus.emit({
    type: "app.dependency.completed",
    source: `app-task:${descriptor.id}:task-reconciler`,
    owner: `agent:${descriptor.owner}`,
    data: { kind: "task", id: taskId },
  });
}

export function persistedAppTaskSessionCanResume(meta: { status?: string } | null): boolean {
  return meta?.status === "running" || meta?.status === "idle";
}

function recoverInterruptedAppTasks(
  opts: AppTaskRuntimeOptions,
  descriptors: AppTaskRuntimeDescriptor[],
  controllers: Map<string, AppTaskController>,
  includeFreshLeases = false,
): Set<string> {
  const claimedSessionIds = new Set<string>();
  for (const descriptor of descriptors) {
    if (!descriptor.app.tasks) continue;
    const controller = controllers.get(descriptor.id);
    const config = taskReconciliationConfig({
      appDir: descriptor.appDir,
      projectDir: descriptor.projectDir,
      owner: descriptor.owner,
      maxConcurrent: descriptor.app.tasks?.maxConcurrent ?? 1,
    });
    cacheTaskStateReads(config);
    const releaseRecovery = (recovery: AppTaskAttemptRecovery) => {
      const released = releaseInterruptedAppTaskAttempt(
        config,
        recovery,
        `Interrupted reconciliation ${recovery.taskId} belonged to a previous runtime`,
      );
      for (const sessionId of released.sessionIds) {
        interruptSupersededOwnerSession(
          opts,
          sessionId,
          `Recovered task ${recovery.taskId} interrupted an orphaned owner session from a previous runtime`,
          recovery.taskId,
        );
      }
      if (released.released && controller && !descriptor.reconciliationPaused) {
        enqueueAppTask(controller, config, recovery.taskId);
      }
    };
    const freshCandidates: Array<{
      recovery: AppTaskAttemptRecovery;
      sessionId: string;
      nowMs: number;
      sessionActivity: { sessionId: string; lastActivityAt: number | null };
    }> = [];
    for (const recovery of recoverableAppTaskAttempts(config, Date.now(), includeFreshLeases)) {
      if (recovery.sessionId && hasLiveAppTaskSession(opts, recovery.sessionId)) {
        continue;
      }
      const persistedSession = recovery.sessionId && opts.persistDir
        ? readSessionMeta(opts.persistDir, recovery.sessionId)
        : null;
      if (recovery.sessionId && persistedSession?.status === "done") {
        const consumed = consumePersistedTerminalOwnerResult({
          persistDir: opts.persistDir,
          config,
          descriptor,
          taskId: recovery.taskId,
          sessionId: recovery.sessionId,
        });
        if (consumed) {
          emitTaskReconciliationEvent(
            opts,
            descriptor,
            undefined,
            "project.task.reconciled",
            recovery.taskId,
            {
              route: "terminal-owner-result-recovery",
              generation: consumed.claim.generation,
              attemptId: consumed.claim.attemptId,
              handler: consumed.claim.handler,
              disposition: consumed.state,
              summary: consumed.summary,
              evidence: consumed.evidence,
              actionsApplied: consumed.actionsApplied,
              evidenceSessionId: recovery.sessionId,
            },
          );
          if (consumed.state === "converged") emitAppTaskDependencyCompleted(opts, descriptor, recovery.taskId);
          for (const taskId of consumed.reconcileTaskIds) {
            if (controller && !descriptor.reconciliationPaused) enqueueAppTask(controller, config, taskId);
          }
          continue;
        }
      }
      if (
        includeFreshLeases &&
        recovery.sessionId &&
        opts.persistDir &&
        persistedAppTaskSessionCanResume(persistedSession)
      ) {
        freshCandidates.push({
          recovery,
          sessionId: recovery.sessionId,
          nowMs: Date.now(),
          sessionActivity: {
            sessionId: recovery.sessionId,
            lastActivityAt: readSessionLastActivityAt(opts.persistDir, recovery.sessionId),
          },
        });
        continue;
      }
      releaseRecovery(recovery);
    }
    const claimed = claimFreshAppTaskSessionsForStartup(
      config,
      freshCandidates.map((candidate) => ({
        binding: { taskId: candidate.recovery.taskId, generation: candidate.recovery.taskGeneration },
        sessionId: candidate.sessionId,
        nowMs: candidate.nowMs,
        sessionActivity: candidate.sessionActivity,
      })),
    );
    for (const candidate of freshCandidates) {
      if (claimed.has(candidate.sessionId)) claimedSessionIds.add(candidate.sessionId);
      else releaseRecovery(candidate.recovery);
    }
    const missingAttemptRepairs = repairRunningAppTasksWithoutAttempt(config);
    for (const repair of missingAttemptRepairs) {
      if (controller && !descriptor.reconciliationPaused) {
        enqueueAppTask(controller, config, repair.taskId);
      }
    }
    const repairs = repairPreviousRuntimeRecoveryAttention(config);
    if (repairs.length > 0) {
      opts.bus.emit({
        type: "project.task.recovery.repaired",
        source: `app-task:${descriptor.id}:task-recovery`,
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
          enqueueAppTask(controller, config, repair.taskId);
        }
      }
    }
    for (const taskId of replayPersistedConditionEvents(opts, descriptor, config)) {
      if (controller && !descriptor.reconciliationPaused) {
        enqueueAppTask(controller, config, taskId, { front: true });
      }
    }
    const attentions = pendingAppTaskRecoveryAttention(config);
    if (attentions.length === 0) continue;
    if (!descriptor.reconciliationPaused) {
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
  return claimedSessionIds;
}

/**
 * Run the canonical App task recovery path for the descriptors and task
 * controllers already installed on this event bus. Startup calls this before
 * generic stale-session resumption so task-owned sessions are reconciled by
 * their durable task state first.
 */
export function recoverInstalledAppTasks(bus: EventBus): Set<string> {
  const opts = appRouterOptionsByBus.get(bus);
  if (!opts) return new Set();
  return recoverInterruptedAppTasks(
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
    const config = taskReconciliationConfig({
      appDir: descriptor.appDir,
      projectDir: descriptor.projectDir,
      owner: descriptor.owner,
      maxConcurrent: descriptor.app.tasks?.maxConcurrent ?? 1,
    });
    cacheTaskStateReads(config);
    for (const candidate of listWorkspacePreparationFailedAppTasks(config, descriptor.owner)) {
      const paths = appWorkflowRuntimePaths(opts, descriptor, candidate.owner);
      const definition = await inspectWorkflowDefinition(paths.workflowDir, candidate.workflow);
      if (
        !definition.available ||
        (definition.workspace !== "task" &&
          !(typeof definition.workspace === "object" && definition.workspace.kind === "task")) ||
        descriptor.app.workspace?.kind !== "git"
      ) {
        continue;
      }
      try {
        prepareAppTaskWorkspace({
          repoDir: descriptor.projectDir,
          workspaceRoot: join(opts.projectRoot, "worktrees", descriptor.id),
          taskId: candidate.taskId,
          generation: candidate.generation,
          baseBranch:
            typeof definition.workspace === "object"
              ? definition.workspace.baseBranch
              : (descriptor.app.workspace.branch ?? "dev"),
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
        owner: `agent:${candidate.owner}`,
        target: { appId: descriptor.id },
        data: {
          project: descriptor.id,
          taskId: candidate.taskId,
          handler: `workflow:${candidate.workflow}`,
          reason: "task-workspace-preparation-succeeded-after-app-reload",
        },
      } as unknown as AgentEvent);
    }
    for (const candidate of listHandlerUnavailableAppTasks(config, descriptor.owner)) {
      const paths = appWorkflowRuntimePaths(opts, descriptor, candidate.owner);
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
        owner: `agent:${candidate.owner}`,
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
  opts.bus.subscribe((rawEvent): DeliveryResult | void => {
    const event = flattenEvent(rawEvent);
    const startedSessionId =
      event.type === "session.start" && typeof event.sessionId === "string" ? event.sessionId.trim() : "";
    const sessionBinding = startedSessionId ? parseAppTaskSessionBinding(event.task) : null;
    if (sessionBinding) {
      const descriptor = (appRouterDescriptorsByBus.get(opts.bus) ?? []).find(
        (candidate) => candidate.id === sessionBinding.appId,
      );
      if (descriptor?.app.tasks) {
        const association = associateAppTaskSession(
          taskReconciliationConfig({
            appDir: descriptor.appDir,
            projectDir: descriptor.projectDir,
            owner: descriptor.owner,
            maxConcurrent: descriptor.app.tasks?.maxConcurrent ?? 1,
          }),
          sessionBinding,
          startedSessionId,
        );
        if (association.status !== "recorded") {
          interruptSupersededOwnerSession(
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
    const successfulOwner =
      event.type === "session.end" &&
      event.status === "done" &&
      typeof event.agent === "string" &&
      event.agent.trim() &&
      typeof event.sessionId === "string" &&
      event.sessionId.trim()
        ? (() => {
            const sessionId = event.sessionId.trim();
            const scope = readAppTaskSessionScope(opts.persistDir, sessionId);
            return {
              owner: event.agent.trim(),
              sessionId,
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
    const hasTaskRecoveryScope = Boolean(successfulOwner?.binding || successfulOwner?.workflowRunId);
    for (const descriptor of appRouterDescriptorsByBus.get(opts.bus) ?? []) {
      if (descriptor.reconciliationPaused) continue;
      const taskController = appTaskControllersByBus.get(opts.bus)?.get(descriptor.id);
      if (successfulOwner && hasTaskRecoveryScope && taskController && descriptor.app.tasks) {
        const config = taskReconciliationConfig({
          appDir: descriptor.appDir,
          projectDir: descriptor.projectDir,
          owner: descriptor.owner,
          maxConcurrent: descriptor.app.tasks?.maxConcurrent ?? 1,
        });
        if (
          successfulOwner.binding?.appId === descriptor.id &&
          workflowWasInterruptedByRestart(opts.persistDir, successfulOwner.workflowRunId)
        ) {
          const released = releaseLateTerminalWorkflowAppTaskAttempt(
            config,
            successfulOwner.binding,
            successfulOwner.sessionId,
            `Late terminal session ${successfulOwner.sessionId} cannot reattach to restart-interrupted workflow ${successfulOwner.workflowRunId}`,
          );
          if (released.released) {
            enqueueAppTask(taskController, config, released.taskId, { front: true });
            opts.bus.emit({
              type: "project.task.recovery.requeued",
              source: `app-task:${descriptor.id}:task-recovery`,
              owner: `agent:${successfulOwner.owner}`,
              target: { appId: descriptor.id },
              data: {
                project: descriptor.id,
                taskId: released.taskId,
                reason: "late-terminal-session-after-workflow-restart",
                evidenceSessionId: successfulOwner.sessionId,
                evidenceWorkflowRunId: successfulOwner.workflowRunId,
              },
            } as unknown as AgentEvent);
          }
        }
        for (const candidate of listHandlerExecutionFailedAppTasks(config)) {
          if (candidate.owner !== successfulOwner.owner) continue;
          if (
            !taskRecoverySessionScopesMatch(descriptor.id, opts.persistDir, candidate.sessionId, {
              binding: successfulOwner.binding,
              workflowRunId: successfulOwner.workflowRunId,
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
              owner: successfulOwner.owner,
              sessionId: successfulOwner.sessionId,
              observedAt: successfulOwner.observedAt,
              allowLegacyHandlerBlocked,
            })
          ) {
            continue;
          }
          enqueueAppTask(taskController, config, candidate.taskId);
          opts.bus.emit({
            type: "project.task.handler.recovered",
            source: `app-task:${descriptor.id}:task-recovery`,
            owner: `agent:${candidate.owner}`,
            target: { appId: descriptor.id },
            data: {
              project: descriptor.id,
              taskId: candidate.taskId,
              handler: "owner-execution",
              reason: "owner-session-succeeded-after-handler-execution-failure",
              evidenceSessionId: successfulOwner.sessionId,
              ...(successfulOwner.workflowRunId ? { evidenceWorkflowRunId: successfulOwner.workflowRunId } : {}),
            },
          } as unknown as AgentEvent);
        }
        if (successfulOwner.binding?.appId === descriptor.id) {
          enqueueAppTask(taskController, config, successfulOwner.binding.taskId, { front: true });
        }
      }
    }
    return undefined;
  }, { label: "app-task-session" });
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

async function prepareAppTaskRuntimeDescriptors(opts: AppTaskRuntimeOptions): Promise<AppTaskRuntimeDescriptor[]> {
  const descriptors: AppTaskRuntimeDescriptor[] = [];
  const ids = new Set<string>();
  const entries = opts.appRegistrySnapshot?.entries ?? opts.appRegistry?.snapshot().entries ?? [];
  for (const { appDir, definition: app } of entries) {
    if (!app.tasks) continue;
    const id = app.id;
    if (ids.has(id)) throw new Error(`Duplicate App task runtime id: ${id}`);
    ids.add(id);
    const descriptor: AppTaskRuntimeDescriptor = {
      id,
      appDir,
      projectDir: domainProjectDir(opts.projectsRoot, appDir, id, app),
      owner: configuredAppOwner(app, appDir),
      app,
      reconciliationPaused: false,
    };
    descriptor.reconciliationPaused = descriptor.app.tasks ? appLifecycle(descriptor.appDir) === "paused" : false;
    validatePreparedAppTaskRuntime(descriptor);
    descriptors.push(descriptor);
  }
  return descriptors;
}

async function commitAppTaskRuntimeDescriptors(
  opts: AppTaskRuntimeOptions,
  prepared: AppTaskRuntimeDescriptor[],
  recovery: { includeFreshLeases: boolean },
): Promise<{ installed: AppTaskRuntimeDescriptor[]; claimedSessionIds: Set<string> }> {
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
  const claimedSessionIds = recoverInterruptedAppTasks(
    opts,
    installed,
    controllers,
    recovery.includeFreshLeases,
  );
  await requeueRepairedAppTaskHandlers(opts, installed, controllers);

  return { installed, claimedSessionIds };
}

export async function installAppTaskRuntimes(
  opts: AppTaskRuntimeOptions,
  recovery: { includeFreshLeases?: boolean } = {},
): Promise<{ installed: AppTaskRuntimeDescriptor[]; claimedSessionIds: Set<string> }> {
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

function hashFile(path: string): string {
  try {
    return createHash("sha256").update(readFileSync(path)).digest("hex");
  } catch {
    return "";
  }
}

function hashRuntimeTsFiles(runtimeDir: string): string[] {
  const files: string[] = [];
  const pending = [runtimeDir];
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

function appLifecycle(appDir: string): string {
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

export function appTaskHostFingerprint(projectsRoot: string): string {
  const parts: string[] = [];
  for (const appDir of listAppDirs(projectsRoot)) {
    const tsPath = join(appDir, "app.ts");
    const jsPath = join(appDir, "app.js");
    const manifestPath = existsSync(tsPath) ? tsPath : jsPath;
    parts.push(`${appDir}\t${manifestPath}\t${hashFile(manifestPath)}`);
    parts.push(`${appDir}\tproject_lifecycle\t${appLifecycle(appDir)}`);
    parts.push(...hashRuntimeTsFiles(join(appDir, "watchers")));
    for (const agent of localAgents(appDir)) {
      const agentDir = join(appDir, "agents", agent.dirName);
      const configPath = join(agentDir, "agent.json");
      parts.push(`${appDir}\t${configPath}\t${hashFile(configPath)}`);
      parts.push(...hashRuntimeTsFiles(join(agentDir, "workflows")));
    }
  }
  return createHash("sha256").update(parts.join("\n")).digest("hex");
}

export function startAppTaskRuntimeWatcher(
  opts: AppTaskRuntimeOptions,
  watcherOpts: { intervalMs?: number; reload?: () => Promise<void> } = {},
): AppTaskRuntimeWatcher {
  const intervalMs = Math.max(1_000, watcherOpts.intervalMs ?? 5_000);
  let closed = false;
  let inFlight = false;
  let lastFingerprint = appTaskHostFingerprint(opts.projectsRoot);

  const scanNow = async (): Promise<boolean> => {
    if (closed || inFlight) return false;
    const nextFingerprint = appTaskHostFingerprint(opts.projectsRoot);
    if (nextFingerprint === lastFingerprint) return false;
    inFlight = true;
    try {
      if (watcherOpts.reload) await watcherOpts.reload();
      else {
        const result = await installAppTaskRuntimes(opts);
        opts.bus.emit({
          type: "info",
          message: `[app-task] Auto-reloaded ${result.installed.length} task-enabled App(s)`,
        });
      }
      lastFingerprint = nextFingerprint;
      return true;
    } catch (err) {
      opts.bus.emit({
        type: "info",
        message: `[app-task] Auto-reload failed: ${err instanceof Error ? err.message : String(err)}`,
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
