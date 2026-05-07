/**
 * V2 Agent Runtime — replaces SubagentManager.
 *
 * Design: pi-agent-core's Agent handles LLM loop, retry, overflow recovery.
 * We handle: persistence, event bridging, timeout, guards, session state.
 *
 * No zombie cleanup, no call depth tracking, no API gating, no health audits.
 * Sessions timeout. Metrics cover health. Pi-agent-core retries.
 *
 * See: agents/shared/may-agent-docs/architecture.md §3 "Agent Runs"
 */

import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentTool, AgentMessage } from "@mariozechner/pi-agent-core";
import type { Model } from "@mariozechner/pi-ai";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import {
  generateId,
  extractLastAssistantText,
  formatDuration,
} from "./manager-utils.js";
import { composeGuards, type BeforeToolCallHook } from "./tools/compose-guards.js";
import {
  ensureSessionDir,
  sessionDir,
  appendSessionMessage,
  sessionOutputDir,
  readSessionMessages,
} from "./persistence.js";
import { extractFinishParams } from "./manager-retry.js";
import type { EventBus } from "../app/event-bus.js";
import type { SubagentDefinition, SessionInfo, TaskResult } from "./types.js";
import type { SessionKind } from "./persistence.js";
import { log } from "./log.js";
import { createAgentsTool as createAgentsToolFn, type CreateAgentsToolOptions } from "./manager-agents-tool.js";

// Re-export utilities that other modules import from manager
export { generateId, formatDuration, truncateForPrompt, computeToolArgsKey, isToolError, getAgentDir, INFRA_RETRY_MAX } from "./manager-utils.js";
export { extractFinishParams } from "./manager-retry.js";
export { classifyError } from "./classify-error.js";
export type { SubagentDefinition, SessionInfo, TaskResult } from "./types.js";
export type { RegisteredAgent } from "./manager-utils.js";

// ── Types ─────────────────────────────────────────────────────────────

export interface RunOptions {
  sessionId?: string;
  parentSessionId?: string;
  parentAgentName?: string;
  originSessionId?: string;
  workflowRunId?: string;
  stepLabel?: string;
  source?: string;
  kind?: SessionKind;
  autoClose?: "immediate" | "never";
  requestId?: string;
  projectId?: string;
  orderId?: string;
  /** Enable compaction for long-lived sessions */
  compaction?: boolean;
}

interface ActiveSession {
  sessionId: string;
  agent: Agent;
  agentName: string;
  task: string;
  startedAt: number;
  status: "running" | "paused" | "idle";
  kind: SessionKind;
  autoClose: "immediate" | "never";
  parentSessionId?: string;
  workflowRunId?: string;
  stepLabel?: string;
  timeoutTimer?: ReturnType<typeof setTimeout>;
  toolCalls: number;
  turnCount: number;
  requestId?: string;
  projectId?: string;
}

export interface SubagentManagerOptions {
  persistDir: string;
  projectRoot?: string;
  bus?: EventBus;
  /** @deprecated v2 doesn't use apiGate — pi-agent-core handles retries */
  apiGate?: any;
  /** @deprecated v2 doesn't use infraRetryMax — pi-agent-core handles retries */
  infraRetryMax?: number;
}

// ── SubagentManager (v2 implementation) ──────────────────────────────

export class SubagentManager {
  // Public maps for AgentsToolManagerDeps compatibility
  agents = new Map<string, { definition: SubagentDefinition }>();
  private sessions = new Map<string, ActiveSession>();
  private results = new Map<string, Promise<TaskResult>>();
  private completedResults = new Map<string, TaskResult>();
  private _persistDir: string;
  private _projectRoot: string;
  private bus?: EventBus;

  /** Expose activeSessions for AgentsToolManagerDeps */
  get activeSessions(): Map<string, ActiveSession> { return this.sessions; }

  constructor(opts: SubagentManagerOptions) {
    this._persistDir = opts.persistDir;
    this._projectRoot = opts.projectRoot ?? opts.persistDir;
    this.bus = opts.bus;
  }

  // ── Registration ──

  register(def: SubagentDefinition): void {
    this.agents.set(def.name, { definition: def });
  }

  unregister(name: string): void {
    this.agents.delete(name);
  }

  hasAgent(name: string): boolean { return this.agents.has(name); }
  agentNames(): string[] { return [...this.agents.keys()]; }
  agentCount(): number { return this.agents.size; }

  listAgents(): Array<{ name: string; description: string; domain: string }> {
    return [...this.agents.values()].map(a => ({
      name: a.definition.name,
      description: a.definition.description,
      domain: a.definition.domain,
    }));
  }

