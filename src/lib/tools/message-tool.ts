/**
 * message-tool.ts — v2 unified inter-agent communication primitive.
 *
 * The `message` tool replaces notify-style inbox messages and the removed
 * agents.message action. It does not replace agents.fork, which still starts an
 * immediate background session.
 *
 * Semantics (v2):
 *   - async, persisted, receiver-owned, never blocking RPC.
 *   - default: queue for the receiver's next heartbeat (no immediate session).
 *   - priority P0 + receiver opt-in: trigger heartbeat immediately.
 *   - sender never blocks waiting for a reply. Reply, if any, is a new message event.
 *
 * Back-compat:
 *   - The `notify` and `message-only` tool presets were removed in v0.3 cleanup;
 *     all agents use the `message` preset now.
 *   - Emits a single `message.created` event. The `events` table row carries
 *     `event_type='message.created'` and `owner=<recipient>`, which is what
 *     the inbox query (in runtime-ctx.getInbox) reads.
 *
 * See: agents/shared/may-agent-docs/proposals/v2-architecture.md (Messages)
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Type, type Static } from "@mariozechner/pi-ai";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";

export interface MessageToolOptions {
  /** Name of the calling agent. */
  agentName: string;
  /** Root directory containing agent folders. */
  agentsRoot: string;
  /** Persistence directory for request tracking DB. */
  persistDir: string;
  /** Emit an event on the bus. */
  emit?: (event: { type: string; [key: string]: unknown }) => void;
  /** Optional: function to get the caller's current session ID. */
  getCallerSessionId?: () => string | undefined;
  /** Optional: function to trigger a target agent's heartbeat. */
  triggerHeartbeat?: (agent: string) => boolean;
  /** Optional: list of agents this tool is allowed to send to. */
  allowedTargets?: string[];
}

const messageParams = Type.Object({
  to: Type.String({
    description:
      "Receiver agent name. The message is queued for the receiver's next heartbeat.",
  }),
  content: Type.String({
    description:
      "Message body. Include everything the receiver needs (links, paths, summary, ask). The receiver decides what to do with it.",
  }),
  intent: Type.Optional(
    Type.String({
      description:
        "Short tag describing intent: 'fyi', 'implementation-request', 'review-request', 'status-update', etc. Free-form, used for filtering and metrics.",
    }),
  ),
  artifact: Type.Optional(
    Type.String({
      description:
        "Optional path to an artifact file (must exist). Prefer artifact + short content over long content — file is the source of truth.",
    }),
  ),
  priority: Type.Optional(
    Type.Union(
      [Type.Literal("P0"), Type.Literal("P1"), Type.Literal("P2"), Type.Literal("P3")],
      {
        description:
          "Priority. P0 = urgent, may trigger immediate run. P1 = important. P2/P3 = informational. Default: P2.",
      },
    ),
  ),
  context_files: Type.Optional(
    Type.Array(Type.String(), {
      description: "Additional files the receiver should consult. Appended to content.",
    }),
  ),
  force: Type.Optional(
    Type.Boolean({
      description: "Skip duplicate detection. Use when intentionally re-sending.",
    }),
  ),
});

type MessageParams = Static<typeof messageParams> & {
  intent?: string;
  priority?: "P0" | "P1" | "P2" | "P3";
  context_files?: string[];
  force?: boolean;
};

function textResult(text: string): AgentToolResult<undefined> {
  return { content: [{ type: "text" as const, text }], details: undefined };
}

function allowedTargetSet(targets?: string[]): Set<string> | null {
  if (!targets) return null;
  return new Set([...targets, "human"].map((target) => target.trim()).filter(Boolean));
}

function preview(text: string): string {
  return text.length <= 500 ? text : `${text.slice(0, 500)}...`;
}

/**
 * Create the `message` tool — the v2 unified inter-agent communication primitive.
 */
export function createMessageTool(opts: MessageToolOptions): AgentTool {
  return {
    name: "message",
    label: "Message",
    description:
      "Send an async message to another agent. The message is persisted and injected into the receiver's next heartbeat. Sender never waits for a reply; replies are new messages. Use intent='implementation-request' + artifact for work handoffs. Use priority='P0' for urgent breaches.",
    parameters: messageParams,
    execute: async (
      _toolCallId: string,
      _params: unknown,
    ): Promise<AgentToolResult<undefined>> => {
      const params = _params as MessageParams;

      if (!params.to || !params.content) {
        return textResult(JSON.stringify({ error: "'to' and 'content' are required" }));
      }

      const allowedTargets = allowedTargetSet(opts.allowedTargets);
      if (allowedTargets && !allowedTargets.has(params.to)) {
        const reason = `Unknown message target "${params.to}"`;
        try {
          opts.emit?.({
            type: "message.delivery_failed",
            owner: "may",
            from: opts.agentName,
            to: params.to,
            reason,
            content: preview(params.content),
            priority: params.priority ?? "P2",
          });
        } catch {
          /* best-effort */
        }
        return textResult(
          JSON.stringify({
            error: reason,
            allowedTargets: [...allowedTargets].sort(),
          }),
        );
      }

      // Validate artifact (existence + path traversal)
      if (params.artifact) {
        const resolvedArtifact = resolve(params.artifact);
        const projectRoot = resolve(opts.persistDir, "..");
        if (!resolvedArtifact.startsWith(projectRoot)) {
          return textResult(
            JSON.stringify({ error: `Artifact path outside project root: ${params.artifact}` }),
          );
        }
        if (!existsSync(resolvedArtifact)) {
          return textResult(JSON.stringify({ error: `Artifact not found: ${params.artifact}` }));
        }
      }

      const caller = opts.agentName;
      const priority = params.priority ?? "P2";

      // Build receiver-friendly content
      let body = params.content;
      if (params.intent) body = `[${params.intent}] ${body}`;
      if (params.priority) body = `[${params.priority}] ${body}`;
      if (params.context_files && params.context_files.length > 0) {
        body += `\nContext files: ${params.context_files.join(", ")}`;
      }
      if (params.artifact) {
        body += `\nArtifact: ${params.artifact}`;
      }

      // ── Emit canonical v2 event ────────────────────────────────────
      try {
        opts.emit?.({
          type: "message.created",
          from: caller,
          to: params.to,
          content: body,
          intent: params.intent,
          artifact: params.artifact,
          priority,
        });
      } catch {
        /* best-effort */
      }

      // P0 messages trigger receiver immediately. Lower priorities wait
      // for the receiver's next scheduled heartbeat.
      const triggered =
        priority === "P0" ? (opts.triggerHeartbeat?.(params.to) ?? false) : false;

      return textResult(
        JSON.stringify({
          to: params.to,
          intent: params.intent ?? null,
          priority,
          triggered,
          delivery: triggered ? "immediate (P0)" : "queued for next heartbeat",
        }),
      );
    },
  };
}
