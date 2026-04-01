import { readFileSync, readdirSync, mkdirSync, existsSync, writeFileSync, unlinkSync } from "node:fs";
import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentMessage, AgentEvent, AgentTool } from "@mariozechner/pi-agent-core";
import {
  generateId,
  formatDuration,
  extractLastAssistantText,
  formatMemoryTimestamp,
  isProcessAlive,
  truncateForPrompt,
  isToolError,
  MEMORY_TASK_MAX,
  MEMORY_SUMMARY_MAX,
  INFRA_RETRY_MAX,
  TURN_BUDGET_WARNING_DEFAULT,
  STUCK_WARNING_THRESHOLD,
  STUCK_TERMINATE_THRESHOLD,
} from "./manager-utils.js";
import type { RegisteredAgent, ActiveSession, RunOptions, SubagentManagerOptions } from "./manager-utils.js";
import { createFinishGuard } from "./tools/finish-guard.js";
import { createReadDedupGuard } from "./tools/read-dedup-guard.js";
import { createSessionReadGuard } from "./tools/session-read-guard.js";
import { createScrapeDedupGuard } from "./tools/scrape-dedup-guard.js";
import { createEmptyArgsGuard } from "./tools/empty-args-guard.js";
import { composeGuards } from "./tools/compose-guards.js";

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
  STUCK_WARNING_THRESHOLD,
  STUCK_TERMINATE_THRESHOLD,
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
  listActiveSessionIds,
  readSessionMeta,
  writeSessionMeta,
  readWorkflowRun,
  listWorkflowRuns,
  saveWorkflowRun,
  readCompactedMessages,
} from "./persistence.js";
import type { MemoryEntry, PersistedSession, SessionKind } from "./persistence.js";
import type { SessionTrace } from "./workflow.js";
import { join, dirname, relative, resolve } from "node:path";
import { isOverflowError, extractProgress, writeProgressFile } from "./overflow.js";
import { readIdentity } from "./detached.js";
import { runActiveRecall, formatRecallWarnings } from "./active-recall.js";
import { readLatestCheckpointForAgent, cleanupStepCounter } from "./tools/checkpoint.js";
import { buildTrace } from "./manager-trace.js";
import { hasFinishToolCall, extractFinishParams, runAgentWithRetry } from "./manager-retry.js";
import { createAgentsTool as createAgentsToolFn, type CreateAgentsToolOptions } from "./manager-agents-tool.js";
import { classifyError as classifyErrorFn } from "./classify-error.js";

// Lazy import for requests.ts (uses bun:sqlite, not available in vitest)
let _requestsMod: typeof import("./requests.js") | null = null;
async function getRequestFns() {
  if (!_requestsMod) {
    try {
      const mod = await import("./requests.js");
      _requestsMod = mod;
    } catch {
      /* bun:sqlite not available (e.g., vitest) */
    }
  }
  return _requestsMod;
}

