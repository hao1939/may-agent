/**
 * Agents tool — extracted from manager.ts for maintainability (P5).
 *
 * Provides the 'agents' tool that lets agents cooperate: call, send, list,
 * peek, and cancel other agents. All functions are standalone and take their
 * dependencies as parameters (same pattern as manager-retry.ts).
 */

import type { AgentMessage, AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type, StringEnum } from "@mariozechner/pi-ai";
import type { ActiveSession, RegisteredAgent } from "./manager-utils.js";
import type { SessionInfo, TaskResult } from "./types.js";
import type { PersistedSession } from "./persistence.js";
import type { RequestRecord } from "./requests.js";

// ── Lazy-loaded request tracking ───────────────────────────────────────
// Loaded lazily to avoid pulling bun:sqlite at module level (vitest compat).

let _requestsModule: typeof import("./requests.js") | undefined;

async function getRequestsModule() {
  if (!_requestsModule) {
    _requestsModule = await import("./requests.js");
  }
  return _requestsModule;
}

// ── Manager interface ──────────────────────────────────────────────────
// Instead of importing the full SubagentManager class (circular dependency),
// we define only the methods/properties the agents tool needs.

export interface AgentsToolManagerDeps {
  agents: Map<string, RegisteredAgent>;
  activeSessions: Map<string, ActiveSession>;
  callAgent(
    agentName: string,
    task: string,
    opts?: { parentSessionId?: string },
  ): Promise<TaskResult & { messages: AgentMessage[] }>;
  runAgent(
    agentName: string,
    task: string,
    opts?: { parentSessionId?: string; originSessionId?: string; source?: string; requestId?: string },
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
  /** Root directory of agent definitions (for send action). */
  agentsRoot?: string;
  /** Trigger an agent's heartbeat cron (for send action). */
  triggerHeartbeat?: (agentName: string) => boolean;
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
  action: StringEnum(["call", "fork", "message", "context", "list", "peek", "cancel", "requests", "send", "run"] as const, {
    description: [
      "'call': run an agent synchronously and get the result (blocks your session until the agent finishes). Creates a child session in your call tree.",
      "'fork': start an agent in a new independent session (non-blocking). Returns sessionId. You continue immediately. The forked session can query your context via origin link.",
      "'message': fire-and-forget task for an agent to pick up on their next heartbeat. No result returned. Use for background work.",
      "'context': query session context — parent's summary, origin session, workflow steps. Use when you need more context than your task provides.",
      "'list': show all available agents with descriptions and any running sessions.",
      "'peek': view recent messages from a running session (requires sessionId).",
      "'cancel': kill a running session (requires sessionId).",
      "'requests': query the request tracking database (optionally filter by agent or status).",
    ].join(" "),
  }),
  agent: Type.Optional(Type.String({ description: "Target agent name. Required for 'call' and 'send'. Optional for 'requests' (filters by agent). Use 'list' first to see available agents if unsure." })),
  task: Type.Optional(Type.String({ description: "Task description for 'call'. Be specific: include file paths, expected outcomes, and constraints. The agent runs to completion and returns a summary." })),
  message: Type.Optional(Type.String({ description: "Message to send for 'send'. Creates a tracked request in the DB and triggers the target agent's next heartbeat. Include artifact file paths if the agent needs to read your output." })),
  sessionId: Type.Optional(Type.String({ description: "Session ID for 'peek' or 'cancel'. Get session IDs from 'list' output." })),
  limit: Type.Optional(Type.Number({ description: "Max items to return. For 'peek': messages (default: 20). For 'requests': records (default: 50). Increase to see more." })),
  filter: Type.Optional(StringEnum(["active", "stale", "failed", "all"] as const, {
    description: "Filter for 'requests' action. 'active': in-progress or pending. 'stale': no progress for >2h. 'failed': completed with errors. 'all': everything. Default: 'active'.",
  })),
  force: Type.Optional(Type.Boolean({ description: "For 'send' only: skip duplicate detection. Use when you intentionally want to re-send a similar message to the same agent." })),
  context_files: Type.Optional(Type.Array(Type.String(), { description: "For 'send'/'call': file paths the receiver MUST read for context. Included in the tracked request and appended to the message." })),
  success_criteria: Type.Optional(Type.Array(Type.String(), { description: "For 'send'/'call': bullet points describing how to verify the task is done correctly. Included in the tracked request." })),
  priority: Type.Optional(StringEnum(["P0", "P1", "P2"] as const, { description: "For 'send': task priority. P0 = urgent/blocking, P1 = important, P2 = nice-to-have. Default: P1." })),
  scope: Type.Optional(StringEnum(["parent", "origin", "root", "workflow"] as const, { description: "For 'context': what to query. 'parent' (default): caller's session summary. 'origin': the session that forked this tree. 'root': top of the call tree. 'workflow': all completed workflow steps." })),
});

