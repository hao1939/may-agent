import { readFileSync, readdirSync, mkdirSync, existsSync, writeFileSync, appendFileSync, unlinkSync } from "node:fs";
import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentMessage, AgentEvent, AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type, StringEnum } from "@mariozechner/pi-ai";
import type { SubagentDefinition, SessionInfo, TaskResult, SessionTreeNode, ManagerHealthReport, HealthActiveSession, AuditHealthOptions, AuditHealthReport, ReconcileReport } from "./types.js";
import { createCompactionTransform } from "./compaction.js";
import type { CompactionOptions } from "./compaction.js";
import { loadSkillsFromDirs, formatSkillsForPrompt } from "./skills.js";
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
  loadAllSessionMetas,
  saveCompactedMessages,
  readCompactedMessages,
} from "./persistence.js";
import type { MemoryEntry, WorkflowRun, PersistedSession, Registry } from "./persistence.js";
import type { TraceNode, SessionTrace } from "./workflow.js";
import { join, dirname, relative, resolve } from "node:path";
import { isOverflowError, extractProgress, writeProgressFile } from "./overflow.js";
import { spawnDetachedAgent, readIdentity } from "./detached.js";
import { sendSocketCommand } from "./socket-client.js";
import { buildProjectStructure } from "./tools/project-structure.js";

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

/** Check if a process with the given PID is still running. */
function isProcessAlive(pid: number | undefined): boolean {
  if (pid === undefined) return false;
  try {
    process.kill(pid, 0); // signal 0: existence check, no actual signal
    return true;
  } catch {
    return false;
  }
}
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
  status: "running" | "interrupted" | "idle";
  error?: string;
  outputDir: string;
  unsubscribe?: () => void;
  timeoutTimer?: ReturnType<typeof setTimeout>;
  parentSessionId?: string;
  /** Agent name of the parent session (cached at creation for notification after parent may be gone). */
  parentAgentName?: string;
  workflowRunId?: string;
  stepLabel?: string;
  turnCount: number;
  /** Maximum turns before forced wrap-up. Undefined = no limit. */
  maxTurns?: number;
  /** Set when the turn-limit warning has been injected (prevents duplicate warnings). */
  turnLimitWarned?: boolean;
  /** Compaction transform for the interface session (rolling compaction). */
  compactionTransform?: (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>;
  /** Set by close() — prevents handleCompletion from acting on an already-archived session. */
  closed: boolean;
  /** Session lifecycle policy. "never" = chat session (stays idle), "immediate" = task session (archives on completion). */
  autoClose: "immediate" | "never";
  /** Terminal status for archive/result reporting. Set before archival so the promise chain can read it after the session is removed from activeSessions. */
  archiveStatus?: "done" | "error" | "interrupted";
}

/** Options for spawning a session with parent/workflow context. */
export interface RunOptions {
  parentSessionId?: string;
  /** Name of the parent agent (for cross-process notification routing). */
  parentAgentName?: string;
  workflowRunId?: string;
  stepLabel?: string;
  /** Runtime override: enable compaction for this session. */
  compaction?: boolean | CompactionOptions;
  /** Message source tag for the initial task message. */
  source?: string;
  /** Pre-assigned session ID (used by detached sub-agents). If set, skips generateId(). */
  sessionId?: string;
  /** Session lifecycle policy. Default: "immediate" (task sessions).
   *  - "immediate": archive on completion (task sessions)
   *  - "never": stay idle on completion (interface/chat session) */
  autoClose?: "immediate" | "never";
}

export interface SubagentManagerOptions {
  persistDir: string;
  /** Root of the project. Used for detached agent spawning.
   *  Falls back to resolve(persistDir, "..") if not set. */
  projectRoot?: string;
  /** Maximum call depth for nested callAgent chains (default: 10).
   *  Prevents infinite loops like A→B→A→B→... */
  maxCallDepth?: number;
  /**
   * Called after a task session completes (done/error/interrupted).
   * Fires after archival. Use for post-session tasks like evaluation.
   * NOT called for the chat session transitioning to "idle".
   */
  onSessionComplete?: (info: SessionInfo) => void;
  /**
   * Called when any new session starts (via run()).
   * Use to subscribe to agent events for UI streaming.
   * This is the single point where all session creation is observed.
   */
  onSessionStart?: (agentName: string, sessionId: string) => void;
}

