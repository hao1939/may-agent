/**
 * V2 Agent Runtime
 *
 * The complete v2 replacement for SubagentManager (for non-interactive sessions).
 * Two exports:
 *   - `runAgentSession()` — stateless, run one session to completion
 *   - `V2SessionManager` — stateful, manages multiple concurrent sessions
 *
 * Design principles:
 *   - Pi-agent-core's Agent handles: LLM loop, retry, overflow recovery, compaction
 *   - We handle: persistence, event bridging, timeout, guards
 *   - No zombie cleanup (timeout handles it), no call depth tracking (turn budgets),
 *     no API gating (pi-agent-core retries), no health audits (metrics cover it)
 *
 * See: agents/shared/may-agent-docs/architecture.md §3 "Agent Runs"
 */

import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { Model } from "@mariozechner/pi-ai";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import {
  generateId,
  extractLastAssistantText,
} from "./manager-utils.js";
import { composeGuards, type BeforeToolCallHook } from "./tools/compose-guards.js";
import {
  ensureSessionDir,
  sessionDir,
  appendSessionMessage,
  sessionOutputDir,
} from "./persistence.js";
import { extractFinishParams } from "./manager-retry.js";
import type { EventBus } from "../app/event-bus.js";
import { log } from "./log.js";

// ── Types ─────────────────────────────────────────────────────────────

export interface AgentDef {
  name: string;
  description: string;
  domain: string;
  model: Model<any>;
  tools: AgentTool[];
  guards?: BeforeToolCallHook[];
  systemPrompt: string;
  timeoutMs?: number;
  getApiKey?: () => string;
}

export interface RunOpts {
  sessionId?: string;
  parentSessionId?: string;
  source?: string;
  kind?: string;
}

export interface SessionResult {
  sessionId: string;
  status: string;
  summary: string;
  durationMs: number;
  finishParams?: Record<string, unknown>;
}

export interface SessionInfo {
  sessionId: string;
  agent: string;
  task: string;
  status: "running" | "completed";
  startedAt: number;
}

// ── Agent Registry ────────────────────────────────────────────────────

export class AgentRegistry {
  private agents = new Map<string, AgentDef>();

  register(def: AgentDef): void { this.agents.set(def.name, def); }
  get(name: string): AgentDef | undefined { return this.agents.get(name); }
  has(name: string): boolean { return this.agents.has(name); }
  list(): AgentDef[] { return [...this.agents.values()]; }
  names(): string[] { return [...this.agents.keys()]; }
}

// ── Session Manager ───────────────────────────────────────────────────

interface ActiveSession {
  sessionId: string;
  agent: Agent;
  agentName: string;
  task: string;
  startedAt: number;
  status: "running" | "paused" | "completed";
  promise: Promise<SessionResult>;
  timeoutTimer?: ReturnType<typeof setTimeout>;
}

export class V2SessionManager {
  private sessions = new Map<string, ActiveSession>();
  private results = new Map<string, Promise<SessionResult>>();

  constructor(
    private registry: AgentRegistry,
    private persistDir: string,
    private bus?: EventBus,
  ) {}

  /** Start a session. Returns sessionId immediately; session runs in background. */
  run(name: string, task: string, opts?: RunOpts): string {
    const def = this.registry.get(name);
    if (!def) throw new Error(`Agent "${name}" not registered`);

    const sessionId = opts?.sessionId ?? generateId();
    const startedAt = Date.now();

    // Setup persistence dirs
    ensureSessionDir(this.persistDir, sessionId);
    mkdirSync(sessionOutputDir(this.persistDir, sessionId), { recursive: true });
    try { writeFileSync(join(sessionDir(this.persistDir, sessionId), "[STARTED]"), new Date().toISOString()); } catch {}

    // Create Agent
    const agent = new Agent({
      initialState: { systemPrompt: def.systemPrompt, model: def.model, tools: def.tools },
      beforeToolCall: def.guards?.length ? composeGuards(...def.guards) : undefined,
      getApiKey: def.getApiKey ? () => def.getApiKey!() : undefined,
    });

    // Persistence
    agent.subscribe((event) => {
      if (event.type === "message_end" && "message" in event) {
        appendSessionMessage(this.persistDir, sessionId, (event as any).message);
      }
    });

    // Event bridge
    this.bridgeEvents(agent, sessionId, name, task, opts);

    // Timeout
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;
    if (def.timeoutMs) {
      timeoutTimer = setTimeout(() => {
        log("warn", `[v2-runtime] ${sessionId} timed out after ${def.timeoutMs}ms`);
        agent.abort();
      }, def.timeoutMs);
    }

    // Run
    const promise = this.executeSession(agent, task, sessionId, name, startedAt, timeoutTimer, opts);

    const session: ActiveSession = { sessionId, agent, agentName: name, task, startedAt, status: "running", promise, timeoutTimer };
    this.sessions.set(sessionId, session);
    this.results.set(sessionId, promise);

    // Cleanup on completion (not paused)
    promise.then((result) => {
      const s = this.sessions.get(sessionId);
      if (s && result.status !== "blocked" && result.status !== "partial") {
        this.sessions.delete(sessionId);
      } else if (s) {
        s.status = "paused";
      }
    });

    return sessionId;
  }

