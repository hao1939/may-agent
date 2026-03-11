import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { TSchema } from "@mariozechner/pi-ai";
import { createReadTool } from "./read.js";
import { createBashTool } from "./bash.js";
import { createEditTool } from "./edit.js";
import { createWriteTool } from "./write.js";

export interface CodingToolsOptions {
  /** Working directory for all tools */
  cwd?: string;
}

/**
 * Creates the full coding toolset: read + bash + edit + write.
 * Convenience function used by agent-loader for the "coding" preset.
 */
export function createCodingTools(projectRoot: string): AgentTool<TSchema>[] {
  return [
    createReadTool(projectRoot),
    createBashTool(projectRoot),
    createEditTool(projectRoot),
    createWriteTool(projectRoot),
  ];
}
