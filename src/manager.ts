import { readFileSync, mkdirSync } from "node:fs";
import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentMessage, AgentEvent, AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { SubagentDefinition, SessionInfo, TaskResult } from "./types.js";
import {
  RegistryStore,
  ensureSessionDir,
  appendSessionMessage,
  readSessionMessages,
  sessionOutputDir,
  appendMemoryEntry,
  readMemoryEntries,
  memoryPath,
  archiveSession,
  historyDir,
} from "./persistence.js";
import type { MemoryEntry } from "./persistence.js";
import { join, dirname } from "node:path";
import { existsSync } from "node:fs";

let nextId = 0;
function generateId(): string {
  return `s_${Date.now()}_${nextId++}`;
}

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
  status: "running" | "done" | "error" | "interrupted";
  error?: string;
  outputDir: string;
  unsubscribe?: () => void;
}

export interface SubagentManagerOptions {
  persistDir?: string;
}

// ── createTool() schema ────────────────────────────────────────────────

const SubagentToolParams = Type.Union([
  Type.Object({
    action: Type.Literal("list"),
  }),
  Type.Object({
    action: Type.Literal("run"),
    agent: Type.String({ description: "Name of the registered agent" }),
    task: Type.String({ description: "Task description to send to the agent" }),
  }),
  Type.Object({
    action: Type.Literal("status"),
    sessionId: Type.String({ description: "Session ID to query" }),
  }),
  Type.Object({
    action: Type.Literal("progress"),
    sessionId: Type.String({ description: "Session ID to query" }),
    limit: Type.Optional(Type.Number({ description: "Max number of recent messages to return (default: all)" })),
  }),
  Type.Object({
    action: Type.Literal("result"),
    sessionId: Type.String({ description: "Session ID to get the result for" }),
  }),
  Type.Object({
    action: Type.Literal("cancel"),
    sessionId: Type.String({ description: "Session ID to cancel" }),
  }),
  Type.Object({
    action: Type.Literal("waitFor"),
    sessionId: Type.String({ description: "Session ID to wait for completion" }),
  }),
]);

export class SubagentManager {
  private agents = new Map<string, RegisteredAgent>();
  private activeSessions = new Map<string, ActiveSession>();
  private registry: RegistryStore | null;

  constructor(opts?: SubagentManagerOptions) {
    this.registry = opts?.persistDir ? new RegistryStore(opts.persistDir) : null;
  }

  /** Register a feature unit. */
  register(def: SubagentDefinition): void {
    this.agents.set(def.name, { definition: def });
    this.registry?.saveAgent(def);
  }

  /** Subscribe to message_end events and persist messages to session JSONL. */
  private subscribeForPersistence(session: ActiveSession): void {
    if (!this.registry) return;
    const persistDir = this.registry.persistDir;
    const { sessionId } = session;
    session.unsubscribe = session.agent.subscribe((event: AgentEvent) => {
      if (event.type === "message_end") {
        appendSessionMessage(persistDir, sessionId, event.message);
      }
    });
  }

