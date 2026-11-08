import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type, type TSchema } from "typebox";

const READ_ACTIONS = ["list", "workload", "outcomes", "get", "contract", "communication"] as const;
const allowed = new Set<string>(READ_ACTIONS);

/** Narrow this execution's built-in Task capability without mutating the shared definition. */
export function readOnlyTaskTool(tool: AgentTool): AgentTool {
  const parameters = tool.parameters as TSchema & { properties: Record<string, TSchema> };
  return {
    ...tool,
    description: "Read scoped Task lists, workloads, accepted outcomes, exact assignments, App contracts and current communication. This read-only execution can return recommendations; publishing facts, applying changes, revision and closure require an authorized writing execution.",
    parameters: {
      ...parameters,
      properties: { ...parameters.properties, action: Type.Union(READ_ACTIONS.map(action => Type.Literal(action))) },
    },
    execute: async (...args) => {
      const input = args[1];
      if (!input || typeof input !== "object" || !allowed.has((input as { action?: string }).action ?? ""))
        return { content: [{ type: "text", text: JSON.stringify({ error: "Read-only Task capability does not allow this action" }) }], details: undefined };
      return tool.execute(...args);
    },
  };
}
