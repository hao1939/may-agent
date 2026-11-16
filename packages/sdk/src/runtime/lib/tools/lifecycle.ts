import { Compile } from "typebox/compile";
import { Type, type TSchema } from "typebox";
/**
 * Lifecycle tools — structured turn completion.
 *
 * `finish()` signals "I'm done with this bounded execution" — it does not
 * decide whether a caller, session, or durable orchestration resource is done.
 *
 * Prompt agents use the same result vocabulary as code procedures:
 * `status`, `summary`, optional `output`, and optional supporting `facts`.
 */

import type { AgentTool } from "@earendil-works/pi-agent-core";

// ── Types ────────────────────────────────────────────────────────────────

export interface FinishToolOptions {
  /** Retained for caller compatibility; finish no longer interprets workspace files. */
  projectRoot: string;
}

// ── Schema ───────────────────────────────────────────────────────────────

const finishSchema: TSchema = Type.Object({
  status: Type.Union([Type.Literal("done"), Type.Literal("blocked")], {
    description:
      "Whether this bounded execution completed its assignment or is blocked on an external prerequisite.",
  }),
  summary: Type.String({
    pattern: "\\S",
    description: "A concise, concrete summary of the execution result.",
  }),
  output: Type.Optional(Type.Unknown({
    description: "The caller-defined output. A supplied output schema replaces this with its validated shape.",
  })),
  facts: Type.Optional(Type.Unknown({
    description: "Supporting evidence or blocker context that the caller may inspect.",
  })),
});

interface FinishParams {
  status: "done" | "blocked";
  summary: string;
  output?: unknown;
  facts?: unknown;
}

// ── Tool factory ─────────────────────────────────────────────────────────

/** Create the terminal tool used by prompt-based agent executions. */
export function createFinishTool(_options: FinishToolOptions): AgentTool<TSchema> {
  return {
    name: "finish",
    label: "Finish",
    description:
      "Return the result of this bounded execution using the same vocabulary as ExecutionResult: " +
      "status ('done' or 'blocked'), summary, optional output, and optional facts. " +
      "The caller decides what happens after this execution.",
    parameters: finishSchema,
    execute: async (_toolCallId: string, _params: unknown) => {
      const params = _params as FinishParams;
      const { status, summary } = params;

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

      const marker = status === "done" ? "✅" : "🚫";
      return {
        content: [{ type: "text" as const, text: `${marker} **${status.toUpperCase()}**: ${summary}` }],
        details: undefined,
        terminate: true,
      };
    },
  };
}

function addRequiredOutput(base: TSchema, output: TSchema): TSchema {
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
    properties: { ...objectSchema.properties, output },
    required: [...new Set([...required, "output"])],
  } as TSchema;
}

/** Apply the caller's TypeBox output contract to the terminal tool. */
export function createWorkflowFinishTool(
  baseFinish: AgentTool,
  outputSchema?: TSchema,
  validateOutput?: (output: unknown) => string | null,
): AgentTool {
  const parameters = outputSchema ? addRequiredOutput(baseFinish.parameters, outputSchema) : baseFinish.parameters;
  const validator = Compile(parameters);
  const validateReport = (params: unknown) => {
    if (!validator.Check(params)) {
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
      ? `${baseFinish.description} Return output matching the supplied schema, including its required fields. Omit unavailable optional information instead of inventing it.`
      : `${baseFinish.description} Complete this invocation through this tool.`,
    parameters,
    prepareArguments: validateReport,
    execute: async (toolCallId, params, signal, onUpdate) => {
      validateReport(params);
      const problem = validateOutput?.((params as { output?: unknown }).output);
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
