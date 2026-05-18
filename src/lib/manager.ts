/**
 * V2 Agent Runtime — replaces SubagentManager.
 *
 * Design: pi-agent-core's Agent handles LLM loop, retry, overflow recovery.
 * We handle: persistence, event bridging, timeout, guards, session state.
 *
 * No zombie cleanup, no call depth tracking, no API gating, no health audits.
 * Sessions timeout. Metrics cover health. Pi-agent-core retries.
 *
 * See: shared/may-agent-docs/architecture.md §3 "Agent Runs"
 */

import { Agent } from "@mariozechner/pi-agent-core";
import type { AgentTool, AgentMessage } from "@mariozechner/pi-agent-core";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  generateId,
  extractLastAssistantText,
  formatDuration,
} from "./manager-utils.js";
import { composeGuards, type BeforeToolCallHook } from "./tools/compose-guards.js";
import {
  ensureSessionDir,
  appendSessionMessage,
  sessionOutputDir,
  readSessionMessages,
  readArchivedSessionMessages,
  loadActiveSessionMetas,
  unarchiveSession,
  RegistryStore,
  sessionDir,
  archiveSession,
} from "./persistence.js";
import { updateSessionDb, listWorkflowRunIds, getWorkflowRun, updateWorkflowRun, hasEvaluation, getDb } from "./requests.js";
import { readIdentity } from "./detached.js";
import type { EventBus } from "../app/event-bus.js";
import type { SubagentDefinition, SessionInfo, TaskResult } from "./types.js";
import type { SessionKind } from "./persistence.js";
import { log } from "./log.js";
import { createAgentsTool as createAgentsToolFn, type CreateAgentsToolOptions } from "./manager-agents-tool.js";
import { signToolOutput, verifyToolOutput, createVerifyReceiptTool } from "./manager-receipts.js";
import { createFinishGuard } from "./tools/finish-guard.js";
import { createReadDedupGuard } from "./tools/read-dedup-guard.js";
import { createSessionReadGuard } from "./tools/session-read-guard.js";
import { createScrapeDedupGuard } from "./tools/scrape-dedup-guard.js";
import { createEmptyArgsGuard } from "./tools/empty-args-guard.js";
import { createToolSchemaGuard } from "./tools/tool-schema-guard.js";
import { createPathHallucinationGuard } from "./tools/path-hallucination-guard.js";
import { createCommitGuard } from "./tools/commit-guard.js";
import { createCompletenessGuard } from "./tools/completeness-guard.js";

// Re-export utilities that other modules import from manager
export {
  generateId,
  formatDuration,
  truncateForPrompt,
  isToolError,
  computeToolArgsKey,
  TOOL_PIVOT_LIMIT,
} from "./manager-utils.js";
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
  startedAt?: number;
  resumeMessages?: AgentMessage[];
  /** Enable compaction for long-lived sessions */
  compaction?: boolean;
}

interface ActiveSession {
  sessionId: string;
  agent: Agent;
  agentName: string;
  task: string;
  startedAt: number;
  status: "running" | "paused" | "idle" | "interrupted";
  kind: SessionKind;
  autoClose: "immediate" | "never";
  parentSessionId?: string;
  originSessionId?: string;
  workflowRunId?: string;
  stepLabel?: string;
  source?: string;
  timeoutTimer?: ReturnType<typeof setTimeout>;
  toolCalls: number;
  turnCount: number;
  requestId?: string;
  projectId?: string;
  resumeMessages?: AgentMessage[];
}

type DispatchDedupDb = {
  records?: Record<string, { agent?: string; lastStatus?: string; taskPrefix?: string }>;
  version?: number;
};

function isHeartbeatSession(meta: { source?: string; task?: string }): boolean {
  const source = meta.source ?? "";
  const task = meta.task ?? "";
  return source.includes("heartbeat")
    || task.includes("waking up for your heartbeat")
    || /^\[heartbeat\]/i.test(task);
}