  getAgentDefinition(name: string): SubagentDefinition | undefined {
    return this.agents.get(name)?.definition;
  }

  // ── Session lifecycle ──

  run(name: string, task: string, opts?: RunOptions): string {
    const registered = this.agents.get(name);
    if (!registered) throw new Error(`Agent "${name}" not registered`);
    const def = registered.definition;

    const sessionId = opts?.sessionId ?? generateId(def.sessionIdPrefix);
    const startedAt = Date.now();
    const kind = opts?.kind ?? "job";
    const autoClose = opts?.autoClose ?? "immediate";

    // Setup persistence
    ensureSessionDir(this._persistDir, sessionId);
    mkdirSync(sessionOutputDir(this._persistDir, sessionId), { recursive: true });
    try { writeFileSync(join(sessionDir(this._persistDir, sessionId), "[STARTED]"), new Date().toISOString()); } catch {}

    // Create Agent
    const guards = this.buildGuards(def);
    const agent = new Agent({
      initialState: {
        systemPrompt: def.systemPrompt ?? "",
        model: def.model,
        tools: def.tools,
      },
      beforeToolCall: guards.length ? composeGuards(...guards) : undefined,
      getApiKey: def.apiKey === "dynamic"
        ? () => this.getCopilotToken()
        : def.apiKey ? () => def.apiKey! : undefined,
    });

    // JSONL persistence
    agent.subscribe((event) => {
      if (event.type === "message_end" && "message" in event) {
        appendSessionMessage(this._persistDir, sessionId, (event as any).message);
      }
    });

    const session: ActiveSession = {
      sessionId, agent, agentName: name, task, startedAt,
      status: "running", kind, autoClose,
      parentSessionId: opts?.parentSessionId,
      workflowRunId: opts?.workflowRunId,
      stepLabel: opts?.stepLabel,
      toolCalls: 0, turnCount: 0,
      requestId: opts?.requestId,
      projectId: opts?.projectId,
    };

    // Event bridge
    this.bridgeEvents(session);

    // Timeout
    if (def.timeoutMs) {
      session.timeoutTimer = setTimeout(() => {
        log("warn", `[runtime] ${sessionId} timed out after ${def.timeoutMs}ms`);
        agent.abort();
      }, def.timeoutMs);
    }

    this.sessions.set(sessionId, session);

    // Run agent
    const promise = this.executeSession(session).then((result) => {
      if (result.status === "done" || result.status === "error" || result.status === "interrupted") {
        this.sessions.delete(sessionId);
      } else {
        session.status = "paused";
      }
      this.completedResults.set(sessionId, result);
      return result;
    });
    this.results.set(sessionId, promise);

    return sessionId;
  }

