import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { TSchema } from "@earendil-works/pi-ai";
import { createReadTool } from "./read.js";
import { createBashTool } from "./bash.js";
import { createEditTool } from "./edit.js";
import { createWriteTool } from "./write.js";
import type { FileWriteScope } from "./cross-edit-guard.js";

export interface CodingToolsOptions extends FileWriteScope {
  /** Installation root for guards, distinct from an App's working directory. */
  guardRoot?: string;
  /** Working directory for all tools */
  cwd?: string;
  /** Agent name for cross-edit protection */
  agentName?: string;
}

/**
 * Creates the full coding toolset: read + bash + edit + write.
 * Convenience function used by agent-loader for the "coding" preset.
 */
export function createCodingTools(projectRoot: string, options?: CodingToolsOptions): AgentTool<TSchema>[] {
  const agentName = options?.agentName;
  const scope = {
    agentName,
    projectRoot: options?.guardRoot ?? projectRoot,
    agentWriteDirectory: options?.agentWriteDirectory,
    protectedFileWrites: options?.protectedFileWrites?.slice(),
  };
  return [
    createReadTool(projectRoot),
    createBashTool(projectRoot),
    createEditTool(projectRoot, scope),
    createWriteTool(projectRoot, scope),
  ];
}