  /** Cancel a running session. */
  cancel(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.timeoutTimer) clearTimeout(session.timeoutTimer);
      session.agent.abort();
    }
  }

  /** List active sessions. */
  status(): SessionInfo[] {
    return [...this.sessions.values()].map(s => ({
      sessionId: s.sessionId,
      agent: s.agentName,
      task: s.task,
      status: "running" as const,
      startedAt: s.startedAt,
    }));
  }

  /** Wait for a session to complete. */
  async waitFor(sessionId: string): Promise<SessionResult> {
    const promise = this.results.get(sessionId);
    if (!promise) throw new Error(`Session "${sessionId}" not found`);
    return promise;
  }

  /** callAgent = run + waitFor (blocking call for workflows). */
  async callAgent(name: string, task: string, opts?: RunOpts): Promise<SessionResult> {
    const sessionId = this.run(name, task, opts);
    return this.waitFor(sessionId);
  }

  /** Number of active sessions. */
  get activeCount(): number { return this.sessions.size; }

  /** Send a message to a session. Steers if running, wakes via followUp if paused. */
  send(sessionId: string, text: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session "${sessionId}" not found`);
    const msg = { role: "user" as const, content: [{ type: "text" as const, text }] };
    if (session.status === "running") {
      session.agent.steer(msg as any);
    } else if (session.status === "paused") {
      session.status = "running";
      session.agent.followUp(msg as any);
    }
  }

  // ── Private ──

  private async executeSession(
    agent: Agent, task: string, sessionId: string, agentName: string,
    startedAt: number, timeoutTimer?: ReturnType<typeof setTimeout>, opts?: RunOpts,
  ): Promise<SessionResult> {
    try {
      await agent.prompt(task);
      await agent.waitForIdle();
    } catch (err) {
      log("error", `[v2-runtime] ${sessionId} failed: ${err}`);
    } finally {
      if (timeoutTimer) clearTimeout(timeoutTimer);
    }

    // Extract result
    const messages = agent.state.messages;
    const finishParams = extractFinishParams(messages as any[]);
    const status = finishParams?.status ?? "unknown";
    const summary = finishParams?.summary ?? extractLastAssistantText(messages as any[]) ?? "";
    const durationMs = Date.now() - startedAt;

    // Remove sentinel
    try { unlinkSync(join(sessionDir(this.persistDir, sessionId), "[STARTED]")); } catch {}

    // Emit session.end
    if (this.bus) {
      this.bus.emit({
        type: "session.end", sessionId, agent: agentName,
        outcome: status, summary, durationMs, status, task,
        finishParams: finishParams as any,
      } as any);
    }

    return { sessionId, status, summary, durationMs, finishParams: finishParams as any };
  }

  private bridgeEvents(agent: Agent, sessionId: string, agentName: string, task: string, opts?: RunOpts): void {
    if (!this.bus) return;
    const bus = this.bus;

    bus.emit({
      type: "session.start", sessionId, agent: agentName, task,
      trigger: opts?.source ?? opts?.kind ?? "runtime",
      firedAt: Date.now(), parentSessionId: opts?.parentSessionId,
      source: opts?.source, kind: opts?.kind,
    } as any);

    let toolCalls = 0;
    let turnStart = Date.now();

    agent.subscribe((event) => {
      switch (event.type) {
        case "turn_start":
          turnStart = Date.now(); toolCalls = 0; break;
        case "tool_execution_start":
          toolCalls++;
          bus.emit({ type: "tool_call", sessionId, agent: agentName, tool: (event as any).toolName, args: (event as any).args });
          break;
        case "tool_execution_end": {
          const blocks = (event as any).result?.content ?? [];
          const text = blocks.find((b: any) => b?.type === "text" && !b.text?.startsWith("<tool_output"))?.text ?? "";
          bus.emit({ type: "tool_result", sessionId, agent: agentName, tool: (event as any).toolName, preview: text.slice(0, 200), isError: !!(event as any).isError });
          break;
        }
        case "turn_end":
          bus.emit({ type: "turn_end", sessionId, agent: agentName, toolCalls, durationMs: Date.now() - turnStart });
          break;
      }
    });
  }
}

// ── Standalone function (for callers that don't need session management) ──

export interface AgentRuntimeConfig {
  agentName: string;
  task: string;
  model: Model<any>;
  systemPrompt: string;
  tools: AgentTool[];
  guards?: BeforeToolCallHook[];
  persistDir: string;
  timeoutMs?: number;
  bus?: EventBus;
  parentSessionId?: string;
  source?: string;
  kind?: string;
  sessionId?: string;
  getApiKey?: () => string;
}

/** Run a single agent session to completion. Stateless convenience wrapper. */
export async function runAgentSession(config: AgentRuntimeConfig): Promise<SessionResult> {
  const registry = new AgentRegistry();
  registry.register({
    name: config.agentName,
    description: "",
    domain: "",
    model: config.model,
    tools: config.tools,
    guards: config.guards,
    systemPrompt: config.systemPrompt,
    timeoutMs: config.timeoutMs,
    getApiKey: config.getApiKey,
  });

  const mgr = new V2SessionManager(registry, config.persistDir, config.bus);
  const sessionId = mgr.run(config.agentName, config.task, {
    sessionId: config.sessionId,
    parentSessionId: config.parentSessionId,
    source: config.source,
    kind: config.kind,
  });
  return mgr.waitFor(sessionId);
}
