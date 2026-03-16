import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { TSchema } from "@mariozechner/pi-ai";
import { constants } from "fs";
import { access as fsAccess, readFile as fsReadFile, writeFile as fsWriteFile } from "fs/promises";
import {
	detectLineEnding,
	fuzzyFindText,
	generateDiffString,
	normalizeForFuzzyMatch,
	normalizeToLF,
	restoreLineEndings,
	stripBom,
} from "./edit-diff.js";
import { resolveToCwd } from "./path-utils.js";
import { checkCrossEditGuard } from "./cross-edit-guard.js";
import { withAbortSignal } from "./abort-utils.js";

const editSchema: TSchema = Type.Object({
	path: Type.String({ description: "Path to the file to edit (relative or absolute)" }),
	oldText: Type.String({ description: "Exact text to find and replace (must match exactly)" }),
	newText: Type.String({ description: "New text to replace the old text with" }),
});

export interface EditToolInput { path: string; oldText: string; newText: string; }

export interface EditToolDetails {
	/** Unified diff of the changes made */
	diff: string;
	/** Line number of the first change in the new file (for editor navigation) */
	firstChangedLine?: number;
}

/**
 * Pluggable operations for the edit tool.
 * Override these to delegate file editing to remote systems (e.g., SSH).
 */
export interface EditOperations {
	/** Read file contents as a Buffer */
	readFile: (absolutePath: string) => Promise<Buffer>;
	/** Write content to a file */
	writeFile: (absolutePath: string, content: string) => Promise<void>;
	/** Check if file is readable and writable (throw if not) */
	access: (absolutePath: string) => Promise<void>;
}

const defaultEditOperations: EditOperations = {
	readFile: (path) => fsReadFile(path),
	writeFile: (path, content) => fsWriteFile(path, content, "utf-8"),
	access: (path) => fsAccess(path, constants.R_OK | constants.W_OK),
};

export interface EditToolOptions {
	/** Custom operations for file editing. Default: local filesystem */
	operations?: EditOperations;
	/** Agent name for cross-edit protection. If set, blocks edits to other agents' protected files. */
	agentName?: string;
	/** Project root directory (needed for cross-edit guard path resolution). Defaults to cwd. */
	projectRoot?: string;
}

export function createEditTool(cwd: string, options?: EditToolOptions): AgentTool<TSchema> {
	const ops = options?.operations ?? defaultEditOperations;
	const agentName = options?.agentName;
	const projectRoot = options?.projectRoot ?? cwd;

	return {
		name: "edit",
		label: "edit",
		description:
			"Edit a file by replacing exact text. The oldText must match exactly (including whitespace). Use this for precise, surgical edits.",
		parameters: editSchema,
		execute: async (
			_toolCallId: string,
			_params: unknown,
			signal?: AbortSignal,
		) => {
			const { path, oldText, newText } = _params as EditToolInput;
			const absolutePath = resolveToCwd(path, cwd);

			// Cross-edit guard: block edits to other agents' protected files
			const guard = checkCrossEditGuard(absolutePath, agentName, projectRoot);
			if (guard.blocked) {
				return {
					content: [{ type: "text", text: guard.message! }],
					details: undefined,
				};
			}

			return withAbortSignal(signal, async (isAborted) => {
				// Check if file exists
				try {
					await ops.access(absolutePath);
				} catch {
					throw new Error(`File not found: ${path}`);
				}

				if (isAborted()) return { content: [{ type: "text" as const, text: "" }], details: undefined };

				// Read the file
				const buffer = await ops.readFile(absolutePath);
				const rawContent = buffer.toString("utf-8");

				if (isAborted()) return { content: [{ type: "text" as const, text: "" }], details: undefined };

				// Strip BOM before matching (LLM won't include invisible BOM in oldText)
				const { bom, text: content } = stripBom(rawContent);

				const originalEnding = detectLineEnding(content);
				const normalizedContent = normalizeToLF(content);
				const normalizedOldText = normalizeToLF(oldText);
				const normalizedNewText = normalizeToLF(newText);

				// Find the old text using fuzzy matching (tries exact match first, then fuzzy)
				const matchResult = fuzzyFindText(normalizedContent, normalizedOldText);

				if (!matchResult.found) {
					throw new Error(
						`Could not find the exact text in ${path}. The old text must match exactly including all whitespace and newlines.`,
					);
				}

				// Count occurrences using fuzzy-normalized content for consistency
				const fuzzyContent = normalizeForFuzzyMatch(normalizedContent);
				const fuzzyOldText = normalizeForFuzzyMatch(normalizedOldText);
				const occurrences = fuzzyContent.split(fuzzyOldText).length - 1;

				if (occurrences > 1) {
					throw new Error(
						`Found ${occurrences} occurrences of the text in ${path}. The text must be unique. Please provide more context to make it unique.`,
					);
				}

				if (isAborted()) return { content: [{ type: "text" as const, text: "" }], details: undefined };

				// Perform replacement using the matched text position
				// When fuzzy matching was used, contentForReplacement is the normalized version
				const baseContent = matchResult.contentForReplacement;
				const newContent =
					baseContent.substring(0, matchResult.index) +
					normalizedNewText +
					baseContent.substring(matchResult.index + matchResult.matchLength);

				// Verify the replacement actually changed something
				if (baseContent === newContent) {
					throw new Error(
						`No changes made to ${path}. The replacement produced identical content. This might indicate an issue with special characters or the text not existing as expected.`,
					);
				}

				const finalContent = bom + restoreLineEndings(newContent, originalEnding);
				await ops.writeFile(absolutePath, finalContent);

				if (isAborted()) return { content: [{ type: "text" as const, text: "" }], details: undefined };

				const diffResult = generateDiffString(baseContent, newContent);

				// Smart Edit: include diff context in response so agents can verify
				// without a separate read() call (saves 1 turn per edit)
				const diffPreview = diffResult.diff;
				const lineInfo = diffResult.firstChangedLine
					? ` (line ${diffResult.firstChangedLine})`
					: "";
				const diffLines = diffPreview.split("\n");
				const isTruncated = diffLines.length > 40;
				const shownDiff = isTruncated
					? diffLines.slice(0, 40).join("\n") + "\n... (diff truncated, " + diffLines.length + " total lines changed)"
					: diffPreview;

				const smartResponse = [
					`✅ Edit applied to ${path}${lineInfo}`,
					"```diff",
					shownDiff,
					"```",
					"Verify the diff above. If incorrect, re-edit immediately.",
				].join("\n");

				return {
					content: [
						{
							type: "text" as const,
							text: smartResponse,
						},
					],
					details: { diff: diffResult.diff, firstChangedLine: diffResult.firstChangedLine } as EditToolDetails,
				};
			});
		},
	};
}

/** Default edit tool using process.cwd() - for backwards compatibility */
export const editTool = createEditTool(process.cwd());
