// Pi-coding-agent tools (synced from pi-mono)
export {
	type BashOperations,
	type BashSpawnContext,
	type BashSpawnHook,
	type BashToolDetails,
	type BashToolInput,
	type BashToolOptions,
	bashTool,
	createBashTool,
} from "./bash.js";
export {
	createEditTool,
	type EditOperations,
	type EditToolDetails,
	type EditToolInput,
	type EditToolOptions,
	editTool,
} from "./edit.js";
export {
	createReadTool,
	type ReadOperations,
	type ReadToolDetails,
	type ReadToolInput,
	type ReadToolOptions,
	readTool,
} from "./read.js";
export {
	createWriteTool,
	type WriteOperations,
	type WriteToolInput,
	type WriteToolOptions,
	writeTool,
} from "./write.js";
export {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
	type TruncationOptions,
	type TruncationResult,
	truncateHead,
	truncateLine,
	truncateTail,
} from "./truncate.js";
export {
	expandPath,
	resolveReadPath,
	resolveToCwd,
} from "./path-utils.js";
export {
	computeEditDiff,
	detectLineEnding,
	type EditDiffError,
	type EditDiffResult,
	type FuzzyMatchResult,
	fuzzyFindText,
	generateDiffString,
	normalizeForFuzzyMatch,
	normalizeToLF,
	restoreLineEndings,
	stripBom,
} from "./edit-diff.js";

// May-agent-specific tools
export { createHealthCheckTool, type HealthReport } from "./health.js";
export { createLearnTool } from "./learn.js";
export { buildProjectStructure } from "./project-structure.js";
export {
	resolveHallucinatedPath,
	extractHallucinatedRelPath,
	isMetaRecursionCommand,
} from "./may-utils.js";

// Convenience factory
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { type BashToolOptions, createBashTool } from "./bash.js";
import { createEditTool } from "./edit.js";
import { type ReadToolOptions, createReadTool } from "./read.js";
import { createWriteTool } from "./write.js";

export type Tool = AgentTool<any>;

export interface CodingToolsOptions {
	read?: ReadToolOptions;
	bash?: BashToolOptions;
}

/**
 * Create the four core coding tools configured for a specific working directory.
 */
export function createCodingTools(cwd: string, options?: CodingToolsOptions): Tool[] {
	return [
		createReadTool(cwd, options?.read),
		createBashTool(cwd, options?.bash),
		createEditTool(cwd),
		createWriteTool(cwd),
	];
}
