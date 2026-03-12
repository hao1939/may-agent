import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { TSchema } from "@mariozechner/pi-ai";
import { mkdir as fsMkdir, writeFile as fsWriteFile, stat as fsStat } from "fs/promises";
import { dirname } from "path";
import { resolveToCwd } from "./path-utils.js";

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

			return new Promise<{ content: Array<{ type: "text"; text: string }>; details: undefined }>(
				(resolve, reject) => {
					// Check if already aborted
					if (signal?.aborted) {
						reject(new Error("Operation aborted"));
						return;
					}

					let aborted = false;

					// Set up abort handler
					const onAbort = () => {
						aborted = true;
						reject(new Error("Operation aborted"));
					};

					if (signal) {
						signal.addEventListener("abort", onAbort, { once: true });
					}

					// Perform the write operation
					(async () => {
						try {
							// Create parent directories if needed
							await ops.mkdir(dir);

							// Check if aborted before writing
							if (aborted) {
								return;
							}

							// Shrink guard: check if new content is significantly smaller than existing file
							let shrinkWarning = "";
							if (!allowShrink && ops.fileSize) {
								const existingSize = await ops.fileSize(absolutePath);
								if (existingSize !== null && existingSize >= SHRINK_GUARD_MIN_SIZE) {
									const newSize = Buffer.byteLength(content, "utf-8");
									const ratio = newSize / existingSize;
									if (ratio < SHRINK_BLOCK_RATIO) {
										// Clean up abort handler before resolving
										if (signal) {
											signal.removeEventListener("abort", onAbort);
										}
										resolve({
											content: [{ type: "text", text: `⚠️ WRITE BLOCKED: New content (${newSize} bytes) is ${Math.round(ratio * 100)}% of existing file (${existingSize} bytes). This looks like a truncated rewrite that would lose data. Use edit() for surgical changes, or read the full file first to ensure you have all content. If you're sure, use bash to write directly.` }],
											details: undefined,
										});
										return;
									} else if (ratio < SHRINK_WARN_RATIO) {
										shrinkWarning = ` ⚠️ WARNING: New content is ${Math.round(ratio * 100)}% of previous size (${existingSize} → ${newSize} bytes). Verify no data was lost.`;
									}
								}
							}

							// Write the file
							await ops.writeFile(absolutePath, content);

							// Check if aborted after writing
							if (aborted) {
								return;
							}

							// Clean up abort handler
							if (signal) {
								signal.removeEventListener("abort", onAbort);
							}

							resolve({
								content: [{ type: "text", text: `Successfully wrote ${content.length} bytes to ${path}${shrinkWarning}` }],
								details: undefined,
							});
						} catch (error: any) {
							// Clean up abort handler
							if (signal) {
								signal.removeEventListener("abort", onAbort);
							}

							if (!aborted) {
								reject(error);
							}
						}
					})();
				},
			);
		},
	};
}

/** Default write tool using process.cwd() - for backwards compatibility */
export const writeTool = createWriteTool(process.cwd());