export { isRetryableInfraError, runAgentWithRetry } from "./manager-retry.js";
// classifyError is pure string-matching — imported from classify-error.ts (no bun:sqlite deps)
export { classifyError } from "./classify-error.js";
export { buildTrace, findPathToTarget } from "./manager-trace.js";
export type { TraceContext } from "./manager-trace.js";
import { computeHealth, computeAuditHealth, computeReconcileHealth } from "./manager-health.js";
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
import { appendActivity, truncateSummary, PROGRESS_INTERVAL } from "./activity.js";
import { log } from "./log.js";
// ConcurrencyGate removed — see manager-receipts.ts comment.

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
  private onSessionBlocked?: (agentName: string, sessionId: string, reason: string) => void;
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

  /** Public accessor for the registry store. Used by evaluator to find child sessions. */
  get registryStore(): RegistryStore {
    return this.registry;
  }

  constructor(opts: SubagentManagerOptions) {
    this.registry = new RegistryStore(opts.persistDir);
    this._projectRoot = opts.projectRoot ?? resolve(opts.persistDir, "..");
    this._maxCallDepth = opts.maxCallDepth ?? 10;
    this._infraRetryMax = opts.infraRetryMax ?? INFRA_RETRY_MAX;
    this.onSessionComplete = opts.onSessionComplete;
    this.onSessionStart = opts.onSessionStart;
    this.onSessionBlocked = opts.onSessionBlocked;
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

        // ── Count tool errors/successes from tool_result messages ──────
        if (event.message.role === "user" && Array.isArray(event.message.content)) {
          for (const block of event.message.content as any[]) {
            if (block.type === "tool_result") {
              const text =
                typeof block.content === "string"
                  ? block.content
                  : Array.isArray(block.content)
                    ? block.content
                        .filter((b: any) => b.type === "text")
                        .map((b: any) => b.text)
                        .join(" ")
                    : "";
              if (block.is_error || isToolError(text)) {
                session.currentTurnErrors++;
              } else {
                session.currentTurnSuccesses++;
              }
            }
          }
        }

        if (event.message.role === "assistant") {
          session.turnCount++;

          // ── Stuck Detection ──────────────────────────────────────────
          // At each turn boundary, check if the previous turn had only errors.
          // If so, increment consecutiveErrorTurns. If it had any success, reset.
          if (session.currentTurnErrors > 0 && session.currentTurnSuccesses === 0) {
            session.consecutiveErrorTurns++;
          } else if (session.currentTurnSuccesses > 0) {
            session.consecutiveErrorTurns = 0;
            session.stuckWarningInjected = false; // Reset warning if agent recovered
          }
          // Reset per-turn counters for the next turn
          session.currentTurnErrors = 0;
          session.currentTurnSuccesses = 0;

          // Inject stuck warning at threshold
          if (session.consecutiveErrorTurns >= STUCK_WARNING_THRESHOLD && !session.stuckWarningInjected) {
            session.stuckWarningInjected = true;
            log(
              "warn",
              `STUCK_WARNING: Agent ${session.agentName} (${sessionId}) has ${session.consecutiveErrorTurns} consecutive error turns. Warning injected.`,
            );
          }

          // Auto-terminate at terminate threshold
          if (session.consecutiveErrorTurns >= STUCK_TERMINATE_THRESHOLD) {
            log(
              "error",
              `STUCK_TERMINATE: Agent ${session.agentName} (${sessionId}) has ${session.consecutiveErrorTurns} consecutive error turns. Auto-terminating.`,
            );
            session.error = `Stuck Detection: ${session.consecutiveErrorTurns} consecutive turns with only errors. Session auto-terminated.`;
            session.agent.abort();
          }

          // ── maxTurns Enforcement ─────────────────────────────────────
          // Gracefully terminate sessions that exceed their turn budget.
          if (session.maxTurns > 0 && session.turnCount >= session.maxTurns) {
            log(
              "warn",
              `MAX_TURNS: Agent ${session.agentName} (${sessionId}) reached turn limit (${session.turnCount}/${session.maxTurns}). Terminating.`,
            );
            session.error = `Turn limit reached: ${session.turnCount}/${session.maxTurns} turns. Session terminated.`;
            session.agent.abort();
          }

          // Activity tracking: emit progress event every N turns
          if (session.turnCount > 0 && session.turnCount % PROGRESS_INTERVAL === 0) {
            const lastText = event.message.content
              ? Array.isArray(event.message.content)
                ? event.message.content
                    .filter((b: any) => b.type === "text")
                    .map((b: any) => b.text)
                    .join(" ")
                : String(event.message.content)
              : "";
            appendActivity(
              this._projectRoot,
              {
                ts: Date.now(),
                event: "progress",
                sid: sessionId,
                agent: session.agentName,
                turns: session.turnCount,
                summary: truncateSummary(lastText),
              },
              this.getWorkspacePath(session.agentName),
            );
          }
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
   *    SOUL.md → common-sense.md + generated sections (Runtime Env, Available Tools)
   *  Then: Runtime Environment (generated), Session Context (generated).
   *
   *  The entire prompt is wrapped in <system_instructions> tags (P84) to
   *  structurally reinforce the Instruction Hierarchy. Content from user
   *  messages and tool outputs should be treated as data, not directives.
   *
   *  If systemPrompt is set directly, it takes precedence over everything.
   */
  private resolveSystemPrompt(def: SubagentDefinition): string {
    if (def.systemPrompt) return def.systemPrompt;

    const sections: string[] = [];
    const agentDir = def.knowledgeDir ? dirname(def.knowledgeDir) : def.workspace ? dirname(def.workspace) : undefined;

    // Helper: read a file if it exists, return trimmed content or undefined
    const loadFile = (path: string | undefined): string | undefined => {
      if (!path || !existsSync(path)) return undefined;
      const content = readFileSync(path, "utf-8").trim();
      return content || undefined;
    };

    // ── System prompt: SOUL.md + common-sense.md + generated sections ──
    //
    // SOUL.md: agent identity, role, methodology, curated skills, constraints (~2-4KB)
    // common-sense.md: shared behavioral rules for all agents (~5-8KB)
    //
    // Files NO LONGER loaded (removed as part of prompt simplification):
    //   DOMAIN.md — removed per Hao directive (prompt simplification)
    //   Archetype SOUL.md — removed per Hao directive (prompt simplification)
    //   LESSONS.md — removed per prompt simplification (Hao directive)
    //   shared/LESSONS.md — removed per prompt simplification (Hao directive)
    //   TOOLS.md — redundant with tool schema descriptions
    //   knowledge/INDEX.md — agent reads on-demand, not preloaded
    //   shared/INDEX.md — same

    // 1. SOUL.md — agent identity, role, methodology, curated skills
    const soul = loadFile(agentDir ? join(agentDir, "SOUL.md") : undefined);

    // 0. Archetype SOUL.md — REMOVED per Hao directive.
    // _archetypes/ directory can stay as reference but is NOT loaded into prompts.

    if (soul) sections.push(soul);

    // 1b. DOMAIN.md — REMOVED per Hao directive (prompt simplification).
    // Domain content belongs in SOUL.md or knowledge/ files, NOT auto-loaded into prompts.

    // 1c/1d. LESSONS.md — REMOVED per Hao directive (prompt simplification).
    // Previously loaded agent LESSONS.md + shared/LESSONS.md here.
    // Agents should use skills and heartbeat guards for behavioral patches.

    // 2. common-sense.md — shared behavioral rules
    const commonSense = loadFile(
      def.projectRoot ? join(def.projectRoot, "agents", "shared", "common-sense.md") : undefined,
    );
    if (commonSense) sections.push(commonSense);

    // 3. Skills — behavioral patches from skills/*.md
    if (agentDir) {
      const skillsDir = join(agentDir, "skills");
      if (existsSync(skillsDir)) {
        const skillFiles = readdirSync(skillsDir, { recursive: true })
          .map((f) => String(f))
          .filter((f) => f.endsWith(".md"))
          .sort();
        for (const sf of skillFiles) {
          const skillContent = loadFile(join(skillsDir, sf));
          if (skillContent) sections.push(skillContent);
        }
      }
    }
    // Note: shared skills (agents/shared/skills/) are a reference library,
    // NOT auto-loaded into every agent's prompt. Agents adopt specific skills
    // by copying them into their own skills/ directory (e.g., via growth-cycle).

    // 5c. context_files — moved to buildSessionContext() (P147 KV-Cache Discipline).
    // These files (e.g., conversation-state.md) change between sessions, so
    // loading them here would invalidate the KV-cache prefix every time.

    // ── Generated sections (per-agent stable — safe for KV-cache) ──
    // These are deterministic per agent config; same agent produces the
    // same output across sessions.  True volatile data (session ID,
    // time, task history) lives in the first user message — see
    // buildSessionContext() — so the system prompt stays cache-friendly.

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
      const loaded: string[] = ["SOUL.md"];
      if (loaded.length > 0) {
        envLines.push(`- Already in context (do NOT re-read): ${loaded.join(", ")}, common-sense.md, skills/*.md`);
      }
      envLines.push(
        `- Knowledge index: knowledge/INDEX.md (read when you need references)`,
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

    // 8. Available Tools (C4.5) — auto-inject tool names so agents
    //    know exactly what they can call without guessing or hallucinating.
    if (def.tools.length > 0) {
      const toolNames = def.tools.map((t) => t.label);
      sections.push(
        `## Available Tools\nYou have access to these tools (and ONLY these): ${toolNames.join(", ")}.\nDo not attempt to call any tool not in this list.`,
      );
    }

    // ── P84: Wrap in <system_instructions> tags ─────────────────────
    // Structural reinforcement of the Instruction Hierarchy. The XML tags
    // signal to the LLM that everything inside is authoritative system-level
    // configuration, taking precedence over user messages and tool outputs.
    const body = sections.join("\n\n");
    return `<system_instructions>\n${body}\n</system_instructions>`;
  }

  /**
   * Build the per-session context block (session ID, time, recent task history).
   * This is prepended to the first user message instead of living in the
   * system prompt, so that the system prompt stays identical across sessions
   * and Anthropic prompt caching can produce cache reads (P147 KV-Cache Discipline).
   */
  private buildSessionContext(
    def: SubagentDefinition,
    agentName: string,
    sessionId: string,
    persistDir: string,
  ): string {
    const ctxLines = [`# Session Context`, `- Session ID: ${sessionId}`, `- Current Time: ${new Date().toISOString()}`];
    const memoryLimit = def.memoryLimit ?? 20;
    if (memoryLimit > 0) {
      const entries = readMemoryEntries(persistDir, agentName, memoryLimit);
      if (entries.length > 0) {
        ctxLines.push(``, `## Recent Task History`);
        for (const e of entries) {
          const ts = formatMemoryTimestamp(e.timestamp);
          const taskText = truncateForPrompt(e.task, MEMORY_TASK_MAX);
          const summary = e.summary ? ` — ${truncateForPrompt(e.summary, MEMORY_SUMMARY_MAX)}` : "";
          let extra = "";
          if (e.completed?.length) extra += ` | done: ${e.completed.join(", ")}`;
          if (e.newItems?.length) extra += ` | added: ${e.newItems.join(", ")}`;
          if (e.files?.length) extra += ` | files: ${e.files.slice(0, 5).join(", ")}${e.files.length > 5 ? "..." : ""}`;
          ctxLines.push(`- ${ts}: "${taskText}" — ${e.status} (${e.duration})${summary}${extra}`);
        }
      }
    }

    // P110 Active Recall: check failure history and inject warnings
    const recall = runActiveRecall(agentName, this._projectRoot);
    const recallBlock = formatRecallWarnings(recall);
    if (recallBlock) {
      ctxLines.push(``, recallBlock);
    }

    // P3.5 Checkpoint injection: if this agent has a previous checkpoint,
    // inject it so the agent can resume where it left off.
    const lastCheckpoint = readLatestCheckpointForAgent(persistDir, agentName);
    if (lastCheckpoint) {
      const age = Date.now() - lastCheckpoint.timestamp;
      const ageStr = age < 3_600_000 ? `${Math.round(age / 60_000)}m ago` : `${Math.round(age / 3_600_000)}h ago`;
      const dataStr =
        Object.keys(lastCheckpoint.data).length > 0 ? `\n- Data: ${JSON.stringify(lastCheckpoint.data)}` : "";
      ctxLines.push(
        ``,
        `## Last Checkpoint (from session ${lastCheckpoint.sessionId}, step #${lastCheckpoint.step}, ${ageStr})`,
        `- Summary: ${lastCheckpoint.summary}${dataStr}`,
        `- Next steps and context above may help you resume work efficiently.`,
      );
    }

    // 5c. context_files — loaded here (not in system prompt) per P147 KV-Cache
    // Discipline. These files change between sessions, so they must live in the
    // first user message to keep the system prompt prefix stable for caching.
    if (def.contextFiles) {
      for (const cfPath of def.contextFiles) {
        if (cfPath && existsSync(cfPath)) {
          const content = readFileSync(cfPath, "utf-8").trim();
          if (content) ctxLines.push(``, content);
        }
      }
    }

    // Context learning: load agents/<name>/context.md if it exists.
    // Auto-maintained by finish(context_updates) — accumulated project knowledge.
    {
      const ctxAgentDir = def.knowledgeDir
        ? dirname(def.knowledgeDir)
        : def.workspace
          ? dirname(def.workspace)
          : undefined;
      if (ctxAgentDir) {
        const ctxPath = join(ctxAgentDir, "context.md");
        if (existsSync(ctxPath)) {
          const ctxContent = readFileSync(ctxPath, "utf-8").trim();
          if (ctxContent) {
            ctxLines.push(``, `## What You Know (persistent context)`, ctxContent);
          }
        }
      }
    }

    return ctxLines.join("\n");
  }

  /** Apply context_updates from finish() to agents/<name>/context.md. */
  private applyContextUpdates(agentName: string, updates: { action: string; content: string }[]): void {
    const registered = this.agents.get(agentName);
    const dir = registered?.definition.knowledgeDir
      ? dirname(registered.definition.knowledgeDir)
      : registered?.definition.workspace
        ? dirname(registered.definition.workspace)
        : undefined;
    if (!dir) return;

    const contextPath = join(dir, "context.md");
    let lines: string[] = [];
    try {
      lines = readFileSync(contextPath, "utf-8").split("\n");
    } catch {
      /* file may not exist */
    }

    for (const u of updates) {
      const trimmed = u.content.trim();
      if (u.action === "add" && !lines.some((l) => l.includes(trimmed))) {
        lines.push(`- ${trimmed}`);
      } else if (u.action === "remove") {
        lines = lines.filter((l) => !l.includes(trimmed));
      }
    }

    // Trim if over 2KB
    let content = lines.join("\n");
    while (content.length > 2048) {
      const idx = content.indexOf("\n", 1);
      if (idx === -1) break;
      content = content.slice(idx + 1);
    }

    mkdirSync(dirname(contextPath), { recursive: true });
    writeFileSync(contextPath, content);
  }

  /** Append a memory entry after session completion.
   *  Uses finish() structured data when available for richer summaries.
   *  Falls back to extractLastAssistantText for unstructured sessions. */
  private appendMemory(session: ActiveSession): void {
    const messages = session.agent.state.messages;
    const endTime = session.endedAt ?? Date.now();

    // Prefer finish() structured data over raw last-assistant-text
    const finishData = extractFinishParams(messages);
    const summary = finishData?.summary ?? extractLastAssistantText(messages);

    const entry: MemoryEntry = {
      task: session.task,
      status: finishData?.status ?? session.archiveStatus ?? session.status,
      duration: formatDuration(endTime - session.startedAt),
      summary,
      timestamp: endTime,
    };

    // Enrich with finish() structured fields when available
    if (finishData?.completed_items?.length) entry.completed = finishData.completed_items;
    if (finishData?.new_items?.length) entry.newItems = finishData.new_items;
    if (session.filesModified.size > 0) entry.files = [...session.filesModified];

    appendMemoryEntry(this.registry.persistDir, session.agentName, entry);
  }

  /** Update request DB based on finish() completed_items and new_items.
   *  Marks matching pending requests as COMPLETED and tracks new items as
   *  self-assigned requests. Best-effort — never throws. */
  private async updateTodoFromFinish(session: ActiveSession): Promise<void> {
    try {
      const finishData = extractFinishParams(session.agent.state.messages);
      if (!finishData) return;

      const completed = finishData.completed_items;
      const newItems = finishData.new_items;
      if ((!completed || completed.length === 0) && (!newItems || newItems.length === 0)) return;

      const mod = await getRequestFns();
      if (!mod) return;

      const persistDir = this.registry.persistDir;

      // Mark completed items: fuzzy-match against pending requests for this agent
      if (completed && completed.length > 0) {
        try {
          const db = mod.getDb(persistDir);
          const pending = db
            .prepare(
              `SELECT requestId, task FROM requests
               WHERE toAgent = ? AND status IN ('CREATED', 'IN_PROGRESS') AND method = 'send'`,
            )
            .all(session.agentName) as { requestId: string; task: string }[];

          for (const item of completed) {
            const needle = item.trim().toLowerCase();
            let bestId: string | null = null;
            let bestScore = 0;
            for (const req of pending) {
              const reqText = req.task.toLowerCase();
              if (reqText.includes(needle) || needle.includes(reqText)) {
                const score = Math.min(reqText.length, needle.length) / Math.max(reqText.length, needle.length);
                if (score > bestScore) {
                  bestScore = score;
                  bestId = req.requestId;
                }
              }
            }
            if (bestId && bestScore > 0.3) {
              mod.updateRequest(persistDir, bestId, {
                status: "COMPLETED",
                summary: item,
                completedAt: Date.now(),
              });
            }
          }
        } catch {
          /* best-effort */
        }
      }

      // Track new self-assigned items as requests
      if (newItems && newItems.length > 0) {
        for (const item of newItems) {
          try {
            mod.trackRequest(persistDir, {
              fromEntity: session.agentName,
              toAgent: session.agentName,
              task: item,
              method: "send",
              sessionId: session.sessionId,
            });
          } catch {
            /* best-effort */
          }
        }
      }
    } catch {
      /* best-effort — todo update should never break session lifecycle */
    }
  }

  /** Archive a session after completion: move to history. */
  private archiveSessionDir(session: ActiveSession): void {
    try {
      cleanupStepCounter(session.sessionId);
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
   * Common completion handler — called when the agent's turn settles (prompt()/continue() resolves).
   *
   * finish() = turn complete. Session close = caller's decision (autoClose policy).
   *
   * Flow:
   *   1. Extract finish() params if present (status, summary, deliverables, etc.)
   *   2. Clear post-finish artifacts (abort errors from agent loop cleanup)
   *   3. Determine session next state:
   *      - autoClose "never" (chat): → idle, stay in activeSessions, await next input
   *      - autoClose "immediate" (job/call): → archive, fire onSessionComplete
   *   4. Fire hooks: memory, context-learn, request DB, escalation
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
    const finishParams = extractFinishParams(messages);
    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
    if (!session.agent.state.error && !session.error && lastMsg?.role === "user") {
      session.error = "Agent completed without producing a response (possible stream/API error)";
      session.agent.state.error = session.error;
    }

    // ── Detect empty assistant response ──────────────────────────────
    // Some models (especially via LiteLLM proxies) return stopReason="stop"
    // with empty content and 0 output tokens — effectively a silent no-op.
    // The agent finishes without error but produces no useful output.
    // Exception: if the agent called `finish`, the empty response after it
    // is normal (model has nothing left to say after structured completion).
    if (!session.agent.state.error && !session.error && lastMsg?.role === "assistant") {
      const content = Array.isArray(lastMsg.content) ? lastMsg.content : [];
      const hasSubstance = content.some(
        (block: any) => (block?.type === "text" && block.text?.trim()) || block?.type === "toolCall",
      );
      if (!hasSubstance && !hasFinishToolCall(messages)) {
        session.error =
          "Model returned an empty response (0 output tokens). This usually indicates a model/API issue — try again or switch models.";
        session.agent.state.error = session.error;
      }
    }

    // ── Determine outcome from agent state ─────────────────────────────
    const agentError = session.agent.state.error ?? session.error;
    const wasAborted = agentError?.includes("aborted") ?? false;

    // Set error field — but if finish was called successfully, don't treat
    // subsequent empty responses or transient model errors as session failures
    // (the agent completed its work; the model just had a post-finish hiccup,
    //  or we deliberately aborted after finish() to prevent re-invocation loops)
    if (
      agentError &&
      hasFinishToolCall(messages) &&
      (agentError.includes("empty response") ||
        agentError.includes("0 output tokens") ||
        agentError.includes("Unhandled stop reason") ||
        agentError.includes("OpBudgetExceeded") ||
        agentError.includes("aborted"))
    ) {
      session.error = undefined;
      session.agent.state.error = undefined;
    } else if (agentError) {
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

    // ── Final safety net: finish() clears post-finish errors ────────
    // Defense-in-depth: if the agent successfully called finish(), any
    // empty-response / 0-output-token / unhandled-stop-reason / abort error is
    // a post-finish artifact, not a real failure. Clear it.
    // This catches cases where the error was set by a code path that
    // the earlier checks didn't cover (including the deliberate abort
    // triggered by the finish-termination logic in manager-receipts.ts).
    if (session.error && hasFinishToolCall(messages)) {
      const e = session.error;
      if (
        e.includes("empty response") ||
        e.includes("0 output tokens") ||
        e.includes("Unhandled stop reason") ||
        e.includes("OpBudgetExceeded") ||
        e.includes("aborted")
      ) {
        session.error = undefined;
        session.agent.state.error = undefined;
      }
    }

    // ── Determine archive status, archive, remove ──────────────────────
    // Recompute wasAborted from session.error (not the stale agentError captured
    // before error-clearing). Post-finish aborts clear the error above, so
    // wasAborted should be false for chat sessions that completed via finish().
    const effectivelyAborted = session.error?.includes("aborted") ?? false;
    if (session.autoClose === "never" && !effectivelyAborted) {
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
    // Heartbeat sessions MUST read files (heartbeat.md, etc.).
    // If an agent completes a heartbeat with zero tool calls, it responded
    // from compacted context without actually checking anything — flag it.
    if (!wasAborted && !session.error && session.totalToolCalls === 0 && session.task.startsWith("[heartbeat]")) {
      session.error =
        "Shallow heartbeat: completed with zero tool calls. " +
        "Heartbeat sessions MUST use tools (read heartbeat.md, check health, etc.).";
      session.agent.state.error = session.error;
    }

    // Task sessions (or aborted interface sessions) → archive and remove
    // If finish() was called and the error was cleared (post-finish abort),
    // treat as "done" — the abort was just the session cleanup, not a failure.
    const archiveStatus: "done" | "error" | "interrupted" =
      wasAborted && session.error ? "interrupted" : session.error ? "error" : "done";
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

    // Apply context_updates from finish() to agents/<name>/context.md
    if (finishParams?.context_updates?.length) {
      try {
        this.applyContextUpdates(session.agentName, finishParams.context_updates);
      } catch {
        /* non-fatal */
      }
    }

    // Update request DB from finish() data (mark completed, track new items)
    this.updateTodoFromFinish(session);

    // Activity tracking: log session completion
    {
      const duration = formatDuration(session.endedAt! - session.startedAt);
      const lastText = session.agent.state.messages.filter((m: any) => m.role === "assistant").pop()?.content;
      const summaryText = Array.isArray(lastText)
        ? lastText
            .filter((b: any) => b.type === "text")
            .map((b: any) => b.text)
            .join(" ")
        : typeof lastText === "string"
          ? lastText
          : "";
      if (archiveStatus === "error") {
        appendActivity(
          this._projectRoot,
          {
            ts: Date.now(),
            event: "error",
            sid: session.sessionId,
            agent: session.agentName,
            turns: session.turnCount,
            duration,
            summary: truncateSummary(summaryText),
            error: truncateSummary(session.error),
          },
          this.getWorkspacePath(session.agentName),
        );
      } else {
        appendActivity(
          this._projectRoot,
          {
            ts: Date.now(),
            event: "done",
            sid: session.sessionId,
            agent: session.agentName,
            turns: session.turnCount,
            duration,
            summary: truncateSummary(summaryText),
            files: [...session.filesModified],
          },
          this.getWorkspacePath(session.agentName),
        );
      }
    }

    this.archiveSessionDir(session);
    this.activeSessions.delete(session.sessionId);

    // ── Update request status (unified request tracking) ───────────────
    if (session.requestId) {
      // Extract outcome summary from finish() data or last assistant text
      const summary = finishParams?.summary ?? extractLastAssistantText(messages) ?? undefined;

      getRequestFns().then((mod) => {
        if (!mod) return;
        try {
          const durationMs = session.endedAt ? session.endedAt - session.startedAt : undefined;
          mod.updateRequest(this.registry.persistDir, session.requestId!, {
            status: archiveStatus === "done" ? "COMPLETED" : "FAILED",
            sessionId: session.sessionId,
            summary: summary?.slice(0, 500),
            error: session.error ?? undefined,
            errorClass: session.error ? classifyErrorFn(session.error) : undefined,
            durationMs,
            completedAt: Date.now(),
          });
        } catch {
          /* non-fatal — don't block completion for request tracking */
        }
      });
    }

    // ── Update session outcome in DB ───────────────────────────────────
    {
      const outcome = finishParams?.summary ?? extractLastAssistantText(messages) ?? undefined;
      if (outcome) {
        try {
          const { updateSessionDb } = require("./requests.js") as typeof import("./requests.js");
          updateSessionDb(this.registry.persistDir, session.sessionId, {
            status: archiveStatus,
            endedAt: session.endedAt,
            error: session.error,
            outcome: outcome.slice(0, 500),
            opCount: session.opCount,
          });
        } catch {
          /* non-fatal */
        }
      }
    }

    // ── Auto-escalation: notify parent on blocked/failure (F5) ─────────
    // When a session ends with finish(blocked) or finish(failure), track an
    // escalation request to the parent agent (or fire onSessionBlocked for May).
    {
      if (finishParams && (finishParams.status === "blocked" || finishParams.status === "failure")) {
        const blockerText = finishParams.blockers?.map((b) => `${b.reason}: ${b.context}`).join("; ") ?? "";
        const escalationTask = `[escalation] ${session.agentName} session ${session.sessionId} ended ${finishParams.status}: ${finishParams.summary}${blockerText ? ` | Blockers: ${blockerText}` : ""}`;

        // Try parent agent first, fall back to onSessionBlocked (May)
        const parentName = session.parentAgentName;
        if (parentName) {
          getRequestFns().then((mod) => {
            if (!mod) return;
            try {
              mod.trackRequest(this.registry.persistDir, {
                fromEntity: session.agentName,
                toAgent: parentName,
                task: escalationTask,
                method: "send",
                sessionId: session.sessionId,
              });
            } catch {
              /* best-effort */
            }
          });
        }

        // Always fire onSessionBlocked so May can track it
        if (this.onSessionBlocked) {
          try {
            this.onSessionBlocked(
              session.agentName,
              session.sessionId,
              `${finishParams.status}: ${finishParams.summary}`,
            );
          } catch {
            /* best-effort */
          }
        }
      }
    }

    // ── Extract structured finish data (F2: Structured Result Passing) ──
    {
      if (finishParams) {
        session.finishResult = {
          status: finishParams.status as "success" | "failure" | "blocked" | "partial",
          summary: finishParams.summary,
          deliverables: finishParams.deliverables,
          blockers: finishParams.blockers,
          next_steps: finishParams.next_steps,
        };
      }
    }

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

    // Hot-reload mutable config (memoryLimit) from agent.json on disk.
    // Agent configs are loaded once at startup and cached. Without this, changes
    // to agent.json don't take effect until restart.
    const agentDir = def.knowledgeDir ? dirname(def.knowledgeDir) : def.workspace ? dirname(def.workspace) : undefined;
    if (agentDir) {
      try {
        const freshConfig = JSON.parse(readFileSync(join(agentDir, "agent.json"), "utf-8"));
        if (typeof freshConfig.memoryLimit === "number" && freshConfig.memoryLimit !== def.memoryLimit) {
          def.memoryLimit = freshConfig.memoryLimit;
        }
      } catch {
        /* best-effort — fall back to cached definition */
      }
    }

    const sessionId = opts?.sessionId ?? generateId(def.sessionIdPrefix);
    const persistDir = this.registry.persistDir;

    // Compute output directory
    const outputDir = sessionOutputDir(persistDir, sessionId);

    // Create session directory and output subdirectory for JSONL persistence
    ensureSessionDir(persistDir, sessionId);
    mkdirSync(outputDir, { recursive: true });

    const compactionTransform = this.buildTransformContext(def, opts?.compaction);

    // Inject sessionId and agentName into checkpoint tools (they're created
    // at registration time before these values are known)
    for (const tool of def.tools) {
      if (tool.name === "checkpoint") {
        if ((tool as any)._setSessionId) (tool as any)._setSessionId(sessionId);
        if ((tool as any)._setAgentName) (tool as any)._setAgentName(name);
      }
    }

    // Defensive: filter out tools with undefined parameters (prevents
    // "jsonSchema.properties" crash in Anthropic provider convertTools)
    const validTools = def.tools.filter((t) => {
      if (!t.parameters) {
        console.warn(`[manager] ⚠️ Tool "${t.name}" has undefined parameters — skipping to avoid provider crash`);
        return false;
      }
      return true;
    });

    const agent = new Agent({
      initialState: {
        systemPrompt: this.resolveSystemPrompt(def),
        model: def.model,
        tools: wrapToolsWithReceipts(validTools, sessionId, {
          activeSessions: this.activeSessions,
          persistDir: this.registry.persistDir,
          projectRoot: this._projectRoot,

          beforeToolCall: composeGuards(
            createEmptyArgsGuard(),
            createFinishGuard(),
            createReadDedupGuard(),
            createSessionReadGuard(),
            createScrapeDedupGuard(),
          ),
        }),
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
      originSessionId: opts?.originSessionId,
      workflowRunId: opts?.workflowRunId,
      stepLabel: opts?.stepLabel,
      turnCount: 0,
      compactionTransform,
      closed: false,
      autoClose: opts?.autoClose ?? "immediate",
      kind: opts?.kind ?? "job",
      opBudget: 0,
      opCount: 0,
      totalToolCalls: 0,
      infraRetryCount: 0,
      toolErrorHistory: new Map(),
      toolErrorCount: 0,
      turnBudgetWarningAt: def.turnBudgetWarningAt ?? TURN_BUDGET_WARNING_DEFAULT,
      turnBudgetWarned: false,
      filesModified: new Set(),
      orderId: opts?.orderId,
      requestId: opts?.requestId,
      consecutiveErrorTurns: 0,
      maxTurns: opts?.maxTurns ?? 0,
      stuckWarningInjected: false,
      currentTurnErrors: 0,
      currentTurnSuccesses: 0,
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
      orderId: session.orderId,
    });

    // Set up timeout if configured
    this.setupTimeout(session, def.timeoutMs);

    // Add to activeSessions before notifying listener (subscribe() needs it)
    this.activeSessions.set(sessionId, session);

    // Notify listener that a new session has started
    this.onSessionStart?.(name, sessionId);

    // Activity tracking: log session start
    appendActivity(
      this._projectRoot,
      {
        ts: Date.now(),
        event: "start",
        sid: sessionId,
        agent: name,
        task: truncateSummary(task, 500),
      },
      this.getWorkspacePath(name),
    );

    // The initial user message is persisted via the message_end subscriber
    // when agentLoop emits it (before any LLM call). No explicit write here
    // to avoid duplicate JSONL entries.

    // Prepend session context (session ID + task history) to the first user
    // message.  This keeps the system prompt stable across sessions so that
    // Anthropic prompt caching produces cache reads.
    const sessionContext = this.buildSessionContext(def, name, sessionId, persistDir);
    const promptText = `${sessionContext}\n\n---\n\n${task}`;

    session.promise = runAgentWithRetry(session, agent.prompt(promptText), this._infraRetryMax, (s) =>
      this.handleCompletion(s),
    );

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
        log(
          "warn",
          `[manager] Error scanning for crashed sessions: ${err instanceof Error ? err.message : String(err)}`,
        );
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
   * Archive zombie session directories that have terminal status in meta.json
   * but were never moved to history/. This happens when sessions are interrupted
   * by a process shutdown and archiveSession() was never called.
   *
   * Skips sessions that are currently active in memory (in the activeSessions map).
   * Returns the number of sessions archived.
   */
  cleanupZombieSessions(): number {
    const persistDir = this.registry.persistDir;
    const activeIds = listActiveSessionIds(persistDir);
    const terminalStatuses = new Set(["interrupted", "done", "error"]);
    let archived = 0;

    for (const sessionId of activeIds) {
      // Skip sessions that are currently active in memory
      if (this.activeSessions.has(sessionId)) continue;

      const meta = readSessionMeta(persistDir, sessionId);
      if (!meta) continue; // unreadable meta — skip

      if (terminalStatuses.has(meta.status)) {
        try {
          archiveSession(persistDir, sessionId);
          archived++;
        } catch {
          // best-effort — dir may already be gone or locked
        }
      } else if (meta.status === "running") {
        // Orphaned session: still "running" but not active in memory.
        // If stale >30min, mark as interrupted and archive.
        const staleThresholdMs = 30 * 60 * 1000;
        const lastActivity = meta.startedAt ?? 0;
        if (Date.now() - lastActivity > staleThresholdMs) {
          try {
            writeSessionMeta(persistDir, sessionId, { ...meta, status: "interrupted" });
            archiveSession(persistDir, sessionId);
            archived++;
          } catch {
            // best-effort
          }
        }
      }
    }

    return archived;
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

    // Inject sessionId and agentName into checkpoint tools (same as in run())
    for (const tool of def.tools) {
      if (tool.name === "checkpoint") {
        if ((tool as any)._setSessionId) (tool as any)._setSessionId(sessionId);
        if ((tool as any)._setAgentName) (tool as any)._setAgentName(def.name);
      }
    }

    // Defensive: filter out tools with undefined parameters (prevents
    // "jsonSchema.properties" crash in Anthropic provider convertTools)
    const validTools = def.tools.filter((t) => {
      if (!t.parameters) {
        console.warn(`[manager] ⚠️ Tool "${t.name}" has undefined parameters — skipping to avoid provider crash`);
        return false;
      }
      return true;
    });

    const agent = new Agent({
      initialState: {
        systemPrompt,
        model: def.model,
        tools: wrapToolsWithReceipts(validTools, sessionId, {
          activeSessions: this.activeSessions,
          persistDir: this.registry.persistDir,
          projectRoot: this._projectRoot,

          beforeToolCall: composeGuards(
            createEmptyArgsGuard(),
            createFinishGuard(),
            createReadDedupGuard(),
            createSessionReadGuard(),
            createScrapeDedupGuard(),
          ),
        }),
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
      opBudget: 0,
      opCount: persisted.opCount ?? 0,
      totalToolCalls: 0,
      infraRetryCount: 0,
      toolErrorHistory: new Map(),
      toolErrorCount: 0,
      turnBudgetWarningAt: def.turnBudgetWarningAt ?? TURN_BUDGET_WARNING_DEFAULT,
      turnBudgetWarned: false,
      filesModified: new Set(),
      orderId: persisted.orderId,
      consecutiveErrorTurns: 0,
      maxTurns: 0,
      stuckWarningInjected: false,
      currentTurnErrors: 0,
      currentTurnSuccesses: 0,
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
          ? "interrupted"
          : ((session.archiveStatus ?? session.status) as "done" | "error"),
      lastAssistantText: extractLastAssistantText(messages),
      messages: messages.slice(),
      duration: formatDuration((session.endedAt ?? Date.now()) - session.startedAt),
      outputDir: session.outputDir,
      error: session.error,
      turnsUsed: session.turnCount,
      instability: { retries, toolErrors, turns, verdict: tainted ? "tainted" : "clean" },
      finishResult: session.finishResult,
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
      status: persisted.status === "interrupted" ? "interrupted" : (persisted.status as "done" | "error"),
      lastAssistantText: extractLastAssistantText(messages),
      messages,
      duration,
      outputDir: sessionOutputDir(this.registry.persistDir, sessionId),
      error: persisted.error,
      finishResult: (() => {
        const fp = extractFinishParams(messages);
        if (!fp) return undefined;
        return {
          status: fp.status as "success" | "failure" | "blocked" | "partial",
          summary: fp.summary,
          deliverables: fp.deliverables,
          blockers: fp.blockers,
          next_steps: fp.next_steps,
        };
      })(),
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
      const p = runAgentWithRetry(session, session.agent.prompt(text), this._infraRetryMax, (s) =>
        this.handleCompletion(s),
      );

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
    // If finish() was already called, the agent completed gracefully — don't
    // overwrite with "interrupted". This prevents the cron-close race where a
    // new heartbeat fires shortly after finish() and stomps the status.
    const finishCalled = hasFinishToolCall(session.agent.state.messages);

    session.unsubscribe?.();
    session.endedAt = Date.now();
    session.status = "interrupted"; // in-memory type only allows running/interrupted/idle
    session.archiveStatus = finishCalled ? "done" : "interrupted";
    session.error = finishCalled ? undefined : "Closed";
    this.registry.updateSessionStatus(sessionId, finishCalled ? "done" : "interrupted", session.error);
    this.appendMemory(session);
    // If finish() was called, process completed_items/new_items before archiving
    if (finishCalled) {
      this.updateTodoFromFinish(session);
    }
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
  async auditHealth(opts?: AuditHealthOptions): Promise<AuditHealthReport> {
    return computeAuditHealth(this.healthContext(), opts);
  }

  /** Compare in-memory state vs filesystem and flag discrepancies. */
  async reconcileHealth(opts?: AuditHealthOptions): Promise<ReconcileReport> {
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

  /** Get a handoff summary for a session (for agents.context action). */
  getSessionSummary(sessionId: string): { task: string; summary: string; status: string } {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      try {
        const result = this.buildResultFromSession(session);
        const { summarizeForHandoff } = require("./handoff.js") as typeof import("./handoff.js");
        return {
          task: session.task,
          summary: summarizeForHandoff(result),
          status: session.status,
        };
      } catch {
        return { task: session.task, summary: "(session in progress)", status: session.status };
      }
    }
    // Try archived session
    try {
      const result = this.result(sessionId);
      const { summarizeForHandoff } = require("./handoff.js") as typeof import("./handoff.js");
      return {
        task: result.messages?.[0]?.content?.toString().slice(0, 200) ?? "",
        summary: summarizeForHandoff(result),
        status: result.status,
      };
    } catch {
      return { task: "", summary: "(session not found)", status: "unknown" };
    }
  }

  /** Get completed workflow steps (for agents.context scope: "workflow"). */
  getWorkflowSteps(workflowRunId: string): Array<{ step: string; sessionId: string; summary: string }> {
    const { readWorkflowRun } = require("./persistence.js") as typeof import("./persistence.js");
    const run = readWorkflowRun(this.registry.persistDir, workflowRunId);
    if (!run) return [];
    return run.steps.map((s) => ({
      step: s.agent,
      sessionId: s.sessionId,
      summary: `${s.status}: ${(s.lastAssistantText ?? "").slice(0, 300)}`,
    }));
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
   * Non-blocking agent run — starts an agent immediately and returns the session ID.
   * Used by the agents tool 'run' action. Thin wrapper around this.run().
   */
  runAgent(
    agentName: string,
    task: string,
    opts?: { parentSessionId?: string; source?: string; requestId?: string },
  ): string {
    return this.run(agentName, task, {
      parentSessionId: opts?.parentSessionId,
      source: opts?.source ?? "agents.run",
      kind: "job",
      requestId: opts?.requestId,
    });
  }

  /**
   * Create the V2 agents tool — 7 actions: call, send, run, list, peek, cancel, requests.
   *
   * Delegates to the standalone `createAgentsTool()` in `manager-agents-tool.ts`.
   * Kept as an instance method for backward compatibility with existing callers.
   */
  createAgentsTool(opts?: CreateAgentsToolOptions): AgentTool {
    // Cast needed: `agents` is private on SubagentManager but the extracted
    // function needs read access. The shape matches at runtime.
    return createAgentsToolFn(this as unknown as import("./manager-agents-tool.js").AgentsToolManagerDeps, opts);
  }

  /** Return a snapshot of all sessions tracked by the internal registry. */
  getRegistrySessions(): Record<string, any> {
    return this.registry.getRegistry();
  }
}