interface AgentsToolParamsType {
  action: "call" | "fork" | "message" | "context" | "send" | "run" | "list" | "peek" | "cancel" | "requests";
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

  return {
    name: "agents",
    label: "Agents",
    description:
      "Cooperate with other agents. Use 'list' to see available agents, 'call' to run one synchronously, 'run' to start one in the background (non-blocking), 'send' to dispatch async work, 'peek'/'cancel' to monitor sessions, 'requests' to query the tracking DB.",
    parameters: AgentsToolParams,
    execute: async (_toolCallId, _params) => {
      const params = _params as AgentsToolParamsType;
      try {
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
                JSON.stringify({ error: `Agent "${params.agent}" not registered. Use 'list' to see available agents.` }),
              );
            }
            if (callDeny && callDeny.agents.includes(params.agent)) {
              return textResult(
                JSON.stringify({ error: `Cannot call "${params.agent}" directly. ${callDeny.hint}` }),
              );
            }
            const parentSid = getCallerSessionId?.();
            const callerName = getCallerAgentName?.() ?? "unknown";

            // Track the request in SQLite
            const startTime = Date.now();
            let requestId: string | undefined;
            try {
              const req = await getRequestsModule();
              requestId = req.trackRequest(manager.registry.persistDir, {
                fromEntity: callerName,
                toAgent: params.agent,
                task: params.task,
                method: "call",
                sessionId: parentSid,
                context: params.context_files ? JSON.stringify(params.context_files) : undefined,
                expectations: params.success_criteria ? JSON.stringify(params.success_criteria) : undefined,
              });
            } catch {
              // Non-fatal: tracking failure shouldn't block the call
            }

            // Sync call: blocks until done
            const result = await manager.callAgent(params.agent, params.task, {
              parentSessionId: parentSid,
            });

            // Update request with outcome
            if (requestId) {
              try {
                const req = await getRequestsModule();
                const durationMs = Date.now() - startTime;
                const hasError = result.status === "error" || result.status === "interrupted";
                req.updateRequest(manager.registry.persistDir, requestId, {
                  status: hasError ? "FAILED" : "COMPLETED",
                  sessionId: result.sessionId,
                  error: hasError ? result.error : undefined,
                  errorClass: hasError ? req.classifyError(result.error) : undefined,
                  durationMs,
                  completedAt: Date.now(),
                });
              } catch {
                // Non-fatal
              }
            }

            // Return result without full messages array (too large for tool output)
            const { messages: _msgs, ...resultWithoutMessages } = result;
            return textResult(JSON.stringify(resultWithoutMessages, null, 2));
          }

