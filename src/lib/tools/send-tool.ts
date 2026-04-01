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
import { isDuplicate, trackRequest } from "../requests.js";

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
  agent: Type.String({
    description: "Target agent name. The message is injected into this agent's next heartbeat session.",
  }),
  message: Type.String({
    description:
      "Message to send. Be specific: include file paths to artifacts, what you need the target to do, and any context they'll need. Tracked in the request DB.",
  }),
  artifact: Type.Optional(
    Type.String({
      description:
        "Path to an artifact file to reference. The file must exist. Write your output to a file first, then pass the path here so the target agent knows where to read it.",
    }),
  ),
  force: Type.Optional(
    Type.Boolean({
      description:
        "Skip duplicate detection. Use when you intentionally want to re-send a similar message to the same agent.",
    }),
  ),
  context_files: Type.Optional(
    Type.Array(Type.String(), {
      description: "File paths the receiver MUST read for context. Appended to the message so the receiver sees them.",
    }),
  ),
  success_criteria: Type.Optional(
    Type.Array(Type.String(), { description: "Bullet points describing how to verify the task is done correctly." }),
  ),
  priority: Type.Optional(
    Type.Union([Type.Literal("P0"), Type.Literal("P1"), Type.Literal("P2")], {
      description: "Task priority. P0 = urgent/blocking, P1 = important, P2 = nice-to-have.",
    }),
  ),
});

type SendParams = Static<typeof sendParams> & {
  force?: boolean;
  context_files?: string[];
  success_criteria?: string[];
  priority?: "P0" | "P1" | "P2";
};

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
          const existingReqId = isDuplicate(opts.persistDir, caller, params.agent, params.message.slice(0, 500));
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

      // Build structured message: append context_files and success_criteria
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

      // Track in SQLite
      let requestId: string | undefined;
      try {
        requestId = trackRequest(opts.persistDir, {
          fromEntity: caller,
          toAgent: params.agent,
          task: structuredMessage,
          method: "send",
          sessionId: opts.getCallerSessionId?.(),
          artifact: params.artifact,
          context: params.context_files ? JSON.stringify(params.context_files) : undefined,
          expectations: params.success_criteria ? JSON.stringify(params.success_criteria) : undefined,
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
          message: structuredMessage,
          heartbeatTriggered: triggered,
          requestId: requestId?.slice(0, 8),
        }),
      );
    },
  };
}
