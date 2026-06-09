/**
 * Agents tool — lets agents cooperate: call, fork, context, list, peek, cancel, requests.
 *
 * Takes manager dependencies as parameters to avoid circular imports.
 */

import type { AgentMessage, AgentTool, AgentToolResult } from "@earendil-works/pi-agent-core";
import { Type, StringEnum } from "@earendil-works/pi-ai";
import type { RegisteredAgent } from "./manager-utils.js";
import type { SessionInfo, TaskResult } from "./types.js";
import type { PersistedSession } from "./persistence.js";
import { getDb } from "./requests.js";

// ── Manager interface ──────────────────────────────────────────────────
// Instead of importing the full SubagentManager class (circular dependency),
// we define only the methods/properties the agents tool needs.

export interface AgentsToolManagerDeps {
  agents: Map<string, RegisteredAgent>;
  activeSessions: Map<string, { parentSessionId?: string; originSessionId?: string; workflowRunId?: string; projectId?: string }>;
  callAgent(
    agentName: string,
    task: string,
    opts?: { parentSessionId?: string; workflowRunId?: string; projectId?: string; source?: string },
  ): Promise<TaskResult & { messages: AgentMessage[] }>;
  runAgent(
    agentName: string,
    task: string,
    opts?: { parentSessionId?: string; originSessionId?: string; source?: string; requestId?: string; workflowRunId?: string; projectId?: string },
  ): string;
  status(): SessionInfo[];
  progress(sessionId: string, limit?: number): AgentMessage[];
  hasActiveSession(sessionId: string): boolean;
  cancel(sessionId: string): void;
  getSessionSummary(sessionId: string): { task: string; summary: string; status: string };
  getWorkflowSteps(workflowRunId: string): Array<{ step: string; sessionId: string; summary: string }>;
  registry: {
    persistDir: string;
    getSession(sessionId: string): PersistedSession | null;
    updateSessionStatus(
      sessionId: string,
      status: "running" | "done" | "error" | "interrupted" | "idle",
      error?: string,
    ): void;
  };
}

export interface CreateAgentsToolOptions {
  /** Returns the current caller's session ID for parent→child linking. */
  getCallerSessionId?: () => string | undefined;
  /** Returns the current caller's agent name. */
  getCallerAgentName?: () => string | undefined;
  /** Agent names that cannot be called directly. Returns error with hint. */
  callDeny?: { agents: string[]; hint: string };
  /** Root directory of agent definitions (for message action). */
  agentsRoot?: string;
  /** Trigger an agent's heartbeat cron (for message action). */
  triggerHeartbeat?: (agentName: string) => boolean;
  /** EventBus for emitting message events. When set, message action emits on bus instead of writing to DB directly. */
  bus?: { emit(event: Record<string, unknown>): void };
}

// ── Detached cancel helpers ────────────────────────────────────────────
// Lazy-imported to avoid pulling in socket-client at module level.

let _readIdentity: typeof import("./detached.js").readIdentity | undefined;
let _sendSocketCommand: typeof import("./socket-client.js").sendSocketCommand | undefined;

async function loadDetachedHelpers(): Promise<{
  readIdentity: typeof import("./detached.js").readIdentity;
  sendSocketCommand: typeof import("./socket-client.js").sendSocketCommand;
}> {
  if (!_readIdentity) {
    const mod = await import("./detached.js");
    _readIdentity = mod.readIdentity;
  }
  if (!_sendSocketCommand) {
    const mod = await import("./socket-client.js");
    _sendSocketCommand = mod.sendSocketCommand;
  }
  return { readIdentity: _readIdentity, sendSocketCommand: _sendSocketCommand };
}

// ── Main export ────────────────────────────────────────────────────────

function textResult(text: string): AgentToolResult<string> {
  return {
    content: [{ type: "text", text }],
    details: text,
  };
}

