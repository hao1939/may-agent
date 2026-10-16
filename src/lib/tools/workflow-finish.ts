import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { TSchema } from "@earendil-works/pi-ai";
import { admitTaskResultForSchema } from "@may-agent/sdk";
import { Compile } from "typebox/compile";

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
      // Report types are part of the caller's contract. Check the original
      // arguments before Pi's ordinary tool coercion, using the visible schema.
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
