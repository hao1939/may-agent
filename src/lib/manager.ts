import { readFileSync, readdirSync, mkdirSync, existsSync, writeFileSync, appendFileSync, unlinkSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentMessage, AgentEvent, AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type, StringEnum } from "@mariozechner/pi-ai";
import {
  generateId,
  formatDuration,
  extractLastAssistantText,
  formatMemoryTimestamp,
  isProcessAlive,
  truncateForPrompt,
  isToolError,
  computeToolArgsKey,
  MEMORY_TASK_MAX,
  MEMORY_SUMMARY_MAX,
  STATE_CHANGING_TOOLS,
  INFRA_RETRY_MAX,
  INFRA_RETRY_BASE_DELAY_MS,
  TOOL_PIVOT_LIMIT,
  TURN_BUDGET_WARNING_DEFAULT,
} from "./manager-utils.js";
import type { RegisteredAgent, ActiveSession, RunOptions, SubagentManagerOptions } from "./manager-utils.js";

// Re-export everything from manager-utils so existing import paths don't break
export {
  generateId,
  truncateForPrompt,
  isToolError,
  computeToolArgsKey,
  STATE_CHANGING_TOOLS,
  INFRA_RETRY_MAX,
  TOOL_PIVOT_LIMIT,
  TURN_BUDGET_WARNING_DEFAULT,
} from "./manager-utils.js";
export type { RegisteredAgent, ActiveSession, RunOptions, SubagentManagerOptions } from "./manager-utils.js";
import type {
  SubagentDefinition,
  SessionInfo,
  TaskResult,
  SessionTreeNode,
  ManagerHealthReport,
  AuditHealthOptions,
  AuditHealthReport,
  ReconcileReport,
} from "./types.js";
import { createCompactionTransform } from "./compaction.js";
import type { CompactionOptions } from "./compaction.js";
import {
  RegistryStore,
  sessionDir,
  ensureSessionDir,
  appendSessionMessage,
  readSessionMessages,
  readArchivedSessionMessages,
  sessionOutputDir,
  appendMemoryEntry,
  readMemoryEntries,
  memoryPath,
  archiveSession,
  restoreSessionFromArchive,
  historyDir,
  readWorkflowRun,
  listWorkflowRuns,
  saveWorkflowRun,
  saveCompactedMessages,
  readCompactedMessages,
} from "./persistence.js";
import type { MemoryEntry, WorkflowRun, PersistedSession, Registry, SessionKind } from "./persistence.js";
import type { SessionTrace } from "./workflow.js";
import { join, dirname, relative, resolve } from "node:path";
import { isOverflowError, extractProgress, writeProgressFile } from "./overflow.js";
import { spawnDetachedAgent, readIdentity } from "./detached.js";
import { sendSocketCommand } from "./socket-client.js";
import { runActiveRecall, formatRecallWarnings } from "./active-recall.js";
import { buildTrace } from "./manager-trace.js";
import { isRetryableInfraError, runAgentWithRetry } from "./manager-retry.js";
import { createAgentsTool as createAgentsToolFn, type CreateAgentsToolOptions } from "./manager-agents-tool.js";
export { isRetryableInfraError, runAgentWithRetry } from "./manager-retry.js";
export { buildTrace, findPathToTarget } from "./manager-trace.js";
export type { TraceContext } from "./manager-trace.js";
import { computeHealth, computeAuditHealth, computeReconcileHealth, EVAL_SKIP_AGENTS } from "./manager-health.js";
export { EVAL_SKIP_AGENTS } from "./manager-health.js";
export type { HealthContext } from "./manager-health.js";
import {
  signToolOutput,
  verifyToolOutput,
  createVerifyReceiptTool,
  wrapToolsWithReceipts,
  getOpUsage,
} from "./manager-receipts.js";
export {
  signToolOutput,
  verifyToolOutput,
  createVerifyReceiptTool,
  wrapToolsWithReceipts,
  getOpUsage,
} from "./manager-receipts.js";
export type { ReceiptWrapContext } from "./manager-receipts.js";

/**
 * P93 Infrastructure Resilience — Automatic Retry for Transient Errors
 *
 * The SubagentManager implements an automatic retry loop (see `runAgentWithRetry`)
 * that detects and recovers from transient infrastructure errors during agent execution.
 *
 * ## Errors That Trigger Retries
 *
 *   1. **Empty response** — The LLM stream completes with `stopReason="stop"` but the
 *      assistant message contains no text and no tool calls (0 output tokens). This
 *      typically indicates a model/API/proxy issue (e.g., LiteLLM dropping the response).
 *
 *   2. **Silent stream error** — The agent loop finishes without error, but the last
 *      message is still a `user` message (no assistant reply was produced at all).
 *      This happens when the stream function throws before yielding any events.
 *
 *   3. **ToolUse mismatch** — The response has `stopReason="toolUse"` but the assistant
 *      message contains no `toolCall` content blocks (malformed model output).
 *
 * ## Errors That Are NOT Retried
 *
 *   - Aborted sessions (user/system cancellation)
 *   - Context overflow errors (retrying won't reduce context size)
 *   - Closed sessions
 *   - Non-running sessions
 *
 * ## Max Retry Count
 *
 *   Default: `INFRA_RETRY_MAX` (3). Configurable per-manager via
 *   `SubagentManagerOptions.infraRetryMax`. Set to 0 to disable retries (useful in tests).
 *
 * ## Backoff Strategy
 *
 *   Linear backoff: `attempt * INFRA_RETRY_BASE_DELAY_MS` (1s base).
 *     - Retry 1: 1s delay
 *     - Retry 2: 2s delay
 *     - Retry 3: 3s delay
 *
 *   Before each retry, the malformed assistant message (if any) is removed from the
 *   message history and the agent's error state is cleared. The retry is issued via
 *   `agent.continue()`.
 *
 * ## Detection
 *
 *   See `isRetryableInfraError()` for the full detection logic.
 *   See `runAgentWithRetry()` for the retry loop implementation.
 */



export class SubagentManager {
  private agents = new Map<string, RegisteredAgent>();
  private activeSessions = new Map<string, ActiveSession>();
  /** Stores the result promise for every session started by this manager.
   *  Survives session removal from activeSessions so waitFor() works
   *  even if the session completes before waitFor() is called.
   */
  private sessionResults = new Map<string, Promise<TaskResult>>();
  private registry: RegistryStore;
  private onSessionComplete?: (info: SessionInfo) => void;
  private onSessionStart?: (agentName: string, sessionId: string) => void;
  private startedAt = Date.now();
  private _projectRoot: string;
  /** Maximum call depth for callAgent chains. Prevents A→B→A infinite loops. */
  private _maxCallDepth: number;
  /** Maximum infrastructure retries per session turn. */
  private _infraRetryMax: number;
  /** Current call depth per root session (tracks nested callAgent chains). */
  private callDepths = new Map<string, number>();

  /** Project root directory. Used for detached agent spawning. */
  get projectRoot(): string {
    return this._projectRoot;
  }

  constructor(opts: SubagentManagerOptions) {
    this.registry = new RegistryStore(opts.persistDir);
    this._projectRoot = opts.projectRoot ?? resolve(opts.persistDir, "..");
    this._maxCallDepth = opts.maxCallDepth ?? 10;
    this._infraRetryMax = opts.infraRetryMax ?? INFRA_RETRY_MAX;
    this.onSessionComplete = opts.onSessionComplete;
    this.onSessionStart = opts.onSessionStart;
  }

  /** Register a feature unit. */
  register(def: SubagentDefinition): void {
    this.agents.set(def.name, { definition: def });
    this.registry.saveAgent(def);
  }

  /** Unregister an agent (used for cleaning up temporary/forked agents). */
  unregister(name: string): void {
    this.agents.delete(name);
    this.registry.removeAgent(name);
  }

