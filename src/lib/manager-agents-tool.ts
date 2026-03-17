/**
 * Agents tool — extracted from manager.ts for maintainability (P5).
 *
 * Provides the 'agents' tool that lets agents cooperate: call, send, list,
 * peek, and cancel other agents. All functions are standalone and take their
 * dependencies as parameters (same pattern as manager-retry.ts).
 */

import { mkdirSync, existsSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentMessage, AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { Type, StringEnum } from "@mariozechner/pi-ai";
import type { RegisteredAgent } from "./manager-utils.js";
import type { SessionInfo, TaskResult } from "./types.js";
import type { PersistedSession } from "./persistence.js";

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
  callAgent(
    agentName: string,
    task: string,
    opts?: { parentSessionId?: string },
  ): Promise<TaskResult & { messages: AgentMessage[] }>;
  status(): SessionInfo[];
  progress(sessionId: string, limit?: number): AgentMessage[];
  hasActiveSession(sessionId: string): boolean;
  cancel(sessionId: string): void;
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
  action: StringEnum(["call", "send", "list", "peek", "cancel"] as const, {
    description:
      "Action to perform. 'call' runs an agent synchronously (blocks until done). 'send' adds a todo for an agent and triggers their heartbeat (fire-and-forget). 'list' shows agents and running sessions. 'peek'/'cancel' operate on running sessions.",
  }),
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
                const hasError = result.status === "error";
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

            const caller = getCallerAgentName?.() ?? "unknown";

            // Dedup check: skip if identical active request exists
            try {
              const req = await getRequestsModule();
              if (req.isDuplicate(manager.registry.persistDir, caller, params.agent, params.message.slice(0, 500))) {
                return textResult(
                  JSON.stringify({
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

            // Track the request in SQLite
            let requestId: string | undefined;
            try {
              const req = await getRequestsModule();
              requestId = req.trackRequest(manager.registry.persistDir, {
                fromEntity: caller,
                toAgent: params.agent,
                task: params.message,
                method: "send",
                sessionId: getCallerSessionId?.(),
              });
            } catch {
              // Non-fatal: tracking failure shouldn't block send
            }

            // Append to target agent's workspace/todo.md
            const todoDir = join(agentsRoot, params.agent, "workspace");
            mkdirSync(todoDir, { recursive: true });
            const todoPath = join(todoDir, "todo.md");

            const timestamp = new Date().toISOString().slice(0, 16);
            const reqTag = requestId ? ` [req:${requestId.slice(0, 8)}]` : "";
            const entry = `- [ ] [from:${caller} ${timestamp}]${reqTag} ${params.message}\n`;

            // Create file with header if it doesn't exist, otherwise append
            if (!existsSync(todoPath)) {
              writeFileSync(todoPath, `# TODO\n\n${entry}`, "utf-8");
            } else {
              appendFileSync(todoPath, entry, "utf-8");
            }

            // Trigger target agent's heartbeat
            const triggered = triggerHeartbeat?.(params.agent) ?? false;

            return textResult(
              JSON.stringify({
                sent: params.agent,
                message: params.message,
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
