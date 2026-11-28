import { isDeepStrictEqual } from "node:util";
import { type TSchema } from "typebox";
import { AppTaskResourceStore } from "../app/core/state/app-task-resource-store.js";
import { assertCurrentTaskActor } from "../app/core/tasks/task-actor.js";
import { resolvedExecutionRecipient } from "./execution-recipient.js";
import { observeTaskFeedback, taskDetailRoot, type TaskExecutionContext } from "./task-execution-context.js";
import { drainSessionBashProcessGroups } from "@may-agent/sdk/runtime";
/**
 * Durable agent session runtime.
 *
 * The infrastructure-neutral runner owns construction of the Pi model/tool
 * loop. This wrapper owns persistence, event bridging, timeout, guards,
 * session state, and recovery.
 *
 * Pi-agent-core owns the model loop and retry behavior. This coordinator owns
 * durable session state, recovery, guards, event bridging, and bounded calls.
 */

import type { AgentMessage, AgentTool } from "@earendil-works/pi-agent-core";
import { bindToolsToExecutionScope, prepareAgentExecution, type ToolPolicy } from "./agent-execution.js";
import {
  ExecutionScope,
  classifyError,
  executionTimeout,
  extractFinishParams,
  invokeCatalogSkill,
  parseExplicitSkill,
  recoverCapturedWorkflowFinish,
  restoreAgentMessages,
  shouldAttemptWorkflowFinishRecovery,
  validateOperationAllowance,
  workflowFinishRecoveryPrompt,
  type MaySkill,
} from "@may-agent/sdk/runtime";
import { createAgentRun, type AgentRun } from "@may-agent/sdk/runtime";
import { observeExecutionUsage, recoverExecutionUsage, type UsageOutcome } from "./db/execution-usage.js";

