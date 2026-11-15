import { admitTaskResultForSchema } from "@may-agent/sdk";
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


// ── Types ──────────────────────────────────────────────────────────────

export interface FinishToolOptions {
  /** Project root for resolving deliverable paths. */
  projectRoot: string;
}

// ── Schema ─────────────────────────────────────────────────────────────

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
      { description: "Additional details about what prevented completion, when available. The summary can explain the blocker without this field." },
    ),
  ),
  next_steps: Type.Optional(
    Type.String({
      description:
        "Recommended next actions for whoever picks this up, when known.",
    }),
  ),
  completed_items: Type.Optional(
    Type.Array(
      Type.String({
        description:
          "Description of work completed this session, for the caller's report.",
      }),
      {
        description:
          "Reported completed work. This does not complete tracked Tasks or Requests; use the owning App's authorized controls when needed.",
      },
    ),
  ),
  new_items: Type.Optional(
    Type.Array(Type.String({ description: "Suggested follow-up work for the owner to consider" }), {
      description: "Reported follow-up suggestions. This does not create Tasks or Requests.",
    }),
  ),
  lessons: Type.Optional(
    Type.Array(
      Type.Object({
        category: Type.Union([Type.Literal("fix"), Type.Literal("pattern"), Type.Literal("insight")], {
          description:
            "'fix': what you learned from a bug/error. 'pattern': a reusable approach worth remembering. 'insight': an observation about the system or codebase.",
        }),
        content: Type.String({
          description:
            "The lesson — specific and actionable, not generic. Bad: 'always test'. Good: 'manager.ts uses lazy DB init, must call getDb() not import db directly'.",
        }),
      }),
      { description: "Reported lessons, retained in the completion report. This does not write a separate memory file, load lessons into future sessions or activate guidance." },
    ),
  ),
  verification_facts: Type.Optional(
    Type.Array(
      Type.String({
        description:
          "Available evidence or a reference supporting your report. Example: 'bash test exit code 0' or 'Accepted test receipt: artifact/tests.json'.",
      }),
      {
        description:
          "Optional supporting observations. Required domain evidence belongs in the caller's result contract; this field need not repeat it or require another tool call.",
      },
    ),
  ),
  context_updates: Type.Optional(
    Type.Array(
      Type.Object({
        action: Type.Union([Type.Literal("add"), Type.Literal("remove")], {
          description: "Proposed context change: 'add' a fact or 'remove' a stale/incorrect fact.",
        }),
        content: Type.String({
          description:
            "The proposed fact to add or remove. Keep short (one line). Example: 'Project uses Vitest', 'DB uses node:sqlite'.",
        }),
      }),
      {
        description:
          "Reported context-change suggestions only. finish() retains these suggestions in its result without writing context.md or activating guidance. Future-session loading is not automatic. Lasting behavior changes need an authorized source edit and verified activation.",
      },
    ),
  ),
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
  verification_facts?: string[];
  context_updates?: Array<{ action: "add" | "remove"; content: string }>;
}

// ── Tool factory ───────────────────────────────────────────────────────

/**
 * Create a `finish` tool for structured session completion.
 *
 * When called:
 * 1. Validates deliverable paths exist (if status is success)
 * 2. Returns a formatted summary, including reported lessons, as the tool output
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

      // ── Build formatted output ─────────────────────────────────
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

      if (next_steps) {
        parts.push("");
        parts.push(`**Next steps:** ${next_steps}`);
      }

      if (params.lessons && params.lessons.length > 0) {
        parts.push("");
        parts.push("**Lessons reported:**");
        for (const l of params.lessons) {
          parts.push(`- [${l.category}] ${l.content}`);
        }
      }

      if (params.verification_facts && params.verification_facts.length > 0) {
        parts.push("");
        parts.push("**Verification facts:**");
        for (const ev of params.verification_facts) {
          parts.push(`- ${ev}`);
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


/**
 * Providers (such as Gemini 4 over OpenAI completions) reject negative JSON
 * Schema clauses (`not`). Advertise a relaxed clone in the provider payload
 * while retaining the original schema on `tool.parameters` for local validation.
 */
export function providerCompatibleToolSchema(schema: TSchema): TSchema {
  const DATA_CONTAINERS = new Set(["const", "enum", "default", "examples"]);
  const MAP_CONTAINERS = new Set(["properties", "patternProperties", "dependentSchemas", "$defs", "definitions"]);
  const containsNot = (value: unknown, inMap = false): boolean => {
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some((item) => containsNot(item, false));
    const record = value as Record<string, unknown>;
    if (!inMap && Object.hasOwn(record, "not")) return true;
    for (const [k, v] of Object.entries(record)) {
      if (!inMap && DATA_CONTAINERS.has(k)) continue;
      if (containsNot(v, !inMap && MAP_CONTAINERS.has(k))) return true;
    }
    return false;
  };
  const clone = (value: unknown, inMap = false): unknown => {
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map((item) => clone(item, false));
    const source = value as Record<PropertyKey, unknown>;
    const result: Record<PropertyKey, unknown> = {};
    // Keep TypeBox's symbol metadata as well as the JSON Schema fields.
    for (const key of Reflect.ownKeys(source)) {
      if (!inMap && key === "not") continue;
      if (
        !inMap &&
        (key === "anyOf" || key === "oneOf" || key === "allOf") &&
        Array.isArray(source[key]) &&
        source[key].some((branch) => containsNot(branch, false))
      ) {
        continue;
      }
      const nextVal =
        !inMap && typeof key === "string" && DATA_CONTAINERS.has(key)
          ? structuredClone(source[key])
          : clone(source[key], !inMap && typeof key === "string" && MAP_CONTAINERS.has(key));
      Object.defineProperty(result, key, {
        value: nextVal,
        enumerable: Object.getOwnPropertyDescriptor(source, key)?.enumerable ?? true,
        configurable: true,
        writable: true,
      });
    }
    return result;
  };
  return clone(schema) as TSchema;
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
      // Direct execution must enforce the same contract as the model loop.
      validateReport(params);
      const semanticAdmission = admitTaskResultForSchema(outputSchema, (params as { result?: unknown }).result);
      if (semanticAdmission && !semanticAdmission.ok) {
        return {
          content: [{ type: "text" as const, text: `finish() error: ${semanticAdmission.error}` }],
          details: undefined,
        };
      }
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