  cancel(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.timeoutTimer) clearTimeout(session.timeoutTimer);
      session.agent.abort();
      this.sessions.delete(sessionId);
    }
  }

  close(sessionId: string): void {
    this.cancel(sessionId);
  }

  /** Send a message to a session (replaces steer/input). */
  send(sessionId: string, text: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    const msg = { role: "user" as const, content: [{ type: "text" as const, text }] };
    if (session.status === "running") {
      session.agent.steer(msg as any);
    } else {
      session.status = "running";
      session.agent.followUp(msg as any);
    }
  }

  /** @deprecated Use send() instead */
  steer(sessionId: string, text: string, _source?: string): "steered" | "queued" {
    this.send(sessionId, text);
    return "steered";
  }

  /** @deprecated Use send() instead */
  async input(sessionId: string, text: string): Promise<TaskResult> {
    this.send(sessionId, text);
    return this.waitFor(sessionId);
  }

  // ── Query ──

  status(): SessionInfo[] {
    return [...this.sessions.values()].map(s => ({
      sessionId: s.sessionId,
      agent: s.agentName,
      task: s.task,
      status: s.status === "running" ? "running" as const : "idle" as const,
      startedAt: s.startedAt,
      runtime: formatDuration(Date.now() - s.startedAt),
      outputDir: sessionOutputDir(this._persistDir, s.sessionId),
      parentSessionId: s.parentSessionId,
      workflowRunId: s.workflowRunId,
      stepLabel: s.stepLabel,
      kind: s.kind,
      autoClose: s.autoClose,
      turnCount: s.turnCount,
    }));
  }

  hasActiveSession(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  result(sessionId: string): TaskResult {
    const completed = this.completedResults.get(sessionId);
    if (completed) return completed;
    throw new Error(`Session "${sessionId}" not found or still running`);
  }

  getSessionSummary(sessionId: string): { task: string; summary: string; status: string } {
    const session = this.sessions.get(sessionId);
    const completed = this.completedResults.get(sessionId);
    return {
      task: session?.task ?? completed?.sessionId ?? "",
      summary: completed?.lastAssistantText ?? "(running)",
      status: completed?.status ?? session?.status ?? "unknown",
    };
  }

  progress(sessionId: string, limit = 20): AgentMessage[] {
    const session = this.sessions.get(sessionId);
    if (session) return (session.agent.state.messages as AgentMessage[]).slice(-limit);
    try { return readSessionMessages(this._persistDir, sessionId).slice(-limit); } catch { return []; }
  }

  // ── Await ──

  async waitFor(sessionId: string): Promise<TaskResult> {
    const promise = this.results.get(sessionId);
    if (!promise) throw new Error(`Session "${sessionId}" not found`);
    return promise;
  }

  async waitForIdle(sessionId: string): Promise<void> {
    await this.waitFor(sessionId);
  }

  async callAgent(
    agentName: string,
    task: string,
    opts?: { parentSessionId?: string; source?: string; workflowRunId?: string; stepLabel?: string },
  ): Promise<TaskResult & { messages: AgentMessage[] }> {
    const sessionId = this.run(agentName, task, {
      parentSessionId: opts?.parentSessionId,
      source: opts?.source ?? "callAgent",
      kind: "call",
      workflowRunId: opts?.workflowRunId,
      stepLabel: opts?.stepLabel,
    });
    const result = await this.waitFor(sessionId);
    return { ...result, messages: this.progress(sessionId, 1000) };
  }

  runAgent(
    agentName: string,
    task: string,
    opts?: { parentSessionId?: string; originSessionId?: string; source?: string; requestId?: string },
  ): string {
    return this.run(agentName, task, {
      parentSessionId: opts?.parentSessionId,
      originSessionId: opts?.originSessionId,
      source: opts?.source ?? "agents.run",
      kind: "job",
      requestId: opts?.requestId,
    });
  }

  // ── Compatibility stubs (v2 doesn't need these) ──

  /** @deprecated No-op in v2. Sessions timeout; no zombies. */
  cleanupZombieSessions(): number { return 0; }

  /** @deprecated No-op in v2. Pi-agent-core handles crash recovery. */
  resumeStaleSessions(_opts?: { abort?: boolean; kinds?: SessionKind[] }): { resumed: any[]; interrupted: any[] } {
    return { resumed: [], interrupted: [] };
  }

  /** @deprecated No-op in v2. */
  resumeInterrupted(_sessionId: string): boolean { return false; }

  /** @deprecated No-op in v2. */
  health(): any { return { sessions: this.sessions.size, agents: this.agents.size }; }

  /** @deprecated No-op in v2. */
  async auditHealth(): Promise<any> { return {}; }

  /** @deprecated No-op in v2. */
  apiGateStatus(): any[] { return []; }

  // ── Tool creation ──

  createAgentsTool(opts?: CreateAgentsToolOptions): AgentTool {
    return createAgentsToolFn(this as any, opts);
  }

  // ── Path helpers ──

  get registryStore(): { persistDir: string; getSession: (id: string) => any; updateSessionStatus: (id: string, status: string, error?: string) => void } {
    return {
      persistDir: this._persistDir,
      getSession: (_id: string) => null,
      updateSessionStatus: () => {},
    };
  }

  /** Alias for AgentsToolManagerDeps compatibility */
  get registry(): { persistDir: string; getSession: (id: string) => any; updateSessionStatus: (id: string, status: string, error?: string) => void } {
    return this.registryStore;
  }

  get projectRoot(): string { return this._projectRoot; }

  getWorkflowSteps(_workflowRunId: string): Array<{ step: string; sessionId: string; summary: string }> {
    // TODO: implement via DB query when needed
    return [];
  }

  getWorkspacePath(name: string): string | undefined {
    return this.agents.get(name)?.definition.workspace;
  }

  getKnowledgePath(name: string): string | undefined {
    return this.agents.get(name)?.definition.knowledgeDir;
  }

  getWorkflowDir(name: string): string | undefined {
    const def = this.agents.get(name)?.definition;
    if (!def?.knowledgeDir) return undefined;
    const { dirname, join: pathJoin } = require("node:path");
    return pathJoin(dirname(def.knowledgeDir), "workflows");
  }

  getOutputPath(sessionId: string): string | undefined {
    return sessionOutputDir(this._persistDir, sessionId);
  }

  // ── Private ──

  private buildGuards(def: SubagentDefinition): BeforeToolCallHook[] {
    // Import guards lazily to avoid circular deps
    const { createFinishGuard } = require("./tools/finish-guard.js");
    const { createReadDedupGuard } = require("./tools/read-dedup-guard.js");
    const { createSessionReadGuard } = require("./tools/session-read-guard.js");
    const { createScrapeDedupGuard } = require("./tools/scrape-dedup-guard.js");
    const { createEmptyArgsGuard } = require("./tools/empty-args-guard.js");
    const { createToolSchemaGuard } = require("./tools/tool-schema-guard.js");
    const { createPathHallucinationGuard } = require("./tools/path-hallucination-guard.js");
    const { createCommitGuard } = require("./tools/commit-guard.js");
    const { createCompletenessGuard } = require("./tools/completeness-guard.js");
    const { createVerificationDepthGuard } = require("./tools/verification-depth-guard.js");
    return [
      createEmptyArgsGuard(),
      createToolSchemaGuard(),
      createPathHallucinationGuard(),
      createCompletenessGuard(def.name),
      createFinishGuard(),
      createCommitGuard(def.name, this.projectRoot),
      createVerificationDepthGuard(def.name, {}),
      createReadDedupGuard(),
      createSessionReadGuard(),
      createScrapeDedupGuard(),
    ];
  }

  private getCopilotToken(): string {
    try {
      const { readFileSync } = require("node:fs");
      const tokenPath = process.env.COPILOT_TOKEN_PATH || "/app/.copilot/api-key.json";
      const data = JSON.parse(readFileSync(tokenPath, "utf-8"));
      return data.token || "";
    } catch { return ""; }
  }

  private async executeSession(session: ActiveSession): Promise<TaskResult> {
    const { agent, sessionId, agentName, task, startedAt } = session;

    try {
      await agent.prompt(task);
      await agent.waitForIdle();
    } catch (err) {
      log("error", `[runtime] ${sessionId} failed: ${err}`);
    } finally {
      if (session.timeoutTimer) clearTimeout(session.timeoutTimer);
    }

    // Extract result
    const messages = agent.state.messages as AgentMessage[];
    const finishParams = extractFinishParams(messages as any[]);
    const status: "done" | "error" | "interrupted" = finishParams?.status === "success" ? "done"
      : finishParams?.status === "failure" ? "error"
      : finishParams?.status === "blocked" ? "interrupted"
      : "done";
    const lastText = finishParams?.summary ?? extractLastAssistantText(messages) ?? "";
    const durationMs = Date.now() - startedAt;

    // Remove sentinel
    try { unlinkSync(join(sessionDir(this._persistDir, sessionId), "[STARTED]")); } catch {}

    // Emit session.end
    if (this.bus) {
      this.bus.emit({
        type: "session.end", sessionId, agent: agentName,
        outcome: status, summary: lastText, durationMs,
        status, task, finishParams: finishParams as any,
      } as any);
    }

    return {
      sessionId,
      status,
      lastAssistantText: lastText,
      messages,
      duration: formatDuration(durationMs),
      outputDir: sessionOutputDir(this._persistDir, sessionId),
      finishResult: finishParams as any,
    };
  }

  private bridgeEvents(session: ActiveSession): void {
    if (!this.bus) return;
    const { agent, sessionId, agentName, task } = session;
    const bus = this.bus;

    bus.emit({
      type: "session.start", sessionId, agent: agentName, task,
      trigger: session.kind ?? "runtime",
      firedAt: session.startedAt,
      parentSessionId: session.parentSessionId,
      kind: session.kind,
    } as any);

    agent.subscribe((event) => {
      switch (event.type) {
        case "turn_start":
          session.turnCount++;
          break;
        case "tool_execution_start":
          session.toolCalls++;
          bus.emit({ type: "tool_call", sessionId, agent: agentName, tool: (event as any).toolName, args: (event as any).args });
          break;
        case "tool_execution_end": {
          const blocks = (event as any).result?.content ?? [];
          const text = blocks.find((b: any) => b?.type === "text" && !b.text?.startsWith("<tool_output"))?.text ?? "";
          bus.emit({ type: "tool_result", sessionId, agent: agentName, tool: (event as any).toolName, preview: text.slice(0, 200), isError: !!(event as any).isError });
          break;
        }
        case "turn_end":
          bus.emit({ type: "turn_end", sessionId, agent: agentName, toolCalls: session.toolCalls, durationMs: 0 });
          break;
      }
    });
  }
}
