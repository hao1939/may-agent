import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type } from "@earendil-works/pi-ai";
import type { TSchema } from "@earendil-works/pi-ai";
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
	path: Type.String({ description: "Path to the file to edit (relative or absolute). The file must already exist." }),
	oldText: Type.String({ description: "The exact text to find in the file. Must match character-for-character including whitespace and newlines. Read the file first to copy the exact text. If this text appears more than once in the file, include more surrounding lines to make it unique — the tool rejects ambiguous matches." }),
	newText: Type.String({ description: "The replacement text. To delete text, pass an empty string. To insert text, include the surrounding context in oldText and add the new content in newText at the desired position." }),
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
		description: [
			"Edit a file by replacing exact text with new text.",
			"The oldText must match exactly (including whitespace and newlines).",
			"If oldText is not found, the call fails — read the file first to get the exact text.",
			"If oldText appears more than once, the call fails — include more surrounding context to make it unique.",
			"A diff preview is returned for quick inspection; read() the file back before finish(success).",
			"For new files or full rewrites, use write() instead.",
		].join(" "),
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
				// Preserve the actual boundary: missing, permission denied, read-only,
				// and I/O errors require different responses from the caller.
				await ops.access(absolutePath);

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

				// Smart Edit: include diff context for immediate inspection.
				// Agents still need a read-back before finish(success).
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
					"Inspect the diff above, then read() this file before finish(success).",
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