function releaseStaleHeartbeatDispatchLease(persistDir: string, agent: string): boolean {
  const dedupPath = join(persistDir, "dispatch-dedup.json");
  if (!existsSync(dedupPath)) return false;

  try {
    const db = JSON.parse(readFileSync(dedupPath, "utf8")) as DispatchDedupDb;
    const records = db.records ?? {};
    const record = records[`${agent}::heartbeat`];
    if (!record || record.lastStatus !== "running") return false;

    record.lastStatus = "interrupted";
    writeFileSync(dedupPath, JSON.stringify(db, null, 2));
    return true;
  } catch (err) {
    log("warn", `[manager] Error releasing stale heartbeat dispatch lease for ${agent}: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

function releaseOrphanedHeartbeatDispatchLeases(
  persistDir: string,
  sessions: Record<string, { agent: string; status: string; source?: string; task?: string }>,
): string[] {
  const dedupPath = join(persistDir, "dispatch-dedup.json");
  if (!existsSync(dedupPath)) return [];

  try {
    const db = JSON.parse(readFileSync(dedupPath, "utf8")) as DispatchDedupDb;
    const records = db.records ?? {};
    const activeHeartbeatAgents = new Set(
      Object.values(sessions)
        .filter((session) => (session.status === "running" || session.status === "idle") && isHeartbeatSession(session))
        .map((session) => session.agent),
    );

    const released: string[] = [];
    for (const [key, record] of Object.entries(records)) {
      if (!key.endsWith("::heartbeat") || record.lastStatus !== "running") continue;
      const agent = record.agent || key.slice(0, -"::heartbeat".length);
      if (activeHeartbeatAgents.has(agent)) continue;
      record.lastStatus = "interrupted";
      released.push(agent);
    }

    if (released.length > 0) writeFileSync(dedupPath, JSON.stringify(db, null, 2));
    return released;
  } catch (err) {
    log("warn", `[manager] Error releasing orphaned heartbeat dispatch leases: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }
}

export interface SubagentManagerOptions {
  persistDir: string;
  projectRoot?: string;
  bus?: EventBus;
  maxCallDepth?: number;
  /** @deprecated v2 doesn't use apiGate — pi-agent-core handles retries */
  apiGate?: any;
  /** @deprecated v2 doesn't use infraRetryMax — pi-agent-core handles retries */
  infraRetryMax?: number;
}

// ── Finish extraction ────────────────────────────────────────────────

/** Extract the params from the last finish() tool call, if any. */
function extractFinishParams(messages: any[]): {
  status: string;
  summary: string;
  blockers?: { reason: string; context: string }[];
  deliverables?: { path: string; description: string }[];
  next_steps?: string;
  completed_items?: string[];
  new_items?: string[];
  lessons?: { category: string; content: string }[];
  verification_evidence?: string[];
  context_updates?: { action: string; content: string }[];
} | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant" && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        const rawArgs = block?.arguments ?? block?.args;
        if (block?.type === "toolCall" && block.name === "finish" && rawArgs) {
          try {
            const args = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;
            return {
              status: args.status,
              summary: args.summary,
              blockers: args.blockers,
              deliverables: args.deliverables,
              next_steps: args.next_steps,
              completed_items: args.completed_items,
              new_items: args.new_items,
              lessons: args.lessons,
              verification_evidence: args.verification_evidence,
              context_updates: args.context_updates,
            };
          } catch {
            return null;
          }
        }
      }
    }
  }
  return null;
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