import { existsSync, mkdirSync, realpathSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { normalizeEventOwner } from "../../packages/control/src/event-envelope.js";
import { ownsBoundedHelper } from "./session-helper-ownership.js";
import { EVENT_RECORD_ONLY, EVENT_ROW_ID, type EventBus, type EventTrace } from "../app/core/events/bus.js";
import { getDb } from "./db/connection.js";
import { readSessionTaskAttempt, upsertSession, updateSessionDb, updateSessionProgress } from "./db/sessions.js";
import { writeSessionResult } from "./artifacts.js";
import {
  getWorkflowRun,
  getWorkflowStepSessions,
  listRunningWorkflowRunIdsBefore,
  updateWorkflowRun,
} from "./db/workflows.js";
import { log } from "@may-agent/sdk/runtime";
import { createAgentsTool as createAgentsToolFn, type CreateAgentsToolOptions } from "./manager-agents-tool.js";
import {
  classifyTerminalAssistantFailure,
  extractLastAssistantError,
  extractLastAssistantText,
  formatDuration,
  generateId,
  isRetryableEmptyAssistantFailure,
  trimTerminalEmptyAssistantTurn,
} from "@may-agent/sdk/runtime";
import type { PersistedSession, SessionKind, TaskBinding } from "./persistence.js";
import {
  RegistryStore,
  appendSessionMessage,
  ensureSessionDir,
  listActiveSessionIds,
  markSessionActive,
  markSessionInactive,
  readSessionMessagesTail,
  readSessionMetaRecoveryEvidence,
  rewriteSessionMessages,
  saveCompactedMessages,
  sessionDir,
  sessionOutputDir,
} from "./persistence.js";
import { confirmSessionExecutionStopped, hasLiveSessionExecution } from "./session-cleanup.js";
import { createFinishTool } from "@may-agent/sdk/runtime";
import type { SessionInfo, SubagentDefinition, TaskResult } from "@may-agent/sdk/runtime";

// Re-export utilities that other modules import from manager
export { classifyError, extractFinishParams };
export { formatDuration, generateId, truncateForPrompt } from "@may-agent/sdk/runtime";
export type { RegisteredAgent } from "@may-agent/sdk/runtime";
export type { SessionInfo, SubagentDefinition, TaskResult } from "@may-agent/sdk/runtime";

// ── Types ─────────────────────────────────────────────────────────────

export interface RunOptions {
  sessionId?: string;
  parentSessionId?: string;
  parentAgentName?: string;
  originSessionId?: string;
  workflowRunId?: string;
  stepLabel?: string;
  source?: string;
  kind?: Exclude<SessionKind, "chat">;
  requestId?: string;
  /** Stable logical human conversation captured when this session starts. */
  conversationId?: string;
  /** Channel message this session must answer; never infer it from another turn. */
  channelMessageId?: number;
  projectId?: string;
  /** Current fenced App Task attempt exposed only to scoped Task tools. */
  taskBinding?: TaskBinding;
  taskContext?: TaskExecutionContext;
  /** Immutable non-Task callable definitions captured for this execution tree. */
  agentDefinitions?: ReadonlyMap<string, SubagentDefinition>;
  /** Internal identity for one prepared callable catalog, including loaded workflows. */
  callableCatalogScope?: object;
  contextPrompt?: string;
  /** Runtime that exclusively owns crash recovery for this session. */
  recoveryOwner?: string;
  startedAt?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  deadlineAt?: number;
  trace?: EventTrace;
  /** Explicit primary skill to activate for this turn. */
  skill?: string;
  /** Direct inputs accept $skill commands; delegated assignments stay literal. */
  parseSkillCommand?: boolean;
  /** Require the agent to terminate through finish(); used by workflow steps. */
  requireFinish?: boolean;
  /** Retired. Supplying this option throws; use timeoutMs or deadlineAt. */
  operationAllowance?: number;
  /** Caller-defined schema for the required finish().output payload. */
  outputSchema?: TSchema;
  /** Pure current-invocation validation; never serialized as session state. */
  validateOutput?: (result: unknown) => string | null;
  /** Current-invocation finish binding supplied by a trusted caller; never serialized. */
  createFinish?: () => AgentTool;
  /** Trusted current-invocation bindings; never persisted or inherited by helpers. */
  toolBindings?: readonly AgentTool[];
  /** Restrict the supplied capabilities for this session. */
  toolPolicy?: ToolPolicy;
  /** Effective filesystem root supplied by an enclosing workflow/task. */
  executionRoot?: string;
  /** Optional prior turn messages for multi-turn in-attempt workflow agent sessions. */
  initialMessages?: AgentMessage[];
}

export type CallAgentOptions = Pick<
  RunOptions,
  | "parentSessionId"
  | "source"
  | "workflowRunId"
  | "projectId"
  | "taskBinding"
  | "taskContext"
  | "agentDefinitions"
  | "callableCatalogScope"
  | "contextPrompt"
  | "recoveryOwner"
  | "stepLabel"
  | "trace"
  | "skill"
  | "parseSkillCommand"
  | "requireFinish"
  | "operationAllowance"
  | "outputSchema"
  | "validateOutput"
  | "createFinish"
  | "toolBindings"
  | "toolPolicy"
  | "executionRoot"
  | "initialMessages"
  | "deadlineAt"
> & {
  timeout?: number;
  signal?: AbortSignal;
  sessionStarted?: (sessionId: string) => void;
};

interface ActiveSession {
  usage?: ReturnType<typeof observeExecutionUsage>;
  executionCleanupConfirmed?: boolean;
  scopedChildren?: Set<Promise<TaskResult>>;
  restoredMessages?: ReadonlySet<unknown>;
  sessionId: string;
  agent: AgentRun;
  agentName: string;
  /** Selected once for all turns, skills and completion of this live session. */
  readonly definition: SubagentDefinition;
  task: string;
  startedAt: number;
  status: "running" | "interrupted";
  lastError?: string;
  interruptionKind?: "execution-timeout" | "cancelled";
  kind: Exclude<SessionKind, "chat">;
  parentSessionId?: string;
  originSessionId?: string;
  workflowRunId?: string;
  stepLabel?: string;
  source?: string;
  executionScope?: ExecutionScope;
  parentSignal?: AbortSignal;
  parentDeadlineAt?: number;
  admittedTimeoutMs?: number;
  toolCalls: number;
  modelStepCount: number;
  requestId?: string;
  conversationId?: string;
  channelMessageId?: number;
  projectId?: string;
  taskBinding?: TaskBinding;
  taskContext?: TaskExecutionContext;
  agentDefinitions?: ReadonlyMap<string, SubagentDefinition>;
  callableCatalogScope?: object;
  recoveryOwner?: string;
  trace?: EventTrace;
  /** Semantic intent traces merged into the currently executing turn. */
  /** Prompt text may include an explicitly activated skill; task remains the work identity. */
  promptTask?: string;
  loadedSkillHashes: Set<string>;
  requireFinish: boolean;
  operationAllowance?: number;
  outputSchema?: TSchema;
  tools?: AgentTool[];
  toolPolicy: ToolPolicy;
  executionRoot?: string;
}

export interface SubagentManagerOptions {
  persistDir: string;
  projectRoot?: string;
  bus?: EventBus;
  maxCallDepth?: number;
  /** Runtime construction seam used by focused lifecycle tests. */
  agentRunFactory?: typeof createAgentRun;
}

const MAX_COMPLETED_RESULTS_IN_MEMORY = 16;
const MAX_RESULT_MESSAGES = 1_000;
const MAX_TRANSCRIPT_TAIL_BYTES = 8 * 1024 * 1024;

// ── SubagentManager (v2 implementation) ──────────────────────────────

function registeredAgentName(definition: SubagentDefinition): string {
  return definition.appLocal && definition.projectId
    ? `${definition.projectId}/${definition.name}`
    : `global/${definition.name}`;
}

export class SubagentManager {
  // Public maps for AgentsToolManagerDeps compatibility
  agents = new Map<string, { definition: SubagentDefinition }>();
  callDepths = new Map<string, number>();
  private _sessions = new Map<string, ActiveSession>();
  private results = new Map<string, Promise<TaskResult>>();
  private completedResults = new Map<string, TaskResult>();
  private _persistDir: string;
  private _projectRoot: string;
  private bus?: EventBus;
  private _registry: RegistryStore;
  private _maxCallDepth: number;
  private _agentRunFactory: typeof createAgentRun;
  private _createdAt = Date.now();
  private _promptTimestamp = new Date().toISOString();

  /** Expose activeSessions for AgentsToolManagerDeps */
  get activeSessions(): Map<string, ActiveSession> {
    return this._sessions;
  }

  constructor(opts: SubagentManagerOptions) {
    this._persistDir = opts.persistDir;
    this._projectRoot = opts.projectRoot ?? opts.persistDir;
    this.bus = opts.bus;
    this._registry = new RegistryStore(opts.persistDir);
    this._maxCallDepth = opts.maxCallDepth ?? 8;
    this._agentRunFactory = opts.agentRunFactory ?? createAgentRun;
  }

  private rememberCompletedResult(result: TaskResult): void {
    this.completedResults.delete(result.sessionId);
    // The transcript is already durable in session.jsonl. Keep only the exact
    // terminal receipt in heap and hydrate a bounded tail when explicitly read.
    this.completedResults.set(result.sessionId, { ...result, messages: [] });
    while (this.completedResults.size > MAX_COMPLETED_RESULTS_IN_MEMORY) {
      const oldest = this.completedResults.keys().next().value as string | undefined;
      if (!oldest) break;
      this.completedResults.delete(oldest);
    }
  }

  register(def: SubagentDefinition): void {
    resolvedExecutionRecipient(def);
    this.agents.set(registeredAgentName(def), { definition: def });
  }

  unregister(name: string): void {
    this.agents.delete(name);
    this.agents.delete(`global/${name}`);
  }

  hasAgent(name: string): boolean {
    return this.agents.has(name) || this.agents.has(`global/${name}`);
  }
  agentNames(): string[] {
    return [...this.agents.keys()];
  }

  listAgents(): Array<{ name: string; description: string; domain: string }> {
    return [...this.agents.values()].map((a) => ({
      name: a.definition.name,
      description: a.definition.description,
      domain: a.definition.domain,
    }));
  }

  /** Resolve the same definition for helper authorization and execution. */
  getAgentDefinition(name: string, callerSessionId?: string): SubagentDefinition | undefined {
    const session = callerSessionId ? this._sessions.get(callerSessionId) : undefined;
    const captured = session?.taskContext?.agentDefinitions ?? session?.agentDefinitions;
    const exact =
      captured?.get(name) ??
      captured?.get(`global/${name}`) ??
      this.agents.get(name)?.definition ??
      this.agents.get(`global/${name}`)?.definition;
    if (exact) return exact;
    const matches = [
      ...(captured?.values() ?? []),
      ...[...this.agents.values()].map((entry) => entry.definition),
    ].filter((definition, index, all) => definition.name === name && all.indexOf(definition) === index);
    return matches.length === 1 ? matches[0] : undefined;
  }

  // ── Session lifecycle ──

  run(name: string, task: string, opts?: RunOptions): string {
    const definition = this.getAgentDefinition(name);
    if (!definition) throw new Error(`Agent "${name}" not registered`);
    return this.runDefinition(definition, task, opts);
  }

  /** Start from an immutable definition captured by the caller. */
  runDefinition(def: SubagentDefinition, task: string, opts?: RunOptions): string {
    return this.startDefinition(def, task, opts);
  }

  private startDefinition(def: SubagentDefinition, task: string, opts?: RunOptions, onAdmitted?: () => void): string {
    // Validate untyped callers before allocating any execution evidence.
    if (opts && Object.hasOwn(opts, "autoClose")) throw new Error("Managed execution no longer accepts autoClose");
    if (opts?.kind !== undefined && opts.kind !== "job" && opts.kind !== "call") {
      throw new Error("Managed execution kind must be job or call; persistent chat is retired");
    }
    const recipient = resolvedExecutionRecipient(def);
    const parent = opts?.parentSessionId ? this._sessions.get(opts.parentSessionId) : undefined;
    if (parent) {
      if (parent.status !== "running" || !parent.executionScope) throw new Error("Caller is not executing");
      parent.executionScope.signal.throwIfAborted();
      if (opts?.toolPolicy && parent.toolPolicy !== "full" && opts.toolPolicy !== parent.toolPolicy) {
        throw new Error("Helper tool policy must retain the caller restriction");
      }
      opts = {
        ...opts,
        taskBinding: parent.taskBinding ?? opts?.taskBinding,
        taskContext: parent.taskContext ?? opts?.taskContext,
        agentDefinitions: parent.taskContext?.agentDefinitions ?? parent.agentDefinitions ?? opts?.agentDefinitions,
        callableCatalogScope: parent.taskContext ?? parent.callableCatalogScope ?? opts?.callableCatalogScope,
        recoveryOwner: parent.recoveryOwner ?? opts?.recoveryOwner,
        executionRoot: parent.executionRoot ?? opts?.executionRoot,
        toolPolicy: opts?.toolPolicy ?? parent.toolPolicy,
        signal: opts?.signal
          ? AbortSignal.any([opts.signal, parent.executionScope.signal])
          : parent.executionScope.signal,
        deadlineAt: Math.min(
          opts?.deadlineAt ?? Infinity,
          parent.executionScope.deadlineAt ?? Infinity,
        ),
      };
    }
    opts?.signal?.throwIfAborted();
    if (opts?.taskContext?.taskBinding) {
      if (opts.taskBinding && !isDeepStrictEqual(opts.taskBinding, opts.taskContext.taskBinding)) {
        throw new Error("Task execution binding does not match its Task context");
      }
      if (!opts.taskBinding) opts = { ...opts, taskBinding: opts.taskContext.taskBinding };
    }
    if (opts?.taskContext) {
      opts.taskContext.detailRoot ??= taskDetailRoot(this._persistDir, opts.taskContext.taskBinding);
    }
    const timeoutMs = executionTimeout(opts?.timeoutMs ?? def.timeoutMs, opts?.deadlineAt);
    const sessionId = opts?.sessionId ?? generateId(def.sessionIdPrefix);
    if (this._sessions.has(sessionId)) throw new Error(`Session "${sessionId}" already active`);
    const startedAt = opts?.startedAt ?? Date.now();
    const kind = opts?.kind ?? "job";
    const executionContext = [
      `Execution: ${JSON.stringify(sessionId)}. Caller session: ${JSON.stringify(opts?.parentSessionId ?? null)}. Workflow: ${JSON.stringify(opts?.workflowRunId ?? null)}.`,
      `Original assignment and caller links: ${JSON.stringify(join(this._persistDir, "sessions", sessionId, "meta.json"))}. If the assignment was compacted, read its task field before continuing.`,
    ].join("\n");
    validateOperationAllowance(opts?.operationAllowance);
    const toolPolicy = opts?.toolPolicy ?? "full";
    const existingMeta = this._registry.getSession(sessionId);
    if (existingMeta || existsSync(sessionDir(this._persistDir, sessionId))) {
      throw new Error(`Session "${sessionId}" already has execution evidence; start a fresh session`);
    }
    if (opts?.taskBinding) {
      const db = getDb(this._persistDir);
      const store = AppTaskResourceStore.activeFromDb(db, opts.taskBinding.appId);
      if (!store) throw new Error("Task execution requires canonical authority");
      assertCurrentTaskActor({ resourceStore: store }, opts.taskBinding, "managed start");
      const attempt = store.readAttempt(opts.taskBinding.attemptId);
      if (attempt) {
        const nextIds = [
          ...new Set([...(attempt.sessionIds ?? []), ...(attempt.sessionId ? [attempt.sessionId] : []), sessionId]),
        ];
        if (nextIds.length !== (attempt.sessionIds?.length ?? 0)) {
          attempt.sessionIds = nextIds;
          db.prepare("UPDATE app_task_attempts SET attempt_json = ? WHERE app_id = ? AND attempt_id = ?").run(
            JSON.stringify(attempt),
            opts.taskBinding.appId,
            opts.taskBinding.attemptId,
          );
        }
      }
    }
    let executionDispatched = false;
    try {
      onAdmitted?.();

      const usage = observeExecutionUsage(
        this._persistDir,
        {
          sessionId,
          agent: def.name,
          appId: opts?.taskBinding?.appId ?? opts?.projectId ?? def.projectId,
          workflowRunId: opts?.workflowRunId,
          taskId: opts?.taskBinding?.taskId,
          attemptId: opts?.taskBinding?.attemptId,
          configuredModel: `${def.model.provider}/${def.model.id}`,
        },
        (error) => log("warn", `[usage] Could not save execution measurements for ${sessionId}: ${String(error)}`),
      );
      const prepared = prepareAgentExecution({
        onPreparation: usage.preparation,
        executionContext,
        definition: def,
        projectRoot: this._projectRoot,
        sessionId,
        task,
        taskContext: opts?.taskContext,
        contextPrompt: opts?.contextPrompt,
        skill: opts?.skill,
        parseSkillCommand: opts?.parseSkillCommand,
        requireFinish: opts?.requireFinish,
        outputSchema: opts?.outputSchema,
        validateOutput: opts?.validateOutput,
        toolPolicy,
        executionRoot: opts?.executionRoot,
        promptTimestamp: this._promptTimestamp,
        createFinish:
          opts?.createFinish ??
          (() =>
            createFinishTool({
              projectRoot: opts?.executionRoot ?? def.projectRoot ?? this._projectRoot,
            })),
        toolBindings: opts?.toolBindings,
        bashProcessGroupOwner: { persistDir: this._persistDir, sessionId },
        onCompact: (info, messages) => {
          log(
            "info",
            `[manager] Compacted ${sessionId} (${def.name}): ${info.messagesCompacted} compacted, ${info.messagesKept} kept, ${info.tokensBefore}->${info.tokensAfter} tokens`,
          );
          try {
            saveCompactedMessages(this._persistDir, sessionId, messages);
          } catch (error) {
            log(
              "warn",
              `[manager] Failed to save compacted context for ${sessionId}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        },
        onNotice: (message) => log("warn", message),
      });
      const sessionTask = prepared.task;
      const outputSchema = prepared.outputSchema;
      const requireFinish = prepared.requireFinish;
      const activation = prepared.activatedSkill;

      // Setup persistence
      ensureSessionDir(this._persistDir, sessionId);
      markSessionActive(this._persistDir, sessionId);
      mkdirSync(sessionOutputDir(this._persistDir, sessionId), { recursive: true });
      writeFileSync(join(sessionDir(this._persistDir, sessionId), "[STARTED]"), new Date().toISOString(), "utf-8");

      // Create the same prepared model/tool loop used by direct callers. The
      // durable manager only adds persistence and system-event adapters around it.
      const tools = bindToolsToExecutionScope(prepared.tools, () => this._sessions.get(sessionId)?.executionScope);
      const agent = this._agentRunFactory({
        ...prepared.runner,
        initialState: { ...prepared.runner.initialState, tools },
      });
      if (opts?.initialMessages) restoreAgentMessages(agent, opts.initialMessages);
      const restoredMessages = new Set<unknown>(agent.state.messages as unknown[]);
      agent.subscribe(usage.observe);

      // JSONL persistence
      agent.subscribe((event) => {
        if (event.type === "message_end" && "message" in event) {
          appendSessionMessage(this._persistDir, sessionId, (event as any).message);
        }
      });

      const session: ActiveSession = {
        usage,
        restoredMessages,
        sessionId,
        agent,
        agentName: def.name,
        definition: def,
        task: sessionTask,
        startedAt,
        status: "running",
        kind,
        parentSessionId: opts?.parentSessionId,
        originSessionId: opts?.originSessionId,
        workflowRunId: opts?.workflowRunId,
        stepLabel: opts?.stepLabel,
        source: opts?.source,
        admittedTimeoutMs: timeoutMs,
        parentSignal: opts?.signal,
        parentDeadlineAt: opts?.deadlineAt,
        toolCalls: 0,
        modelStepCount: 0,
        requestId: opts?.requestId,
        conversationId: opts?.conversationId,
        channelMessageId: opts?.channelMessageId,
        projectId: opts?.projectId,
        taskBinding: opts?.taskBinding,
        taskContext: opts?.taskContext,
        agentDefinitions: opts?.taskContext?.agentDefinitions ?? opts?.agentDefinitions,
        callableCatalogScope: opts?.taskContext ?? opts?.callableCatalogScope,
        recoveryOwner: opts?.recoveryOwner,
        trace: opts?.trace,
        promptTask: prepared.prompt,
        loadedSkillHashes: new Set(activation ? [activation.contentHash] : []),
        requireFinish,
        outputSchema,
        tools,
        toolPolicy,
        executionRoot: opts?.executionRoot,
      };

      this._registry.saveSession(sessionId, {
        agent: def.name,
        agentRelativeDir: def.agentRelativeDir ?? null,
        agentHostIdentity: recipient?.kind === "programmatic" ? recipient.id : null,
        task: sessionTask,
        status: "running",
        startedAt,
        parentSessionId: opts?.parentSessionId,
        workflowRunId: opts?.workflowRunId,
        stepLabel: opts?.stepLabel,
        source: opts?.source,
        requestId: opts?.requestId,
        conversationId: opts?.conversationId,
        channelMessageId: opts?.channelMessageId,
        projectId: opts?.projectId,
        // Persist the live attempt's exact scope, including an explicit absence.
        // Retained transcript metadata must not resurrect an old fenced binding.
        taskBinding: session.taskBinding,
        recoveryOwner: opts?.recoveryOwner,
        kind,
        requireFinish,
        outputSchema: outputSchema,
        toolPolicy,
        executionRoot: opts?.executionRoot,
      });

      // Register before publishing session.start so synchronous subscribers see
      // the same live state as the durable event. Roll back the in-memory and
      // registry state if the required persistence boundary rejects the event.
      // Waiters must observe this invocation,
      // rather than return the previous invocation's cached terminal result.
      this.completedResults.delete(sessionId);
      this._sessions.set(sessionId, session);
      try {
        upsertSession(this._persistDir, {
          sessionId,
          agent: session.agentName,
          task: session.task,
          status: "running",
          kind: session.kind,
          source: session.source ?? "runtime",
          parentSessionId: session.parentSessionId,
          workflowRunId: session.workflowRunId,
          projectId: session.projectId,
          taskBinding: session.taskBinding,
          requestId: session.requestId,
          stepLabel: session.stepLabel,
          startedAt: session.startedAt,
        });
        this.bridgeEvents(session);
        if (activation) this.emitSkillLoaded(session, activation, prepared.skillActivation ?? "explicit", opts?.trace);
      } catch (err) {
        this._sessions.delete(sessionId);
        const reason = `Failed to persist session start: ${err instanceof Error ? err.message : String(err)}`;
        this._registry.updateSessionStatus(sessionId, "error", reason);
        markSessionInactive(this._persistDir, sessionId);
        throw err;
      }

      executionDispatched = true;
      this.startManagedExecution(session);
      return sessionId;
    } catch (error) {
      if (!executionDispatched) {
        this._sessions.delete(sessionId);
        markSessionInactive(this._persistDir, sessionId);
      }
      throw error;
    }
  }

  cancel(sessionId: string): void {
    const session = this._sessions.get(sessionId);
    if (!session || session.status === "interrupted") return;
    session.status = "interrupted";
    session.interruptionKind = "cancelled";
    session.lastError = "Cancelled";
    if (session.executionScope) session.executionScope.stop(new Error("Cancelled"));
    else session.agent.cancel();
    // The invocation owns cleanup and its terminal receipt.
  }

  private steerTaskFeedback(session: ActiveSession, text: string, trace?: EventTrace): void {
    if (session.status !== "running") return;
    this.assertSessionContinuation(session);
    session.executionScope?.signal.throwIfAborted();
    const parsedSkill = parseExplicitSkill(text);
    const skillName = parsedSkill.skill;
    const turnTask = parsedSkill.skill ? parsedSkill.task : text;
    const activation = skillName ? invokeCatalogSkill(session.definition.skillCatalog, skillName, turnTask) : undefined;
    if (trace) session.trace = trace;
    if (activation) {
      session.loadedSkillHashes.add(activation.skill.contentHash);
      this.emitSkillLoaded(session, activation.skill, "explicit", trace);
    }
    const promptText = activation?.prompt ?? turnTask;
    const msg = { role: "user" as const, content: [{ type: "text" as const, text: promptText }] };
    session.agent.steer(msg as AgentMessage);
  }

  /** Correct owned live work without creating or reviving another execution. */
  followUpHelper(sessionId: string, text: string, callerSessionId?: string): void {
    if (!text.trim()) throw new Error("Helper follow-up requires non-empty content");
    if (!ownsBoundedHelper(this, callerSessionId, sessionId)) {
      throw new Error("Follow-up requires a live helper owned by this caller; use its returned sessionId");
    }
    const caller = this._sessions.get(callerSessionId!)!;
    const helper = this._sessions.get(sessionId)!;
    if (caller.status !== "running" || helper.status !== "running") {
      throw new Error(
        "Caller and helper must still be running; inspect the helper result before deciding the next step",
      );
    }
    this.assertSessionContinuation(caller);
    this.assertSessionContinuation(helper);
    caller.executionScope?.signal.throwIfAborted();
    helper.executionScope?.signal.throwIfAborted();
    // Literal caller input, not a skill command or a new Task requirement.
    helper.agent.steer({ role: "user", content: [{ type: "text", text }] } as AgentMessage);
  }

  // ── Query ──

  status(): SessionInfo[] {
    return [...this._sessions.values()].map((s) => ({
      sessionId: s.sessionId,
      agent: s.agentName,
      task: s.task,
      status: "running" as const, // Includes invocations still draining after a stop request.
      startedAt: s.startedAt,
      runtime: formatDuration(Date.now() - s.startedAt),
      outputDir: sessionOutputDir(this._persistDir, s.sessionId),
      parentSessionId: s.parentSessionId,
      workflowRunId: s.workflowRunId,
      stepLabel: s.stepLabel,
      kind: s.kind,
      turnCount: s.modelStepCount,
      error: s.lastError,
    }));
  }

  hasActiveSession(sessionId: string): boolean {
    return this._sessions.has(sessionId);
  }

  getSessionCount(): number {
    return this._sessions.size;
  }

  sessions(agentName?: string): SessionInfo[] {
    const items = this.status();
    return agentName ? items.filter((s) => s.agent === agentName) : items;
  }

  result(sessionId: string): TaskResult {
    const completed = this.completedResults.get(sessionId);
    if (completed) return this.hydrateCompletedResult(completed);
    return this.resultFromStoredSession(sessionId);
  }

  getSessionSummary(sessionId: string): { task: string; summary: string; status: string } {
    const session = this._sessions.get(sessionId);
    const completed = this.completedResults.get(sessionId);
    const persisted = session ? null : this._registry.getSession(sessionId);
    const storedResult =
      !session && !completed && persisted && persisted.status !== "running" && persisted.status !== "idle"
        ? this.resultFromStoredSession(sessionId)
        : null;
    return {
      task: session?.task ?? persisted?.task ?? "",
      summary: completed?.lastAssistantText ?? storedResult?.lastAssistantText ?? (persisted?.status === "idle" ? "(historical idle)" : "(running)"),
      status: completed?.status ?? session?.status ?? persisted?.status ?? "unknown",
    };
  }

  progress(sessionId: string, limit = 20): AgentMessage[] {
    const normalizedLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 20;
    if (normalizedLimit === 0) return [];

    const session = this._sessions.get(sessionId);
    if (session)
      return session.agent.state.messages.filter((message) => message.role !== "system").slice(-normalizedLimit);

    const persisted = this._registry.getSession(sessionId);
    if (!persisted) throw new Error(`Session "${sessionId}" not found`);

    return readSessionMessagesTail(this._persistDir, sessionId, normalizedLimit, MAX_TRANSCRIPT_TAIL_BYTES).filter(
      (message) => message.role !== "system",
    );
  }

  // ── Await ──

  async waitFor(sessionId: string): Promise<TaskResult> {
    const promise = this.results.get(sessionId);
    const completed = this.completedResults.get(sessionId);
    if (completed) return this.hydrateCompletedResult(completed);
    if (!promise) return this.resultFromStoredSession(sessionId);
    return promise;
  }

  private callDepthLimitError(parentSessionId?: string): (TaskResult & { messages: AgentMessage[] }) | undefined {
    const parentDepth = parentSessionId ? (this.callDepths.get(parentSessionId) ?? 0) : 0;
    if (parentDepth < this._maxCallDepth) return undefined;
    return {
      sessionId: "",
      status: "error",
      lastAssistantText: null,
      messages: [],
      duration: "0s",
      outputDir: "",
      error: `Call depth limit exceeded (${parentDepth}/${this._maxCallDepth})`,
    };
  }

  async callAgent(
    agentName: string,
    task: string,
    opts?: CallAgentOptions,
  ): Promise<TaskResult & { messages: AgentMessage[] }> {
    const depthError = this.callDepthLimitError(opts?.parentSessionId);
    if (depthError) return depthError;
    const definition = this.getAgentDefinition(agentName, opts?.parentSessionId);
    if (!definition) throw new Error(`Agent "${agentName}" not registered`);
    return this.callAgentDefinition(definition, task, opts);
  }

  /** Call an agent through an immutable definition captured by the caller. */
  async callAgentDefinition(
    definition: SubagentDefinition,
    task: string,
    opts?: CallAgentOptions,
  ): Promise<TaskResult & { messages: AgentMessage[] }> {
    opts?.signal?.throwIfAborted();
    const parentDepth = opts?.parentSessionId ? (this.callDepths.get(opts.parentSessionId) ?? 0) : 0;
    const depthError = this.callDepthLimitError(opts?.parentSessionId);
    if (depthError) return depthError;
    const sessionId = this.runDefinition(definition, task, {
      parentSessionId: opts?.parentSessionId,
      source: opts?.source ?? "callAgent",
      kind: "call",
      workflowRunId: opts?.workflowRunId,
      projectId: opts?.projectId,
      taskBinding: opts?.taskBinding,
      taskContext: opts?.taskContext,
      agentDefinitions: opts?.agentDefinitions,
      callableCatalogScope: opts?.callableCatalogScope,
      recoveryOwner: opts?.recoveryOwner,
      stepLabel: opts?.stepLabel,
      contextPrompt: opts?.contextPrompt,
      timeoutMs: opts?.timeout,
      deadlineAt: opts?.deadlineAt,
      signal: opts?.signal,
      trace: opts?.trace,
      skill: opts?.skill,
      parseSkillCommand: opts?.parseSkillCommand,
      requireFinish: opts?.requireFinish,
      operationAllowance: opts?.operationAllowance,
      outputSchema: opts?.outputSchema,
      validateOutput: opts?.validateOutput,
      createFinish: opts?.createFinish,
      toolBindings: opts?.toolBindings,
      toolPolicy: opts?.toolPolicy,
      executionRoot: opts?.executionRoot,
      initialMessages: opts?.initialMessages,
    });
    const liveResultPromise = this.results.get(sessionId);
    this.callDepths.set(sessionId, parentDepth + 1);
    const cancel = () => {
      try {
        this.cancel(sessionId);
      } catch (error) {
        // cancel() signals the runner before writing its facts. A storage
        // outage must not escape the AbortSignal callback as a fatal exception.
        console.error(`[session:${sessionId}] cancellation facts failed: ${String(error)}`);
      }
    };
    try {
      opts?.signal?.throwIfAborted();
      opts?.sessionStarted?.(sessionId);
    } catch (error) {
      cancel();
      await this.waitFor(sessionId);
      throw error;
    }
    const result = liveResultPromise ? await liveResultPromise : await this.waitFor(sessionId);
    opts?.signal?.throwIfAborted();
    return {
      ...result,
      messages: Array.isArray(result.messages) && result.messages.length > 0 ? result.messages : this.progress(sessionId, 1000),
    };
  }

  runAgent(
    agentName: string,
    task: string,
    opts?: {
      parentSessionId?: string;
      originSessionId?: string;
      source?: string;
      requestId?: string;
      workflowRunId?: string;
      projectId?: string;
      recoveryOwner?: string;
      trace?: EventTrace;
      skill?: string;
      parseSkillCommand?: boolean;
      requireFinish?: boolean;
      operationAllowance?: number;
      outputSchema?: TSchema;
      toolPolicy?: ToolPolicy;
      executionRoot?: string;
      signal?: AbortSignal;
    },
  ): string {
    if (!opts?.parentSessionId || !this._sessions.get(opts.parentSessionId)?.executionScope) {
      throw new Error("Fork requires a live caller; durable work belongs to a Task");
    }
    const definition = this.getAgentDefinition(agentName, opts.parentSessionId);
    if (!definition) throw new Error(`Agent "${agentName}" not registered`);
    return this.runDefinition(definition, task, {
      parentSessionId: opts?.parentSessionId,
      originSessionId: opts?.originSessionId,
      source: opts?.source ?? "agents.run",
      kind: "job",
      requestId: opts?.requestId,
      workflowRunId: opts?.workflowRunId,
      projectId: opts?.projectId,
      recoveryOwner: opts?.recoveryOwner,
      trace: opts?.trace,
      skill: opts?.skill,
      parseSkillCommand: opts?.parseSkillCommand,
      requireFinish: opts?.requireFinish,
      operationAllowance: opts?.operationAllowance,
      outputSchema: opts?.outputSchema,
      toolPolicy: opts?.toolPolicy,
      executionRoot: opts?.executionRoot,
      signal: opts?.signal,
    });
  }

  /** Confirm stopped execution and retain its evidence. Only Tasks retry obligations. */
  cleanupStaleSessions(): { interrupted: SessionInfo[] } {
    const stale = new Map<string, PersistedSession>();
    const cleanup = { manager: this, persistDir: this._persistDir };
    const protectedSessionIds = new Set<string>();
    const recoverUsage = (sessionId: string, outcome: UsageOutcome) => {
      try {
        recoverExecutionUsage(getDb(this._persistDir), sessionId, outcome);
      } catch (error) {
        log("warn", `[usage] Could not recover execution measurements for ${sessionId}: ${String(error)}`);
      }
    };

    // Discover candidates once. Every mutation, including removal of a marker
    // with missing metadata, follows the same execution cleanup as Task recovery.
    // Startup may overlap the Task recovery worker and externally owned work.
    for (const sessionId of listActiveSessionIds(this._persistDir)) {
      if (hasLiveSessionExecution(cleanup, sessionId)) {
        protectedSessionIds.add(sessionId);
        continue;
      }
      const evidence = readSessionMetaRecoveryEvidence(this._persistDir, sessionId);
      const fields = evidence.state !== "absent" ? evidence.meta : undefined;
      try {
        // Discovery supplies the retained record; copied scope alone does not
        // authorize cleanup of an incomplete Task execution.
        const retained = readSessionTaskAttempt(this._persistDir, sessionId, fields?.taskBinding);
        const persisted = confirmSessionExecutionStopped(cleanup, sessionId, retained ?? undefined);
        if (!persisted) {
          // The retained Task can finish lifecycle reconciliation without
          // rewriting damaged history. No unchecked fields reach SQL here.
          markSessionInactive(this._persistDir, sessionId);
          continue;
        }
        if (persisted.status === "idle") {
          // The previous turn parked without a terminal receipt. Preserve its
          // history; removing an exited owner's marker does not complete it.
          markSessionInactive(this._persistDir, sessionId);
        } else if (persisted.status === "done" || persisted.status === "error" || persisted.status === "interrupted") {
          recoverUsage(sessionId, persisted.status);
          updateSessionDb(this._persistDir, sessionId, {
            status: persisted.status,
            ...(persisted.endedAt !== undefined ? { endedAt: persisted.endedAt } : {}),
            error: persisted.error,
          });
          markSessionInactive(this._persistDir, sessionId);
        } else {
          stale.set(sessionId, persisted);
        }
      } catch (error) {
        protectedSessionIds.add(sessionId);
        log("error", `[manager] Refusing startup recovery for ${sessionId}: ${String(error)}`);
        continue;
      }
    }

    const interrupted: SessionInfo[] = [];
    for (const [sessionId, persisted] of stale) {
      recoverUsage(sessionId, "interrupted");
      const error = "Process restarted; recover work through its owning Task";
      const endedAt = Date.now();
      this._registry.updateSessionStatus(sessionId, "interrupted", error);
      updateSessionDb(this._persistDir, sessionId, { status: "interrupted", endedAt, error });
      markSessionInactive(this._persistDir, sessionId);
      interrupted.push(this.sessionInfoFromMeta(sessionId, { ...persisted, status: "interrupted", endedAt, error }));
    }

    this.cleanupStaleWorkflowRuns(protectedSessionIds);
    return { interrupted };
  }

  health() {
    const activeSessions = this.status();
    return {
      timestamp: new Date().toISOString(),
      uptime: formatDuration(Date.now() - this._createdAt),
      registeredAgents: {
        count: this.agents.size,
        names: [...this.agents.keys()],
      },
      activeSessions,
      sessionCounts: {
        running: activeSessions.filter((s) => s.status === "running").length,
        idle: 0, // Retained health response field; managed invocations never park.
        total: activeSessions.length,
      },
    };
  }

  // ── Tool creation ──

  createAgentsTool(opts?: CreateAgentsToolOptions): AgentTool {
    return createAgentsToolFn(this, opts);
  }

  // ── Path helpers ──

  get registryStore(): RegistryStore {
    return this._registry;
  }

  /** Alias for AgentsToolManagerDeps compatibility */
  get registry(): RegistryStore {
    return this._registry;
  }

  get projectRoot(): string {
    return this._projectRoot;
  }

  getWorkflowSteps(workflowRunId: string): Array<{ step: string; sessionId: string; summary: string }> {
    return getWorkflowStepSessions(this._persistDir, workflowRunId)
      .filter((session) => ["done", "error", "interrupted"].includes(session.status))
      .map((session) => ({
        step: session.stepLabel ?? session.agent,
        sessionId: session.sessionId,
        summary: `${session.status}: ${(session.outcome ?? "").slice(0, 300)}`,
      }));
  }

  private cleanupStaleWorkflowRuns(protectedSessionIds: ReadonlySet<string> = new Set()): void {
    // Workflows run in-process; any run started before this manager instance has
    // already exited unless an ancestor session is still protected in the same DB.
    const isProtected = (start: ReturnType<typeof getWorkflowRun>): boolean => {
      if (protectedSessionIds.size === 0) return false;
      const seen = new Set<string>();
      let cur = start;
      while (cur && !seen.has(cur.runId)) {
        seen.add(cur.runId);
        if (cur.parentSessionId && protectedSessionIds.has(cur.parentSessionId)) return true;
        cur = cur.parentWorkflowRunId ? getWorkflowRun(this._persistDir, cur.parentWorkflowRunId) : null;
      }
      return false;
    };
    for (const runId of listRunningWorkflowRunIdsBefore(this._persistDir, this._createdAt)) {
      const run = getWorkflowRun(this._persistDir, runId);
      if (run?.status === "running" && run.startedAt < this._createdAt && !isProtected(run)) {
        updateWorkflowRun(this._persistDir, runId, {
          status: "interrupted",
          result_reason: "Process restarted",
        });
      }
    }
  }

  private sessionInfoFromMeta(sessionId: string, meta: any): SessionInfo {
    return {
      sessionId,
      agent: meta.agent,
      task: meta.task,
      status: meta.status,
      startedAt: meta.startedAt,
      endedAt: meta.endedAt,
      runtime: formatDuration(Date.now() - meta.startedAt),
      outputDir: sessionOutputDir(this._persistDir, sessionId),
      error: meta.error,
      parentSessionId: meta.parentSessionId,
      workflowRunId: meta.workflowRunId,
      stepLabel: meta.stepLabel,
      kind: meta.kind,
      autoClose: meta.autoClose,
    };
  }

  private resultFromStoredSession(sessionId: string): TaskResult {
    const persisted = this._registry.getSession(sessionId);
    if (!persisted) throw new Error(`Session "${sessionId}" not found`);
    if (persisted.status === "idle") throw new Error(`Session "${sessionId}" is historical idle and has no terminal result`);
    if (persisted.status === "running") {
      throw new Error(`Session "${sessionId}" is still running (stale registry entry)`);
    }
    const messages = readSessionMessagesTail(
      this._persistDir,
      sessionId,
      MAX_RESULT_MESSAGES,
      MAX_TRANSCRIPT_TAIL_BYTES,
    ).filter((message) => message.role !== "system");
    const finishResult = extractFinishParams(messages as any[]);
    return {
      sessionId,
      status: persisted.status === "interrupted" ? "interrupted" : (persisted.status as "done" | "error"),
      lastAssistantText: finishResult?.summary ?? extractLastAssistantText(messages),
      messages,
      duration: formatDuration((persisted.endedAt ?? Date.now()) - persisted.startedAt),
      outputDir: sessionOutputDir(this._persistDir, sessionId),
      error: persisted.error,
      finishResult: finishResult as any,
      structuredResult: finishResult?.output,
    };
  }

  private hydrateCompletedResult(result: TaskResult): TaskResult {
    return {
      ...result,
      messages: readSessionMessagesTail(
        this._persistDir,
        result.sessionId,
        MAX_RESULT_MESSAGES,
        MAX_TRANSCRIPT_TAIL_BYTES,
      ).filter((message) => message.role !== "system"),
    };
  }

  // ── Private ──

  private startManagedExecution(session: ActiveSession): void {
    const promise = this.executeSession(session).then(
      (result) => {
        this._sessions.delete(session.sessionId);
        this.rememberCompletedResult(result);
        this.results.delete(session.sessionId);
        return result;
      },
      (error) => {
        session.usage?.finish("error");
        this._sessions.delete(session.sessionId);
        markSessionInactive(this._persistDir, session.sessionId);
        this.results.delete(session.sessionId);
        throw error;
      },
    );
    const parent = session.parentSessionId ? this._sessions.get(session.parentSessionId) : undefined;
    const siblings = parent?.scopedChildren;
    if (siblings) {
      siblings.add(promise);
      promise.then(
        () => siblings.delete(promise),
        () => {
          if (session.executionCleanupConfirmed) siblings.delete(promise);
        },
      );
    }
    this.results.set(session.sessionId, promise);
    // Managed executions usually gain a waiter immediately, but task owners
    // are allowed to observe them later. Attach a rejection observer now so a
    // required terminal persistence failure (for example SQLITE_FULL while
    // writing session.end) remains available through waitFor() without also
    // becoming a process-wide unhandled rejection.
    promise.catch(() => undefined);
  }

  private async withExecutionScope<T>(session: ActiveSession, work: () => Promise<T>): Promise<T> {
    const scope = new ExecutionScope(
      session.admittedTimeoutMs,
      session.parentSignal,
      session.parentDeadlineAt,
      (reason) => {
        session.status = "interrupted";
        session.lastError = reason.message;
        session.interruptionKind = scope.timedOut ? "execution-timeout" : "cancelled";
        session.agent.cancel();
      },
    );
    session.executionScope = scope;
    session.executionCleanupConfirmed = false;
    session.scopedChildren = new Set();
    let unsubscribe = () => {};
    try {
      unsubscribe = observeTaskFeedback(session.taskContext, (message, trace) =>
        this.steerTaskFeedback(session, message, trace),
      );
      return await work();
    } finally {
      unsubscribe();
      await this.closeExecutionScope(session, scope);
    }
  }

  private async closeExecutionScope(session: ActiveSession, scope = session.executionScope): Promise<void> {
    scope?.close();
    // Joining is necessary: an accepted cancellation is not completed cleanup.
    const children = [...this._sessions.values()].filter((child) => child.parentSessionId === session.sessionId);
    const results = await Promise.allSettled([
      ...(session.scopedChildren ?? []),
      ...children.map((child) => this.waitFor(child.sessionId)),
    ]);
    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
    if (!(await drainSessionBashProcessGroups(this._persistDir, session.sessionId)))
      throw new Error(`Managed execution cleanup is unconfirmed for ${session.sessionId}`);
    session.executionCleanupConfirmed = true;
  }

  private async executeSession(session: ActiveSession): Promise<TaskResult> {
    const { agent, sessionId, agentName, task, startedAt } = session;
    let errorText: string | undefined;

    const currentSendMessages = (): AgentMessage[] => {
      const all = agent.state.messages as AgentMessage[];
      return session.restoredMessages?.size
        ? all.filter((message) => !session.restoredMessages!.has(message))
        : all;
    };

    try {
      await this.withExecutionScope(session, async () => {
        let recoveredThrownFailure = false;
        try {
          await agent.prompt(session.promptTask ?? task);
          await agent.waitForIdle();
        } catch (initialCause) {
          if (session.status === "interrupted") throw initialCause;
          const initialError = initialCause instanceof Error ? initialCause.message : String(initialCause);
          const messages = agent.state.messages as AgentMessage[];
          const sendMessages = currentSendMessages();
          const beforeSendLen = sendMessages.length;
          const captured = session.requireFinish
            ? await recoverCapturedWorkflowFinish({
                sessionId,
                messages: sendMessages,
                tools: session.tools ?? [],
                reason: initialError,
              })
            : { disposition: "ineligible" as const };
          for (const message of sendMessages.slice(beforeSendLen)) {
            if (sendMessages !== messages) messages.push(message);
            appendSessionMessage(this._persistDir, sessionId, message);
          }
          if (captured.disposition === "recovered" || captured.disposition === "already-committed") {
            recoveredThrownFailure = true;
          } else if (
            session.requireFinish &&
            !extractFinishParams(currentSendMessages() as any[]) &&
            shouldAttemptWorkflowFinishRecovery(initialError)
          ) {
            recoveredThrownFailure = true;
            try {
              await agent.prompt(workflowFinishRecoveryPrompt(session.outputSchema, captured.error ?? initialError));
              await agent.waitForIdle();
            } catch (recoveryCause) {
              const recoveryError = recoveryCause instanceof Error ? recoveryCause.message : String(recoveryCause);
              throw new Error(
                `Initial workflow prompt failed: ${initialError}; bounded finish recovery failed: ${recoveryError}`,
                { cause: recoveryCause },
              );
            }
          } else {
            throw initialCause;
          }
        }
        if (session.status === "interrupted") throw new Error("Session interrupted");
        if (session.requireFinish && !recoveredThrownFailure) {
          const sendMessages = currentSendMessages();
          const missingFinish = !extractFinishParams(sendMessages as any[]);
          const terminalError =
            extractLastAssistantError(sendMessages) ?? classifyTerminalAssistantFailure(sendMessages);
          if (missingFinish && shouldAttemptWorkflowFinishRecovery(terminalError)) {
            if (isRetryableEmptyAssistantFailure(terminalError) && sendMessages.length > 0) {
              this.trimAndPersistTerminalEmptyAssistant(session);
            }
            await agent.prompt(workflowFinishRecoveryPrompt(session.outputSchema, terminalError));
            await agent.waitForIdle();
          } else if (missingFinish && !terminalError) {
            await agent.prompt(
              "This invocation has not returned its structured output. Call finish() now with all required fields" +
                (session.outputSchema ? ", including the schema-validated output payload." : "."),
            );
            await agent.waitForIdle();
          }
        }
      });
    } catch (err) {
      if (!session.executionCleanupConfirmed) throw err;
      errorText =
        session.status === "interrupted" && session.lastError
          ? session.lastError
          : err instanceof Error
            ? err.message
            : String(err);
      log("error", `[runtime] ${sessionId} failed: ${err}`);
    } finally {
      try {
        unlinkSync(join(sessionDir(this._persistDir, sessionId), "[STARTED]"));
      } catch {}
    }

    // Extract result from this send's messages while retaining full conversation history
    const messages = agent.state.messages as AgentMessage[];
    const sendMessages = currentSendMessages();
    const finishParams = extractFinishParams(sendMessages as any[]);
    // A committed finish survives cancellation while the turn unwinds. Clear
    // that interruption before validation so a missing required payload stays
    // an execution error. Without a receipt, retain the interruption reason.
    if (finishParams && session.status === "interrupted") {
      errorText = undefined;
    } else if (!finishParams && session.status === "interrupted" && session.lastError) {
      errorText = session.lastError;
    }
    const assistantText = extractLastAssistantText(sendMessages);
    const assistantError = !finishParams ? extractLastAssistantError(sendMessages) : undefined;
    const terminalAssistantFailure = !finishParams ? classifyTerminalAssistantFailure(sendMessages) : undefined;
    if (!errorText && assistantError) {
      errorText = assistantError;
    }
    if (!errorText && terminalAssistantFailure) {
      errorText = terminalAssistantFailure;
    }
    if (!errorText && session.requireFinish && !finishParams) {
      errorText = "Workflow agent step ended without calling finish() after one corrective prompt";
    }
    if (!errorText && session.outputSchema && finishParams?.status === "done" && finishParams.output === undefined) {
      errorText = "Workflow agent step completed without the required schema-backed finish().output payload";
    }
    if (!errorText && !finishParams && !assistantText) {
      errorText = "Agent ended without producing a response";
    }
    const status: "done" | "error" | "interrupted" =
      finishParams && errorText
        ? "error"
        : finishParams
          ? "done"
          : session.status === "interrupted"
            ? "interrupted"
            : errorText
              ? "error"
              : // finish(blocked) is a deliberate terminal report, not a runtime interruption.
                "done";
    const lastText = finishParams?.summary ?? assistantText ?? "";
    const durationMs = Date.now() - startedAt;
    session.usage?.finish(status);
    this._registry.updateSessionStatus(sessionId, status, errorText);
    updateSessionDb(this._persistDir, sessionId, {
      status,
      endedAt: Date.now(),
      error: errorText,
      outcome: lastText,
      opCount: session.toolCalls,
      lastActivityAt: Date.now(),
    });

    this.persistSessionResult(session, { status, summary: lastText, error: errorText, finishParams });

    // Emit session.end after the result and its SQL descriptor are persisted.
    if (this.bus) {
      const trace = session.trace;
      this.bus.emit({
        type: "session.end",
        source: session.source ?? "runtime",
        owner: normalizeEventOwner(agentName),
        timestamp: Date.now(),
        data: {
          sessionId,
          agent: agentName,
          agentRelativeDir: session.definition.agentRelativeDir,
          outcome: status,
          summary: lastText,
          error: errorText,
          interruptionKind: session.interruptionKind,
          durationMs,
          status,
          task,
          finishParams: finishParams as any,
          opCount: session.toolCalls,
          turnCount: session.modelStepCount,
          parentSessionId: session.parentSessionId,
          workflowRunId: session.workflowRunId,
          projectId: session.projectId,
          kind: session.kind,
          requestId: session.requestId,
          stepLabel: session.stepLabel,
        },
        ...(trace ? { trace } : {}),
      } as any);
    }

    markSessionInactive(this._persistDir, sessionId);

    return {
      sessionId,
      status,
      lastAssistantText: lastText,
      messages: messages.filter((message) => message.role !== "system"),
      duration: formatDuration(durationMs),
      outputDir: sessionOutputDir(this._persistDir, sessionId),
      error: errorText,
      errorMessage: assistantError,
      finishResult: finishParams as any,
      structuredResult: finishParams?.output,
    };
  }

  private assertSessionContinuation(session: ActiveSession): void {
    if (!session.taskBinding) return;
    if (session.status !== "running") throw new Error("Task continuation requires a running managed execution");
    const store = AppTaskResourceStore.activeFromDb(getDb(this._persistDir), session.taskBinding.appId);
    if (!store) throw new Error("Task execution requires canonical authority");
    assertCurrentTaskActor({ resourceStore: store }, session.taskBinding, "continuation");
  }

  private trimAndPersistTerminalEmptyAssistant(session: ActiveSession): boolean {
    const messages = session.agent.state.messages as AgentMessage[];
    const trimmed = trimTerminalEmptyAssistantTurn(messages);
    if (!trimmed) return false;
    session.agent.state.messages = messages as any;
    try {
      rewriteSessionMessages(this._persistDir, session.sessionId, messages);
      saveCompactedMessages(this._persistDir, session.sessionId, messages);
    } catch (err) {
      log(
        "warn",
        `[runtime] Failed to persist trimmed transcript for ${session.sessionId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return true;
  }

  private emitSkillLoaded(
    session: ActiveSession,
    skill: MaySkill,
    activation: "explicit" | "model",
    trace?: EventTrace,
  ): void {
    this.bus?.emit({
      [EVENT_RECORD_ONLY]: true,
      type: "skill.loaded",
      source: `agent:${session.agentName}`,
      owner: normalizeEventOwner(session.agentName),
      data: {
        name: skill.name,
        agent: session.agentName,
        sessionId: session.sessionId,
        activation,
        scope: skill.scope,
        filePath: skill.filePath,
        contentHash: skill.contentHash,
      },
      ...((trace ?? session.trace) ? { trace: trace ?? session.trace } : {}),
    });
  }

  /** Required evidence precedes publication; failures retain the earlier terminal status. */
  private persistSessionResult(
    session: ActiveSession,
    result: {
      status: "done" | "error" | "interrupted";
      summary: string;
      error?: string;
      finishParams: ReturnType<typeof extractFinishParams>;
    },
  ): void {
    const endedAt = Date.now();
    const resultArtifact = writeSessionResult(this._persistDir, session.sessionId, {
      status: result.status,
      outcome: result.status,
      error: result.error,
      summary: result.summary,
      opCount: session.toolCalls,
      turnCount: session.modelStepCount,
      finishParams: result.finishParams,
      endedAt,
    });
    updateSessionDb(this._persistDir, session.sessionId, {
      status: result.status,
      error: result.error,
      outcome: result.status,
      opCount: session.toolCalls,
      lastActivityAt: endedAt,
      endedAt,
      resultArtifact,
    });
  }

  private bridgeEvents(session: ActiveSession): void {
    const { agent, sessionId, agentName, task } = session;
    const bus = this.bus;
    const pendingSkillReads = new Map<string, MaySkill>();
    const persistProgress = (): void => {
      try {
        updateSessionProgress(this._persistDir, sessionId, {
          opCount: session.toolCalls,
          lastActivityAt: Date.now(),
        });
      } catch {
        // A later progress event retries durable liveness; do not interrupt the agent loop.
      }
    };

    const startEvent = {
      type: "session.start",
      source: session.source ?? "runtime",
      owner: normalizeEventOwner(agentName),
      timestamp: session.startedAt,
      data: {
        sessionId,
        agent: agentName,
        task,
        source: session.source,
        trigger: session.kind ?? "runtime",
        firedAt: session.startedAt,
        parentSessionId: session.parentSessionId,
        workflowRunId: session.workflowRunId,
        projectId: session.projectId,
        kind: session.kind,
        requestId: session.requestId,
        conversationId: session.conversationId,
        channelMessageId: session.channelMessageId,
        taskBinding: session.taskBinding,
        stepLabel: session.stepLabel,
      },
      ...(session.trace ? { trace: session.trace } : {}),
    } as any;
    const persistedStartEvent = bus?.emit(startEvent);
    const startEventId = persistedStartEvent?.[EVENT_ROW_ID];
    if (persistedStartEvent && Number.isInteger(startEventId) && Number(startEventId) > 0) {
      session.trace = {
        traceId: persistedStartEvent.trace?.traceId ?? `event:${startEventId}`,
        parentEventId: startEventId,
      };
    }

    // Execution bookkeeping also owns result counts when publication is disabled.
    agent.subscribe((event) => {
      switch (event.type) {
        case "tool_execution_update":
          persistProgress();
          break;
        case "turn_start":
          session.modelStepCount++;
          persistProgress();
          break;
        case "tool_execution_start":
          session.toolCalls++;
          persistProgress();
          bus?.emit({
            type: "tool_call",
            sessionId,
            agent: agentName,
            tool: (event as any).toolName,
            args: (event as any).args,
          });
          if ((event as any).toolName === "read") {
            const args = (event as any).args as { path?: unknown; offset?: unknown; limit?: unknown } | undefined;
            const path = typeof args?.path === "string" ? args.path : "";
            const def = session.definition;
            if (path && def.skillCatalog && args?.offset === undefined && args?.limit === undefined) {
              try {
                const canonicalPath = realpathSync(resolve(def.projectRoot ?? process.cwd(), path));
                const skill = [...def.skillCatalog.skills.values()].find(
                  (candidate) => candidate.canonicalPath === canonicalPath,
                );
                if (skill && statSync(canonicalPath).size <= 50_000 && skill.content.split("\n").length <= 2_000) {
                  pendingSkillReads.set((event as any).toolCallId, skill);
                }
              } catch {
                // The read tool reports path failures; no activation facts are emitted.
              }
            }
          }
          break;
        case "tool_execution_end": {
          persistProgress();
          const blocks = (event as any).result?.content ?? [];
          const text = blocks.find((b: any) => b?.type === "text" && !b.text?.startsWith("<tool_output"))?.text ?? "";
          bus?.emit({
            type: "tool_result",
            sessionId,
            agent: agentName,
            tool: (event as any).toolName,
            preview: text.slice(0, 200),
            isError: !!(event as any).isError,
          });
          const loadedSkill = pendingSkillReads.get((event as any).toolCallId);
          pendingSkillReads.delete((event as any).toolCallId);
          if (loadedSkill && !(event as any).isError && !session.loadedSkillHashes.has(loadedSkill.contentHash)) {
            session.loadedSkillHashes.add(loadedSkill.contentHash);
            this.emitSkillLoaded(session, loadedSkill, "model", session.trace);
          }
          break;
        }
        case "message_end": {
          persistProgress();
          const message = (event as any).message;
          if (message?.role !== "assistant" || !Array.isArray(message.content)) break;
          const text = message.content
            .filter((block: any) => block?.type === "text" && typeof block.text === "string" && block.text.trim())
            .map((block: any) => block.text)
            .join("\n")
            .trim();
          if (text) bus?.emit({ type: "text", sessionId, agent: agentName, text });
          break;
        }
        case "turn_end":
          persistProgress();
          bus?.emit({ type: "turn_end", sessionId, agent: agentName, toolCalls: session.toolCalls, durationMs: 0 });
          break;
      }
    });
  }
}
