import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { TSchema } from "@earendil-works/pi-ai";
import { admitTaskResultForSchema } from "@may-agent/sdk";

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
export function createWorkflowFinishTool(baseFinish: AgentTool, outputSchema?: TSchema): AgentTool {
  const parameters = outputSchema ? addRequiredResult(baseFinish.parameters, outputSchema) : baseFinish.parameters;

  return {
    ...baseFinish,
    description: outputSchema
      ? `${baseFinish.description} Complete this invocation with a result payload matching the supplied schema. This reports to the caller; the caller judges whether the contribution fulfills its work.`
      : `${baseFinish.description} Complete this invocation through this tool.`,
    parameters,
    execute: async (toolCallId, params, signal, onUpdate) => {
      const semanticAdmission = admitTaskResultForSchema(outputSchema, (params as { result?: unknown }).result);
      if (semanticAdmission && !semanticAdmission.ok) {
        return {
          content: [{ type: "text" as const, text: `finish() error: ${semanticAdmission.error}` }],
          details: undefined,
        };
      }
      const result = await baseFinish.execute(toolCallId, params, signal, onUpdate);
      const failed = result.content.some(
        (content) => content.type === "text" && content.text.trimStart().startsWith("finish() error:"),
      );
      return failed ? result : { ...result, terminate: true };
    },
  };
}