// ── SubagentManager (v2 implementation) ──────────────────────────────

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
  private _createdAt = Date.now();
  private _promptTimestamp = new Date().toISOString();

  /** Expose activeSessions for AgentsToolManagerDeps */
  get activeSessions(): Map<string, ActiveSession> { return this._sessions; }

  constructor(opts: SubagentManagerOptions) {
    this._persistDir = opts.persistDir;
    this._projectRoot = opts.projectRoot ?? opts.persistDir;
    this.bus = opts.bus;
    this._registry = new RegistryStore(opts.persistDir);
    this._maxCallDepth = opts.maxCallDepth ?? 8;
  }

  private emitSessionResumeFailed(
    sessionId: string,
    meta: { agent?: string; workflowRunId?: string; projectId?: string } | null | undefined,
    reason: string,
    category: string,
    recoverable: boolean,
  ): void {
    this.bus?.emit({
      type: "session.resume_failed",
      source: "manager",
      owner: meta?.agent ?? "may",
      sessionId,
      agent: meta?.agent,
      workflowRunId: meta?.workflowRunId,
      projectId: meta?.projectId,
      reason,
      category,
      recoverable,
      nextAction: category === "already_active" ? "resume" : recoverable ? "resume" : "escalate",
      timestamp: Date.now(),
    });
  }

  // ── Registration ──

  register(def: SubagentDefinition): void {
    this.agents.set(def.name, { definition: def });
    this._registry.saveAgent(def);
  }

  unregister(name: string): void {
    this.agents.delete(name);
    this._registry.removeAgent(name);
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
    if (this._sessions.has(sessionId)) throw new Error(`Session "${sessionId}" already active`);
    const startedAt = opts?.startedAt ?? Date.now();
    const kind = opts?.kind ?? "job";
    const autoClose = opts?.autoClose ?? "immediate";

    // Setup persistence
    ensureSessionDir(this._persistDir, sessionId);
    mkdirSync(sessionOutputDir(this._persistDir, sessionId), { recursive: true });
    writeFileSync(join(sessionDir(this._persistDir, sessionId), "[STARTED]"), new Date().toISOString(), "utf-8");

    // Create Agent
    const guards = this.buildGuards(def);
    const beforeToolCall = guards.length
      ? this.createGuardSignalHook(composeGuards(...guards), sessionId, def.name, opts)
      : undefined;
    const agent = new Agent({
      initialState: {
        systemPrompt: this.resolveSystemPrompt(def),
        model: def.model,
        tools: def.tools,
      },
      beforeToolCall,
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
      originSessionId: opts?.originSessionId,
      workflowRunId: opts?.workflowRunId,
      stepLabel: opts?.stepLabel,
      source: opts?.source,
      toolCalls: 0, turnCount: 0,
      requestId: opts?.requestId,
      projectId: opts?.projectId,
      resumeMessages: opts?.resumeMessages,
    };

    const existingMeta = this._registry.getSession(sessionId);
    if (!existingMeta && opts?.resumeMessages?.length) {
      for (const message of opts.resumeMessages) {
        try { appendSessionMessage(this._persistDir, sessionId, message); } catch { /* best-effort */ }
      }
    }
    this._registry.saveSession(sessionId, {
      ...(existingMeta ?? {}),
      agent: name,
      task,
      status: "running",
      startedAt,
      parentSessionId: opts?.parentSessionId ?? existingMeta?.parentSessionId,
      workflowRunId: opts?.workflowRunId ?? existingMeta?.workflowRunId,
      stepLabel: opts?.stepLabel ?? existingMeta?.stepLabel,
      source: opts?.source ?? existingMeta?.source,
      requestId: opts?.requestId ?? existingMeta?.requestId,
      projectId: opts?.projectId ?? existingMeta?.projectId,
      kind,
      autoClose,
      orderId: opts?.orderId ?? existingMeta?.orderId,
    });

    // Event bridge
    this.bridgeEvents(session);

    // Timeout
    if (def.timeoutMs) {
      session.timeoutTimer = setTimeout(() => {
        log("warn", `[runtime] ${sessionId} timed out after ${def.timeoutMs}ms`);
        agent.abort();
      }, def.timeoutMs);
    }

    this._sessions.set(sessionId, session);

    // Run agent
    const promise = this.executeSession(session).then((result) => {
      if (result.status === "done" || result.status === "error" || result.status === "interrupted") {
        this._sessions.delete(sessionId);
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
    const session = this._sessions.get(sessionId);
    if (session) {
      if (session.timeoutTimer) clearTimeout(session.timeoutTimer);
      session.status = "interrupted";
      session.agent.abort();
      this._registry.updateSessionStatus(sessionId, "interrupted", "Cancelled");
      updateSessionDb(this._persistDir, sessionId, {
        status: "interrupted",
        endedAt: Date.now(),
        error: "Cancelled",
        opCount: session.toolCalls,
      });
    }
  }

  close(sessionId: string): void {
    this.cancel(sessionId);
  }

  /** Send a message to a session (replaces steer/input). */
  send(sessionId: string, text: string): void {
    const session = this._sessions.get(sessionId);
    if (!session) throw new Error(`Session "${sessionId}" not found`);
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

  followUp(sessionId: string, text: string): void {
    const session = this._sessions.get(sessionId);
    if (!session) throw new Error(`Session "${sessionId}" not found`);
    session.agent.followUp({ role: "user", content: [{ type: "text", text }] } as any);
  }

  /** @deprecated Use send() instead */
  async input(sessionId: string, text: string): Promise<TaskResult> {
    this.send(sessionId, text);
    return this.waitFor(sessionId);
  }

  // ── Query ──

  status(): SessionInfo[] {
    return [...this._sessions.values()].filter(s => s.status !== "interrupted").map(s => ({
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
    if (completed) return completed;
    return this.resultFromArchive(sessionId);
  }

  getSessionSummary(sessionId: string): { task: string; summary: string; status: string } {
    const session = this._sessions.get(sessionId);
    const completed = this.completedResults.get(sessionId);
    return {
      task: session?.task ?? completed?.sessionId ?? "",
      summary: completed?.lastAssistantText ?? "(running)",
      status: completed?.status ?? session?.status ?? "unknown",
    };
  }

  progress(sessionId: string, limit = 20): AgentMessage[] {
    const normalizedLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 20;
    if (normalizedLimit === 0) return [];

    const session = this._sessions.get(sessionId);
    if (session) return (session.agent.state.messages as AgentMessage[]).slice(-normalizedLimit);

    const persisted = this._registry.getSession(sessionId);
    if (!persisted) throw new Error(`Session "${sessionId}" not found`);

    let messages = readSessionMessages(this._persistDir, sessionId);
    if (messages.length === 0) messages = readArchivedSessionMessages(this._persistDir, sessionId);
    return messages.slice(-normalizedLimit);
  }

  // ── Await ──

  async waitFor(sessionId: string): Promise<TaskResult> {
    const promise = this.results.get(sessionId);
    const completed = this.completedResults.get(sessionId);
    if (completed) return completed;
    if (!promise) throw new Error(`Session "${sessionId}" not found`);
    return promise;
  }

  async waitForIdle(sessionId: string): Promise<void> {
    await this.waitFor(sessionId);
  }

  async callAgent(
    agentName: string,
    task: string,
    opts?: { parentSessionId?: string; source?: string; workflowRunId?: string; projectId?: string; stepLabel?: string },
  ): Promise<TaskResult & { messages: AgentMessage[] }> {
    const parentDepth = opts?.parentSessionId ? (this.callDepths.get(opts.parentSessionId) ?? 0) : 0;
    if (parentDepth >= this._maxCallDepth) {
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
    const sessionId = this.run(agentName, task, {
      parentSessionId: opts?.parentSessionId,
      source: opts?.source ?? "callAgent",
      kind: "call",
      workflowRunId: opts?.workflowRunId,
      projectId: opts?.projectId,
      stepLabel: opts?.stepLabel,
    });
    this.callDepths.set(sessionId, parentDepth + 1);
    const result = await this.waitFor(sessionId);
    return { ...result, messages: this.progress(sessionId, 1000) };
  }

  runAgent(
    agentName: string,
    task: string,
    opts?: { parentSessionId?: string; originSessionId?: string; source?: string; requestId?: string; workflowRunId?: string; projectId?: string },
  ): string {
    return this.run(agentName, task, {
      parentSessionId: opts?.parentSessionId,
      originSessionId: opts?.originSessionId,
      source: opts?.source ?? "agents.run",
      kind: "job",
      requestId: opts?.requestId,
      workflowRunId: opts?.workflowRunId,
      projectId: opts?.projectId,
    });
  }

  // ── Compatibility stubs (v2 doesn't need these) ──

  /** @deprecated No-op in v2. Sessions timeout; no zombies. */
  cleanupZombieSessions(): number { return 0; }

  /** Resume or interrupt sessions left running by a previous process. */
  resumeStaleSessions(opts?: { abort?: boolean; kinds?: SessionKind[] }): { resumed: SessionInfo[]; interrupted: SessionInfo[] } {
    const activeSessions = loadActiveSessionMetas(this._persistDir);
    const kindFilter = opts?.kinds ? new Set(opts.kinds) : null;
    const stale = new Map<string, (typeof activeSessions)[string]>();

    // meta.json is the session source of truth. Reconcile SQL rows on boot so
    // cancelled/interrupted sessions do not remain visible as running after a
    // process restart or older cancel path.
    for (const [sessionId, persisted] of Object.entries(activeSessions)) {
      if (persisted.status === "done" || persisted.status === "error" || persisted.status === "interrupted") {
        updateSessionDb(this._persistDir, sessionId, {
          status: persisted.status,
          endedAt: persisted.endedAt ?? Date.now(),
          error: persisted.error,
        });
      }
    }

    const sessionsRoot = join(this._persistDir, "sessions");
    if (existsSync(sessionsRoot)) {
      try {
        for (const dirName of readdirSync(sessionsRoot)) {
          if (dirName === "history") continue;
          const sentinelPath = join(sessionsRoot, dirName, "[STARTED]");
          if (!existsSync(sentinelPath)) continue;
          const persisted = activeSessions[dirName];
          if (!persisted) {
            try { unlinkSync(sentinelPath); } catch {}
            continue;
          }
          const kind = persisted.kind ?? "job";
          if (kindFilter && !kindFilter.has(kind)) continue;
          if (persisted.status === "running" || persisted.status === "idle") {
            stale.set(dirName, persisted);
          }
          try { unlinkSync(sentinelPath); } catch {}
        }
      } catch (err) {
        log("warn", `[manager] Error scanning stale sentinels: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    for (const [sessionId, persisted] of Object.entries(activeSessions)) {
      if (stale.has(sessionId)) continue;
      if (persisted.status !== "running" && persisted.status !== "idle") continue;
      const kind = persisted.kind ?? "job";
      if (kindFilter && !kindFilter.has(kind)) continue;
      if (persisted.detached && isProcessAlive(persisted.pid)) continue;
      stale.set(sessionId, persisted);
    }

    const resumed: SessionInfo[] = [];
    const interrupted: SessionInfo[] = [];

    for (const [sessionId, persisted] of stale) {
      if (isHeartbeatSession(persisted) && releaseStaleHeartbeatDispatchLease(this._persistDir, persisted.agent)) {
        log("info", `[manager] Released stale heartbeat dispatch lease for ${persisted.agent} from ${sessionId}`);
      }

      if (opts?.abort) {
        const error = "Clean start (fresh)";
        this._registry.updateSessionStatus(sessionId, "interrupted", error);
        updateSessionDb(this._persistDir, sessionId, { status: "interrupted", endedAt: Date.now(), error });
        interrupted.push(this.sessionInfoFromMeta(sessionId, { ...persisted, status: "interrupted", error }));
        continue;
      }

      if (!this.agents.has(persisted.agent)) {
        const error = "Process restarted (agent not registered)";
        this._registry.updateSessionStatus(sessionId, "interrupted", error);
        updateSessionDb(this._persistDir, sessionId, { status: "interrupted", endedAt: Date.now(), error });
        this.emitSessionResumeFailed(sessionId, persisted, error, "agent_not_registered", false);
        interrupted.push(this.sessionInfoFromMeta(sessionId, { ...persisted, status: "interrupted", error }));
        continue;
      }

      const resumeMessages = this.buildResumeMessages(sessionId);
      try {
        this.run(persisted.agent, persisted.task, {
          sessionId,
          parentSessionId: persisted.parentSessionId,
          workflowRunId: persisted.workflowRunId,
          stepLabel: persisted.stepLabel,
          source: persisted.source ?? "resumeStaleSessions",
          kind: persisted.kind ?? "job",
          autoClose: persisted.autoClose ?? "immediate",
          requestId: persisted.requestId,
          projectId: persisted.projectId,
          orderId: persisted.orderId,
          startedAt: persisted.startedAt,
          resumeMessages,
        });
        try { unlinkSync(join(sessionDir(this._persistDir, sessionId), "[STARTED]")); } catch {}
        resumed.push(this.sessionInfoFromMeta(sessionId, { ...persisted, status: "running" }));
      } catch (err) {
        const error = `Failed to resume session: ${err instanceof Error ? err.message : String(err)}`;
        this._registry.updateSessionStatus(sessionId, "interrupted", error);
        updateSessionDb(this._persistDir, sessionId, { status: "interrupted", endedAt: Date.now(), error });
        this.emitSessionResumeFailed(sessionId, persisted, error, "resume_run_failed", true);
        try { unlinkSync(join(sessionDir(this._persistDir, sessionId), "[STARTED]")); } catch {}
        interrupted.push(this.sessionInfoFromMeta(sessionId, { ...persisted, status: "interrupted", error }));
      }
    }

    this.cleanupStaleWorkflowRuns();
    const releasedOrphanLeases = releaseOrphanedHeartbeatDispatchLeases(this._persistDir, activeSessions);
    for (const agent of releasedOrphanLeases) {
      log("info", `[manager] Released orphaned heartbeat dispatch lease for ${agent}`);
    }
    return { resumed, interrupted };
  }

  /** @deprecated No-op in v2. */
  resumeInterrupted(_sessionId: string): boolean { return false; }

  /**
   * Resume a cold (done/error/interrupted) session with a new user message.
   *
   * Reuses the original sessionId so the JSONL transcript grows in place
   * (Telegram-style: one persistent thread per chat). The new message is
   * appended after the rebuilt transcript as the next user turn.
   *
   * Throws if the session is unknown or already active in memory — callers
   * should check `_sessions.has(sessionId)` first and use steer/input for
   * live sessions.
   */
  resumeSession(sessionId: string, message: string, opts?: { source?: string }): string {
    if (this._sessions.has(sessionId)) {
      const reason = `Session "${sessionId}" is already active — use steer/input instead`;
      this.emitSessionResumeFailed(sessionId, this._registry.getSession(sessionId), reason, "already_active", true);
      throw new Error(reason);
    }
    const meta = this._registry.getSession(sessionId);
    if (!meta) {
      const reason = `Session "${sessionId}" not found`;
      this.emitSessionResumeFailed(sessionId, null, reason, "session_not_found", false);
      throw new Error(reason);
    }
    if (!this.agents.has(meta.agent)) {
      const reason = `Agent "${meta.agent}" is not registered (cannot resume session ${sessionId})`;
      this.emitSessionResumeFailed(sessionId, meta, reason, "agent_not_registered", false);
      throw new Error(reason);
    }

    // Promote the JSONL/output dir back to live before reading the prior
    // transcript or running the agent. archiveSession() moves a finished
    // session to history/<sid>/; resume needs that content back in
    // sessions/<sid>/ so appendSessionMessage and the transcript reader
    // both see the full thread.
    try { unarchiveSession(this._persistDir, sessionId); } catch { /* best-effort */ }

    // Rebuild prior transcript with any pending tool-calls repaired.
    const resumeMessages = this.buildResumeMessages(sessionId);

    // Replace the auto-generated "Process restarted..." tail with the
    // operator's actual message. buildResumeMessages always ends with a user
    // turn (either the original last user turn, or the synthetic restart
    // notice it just appended). We overwrite the tail when it is the
    // synthetic notice so the new user turn lands cleanly.
    const tail: any = resumeMessages[resumeMessages.length - 1];
    const isSyntheticRestart = tail?.role === "user"
      && Array.isArray(tail.content)
      && tail.content[0]?.type === "text"
      && /^Process restarted\./.test(String(tail.content[0]?.text ?? ""));
    if (isSyntheticRestart) resumeMessages.pop();
    const newUserTurn: any = {
      role: "user",
      content: [{ type: "text", text: message }],
      timestamp: Date.now(),
    };
    resumeMessages.push(newUserTurn);
    // Persist the injected user turn to JSONL now — message_end events only
    // fire for messages the agent itself emits, so without this the operator's
    // turn would not appear in transcript views.
    try { appendSessionMessage(this._persistDir, sessionId, newUserTurn); } catch { /* best-effort */ }

    // Clear stale endedAt/error in the DB row so the session looks fresh
    // again. updateSessionDb uses COALESCE(?, endedAt) which keeps the old
    // value on null, so we have to write directly.
    try {
      const db = getDb(this._persistDir);
      db.run(`UPDATE sessions SET status = 'running', endedAt = NULL, error = NULL WHERE sessionId = ?`, [sessionId]);
    } catch { /* best-effort — manager.run will re-save the registry row */ }

    try {
      this.run(meta.agent, meta.task, {
        sessionId,
        parentSessionId: meta.parentSessionId,
        workflowRunId: meta.workflowRunId,
        stepLabel: meta.stepLabel,
        source: opts?.source ?? "resume",
        kind: meta.kind ?? "job",
        autoClose: meta.autoClose ?? "immediate",
        requestId: meta.requestId,
        orderId: meta.orderId,
        startedAt: meta.startedAt,
        resumeMessages,
      });
    } catch (err) {
      const reason = `Failed to resume session: ${err instanceof Error ? err.message : String(err)}`;
      this.emitSessionResumeFailed(sessionId, meta, reason, "resume_run_failed", true);
      throw err;
    }
    return sessionId;
  }

  health(): any {
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
        idle: activeSessions.filter((s) => s.status === "idle").length,
        total: activeSessions.length,
      },
    };
  }

  async auditHealth(): Promise<any> {
    const sessions = this._registry.getRegistry().sessions;
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const allSessions = Object.entries(sessions);
    const unevaluated = allSessions.filter(([sid, s]) =>
      (s.status === "done" || s.status === "error" || s.status === "interrupted") &&
      !hasEvaluation(this._persistDir, sid),
    );
    const metaAgents = new Set(["evaluator", "optimizer", "may"]);
    const staleSessions = allSessions
      .filter(([sid, s]) => (s.status === "running" || s.status === "idle") && !this._sessions.has(sid))
      .map(([sessionId, s]) => ({ sessionId, agent: s.agent, task: s.task, startedAt: s.startedAt, status: s.status }));
    const workflowRuns = listWorkflowRunIds(this._persistDir)
      .map((id) => getWorkflowRun(this._persistDir, id))
      .filter(Boolean) as any[];

    return {
      timestamp: new Date().toISOString(),
      sessionsLast24h: allSessions.filter(([, s]) => s.startedAt >= dayAgo).length,
      totalPersistedSessions: allSessions.length,
      unevaluated: {
        total: unevaluated.length,
        actionable: unevaluated.filter(([, s]) => !metaAgents.has(s.agent)).length,
        autoSkippable: unevaluated.filter(([, s]) => metaAgents.has(s.agent)).length,
      },
      staleSessions,
      workflowRuns: {
        total: workflowRuns.length,
        completed: workflowRuns.filter((r) => r.status === "done").length,
        running: workflowRuns.filter((r) => r.status === "running").length,
        interrupted: workflowRuns.filter((r) => r.status === "interrupted").length,
      },
    };
  }

  async reconcileHealth(): Promise<any> {
    const health = this.health();
    const audit = await this.auditHealth();
    const discrepancies = audit.staleSessions.map((s: any) => `Stale session ${s.sessionId} (${s.agent})`);
    return {
      healthy: discrepancies.length === 0,
      discrepancies,
      health,
      audit,
    };
  }

  /** @deprecated No-op in v2. */
  apiGateStatus(): any[] { return []; }

  // ── Tool creation ──

  createAgentsTool(opts?: CreateAgentsToolOptions): AgentTool {
    return createAgentsToolFn(this as any, opts);
  }

  // ── Path helpers ──

  get registryStore(): RegistryStore {
    return this._registry;
  }

  /** Alias for AgentsToolManagerDeps compatibility */
  get registry(): RegistryStore { return this._registry; }

  get projectRoot(): string { return this._projectRoot; }

  getWorkflowSteps(_workflowRunId: string): Array<{ step: string; sessionId: string; summary: string }> {
    // TODO: implement via DB query when needed
    return [];
  }

  getSessionTree(sessionId: string): any {
    const registrySessions = this._registry.getRegistry().sessions;
    const buildNode = (sid: string): any => {
      const active = this._sessions.get(sid);
      const persisted = registrySessions[sid];
      if (!active && !persisted) throw new Error(`Session "${sid}" not found`);
      const rawStatus = active?.status ?? persisted.status;
      const messages = active ? (active.agent.state.messages as AgentMessage[]) : this.progress(sid, 1000);
      const node = {
        sessionId: sid,
        agent: active?.agentName ?? persisted.agent,
        task: active?.task ?? persisted.task,
        status: this.treeStatus(rawStatus),
        startedAt: active?.startedAt ?? persisted.startedAt,
        endedAt: persisted?.endedAt,
        result: rawStatus === "done" ? extractLastAssistantText(messages) : undefined,
        children: [] as any[],
      };
      for (const [childId, child] of this._sessions) {
        if (child.parentSessionId === sid) node.children.push(buildNode(childId));
      }
      for (const [childId, child] of Object.entries(registrySessions)) {
        if (this._sessions.has(childId)) continue;
        if (child.parentSessionId === sid) node.children.push(buildNode(childId));
      }
      return node;
    };
    return buildNode(sessionId);
  }

  trace(targetId: string): any | null {
    const registrySessions = this._registry.getRegistry().sessions;
    const targetSession = this._sessions.get(targetId) ?? registrySessions[targetId];
    if (targetSession) {
      return {
        targetId,
        tree: {
          type: "session",
          id: targetId,
          label: "agentName" in targetSession ? (targetSession as ActiveSession).agentName : (targetSession as any).agent,
          isTarget: true,
          children: [],
        },
        path: [`session:${targetId}`],
      };
    }

    const targetRun = getWorkflowRun(this._persistDir, targetId);
    if (!targetRun) return null;

    const buildWorkflowNode = (runId: string): any => {
      const run = getWorkflowRun(this._persistDir, runId);
      if (!run) return null;
      const children = listWorkflowRunIds(this._persistDir)
        .map((id) => getWorkflowRun(this._persistDir, id))
        .filter((child: any) => child?.parentWorkflowRunId === runId)
        .map((child: any) => buildWorkflowNode(child.runId))
        .filter(Boolean);
      return {
        type: "workflow",
        id: run.runId,
        label: run.workflow,
        depth: run.depth,
        isTarget: run.runId === targetId,
        children,
      };
    };

    const rootRunId = (() => {
      let current = targetRun;
      while (current.parentWorkflowRunId) {
        const parent = getWorkflowRun(this._persistDir, current.parentWorkflowRunId);
        if (!parent) break;
        current = parent;
      }
      return current.runId;
    })();
    const rootRun = getWorkflowRun(this._persistDir, rootRunId)!;
    const rootSessionId = rootRun.parentSessionId ?? "unknown";
    const workflowTree = buildWorkflowNode(rootRunId);
    const path: string[] = [`session:${rootSessionId}`];
    const addPath = (node: any): boolean => {
      path.push(`workflow:${node.label} (${node.id})`);
      if (node.id === targetId) return true;
      for (const child of node.children ?? []) {
        if (addPath(child)) return true;
      }
      path.pop();
      return false;
    };
    addPath(workflowTree);

    return {
      targetId,
      tree: {
        type: "session",
        id: rootSessionId,
        label: rootSessionId,
        isTarget: rootSessionId === targetId,
        children: [workflowTree],
      },
      path,
    };
  }

  private treeStatus(status: string): "running" | "completed" | "cancelled" {
    if (status === "done") return "completed";
    if (status === "error" || status === "interrupted") return "cancelled";
    return "running";
  }

  getWorkspacePath(name: string): string | undefined {
    return this.agents.get(name)?.definition.workspace;
  }

  getKnowledgePath(name: string): string | undefined {
    return this.agents.get(name)?.definition.knowledgeDir;
  }

  getWorkflowDir(name: string): string | undefined {
    const def = this.agents.get(name)?.definition;
    const basePath = def?.workspace ?? def?.knowledgeDir;
    if (!basePath) return undefined;
    return join(dirname(basePath), "workflows");
  }

  getOutputPath(sessionId: string): string | undefined {
    if (!this._sessions.has(sessionId) && !this._registry.getSession(sessionId)) {
      return undefined;
    }
    return sessionOutputDir(this._persistDir, sessionId);
  }

  async waitForDetached(sessionId: string, opts?: { pollIntervalMs?: number; timeoutMs?: number }): Promise<TaskResult> {
    const pollInterval = opts?.pollIntervalMs ?? 2000;
    const timeoutMs = opts?.timeoutMs ?? 600_000;
    const initialMeta = this._registry.getSession(sessionId);
    if (!initialMeta) throw new Error(`Session "${sessionId}" not found`);
    if (initialMeta.status !== "running" && initialMeta.status !== "idle") {
      return this.resultFromArchive(sessionId);
    }

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const meta = this._registry.getSession(sessionId);
      if (meta && meta.status !== "running" && meta.status !== "idle") {
        return this.resultFromArchive(sessionId);
      }
      if (initialMeta.instance) {
        const identity = readIdentity(this._persistDir, initialMeta.instance);
        if (identity && identity.status !== "running") {
          await new Promise((resolve) => setTimeout(resolve, 500));
          const finalMeta = this._registry.getSession(sessionId);
          if (finalMeta && finalMeta.status !== "running" && finalMeta.status !== "idle") {
            return this.resultFromArchive(sessionId);
          }
          this._registry.updateSessionStatus(sessionId, "error", "Process exited without completing");
          return this.resultFromArchive(sessionId);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
    throw new Error(`Timeout waiting for detached session "${sessionId}" (${timeoutMs}ms)`);
  }

  signToolOutput(output: string): string {
    return signToolOutput(output);
  }

  verifyToolOutput(content: string, signature: string): boolean {
    return verifyToolOutput(content, signature);
  }

  createVerifyReceiptTool(): AgentTool {
    return createVerifyReceiptTool();
  }

  private cleanupStaleWorkflowRuns(): void {
    for (const runId of listWorkflowRunIds(this._persistDir)) {
      const run = getWorkflowRun(this._persistDir, runId);
      if (run?.status === "running") {
        updateWorkflowRun(this._persistDir, runId, {
          status: "interrupted",
          endedAt: Date.now(),
          result_reason: "Process restarted",
        });
      }
    }
  }

  private buildResumeMessages(sessionId: string): AgentMessage[] {
    let messages = readSessionMessages(this._persistDir, sessionId);
    if (messages.length === 0) messages = readArchivedSessionMessages(this._persistDir, sessionId);
    const repaired = messages.slice();
    const last = repaired[repaired.length - 1] as any;
    const pendingToolCalls = last?.role === "assistant" && Array.isArray(last.content)
      ? last.content.filter((block: any) => block?.type === "toolCall")
      : [];
    for (const call of pendingToolCalls) {
      repaired.push({
        role: "toolResult",
        toolCallId: call.id,
        isError: true,
        content: [{ type: "text", text: "Tool call interrupted because the process restarted." }],
        timestamp: Date.now(),
      } as any);
    }

    const updatedLast = repaired[repaired.length - 1] as any;
    if (updatedLast?.role && updatedLast.role !== "user") {
      repaired.push({
        role: "user",
        content: [{ type: "text", text: "Process restarted. Continue where you left off." }],
        timestamp: Date.now(),
      } as any);
    }
    return repaired;
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

  private resultFromArchive(sessionId: string): TaskResult {
    const persisted = this._registry.getSession(sessionId);
    if (!persisted) throw new Error(`Session "${sessionId}" not found`);
    if (persisted.status === "running" || persisted.status === "idle") {
      throw new Error(`Session "${sessionId}" is still running (stale registry entry)`);
    }
    let messages = readSessionMessages(this._persistDir, sessionId);
    if (messages.length === 0) messages = readArchivedSessionMessages(this._persistDir, sessionId);
    return {
      sessionId,
      status: persisted.status === "interrupted" ? "interrupted" : (persisted.status as "done" | "error"),
      lastAssistantText: extractLastAssistantText(messages),
      messages,
      duration: formatDuration((persisted.endedAt ?? Date.now()) - persisted.startedAt),
      outputDir: sessionOutputDir(this._persistDir, sessionId),
      error: persisted.error,
      finishResult: extractFinishParams(messages as any[]) as any,
    };
  }

  private resolveSystemPrompt(def: SubagentDefinition | undefined): string {
    if (!def) return "";
    if (def.systemPrompt !== undefined) return def.systemPrompt;

    const agentDir = this.resolveAgentDir(def);
    const sections: string[] = [];

    const shared = this.loadPromptFile(this.resolveSharedPromptPath(agentDir));
    if (shared) sections.push(shared);

    if (agentDir) {
      const identity = this.loadPromptFile(join(agentDir, "AGENTS.md"));
      if (identity) sections.push(identity);
    }

    sections.push(this.runtimeEnvironment(def, agentDir));
    return `<system_instructions>\n${sections.join("\n\n")}\n</system_instructions>`;
  }

  private resolveAgentDir(def: SubagentDefinition): string | undefined {
    if (def.agentDir) return def.agentDir;
    if (def.knowledgeDir) return dirname(def.knowledgeDir);
    if (def.workspace) return dirname(def.workspace);
    const root = def.projectRoot ?? this._projectRoot;
    return root ? join(root, "agents", def.name) : undefined;
  }

  private resolveSharedPromptPath(_agentDir: string | undefined): string {
    return join(this._projectRoot, "shared", "common-sense.md");
  }

  private loadPromptFile(path: string): string | undefined {
    if (!existsSync(path)) return undefined;
    const text = readFileSync(path, "utf-8").trim();
    return text || undefined;
  }

  private runtimeEnvironment(def: SubagentDefinition, agentDir: string | undefined): string {
    const root = def.projectRoot ?? this._projectRoot;
    const relAgentDir = agentDir && root && agentDir.startsWith(root)
      ? agentDir.slice(root.length + 1)
      : agentDir;
    const relWorkspace = def.workspace && root && def.workspace.startsWith(root)
      ? def.workspace.slice(root.length + 1)
      : def.workspace;
    const relKnowledge = def.knowledgeDir && root && def.knowledgeDir.startsWith(root)
      ? def.knowledgeDir.slice(root.length + 1)
      : def.knowledgeDir;

    const toolNames = def.tools.map((tool: any) => tool?.name).filter(Boolean);
    const lines = ["# Runtime Environment"];
    lines.push(`- Project root: ${root}`);
    if (relAgentDir) lines.push(`- Agent directory: ${relAgentDir}`);
    if (relWorkspace) lines.push(`- Workspace: ${relWorkspace} (scratch/runtime work)`);
    if (relKnowledge) lines.push(`- Knowledge: ${relKnowledge} (read on demand; start with INDEX.md when needed)`);
    lines.push("- Already in context: shared/common-sense.md and this agent's AGENTS.md when present.");
    lines.push("- Prompt precedence: common-sense is the shared default; this agent's AGENTS.md is the role-specific identity layer and takes precedence for agent-specific behavior.");
    if (toolNames.length > 0) {
      lines.push(`- Available tools: ${toolNames.join(", ")}`);
    }
    lines.push(`- Current time: ${this._promptTimestamp}`);
    lines.push("");
    lines.push("All paths are relative to project root unless absolute paths are explicitly provided.");
    return lines.join("\n");
  }

  // ── Private ──

  private buildGuards(def: SubagentDefinition): BeforeToolCallHook[] {
    return [
      createEmptyArgsGuard(),
      createToolSchemaGuard(),
      createPathHallucinationGuard(),
      createCompletenessGuard(def.name),
      createFinishGuard(),
      createCommitGuard(def.name, this.projectRoot),
      createReadDedupGuard(),
      createSessionReadGuard(),
      createScrapeDedupGuard(),
    ];
  }

  private createGuardSignalHook(
    hook: BeforeToolCallHook,
    sessionId: string,
    agentName: string,
    opts?: RunOptions,
  ): BeforeToolCallHook {
    return async (context, signal) => {
      const result = await hook(context, signal);
      if (result) {
        this.bus?.emit({
          type: "guard.triggered",
          owner: agentName,
          source: "tool",
          workflowRunId: opts?.workflowRunId,
          projectId: opts?.projectId,
          parentSessionId: opts?.parentSessionId,
          sessionId,
          guard: "beforeToolCall",
          demandType: result.block ? "block" : "warn",
          action: result.block ? "blocked" : "warned",
          reason: result.reason,
          sourceEventType: `tool.${context.toolCall.name}`,
        });
      }
      return result;
    };
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
    let errorText: string | undefined;

    try {
      if (session.resumeMessages) {
        agent.state.messages = session.resumeMessages as any;
      }
      await agent.prompt(task);
      await agent.waitForIdle();
    } catch (err) {
      errorText = err instanceof Error ? err.message : String(err);
      log("error", `[runtime] ${sessionId} failed: ${err}`);
    } finally {
      if (session.timeoutTimer) clearTimeout(session.timeoutTimer);
      try { unlinkSync(join(sessionDir(this._persistDir, sessionId), "[STARTED]")); } catch {}
    }

    // Extract result
    const messages = agent.state.messages as AgentMessage[];
    const finishParams = extractFinishParams(messages as any[]);
    const assistantText = extractLastAssistantText(messages);
    if (!errorText && !finishParams && !assistantText) {
      errorText = "Agent ended without producing a response";
    }
    const status: "done" | "error" | "interrupted" = session.status === "interrupted" ? "interrupted"
      : finishParams?.status === "failure" ? "error"
      : errorText ? "error"
      // finish(blocked) and finish(partial) are deliberate terminal reports,
      // not runtime interruptions. The structured finish status carries the
      // blocked/partial meaning for workflows and evaluators.
      : "done";
    const lastText = finishParams?.summary ?? assistantText ?? "";
    const durationMs = Date.now() - startedAt;
    this._registry.updateSessionStatus(sessionId, status, errorText);
    updateSessionDb(this._persistDir, sessionId, {
      status,
      endedAt: Date.now(),
      error: errorText,
      outcome: lastText,
      opCount: session.toolCalls,
    });

    // Emit session.end
    if (this.bus) {
      this.bus.emit({
        type: "session.end", sessionId, agent: agentName,
        outcome: status, summary: lastText, durationMs,
        status, task, finishParams: finishParams as any,
        opCount: session.toolCalls,
        turnCount: session.turnCount,
        parentSessionId: session.parentSessionId,
        workflowRunId: session.workflowRunId,
        projectId: session.projectId,
        source: session.source,
        kind: session.kind,
        requestId: session.requestId,
        stepLabel: session.stepLabel,
      } as any);
    }

    if (session.autoClose === "immediate") {
      try { archiveSession(this._persistDir, sessionId); } catch {}
    }

    return {
      sessionId,
      status,
      lastAssistantText: lastText,
      messages,
      duration: formatDuration(durationMs),
      outputDir: sessionOutputDir(this._persistDir, sessionId),
      error: errorText,
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
      workflowRunId: session.workflowRunId,
      projectId: session.projectId,
      source: session.source,
      kind: session.kind,
      requestId: session.requestId,
      stepLabel: session.stepLabel,
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
        case "message_end": {
          const message = (event as any).message;
          if (message?.role !== "assistant" || !Array.isArray(message.content)) break;
          const text = message.content
            .filter((block: any) => block?.type === "text" && typeof block.text === "string" && block.text.trim())
            .map((block: any) => block.text)
            .join("\n")
            .trim();
          if (text) bus.emit({ type: "text", sessionId, agent: agentName, text });
          break;
        }
        case "turn_end":
          bus.emit({ type: "turn_end", sessionId, agent: agentName, toolCalls: session.toolCalls, durationMs: 0 });
          break;
      }
    });
  }
}
