import type { AgentTool } from "@earendil-works/pi-agent-core";

export type SourcedAgentTool = {
  tool: AgentTool;
  source: string;
};

/** Fail closed when two construction paths expose the same concrete model tool name. */
export function assertUniqueToolNames(entries: readonly SourcedAgentTool[], agentName: string): void {
  const seen = new Map<string, string>();
  for (const { tool, source } of entries) {
    const prior = seen.get(tool.name);
    if (prior !== undefined) {
      throw new Error(
        `Agent ${agentName} has duplicate model-visible tool name "${tool.name}" from ${prior} and ${source}`,
      );
    }
    seen.set(tool.name, source);
  }
}
