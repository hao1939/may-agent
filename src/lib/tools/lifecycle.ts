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
import { existsSync, appendFileSync } from "fs";
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
    description: "'success': task completed fully. 'failure': task failed (include blockers). 'blocked': cannot proceed without external input. 'partial': some progress made but not complete (include next_steps).",
  }),
  summary: Type.String({
    description: "1-2 sentence executive summary of what was accomplished. This is shown to the calling agent, so be concrete: mention specific files changed, tests passed, or errors encountered.",
  }),
  deliverables: Type.Optional(Type.Array(
    Type.Object({
      path: Type.String({ description: "File path relative to project root" }),
      description: Type.String({ description: "What this file is or what changed in it" }),
    }),
    { description: "Files produced or modified during this session. The calling agent uses these paths to review your work." },
  )),
  blockers: Type.Optional(Type.Array(
    Type.Object({
      reason: Type.String({ description: "What is blocking progress" }),
      context: Type.String({ description: "Additional context: what you tried, why it failed, what's needed" }),
    }),
    { description: "What prevented completion. Required when status is 'failure' or 'blocked'." },
  )),
  next_steps: Type.Optional(Type.String({
    description: "Recommended next actions for whoever picks this up. Required when status is 'partial' or 'blocked'.",
  })),
  completed_items: Type.Optional(Type.Array(
    Type.String({ description: "Description of a task completed this session. Fuzzy-matched against pending requests in the DB to auto-mark them COMPLETED." }),
    { description: "Tasks completed during this session. Infrastructure automatically resolves matching tracked requests." },
  )),
  new_items: Type.Optional(Type.Array(
    Type.String({ description: "Description of a new task to track (self-assigned follow-up work)" }),
    { description: "New tasks discovered during this session. Infrastructure creates tracked requests for them." },
  )),
  lessons: Type.Optional(Type.Array(
    Type.Object({
      category: Type.Union([
        Type.Literal("fix"),
        Type.Literal("pattern"),
        Type.Literal("insight"),
      ], { description: "'fix': what you learned from a bug/error. 'pattern': a reusable approach worth remembering. 'insight': an observation about the system or codebase." }),
      content: Type.String({ description: "The lesson — specific and actionable, not generic. Bad: 'always test'. Good: 'manager.ts uses lazy DB init, must call getDb() not import db directly'." }),
    }),
    { description: "Lessons learned this session. Persisted to memory for cross-session learning." },
  )),
  verification_evidence: Type.Optional(Type.Array(
    Type.String({ description: "Reference to a specific tool output proving your work. Format: 'Step N: <tool> showed <result>'. Example: 'Step 12: read(src/app.ts) confirmed new function exists', 'Step 8: bash test exit code 0'." }),
    { description: "Evidence from this session's tool outputs that verify your deliverables. Required when status is 'success'. Cite specific tool calls and their results." },
  )),
  context_updates: Type.Optional(Type.Array(
    Type.Object({
      action: Type.Union([
        Type.Literal("add"),
        Type.Literal("remove"),
      ], { description: "'add': persist a new fact. 'remove': delete a stale/incorrect fact." }),
      content: Type.String({ description: "The fact to add or remove. Keep short (one line). Example: 'User prefers Vitest over Jest', 'DB uses node:sqlite not better-sqlite3'." }),
    }),
    { description: "Persistent context updates. Facts added here are loaded into future sessions via agents/<name>/context.md. Use sparingly — only for durable project knowledge, user preferences, or corrections." },
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
  lessons?: Array<{ category: "fix" | "pattern" | "insight"; content: string }>;
  verification_evidence?: string[];
  context_updates?: Array<{ action: "add" | "remove"; content: string }>;
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
      "This replaces unstructured 'I'm done' messages with machine-readable completion signals. " +
      "Optionally include lessons learned (fix/pattern/insight) for cross-session memory.",
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

      // ── Require verification evidence for success ─────────────
      if (status === "success" && (!params.verification_evidence || params.verification_evidence.length === 0)) {
        return {
          content: [{ type: "text" as const, text: 
            "finish() error: 'verification_evidence' is required when status is 'success'. " +
            "Cite specific tool outputs that verify your work, e.g.:\n" +
            '- "Step 5: read(src/app.ts) shows new function added"\n' +
            '- "Step 8: bash test suite exit code 0"\n' +
            '- "Step 3: edit() confirmed by read-back"\n' +
            "Add verification_evidence and try again."
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

      // ── Persist lessons to memory-stream.jsonl ─────────────────
      if (params.lessons && params.lessons.length > 0 && stateDir) {
        try {
          const streamPath = resolve(stateDir, "memory-stream.jsonl");
          const now = new Date().toISOString();
          for (const lesson of params.lessons) {
            const entry = JSON.stringify({
              timestamp: now,
              agent: agentName,
              category: lesson.category,
              content: lesson.content,
            });
            appendFileSync(streamPath, entry + "\n");
          }
        } catch {
          /* non-fatal — lesson persistence should never break finish() */
        }
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

      if (params.lessons && params.lessons.length > 0) {
        parts.push("");
        parts.push("**Lessons recorded:**");
        for (const l of params.lessons) {
          parts.push(`- [${l.category}] ${l.content}`);
        }
      }

      if (params.verification_evidence && params.verification_evidence.length > 0) {
        parts.push("");
        parts.push("**Verification evidence:**");
        for (const ev of params.verification_evidence) {
          parts.push(`- ${ev}`);
        }
      }

      return {
        content: [{ type: "text" as const, text: parts.join("\n") }],
        details: undefined,
      };
    },
  };
}
