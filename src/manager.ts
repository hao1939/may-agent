import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentMessage, AgentEvent } from "@mariozechner/pi-agent-core";
import type { SubagentDefinition, SessionInfo, TaskResult } from "./types.js";
import { RegistryStore } from "./persistence.js";

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
  status: "running" | "done" | "error";
  error?: string;
}

export interface SubagentManagerOptions {
  persistDir?: string;
}

export class SubagentManager {
  private agents = new Map<string, RegisteredAgent>();
  private sessions = new Map<string, ActiveSession>();
  private registry: RegistryStore | null;

  constructor(opts?: SubagentManagerOptions) {
    this.registry = opts?.persistDir ? new RegistryStore(opts.persistDir) : null;
  }

  /** Register a feature unit. */
  register(def: SubagentDefinition): void {
    this.agents.set(def.name, { definition: def });
    this.registry?.saveAgent(def);
  }

  /** Start a new session for a registered agent. Returns sessionId. Non-blocking. */
  run(name: string, task: string): string {
    const registered = this.agents.get(name);
    if (!registered) throw new Error(`Agent "${name}" not registered`);

    const def = registered.definition;
    const sessionId = generateId();

    const agent = new Agent({
      initialState: {
        systemPrompt: def.systemPrompt,
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
    };

    // Persist the new session
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
      })
      .catch((err) => {
        session.status = "error";
        session.error = err?.message ?? String(err);
        this.registry?.updateSessionStatus(sessionId, "error", session.error);
      });

    this.sessions.set(sessionId, session);
    return sessionId;
  }

  /** Get all sessions. */
  status(): SessionInfo[] {
    return Array.from(this.sessions.values()).map((s) => ({
      sessionId: s.sessionId,
      agent: s.agentName,
      task: s.task,
      status: s.status,
      startedAt: s.startedAt,
      endedAt: s.status !== "running" ? Date.now() : undefined,
      error: s.error,
    }));
  }

  /** Get last N messages from a session. */
  progress(sessionId: string, limit?: number): AgentMessage[] {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    const messages = session.agent.state.messages;
    if (limit === undefined) return messages.slice();
    return messages.slice(-limit);
  }

  /** Get result of a completed session. */
  result(sessionId: string): TaskResult | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (session.status === "running") return null;

    const messages = session.agent.state.messages;
    return {
      sessionId: session.sessionId,
      status: session.status,
      lastAssistantText: extractLastAssistantText(messages),
      messages: messages.slice(),
      duration: formatDuration(Date.now() - session.startedAt),
      error: session.error,
    };
  }

  /** Cancel a running session. */
  cancel(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== "running") return;
    session.agent.abort();
  }

  /** Send a follow-up message to a completed session. Resumes the same Agent. Non-blocking. */
  send(sessionId: string, message: string): boolean {
    const session = this.sessions.get(sessionId);
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
    const session = this.sessions.get(sessionId);
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
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    return session.agent.subscribe(fn);
  }

  /** Wait for a session to finish. */
  async waitFor(sessionId: string): Promise<TaskResult | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    await session.promise;
    return this.result(sessionId);
  }
}
