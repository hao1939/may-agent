import type { SubagentManager } from "../../../lib/index.js";
import type { SubagentDefinition } from "../../../lib/types.js";

export function captureAgentDefinitions(input: SubagentManager): ReadonlyMap<string, SubagentDefinition> | undefined {
  const manager = input as SubagentManager & {
    agentNames?: () => string[];
    getAgentDefinition?: (name: string) => SubagentDefinition | undefined;
  };
  if (typeof manager.agentNames !== "function" || typeof manager.getAgentDefinition !== "function") return undefined;
  const definitions = new Map<string, SubagentDefinition>();
  for (const name of manager.agentNames()) {
    const definition = manager.getAgentDefinition(name);
    if (definition) definitions.set(name, definition);
  }
  return definitions;
}
