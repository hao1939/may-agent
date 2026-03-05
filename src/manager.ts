import { readFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentMessage, AgentEvent, AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type, StringEnum } from "@mariozechner/pi-ai";
import type { SubagentDefinition, SessionInfo, TaskResult, SessionTreeNode } from "./types.js";
import { createCompactionTransform } from "./compaction.js";
import type { CompactionOptions } from "./compaction.js";
import { loadSkillsFromDirs, formatSkillsForPrompt } from "./skills.js";
import {
  RegistryStore,
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
} from "./persistence.js";
import type { MemoryEntry, WorkflowRun, PersistedSession, Registry } from "./persistence.js";
import type { TraceNode, SessionTrace } from "./workflow.js";
import { join, dirname } from "node:path";
import { isOverflowError, extractProgress, writeProgressFile } from "./overflow.js";
import { buildProjectStructure } from "./tools.js";

let nextId = 0;
/**
 * Generate a unique session ID.
 *
 * Format: `{prefix}_{timestamp}_{counter}` — e.g. `s_1700000000000_0`.
 *
 * @param prefix - String prefix for the ID (default: `"s"`).
 * @returns A unique ID string.
 */
export function generateId(prefix = "s"): string {
  return `${prefix}_${Date.now()}_${nextId++}`;
}