const AgentsToolParams = Type.Object({
  action: StringEnum(
    ["call", "fork", "context", "list", "peek", "cancel", "requests"] as const,
    {
      description: [
        "'call': run an agent synchronously and get the result (blocks your session until the agent finishes). Creates a child session in your call tree.",
        "'fork': start an agent in a new independent session (non-blocking). Returns sessionId. You continue immediately. The forked session can query your context via origin link.",
        "'context': query session context — parent's summary, origin session, workflow steps. Use when you need more context than your task provides.",
        "'list': show all available agents with descriptions and any running sessions.",
        "'peek': view recent messages from a running session (requires sessionId).",
        "'cancel': kill a running session (requires sessionId).",
        "'requests': query the request tracking database (optionally filter by agent or status).",
        "To send a one-way FYI notification, use the separate `message` tool instead of this action list.",
      ].join(" "),
    },
  ),
  agent: Type.Optional(
    Type.String({
      description:
        "Target agent name. Required for 'call' and 'fork'. Optional for 'requests' (filters by agent). Use 'list' first to see available agents if unsure.",
    }),
  ),
  task: Type.Optional(
    Type.String({
      description:
        "Task description for 'call' or 'fork'. Be specific: include file paths, expected outcomes, and constraints. The agent runs to completion and returns a summary (call) or session id (fork).",
    }),
  ),
  message: Type.Optional(
    Type.String({
      description:
        "DEPRECATED — use the `message` tool for FYI notifications, or `task` for 'call'/'fork'. Kept only for backward compatibility.",
    }),
  ),
  sessionId: Type.Optional(
    Type.String({ description: "Session ID for 'peek' or 'cancel'. Get session IDs from 'list' output." }),
  ),
  limit: Type.Optional(
    Type.Number({
      description:
        "Max items to return. For 'peek': messages (default: 20). For 'requests': records (default: 50). Increase to see more.",
    }),
  ),
  filter: Type.Optional(
    StringEnum(["active", "stale", "failed", "all"] as const, {
      description:
        "Filter for 'requests' action. 'active': in-progress or pending. 'stale': no progress for >2h. 'failed': completed with errors. 'all': everything. Default: 'active'.",
    }),
  ),
  force: Type.Optional(
    Type.Boolean({
      description:
        "For 'fork': skip duplicate detection. Use when you intentionally want to re-dispatch a similar task to the same agent.",
    }),
  ),
  context_files: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "For 'call'/'fork': file paths the receiver MUST read for context. Included in the tracked request and appended to the task.",
    }),
  ),
  success_criteria: Type.Optional(
    Type.Array(Type.String(), {
      description:
        "For 'call'/'fork': bullet points describing how to verify the task is done correctly. Included in the tracked request.",
    }),
  ),
  priority: Type.Optional(
    StringEnum(["P0", "P1", "P2"] as const, {
      description: "For 'fork': task priority. P0 = urgent/blocking, P1 = important, P2 = nice-to-have. Default: P1.",
    }),
  ),
  scope: Type.Optional(
    StringEnum(["parent", "origin", "root", "workflow"] as const, {
      description:
        "For 'context': what to query. 'parent' (default): caller's session summary. 'origin': the session that forked this tree. 'root': top of the call tree. 'workflow': all completed workflow steps.",
    }),
  ),
});

interface AgentsToolParamsType {
  action: "call" | "fork" | "context" | "list" | "peek" | "cancel" | "requests";
  agent?: string;
  task?: string;
  message?: string;
  sessionId?: string;
  limit?: number;
  filter?: "active" | "stale" | "failed" | "all";
  force?: boolean;
  context_files?: string[];
  success_criteria?: string[];
  priority?: "P0" | "P1" | "P2";
  scope?: "parent" | "origin" | "root" | "workflow";
}

