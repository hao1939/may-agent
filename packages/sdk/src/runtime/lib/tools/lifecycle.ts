import { Compile } from "typebox/compile";
import { Type, type TSchema } from "typebox";
/**
 * Lifecycle tools — structured turn completion.
 *
 * `finish()` signals "I'm done with this turn" — NOT "close the session."
 *
 * What finish() does:
 *   - Reports status (success/failure/blocked/partial) + summary
 *   - Validates deliverables exist on disk
 *   - Returns a report; the caller records the turn and runs its configured hooks
 *
 * What finish() does NOT do:
 *   - Create or complete Tasks/Requests from report text
 *   - Activate guidance or load reported context into future sessions
 *   - Choose whether the session becomes idle or terminal (the caller's autoClose policy does that)
 *   - Prevent further messages (chat sessions accept input after finish)
 *
 * Session lifecycle after finish():
 *   - Chat (autoClose: "never"):  turn ends → session idle → awaits next input
 *   - Job  (autoClose: "immediate"): turn ends → session terminal → parent continues
 *   - Call (autoClose: "immediate"): turn ends → session terminal → caller gets result
 *
 * The session close decision belongs to whoever created it, not to the agent.
 */

import type { AgentTool } from "@earendil-works/pi-agent-core";
import { existsSync } from "fs";
import { resolve } from "path";

// ── Types ────────────────────────────────────────────────────────────────

export interface FinishToolOptions {
  /** Project root for resolving deliverable paths. */
  projectRoot: string;
}

// ── Schema ───────────────────────────────────────────────────────────────

const finishSchema: TSchema = Type.Object({
  status: Type.Union(
    [Type.Literal("success"), Type.Literal("failure"), Type.Literal("blocked"), Type.Literal("partial")],
    {
      description:
        "Your assessment of this contribution: 'success', 'failure', 'blocked' (needs external input), or 'partial' (work remains). The caller judges fulfillment of its assignment; this status does not settle a Task.",
    },
  ),
  summary: Type.String({
    pattern: "\\S",
    description:
      "1-2 sentence executive summary of what was accomplished. This is shown to the calling agent, so be concrete: mention specific files changed, tests passed, or errors encountered.",
  }),
  deliverables: Type.Optional(
    Type.Array(
      Type.Object({
        path: Type.String({ description: "File path relative to project root" }),
        description: Type.String({ description: "What this file is or what changed in it" }),
      }),
      {
        description:
          "Files produced or modified during this session. The calling agent uses these paths to review your work.",
      },
    ),
  ),
  blockers: Type.Optional(
    Type.Array(
      Type.Object({
        reason: Type.String({ description: "What is blocking progress" }),
        context: Type.String({ description: "Additional context: what you tried, why it failed, what's needed" }),
      }),
      {
        description:
          "Additional details about what prevented completion, when available. The summary can explain the blocker without this field.",
      },
    ),
  ),
});

interface FinishParams {
  status: "success" | "failure" | "blocked" | "partial";
  summary: string;
  deliverables?: { path: string; description: string }[];
  blockers?: { reason: string; context: string }[];
}

// ── Tool factory ─────────────────────────────────────────────────────────

/**
 * Create a `finish` tool for structured session completion.
 *
 * When called:
 * 1. Validates deliverable paths exist (if status is success)
 * 2. Returns a formatted summary as the tool output
 *
 * The caller extracts accepted finish arguments from session facts and owns
 * the resulting work state. Report fields are not additional state-changing tools.
 */
export function createFinishTool(options: FinishToolOptions): AgentTool<TSchema> {
  const { projectRoot } = options;

  return {
    name: "finish",
    label: "Finish",
    description:
      "Signal structured completion of the current turn. Reports what you accomplished " +
      "(status, summary, deliverables, blockers). Call this when you're done working — " +
      "the session may continue with further input from the user or caller. " +
      "This does NOT close the session; it ends the turn and records your results.",
    parameters: finishSchema,
    execute: async (_toolCallId: string, _params: unknown) => {
      const params = _params as FinishParams;
      const { status, summary, deliverables, blockers } = params;

      // ── Validate required fields ─────────────────────────────────
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
          content: [
            {
              type: "text" as const,
              text:
                `finish() error: Deliverables not found on disk: ${missingDeliverables.join(", ")}. ` +
                `Cannot declare success with missing deliverables.`,
            },
          ],
          details: undefined,
        };
      }

      // ── Build formatted output ───────────────────────────────────
      const statusEmoji = {
        success: "✅",
        failure: "❌",
        blocked: "🚫",
        partial: "⚠️",
      }[status];

      const parts: string[] = [`${statusEmoji} **${status.toUpperCase()}**: ${summary}`];

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

      return {
        content: [{ type: "text" as const, text: parts.join("\n") }],
        details: undefined,
        terminate: true,
      };
    },
  };
}

function addRequiredResult(base: TSchema, result: TSchema): TSchema {
  const objectSchema = base as {
    type?: unknown;
    properties?: Record<string, TSchema>;
    required?: unknown;
  };
  if (objectSchema.type !== "object" || !objectSchema.properties) {
    throw new Error("Workflow finish requires a finish tool with an object parameter schema");
  }
  const required = Array.isArray(objectSchema.required)
    ? objectSchema.required.filter((name): name is string => typeof name === "string")
    : [];
  return {
    ...base,
    properties: { ...objectSchema.properties, result },
    required: [...new Set([...required, "result"])],
  } as TSchema;
}

/**
 * Apply the caller's completion contract to the existing terminal tool.
 * When supplied, outputSchema becomes the required finish().result.
 */
export function createWorkflowFinishTool(
  baseFinish: AgentTool,
  outputSchema?: TSchema,
  validateOutput?: (result: unknown) => string | null,
): AgentTool {
  const parameters = outputSchema ? addRequiredResult(baseFinish.parameters, outputSchema) : baseFinish.parameters;
  const validator = Compile(parameters);
  const validateReport = (params: unknown) => {
    if (!validator.Check(params)) {
      // The schema declares accepted representations, including inputs to the
      // App's normalization. Check it before Pi's independent tool coercion.
      // Keep the report in its tool call rather than echoing it in the error.
      const problems = validator.Errors(params).slice(0, 8).map((error) =>
        `  - ${(error.instancePath || "/").slice(0, 200)}: ${error.message.slice(0, 200)}`,
      );
      throw new Error(
        `finish() error: Report does not match the supplied schema (up to 8 errors shown).\n${problems.join("\n")}\n` +
        "Submit a corrected report; the original arguments remain in this tool call.",
      );
    }
    return params;
  };

  return {
    ...baseFinish,
    description: outputSchema
      ? `${baseFinish.description} Return a report matching the supplied result schema, including its required fields. Omit unavailable optional information instead of inventing it. A valid report may describe incomplete work or a blocker; the caller judges fulfillment and the next action.`
      : `${baseFinish.description} Complete this invocation through this tool.`,
    parameters,
    prepareArguments: validateReport,
    execute: async (toolCallId, params, signal, onUpdate) => {
      // Direct execution must enforce the same TypeBox contract as the model loop.
      validateReport(params);
      const problem = validateOutput?.((params as { result?: unknown }).result);
      if (problem) {
        return { content: [{ type: "text" as const, text: `finish() error: ${problem}` }], details: undefined };
      }
      const result = await baseFinish.execute(toolCallId, params, signal, onUpdate);
      const failed = result.content.some(
        (content) => content.type === "text" && content.text.trimStart().startsWith("finish() error:"),
      );
      return failed ? result : { ...result, terminate: true };
    },
  };
}
