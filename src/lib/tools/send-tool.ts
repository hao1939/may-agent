/**
 * send-tool.ts — `notify` tool (one-way async notifications)
 *
 * Universal tool for agents and cron handlers to send a one-way FYI
 * notification to another agent. Writes a request row with
 * `method: "notify"` and triggers the target's heartbeat. No session
 * is started, no result is returned — the receiver picks up the message
 * on their next heartbeat context injection.
 *
 * This is NOT for dispatching work — use agents.fork for that. Notify
 * is for: status updates, completion pings, cron alerts, regression
 * reports. Anywhere a sender would say "FYI, here's what happened".
 *
 * Previously named `message` (createSendTool). The split (notify vs.
 * fork vs. call) prevents the common anti-pattern of using message to
 * dispatch work, which queues silently instead of starting immediately.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Type, type Static } from "@mariozechner/pi-ai";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { isDuplicate } from "../requests.js";

export interface NotifyToolOptions {
  /** Name of the calling agent */
  agentName: string;
  /** Root directory containing agent folders */
  agentsRoot: string;
  /** Persistence directory for request tracking DB */
  persistDir: string;
  /** Emit an event on the bus */
  emit?: (event: { type: string; [key: string]: unknown }) => void;
  /** Optional: function to get the caller's current session ID */
  getCallerSessionId?: () => string | undefined;
  /** Optional: function to trigger a target agent's heartbeat */
  triggerHeartbeat?: (agent: string) => boolean;
  /** Optional: list of agents this tool is allowed to send to */
  allowedTargets?: string[];
}

const notifyParams = Type.Object({
  agent: Type.String({
    description:
      "Target agent name. The notification is injected into this agent's next heartbeat session.",
  }),
  message: Type.String({
    description:
      "Notification text. One-way FYI — include everything the recipient needs (file paths, result summary, context). Tracked in the request DB.",
  }),
  artifact: Type.Optional(
    Type.String({
      description:
        "Optional path to an artifact file. The file must exist. Write your output to a file first, then pass the path here so the recipient knows where to read it.",
    }),
  ),
  force: Type.Optional(
    Type.Boolean({
      description:
        "Skip duplicate detection. Use when you intentionally want to re-send a similar notification to the same agent.",
    }),
  ),
  context_files: Type.Optional(
    Type.Array(Type.String(), {
      description: "File paths the recipient should read for context. Appended to the message.",
    }),
  ),
  priority: Type.Optional(
    Type.Union([Type.Literal("P0"), Type.Literal("P1"), Type.Literal("P2")], {
      description: "Priority tag. P0 = urgent/blocking, P1 = important, P2 = nice-to-have.",
    }),
  ),
});

type NotifyParams = Static<typeof notifyParams> & {
  force?: boolean;
  context_files?: string[];
  priority?: "P0" | "P1" | "P2";
};

function textResult(text: string): AgentToolResult<undefined> {
  return { content: [{ type: "text" as const, text }], details: undefined };
}

/**
 * Create the `notify` tool. This is the universal one-way notification
 * tool — all agents get it, and cron handlers can call the underlying
 * trackRequest({ method: "notify" }) directly.
 *
 * NOTE: Use agents.fork to dispatch work. Use notify to send FYI only.
 */
export function createNotifyTool(opts: NotifyToolOptions): AgentTool {
  return {
    name: "notify",
    label: "Notify",
    description:
      "Send a one-way notification to another agent. The message is tracked in the request DB and injected into the target's next heartbeat. FYI only — no session is started and no result is returned. To dispatch work that should start immediately, use agents.fork instead.",
    parameters: notifyParams,
    execute: async (_toolCallId: string, _params: unknown): Promise<AgentToolResult<undefined>> => {
      const params = _params as NotifyParams;

      if (!params.agent || !params.message) {
        return textResult(JSON.stringify({ error: "'agent' and 'message' are required" }));
      }

      // Validate target if allowlist is configured
      if (opts.allowedTargets && !opts.allowedTargets.includes(params.agent)) {
        return textResult(
          JSON.stringify({
            error: `Cannot notify "${params.agent}". Allowed targets: ${opts.allowedTargets.join(", ")}`,
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
          if (process.env.DEBUG) console.warn(`[notify-tool] dedup check failed: ${e}`);
        }
      }

      // Build structured message
      let structuredMessage = params.message;
      if (params.priority) {
        structuredMessage = `[${params.priority}] ${structuredMessage}`;
      }
      if (params.context_files && params.context_files.length > 0) {
        structuredMessage += `\nContext files: ${params.context_files.join(", ")}`;
      }

      // Emit notification event (persisted by DbWriter)
      try {
        opts.emit?.({ type: "emit", event: "agent.notification", data: {
          owner: params.agent,
          source: caller,
          task: structuredMessage,
          artifact: params.artifact,
        }});
      } catch { /* best-effort */ }

      // Trigger heartbeat so recipient picks it up next cycle
      const triggered = opts.triggerHeartbeat?.(params.agent) ?? false;

      return textResult(
        JSON.stringify({
          sent: params.agent,
          message: structuredMessage,
          heartbeatTriggered: triggered,
          
        }),
      );
    },
  };
}

// ── Back-compat aliases ────────────────────────────────────────────────
// Preserved in case any downstream code still imports the old names.
// Prefer `createNotifyTool` / `NotifyToolOptions` in new code.
export { createNotifyTool as createSendTool };
export type SendToolOptions = NotifyToolOptions;
