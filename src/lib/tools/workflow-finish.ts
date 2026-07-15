import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { TSchema } from "@earendil-works/pi-ai";

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
 * Adapt the existing finish tool into the single terminal tool for a workflow
 * step. When supplied, outputSchema becomes the required finish().result.
 */
export function createWorkflowFinishTool(baseFinish: AgentTool, outputSchema?: TSchema): AgentTool {
  const parameters = outputSchema ? addRequiredResult(baseFinish.parameters, outputSchema) : baseFinish.parameters;

  return {
    ...baseFinish,
    description: outputSchema
      ? `${baseFinish.description} This workflow step requires a caller-defined result payload matching the result schema.`
      : `${baseFinish.description} This workflow step must terminate through this tool.`,
    parameters,
    execute: async (toolCallId, params, signal, onUpdate) => {
      const result = await baseFinish.execute(toolCallId, params, signal, onUpdate);
      const failed = result.content.some(
        (content) => content.type === "text" && content.text.trimStart().startsWith("finish() error:"),
      );
      return failed ? result : { ...result, terminate: true };
    },
  };
}