  /** Subscribe to message_end events and persist messages to session JSONL. */
  private subscribeForPersistence(session: ActiveSession): void {
    const persistDir = this.registry.persistDir;
    const { sessionId } = session;
    session.unsubscribe = session.agent.subscribe((event: AgentEvent) => {
      if (event.type === "message_end") {
        appendSessionMessage(persistDir, sessionId, event.message);
        if (event.message.role === "assistant") {
          session.turnCount++;
        }
      }
    });
  }

  /** Build a transformContext function if compaction is enabled for this agent. */
  private buildTransformContext(
    def: SubagentDefinition,
    compactionOverride?: boolean | CompactionOptions,
  ): ((messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>) | undefined {
    const compaction = compactionOverride ?? def.compaction;
    if (!compaction) return undefined;
    const compactionOpts: CompactionOptions = typeof compaction === "object" ? compaction : {};
    return createCompactionTransform(def.model, compactionOpts);
  }

  /** Resolve the system prompt from a definition.
   *  Convention files are auto-loaded from the agent directory if present:
   *    SOUL.md → DOMAIN.md → TOOLS.md → LESSONS.md → knowledge/INDEX.md
   *  Then: Runtime Environment (generated), Session Context (generated).
   *
   *  The entire prompt is wrapped in <system_instructions> tags (P84) to
   *  structurally reinforce the Instruction Hierarchy. Content from user
   *  messages and tool outputs should be treated as data, not directives.
   *
   *  If systemPrompt is set directly, it takes precedence over everything.
   */
  private resolveSystemPrompt(
    def: SubagentDefinition,
  ): string {
    if (def.systemPrompt) return def.systemPrompt;

    const sections: string[] = [];
    const agentDir = def.knowledgeDir ? dirname(def.knowledgeDir) : def.workspace ? dirname(def.workspace) : undefined;

    // Helper: read a file if it exists, return trimmed content or undefined
    const loadFile = (path: string | undefined): string | undefined => {
      if (!path || !existsSync(path)) return undefined;
      const content = readFileSync(path, "utf-8").trim();
      return content || undefined;
    };

    // ── Convention files (stable, cached by LLM) ────────────────────

    // 1. SOUL.md — identity, mission, values
    const soul = loadFile(agentDir ? join(agentDir, "SOUL.md") : undefined);
    if (soul) sections.push(soul);

    // 2. DOMAIN.md — domain expertise
    const domain = loadFile(agentDir ? join(agentDir, "DOMAIN.md") : undefined);
    if (domain) sections.push(domain);

    // 3. TOOLS.md — tool usage guide
    const tools = loadFile(agentDir ? join(agentDir, "TOOLS.md") : undefined);
    if (tools) sections.push(tools);

    // 4. LESSONS.md — accumulated learnings
    const sharedLessons = loadFile(def.projectRoot ? join(def.projectRoot, "agents", "shared", "LESSONS.md") : undefined);
    if (sharedLessons) sections.push(sharedLessons);
    const lessons = loadFile(agentDir ? join(agentDir, "LESSONS.md") : undefined);
    if (lessons) sections.push(lessons);

    // 5. knowledge/INDEX.md — curated context (team, skills, references)
    const index = loadFile(def.knowledgeDir ? join(def.knowledgeDir, "INDEX.md") : undefined);
    if (index) sections.push(index);

    // ── Generated sections (volatile) ───────────────────────────────

    // 6. Runtime Environment — paths and workspace
    {
      const relPath = def.projectRoot ? (abs: string) => relative(def.projectRoot!, abs) || "." : (abs: string) => abs;
      const envLines = [`# Runtime Environment`];
      if (def.projectRoot) {
        envLines.push(`- Project root: ${def.projectRoot}`);
      }
      if (agentDir) {
        envLines.push(`- Agent directory: ${relPath(agentDir)}`);
      }
      if (def.workspace) {
        envLines.push(`- Workspace: ${relPath(def.workspace)} (ephemeral scratch)`);
      }
      if (def.knowledgeDir) {
        envLines.push(`- Knowledge: ${relPath(def.knowledgeDir)}`);
      }
      // List which convention files are already in this prompt
      const loaded: string[] = [];
      if (agentDir) {
        for (const name of ["SOUL.md", "DOMAIN.md", "TOOLS.md", "LESSONS.md"]) {
          if (existsSync(join(agentDir, name))) loaded.push(name);
        }
      }
      if (index) loaded.push("knowledge/INDEX.md");
      if (loaded.length > 0) {
        envLines.push(`- Already in context (do NOT re-read): ${loaded.join(", ")}`);
      }
      envLines.push(
        ``,
        `All paths are relative to project root. Your workspace is the ONLY directory you should write to.`,
      );
      sections.push(envLines.join("\n"));
    }

    // 7. Session Context is now delivered via the first user message
    //    (see buildSessionContext) to keep the system prompt stable for
    //    Anthropic prompt caching.  The system prompt must be identical
    //    across sessions so the cache_control: ephemeral marker on the
    //    system block produces cache *reads* instead of only cache writes.

    // ── P84: Wrap in <system_instructions> tags ─────────────────────
    // Structural reinforcement of the Instruction Hierarchy. The XML tags
    // signal to the LLM that everything inside is authoritative system-level
    // configuration, taking precedence over user messages and tool outputs.
    const body = sections.join("\n\n");
    return `<system_instructions>\n${body}\n</system_instructions>`;
  }

  /**
   * Build the per-session context block (session ID + recent task history).
   * This is prepended to the first user message instead of living in the
   * system prompt, so that the system prompt stays identical across sessions
   * and Anthropic prompt caching can produce cache reads.
   */
  private buildSessionContext(
    def: SubagentDefinition,
    agentName: string,
    sessionId: string,
    persistDir: string,
  ): string {
    const ctxLines = [`# Session Context`, `- Session ID: ${sessionId}`];
    const memoryLimit = def.memoryLimit ?? 20;
    if (memoryLimit > 0) {
      const entries = readMemoryEntries(persistDir, agentName, memoryLimit);
      if (entries.length > 0) {
        ctxLines.push(``, `## Recent Task History`);
        for (const e of entries) {
          const ts = formatMemoryTimestamp(e.timestamp);
          const taskText = truncateForPrompt(e.task, MEMORY_TASK_MAX);
          const summary = e.summary ? ` — ${truncateForPrompt(e.summary, MEMORY_SUMMARY_MAX)}` : "";
          ctxLines.push(`- ${ts}: "${taskText}" — ${e.status} (${e.duration})${summary}`);
        }
      }
    }

    // P110 Active Recall: check failure history and inject warnings
    const recall = runActiveRecall(agentName, this._projectRoot);
    const recallBlock = formatRecallWarnings(recall);
    if (recallBlock) {
      ctxLines.push(``, recallBlock);
    }

    return ctxLines.join("\n");
  }

  /** Append a memory entry after session completion. */
  private appendMemory(session: ActiveSession): void {
    const messages = session.agent.state.messages;
    const endTime = session.endedAt ?? Date.now();
    const entry: MemoryEntry = {
      task: session.task,
      status: session.archiveStatus ?? session.status,
      duration: formatDuration(endTime - session.startedAt),
      summary: extractLastAssistantText(messages),
      timestamp: endTime,
    };
    appendMemoryEntry(this.registry.persistDir, session.agentName, entry);
  }

  /** Archive a session after completion: move to history. */
  private archiveSessionDir(session: ActiveSession): void {
    try {
      archiveSession(this.registry.persistDir, session.sessionId);
    } catch {
      // Session dir may not exist (e.g. no persistDir or already archived)
    }
  }

  /** Set up a timeout timer for a session if timeoutMs is configured. */
  private setupTimeout(session: ActiveSession, timeoutMs: number | undefined): void {
    if (!timeoutMs || timeoutMs <= 0) return;
    session.timeoutTimer = setTimeout(() => {
      if (session.status === "running") {
        this.cancel(session.sessionId);
      }
    }, timeoutMs);
  }

  /** Clear any active timeout timer for a session. */
  private clearTimeout(session: ActiveSession): void {
    if (session.timeoutTimer) {
      clearTimeout(session.timeoutTimer);
      session.timeoutTimer = undefined;
    }
  }

  /**
   * Common completion handler — called when the agent's prompt()/continue() settles.
   *
   * Determines the outcome from agent state, then:
   *   - Task sessions → terminal status (done/error/interrupted) → archive + remove
   *
   * See docs/session-state-machine.md for the full state machine.
   */
  private handleCompletion(session: ActiveSession): void {
    this.clearTimeout(session);

    // Guard: if close() already archived this session, skip.
    if (session.closed) return;

    // ── Detect silent stream errors ────────────────────────────────────
    // When the LLM stream function throws before yielding any events
    // (e.g., missing API key, connection refused), the agent-core error
    // path (terminateStreamOnError) emits agent_end but NOT turn_end,
    // so agent.state.error is never set. Detect this by checking if
    // the last message is still a user message (no assistant reply).
    const messages = session.agent.state.messages;
    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
    if (!session.agent.state.error && !session.error && lastMsg?.role === "user") {
      session.error = "Agent completed without producing a response (possible stream/API error)";
      session.agent.state.error = session.error;
    }

    // ── Detect empty assistant response ──────────────────────────────
    // Some models (especially via LiteLLM proxies) return stopReason="stop"
    // with empty content and 0 output tokens — effectively a silent no-op.
    // The agent finishes without error but produces no useful output.
    if (!session.agent.state.error && !session.error && lastMsg?.role === "assistant") {
      const content = Array.isArray(lastMsg.content) ? lastMsg.content : [];
      const hasSubstance = content.some(
        (block: any) =>
          (block?.type === "text" && block.text?.trim()) ||
          block?.type === "toolCall",
      );
      if (!hasSubstance) {
        session.error = "Model returned an empty response (0 output tokens). This usually indicates a model/API issue — try again or switch models.";
        session.agent.state.error = session.error;
      }
    }

    // ── Determine outcome from agent state ─────────────────────────────
    const agentError = session.agent.state.error ?? session.error;
    const wasAborted = agentError?.includes("aborted") ?? false;

    // Set error field
    if (agentError) {
      session.error = agentError;
    }

    // On context overflow, dump structured progress to workspace (best-effort)
    if (session.error && isOverflowError(session.error)) {
      const registered = this.agents.get(session.agentName);
      const workspace = registered?.definition.workspace;
      if (workspace) {
        try {
          writeProgressFile(workspace, extractProgress(session.task, session.agent.state.messages, session.error));
        } catch {
          /* best-effort */
        }
      }
    }

    // ── Determine archive status, archive, remove ──────────────────────
    if (session.autoClose === "never" && !wasAborted) {
      // Interface session (Chat) — stays alive in "idle" state
      session.status = "idle";
      session.turnCount = 0;

      this.registry.updateSessionStatus(session.sessionId, "idle", session.error);

      // Remove [STARTED] sentinel (session is not running)
      try {
        const sentinelPath = join(sessionDir(this.registry.persistDir, session.sessionId), "[STARTED]");
        if (existsSync(sentinelPath)) unlinkSync(sentinelPath);
      } catch {
        /* best-effort */
      }

      // Do NOT remove from activeSessions
      // Do NOT unsubscribe (we want to catch next turn's events)
      return;
    }

    // ── Detect shallow heartbeats (zero tool calls) ────────────────────
    // Heartbeat sessions MUST read files (heartbeat.md, todo.md, etc.).
    // If an agent completes a heartbeat with zero tool calls, it responded
    // from compacted context without actually checking anything — flag it.
    if (
      !wasAborted &&
      !session.error &&
      session.opCount === 0 &&
      session.task.startsWith("[heartbeat]")
    ) {
      session.error =
        "Shallow heartbeat: completed with zero tool calls. " +
        "Heartbeat sessions MUST use tools (read heartbeat.md, check health, etc.).";
      session.agent.state.error = session.error;
    }

    // Task sessions (or aborted interface sessions) → archive and remove
    const archiveStatus: "done" | "error" | "interrupted" = wasAborted
      ? "interrupted"
      : session.error
        ? "error"
        : "done";
    session.archiveStatus = archiveStatus;
    this.registry.updateSessionStatus(session.sessionId, archiveStatus, session.error);

    session.unsubscribe?.();
    session.endedAt = Date.now();

    // Remove [STARTED] sentinel on clean exit
    try {
      const sentinelPath = join(sessionDir(this.registry.persistDir, session.sessionId), "[STARTED]");
      if (existsSync(sentinelPath)) unlinkSync(sentinelPath);
    } catch {
      /* best-effort */
    }

    this.appendMemory(session);
    this.archiveSessionDir(session);
    this.activeSessions.delete(session.sessionId);

    if (this.onSessionComplete) {
      const info: SessionInfo = {
        sessionId: session.sessionId,
        agent: session.agentName,
        task: session.task,
        status: archiveStatus,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        runtime: formatDuration(session.endedAt - session.startedAt),
        outputDir: session.outputDir,
        error: session.error,
        parentSessionId: session.parentSessionId,
        workflowRunId: session.workflowRunId,
        stepLabel: session.stepLabel,
      };
      try {
        this.onSessionComplete(info);
      } catch {
        /* best-effort */
      }
    }
  }

  run(name: string, task: string, opts?: RunOptions): string {
    const registered = this.agents.get(name);
    if (!registered) throw new Error(`Agent "${name}" not registered`);

    const def = registered.definition;
    const sessionId = opts?.sessionId ?? generateId(def.sessionIdPrefix);
    const persistDir = this.registry.persistDir;

    // Compute output directory
    const outputDir = sessionOutputDir(persistDir, sessionId);

    // Create session directory and output subdirectory for JSONL persistence
    ensureSessionDir(persistDir, sessionId);
    mkdirSync(outputDir, { recursive: true });

    const compactionTransform = this.buildTransformContext(def, opts?.compaction);
    const agent = new Agent({
      initialState: {
        systemPrompt: this.resolveSystemPrompt(def),
        model: def.model,
        tools: wrapToolsWithReceipts(def.tools, sessionId, { activeSessions: this.activeSessions, persistDir: this.registry.persistDir }),
      },
      transformContext: compactionTransform,
      getApiKey: def.apiKey ? () => def.apiKey : undefined,
    });

    const session: ActiveSession = {
      sessionId,
      agentName: name,
      agent,
      promise: null!,
      task,
      startedAt: Date.now(),
      status: "running",
      outputDir,
      parentSessionId: opts?.parentSessionId,
      parentAgentName:
        opts?.parentAgentName ??
        (opts?.parentSessionId ? this.activeSessions.get(opts.parentSessionId)?.agentName : undefined),
      workflowRunId: opts?.workflowRunId,
      stepLabel: opts?.stepLabel,
      turnCount: 0,
      compactionTransform,
      closed: false,
      autoClose: opts?.autoClose ?? "immediate",
      kind: opts?.kind ?? "job",
      opBudget: opts?.opBudget ?? def.opBudget ?? 0,
      opCount: 0,
      infraRetryCount: 0,
      toolErrorHistory: new Map(),
      toolErrorCount: 0,
      turnBudgetWarningAt: def.turnBudgetWarningAt ?? TURN_BUDGET_WARNING_DEFAULT,
      turnBudgetWarned: false,
    };

    // Write [STARTED] sentinel
    try {
      const sentinelPath = join(sessionDir(persistDir, sessionId), "[STARTED]");
      writeFileSync(sentinelPath, new Date().toISOString());
    } catch {
      /* best-effort */
    }

    // Subscribe for JSONL persistence before starting the prompt
    this.subscribeForPersistence(session);

    // Persist the new session to registry — merge with existing meta
    // to preserve detached/pid/instance fields pre-written by the parent
    const existingMeta = this.registry.getSession(sessionId);
    this.registry.saveSession(sessionId, {
      ...(existingMeta ?? {}),
      agent: name,
      task,
      status: "running",
      startedAt: session.startedAt,
      parentSessionId: opts?.parentSessionId ?? existingMeta?.parentSessionId,
      workflowRunId: opts?.workflowRunId ?? existingMeta?.workflowRunId,
      stepLabel: opts?.stepLabel ?? existingMeta?.stepLabel,
      kind: session.kind,
      autoClose: session.autoClose,
    });

    // Set up timeout if configured
    this.setupTimeout(session, def.timeoutMs);

    // Add to activeSessions before notifying listener (subscribe() needs it)
    this.activeSessions.set(sessionId, session);

    // Notify listener that a new session has started
    this.onSessionStart?.(name, sessionId);

    // The initial user message is persisted via the message_end subscriber
    // when agentLoop emits it (before any LLM call). No explicit write here
    // to avoid duplicate JSONL entries.

    // Prepend session context (session ID + task history) to the first user
    // message.  This keeps the system prompt stable across sessions so that
    // Anthropic prompt caching produces cache reads.
    const sessionContext = this.buildSessionContext(def, name, sessionId, persistDir);
    const promptText = `${sessionContext}\n\n---\n\n${task}`;

    session.promise = runAgentWithRetry(session, agent.prompt(promptText), this._infraRetryMax, (s) => this.handleCompletion(s));

    this.sessionResults.set(
      sessionId,
      session.promise.then(() => this.buildResultFromSession(session)),
    );
    return sessionId;
  }

  /** Mark any workflow runs stuck at "running" as "interrupted".
   *  Called during startup (resumeStaleSessions). */
  private cleanupStaleWorkflowRuns(): void {
    const persistDir = this.registry.persistDir;
    const runIds = listWorkflowRuns(persistDir);
    for (const runId of runIds) {
      const run = readWorkflowRun(persistDir, runId);
      if (run && run.status === "running") {
        run.status = "interrupted";
        run.endedAt = Date.now();
        run.result = { reason: "Process restarted" };
        saveWorkflowRun(persistDir, run);
      }
    }
  }

  /**
   * Resume sessions left in "running" or "idle" state from a previous process.
   * Reloads their JSONL, repairs broken message sequences, and continues the agent loop.
   * Sessions whose agent is not registered are marked as "interrupted".
   * Also cleans up stale workflow runs.
   *
   * Detached sessions (separate OS processes) are skipped if their process
   * is still alive — they survive the parent's restart by design.
   */
  resumeStaleSessions(opts?: { abort?: boolean; kinds?: SessionKind[] }): {
    resumed: SessionInfo[];
    interrupted: SessionInfo[];
  } {
    const registryData = this.registry.getRegistry();
    const persistDir = this.registry.persistDir;
    const staleSessionIds: Array<{ sessionId: string; persisted: (typeof registryData.sessions)[string] }> = [];
    const kindFilter = opts?.kinds ? new Set(opts.kinds) : null;

    // Scan for orphan [STARTED] sentinels in session directories
    const sessionsDir = join(persistDir, "sessions");
    if (existsSync(sessionsDir)) {
      try {
        const sessionDirs = readdirSync(sessionsDir);
        for (const dirName of sessionDirs) {
          const sentinelPath = join(sessionsDir, dirName, "[STARTED]");
          if (existsSync(sentinelPath)) {
            const sessionId = dirName;
            const persisted = registryData.sessions[sessionId];
            if (persisted && persisted.status === "running" && !isProcessAlive(persisted.pid)) {
              const kind = persisted.kind ?? "job";
              if (kindFilter && !kindFilter.has(kind)) continue; // not our concern — leave untouched
              try {
                unlinkSync(sentinelPath);
              } catch {}
              staleSessionIds.push({ sessionId, persisted });
            } else if (!persisted) {
              try {
                unlinkSync(sentinelPath);
              } catch {}
            }
          }
        }
      } catch (err) {
        console.warn("[manager] Error scanning for crashed sessions:", err);
      }
    }

    // Collect remaining stale sessions from registry
    const alreadyFound = new Set(staleSessionIds.map((s) => s.sessionId));
    for (const [sessionId, persisted] of Object.entries(registryData.sessions)) {
      if (alreadyFound.has(sessionId)) continue;
      if (persisted.status !== "running" && persisted.status !== "idle") continue;
      if (persisted.detached && isProcessAlive(persisted.pid)) continue;
      const kind = persisted.kind ?? "job";
      if (kindFilter && !kindFilter.has(kind)) continue; // not our concern — leave untouched
      staleSessionIds.push({ sessionId, persisted });
    }

    const resumed: SessionInfo[] = [];
    const interrupted: SessionInfo[] = [];

    for (const { sessionId, persisted } of staleSessionIds) {
      if (opts?.abort) {
        this.registry.updateSessionStatus(sessionId, "interrupted", "Clean start (fresh)");
        interrupted.push({
          sessionId,
          agent: persisted.agent,
          task: persisted.task,
          status: "interrupted",
          startedAt: persisted.startedAt,
          endedAt: Date.now(),
          runtime: formatDuration(Date.now() - persisted.startedAt),
          outputDir: sessionOutputDir(persistDir, sessionId),
          error: "Clean start (fresh)",
        });
        continue;
      }

      const registered = this.agents.get(persisted.agent);
      if (!registered) {
        this.registry.updateSessionStatus(sessionId, "interrupted", "Process restarted (agent not registered)");
        interrupted.push({
          sessionId,
          agent: persisted.agent,
          task: persisted.task,
          status: "interrupted",
          startedAt: persisted.startedAt,
          endedAt: Date.now(),
          runtime: formatDuration(Date.now() - persisted.startedAt),
          outputDir: sessionOutputDir(persistDir, sessionId),
          error: "Process restarted (agent not registered)",
        });
        continue;
      }

      try {
        const info = this.resumeSession(sessionId, persisted, registered);
        resumed.push(info);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        this.registry.updateSessionStatus(sessionId, "interrupted", `Resume failed: ${errMsg}`);
        interrupted.push({
          sessionId,
          agent: persisted.agent,
          task: persisted.task,
          status: "interrupted",
          startedAt: persisted.startedAt,
          endedAt: Date.now(),
          runtime: formatDuration(Date.now() - persisted.startedAt),
          outputDir: sessionOutputDir(persistDir, sessionId),
          error: `Resume failed: ${errMsg}`,
        });
      }
    }

    this.cleanupStaleWorkflowRuns();
    return { resumed, interrupted };
  }

  /**
   * Resume a single stale session from disk.
   * Reloads JSONL, repairs broken messages, injects a restart notice, and continues the agent loop.
   */
  private resumeSession(
    sessionId: string,
    persisted: PersistedSession,
    registered: { definition: SubagentDefinition },
  ): SessionInfo {
    const persistDir = this.registry.persistDir;
    const def = registered.definition;

    ensureSessionDir(persistDir, sessionId);
    restoreSessionFromArchive(persistDir, sessionId);

    const compactedMessages = readCompactedMessages(persistDir, sessionId);
    const savedMessages = compactedMessages ?? readSessionMessages(persistDir, sessionId);
    const systemPrompt = this.resolveSystemPrompt(def);
    const outputDir = sessionOutputDir(persistDir, sessionId);

    const compactionTransform = this.buildTransformContext(def);
    const agent = new Agent({
      initialState: {
        systemPrompt,
        model: def.model,
        tools: wrapToolsWithReceipts(def.tools, sessionId, { activeSessions: this.activeSessions, persistDir: this.registry.persistDir }),
        messages: savedMessages,
      },
      transformContext: compactionTransform,
      getApiKey: def.apiKey ? () => def.apiKey : undefined,
    });

    // Repair broken message sequences (mid-tool-call crash).
    const lastMsg = savedMessages.length > 0 ? savedMessages[savedMessages.length - 1] : null;
    let lastRole = lastMsg?.role;

    if (lastRole === "assistant" && lastMsg && Array.isArray(lastMsg.content)) {
      const toolCalls = (lastMsg.content as Array<{ type: string }>).filter((b) => b?.type === "toolCall");
      if (toolCalls.length > 0) {
        // Inject error tool results for each pending tool call.
        // Use appendMessage (not followUp) so they appear in the message
        // history immediately — followUp only queues for the *next* turn
        // boundary and would be lost if the LLM call fails immediately.
        for (const tc of toolCalls) {
          const errorResult: AgentMessage = {
            role: "toolResult",
            toolCallId: (tc as any).id,
            toolName: (tc as any).name,
            content: [{ type: "text", text: "Error: process restarted while this tool call was in progress." }],
            isError: true,
            timestamp: Date.now(),
          } as AgentMessage;
          agent.appendMessage(errorResult);
        }
        // After appending tool results, the last role is now "toolResult",
        // so the resume path below will use agent.continue() correctly.
        lastRole = "toolResult";
      } else if ((lastMsg as any).stopReason === "toolUse") {
        // Malformed response: stopReason says "toolUse" but no tool call content
        savedMessages.pop();
        agent.replaceMessages(savedMessages);
        lastRole = savedMessages.length > 0 ? savedMessages[savedMessages.length - 1].role : undefined;
      }
    }

    this.registry.updateSessionStatus(sessionId, "running");

    const session: ActiveSession = {
      sessionId,
      agentName: persisted.agent,
      agent,
      promise: null!,
      task: persisted.task,
      startedAt: persisted.startedAt,
      status: "running",
      outputDir,
      parentSessionId: persisted.parentSessionId,
      turnCount: savedMessages.filter((m) => m.role === "assistant").length,
      compactionTransform,
      closed: false,
      autoClose: persisted.autoClose ?? "immediate",
      kind: persisted.kind ?? "job",
      opBudget: def.opBudget ?? 0,
      opCount: 0,
      infraRetryCount: 0,
      toolErrorHistory: new Map(),
      toolErrorCount: 0,
      turnBudgetWarningAt: def.turnBudgetWarningAt ?? TURN_BUDGET_WARNING_DEFAULT,
      turnBudgetWarned: false,
    };

    this.subscribeForPersistence(session);
    this.setupTimeout(session, def.timeoutMs);
    this.activeSessions.set(sessionId, session);
    this.onSessionStart?.(persisted.agent, sessionId);

    // Continue the agent — either resume from a pending user message or
    // inject a restart notice and let the agent continue its task.
    const resumeMessage: AgentMessage = {
      role: "user",
      content: [
        { type: "text", text: "Process restarted. Your session has been restored. Continue where you left off." },
      ],
      timestamp: Date.now(),
      source: "system",
    } as AgentMessage;

    const startPromise =
      lastRole === "user" || lastRole === "toolResult" ? agent.continue() : agent.prompt(resumeMessage);

    session.promise = runAgentWithRetry(session, startPromise, this._infraRetryMax, (s) => this.handleCompletion(s));

    this.sessionResults.set(
      sessionId,
      session.promise.then(() => this.buildResultFromSession(session)),
    );

    return {
      sessionId,
      agent: persisted.agent,
      task: persisted.task,
      status: "running",
      startedAt: persisted.startedAt,
      runtime: formatDuration(Date.now() - persisted.startedAt),
      outputDir,
    };
  }

  /** Get all active (running) sessions. Completed sessions are not listed — use result() or progress(). */
  status(): SessionInfo[] {
    return Array.from(this.activeSessions.values()).map((s) => ({
      sessionId: s.sessionId,
      agent: s.agentName,
      task: s.task,
      status: s.status,
      startedAt: s.startedAt,
      endedAt: s.endedAt ?? (s.status !== "running" ? Date.now() : undefined),
      runtime: formatDuration((s.endedAt ?? Date.now()) - s.startedAt),
      outputDir: s.outputDir,
      error: s.error,
      parentSessionId: s.parentSessionId,
      workflowRunId: s.workflowRunId,
      stepLabel: s.stepLabel,
      autoClose: s.autoClose,
      kind: s.kind,
      opCount: s.opCount,
      opBudget: s.opBudget,
    }));
  }

  /** List all registered agents (name, description, domain). */
  listAgents(): Array<{ name: string; description: string; domain: string }> {
    return Array.from(this.agents.values()).map((a) => ({
      name: a.definition.name,
      description: a.definition.description,
      domain: a.definition.domain,
    }));
  }

  /** Return the number of registered agents. */
  agentCount(): number {
    return this.agents.size;
  }

  /** Check whether an agent with the given name is registered. */
  hasAgent(name: string): boolean {
    return this.agents.has(name);
  }

  /** Get the names of all registered agents. */
  agentNames(): string[] {
    return [...this.agents.keys()];
  }

  /** Get the full definition for a registered agent, or undefined if not registered. */
  getAgentDefinition(name: string): SubagentDefinition | undefined {
    const registered = this.agents.get(name);
    return registered?.definition;
  }
  /** Return the number of active (running) sessions. */
  getSessionCount(): number {
    return this.activeSessions.size;
  }

  /** Build a recursive tree of the session hierarchy rooted at the given session.
   *  Looks up both active sessions and archived/completed sessions in the registry.
   *  Recursively finds all child sessions (sessions whose parentSessionId matches).
   */
  getSessionTree(sessionId: string): SessionTreeNode {
    const registryData = this.registry.getRegistry();

    // Helper to find session data from active sessions or registry
    const findSession = (sid: string): { agent: string; task: string; status: string; error?: string } | null => {
      const active = this.activeSessions.get(sid);
      if (active) {
        return { agent: active.agentName, task: active.task, status: active.status, error: active.error };
      }
      const persisted = registryData.sessions[sid];
      if (persisted) {
        return { agent: persisted.agent, task: persisted.task, status: persisted.status, error: persisted.error };
      }
      return null;
    };

    // Map internal statuses to the SessionTreeNode status union
    const mapStatus = (status: string): "running" | "completed" | "cancelled" => {
      if (status === "running" || status === "idle") return "running";
      if (status === "done") return "completed";
      return "cancelled"; // error, interrupted
    };

    // Extract a result string: last assistant text from active session or archived messages
    const extractResult = (sid: string): string | undefined => {
      const active = this.activeSessions.get(sid);
      if (active) {
        const text = extractLastAssistantText(active.agent.state.messages);
        return text ?? undefined;
      }
      // Try archived messages
      try {
        const messages = readArchivedSessionMessages(this.registry.persistDir, sid);
        if (messages.length > 0) {
          const text = extractLastAssistantText(messages);
          return text ?? undefined;
        }
      } catch {
        // No archived messages available
      }
      return undefined;
    };

    // Collect all session IDs from both active sessions and registry
    const allSessionIds = new Set<string>();
    for (const sid of this.activeSessions.keys()) {
      allSessionIds.add(sid);
    }
    for (const sid of Object.keys(registryData.sessions)) {
      allSessionIds.add(sid);
    }

    // Build a parent -> children index
    const childrenOf = new Map<string, string[]>();
    for (const sid of allSessionIds) {
      const active = this.activeSessions.get(sid);
      const persisted = registryData.sessions[sid];
      const parentSid = active?.parentSessionId ?? persisted?.parentSessionId;
      if (parentSid) {
        const siblings = childrenOf.get(parentSid);
        if (siblings) {
          siblings.push(sid);
        } else {
          childrenOf.set(parentSid, [sid]);
        }
      }
    }

    // Recursive tree builder
    const buildNode = (sid: string): SessionTreeNode => {
      const data = findSession(sid);
      if (!data) {
        throw new Error(`Session "${sid}" not found`);
      }
      const childIds = childrenOf.get(sid) ?? [];
      const children = childIds.map(buildNode);
      const status = mapStatus(data.status);
      const node: SessionTreeNode = {
        sessionId: sid,
        agent: data.agent,
        task: data.task,
        status,
        children,
      };
      // Attach result for completed/cancelled sessions
      if (status === "completed" || status === "cancelled") {
        const result = extractResult(sid);
        if (result !== undefined) {
          node.result = result;
        }
      }
      return node;
    };

    return buildNode(sessionId);
  }

  /** Get sessions filtered by agent name. */
  sessions(name: string): SessionInfo[] {
    return this.status().filter((s) => s.agent === name);
  }

  /** Get last N messages from a session.
   *  Falls back to archived JSONL for completed sessions.
   *  Throws if session not found.
   */
  progress(sessionId: string, limit?: number): AgentMessage[] {
    const session = this.activeSessions.get(sessionId);
    let messages: AgentMessage[];
    if (session) {
      messages = session.agent.state.messages;
    } else {
      const persisted = this.registry.getSession(sessionId);
      if (!persisted) {
        throw new Error(`Session "${sessionId}" not found`);
      }
      messages = readArchivedSessionMessages(this.registry.persistDir, sessionId);
    }
    if (limit === undefined) return messages.slice();
    if (limit <= 0) return [];
    return messages.slice(-limit);
  }

  /** Get result of a completed session.
   *  Throws if session not found, still running, or idle (Chat session).
   *  Chat+Task model: only the interface agent can be idle.
   */
  result(sessionId: string): TaskResult {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      if (session.status === "running") {
        throw new Error(`Session "${sessionId}" is still running`);
      }
      if (session.status === "idle") {
        throw new Error(`Session "${sessionId}" is idle (Chat session) — use progress() to read messages`);
      }
      return this.buildResultFromSession(session);
    }
    // Not active — check registry for completed session
    return this.resultFromArchive(sessionId);
  }

