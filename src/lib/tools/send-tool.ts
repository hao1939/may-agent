/**
 * send-tool.ts — Lightweight send-only tool for leaf agents
 *
 * Lets leaf agents (coder, evaluator, qa, amy-kimi) send messages
 * and deliver artifacts to other agents WITHOUT call/peek/cancel capability.
 * This preserves the agent hierarchy: leaf agents can report results
 * but cannot orchestrate other agents.
 *
 * Phase 6 of request-tracking plan.
 */

import { mkdirSync, existsSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { Type, type Static } from "@mariozechner/pi-ai";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";

// Lazy-load requests module to avoid pulling bun:sqlite at module level (vitest compat)
let _requestsModule: typeof import("../requests.js") | undefined;
async function getRequestsModule() {
  if (!_requestsModule) {
    _requestsModule = await import("../requests.js");
  }
  return _requestsModule;
}

export interface SendToolOptions {
  /** Name of the calling agent */
  agentName: string;
  /** Root directory containing agent folders */
  agentsRoot: string;
  /** Persistence directory for request tracking DB */
  persistDir: string;
  /** Optional: function to get the caller's current session ID */
  getCallerSessionId?: () => string | undefined;
  /** Optional: function to trigger a target agent's heartbeat */
  triggerHeartbeat?: (agent: string) => boolean;
  /** Optional: list of agents this tool is allowed to send to */
  allowedTargets?: string[];
}

const sendParams = Type.Object({
  agent: Type.String({ description: "Target agent name" }),
  message: Type.String({ description: "Message to send (appears in target's todo.md)" }),
  artifact: Type.Optional(
    Type.String({ description: "Path to an artifact file to reference in the message" }),
  ),
});

type SendParams = Static<typeof sendParams>;

function textResult(text: string): AgentToolResult<undefined> {
  return { content: [{ type: "text" as const, text }], details: undefined };
}

/**
 * Create a send-only tool for leaf agents.
 * Supports sending messages and optional artifact paths.
 */
export function createSendTool(opts: SendToolOptions): AgentTool {
  return {
    name: "send",
    label: "Send",
    description:
      "Send a message or artifact to another agent. The message is appended to their todo.md and their heartbeat is triggered. You cannot call, peek, or cancel — only send.",
    parameters: sendParams,
    execute: async (_toolCallId: string, _params: unknown): Promise<AgentToolResult<undefined>> => {
      const params = _params as SendParams;

      if (!params.agent || !params.message) {
        return textResult(JSON.stringify({ error: "'agent' and 'message' are required" }));
      }

      // Validate target if allowlist is configured
      if (opts.allowedTargets && !opts.allowedTargets.includes(params.agent)) {
        return textResult(
          JSON.stringify({
            error: `Cannot send to "${params.agent}". Allowed targets: ${opts.allowedTargets.join(", ")}`,
          }),
        );
      }

      // Validate artifact exists if provided
      if (params.artifact && !existsSync(params.artifact)) {
        return textResult(JSON.stringify({ error: `Artifact not found: ${params.artifact}` }));
      }

      const caller = opts.agentName;

      // Dedup check
      try {
        const req = await getRequestsModule();
        if (req.isDuplicate(opts.persistDir, caller, params.agent, params.message.slice(0, 500))) {
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
        // Non-fatal
      }

      // Track in SQLite
      let requestId: string | undefined;
      try {
        const req = await getRequestsModule();
        requestId = req.trackRequest(opts.persistDir, {
          fromEntity: caller,
          toAgent: params.agent,
          task: params.message,
          method: "send",
          sessionId: opts.getCallerSessionId?.(),
          artifact: params.artifact,
        });
      } catch {
        // Non-fatal
      }

      // Write to target's todo.md
      const todoDir = join(opts.agentsRoot, params.agent, "workspace");
      mkdirSync(todoDir, { recursive: true });
      const todoPath = join(todoDir, "todo.md");

      const timestamp = new Date().toISOString().slice(0, 16);
      const reqTag = requestId ? ` [req:${requestId.slice(0, 8)}]` : "";
      const artifactNote = params.artifact ? ` Artifact: ${params.artifact}.` : "";
      const entry = `- [ ] [from:${caller} ${timestamp}]${reqTag} ${params.message}${artifactNote}\n`;

      if (!existsSync(todoPath)) {
        writeFileSync(todoPath, `# TODO\n\n${entry}`, "utf-8");
      } else {
        appendFileSync(todoPath, entry, "utf-8");
      }

      // Trigger heartbeat
      const triggered = opts.triggerHeartbeat?.(params.agent) ?? false;

      return textResult(
        JSON.stringify({
          sent: params.agent,
          message: params.message,
          heartbeatTriggered: triggered,
          requestId: requestId?.slice(0, 8),
        }),
      );
    },
  };
}