function appendContextFiles(task: string, contextFiles?: string[], successCriteria?: string[]): string {
  const parts = [task];

  if (contextFiles && contextFiles.length > 0) {
    parts.push(
      "",
      "Context files the receiving agent must read before acting:",
      ...contextFiles.map((file) => `- ${file}`),
    );
  }

  if (successCriteria && successCriteria.length > 0) {
    parts.push(
      "",
      "Success criteria (verify each before finishing):",
      ...successCriteria.map((c) => `- ${c}`),
    );
  }

  // Delegation-memo convention reminder
  parts.push(
    "",
    "## Delegation Memo",
    "This task follows the delegation-memo convention. The receiving agent MUST:",
    "1. Read all context_files before acting.",
    "2. Verify each success criterion with evidence in finish().",
    "3. Stay within scope — finish as 'blocked' if out-of-scope work is needed.",
  );

  return parts.join("\n");
}

/**
 * Create the 'agents' tool for inter-agent cooperation.
 *
 * Takes a manager-shaped dependency object (not the full SubagentManager)
 * to avoid circular imports and keep the module testable.
 */
export function createAgentsTool(manager: AgentsToolManagerDeps, opts?: CreateAgentsToolOptions): AgentTool {
  const getCallerSessionId = opts?.getCallerSessionId;
  const getCallerAgentName = opts?.getCallerAgentName;
  const callDeny = opts?.callDeny;
  const agentsRoot = opts?.agentsRoot;
  const triggerHeartbeat = opts?.triggerHeartbeat;
  const bus = opts?.bus;

  const getCallerLineage = (sessionId?: string): { workflowRunId?: string; projectId?: string } => {
    if (!sessionId) return {};
    const active = manager.activeSessions.get(sessionId);
    const persisted = manager.registry.getSession(sessionId);
    return {
      workflowRunId: active?.workflowRunId ?? persisted?.workflowRunId,
      projectId: active?.projectId ?? persisted?.projectId,
    };
  };

  return {
    name: "agents",
    label: "Agents",
    description:
      "Cooperate with other agents. Use 'list' to see available agents, 'call' to run one synchronously, 'fork' to start one in the background, 'peek'/'cancel' to monitor sessions, 'requests' to query the tracking DB. For one-way FYI notifications, use the separate `message` tool.",
    parameters: AgentsToolParams,
    execute: async (_toolCallId, _params) => {
      const params = _params as AgentsToolParamsType;
      try {
        // Back-compat: 'message' and 'send' actions are removed. Direct callers
        // to the v2 `message` tool.
        if ((params as { action?: string }).action === "message" || (params as { action?: string }).action === "send") {
          return textResult(
            JSON.stringify({
              error:
                "The agents.message and agents.send actions have been removed. Use the message tool: message({ to, content, intent?, priority? }) for async inter-agent communication, or agents.fork({ agent, task }) to dispatch work that should start immediately.",
            }),
          );
        }
        switch (params.action) {
          case "call": {
            if (!params.agent || !params.task) {
              return textResult(JSON.stringify({ error: "'call' requires 'agent' and 'task'" }));
            }
            // Guard: reject if target matches a tool in caller's toolset
            const callerAgentCall = getCallerAgentName?.();
            if (callerAgentCall) {
              const callerReg = manager.agents.get(callerAgentCall);
              if (callerReg) {
                const toolNames = callerReg.definition.tools.map((t) => t.name);
                if (toolNames.includes(params.agent)) {
                  return textResult(
                    JSON.stringify({
                      error: `"${params.agent}" is a tool, not an agent. Call it directly as: ${params.agent}({ ... }) — do NOT use agents.call("${params.agent}", ...).`,
                    }),
                  );
                }
              }
            }
            if (!manager.agents.has(params.agent)) {
              return textResult(
                JSON.stringify({
                  error: `Agent "${params.agent}" not registered. Use 'list' to see available agents.`,
                }),
              );
            }
            if (callDeny && callDeny.agents.includes(params.agent)) {
              return textResult(JSON.stringify({ error: `Cannot call "${params.agent}" directly. ${callDeny.hint}` }));
            }
            const parentSid = getCallerSessionId?.();
            const lineage = getCallerLineage(parentSid);

            // Sync call: blocks until done
            const task = appendContextFiles(params.task, params.context_files, params.success_criteria);
            const result = await manager.callAgent(params.agent, task, {
              parentSessionId: parentSid,
              workflowRunId: lineage.workflowRunId,
              projectId: lineage.projectId,
              source: "agents.call",
            });

            // Return result without full messages array (too large for tool output)
            const { messages: _msgs, ...resultWithoutMessages } = result;
            return textResult(JSON.stringify(resultWithoutMessages, null, 2));
          }

          case "fork": {
            if (!params.agent || !(params.task || params.message)) {
              return textResult(JSON.stringify({ error: "'fork' requires 'agent' and 'task'" }));
            }
            const forkTask = appendContextFiles(params.task || params.message!, params.context_files, params.success_criteria);
            // Guard: reject if target matches a tool in caller's toolset
            const callerAgentRun = getCallerAgentName?.();
            if (callerAgentRun) {
              const callerReg = manager.agents.get(callerAgentRun);
              if (callerReg) {
                const toolNames = callerReg.definition.tools.map((t) => t.name);
                if (toolNames.includes(params.agent)) {
                  return textResult(
                    JSON.stringify({
                      error: `"${params.agent}" is a tool, not an agent. Call it directly as: ${params.agent}({ ... }) — do NOT use agents.fork("${params.agent}", ...).`,
                    }),
                  );
                }
              }
            }
            if (!manager.agents.has(params.agent)) {
              return textResult(
                JSON.stringify({
                  error: `Agent "${params.agent}" not registered. Use 'list' to see available agents.`,
                }),
              );
            }
            if (callDeny && callDeny.agents.includes(params.agent)) {
              return textResult(JSON.stringify({ error: `Cannot fork "${params.agent}" directly. ${callDeny.hint}` }));
            }
            const parentSidRun = getCallerSessionId?.();
            const lineage = getCallerLineage(parentSidRun);

            // Emit message.created for traceability (v2 convergence)
            if (bus) {
              const caller = callerAgentRun || "unknown";
              bus.emit({
                type: "message.created",
                source: `agent:${caller}`,
                owner: `agent:${params.agent}`,
                urgency: "immediate",
                data: { from: caller, to: params.agent, content: forkTask, intent: "fork", priority: "P0" },
              });
            }

            // Fire-and-forget: start agent immediately, don't wait.
            // It is still a causal child of the caller for traceability.
            const sessionId = manager.runAgent(params.agent, forkTask, {
              parentSessionId: parentSidRun,
              originSessionId: parentSidRun,
              workflowRunId: lineage.workflowRunId,
              projectId: lineage.projectId,
              source: "agents.fork",
            });

            return textResult(
              JSON.stringify({
                status: "started",
                sessionId,
                agent: params.agent,
                hint: `Use peek({ sessionId: "${sessionId}" }) to monitor progress.`,
              }),
            );
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
              const { readIdentity, sendSocketCommand } = await loadDetachedHelpers();
              if (cancelMeta.instance) {
                const cancelIdentity = readIdentity(manager.registry.persistDir, cancelMeta.instance);
                if (cancelIdentity?.socket) {
                  try {
                    await sendSocketCommand(cancelIdentity.socket, { type: "cancel", sessionId: params.sessionId });
                    manager.registry.updateSessionStatus(params.sessionId, "interrupted", "Cancelled (socket)");
                    return textResult(JSON.stringify({ cancelled: params.sessionId, method: "socket" }));
                  } catch {
                    /* fall through to SIGTERM */
                  }
                }
              }
              if (cancelMeta.pid) {
                try {
                  process.kill(cancelMeta.pid, "SIGTERM");
                } catch {
                  /* process gone */
                }
                manager.registry.updateSessionStatus(params.sessionId, "interrupted", "Cancelled (SIGTERM)");
                return textResult(JSON.stringify({ cancelled: params.sessionId, method: "sigterm" }));
              }
            }
            manager.cancel(params.sessionId);
            return textResult(JSON.stringify({ cancelled: params.sessionId }));
          }

          case "context": {
            const callerSid = getCallerSessionId?.();
            if (!callerSid) {
              return textResult(
                JSON.stringify({ error: "No session context available (not running inside a session)" }),
              );
            }

            const scope = params.scope ?? "parent";
            const callerSession = manager.activeSessions.get(callerSid);

            if (scope === "parent") {
              const parentSid = callerSession?.parentSessionId;
              if (!parentSid) {
                return textResult(
                  JSON.stringify({
                    error: "No parent session (this is a root session). Try scope: 'origin' for forked sessions.",
                  }),
                );
              }
              const summary = manager.getSessionSummary(parentSid);
              return textResult(JSON.stringify({ scope: "parent", sessionId: parentSid, ...summary }, null, 2));
            }

            if (scope === "origin") {
              // Walk up to root, then check originSessionId
              let rootSid = callerSid;
              let current = callerSession;
              while (current?.parentSessionId) {
                rootSid = current.parentSessionId;
                current = manager.activeSessions.get(rootSid);
              }
              const originSid = current?.originSessionId;
              if (!originSid) {
                return textResult(
                  JSON.stringify({ error: "No origin session (this tree was not forked). Try scope: 'parent'." }),
                );
              }
              const summary = manager.getSessionSummary(originSid);
              return textResult(JSON.stringify({ scope: "origin", sessionId: originSid, ...summary }, null, 2));
            }

            if (scope === "root") {
              let rootSid = callerSid;
              let current = callerSession;
              while (current?.parentSessionId) {
                rootSid = current.parentSessionId;
                current = manager.activeSessions.get(rootSid);
              }
              const summary = manager.getSessionSummary(rootSid);
              return textResult(JSON.stringify({ scope: "root", sessionId: rootSid, ...summary }, null, 2));
            }

            if (scope === "workflow") {
              const wfRunId = callerSession?.workflowRunId;
              if (!wfRunId) {
                return textResult(JSON.stringify({ error: "Not inside a workflow. Try scope: 'parent'." }));
              }
              const steps = manager.getWorkflowSteps(wfRunId);
              return textResult(JSON.stringify({ scope: "workflow", workflowRunId: wfRunId, steps }, null, 2));
            }

            return textResult(JSON.stringify({ error: `Unknown scope: ${scope}` }));
          }

          case "requests": {
            try {
              const persistDir = manager.registry.persistDir;
              const filter = params.filter ?? "active";
              const limit = params.limit ?? 50;
              const db = getDb(persistDir);

              // Query sessions table (replaces removed requests table)
              let whereClause = "";
              const queryParams: any[] = [];

              switch (filter) {
                case "active":
                  whereClause = "WHERE status = 'running'";
                  if (params.agent) { whereClause += " AND agent = ?"; queryParams.push(params.agent); }
                  break;
                case "stale":
                  whereClause = "WHERE status = 'running' AND startedAt < ?";
                  queryParams.push(Date.now() - 2 * 60 * 60 * 1000);
                  if (params.agent) { whereClause += " AND agent = ?"; queryParams.push(params.agent); }
                  break;
                case "failed":
                  whereClause = "WHERE status = 'error'";
                  if (params.agent) { whereClause += " AND agent = ?"; queryParams.push(params.agent); }
                  break;
                case "all":
                default:
                  if (params.agent) { whereClause = "WHERE agent = ?"; queryParams.push(params.agent); }
                  break;
              }

              const sessions = db
                .prepare(`SELECT sessionId, agent, task, status, kind, startedAt, endedAt, error FROM sessions ${whereClause} ORDER BY startedAt DESC LIMIT ${limit}`)
                .all(...queryParams) as any[];

              const formatted = sessions.map((s: any) => ({
                id: s.sessionId.slice(0, 16),
                agent: s.agent,
                task: (s.task || "").slice(0, 120),
                status: s.status,
                kind: s.kind,
                age: `${Math.round((Date.now() - s.startedAt) / 60000)}m`,
                error: s.error?.slice(0, 80),
              }));

              return textResult(JSON.stringify({ filter, count: formatted.length, sessions: formatted }, null, 2));
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              return textResult(JSON.stringify({ error: `status query failed: ${msg}` }));
            }
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