/**
 * Converts a duration in milliseconds to a human-readable string.
 *
 * Returns seconds only for durations under a minute (e.g. `"42s"`),
 * or minutes and seconds for longer durations (e.g. `"2m30s"`).
 *
 * @param ms - Duration in milliseconds.
 * @returns A formatted duration string such as `"42s"` or `"2m30s"`.
 */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m${remaining}s`;
}

function extractLastAssistantText(messages: AgentMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant") {
      for (const block of msg.content) {
        if (block.type === "text" && block.text.trim()) {
          return block.text;
        }
      }
    }
  }
  return null;
}

function formatMemoryTimestamp(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

/** Maximum characters for task/summary text in the system-prompt memory section.
 *  Full data is preserved in the JSONL — this only affects the prompt injection. */
const MEMORY_TASK_MAX = 200;
const MEMORY_SUMMARY_MAX = 500;

/** Truncate text to maxLen chars for prompt injection.
 *  Strips newlines (compact single-line) and appends "…" if truncated. */
export function truncateForPrompt(text: string, maxLen: number): string {
  // Collapse newlines to spaces for compact single-line display
  const oneLine = text.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLen) return oneLine;
  return oneLine.slice(0, maxLen) + "…";
}

interface RegisteredAgent {
  definition: SubagentDefinition;
}

interface ActiveSession {
  sessionId: string;
  agentName: string;
  agent: Agent;
  promise: Promise<void>;
  task: string;
  startedAt: number;
  endedAt?: number;
  status: "running" | "done" | "error" | "interrupted" | "idle";
  error?: string;
  outputDir: string;
  unsubscribe?: () => void;
  unsubscribeTurnLimit?: () => void;
  timeoutTimer?: ReturnType<typeof setTimeout>;
  parentSessionId?: string;
  workflowRunId?: string;
  stepLabel?: string;
  turnCount: number;
  maxTurns?: number;
  /** Threshold (0-1) at which to fire a turn budget warning. */
  turnWarningThreshold: number;
  /** Whether the turn warning has already been fired. */
  turnWarningFired: boolean;
  /** When true, session stays active after completion (transitions to "idle"). */
  persistent: boolean;
  /** Set by close() — prevents handleCompletion from acting on an already-archived session. */
  closed: boolean;
}

/** Options for spawning a session with parent/workflow context. */
export interface RunOptions {
  parentSessionId?: string;
  workflowRunId?: string;
  stepLabel?: string;
  /** Runtime override: make this session persistent (long-lived). */
  persistent?: boolean;
  /** Runtime override: enable compaction for this session. */
  compaction?: boolean | CompactionOptions;
  /** Message source tag for the initial task message. */
  source?: string;
}

export interface SubagentManagerOptions {
  persistDir: string;
  /**
   * Called after a non-persistent session completes (done/error/interrupted).
   * Fires after archival. Use for post-session tasks like evaluation.
   * NOT called for persistent sessions transitioning to "idle".
   */
  onSessionComplete?: (info: SessionInfo) => void;
  /**
   * Called when any new session starts (via run() or resumeAgent()).
   * Use to subscribe to agent events for UI streaming.
   * This is the single point where all session creation is observed.
   */
  onSessionStart?: (agentName: string, sessionId: string) => void;
}

// ── createTool() schema ────────────────────────────────────────────────
//
// Flat Type.Object instead of Type.Union so that all LLM providers
// (Anthropic, OpenAI, Google) see a well-formed JSON Schema with
// top-level `properties` and `required`.  The Anthropic provider in
// pi-ai reads `jsonSchema.properties` directly — a Union schema has
// `anyOf` instead, so the LLM would see zero parameters.
//
// Runtime validation of per-action required fields happens in execute().

const SubagentToolParams = Type.Object({
  action: StringEnum(
    ["list", "run", "status", "progress", "result", "cancel", "waitFor", "delegate", "trace"] as const,
    { description: "Action to perform. Use 'delegate' for fire-and-forget: runs agent, waits for completion, returns result in one call." },
  ),
  agent: Type.Optional(Type.String({ description: "Name of the registered agent (required for 'run', 'delegate')" })),
  task: Type.Optional(Type.String({ description: "Task description to send to the agent (required for 'run', 'delegate')" })),
  sessionId: Type.Optional(Type.String({ description: "Session ID or workflow run ID (required for 'status', 'progress', 'result', 'cancel', 'waitFor', 'trace')" })),
  limit: Type.Optional(Type.Number({ description: "Max number of recent messages to return (for 'progress', default: all)" })),
});

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

  constructor(opts: SubagentManagerOptions) {
    this.registry = new RegistryStore(opts.persistDir);
    this.onSessionComplete = opts.onSessionComplete;
    this.onSessionStart = opts.onSessionStart;
  }

  /** Register a feature unit. */
  register(def: SubagentDefinition): void {
    this.agents.set(def.name, { definition: def });
    this.registry.saveAgent(def);
  }

  /** Subscribe to message_end events and persist messages to session JSONL. */
  private subscribeForPersistence(session: ActiveSession): void {
    const persistDir = this.registry.persistDir;
    const { sessionId } = session;
    session.unsubscribe = session.agent.subscribe((event: AgentEvent) => {
      if (event.type === "message_end") {
        appendSessionMessage(persistDir, sessionId, event.message);
      }
    });
  }

  /** Subscribe to turn_end events, inject turn-budget warning, and enforce maxTurns limit. */
  private subscribeForTurnLimit(session: ActiveSession): void {
    if (!session.maxTurns || session.maxTurns <= 0) return;
    session.unsubscribeTurnLimit = session.agent.subscribe((event: AgentEvent) => {
      if (event.type === "turn_end") {
        session.turnCount++;

        // Inject a one-time warning when the agent crosses the warning threshold
        const warningTurn = Math.floor(session.maxTurns! * session.turnWarningThreshold);
        if (!session.turnWarningFired && warningTurn > 0 && session.turnCount >= warningTurn) {
          session.turnWarningFired = true;
          const remaining = session.maxTurns! - session.turnCount;
          session.agent.steer({
            role: "user",
            content: [{
              type: "text",
              text: `⚠️ TURN BUDGET WARNING: You have used ${session.turnCount} of ${session.maxTurns} turns. ` +
                `Only ${remaining} turns remain. Wrap up your current work, commit any changes if possible, ` +
                `and do not start new tasks. Summarize any remaining work that could not be completed.`,
            }],
            timestamp: Date.now(),
            source: "system",
          } as AgentMessage);
        }

        if (session.turnCount >= session.maxTurns!) {
          session.agent.abort();
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
   *  - If systemPrompt is set, use it directly.
   *  - If systemPromptFiles is set, read each file and concatenate with separator.
   *  - If knowledgeDir has a lessons.md, append it.
   *  - If persistDir exists and memoryLimit > 0, append recent memory entries.
   *  - Append workspace and output sections.
   */
  private resolveSystemPrompt(
    def: SubagentDefinition,
    agentName: string,
    sessionId: string,
    persistDir: string,
  ): string {
    if (def.systemPrompt) return def.systemPrompt;

    const sections: string[] = [];

    // Static environment FIRST — stable prefix for LLM cache hits (Principle 36)
    if (def.projectRoot) {
      const envLines = [`# Runtime Environment`, `- Project root (exec cwd): ${def.projectRoot}`];
      if (def.workspace) {
        envLines.push(`- Workspace: ${def.workspace}`);
      }
      envLines.push(``, `Use paths relative to project root. Do not guess or search for the root.`);
      sections.push(envLines.join("\n"));
    }

    // Identity — tells the agent who it is, what it can do, and what files it owns
    {
      const idLines = [
        `# Identity`,
        `- Name: ${def.name}`,
        `- Role: ${def.description}`,
        `- Domain: ${def.domain}`,
      ];
      // Tool names
      const toolNames = def.tools.map((t) => t.name);
      if (toolNames.length > 0) {
        idLines.push(`- Tools: ${toolNames.join(", ")}`);
      }
      // Workspace file listing (auto-discovered)
      if (def.workspace && existsSync(def.workspace)) {
        try {
          const wsFiles = readdirSync(def.workspace, { withFileTypes: true })
            .filter((e) => e.isFile())
            .map((e) => e.name)
            .sort();
          if (wsFiles.length > 0) {
            idLines.push(`- Workspace files: ${wsFiles.join(", ")}`);
          }
        } catch { /* best-effort — workspace may not be readable */ }
      }
      sections.push(idLines.join("\n"));
    }

    // Project structure — eliminates find/ls discovery calls
    if (def.projectRoot && def.projectStructure !== false) {
      const depth = typeof def.projectStructure === "number" ? def.projectStructure : 2;
      const structure = buildProjectStructure(def.projectRoot, depth);
      if (structure) {
        sections.push(`# Project Structure\n\`\`\`\n${structure}\n\`\`\``);
      }
    }
    // Load systemPromptFiles
    if (def.systemPromptFiles && def.systemPromptFiles.length > 0) {
      const fileContents = def.systemPromptFiles.map((filePath) =>
        readFileSync(filePath, "utf-8"),
      );
      sections.push(fileContents.join("\n\n---\n\n"));
    }

    // Auto-load lessons.md from knowledgeDir if it exists
    if (def.knowledgeDir) {
      const lessonsPath = join(def.knowledgeDir, "lessons.md");
      if (existsSync(lessonsPath)) {
        const lessons = readFileSync(lessonsPath, "utf-8").trim();
        if (lessons) {
          sections.push(lessons);
        }
      }
    }

    // Load skills from per-agent skills/ dir + shared skillsDirs
    {
      const skillDirs: string[] = [];
      if (def.knowledgeDir) {
        const agentDir = dirname(def.knowledgeDir);
        skillDirs.push(join(agentDir, "skills"));
      }
      if (def.skillsDirs) {
        skillDirs.push(...def.skillsDirs);
      }
      if (skillDirs.length > 0) {
        const skills = loadSkillsFromDirs(skillDirs);
        const block = formatSkillsForPrompt(skills);
        if (block) {
          sections.push(block);
        }
      }
    }

    // Session context (volatile) — placed after stable content for cache efficiency
    sections.push(`# Session Context\n- Session ID: ${sessionId}`);

    // Load memory entries
    const memoryLimit = def.memoryLimit ?? 20;
    if (memoryLimit > 0) {
      const entries = readMemoryEntries(persistDir, agentName, memoryLimit);
      if (entries.length > 0) {
        const lines = entries.map((e) => {
          const ts = formatMemoryTimestamp(e.timestamp);
          const taskText = truncateForPrompt(e.task, MEMORY_TASK_MAX);
          const summary = e.summary ? ` — ${truncateForPrompt(e.summary, MEMORY_SUMMARY_MAX)}` : "";
          return `- ${ts}: "${taskText}" — ${e.status} (${e.duration})${summary}`;
        });
        sections.push(`# Recent Task History\n${lines.join("\n")}`);
      }
    }

    // Workspace section
    if (def.workspace) {
      sections.push(
        `# Workspace\nYour persistent workspace is: ${def.workspace}\nUse this for working files, scripts, and data that persist across tasks.`,
      );
    }

    // Output section
    const outputPath = sessionOutputDir(persistDir, sessionId);
    sections.push(
      `# Output\nWrite deliverables for this task to: ${outputPath}`,
    );

    // Turn budget section (if maxTurns is set)
    if (def.maxTurns && def.maxTurns > 0) {
      sections.push(
        `# Turn Budget\nYou have a maximum of ${def.maxTurns} turns for this session. ` +
        `Plan your work to complete within this budget. If you are running low, ` +
        `prioritize completing the most important part and summarize remaining work.`,
      );
    }

    return sections.join("\n\n");
  }

  /** Append a memory entry after session completion. */
  private appendMemory(session: ActiveSession): void {
    const messages = session.agent.state.messages;
    const endTime = session.endedAt ?? Date.now();
    const entry: MemoryEntry = {
      task: session.task,
      status: session.status,
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
   * Determines the outcome from agent state, then branches:
   *   - Persistent sessions → idle (stays in activeSessions)
   *   - Non-persistent sessions → terminal status (done/error/interrupted) → archive + remove
   *
   * See docs/session-state-machine.md for the full state machine.
   */
  private handleCompletion(session: ActiveSession): void {
    this.clearTimeout(session);

    // Guard: if close() already archived this session, skip.
    if (session.closed) return;

    // ── Determine outcome from agent state ─────────────────────────────
    const agentError = session.agent.state.error ?? session.error;
    const wasAborted = agentError?.includes("aborted") ?? false;
    const wasTurnLimit = !!(session.maxTurns && session.turnCount >= session.maxTurns);

    // Set error field (turn-limit overrides the generic abort message)
    if (wasTurnLimit) {
      session.error = `Turn limit reached (${session.turnCount}/${session.maxTurns} turns)`;
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
        } catch { /* best-effort */ }
      }
    }

    // ── Persistent: always transition to idle ──────────────────────────
    if (session.persistent) {
      // Persist cancellation notice so agent doesn't retry on resume/wake.
      // Written to JSONL (survives restart) and queued as followUp (in-process wake).
      if (wasAborted && !wasTurnLimit) {
        const cancelMsg: AgentMessage = {
          role: "user",
          content: [{ type: "text", text: "[Task cancelled by user. Do not retry the cancelled task. Wait for new instructions.]" }],
          timestamp: Date.now(),
          source: "system",
        } as AgentMessage;
        // Queued as followUp — persisted via the message_end subscriber when
        // the agent loop processes it on next wake. No explicit write here
        // to avoid duplicate JSONL entries.
        session.agent.followUp(cancelMsg);
      }
      session.status = "idle";
      this.registry.updateSessionStatus(session.sessionId, "idle");
      return;
    }

    // ── Non-persistent: set terminal status, archive, remove ───────────
    if (wasAborted) {
      session.status = "interrupted";
    } else if (session.error) {
      session.status = "error";
    } else {
      session.status = "done";
    }
    this.registry.updateSessionStatus(session.sessionId, session.status, session.error);

    session.unsubscribe?.();
    session.unsubscribeTurnLimit?.();
    session.endedAt = Date.now();

    this.appendMemory(session);
    this.archiveSessionDir(session);
    this.activeSessions.delete(session.sessionId);

    if (this.onSessionComplete) {
      const info: SessionInfo = {
        sessionId: session.sessionId,
        agent: session.agentName,
        task: session.task,
        status: session.status as "done" | "error" | "interrupted",
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        runtime: formatDuration(session.endedAt - session.startedAt),
        outputDir: session.outputDir,
        error: session.error,
        parentSessionId: session.parentSessionId,
        workflowRunId: session.workflowRunId,
        stepLabel: session.stepLabel,
      };
      try { this.onSessionComplete(info); } catch { /* best-effort */ }
    }
  }

  /** Start a new session for a registered agent. Returns sessionId. Non-blocking.
   *  Optionally pass RunOptions to link this session into a session graph.
   */
  run(name: string, task: string, opts?: RunOptions): string {
    const registered = this.agents.get(name);
    if (!registered) throw new Error(`Agent "${name}" not registered`);

    const def = registered.definition;
    const sessionId = generateId(def.sessionIdPrefix);
    const persistDir = this.registry.persistDir;

    // Compute output directory
    const outputDir = sessionOutputDir(persistDir, sessionId);

    // Create session directory and output subdirectory for JSONL persistence
    ensureSessionDir(persistDir, sessionId);
    mkdirSync(outputDir, { recursive: true });

    const agent = new Agent({
      initialState: {
        systemPrompt: this.resolveSystemPrompt(def, name, sessionId, persistDir),
        model: def.model,
        tools: def.tools,
      },
      transformContext: this.buildTransformContext(def, opts?.compaction),
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
      workflowRunId: opts?.workflowRunId,
      stepLabel: opts?.stepLabel,
      turnCount: 0,
      maxTurns: def.maxTurns,
      turnWarningThreshold: def.turnWarningThreshold ?? 0.8,
      turnWarningFired: false,
      persistent: opts?.persistent ?? def.persistent ?? false,
      closed: false,
    };

    // Subscribe for JSONL persistence before starting the prompt
    this.subscribeForPersistence(session);

    // Subscribe for turn limit enforcement
    this.subscribeForTurnLimit(session);

    // Persist the new session to registry
    this.registry.saveSession(sessionId, {
      agent: name,
      task,
      status: "running",
      startedAt: session.startedAt,
      parentSessionId: opts?.parentSessionId,
      workflowRunId: opts?.workflowRunId,
      stepLabel: opts?.stepLabel,
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

    session.promise = agent.prompt(task)
      .then(() => {
        this.handleCompletion(session);
      })
      .catch((err) => {
        session.error = err?.message ?? String(err);
        this.handleCompletion(session);
      });

    this.sessionResults.set(sessionId, session.promise.then(() => this.buildResultFromSession(session)));
    return sessionId;
  }

  /** Mark any workflow runs stuck at "running" as "interrupted".
   *  Called during startup cleanup (both cleanupStaleSessions and resumeAgent). */
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
   * Clean up sessions left in "running" state from a previous process.
   * Marks them as "interrupted" and returns a summary.
   * Also cleans up stale workflow runs.
   */
  cleanupStaleSessions(): SessionInfo[] {
    const registryData = this.registry.getRegistry();
    const cleaned: SessionInfo[] = [];

    for (const [sessionId, persisted] of Object.entries(registryData.sessions)) {
      if (persisted.status !== "running" && persisted.status !== "idle") continue;

      this.registry.updateSessionStatus(sessionId, "interrupted", "Process restarted");

      cleaned.push({
        sessionId,
        agent: persisted.agent,
        task: persisted.task,
        status: "interrupted",
        startedAt: persisted.startedAt,
        endedAt: Date.now(),
        runtime: formatDuration(Date.now() - persisted.startedAt),
        outputDir: sessionOutputDir(this.registry.persistDir, sessionId),
        error: "Process restarted",
      });
    }

    this.cleanupStaleWorkflowRuns();
    return cleaned;
  }

  /**
   * Resume a specific agent's most recent session from a previous process.
   * All other "running" sessions are marked as interrupted.
   *
   * Returns the resumed session info (with the agent running), plus a list
   * of interrupted sessions so the caller can inform the resumed agent.
   *
   * Returns null if the agent has no "running" or "idle" session to resume.
   */
  resumeAgent(agentName: string, opts?: { persistent?: boolean; compaction?: boolean | CompactionOptions }): { resumed: SessionInfo; interrupted: SessionInfo[] } {
    const registryData = this.registry.getRegistry();
    const persistDir = this.registry.persistDir;

    // Find all running/idle sessions, separate the target agent from the rest
    let targetSessionId: string | null = null;
    let targetPersisted: (typeof registryData.sessions)[string] | null = null;
    const otherRunning: Array<{ sessionId: string; persisted: (typeof registryData.sessions)[string] }> = [];

    for (const [sessionId, persisted] of Object.entries(registryData.sessions)) {
      if (persisted.status !== "running" && persisted.status !== "idle") continue;
      if (persisted.agent === agentName && !targetSessionId) {
        targetSessionId = sessionId;
        targetPersisted = persisted;
      } else {
        otherRunning.push({ sessionId, persisted });
      }
    }

    if (!targetSessionId || !targetPersisted) {
      // No running session for this agent — don't touch other sessions
      this.cleanupStaleWorkflowRuns();
      throw new Error(`No running/idle session for "${agentName}" in registry`);
    }

    // Find matching registered agent
    const registered = this.agents.get(agentName);
    if (!registered) {
      this.registry.updateSessionStatus(targetSessionId, "interrupted", "Agent not registered");
      this.cleanupStaleWorkflowRuns();
      throw new Error(`Agent "${agentName}" has session "${targetSessionId}" in registry but is not registered in this process`);
    }

    // Target found and registered — now interrupt other running sessions
    const interrupted: SessionInfo[] = [];
    for (const { sessionId, persisted } of otherRunning) {
      this.registry.updateSessionStatus(sessionId, "interrupted", "Process restarted");
      interrupted.push({
        sessionId,
        agent: persisted.agent,
        task: persisted.task,
        status: "interrupted",
        startedAt: persisted.startedAt,
        endedAt: Date.now(),
        runtime: formatDuration(Date.now() - persisted.startedAt),
        outputDir: sessionOutputDir(persistDir, sessionId),
        error: "Process restarted",
      });
    }

    const def = registered.definition;
    // Restore session JSONL from history archive if it was archived by a previous process
    ensureSessionDir(persistDir, targetSessionId);
    restoreSessionFromArchive(persistDir, targetSessionId);
    const savedMessages = readSessionMessages(persistDir, targetSessionId);
    const systemPrompt = this.resolveSystemPrompt(def, agentName, targetSessionId, persistDir);
    const outputDir = sessionOutputDir(persistDir, targetSessionId);

    const agent = new Agent({
      initialState: {
        systemPrompt,
        model: def.model,
        tools: def.tools,
        messages: savedMessages,
      },
      transformContext: this.buildTransformContext(def, opts?.compaction),
      getApiKey: def.apiKey ? () => def.apiKey : undefined,
    });

    // Build restart message with interrupted sub-agent context
    const interruptedSummary = interrupted.length > 0
      ? `\n\nInterrupted sub-agent sessions from previous run:\n` +
        interrupted.map((s) => `- ${s.agent} (${s.sessionId}): "${s.task.slice(0, 100)}"`).join("\n") +
        `\n\nThese sessions are no longer running. Re-delegate if the work is still needed.`
      : "";

    const resumeMessage: AgentMessage = {
      role: "user",
      content: [{
        type: "text",
        text: `Process restarted. Your session has been restored with your previous conversation history. Continue where you left off.${interruptedSummary}`,
      }],
      timestamp: Date.now(),
      source: "system",
    } as AgentMessage;

    // Repair broken message sequences before resuming.
    // If the process died mid-tool-execution, the last assistant message has
    // tool calls with no corresponding tool results. Inject synthetic error
    // results so the conversation is well-formed for the LLM API.
    const lastMsg = savedMessages.length > 0 ? savedMessages[savedMessages.length - 1] : null;
    const lastRole = lastMsg?.role;
    if (lastRole === "assistant" && lastMsg && Array.isArray(lastMsg.content)) {
      const toolCalls = (lastMsg.content as any[]).filter(
        (b: any) => b.type === "toolCall",
      );
      if (toolCalls.length > 0) {
        // Inject error tool results for each pending tool call
        for (const tc of toolCalls) {
          const errorResult: AgentMessage = {
            role: "toolResult",
            toolCallId: (tc as any).id,
            toolName: (tc as any).name,
            content: [{ type: "text", text: "Error: process restarted while this tool call was in progress." }],
            isError: true,
            timestamp: Date.now(),
          } as AgentMessage;
          agent.followUp(errorResult);
        }
      }
    }

    this.registry.updateSessionStatus(targetSessionId, "running");

    const session: ActiveSession = {
      sessionId: targetSessionId,
      agentName,
      agent,
      promise: null!,
      task: targetPersisted.task,
      startedAt: targetPersisted.startedAt,
      status: "running",
      outputDir,
      turnCount: savedMessages.filter((m) => m.role === "assistant").length,
      maxTurns: def.maxTurns,
      turnWarningThreshold: def.turnWarningThreshold ?? 0.8,
      turnWarningFired: false,
      persistent: opts?.persistent ?? def.persistent ?? false,
      closed: false,
    };

    this.subscribeForPersistence(session);
    this.subscribeForTurnLimit(session);
    this.setupTimeout(session, def.timeoutMs);

    // Add to activeSessions before notifying listener (subscribe() needs it)
    this.activeSessions.set(targetSessionId, session);

    // Notify listener that a session has been resumed
    this.onSessionStart?.(agentName, targetSessionId);

    // Decide how to resume based on the last message:
    // - If last message is "user", there's already a pending prompt → use continue()
    // - Otherwise, inject the resume message → use prompt()
    const sid = targetSessionId;
    const startPromise = lastRole === "user"
      ? agent.continue()
      : agent.prompt(resumeMessage);

    session.promise = startPromise
      .then(() => {
        this.handleCompletion(session);
      })
      .catch((err) => {
        session.error = err?.message ?? String(err);
        this.handleCompletion(session);
      });

    this.sessionResults.set(targetSessionId, session.promise.then(() => this.buildResultFromSession(session)));

    const resumedInfo: SessionInfo = {
      sessionId: targetSessionId,
      agent: agentName,
      task: targetPersisted.task,
      status: "running",
      startedAt: targetPersisted.startedAt,
      runtime: formatDuration(Date.now() - targetPersisted.startedAt),
      outputDir,
    };

    this.cleanupStaleWorkflowRuns();
    return { resumed: resumedInfo, interrupted };
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
   *  Throws if session not found, still running, or idle (persistent).
   */
  result(sessionId: string): TaskResult {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      if (session.status === "running") {
        throw new Error(`Session "${sessionId}" is still running`);
      }
      if (session.status === "idle") {
        throw new Error(`Session "${sessionId}" is idle (persistent) — use progress() to read messages`);
      }
      return this.buildResultFromSession(session);
    }
    // Not active — check registry for completed session
    return this.resultFromArchive(sessionId);
  }

  /** Build a TaskResult from an ActiveSession object (which may have been removed from the map). */
  private buildResultFromSession(session: ActiveSession): TaskResult {
    const messages = session.agent.state.messages;
    return {
      sessionId: session.sessionId,
      status: session.status === "interrupted" ? "error" : session.status as "done" | "error",
      lastAssistantText: extractLastAssistantText(messages),
      messages: messages.slice(),
      duration: formatDuration((session.endedAt ?? Date.now()) - session.startedAt),
      outputDir: session.outputDir,
      error: session.error,
      turnsUsed: session.turnCount,
      maxTurns: session.maxTurns,
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
      status: persisted.status === "interrupted" ? "error" : persisted.status as "done" | "error",
      lastAssistantText: extractLastAssistantText(messages),
      messages,
      duration,
      outputDir: sessionOutputDir(this.registry.persistDir, sessionId),
      error: persisted.error,
    };
  }

  /**
   * Cancel a running session and all its children (cascading).
   * No-op if session not found, already terminal, or idle+persistent (nothing to cancel).
   * See docs/session-state-machine.md.
   */
  cancel(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    if (session.status !== "running" && session.status !== "idle") return;

    // Cancel children first (depth-first)
    for (const child of this.activeSessions.values()) {
      if (child.parentSessionId === sessionId && (child.status === "running" || child.status === "idle")) {
        this.cancel(child.sessionId);
      }
    }

    if (session.status === "idle") {
      if (session.persistent) {
        // Persistent + idle: no-op — nothing is running. Use close() to destroy.
        return;
      }
      // Non-persistent + idle: shouldn't normally happen, but clean up.
      session.status = "interrupted";
      session.error = "Cancelled";
      this.registry.updateSessionStatus(sessionId, "interrupted", "Cancelled");
      session.unsubscribe?.();
      session.unsubscribeTurnLimit?.();
      session.endedAt = Date.now();
      this.appendMemory(session);
      this.archiveSessionDir(session);
      this.activeSessions.delete(sessionId);
      return;
    }

    // Running — abort the agent loop. handleCompletion fires when the promise settles.
    session.agent.abort();
  }

  /**
   * Permanently close a session — archive to disk and remove from memory.
   *
   * If the session is running, cancels it first (cascading children).
   * Unlike cancel(), this always archives — even for persistent sessions.
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

    // If already removed (non-persistent idle was archived by cancel), done.
    if (!this.activeSessions.has(sessionId)) return;

    // Still here — archive and remove.
    session.unsubscribe?.();
    session.unsubscribeTurnLimit?.();
    session.endedAt = Date.now();
    session.status = "interrupted";
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
   * Inject a non-interrupting message into a session.
   *
   * Unlike steer(), this never interrupts mid-turn — the message is queued
   * via agent.followUp() and delivered at the next natural turn boundary.
   *
   * If the session is idle (persistent), wakes it: queues the message,
   * calls continue(), and wires handleCompletion. Does NOT wait for
   * processing to finish — returns immediately after queueing.
   *
   * Use for automated event injection (socket_watch, coaching events, etc.)
   * where the caller doesn't need to wait for a response.
   *
   * Throws if session not found or in a terminal state.
   */
  followUp(sessionId: string, message: string, source?: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }
    if (session.status !== "running" && session.status !== "idle") {
      throw new Error(`Session "${sessionId}" is in terminal state: ${session.status}`);
    }

    const msg: AgentMessage = {
      role: "user",
      content: [{ type: "text", text: message }],
      timestamp: Date.now(),
      ...(source ? { source } : {}),
    };

    session.agent.followUp(msg);
    // Message is persisted via the message_end subscriber when the agent
    // loop processes it. No explicit appendSessionMessage here to avoid
    // duplicate JSONL entries.

    // If idle persistent session, wake it up
    if (session.status === "idle" && session.persistent) {
      session.status = "running";
      this.registry.updateSessionStatus(sessionId, "running");

      session.promise = session.agent.continue()
        .then(() => {
          this.handleCompletion(session);
        })
        .catch((err) => {
          session.error = err?.message ?? String(err);
          this.handleCompletion(session);
        });
    }
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
   *  Note: for persistent sessions, this resolves after the first processing cycle
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
   * Wait for a persistent session's current processing to finish (transition to "idle").
   * Resolves immediately if the session is already idle.
   * For non-persistent sessions, waits for completion like waitFor().
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

  // ── Session graph: trace ─────────────────────────────────────────────

  /** Build a session trace from any session or workflow run ID.
   *  Walks parent pointers up to the root, loads workflow run records,
   *  and builds a tree showing the position of the target in the graph.
   */
  trace(targetId: string): SessionTrace | null {
    const persistDir = this.registry.persistDir;
    const registryData = this.registry.getRegistry();

    // Check if targetId is a workflow run
    const targetRun = readWorkflowRun(persistDir, targetId);
    if (targetRun) {
      return this.buildTraceFromWorkflowRun(targetRun, targetId, persistDir, registryData);
    }

    // Check if targetId is a session
    const persistedSession = registryData.sessions[targetId];
    const activeSession = this.activeSessions.get(targetId);
    if (persistedSession || activeSession) {
      const sessionData: PersistedSession = persistedSession ?? {
        agent: activeSession!.agentName,
        task: activeSession!.task,
        status: activeSession!.status,
        startedAt: activeSession!.startedAt,
        parentSessionId: activeSession!.parentSessionId,
        workflowRunId: activeSession!.workflowRunId,
        stepLabel: activeSession!.stepLabel,
      };
      return this.buildTraceFromSession(targetId, sessionData, targetId, persistDir, registryData);
    }

    return null;
  }

  private buildTraceFromSession(
    sessionId: string,
    session: PersistedSession,
    targetId: string,
    persistDir: string,
    registryData: Registry,
  ): SessionTrace {
    // If this session belongs to a workflow run, build from the workflow
    if (session.workflowRunId) {
      const run = readWorkflowRun(persistDir, session.workflowRunId);
      if (run) {
        return this.buildTraceFromWorkflowRun(run, targetId, persistDir, registryData);
      }
    }

    // Standalone session — just return it as a single node
    const node: TraceNode = {
      type: "session",
      id: sessionId,
      label: session.stepLabel ?? ("agent" in session ? session.agent : "unknown"),
      status: session.status,
      task: session.task,
      depth: 0,
      isTarget: sessionId === targetId,
      children: [],
    };

    return {
      targetId,
      path: [`${sessionId}/${node.label}`],
      tree: node,
    };
  }

  private buildTraceFromWorkflowRun(
    run: WorkflowRun,
    targetId: string,
    persistDir: string,
    registryData: Registry,
  ): SessionTrace {
    // Walk up the parent chain to find the root workflow
    const chain: WorkflowRun[] = [run];
    let current = run;
    while (current.parentWorkflowRunId) {
      const parent = readWorkflowRun(persistDir, current.parentWorkflowRunId);
      if (!parent) break;
      chain.unshift(parent);
      current = parent;
    }

    // The root is chain[0]. Build the tree from the root.
    const rootRun = chain[0];

    // Build the root's parent session node (May's session)
    const parentSession = registryData.sessions[rootRun.parentSessionId];
    const rootNode: TraceNode = {
      type: "session",
      id: rootRun.parentSessionId,
      label: parentSession?.agent ?? "caller",
      status: parentSession?.status ?? "unknown",
      task: parentSession?.task ?? "(unknown)",
      depth: 0,
      isTarget: rootRun.parentSessionId === targetId,
      children: [],
    };

    // Build workflow tree recursively
    const wfNode = this.buildWorkflowNode(rootRun, targetId, persistDir, registryData);
    rootNode.children.push(wfNode);

    // Build path from root to target
    const path = this.findPathToTarget(rootNode, targetId);

    return { targetId, path, tree: rootNode };
  }

  private buildWorkflowNode(
    run: WorkflowRun,
    targetId: string,
    persistDir: string,
    registryData: Registry,
  ): TraceNode {
    const node: TraceNode = {
      type: "workflow",
      id: run.runId,
      label: run.workflow,
      status: run.status,
      task: run.task,
      depth: run.depth,
      isTarget: run.runId === targetId,
      children: [],
    };

    // Add steps as children
    for (const step of run.steps) {
      const stepNode: TraceNode = {
        type: "session",
        id: step.sessionId,
        label: step.agent,
        status: step.status,
        task: step.task,
        depth: run.depth,
        isTarget: step.sessionId === targetId,
        children: [],
      };
      node.children.push(stepNode);
    }

    // Find sub-workflow runs (children of this run)
    const allRunIds = listWorkflowRuns(persistDir);
    for (const runId of allRunIds) {
      if (runId === run.runId) continue;
      const subRun = readWorkflowRun(persistDir, runId);
      if (subRun && subRun.parentWorkflowRunId === run.runId) {
        // Insert the sub-workflow node at the right position
        // (after the last step that started before the sub-workflow)
        const subNode = this.buildWorkflowNode(subRun, targetId, persistDir, registryData);
        // Find insertion point: after the last step whose sessionId
        // appears in run.steps before the sub-workflow's first step
        let insertIdx = node.children.length;
        if (subRun.steps.length > 0) {
          const firstSubStepId = subRun.steps[0].sessionId;
          for (let i = 0; i < node.children.length; i++) {
            if (node.children[i].id === firstSubStepId) {
              insertIdx = i;
              break;
            }
          }
        }
        node.children.splice(insertIdx, 0, subNode);
      }
    }

    return node;
  }

  private findPathToTarget(node: TraceNode, targetId: string): string[] {
    if (node.id === targetId) {
      return [`${node.id}/${node.label}`];
    }
    for (const child of node.children) {
      const childPath = this.findPathToTarget(child, targetId);
      if (childPath.length > 0) {
        return [`${node.id}/${node.label}`, ...childPath];
      }
    }
    return [];
  }

  // ── Parent agent tool ────────────────────────────────────────────────

  /** Create an AgentTool that exposes sub-agent management to a parent agent. */
  createTool(opts?: {
    onSessionStart?: (agent: string, sessionId: string) => void;
    /** Returns the current caller's session ID for parent→child linking. */
    getCallerSessionId?: () => string | undefined;
    /** Agent names that cannot be delegated to directly. Returns error with hint message. */
    delegateDeny?: { agents: string[]; hint: string };
  }): AgentTool<typeof SubagentToolParams> {
    const manager = this;
    const onSessionStart = opts?.onSessionStart;
    const getCallerSessionId = opts?.getCallerSessionId;
    const delegateDeny = opts?.delegateDeny;

    function textResult(text: string): AgentToolResult<string> {
      return {
        content: [{ type: "text", text }],
        details: text,
      };
    }

    return {
      name: "subagents",
      label: "Sub-Agents",
      description:
        "Manage sub-agents: list registered agents, run tasks, check status/progress, get results, or cancel sessions.",
      parameters: SubagentToolParams,
      execute: async (_toolCallId, params) => {
        try {
          switch (params.action) {
            case "list": {
              const agents = Array.from(manager.agents.values()).map((a) => {
                const def = a.definition;
                return {
                  name: def.name,
                  description: def.description,
                  domain: def.domain,
                  sessions: manager.sessions(def.name),
                };
              });
              return textResult(JSON.stringify(agents, null, 2));
            }

            case "run": {
              if (!params.agent || !params.task) {
                return textResult(JSON.stringify({ error: "action 'run' requires 'agent' and 'task'" }));
              }
              if (delegateDeny && delegateDeny.agents.includes(params.agent)) {
                return textResult(JSON.stringify({ error: `Cannot delegate directly to "${params.agent}". ${delegateDeny.hint}` }));
              }
              const parentSid = getCallerSessionId?.();
              const sessionId = manager.run(params.agent, params.task, { ...(parentSid ? { parentSessionId: parentSid } : {}), source: "agent" });
              onSessionStart?.(params.agent, sessionId);
              return textResult(JSON.stringify({ sessionId }));
            }

            case "status": {
              if (!params.sessionId) {
                return textResult(JSON.stringify({ error: "action 'status' requires 'sessionId'" }));
              }
              // Check active sessions first
              const allSessions = manager.status();
              const session = allSessions.find((s) => s.sessionId === params.sessionId);
              if (session) {
                return textResult(JSON.stringify(session, null, 2));
              }
              // Fall back to registry for completed/archived sessions
              const persisted = manager.registry.getSession(params.sessionId);
              if (persisted) {
                const endedAt = persisted.endedAt ?? Date.now();
                const info: SessionInfo = {
                  sessionId: params.sessionId,
                  agent: persisted.agent,
                  task: persisted.task,
                  status: persisted.status,
                  startedAt: persisted.startedAt,
                  endedAt: persisted.endedAt,
                  runtime: formatDuration(endedAt - persisted.startedAt),
                  outputDir: sessionOutputDir(manager.registry.persistDir, params.sessionId),
                  error: persisted.error,
                  parentSessionId: persisted.parentSessionId,
                  workflowRunId: persisted.workflowRunId,
                  stepLabel: persisted.stepLabel,
                };
                return textResult(JSON.stringify(info, null, 2));
              }
              return textResult(JSON.stringify({ error: `Session "${params.sessionId}" not found` }));
            }

            case "progress": {
              if (!params.sessionId) {
                return textResult(JSON.stringify({ error: "action 'progress' requires 'sessionId'" }));
              }
              const messages = manager.progress(params.sessionId, params.limit);
              // Return a simplified view of messages for the parent agent
              const simplified = messages.map((m) => ({
                role: m.role,
                content: m.content,
              }));
              return textResult(JSON.stringify(simplified, null, 2));
            }

            case "result": {
              if (!params.sessionId) {
                return textResult(JSON.stringify({ error: "action 'result' requires 'sessionId'" }));
              }
              const taskResult = manager.result(params.sessionId);
              // Return result without the full messages array (too large for tool output)
              const { messages: _msgs, ...resultWithoutMessages } = taskResult;
              return textResult(JSON.stringify(resultWithoutMessages, null, 2));
            }

            case "cancel": {
              if (!params.sessionId) {
                return textResult(JSON.stringify({ error: "action 'cancel' requires 'sessionId'" }));
              }
              manager.cancel(params.sessionId);
              return textResult(JSON.stringify({ cancelled: params.sessionId }));
            }

            case "waitFor": {
              if (!params.sessionId) {
                return textResult(JSON.stringify({ error: "action 'waitFor' requires 'sessionId'" }));
              }
              const taskResult = await manager.waitFor(params.sessionId);
              const { messages: _msgs, ...resultWithoutMessages } = taskResult;
              return textResult(JSON.stringify(resultWithoutMessages, null, 2));
            }

            case "delegate": {
              if (!params.agent) {
                return textResult(JSON.stringify({ error: "action 'delegate' requires 'agent'" }));
              }
              if (!params.task) {
                return textResult(JSON.stringify({ error: "action 'delegate' requires 'task'" }));
              }
              if (delegateDeny && delegateDeny.agents.includes(params.agent)) {
                return textResult(JSON.stringify({ error: `Cannot delegate directly to "${params.agent}". ${delegateDeny.hint}` }));
              }
              const delegateParentSid = getCallerSessionId?.();
              const delegateSessionId = manager.run(params.agent, params.task, { ...(delegateParentSid ? { parentSessionId: delegateParentSid } : {}), source: "agent" });
              onSessionStart?.(params.agent, delegateSessionId);
              const delegateResult = await manager.waitFor(delegateSessionId);
              const { messages: _delegateMsgs, ...delegateWithoutMessages } = delegateResult;
              return textResult(JSON.stringify(delegateWithoutMessages, null, 2));
            }

            case "trace": {
              if (!params.sessionId) {
                return textResult(JSON.stringify({ error: "action 'trace' requires 'sessionId' (session ID or workflow run ID)" }));
              }
              const traceResult = manager.trace(params.sessionId);
              if (!traceResult) {
                return textResult(JSON.stringify({ error: `No trace found for "${params.sessionId}". Requires persistence (persistDir) and a valid session or workflow run ID.` }));
              }
              return textResult(JSON.stringify(traceResult, null, 2));
            }

            default: {
              return textResult(JSON.stringify({ error: `Unknown action: ${params.action}` }));
            }
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return textResult(JSON.stringify({ error: msg }));
        }
      },
    };
  }
}