  /** Build a TaskResult from an ActiveSession object (which may have been removed from the map). */
  private buildResultFromSession(session: ActiveSession): TaskResult {
    const messages = session.agent.state.messages;
    const retries = session.infraRetryCount;
    const toolErrors = session.toolErrorCount;
    const turns = session.turnCount;
    // P20 Tainted Handoffs: mark results as unreliable when too many retries or
    // tool errors occurred. Thresholds chosen empirically:
    //   retries > 2: three infra retries means persistent instability (network, rate limits)
    //   toolErrors > 1: two+ tool errors suggests the agent is struggling with the environment
    // Downstream consumers (evaluator, parent agents) can use this signal to
    // discount results or request re-execution.
    const tainted = retries > 2 || toolErrors > 1;
    return {
      sessionId: session.sessionId,
      status:
        session.archiveStatus === "interrupted" || session.status === "interrupted"
          ? "error"
          : ((session.archiveStatus ?? session.status) as "done" | "error"),
      lastAssistantText: extractLastAssistantText(messages),
      messages: messages.slice(),
      duration: formatDuration((session.endedAt ?? Date.now()) - session.startedAt),
      outputDir: session.outputDir,
      error: session.error,
      turnsUsed: session.turnCount,
      instability: { retries, toolErrors, turns, verdict: tainted ? "tainted" : "clean" },
    };
  }

