/**
 * Lifecycle tools — structured session completion.
 *
 * The `finish()` tool replaces unstructured "I'm done" session endings
 * with a standardized, machine-readable completion signal.
 *
 * Policy: Common Sense 1.4 (Signal completion clearly),
 *         P1 (Simplest thing), P5 (Data Integrity)
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { TSchema } from "@mariozechner/pi-ai";
import { existsSync } from "fs";
import { resolve } from "path";

// Lazy import for requests.ts (uses bun:sqlite, not available in vitest)
let _updateRequestFn: ((dir: string, id: string, update: any) => void) | null = null;
async function getUpdateRequest() {
  if (!_updateRequestFn) {
    try {
      const mod = await import("../requests.js");
      _updateRequestFn = mod.updateRequest;
    } catch {
      /* bun:sqlite not available */
    }
  }
  return _updateRequestFn;
}

// ── Types ──────────────────────────────────────────────────────────────

export interface FinishToolOptions {
  /** The agent calling finish(). */
  agentName: string;
  /** Project root for resolving deliverable paths. */
  projectRoot: string;
  /** Directory for .state/ files. Default: projectRoot/.state */
  persistDir?: string;
  /** Request ID for unified request tracking (if session has one). */
  requestId?: string;
}

// ── Schema ─────────────────────────────────────────────────────────────

const finishSchema: TSchema = Type.Object({
  status: Type.Union([
    Type.Literal("success"),
    Type.Literal("failure"),
    Type.Literal("blocked"),
    Type.Literal("partial"),
  ], {
    description: "Outcome of the task: success, failure, blocked, or partial",
  }),
  summary: Type.String({
    description: "1-2 sentence executive summary of what was accomplished",
  }),
  deliverables: Type.Optional(Type.Array(
    Type.Object({
      path: Type.String({ description: "File path (relative to project root)" }),
      description: Type.String({ description: "What this file is/does" }),
    }),
    { description: "Artifacts produced or modified" },
  )),
  blockers: Type.Optional(Type.Array(
    Type.Object({
      reason: Type.String({ description: "What is blocking progress" }),
      context: Type.String({ description: "Additional context about the blocker" }),
    }),
    { description: "Required if status is blocked or failure" },
  )),
  next_steps: Type.Optional(Type.String({
    description: "Recommended next actions if partial or blocked",
  })),
  completed_items: Type.Optional(Type.Array(
    Type.String({ description: "A todo.md item that was completed this session" }),
    { description: "Items from todo.md completed during this session. Infra will auto-mark them [x]." },
  )),
  new_items: Type.Optional(Type.Array(
    Type.String({ description: "A new todo item to add" }),
    { description: "New items to append to todo.md. Infra will auto-add them as [ ]." },
  )),
});

interface FinishParams {
  status: "success" | "failure" | "blocked" | "partial";
  summary: string;
  deliverables?: { path: string; description: string }[];
  blockers?: { reason: string; context: string }[];
  next_steps?: string;
  completed_items?: string[];
  new_items?: string[];
}

// ── Tool factory ───────────────────────────────────────────────────────

/**
 * Create a `finish` tool for structured session completion.
 *
 * When called:
 * 1. Validates deliverable paths exist (if status is success)
 * 2. Updates the unified request tracker (SQLite)
 * 3. Returns a formatted summary as the tool output
 *
 * The tool output becomes the final message visible to the parent/manager,
 * replacing unstructured free-text endings.
 */
export function createFinishTool(options: FinishToolOptions): AgentTool<TSchema> {
  const { agentName, projectRoot, persistDir } = options;
  const stateDir = persistDir ?? resolve(projectRoot, ".state");

  return {
    name: "finish",
    label: "Finish",
    description:
      "Signal structured completion of a task. Call this as the LAST action in a session " +
      "to declare outcome (success/failure/blocked/partial), list deliverables, and specify blockers. " +
      "This replaces unstructured 'I'm done' messages with machine-readable completion signals.",
    parameters: finishSchema,
    execute: async (_toolCallId: string, _params: unknown) => {
      const params = _params as FinishParams;
      const { status, summary, deliverables, blockers, next_steps } = params;

      // ── Validate required fields ───────────────────────────────
      if (!status) {
        return {
          content: [{ type: "text" as const, text: "finish() error: 'status' is required." }],
          details: undefined,
        };
      }

      if (!summary || !summary.trim()) {
        return {
          content: [{ type: "text" as const, text: "finish() error: 'summary' is required." }],
          details: undefined,
        };
      }

      // ── Validate blockers required for blocked/failure ─────────
      if ((status === "blocked" || status === "failure") && (!blockers || blockers.length === 0)) {
        return {
          content: [{
            type: "text" as const,
            text: `finish() error: 'blockers' required when status is '${status}'.`,
          }],
          details: undefined,
        };
      }

      // ── Validate deliverable paths exist (for success) ─────────
      const missingDeliverables: string[] = [];
      if (deliverables && deliverables.length > 0) {
        for (const d of deliverables) {
          const resolvedPath = resolve(projectRoot, d.path);
          if (!existsSync(resolvedPath)) {
            missingDeliverables.push(d.path);
          }
        }
      }

      if (status === "success" && missingDeliverables.length > 0) {
        return {
          content: [{
            type: "text" as const,
            text: `finish() error: Deliverables not found on disk: ${missingDeliverables.join(", ")}. ` +
              `Cannot declare success with missing deliverables.`,
          }],
          details: undefined,
        };
      }

      // ── Update unified request tracker (if requestId available) ──
      if (options.requestId && stateDir) {
        getUpdateRequest().then((updateReq) => {
          if (!updateReq) return;
          try {
            const requestStatus = status === "success" ? "COMPLETED"
              : status === "failure" ? "FAILED"
              : "BLOCKED";
            updateReq(stateDir, options.requestId!, {
              status: requestStatus,
              summary,
              completedAt: Date.now(),
            });
          } catch {
            /* non-fatal */
          }
        });
      }

      // ── Build formatted output ─────────────────────────────────
      const statusEmoji = {
        success: "✅",
        failure: "❌",
        blocked: "🚫",
        partial: "⚠️",
      }[status];

      const parts: string[] = [
        `${statusEmoji} **${status.toUpperCase()}**: ${summary}`,
      ];

      if (deliverables && deliverables.length > 0) {
        parts.push("");
        parts.push("**Deliverables:**");
        for (const d of deliverables) {
          const exists = !missingDeliverables.includes(d.path);
          parts.push(`- \`${d.path}\` ${exists ? "✓" : "⚠ MISSING"} — ${d.description}`);
        }
      }

      if (blockers && blockers.length > 0) {
        parts.push("");
        parts.push("**Blockers:**");
        for (const b of blockers) {
          parts.push(`- ${b.reason}: ${b.context}`);
        }
      }

      if (next_steps) {
        parts.push("");
        parts.push(`**Next steps:** ${next_steps}`);
      }

      return {
        content: [{ type: "text" as const, text: parts.join("\n") }],
        details: undefined,
      };
    },
  };
}