  /** Resolve the system prompt from a definition.
   *  - If systemPrompt is set, use it directly.
   *  - If systemPromptFiles is set, read each file and concatenate with separator.
   *  - If persistDir exists and memoryLimit > 0, append recent memory entries.
   *  - Append workspace and output sections.
   */
  private resolveSystemPrompt(
    def: SubagentDefinition,
    agentName: string,
    sessionId: string,
    persistDir: string | null,
  ): string {
    if (def.systemPrompt) return def.systemPrompt;

    const sections: string[] = [];

    // Load systemPromptFiles
    if (def.systemPromptFiles && def.systemPromptFiles.length > 0) {
      const fileContents = def.systemPromptFiles.map((filePath) =>
        readFileSync(filePath, "utf-8"),
      );
      sections.push(fileContents.join("\n\n---\n\n"));
    }

    // Load memory entries
    const memoryLimit = def.memoryLimit ?? 20;
    if (persistDir && memoryLimit > 0) {
      const entries = readMemoryEntries(persistDir, agentName, memoryLimit);
      if (entries.length > 0) {
        const lines = entries.map((e) => {
          const ts = formatMemoryTimestamp(e.timestamp);
          const summary = e.summary ? ` — ${e.summary}` : "";
          return `- ${ts}: "${e.task}" — ${e.status} (${e.duration})${summary}`;
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
    if (persistDir) {
      const outputPath = sessionOutputDir(persistDir, sessionId);
      sections.push(
        `# Output\nWrite deliverables for this task to: ${outputPath}`,
      );
    }

    return sections.join("\n\n");
  }

  /** Append a memory entry after session completion. */
  private appendMemory(session: ActiveSession): void {
    if (!this.registry) return;
    const messages = session.agent.state.messages;
    const entry: MemoryEntry = {
      task: session.task,
      status: session.status,
      duration: formatDuration(Date.now() - session.startedAt),
      summary: extractLastAssistantText(messages),
      timestamp: Date.now(),
    };
    appendMemoryEntry(this.registry.persistDir, session.agentName, entry);
  }

  /** Archive a session after completion: move to history. */
  private archiveSessionDir(session: ActiveSession): void {
    if (!this.registry) return;
    try {
      archiveSession(this.registry.persistDir, session.sessionId);
    } catch {
      // Session dir may not exist (e.g. no persistDir or already archived)
    }
  }

  /** Start a new session for a registered agent. Returns sessionId. Non-blocking. */
  run(name: string, task: string): string {
    const registered = this.agents.get(name);
    if (!registered) throw new Error(`Agent "${name}" not registered`);

    const def = registered.definition;
    const sessionId = generateId();
    const persistDir = this.registry?.persistDir ?? null;

    // Compute output directory
    const outputDir = persistDir
      ? sessionOutputDir(persistDir, sessionId)
      : "";

    // Create session directory and output subdirectory for JSONL persistence
    if (this.registry) {
      ensureSessionDir(this.registry.persistDir, sessionId);
      mkdirSync(sessionOutputDir(this.registry.persistDir, sessionId), { recursive: true });
    }

    const agent = new Agent({
      initialState: {
        systemPrompt: this.resolveSystemPrompt(def, name, sessionId, persistDir),
        model: def.model,
        tools: def.tools,
      },
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
    };

    // Subscribe for JSONL persistence before starting the prompt
    this.subscribeForPersistence(session);

    // Persist the new session to registry
    this.registry?.saveSession(sessionId, {
      agent: name,
      task,
      status: "running",
      startedAt: session.startedAt,
    });

    session.promise = agent.prompt(task)
      .then(() => {
        if (agent.state.error) {
          session.status = "error";
          session.error = agent.state.error;
          this.registry?.updateSessionStatus(sessionId, "error", agent.state.error);
        } else {
          session.status = "done";
          this.registry?.updateSessionStatus(sessionId, "done");
        }
        this.appendMemory(session);
        this.archiveSessionDir(session);
      })
      .catch((err) => {
        session.status = "error";
        session.error = err?.message ?? String(err);
        this.registry?.updateSessionStatus(sessionId, "error", session.error);
        this.appendMemory(session);
        this.archiveSessionDir(session);
      });

    this.activeSessions.set(sessionId, session);
    return sessionId;
  }

  /** Resume interrupted sessions after process restart.
   *  Caller must have already called register() for all agents.
   *  Returns SessionInfo[] for all resumed sessions.
   */
  resume(): SessionInfo[] {
    if (!this.registry) return [];

    const registryData = this.registry.getRegistry();
    const persistDir = this.registry.persistDir;
    const resumed: SessionInfo[] = [];

    for (const [sessionId, persisted] of Object.entries(registryData.sessions)) {
      if (persisted.status !== "running") continue;

      // Find matching registered agent
      const registered = this.agents.get(persisted.agent);
      if (!registered) {
        console.warn(
          `[SubagentManager] Cannot resume session "${sessionId}": agent "${persisted.agent}" is not registered. Marking as interrupted.`,
        );
        this.registry.updateSessionStatus(sessionId, "interrupted");
        continue;
      }

      const def = registered.definition;

      // Load session conversation from sessions/<id>/session.jsonl
      const savedMessages = readSessionMessages(persistDir, sessionId);

      // Rebuild system prompt
      const systemPrompt = this.resolveSystemPrompt(def, persisted.agent, sessionId, persistDir);

      // Compute output directory
      const outputDir = sessionOutputDir(persistDir, sessionId);

      // Create a new Agent with the registered agent's tools, model, apiKey
      const agent = new Agent({
        initialState: {
          systemPrompt,
          model: def.model,
          tools: def.tools,
          messages: savedMessages,
        },
        getApiKey: def.apiKey ? () => def.apiKey : undefined,
      });

      // Build the resume message
      const resumeMessage: AgentMessage = {
        role: "user",
        content: [{ type: "text", text: "Your session was interrupted. Continue where you left off." }],
        timestamp: Date.now(),
      };

      const session: ActiveSession = {
        sessionId,
        agentName: persisted.agent,
        agent,
        promise: null!,
        task: persisted.task,
        startedAt: persisted.startedAt,
        status: "running",
        outputDir,
      };

      // Subscribe for JSONL persistence before starting the prompt
      this.subscribeForPersistence(session);

      // Start the agent running with the resume message
      session.promise = agent.prompt(resumeMessage)
        .then(() => {
          if (agent.state.error) {
            session.status = "error";
            session.error = agent.state.error;
            this.registry?.updateSessionStatus(sessionId, "error", agent.state.error);
          } else {
            session.status = "done";
            this.registry?.updateSessionStatus(sessionId, "done");
          }
          this.appendMemory(session);
          this.archiveSessionDir(session);
        })
        .catch((err) => {
          session.status = "error";
          session.error = err?.message ?? String(err);
          this.registry?.updateSessionStatus(sessionId, "error", session.error);
          this.appendMemory(session);
          this.archiveSessionDir(session);
        });

      this.activeSessions.set(sessionId, session);

      resumed.push({
        sessionId,
        agent: persisted.agent,
        task: persisted.task,
        status: "running",
        startedAt: persisted.startedAt,
        runtime: formatDuration(Date.now() - persisted.startedAt),
        outputDir,
      });
    }

    return resumed;
  }

  /** Get all sessions. */
  status(): SessionInfo[] {
    return Array.from(this.activeSessions.values()).map((s) => ({
      sessionId: s.sessionId,
      agent: s.agentName,
      task: s.task,
      status: s.status,
      startedAt: s.startedAt,
      endedAt: s.status !== "running" ? Date.now() : undefined,
      runtime: formatDuration(Date.now() - s.startedAt),
      outputDir: s.outputDir,
      error: s.error,
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

  /** Get sessions filtered by agent name. */
  sessions(name: string): SessionInfo[] {
    return this.status().filter((s) => s.agent === name);
  }

  /** Get last N messages from a session. */
  progress(sessionId: string, limit?: number): AgentMessage[] {
    const session = this.activeSessions.get(sessionId);
    if (!session) return [];
    const messages = session.agent.state.messages;
    if (limit === undefined) return messages.slice();
    return messages.slice(-limit);
  }

  /** Get result of a completed session. */
  result(sessionId: string): TaskResult | null {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;
    if (session.status === "running") return null;

    const messages = session.agent.state.messages;
    return {
      sessionId: session.sessionId,
      status: session.status === "interrupted" ? "error" : session.status,
      lastAssistantText: extractLastAssistantText(messages),
      messages: messages.slice(),
      duration: formatDuration(Date.now() - session.startedAt),
      outputDir: session.outputDir,
      error: session.error,
    };
  }

  /** Cancel a running session. */
  cancel(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== "running") return;
    session.agent.abort();
  }

  /** Send a follow-up message to a completed session. Resumes the same Agent. Non-blocking. */
  send(sessionId: string, message: string): boolean {
    const session = this.activeSessions.get(sessionId);
    if (!session) return false;
    if (session.status === "running") return false;

    session.status = "running";
    session.error = undefined;

    session.promise = session.agent.prompt(message)
      .then(() => {
        if (session.agent.state.error) {
          session.status = "error";
          session.error = session.agent.state.error;
        } else {
          session.status = "done";
        }
      })
      .catch((err) => {
        session.status = "error";
        session.error = err?.message ?? String(err);
      });

    return true;
  }

  /** Steer a running session mid-run. */
  steer(sessionId: string, message: string): "steered" | "queued" | "not_running" {
    const session = this.activeSessions.get(sessionId);
    if (!session || session.status !== "running") return "not_running";
    if (session.agent.state.isStreaming) {
      session.agent.steer({
        role: "user",
        content: [{ type: "text", text: message }],
        timestamp: Date.now(),
      });
      return "steered";
    }
    session.agent.followUp({
      role: "user",
      content: [{ type: "text", text: message }],
      timestamp: Date.now(),
    });
    return "queued";
  }

  /** Subscribe to agent events for a session. Returns unsubscribe function. */
  subscribe(sessionId: string, fn: (e: AgentEvent) => void): (() => void) | null {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;
    return session.agent.subscribe(fn);
  }

  /** Wait for a session to finish. */
  async waitFor(sessionId: string): Promise<TaskResult | null> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return null;
    await session.promise;
    return this.result(sessionId);
  }

  // ── Path accessors ───────────────────────────────────────────────────

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

  /** Get the memory JSONL path for an agent. Requires persistDir. */
  getMemoryPath(name: string): string | undefined {
    if (!this.registry) return undefined;
    return memoryPath(this.registry.persistDir, name);
  }

  /** Get the output directory for a session (active or archived). */
  getOutputPath(sessionId: string): string | undefined {
    const session = this.activeSessions.get(sessionId);
    if (session) return session.outputDir;

    // Check archived sessions in history
    if (!this.registry) return undefined;
    const persistDir = this.registry.persistDir;
    const archivedOutputDir = join(historyDir(persistDir), sessionId, "output");
    if (existsSync(archivedOutputDir)) return archivedOutputDir;

    // Check if session exists in active sessions dir (not yet archived)
    const activeOutputDir = sessionOutputDir(persistDir, sessionId);
    if (existsSync(activeOutputDir)) return activeOutputDir;

    return undefined;
  }

  // ── Parent agent tool ────────────────────────────────────────────────

  /** Create an AgentTool that exposes sub-agent management to a parent agent. */
  createTool(): AgentTool<typeof SubagentToolParams> {
    const manager = this;

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
            try {
              const sessionId = manager.run(params.agent, params.task);
              return textResult(JSON.stringify({ sessionId }));
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              return textResult(JSON.stringify({ error: msg }));
            }
          }

          case "status": {
            const allSessions = manager.status();
            const session = allSessions.find((s) => s.sessionId === params.sessionId);
            if (!session) {
              return textResult(JSON.stringify({ error: `Session "${params.sessionId}" not found` }));
            }
            return textResult(JSON.stringify(session, null, 2));
          }

          case "progress": {
            const messages = manager.progress(params.sessionId, params.limit);
            if (messages.length === 0) {
              return textResult(JSON.stringify({ error: `Session "${params.sessionId}" not found or no messages` }));
            }
            // Return a simplified view of messages for the parent agent
            const simplified = messages.map((m) => ({
              role: m.role,
              content: m.content,
            }));
            return textResult(JSON.stringify(simplified, null, 2));
          }

          case "result": {
            const taskResult = manager.result(params.sessionId);
            if (!taskResult) {
              return textResult(JSON.stringify({ error: `Session "${params.sessionId}" not found or still running` }));
            }
            // Return result without the full messages array (too large for tool output)
            const { messages: _msgs, ...resultWithoutMessages } = taskResult;
            return textResult(JSON.stringify(resultWithoutMessages, null, 2));
          }

          case "cancel": {
            manager.cancel(params.sessionId);
            return textResult(JSON.stringify({ cancelled: params.sessionId }));
          }

          case "waitFor": {
            const taskResult = await manager.waitFor(params.sessionId);
            if (!taskResult) {
              return textResult(JSON.stringify({ error: `Session "${params.sessionId}" not found` }));
            }
            const { messages: _msgs, ...resultWithoutMessages } = taskResult;
            return textResult(JSON.stringify(resultWithoutMessages, null, 2));
          }

          default: {
            const _exhaustive: never = params;
            return textResult(JSON.stringify({ error: "Unknown action" }));
          }
        }
      },
    };
  }
}
