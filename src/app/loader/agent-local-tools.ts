import type { AgentTool } from "@earendil-works/pi-agent-core";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { importRuntimeModule } from "../../lib/runtime-import.js";

export type AgentLocalToolLoaderOptions = {
  projectRoot: string;
  persistDir: string;
  onNotice?: (message: string) => void;
  onLoaded?: (toolName: string) => void;
};

/** Load agent-local tool factories without depending on EventBus or the daemon. */
export async function loadAgentLocalTools(
  agentName: string,
  agentDir: string,
  options: AgentLocalToolLoaderOptions,
): Promise<AgentTool[]> {
  const toolsDir = resolve(agentDir, "tools");
  if (!existsSync(toolsDir)) return [];

  const tools: AgentTool[] = [];
  const entries = readdirSync(toolsDir)
    .filter((file) => file.endsWith(".ts") || file.endsWith(".js"))
    .sort();

  for (const file of entries) {
    const filePath = resolve(toolsDir, file);
    try {
      const module = await importRuntimeModule<{ default?: unknown }>(filePath);
      if (typeof module.default !== "function") {
        options.onNotice?.(`Skipping ${agentName}/tools/${file}: expected a default tool factory`);
        continue;
      }
      const tool = await module.default({
        projectRoot: options.projectRoot,
        agentRoot: agentDir,
        persistDir: options.persistDir,
      });
      if (!tool || typeof tool.name !== "string" || !tool.name.trim()) {
        options.onNotice?.(`Skipping ${agentName}/tools/${file}: factory returned no named tool`);
        continue;
      }
      tools.push(tool as AgentTool);
      options.onLoaded?.(tool.name);
    } catch (error) {
      options.onNotice?.(
        `Failed to load ${agentName}/tools/${file}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return tools;
}