  /** Build a TaskResult from archived persistence data.
   *  Throws if session not found in registry.
   */
  private resultFromArchive(sessionId: string): TaskResult {
    const persisted = this.registry.getSession(sessionId);
    if (!persisted) {
      throw new Error(`Session "${sessionId}" not found`);
    }
    if (persisted.status === "running" || persisted.status === "idle") {
      throw new Error(`Session "${sessionId}" is still running (stale registry entry)`);
    }
    const messages = readArchivedSessionMessages(this.registry.persistDir, sessionId);
    const duration = persisted.endedAt
      ? formatDuration(persisted.endedAt - persisted.startedAt)
      : formatDuration(Date.now() - persisted.startedAt);
    return {
      sessionId,
      status: persisted.status === "interrupted" ? "error" : (persisted.status as "done" | "error"),
      lastAssistantText: extractLastAssistantText(messages),
      messages,
      duration,
      outputDir: sessionOutputDir(this.registry.persistDir, sessionId),
      error: persisted.error,
    };
  }
  /** Check if a session is currently active in-memory. */
  hasActiveSession(sessionId: string): boolean {
    return this.activeSessions.has(sessionId);
  }

  /**
   * Send input to an IDLE session (interface/chat agent), or steer a RUNNING one.
   *
   * If the session is IDLE, this triggers a new turn with the provided text.
   * If the session is RUNNING, this acts as a steer() (injects message).
   *
   * @param sessionId - The session ID.
   * @param text - The user input text.
   * @returns Promise that resolves when the *new* turn completes.
   */
  async input(sessionId: string, text: string): Promise<TaskResult> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found (or not active)`);
    }

    // Case 1: Session is RUNNING — delegate to steer
    if (session.status === "running") {
      this.steer(sessionId, text, "user");
      // Return a promise that resolves when the *current* session promise resolves.
      return this.sessionResults.get(sessionId)!;
    }

    // Case 2: Session is IDLE — wake it up
    if (session.status === "idle") {
      session.status = "running";
      session.error = undefined; // Clear previous turn's error
      session.infraRetryCount = 0; // Reset retry counter for new turn
      this.registry.updateSessionStatus(sessionId, "running");

      // Write [STARTED] sentinel
      try {
        const sentinelPath = join(sessionDir(this.registry.persistDir, session.sessionId), "[STARTED]");
        writeFileSync(sentinelPath, new Date().toISOString());
      } catch {
        /* best-effort */
      }

      // Prompt the agent with new input
      const p = runAgentWithRetry(session, session.agent.prompt(text), this._infraRetryMax, (s) => this.handleCompletion(s));

      session.promise = p;
      const resultPromise = p.then(() => this.buildResultFromSession(session));
      this.sessionResults.set(sessionId, resultPromise);

      return resultPromise;
    }

    throw new Error(`Session "${sessionId}" is in terminal state (${session.status}) — cannot accept input`);
  }

  /**
   * Cancel a running session and all its children (cascading).
   * No-op if session not found, already terminal, or idle interface agent (nothing to cancel).
   *
   * Chat+Task model: only the interface agent can be idle. Task sessions are
   * always running or terminal — they never enter idle state.
   * See docs/session-state-machine.md.
   */
  cancel(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    if (session.status !== "running" && session.status !== "idle") return;

    // Cancel children first (depth-first)
    for (const child of this.activeSessions.values()) {
      if (child.parentSessionId === sessionId && child.status === "running") {
        this.cancel(child.sessionId);
      }
    }

    // Idle interface agent: no-op — nothing is running. Use close() to destroy.
    if (session.status === "idle") {
      return;
    }

    // Running — abort the agent loop. handleCompletion fires when the promise settles.
    session.agent.abort();
  }

  /**
   * Permanently close a session — archive to disk and remove from memory.
   *
   * If the session is running, cancels it first (cascading children).
   * Unlike cancel(), this always archives — even for the interface agent.
   * The session will NOT resume on restart.
   * See docs/session-state-machine.md.
   */
  close(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    // Set closed flag FIRST — prevents handleCompletion (from pending abort) from acting.
    session.closed = true;

    // Cancel running work (cascading children).
    this.cancel(sessionId);

    // If already removed (task session archived by cancel), done.
    if (!this.activeSessions.has(sessionId)) return;

    // Still here — archive and remove.
    session.unsubscribe?.();
    session.endedAt = Date.now();
    session.status = "interrupted";
    session.archiveStatus = "interrupted";
    session.error = "Closed";
    this.registry.updateSessionStatus(sessionId, "interrupted", "Closed");
    this.appendMemory(session);
    this.archiveSessionDir(session);
    this.activeSessions.delete(sessionId);
  }

  /** Steer a running session mid-run.
   *  Throws if session not found or not running.
   */
  steer(sessionId: string, message: string, source?: string): "steered" | "queued" {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== "running") {
      throw new Error(`Session "${sessionId}" not found or not running`);
    }
    if (session.agent.state.isStreaming) {
      session.agent.steer({
        role: "user",
        content: [{ type: "text", text: message }],
        timestamp: Date.now(),
        ...(source ? { source } : {}),
      });
      return "steered";
    }
    session.agent.followUp({
      role: "user",
      content: [{ type: "text", text: message }],
      timestamp: Date.now(),
      ...(source ? { source } : {}),
    });
    return "queued";
  }

  /**
   * Inject a non-interrupting message into a running session.
   *
   * Unlike steer(), this never interrupts mid-turn — the message is queued
   * via agent.followUp() and delivered at the next natural turn boundary.
   *
   * Use for automated event injection (socket_watch, coaching events, etc.)
   * where the caller doesn't need to wait for a response.
   *
   * Throws if session not found or not running.
   */
  followUp(sessionId: string, message: string, source?: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }
    if (session.status !== "running") {
      throw new Error(`Session "${sessionId}" is not running (status: ${session.status})`);
    }

    const msg: AgentMessage = {
      role: "user",
      content: [{ type: "text", text: message }],
      timestamp: Date.now(),
      ...(source ? { source } : {}),
    };

    session.agent.followUp(msg);
  }

  /** Subscribe to agent events for a running session. Returns unsubscribe function.
   *  Throws if session not found or not running.
   */
  subscribe(sessionId: string, fn: (e: AgentEvent) => void): () => void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found or not running`);
    }
    return session.agent.subscribe(fn);
  }

  /** Wait for a session to finish. Returns result.
   *  Throws if session not found (neither active nor in registry).
   *  Note: for the interface agent, this resolves after the first processing cycle
   *  but the TaskResult status may not be meaningful. Use waitForIdle() instead.
   */
  async waitFor(sessionId: string): Promise<TaskResult> {
    // Check the result promise first — works even if session already completed
    const resultPromise = this.sessionResults.get(sessionId);
    if (resultPromise) {
      return resultPromise;
    }
    // Not started by this manager instance — check archive
    return this.resultFromArchive(sessionId);
  }

  /**
   * Wait for the interface (Chat) session's current processing to finish (transition to "idle").
   * Resolves immediately if the session is already idle.
   *
   * Chat+Task model: for task sessions, this waits for completion (they never
   * enter idle — they terminate with done/error/interrupted).
   * Throws if session not found.
   */
  async waitForIdle(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }
    if (session.status === "idle") return;
    if (session.status !== "running") return; // already terminal
    await session.promise;
  }

  /**
   * Wait for a detached session to complete by polling its meta.json on disk.
   * Returns a TaskResult built from the persisted session data.
   *
   * Strategy: poll meta.json for terminal status. This is the most reliable
   * approach since the detached process always writes meta.json on completion.
   * Socket-based instant notification is a future optimization.
   *
   * @param sessionId - The session ID of the detached session
   * @param opts.pollIntervalMs - Polling interval (default: 2000ms)
   * @param opts.timeoutMs - Overall timeout (default: 600_000ms = 10 min)
   */
  async waitForDetached(
    sessionId: string,
    opts?: { pollIntervalMs?: number; timeoutMs?: number },
  ): Promise<TaskResult> {
    const pollInterval = opts?.pollIntervalMs ?? 2000;
    const timeoutMs = opts?.timeoutMs ?? 600_000;

    // Check if already done
    const initialMeta = this.registry.getSession(sessionId);
    if (!initialMeta) {
      throw new Error(`Session "${sessionId}" not found`);
    }
    if (initialMeta.status !== "running" && initialMeta.status !== "idle") {
      return this.resultFromArchive(sessionId);
    }

    // Poll meta.json until status is terminal
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const meta = this.registry.getSession(sessionId);
      if (meta && meta.status !== "running" && meta.status !== "idle") {
        return this.resultFromArchive(sessionId);
      }
      // Also check identity.json for process exit (catches cases where
      // meta.json wasn't updated but the process died)
      if (initialMeta.instance) {
        const identity = readIdentity(this.registry.persistDir, initialMeta.instance);
        if (identity && identity.status !== "running") {
          // Process exited — give meta.json a moment to flush, then check
          await new Promise((r) => setTimeout(r, 500));
          const finalMeta = this.registry.getSession(sessionId);
          if (finalMeta && finalMeta.status !== "running" && finalMeta.status !== "idle") {
            return this.resultFromArchive(sessionId);
          }
          // Process is dead but meta still says running — mark as error
          this.registry.updateSessionStatus(sessionId, "error", "Process exited without completing");
          return this.resultFromArchive(sessionId);
        }
      }
      await new Promise((r) => setTimeout(r, pollInterval));
    }
    throw new Error(`Timeout waiting for detached session "${sessionId}" (${timeoutMs}ms)`);
  }
  // ── Path accessors ───────────────────────────────────────────────────

  /** Get the knowledge directory path for a registered agent. */
  getKnowledgePath(name: string): string | undefined {
    const registered = this.agents.get(name);
    return registered?.definition.knowledgeDir;
  }

  /** Get the workspace path for a registered agent. */
  getWorkspacePath(name: string): string | undefined {
    const registered = this.agents.get(name);
    return registered?.definition.workspace;
  }

  /** Get the workflows directory for a registered agent.
   *  Convention: agentDir = dirname(workspace), workflows = agentDir/workflows.
   */
  getWorkflowDir(name: string): string | undefined {
    const registered = this.agents.get(name);
    const workspace = registered?.definition.workspace;
    if (!workspace) return undefined;
    const agentDir = dirname(workspace);
    return join(agentDir, "workflows");
  }

  /** Get the memory JSONL path for an agent. */
  getMemoryPath(name: string): string {
    return memoryPath(this.registry.persistDir, name);
  }

  /** Get the output directory for a session (active or archived). */
  getOutputPath(sessionId: string): string | undefined {
    const session = this.activeSessions.get(sessionId);
    if (session) return session.outputDir;

    // Check archived sessions in history
    const persistDir = this.registry.persistDir;
    const archivedOutputDir = join(historyDir(persistDir), sessionId, "output");
    if (existsSync(archivedOutputDir)) return archivedOutputDir;

    // Check if session exists in active sessions dir (not yet archived)
    const activeOutputDir = sessionOutputDir(persistDir, sessionId);
    if (existsSync(activeOutputDir)) return activeOutputDir;

    return undefined;
  }

  // ── Session graph: trace (delegated to manager-trace.ts) ──────────────

  /** Build a session trace from any session or workflow run ID.
   *  Walks parent pointers up to the root, loads workflow run records,
   *  and builds a tree showing the position of the target in the graph.
   */
  trace(targetId: string): SessionTrace | null {
    return buildTrace(targetId, {
      persistDir: this.registry.persistDir,
      registryData: this.registry.getRegistry(),
      activeSessions: this.activeSessions,
    });
  }

  // ── Health API (delegated to manager-health.ts) ────────────────────────

  /** Build the HealthContext for delegation to standalone health functions. */
  private healthContext(): import("./manager-health.js").HealthContext {
    return {
      agents: this.agents,
      activeSessions: this.activeSessions,
      startedAt: this.startedAt,
      persistDir: this.registry.persistDir,
    };
  }

  /** Fast, in-memory health snapshot. Returns data the manager already knows. */
  health(): ManagerHealthReport {
    return computeHealth(this.healthContext());
  }

  /**
   * Filesystem-based ground-truth scan. Inspects persisted session data on disk.
   * Intentionally synchronous — this is a diagnostic endpoint, not a hot path.
   */
  auditHealth(opts?: AuditHealthOptions): AuditHealthReport {
    return computeAuditHealth(this.healthContext(), opts);
  }

  /** Compare in-memory state vs filesystem and flag discrepancies. */
  reconcileHealth(opts?: AuditHealthOptions): ReconcileReport {
    return computeReconcileHealth(this.healthContext(), opts);
  }

  // ── Tool receipt signing (delegated to manager-receipts.ts) ──

  signToolOutput(output: string): string {
    return signToolOutput(output);
  }

  verifyToolOutput(content: string, signature: string): boolean {
    return verifyToolOutput(content, signature);
  }

  createVerifyReceiptTool(): AgentTool {
    return createVerifyReceiptTool();
  }

  getOpUsage(sessionId: string): { opBudget: number; opCount: number } | null {
    return getOpUsage(this.activeSessions, sessionId);
  }

  // ── Delegation metrics logging ──────────────────────────────────────

  /**
   * Append a structured delegation event to `.state/delegations.jsonl`.
   * Best-effort — never throws.
   */
  private logDelegation(entry: {
    parent: string;
    child: string;
    method: "call" | "send";
    status: "success" | "error" | "timeout" | "sent";
    sessionId?: string;
    durationMs?: number | null;
    error?: string;
  }): void {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        traceId: randomUUID(),
        sessionId: entry.sessionId ?? null,
        parent: entry.parent,
        child: entry.child,
        method: entry.method,
        status: entry.status,
        durationMs: entry.durationMs ?? null,
        error: entry.error ?? null,
      };
      const logPath = join(this.registry.persistDir, "delegations.jsonl");
      appendFileSync(logPath, JSON.stringify(logEntry) + "\n", "utf-8");
    } catch (err) {
      /* best-effort — never block agent operations for logging, but surface the error */
      const logPath = join(this.registry.persistDir, "delegations.jsonl");
      console.error(`[manager] Failed to write delegation log to ${logPath}:`, err);
    }
  }

  // ── V2: callAgent + agents tool ──────────────────────────────────────

  /**
   * Synchronous agent call — runs an agent to completion and returns the result.
   * This is the single cooperation primitive in V2.
   *
   * Blocks until the child agent finishes. The child runs in-process as a
   * new Agent instance (same event loop, different call stack frame via await).
   *
   * Call depth is tracked to prevent infinite recursion (A→B→A→B→...).
   *
   * @param name - Registered agent name
   * @param task - Task description
   * @param opts.parentSessionId - Parent session ID for tracking
   * @param opts.onEvent - Streaming callback for real-time events
   * @param opts.signal - AbortSignal for cancellation
   * @param opts.timeout - Timeout in ms (aborts child if exceeded)
   */
  async callAgent(
    name: string,
    task: string,
    opts?: {
      parentSessionId?: string;
      onEvent?: (event: AgentEvent) => void;
      signal?: AbortSignal;
      timeout?: number;
      /** Workflow run ID — passed through to the spawned session for tracking. */
      workflowRunId?: string;
      /** Step label — passed through to the spawned session for tracking. */
      stepLabel?: string;
      /** Message source tag (default: "callAgent"). */
      source?: string;
    },
  ): Promise<TaskResult> {
    // ── Depth check ────────────────────────────────────────────────────
    // Find the root session by walking up parentSessionId chain
    const rootSessionId = this.findRootSession(opts?.parentSessionId);
    const currentDepth = rootSessionId ? (this.callDepths.get(rootSessionId) ?? 0) : 0;

    if (currentDepth >= this._maxCallDepth) {
      return {
        sessionId: "",
        status: "error",
        lastAssistantText: null,
        messages: [],
        duration: "0s",
        outputDir: "",
        error: `Call depth limit exceeded (${this._maxCallDepth}). This usually means agents are calling each other in a loop.`,
      };
    }

    // Increment depth
    if (rootSessionId) {
      this.callDepths.set(rootSessionId, currentDepth + 1);
    }

    // Determine parent agent name for delegation logging
    const parentAgentName = opts?.parentSessionId
      ? (this.activeSessions.get(opts.parentSessionId)?.agentName ?? "unknown")
      : "unknown";
    const delegationStart = Date.now();

    try {
      // ── Start session ──────────────────────────────────────────────────
      const sessionId = this.run(name, task, {
        parentSessionId: opts?.parentSessionId,
        workflowRunId: opts?.workflowRunId,
        stepLabel: opts?.stepLabel,
        source: opts?.source ?? "callAgent",
        kind: "call",
      });

      // Subscribe for streaming events if requested
      let unsubscribe: (() => void) | undefined;
      if (opts?.onEvent) {
        try {
          unsubscribe = this.subscribe(sessionId, opts.onEvent);
        } catch {
          /* session may have already completed */
        }
      }

      // Set up timeout
      let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
      if (opts?.timeout) {
        timeoutTimer = setTimeout(() => {
          this.cancel(sessionId);
        }, opts.timeout);
      }

      // Forward abort signal
      if (opts?.signal) {
        if (opts.signal.aborted) {
          this.cancel(sessionId);
        } else {
          opts.signal.addEventListener(
            "abort",
            () => {
              this.cancel(sessionId);
            },
            { once: true },
          );
        }
      }

      // ── Wait for completion ────────────────────────────────────────────
      const result = await this.waitFor(sessionId);

      // Cleanup
      if (timeoutTimer) clearTimeout(timeoutTimer);
      unsubscribe?.();

      // ── Log delegation result ──────────────────────────────────────────
      const durationMs = Date.now() - delegationStart;
      this.logDelegation({
        parent: parentAgentName,
        child: name,
        method: "call",
        status: result.status === "error" ? "error" : "success",
        sessionId,
        durationMs,
        error: result.error,
      });

      return result;
    } finally {
      // Decrement depth
      if (rootSessionId) {
        const depth = this.callDepths.get(rootSessionId) ?? 1;
        if (depth <= 1) {
          this.callDepths.delete(rootSessionId);
        } else {
          this.callDepths.set(rootSessionId, depth - 1);
        }
      }
    }
  }

  /** Walk up the parentSessionId chain to find the root session. */
  private findRootSession(sessionId: string | undefined): string | undefined {
    if (!sessionId) return undefined;
    const session = this.activeSessions.get(sessionId);
    if (!session) return sessionId;
    if (session.parentSessionId) {
      return this.findRootSession(session.parentSessionId);
    }
    return sessionId;
  }

  /**
   * Create the V2 agents tool — 5 actions: call, send, list, peek, cancel.
   *
   * Delegates to the standalone `createAgentsTool()` in `manager-agents-tool.ts`.
   * Kept as an instance method for backward compatibility with existing callers.
   */
  createAgentsTool(opts?: CreateAgentsToolOptions): AgentTool {
    // Cast needed: `agents` is private on SubagentManager but the extracted
    // function needs read access. The shape matches at runtime.
    return createAgentsToolFn(this as unknown as import("./manager-agents-tool.js").AgentsToolManagerDeps, opts);
  }
}
