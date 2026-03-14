import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { TSchema } from "@mariozechner/pi-ai";
import { mkdir as fsMkdir, writeFile as fsWriteFile, stat as fsStat } from "fs/promises";
import { dirname } from "path";
import { resolveToCwd } from "./path-utils.js";
import { checkCrossEditGuard } from "./cross-edit-guard.js";
import { withAbortSignal } from "./abort-utils.js";

const writeSchema: TSchema = Type.Object({
	path: Type.String({ description: "Path to the file to write (relative or absolute)" }),
	content: Type.String({ description: "Content to write to the file" }),
});

export interface WriteToolInput { path: string; content: string; }

/**
 * Pluggable operations for the write tool.
 * Override these to delegate file writing to remote systems (e.g., SSH).
 */
export interface WriteOperations {
	/** Write content to a file */
	writeFile: (absolutePath: string, content: string) => Promise<void>;
	/** Create directory (recursively) */
	mkdir: (dir: string) => Promise<void>;
	/** Get file size in bytes. Returns null if file doesn't exist. */
	fileSize?: (absolutePath: string) => Promise<number | null>;
}

const defaultWriteOperations: WriteOperations = {
	writeFile: (path, content) => fsWriteFile(path, content, "utf-8"),
	mkdir: (dir) => fsMkdir(dir, { recursive: true }).then(() => {}),
	fileSize: async (path) => {
		try {
			const s = await fsStat(path);
			return s.size;
		} catch {
			return null;
		}
	},
};

export interface WriteToolOptions {
	/** Custom operations for file writing. Default: local filesystem */
	operations?: WriteOperations;
	/** Allow writing content smaller than 50% of existing file. Default: false */
	allowShrink?: boolean;
	/** Agent name for cross-edit protection. If set, blocks writes to other agents' protected files. */
	agentName?: string;
	/** Project root directory (needed for cross-edit guard path resolution). Defaults to cwd. */
	projectRoot?: string;
}

/** Minimum existing file size (bytes) for the shrink guard to apply */
const SHRINK_GUARD_MIN_SIZE = 500;
/** Below this ratio, block the write entirely */
const SHRINK_BLOCK_RATIO = 0.5;
/** Below this ratio, warn but allow */
const SHRINK_WARN_RATIO = 0.8;

export function createWriteTool(cwd: string, options?: WriteToolOptions): AgentTool<TSchema> {
	const ops = options?.operations ?? defaultWriteOperations;
	const allowShrink = options?.allowShrink ?? false;
	const agentName = options?.agentName;
	const projectRoot = options?.projectRoot ?? cwd;

	return {
		name: "write",
		label: "write",
		description:
			"Write content to a file. Creates the file if it doesn't exist, overwrites if it does. Automatically creates parent directories.",
		parameters: writeSchema,
		execute: async (
			_toolCallId: string,
			_params: unknown,
			signal?: AbortSignal,
		) => {
			const { path, content } = _params as WriteToolInput;
			const absolutePath = resolveToCwd(path, cwd);
			const dir = dirname(absolutePath);

			// Cross-edit guard: block writes to other agents' protected files
			const guard = checkCrossEditGuard(absolutePath, agentName, projectRoot);
			if (guard.blocked) {
				return {
					content: [{ type: "text" as const, text: guard.message! }],
					details: undefined,
				};
			}

			return withAbortSignal(signal, async (isAborted) => {
				// Create parent directories if needed
				await ops.mkdir(dir);

				if (isAborted()) return { content: [{ type: "text" as const, text: "" }], details: undefined };

				// Shrink guard: check if new content is significantly smaller than existing file
				let shrinkWarning = "";
				if (!allowShrink && ops.fileSize) {
					const existingSize = await ops.fileSize(absolutePath);
					if (existingSize !== null && existingSize >= SHRINK_GUARD_MIN_SIZE) {
						const newSize = Buffer.byteLength(content, "utf-8");
						const ratio = newSize / existingSize;
						if (ratio < SHRINK_BLOCK_RATIO) {
							return {
								content: [{ type: "text" as const, text: `⚠️ WRITE BLOCKED: New content (${newSize} bytes) is ${Math.round(ratio * 100)}% of existing file (${existingSize} bytes). This looks like a truncated rewrite that would lose data. Use edit() for surgical changes, or read the full file first to ensure you have all content. If you're sure, use bash to write directly.` }],
								details: undefined,
							};
						} else if (ratio < SHRINK_WARN_RATIO) {
							shrinkWarning = ` ⚠️ WARNING: New content is ${Math.round(ratio * 100)}% of previous size (${existingSize} → ${newSize} bytes). Verify no data was lost.`;
						}
					}
				}

				// Write the file
				await ops.writeFile(absolutePath, content);

				if (isAborted()) return { content: [{ type: "text" as const, text: "" }], details: undefined };

				return {
					content: [{ type: "text" as const, text: `Successfully wrote ${content.length} bytes to ${path}${shrinkWarning}` }],
					details: undefined,
				};
			});
		},
	};
}

/** Default write tool using process.cwd() - for backwards compatibility */
export const writeTool = createWriteTool(process.cwd());