          case "fork":
          case "run": {
            if (!params.agent || !(params.task || params.message)) {
              return textResult(JSON.stringify({ error: "'fork' requires 'agent' and 'task'" }));
            }
            const forkTask = params.task || params.message!;
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
                JSON.stringify({ error: `Agent "${params.agent}" not registered. Use 'list' to see available agents.` }),
              );
            }
            if (callDeny && callDeny.agents.includes(params.agent)) {
              return textResult(
                JSON.stringify({ error: `Cannot fork "${params.agent}" directly. ${callDeny.hint}` }),
              );
            }
            const parentSidRun = getCallerSessionId?.();
            const callerNameRun = getCallerAgentName?.() ?? "unknown";

            // Track the request in SQLite
            let runRequestId: string | undefined;
            try {
              const req = await getRequestsModule();
              runRequestId = req.trackRequest(manager.registry.persistDir, {
                fromEntity: callerNameRun,
                toAgent: params.agent,
                task: forkTask,
                method: "run",
                sessionId: parentSidRun,
                context: params.context_files ? JSON.stringify(params.context_files) : undefined,
                expectations: params.success_criteria ? JSON.stringify(params.success_criteria) : undefined,
              });
            } catch {
              // Non-fatal: tracking failure shouldn't block the run
            }

            // Fire-and-forget: start agent immediately, don't wait
            // Fork creates a new root with originSessionId linking back to the caller
            const sessionId = manager.runAgent(params.agent, forkTask, {
              originSessionId: parentSidRun,
              source: "agents.fork",
              requestId: runRequestId,
            });

            return textResult(
              JSON.stringify({
                status: "started",
                sessionId,
                agent: params.agent,
                requestId: runRequestId?.slice(0, 8),
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

          case "message":
          case "send": {
            if (!params.agent || !params.message) {
              return textResult(JSON.stringify({ error: "'send' requires 'agent' and 'message'" }));
            }

            const caller = getCallerAgentName?.() ?? "unknown";

            // Guard: reject if target matches a tool in caller's toolset
            if (caller !== "unknown") {
              const callerRegSend = manager.agents.get(caller);
              if (callerRegSend) {
                const toolNames = callerRegSend.definition.tools.map((t) => t.name);
                if (toolNames.includes(params.agent)) {
                  return textResult(
                    JSON.stringify({
                      error: `"${params.agent}" is a tool, not an agent. Call it directly as: ${params.agent}({ ... }) — do NOT use agents.send("${params.agent}", ...).`,
                    }),
                  );
                }
              }
            }

            if (!manager.agents.has(params.agent)) {
              return textResult(JSON.stringify({ error: `Agent "${params.agent}" not registered` }));
            }
            if (!agentsRoot) {
              return textResult(JSON.stringify({ error: "send not available (agentsRoot not configured)" }));
            }

            // Dedup check: skip if identical active request exists
            if (!params.force) {
              try {
                const req = await getRequestsModule();
                const existingReqId = req.isDuplicate(manager.registry.persistDir, caller, params.agent, params.message.slice(0, 500));
                if (existingReqId) {
                  return textResult(
                    JSON.stringify({
                      status: "skipped",
                      reason: `Duplicate request already active (req: ${existingReqId.slice(0, 8)})`,
                      sent: params.agent,
                      message: params.message,
                      deduplicated: true,
                      heartbeatTriggered: false,
                    }),
                  );
                }
              } catch {
                // Non-fatal: dedup failure shouldn't block send
              }
            }

            // Build structured message: append context_files and success_criteria
            // so the receiver sees them in their heartbeat injection.
            let structuredMessage = params.message;
            if (params.priority) {
              structuredMessage = `[${params.priority}] ${structuredMessage}`;
            }
            if (params.context_files && params.context_files.length > 0) {
              structuredMessage += `\nContext files: ${params.context_files.join(", ")}`;
            }
            if (params.success_criteria && params.success_criteria.length > 0) {
              structuredMessage += `\nSuccess criteria:\n${params.success_criteria.map((c: string) => `- ${c}`).join("\n")}`;
            }

            // Track the request in SQLite
            let requestId: string | undefined;
            try {
              const req = await getRequestsModule();
              requestId = req.trackRequest(manager.registry.persistDir, {
                fromEntity: caller,
                toAgent: params.agent,
                task: structuredMessage,
                method: "send",
                sessionId: getCallerSessionId?.(),
                context: params.context_files ? JSON.stringify(params.context_files) : undefined,
                expectations: params.success_criteria ? JSON.stringify(params.success_criteria) : undefined,
              });
            } catch {
              // Non-fatal: tracking failure shouldn't block send
            }

            // Trigger target agent's heartbeat
            const triggered = triggerHeartbeat?.(params.agent) ?? false;

            return textResult(
              JSON.stringify({
                sent: params.agent,
                message: structuredMessage,
                heartbeatTriggered: triggered,
                requestId: requestId?.slice(0, 8),
              }),
            );
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
              return textResult(JSON.stringify({ error: "No session context available (not running inside a session)" }));
            }

            const scope = params.scope ?? "parent";
            const callerSession = manager.activeSessions.get(callerSid);

            if (scope === "parent") {
              const parentSid = callerSession?.parentSessionId;
              if (!parentSid) {
                return textResult(JSON.stringify({ error: "No parent session (this is a root session). Try scope: 'origin' for forked sessions." }));
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
                return textResult(JSON.stringify({ error: "No origin session (this tree was not forked). Try scope: 'parent'." }));
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
              const req = await getRequestsModule();
              const persistDir = manager.registry.persistDir;
              const filter = params.filter ?? "active";
              const limit = params.limit ?? 50;

              let requests: RequestRecord[];
              switch (filter) {
                case "active":
                  requests = params.agent
                    ? req.getRequestsByAgentAndStatus(persistDir, params.agent, ["CREATED", "IN_PROGRESS"], limit)
                    : req.getActiveRequests(persistDir);
                  if (!params.agent) requests = requests.slice(0, limit);
                  break;
                case "stale":
                  requests = req.getStaleRequests(persistDir, 2 * 60 * 60 * 1000); // 2h
                  if (params.agent) requests = requests.filter((r) => r.toAgent === params.agent);
                  requests = requests.slice(0, limit);
                  break;
                case "failed": {
                  // getActiveRequests only returns active — need direct query for failed
                  const db = req.getDb(persistDir);
                  const query = params.agent
                    ? `SELECT * FROM requests WHERE status = 'FAILED' AND toAgent = ? ORDER BY createdAt DESC LIMIT ${limit}`
                    : `SELECT * FROM requests WHERE status = 'FAILED' ORDER BY createdAt DESC LIMIT ${limit}`;
                  requests = params.agent
                    ? (db.prepare(query).all(params.agent) as unknown as RequestRecord[])
                    : (db.prepare(query).all() as unknown as RequestRecord[]);
                  break;
                }
                case "all":
                  requests = params.agent
                    ? req.getRequestsByAgent(persistDir, params.agent)
                    : req.getActiveRequests(persistDir);
                  if (!params.agent) {
                    // For "all" without agent filter, get everything (limited)
                    const db = req.getDb(persistDir);
                    requests = db
                      .prepare(`SELECT * FROM requests ORDER BY createdAt DESC LIMIT ${limit}`)
                      .all() as unknown as RequestRecord[];
                  } else {
                    requests = requests.slice(0, limit);
                  }
                  break;
              }

              // Format for readability
              const formatted = requests.map((r) => ({
                id: r.requestId.slice(0, 8),
                from: r.fromEntity,
                to: r.toAgent,
                task: r.task.slice(0, 120),
                status: r.status,
                method: r.method,
                age: `${Math.round((Date.now() - r.createdAt) / 60000)}m`,
                error: r.error?.slice(0, 80),
              }));

              return textResult(
                JSON.stringify(
                  { filter, count: formatted.length, requests: formatted },
                  null,
                  2,
                ),
              );
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              return textResult(JSON.stringify({ error: `requests query failed: ${msg}` }));
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
