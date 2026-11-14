import { type TSchema } from "typebox";
import type { FileWritePolicy } from "./file-write-policy.js";
import type { AgentTool } from "@earendil-works/pi-agent-core";

import { createReadTool } from "./read.js";
import { createBashTool } from "./bash.js";
import { createEditTool } from "./edit.js";
import { createWriteTool } from "./write.js";

export interface CodingToolsOptions {
  /** Enforced by the write and edit tools only; bash remains an unmediated command effect path. */
  fileWritePolicy?: FileWritePolicy;
  /** Working directory for all tools */
  cwd?: string;
  /** Agent name for cross-edit protection */
  agentName?: string;
  /** Persist local setsid bash process groups under this session for confirmed cleanup. */
  processGroupOwner?: { persistDir: string; sessionId: string };
}

/**
 * Creates the full coding toolset: read + bash + edit + write.
 * Convenience function used by agent-loader for the "coding" preset.
 */
export function createCodingTools(projectRoot: string, options?: CodingToolsOptions): AgentTool<TSchema>[] {
  const agentName = options?.agentName;
  return [
    createReadTool(projectRoot),
    createBashTool(projectRoot, options?.processGroupOwner ? { processGroupOwner: options.processGroupOwner } : undefined),
    createEditTool(projectRoot, { agentName, projectRoot, fileWritePolicy: options?.fileWritePolicy }),
    createWriteTool(projectRoot, { agentName, projectRoot, fileWritePolicy: options?.fileWritePolicy }),
  ];
}