/** Agents whose sessions are auto-skippable for evaluation (meta-agents). */
const EVAL_SKIP_AGENTS = new Set(["evaluator", "optimizer", "may"]);

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
  /** Current call depth per root session (tracks nested callAgent chains). */
  private callDepths = new Map<string, number>();

  /** Project root directory. Used for detached agent spawning. */
  get projectRoot(): string { return this._projectRoot; }

  constructor(opts: SubagentManagerOptions) {
    this.registry = new RegistryStore(opts.persistDir);
    this._projectRoot = opts.projectRoot ?? resolve(opts.persistDir, "..");
    this._maxCallDepth = opts.maxCallDepth ?? 10;
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
        if (event.message.role === "assistant") {
          session.turnCount++;
          this.checkTurnLimit(session);
        }
      }
    });
  }

  /**
   * Enforce maxTurns limit on a session.
   *
   * When turnCount reaches (maxTurns - 2): inject a warning message.
   * When turnCount reaches maxTurns: abort the session.
   *
   * The warning gives the agent 2 turns to save state (write workspace/todo.md,
   * commit partial work) before the hard cutoff.
   */
  private checkTurnLimit(session: ActiveSession): void {
    if (!session.maxTurns || session.maxTurns <= 0) return;

    const warningThreshold = Math.max(1, session.maxTurns - 2);

    // Warning at (maxTurns - 2)
    if (session.turnCount >= warningThreshold && !session.turnLimitWarned) {
      session.turnLimitWarned = true;
      const remaining = session.maxTurns - session.turnCount;
      const warnMsg = `⚠️ TURN LIMIT WARNING: ${remaining} turn(s) remaining (limit: ${session.maxTurns}). Wrap up immediately: save any partial work to workspace/todo.md and stop.`;
      try {
        session.agent.followUp({
          role: "user",
          content: [{ type: "text", text: warnMsg }],
          timestamp: Date.now(),
          source: "system:turn-limit",
        } as AgentMessage);
      } catch {
        // Session may have ended between the check and followUp — safe to ignore
      }
    }

    // Hard cutoff at maxTurns
    if (session.turnCount >= session.maxTurns) {
      try {
        session.agent.abort();
      } catch {
        // Already ended — safe to ignore
      }
    }
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
      const relPath = (abs: string) => relative(def.projectRoot!, abs) || ".";
      const agentDir = def.knowledgeDir ? dirname(def.knowledgeDir) : def.workspace ? dirname(def.workspace) : undefined;
      const envLines = [`# Runtime Environment`, `- Project root (exec cwd): ${def.projectRoot}`];
      envLines.push(`- Container: Docker (there is NO /home/, /Users/, /root/, or ~ directory — all work happens under ${def.projectRoot})`);
      if (agentDir) {
        envLines.push(`- Agent directory: ${relPath(agentDir)}`);
        // List agent-level files (heartbeat.md, periodic-tasks.md, etc.)
        try {
          const agentFiles = readdirSync(agentDir, { withFileTypes: true })
            .filter((e) => e.isFile() && !["agent.json"].includes(e.name))
            .map((e) => e.name)
            .sort();
          if (agentFiles.length > 0) {
            envLines.push(`- Agent files: ${agentFiles.join(", ")}`);
          }
        } catch { /* best-effort */ }
      }
      if (def.workspace) {
        envLines.push(`- Workspace: ${relPath(def.workspace)}`);
        if (def.knowledgeDir) {
          envLines.push(`- Knowledge directory: ${relPath(def.knowledgeDir)}`);
        }
      }
      // Tell the agent which files are already in this prompt (prevents re-reading)
      const loaded: string[] = [];
      if (agentDir) {
        for (const name of ["SOUL.md", "DOMAIN.md", "TOOLS.md", "LESSONS.md"]) {
          if (existsSync(join(agentDir, name))) loaded.push(name);
        }
      }
      if (loaded.length > 0) {
        envLines.push(`- Already in context (do NOT read): ${loaded.join(", ")}, skills, shared knowledge, memory`);
      }
      envLines.push(``, `IMPORTANT: All paths are relative to project root. Example: agents/${def.name}/workspace/todo.md (NOT /home/user/..., /Users/example-user/..., or /root/...). Tools resolve relative paths automatically. Your workspace is the ONLY directory you should write to.`);
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
    // ── Always-loaded files (UPPERCASE at agent root, convention-driven) ──
    // Order: SOUL → DOMAIN → TOOLS → systemPromptFiles → LESSONS
    // Fallback: also checks knowledge/ for backward compat during migration.
    const agentDir = def.knowledgeDir ? dirname(def.knowledgeDir) : undefined;

    const autoLoadFile = (primary: string | undefined, fallback: string | undefined): string | undefined => {
      for (const p of [primary, fallback]) {
        if (p && existsSync(p)) {
          const content = readFileSync(p, "utf-8").trim();
          if (content) return content;
        }
      }
      return undefined;
    };

    // 1. SOUL.md — identity & mission
    const soul = autoLoadFile(
      agentDir ? join(agentDir, "SOUL.md") : undefined,
      def.knowledgeDir ? join(def.knowledgeDir, "SOUL.md") : undefined,
    );
    if (soul) sections.push(soul);

    // 2. DOMAIN.md — domain expertise (references knowledge/ files for on-demand reading)
    const domain = autoLoadFile(
      agentDir ? join(agentDir, "DOMAIN.md") : undefined,
      def.knowledgeDir ? join(def.knowledgeDir, "domain.md") : undefined,
    );
    if (domain) sections.push(domain);

    // 3. TOOLS.md — tool usage guide
    const tools = autoLoadFile(
      agentDir ? join(agentDir, "TOOLS.md") : undefined,
      agentDir ? join(agentDir, "tools", "INDEX.md") : undefined,
    );
    if (tools) sections.push(tools);

    // Load systemPromptFiles (skip any that overlap with auto-loaded paths)
    if (def.systemPromptFiles && def.systemPromptFiles.length > 0) {
      const autoLoaded = new Set<string>();
      if (def.knowledgeDir) {
        autoLoaded.add(join(def.knowledgeDir, "SOUL.md"));
        autoLoaded.add(join(def.knowledgeDir, "domain.md"));
        autoLoaded.add(join(def.knowledgeDir, "lessons.md"));
      }
      if (agentDir) {
        autoLoaded.add(join(agentDir, "SOUL.md"));
        autoLoaded.add(join(agentDir, "DOMAIN.md"));
        autoLoaded.add(join(agentDir, "TOOLS.md"));
        autoLoaded.add(join(agentDir, "LESSONS.md"));
        autoLoaded.add(join(agentDir, "tools", "INDEX.md"));
      }
      const fileContents = def.systemPromptFiles
        .filter((filePath) => !autoLoaded.has(filePath))
        .map((filePath) => readFileSync(filePath, "utf-8"));
      if (fileContents.length > 0) {
        sections.push(fileContents.join("\n\n---\n\n"));
      }
    }

    // 4. LESSONS.md — accumulated learnings (near end, changes often)
    const lessons = autoLoadFile(
      agentDir ? join(agentDir, "LESSONS.md") : undefined,
      def.knowledgeDir ? join(def.knowledgeDir, "lessons.md") : undefined,
    );
    if (lessons) sections.push(lessons);


    // 5. Knowledge library index — list available reference material (not auto-loaded)
    if (def.knowledgeDir) {
      const libraryDir = join(def.knowledgeDir, "library");
      if (existsSync(libraryDir)) {
        try {
          const libraryFiles = readdirSync(libraryDir, { withFileTypes: true })
            .filter((e) => e.isFile() && e.name.endsWith(".md"))
            .map((e) => e.name)
            .sort();
          if (libraryFiles.length > 0) {
            const relLib = def.projectRoot ? relative(def.projectRoot, libraryDir) : libraryDir;
            const fileList = libraryFiles.map((f) => `- ${f}`).join("\n");
            sections.push(
              `# Reference Library\nAdditional reference material available on demand (use \`read\` tool to access):\nDirectory: ${relLib}/\n${fileList}`
            );
          }
        } catch { /* best-effort — library may not be readable */ }
      }
    }
    // Load skills from per-agent skills/ dir + shared skillsDirs
    {
      const skillDirs: string[] = [];
      if (agentDir) {
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
      const wsRel = def.projectRoot ? relative(def.projectRoot, def.workspace) : def.workspace;
      sections.push(
        `# Workspace\nYour persistent workspace is: ${wsRel}\nALL file writes (journal.md, todo.md, analysis, archives) MUST go here. Never create files in the project root or other directories.`,
      );
    }

    // Output section
    const outputPath = sessionOutputDir(persistDir, sessionId);
    const outputRel = def.projectRoot ? relative(def.projectRoot, outputPath) : outputPath;
    sections.push(
      `# Output\nWrite deliverables for this task to: ${outputRel}`,
    );

    return sections.join("\n\n");
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
   * Compact an interface session's in-memory messages after it goes idle.
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
        } catch { /* best-effort */ }
      }
    }

    // ── Determine archive status, archive, remove ──────────────────────
    // The live session status never transitions to done/error — those are
    // archive-only states. The session goes from running → archived+removed.
    const archiveStatus: "done" | "error" | "interrupted" = wasAborted ? "interrupted" : (session.error ? "error" : "done");
    session.archiveStatus = archiveStatus;
    this.registry.updateSessionStatus(session.sessionId, archiveStatus, session.error);

    session.unsubscribe?.();
    session.endedAt = Date.now();

    // Remove [STARTED] sentinel on clean exit
    try {
      const sentinelPath = join(sessionDir(this.registry.persistDir, session.sessionId), "[STARTED]");
      if (existsSync(sentinelPath)) unlinkSync(sentinelPath);
    } catch { /* best-effort */ }

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
      try { this.onSessionComplete(info); } catch { /* best-effort */ }
    }
  }

  /** Start a new session for a registered agent. Returns sessionId. Non-blocking.
   *  Task sessions archive on completion (autoClose: "immediate").
   */
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
        systemPrompt: this.resolveSystemPrompt(def, name, sessionId, persistDir),
        model: def.model,
        tools: def.tools,
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
      parentAgentName: opts?.parentAgentName ?? (opts?.parentSessionId ? this.activeSessions.get(opts.parentSessionId)?.agentName : undefined),
      workflowRunId: opts?.workflowRunId,
      stepLabel: opts?.stepLabel,
      turnCount: 0,
      maxTurns: def.maxTurns,
      compactionTransform,
      closed: false,
      autoClose: opts?.autoClose ?? "immediate",
    };

    // Write [STARTED] sentinel
    try {
      const sentinelPath = join(sessionDir(persistDir, sessionId), "[STARTED]");
      writeFileSync(sentinelPath, new Date().toISOString());
    } catch { /* best-effort */ }

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
  resumeStaleSessions(): { resumed: SessionInfo[]; interrupted: SessionInfo[] } {
    const registryData = this.registry.getRegistry();
    const persistDir = this.registry.persistDir;
    const staleSessionIds: Array<{ sessionId: string; persisted: (typeof registryData.sessions)[string] }> = [];

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
              try { unlinkSync(sentinelPath); } catch {}
              staleSessionIds.push({ sessionId, persisted });
            } else if (!persisted) {
              try { unlinkSync(sentinelPath); } catch {}
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
      staleSessionIds.push({ sessionId, persisted });
    }

    const resumed: SessionInfo[] = [];
    const interrupted: SessionInfo[] = [];

    for (const { sessionId, persisted } of staleSessionIds) {
      const registered = this.agents.get(persisted.agent);
      if (!registered) {
        // Agent not registered — can't resume, mark interrupted
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
    const systemPrompt = this.resolveSystemPrompt(def, persisted.agent, sessionId, persistDir);
    const outputDir = sessionOutputDir(persistDir, sessionId);

    const compactionTransform = this.buildTransformContext(def);
    const agent = new Agent({
      initialState: {
        systemPrompt,
        model: def.model,
        tools: def.tools,
        messages: savedMessages,
      },
      transformContext: compactionTransform,
      getApiKey: def.apiKey ? () => def.apiKey : undefined,
    });

    // Repair broken message sequences (mid-tool-call crash).
    const lastMsg = savedMessages.length > 0 ? savedMessages[savedMessages.length - 1] : null;
    let lastRole = lastMsg?.role;

    if (lastRole === "assistant" && lastMsg && Array.isArray(lastMsg.content)) {
      const toolCalls = (lastMsg.content as Array<{ type: string }>).filter(
        (b) => b.type === "toolCall",
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
      maxTurns: def.maxTurns,
      compactionTransform,
      closed: false,
      autoClose: "immediate",
    };

    this.subscribeForPersistence(session);
    this.setupTimeout(session, def.timeoutMs);
    this.activeSessions.set(sessionId, session);
    this.onSessionStart?.(persisted.agent, sessionId);

    // Continue the agent — either resume from a pending user message or
    // inject a restart notice and let the agent continue its task.
    const resumeMessage: AgentMessage = {
      role: "user",
      content: [{ type: "text", text: "Process restarted. Your session has been restored. Continue where you left off." }],
      timestamp: Date.now(),
      source: "system",
    } as AgentMessage;

    const startPromise = lastRole === "user"
      ? agent.continue()
      : agent.prompt(resumeMessage);

    session.promise = startPromise
      .then(() => { this.handleCompletion(session); })
      .catch((err) => {
        session.error = err?.message ?? String(err);
        this.handleCompletion(session);
      });

    this.sessionResults.set(sessionId, session.promise.then(() => this.buildResultFromSession(session)));

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
    return {
      sessionId: session.sessionId,
      status: (session.archiveStatus === "interrupted" || session.status === "interrupted")
        ? "error"
        : (session.archiveStatus ?? session.status) as "done" | "error",
      lastAssistantText: extractLastAssistantText(messages),
      messages: messages.slice(),
      duration: formatDuration((session.endedAt ?? Date.now()) - session.startedAt),
      outputDir: session.outputDir,
      error: session.error,
      turnsUsed: session.turnCount,
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
  /** Check if a session is currently active in-memory. */
  hasActiveSession(sessionId: string): boolean {
    return this.activeSessions.has(sessionId);
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
  async waitForDetached(sessionId: string, opts?: { pollIntervalMs?: number; timeoutMs?: number }): Promise<TaskResult> {
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
          await new Promise(r => setTimeout(r, 500));
          const finalMeta = this.registry.getSession(sessionId);
          if (finalMeta && finalMeta.status !== "running" && finalMeta.status !== "idle") {
            return this.resultFromArchive(sessionId);
          }
          // Process is dead but meta still says running — mark as error
          this.registry.updateSessionStatus(sessionId, "error", "Process exited without completing");
          return this.resultFromArchive(sessionId);
        }
      }
      await new Promise(r => setTimeout(r, pollInterval));
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

  // ── Health API ────────────────────────────────────────────────────────

  /** Fast, in-memory health snapshot. Returns data the manager already knows. */
  health(): ManagerHealthReport {
    const now = Date.now();
    const names = [...this.agents.keys()];

    const activeList: HealthActiveSession[] = [];
    let running = 0;
    let idle = 0;
    for (const s of this.activeSessions.values()) {
      activeList.push({
        sessionId: s.sessionId,
        agent: s.agentName,
        status: s.status,
        startedAt: s.startedAt,
        runtime: formatDuration((s.endedAt ?? now) - s.startedAt),
        turnCount: s.turnCount,
      });
      if (s.status === "running") running++;
      if (s.status === "idle") idle++;
    }

    return {
      registeredAgents: { count: names.length, names },
      activeSessions: activeList,
      sessionCounts: { running, idle, total: this.activeSessions.size },
      uptime: formatDuration(now - this.startedAt),
      timestamp: new Date(now).toISOString(),
    };
  }

  /**
   * Filesystem-based ground-truth scan. Inspects persisted session data on disk.
   * Intentionally synchronous — this is a diagnostic endpoint, not a hot path.
   * For large state directories, consider running in a worker thread if latency matters.
   */
  auditHealth(opts?: AuditHealthOptions): AuditHealthReport {
    const persistDir = this.registry.persistDir;
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Load all persisted session metas
    const allSessions = loadAllSessionMetas(persistDir);
    const allSessionEntries = Object.entries(allSessions);

    // 1. Sessions in last 24h
    let sessionsLast24h = 0;
    for (const session of Object.values(allSessions)) {
      if (session.startedAt >= oneDayAgo) sessionsLast24h++;
    }

    // 2. Unevaluated sessions
    const evalDir = join(persistDir, "evaluations");
    const evaluatedIds = new Set<string>();
    if (existsSync(evalDir)) {
      try {
        for (const f of readdirSync(evalDir)) {
          if (f.endsWith(".json")) evaluatedIds.add(f.replace(".json", ""));
        }
      } catch { /* best-effort */ }
    }

    const META_AGENTS = EVAL_SKIP_AGENTS;
    let unevalTotal = 0;
    let unevalActionable = 0;
    let unevalAutoSkippable = 0;

    for (const [sid, session] of allSessionEntries) {
      if (evaluatedIds.has(sid)) continue;
      if (session.status === "running" || session.status === "idle") continue;
      unevalTotal++;

      if (META_AGENTS.has(session.agent)) {
        unevalAutoSkippable++;
        continue;
      }

      // Check if transcript exists
      const activeJsonl = join(persistDir, "sessions", sid, "session.jsonl");
      const archivedJsonl = join(persistDir, "sessions", "history", sid, "session.jsonl");
      if (!existsSync(activeJsonl) && !existsSync(archivedJsonl)) {
        unevalAutoSkippable++;
        continue;
      }

      unevalActionable++;
    }

    // 3. Stale sessions: status "running" in filesystem but not in activeSessions
    const staleSessions: Array<{ sessionId: string; agent: string; task: string }> = [];
    for (const [sid, session] of allSessionEntries) {
      if (session.status === "running" && !this.activeSessions.has(sid)) {
        staleSessions.push({ sessionId: sid, agent: session.agent, task: session.task });
      }
    }

    // 4. Total persisted sessions
    const totalPersistedSessions = allSessionEntries.length;

    // 5. Workflow runs
    const runIds = listWorkflowRuns(persistDir);
    let wfRunning = 0;
    let wfCompleted = 0;
    let wfInterrupted = 0;
    for (const runId of runIds) {
      const run = readWorkflowRun(persistDir, runId);
      if (!run) continue;
      if (run.status === "running") wfRunning++;
      else if (run.status === "done") wfCompleted++;
      else if (run.status === "interrupted" || run.status === "error") wfInterrupted++;
      else wfCompleted++; // escalated counts as completed
    }

    return {
      sessionsLast24h,
      unevaluated: { total: unevalTotal, actionable: unevalActionable, autoSkippable: unevalAutoSkippable },
      staleSessions,
      totalPersistedSessions,
      workflowRuns: { total: runIds.length, running: wfRunning, completed: wfCompleted, interrupted: wfInterrupted },
      persistedSessionIds: new Set(Object.keys(allSessions)),
      timestamp: new Date(now).toISOString(),
    };
  }

  /** Compare in-memory state vs filesystem and flag discrepancies. */
  reconcileHealth(opts?: AuditHealthOptions): ReconcileReport {
    const healthReport = this.health();
    const auditReport = this.auditHealth(opts);
    const discrepancies: string[] = [];

    // 1. Stale sessions: running in filesystem but not in activeSessions
    if (auditReport.staleSessions.length > 0) {
      for (const s of auditReport.staleSessions) {
        discrepancies.push(`Stale session: ${s.sessionId} (agent=${s.agent}) is "running" on disk but not active in memory`);
      }
    }

    // 2. Active in memory but missing from filesystem
    for (const active of healthReport.activeSessions) {
      if (!auditReport.persistedSessionIds.has(active.sessionId)) {
        discrepancies.push(`Lost persistence: ${active.sessionId} (agent=${active.agent}) is active in memory but has no meta.json on disk`);
      }
    }

    // 3. Agent count mismatch: if filesystem has agent configs that aren't registered
    // (We can only check in-memory vs in-memory here since agents are not persisted to disk
    //  as separate files, but we flag if there are 0 registered agents as suspicious)
    if (healthReport.registeredAgents.count === 0 && auditReport.totalPersistedSessions > 0) {
      discrepancies.push(`No agents registered but ${auditReport.totalPersistedSessions} persisted sessions exist — agents may not have been re-registered after restart`);
    }

    return {
      health: healthReport,
      audit: auditReport,
      discrepancies,
      healthy: discrepancies.length === 0,
    };
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
  async callAgent(name: string, task: string, opts?: {
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
  }): Promise<TaskResult> {
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
      });

      // Subscribe for streaming events if requested
      let unsubscribe: (() => void) | undefined;
      if (opts?.onEvent) {
        try {
          unsubscribe = this.subscribe(sessionId, opts.onEvent);
        } catch { /* session may have already completed */ }
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
          opts.signal.addEventListener("abort", () => {
            this.cancel(sessionId);
          }, { once: true });
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
   * Create the V2 agents tool — 5 actions: call, send, list, peek, cancel.
   *
   * `call` is synchronous: blocks until the child agent finishes and returns
   * the result. Use when you need the result to continue.
   *
   * `send` is async fire-and-forget: appends a todo item to the target agent's
   * workspace/todo.md and triggers their heartbeat. Use for "do this, I don't
   * need the result now".
   *
   * `peek`, `cancel` operate on running sessions (monitoring).
   * `list` shows available agents and running sessions.
   */
  createAgentsTool(opts?: {
    /** Returns the current caller's session ID for parent→child linking. */
    getCallerSessionId?: () => string | undefined;
    /** Returns the current caller's agent name. */
    getCallerAgentName?: () => string | undefined;
    /** Agent names that cannot be called directly. Returns error with hint. */
    callDeny?: { agents: string[]; hint: string };
    /** Root directory of agent definitions (for send action). */
    agentsRoot?: string;
    /** Trigger an agent's heartbeat cron (for send action). */
    triggerHeartbeat?: (agentName: string) => boolean;
  }): AgentTool {
    const manager = this;
    const getCallerSessionId = opts?.getCallerSessionId;
    const getCallerAgentName = opts?.getCallerAgentName;
    const callDeny = opts?.callDeny;
    const agentsRoot = opts?.agentsRoot;
    const triggerHeartbeat = opts?.triggerHeartbeat;

    function textResult(text: string): AgentToolResult<string> {
      return {
        content: [{ type: "text", text }],
        details: text,
      };
    }

    const AgentsToolParams = Type.Object({
      action: StringEnum(
        ["call", "send", "list", "peek", "cancel"] as const,
        { description: "Action to perform. 'call' runs an agent synchronously (blocks until done). 'send' adds a todo for an agent and triggers their heartbeat (fire-and-forget). 'list' shows agents and running sessions. 'peek'/'cancel' operate on running sessions." },
      ),
      agent: Type.Optional(Type.String({ description: "Agent name (required for 'call', 'send')" })),
      task: Type.Optional(Type.String({ description: "Task description (required for 'call')" })),
      message: Type.Optional(Type.String({ description: "Todo item to send (required for 'send')" })),
      sessionId: Type.Optional(Type.String({ description: "Session ID (required for 'peek', 'cancel')" })),
      limit: Type.Optional(Type.Number({ description: "Max messages to return (for 'peek', default: 20)" })),
    });

    interface AgentsToolParamsType {
      action: "call" | "send" | "list" | "peek" | "cancel";
      agent?: string;
      task?: string;
      message?: string;
      sessionId?: string;
      limit?: number;
    }

    return {
      name: "agents",
      label: "Agents",
      description:
        "Cooperate with other agents. 'call' runs an agent and returns the result (blocks). 'send' adds a todo for an agent and triggers their heartbeat (fire-and-forget). 'list' shows available agents and running sessions. 'peek'/'cancel' monitor running sessions.",
      parameters: AgentsToolParams,
      execute: async (_toolCallId, _params) => {
        const params = _params as AgentsToolParamsType;
        try {
          switch (params.action) {
            case "call": {
              if (!params.agent || !params.task) {
                return textResult(JSON.stringify({ error: "'call' requires 'agent' and 'task'" }));
              }
              if (callDeny && callDeny.agents.includes(params.agent)) {
                return textResult(JSON.stringify({ error: `Cannot call "${params.agent}" directly. ${callDeny.hint}` }));
              }
              const parentSid = getCallerSessionId?.();

              // Sync call: blocks until done
              const result = await manager.callAgent(params.agent, params.task, {
                parentSessionId: parentSid,
              });
              // Return result without full messages array (too large for tool output)
              const { messages: _msgs, ...resultWithoutMessages } = result;
              return textResult(JSON.stringify(resultWithoutMessages, null, 2));
            }

            case "list": {
              const agents = Array.from(manager.agents.values()).map((a) => ({
                name: a.definition.name,
                description: a.definition.description,
                domain: a.definition.domain,
              }));
              const sessions = manager.status().map((s) => ({
                sessionId: s.sessionId,
                agent: s.agent,
                task: s.task.slice(0, 100),
                status: s.status,
                runtime: s.runtime,
              }));
              return textResult(JSON.stringify({ agents, runningSessions: sessions }, null, 2));
            }

            case "peek": {
              if (!params.sessionId) {
                return textResult(JSON.stringify({ error: "'peek' requires 'sessionId'" }));
              }
              try {
                const messages = manager.progress(params.sessionId, params.limit ?? 20);
                const simplified = messages.map((m) => ({
                  role: m.role,
                  content: m.content,
                }));
                return textResult(JSON.stringify(simplified, null, 2));
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return textResult(JSON.stringify({ error: msg }));
              }
            }

            case "send": {
              if (!params.agent || !params.message) {
                return textResult(JSON.stringify({ error: "'send' requires 'agent' and 'message'" }));
              }
              if (!manager.agents.has(params.agent)) {
                return textResult(JSON.stringify({ error: `Agent "${params.agent}" not registered` }));
              }
              if (!agentsRoot) {
                return textResult(JSON.stringify({ error: "send not available (agentsRoot not configured)" }));
              }

              // Append to target agent's workspace/todo.md
              const todoDir = join(agentsRoot, params.agent, "workspace");
              mkdirSync(todoDir, { recursive: true });
              const todoPath = join(todoDir, "todo.md");

              const caller = getCallerAgentName?.() ?? "unknown";
              const timestamp = new Date().toISOString().slice(0, 16);
              const entry = `- [ ] [from:${caller} ${timestamp}] ${params.message}\n`;

              // Create file with header if it doesn't exist, otherwise append
              if (!existsSync(todoPath)) {
                writeFileSync(todoPath, `# TODO\n\n${entry}`, "utf-8");
              } else {
                appendFileSync(todoPath, entry, "utf-8");
              }

              // Trigger target agent's heartbeat
              const triggered = triggerHeartbeat?.(params.agent) ?? false;

              return textResult(JSON.stringify({
                sent: params.agent,
                message: params.message,
                heartbeatTriggered: triggered,
              }));
            }

            case "cancel": {
              if (!params.sessionId) {
                return textResult(JSON.stringify({ error: "'cancel' requires 'sessionId'" }));
              }
              // Attached: in-memory cancel
              if (manager.hasActiveSession(params.sessionId)) {
                manager.cancel(params.sessionId);
                return textResult(JSON.stringify({ cancelled: params.sessionId }));
              }
              // Detached: try socket, fall back to SIGTERM
              const cancelMeta = manager.registry.getSession(params.sessionId);
              if (cancelMeta?.detached) {
                if (cancelMeta.instance) {
                  const cancelIdentity = readIdentity(manager.registry.persistDir, cancelMeta.instance);
                  if (cancelIdentity?.socket) {
                    try {
                      await sendSocketCommand(cancelIdentity.socket, { type: "cancel", sessionId: params.sessionId });
                      manager.registry.updateSessionStatus(params.sessionId, "interrupted", "Cancelled (socket)");
                      return textResult(JSON.stringify({ cancelled: params.sessionId, method: "socket" }));
                    } catch { /* fall through to SIGTERM */ }
                  }
                }
                if (cancelMeta.pid) {
                  try { process.kill(cancelMeta.pid, "SIGTERM"); } catch { /* process gone */ }
                  manager.registry.updateSessionStatus(params.sessionId, "interrupted", "Cancelled (SIGTERM)");
                  return textResult(JSON.stringify({ cancelled: params.sessionId, method: "sigterm" }));
                }
              }
              manager.cancel(params.sessionId);
              return textResult(JSON.stringify({ cancelled: params.sessionId }));
            }

            default:
              return textResult(JSON.stringify({ error: `Unknown action: ${(params as any).action}` }));
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return textResult(JSON.stringify({ error: msg }));
        }
      },
    };
  }
}
