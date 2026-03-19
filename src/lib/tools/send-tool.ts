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

import { existsSync } from "node:fs";
import { resolve } from "node:path";
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
  message: Type.String({ description: "Message to send (tracked in request DB, injected into target's heartbeat)" }),
  artifact: Type.Optional(
    Type.String({ description: "Path to an artifact file to reference in the message" }),
  ),
  force: Type.Optional(Type.Boolean({ description: "Skip dedup check for intentional re-sends" })),
});

type SendParams = Static<typeof sendParams> & { force?: boolean };

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
      "Send a message or artifact to another agent. The message is tracked in the request DB and injected into the target's next heartbeat. You cannot call, peek, or cancel — only send.",
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

      // Validate artifact exists if provided, with path traversal protection
      if (params.artifact) {
        const resolvedArtifact = resolve(params.artifact);
        const projectRoot = resolve(opts.persistDir, "..");
        if (!resolvedArtifact.startsWith(projectRoot)) {
          return textResult(JSON.stringify({ error: `Artifact path outside project root: ${params.artifact}` }));
        }
        if (!existsSync(resolvedArtifact)) {
          return textResult(JSON.stringify({ error: `Artifact not found: ${params.artifact}` }));
        }
      }

      const caller = opts.agentName;

      // Dedup check
      if (!params.force) {
        try {
          const req = await getRequestsModule();
          const existingReqId = req.isDuplicate(opts.persistDir, caller, params.agent, params.message.slice(0, 500));
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
        } catch (e) {
          // Non-fatal: dedup is best-effort (DB may not be available)
          if (process.env.DEBUG) console.warn(`[send-tool] dedup check failed: ${e}`);
        }
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
      } catch (e) {
        // Non-fatal: tracking is best-effort (DB may not be available)
        if (process.env.DEBUG) console.warn(`[send-tool] tracking failed: ${e}`);
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
