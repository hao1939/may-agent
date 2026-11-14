import { createReadTool } from "./read.js";
import { createBashTool } from "./bash.js";
import { createWriteTool } from "./write.js";
/**
 * Shared diff computation utilities for the edit tool.
 * Used by both edit.ts (for execution) and tool-execution.ts (for preview rendering).
 */

import * as Diff from "diff";

export function detectLineEnding(content: string): "\r\n" | "\n" {
	const crlfIdx = content.indexOf("\r\n");
	const lfIdx = content.indexOf("\n");
	if (lfIdx === -1) return "\n";
	if (crlfIdx === -1) return "\n";
	return crlfIdx < lfIdx ? "\r\n" : "\n";
}

/**
 * Normalizes all line endings in a string to LF (`\n`).
 * Converts both CRLF (`\r\n`) and bare CR (`\r`) sequences.
 * @param text - The input string with potentially mixed line endings.
 * @returns The string with all line endings replaced by `\n`.
 */
export function normalizeToLF(text: string): string {
	return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function restoreLineEndings(text: string, ending: "\r\n" | "\n"): string {
	return ending === "\r\n" ? text.replace(/\n/g, "\r\n") : text;
}

/**
 * Normalize text for fuzzy matching. Applies progressive transformations:
 * - Strip trailing whitespace from each line
 * - Normalize smart quotes to ASCII equivalents
 * - Normalize Unicode dashes/hyphens to ASCII hyphen
 * - Normalize special Unicode spaces to regular space
 */
export function normalizeForFuzzyMatch(text: string): string {
	return (
		text
			// Strip trailing whitespace per line
			.split("\n")
			.map((line) => line.trimEnd())
			.join("\n")
			// Smart single quotes → '
			.replace(/[\u2018\u2019\u201A\u201B]/g, "'")
			// Smart double quotes → "
			.replace(/[\u201C\u201D\u201E\u201F]/g, '"')
			// Various dashes/hyphens → -
			// U+2010 hyphen, U+2011 non-breaking hyphen, U+2012 figure dash,
			// U+2013 en-dash, U+2014 em-dash, U+2015 horizontal bar, U+2212 minus
			.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, "-")
			// Special spaces → regular space
			// U+00A0 NBSP, U+2002-U+200A various spaces, U+202F narrow NBSP,
			// U+205F medium math space, U+3000 ideographic space
			.replace(/[\u00A0\u2002-\u200A\u202F\u205F\u3000]/g, " ")
	);
}

interface FuzzyMatchResult {
	/** Whether a match was found */
	found: boolean;
	/** The index where the match starts (in the content that should be used for replacement) */
	index: number;
	/** Length of the matched text */
	matchLength: number;
	/** Whether fuzzy matching was used (false = exact match) */
	usedFuzzyMatch: boolean;
	/**
	 * The content to use for replacement operations.
	 * When exact match: original content. When fuzzy match: normalized content.
	 */
	contentForReplacement: string;
}

/**
 * Find oldText in content, trying exact match first, then fuzzy match.
 * When fuzzy matching is used, the returned contentForReplacement is the
 * fuzzy-normalized version of the content (trailing whitespace stripped,
 * Unicode quotes/dashes normalized to ASCII).
 */
export function fuzzyFindText(content: string, oldText: string): FuzzyMatchResult {
	// Try exact match first
	const exactIndex = content.indexOf(oldText);
	if (exactIndex !== -1) {
		return {
			found: true,
			index: exactIndex,
			matchLength: oldText.length,
			usedFuzzyMatch: false,
			contentForReplacement: content,
		};
	}

	// Try fuzzy match - work entirely in normalized space
	const fuzzyContent = normalizeForFuzzyMatch(content);
	const fuzzyOldText = normalizeForFuzzyMatch(oldText);
	const fuzzyIndex = fuzzyContent.indexOf(fuzzyOldText);

	if (fuzzyIndex === -1) {
		return {
			found: false,
			index: -1,
			matchLength: 0,
			usedFuzzyMatch: false,
			contentForReplacement: content,
		};
	}

	// When fuzzy matching, we work in the normalized space for replacement.
	// This means the output will have normalized whitespace/quotes/dashes,
	// which is acceptable since we're fixing minor formatting differences anyway.
	return {
		found: true,
		index: fuzzyIndex,
		matchLength: fuzzyOldText.length,
		usedFuzzyMatch: true,
		contentForReplacement: fuzzyContent,
	};
}

/**
 * Strip UTF-8 BOM (U+FEFF) if present, return both the BOM (if any) and the text without it.
 * Only handles UTF-8 BOM — UTF-16 LE/BE BOMs are not handled since files are read as UTF-8.
 */
export function stripBom(content: string): { bom: string; text: string } {
	return content.startsWith("\uFEFF") ? { bom: "\uFEFF", text: content.slice(1) } : { bom: "", text: content };
}

/**
 * Generate a unified diff string with line numbers and context.
 * Returns both the diff string and the first changed line number (in the new file).
 */
export function generateDiffString(
	oldContent: string,
	newContent: string,
	contextLines = 4,
): { diff: string; firstChangedLine: number | undefined } {
	const parts = Diff.diffLines(oldContent, newContent);
	const output: string[] = [];

	const oldLines = oldContent.split("\n");
	const newLines = newContent.split("\n");
	const maxLineNum = Math.max(oldLines.length, newLines.length);
	const lineNumWidth = String(maxLineNum).length;

	let oldLineNum = 1;
	let newLineNum = 1;
	let lastWasChange = false;
	let firstChangedLine: number | undefined;

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		const raw = part.value.split("\n");
		if (raw[raw.length - 1] === "") {
			raw.pop();
		}

		if (part.added || part.removed) {
			// Capture the first changed line (in the new file)
			if (firstChangedLine === undefined) {
				firstChangedLine = newLineNum;
			}

			// Show the change
			for (const line of raw) {
				if (part.added) {
					const lineNum = String(newLineNum).padStart(lineNumWidth, " ");
					output.push(`+${lineNum} ${line}`);
					newLineNum++;
				} else {
					// removed
					const lineNum = String(oldLineNum).padStart(lineNumWidth, " ");
					output.push(`-${lineNum} ${line}`);
					oldLineNum++;
				}
			}
			lastWasChange = true;
		} else {
			// Context lines - only show a few before/after changes
			const nextPartIsChange = i < parts.length - 1 && (parts[i + 1].added || parts[i + 1].removed);

			if (lastWasChange || nextPartIsChange) {
				// Show context
				let linesToShow = raw;
				let skipStart = 0;
				let skipEnd = 0;

				if (!lastWasChange) {
					// Show only last N lines as leading context
					skipStart = Math.max(0, raw.length - contextLines);
					linesToShow = raw.slice(skipStart);
				}

				if (!nextPartIsChange && linesToShow.length > contextLines) {
					// Show only first N lines as trailing context
					skipEnd = linesToShow.length - contextLines;
					linesToShow = linesToShow.slice(0, contextLines);
				}

				// Add ellipsis if we skipped lines at start
				if (skipStart > 0) {
					output.push(` ${"".padStart(lineNumWidth, " ")} ...`);
					// Update line numbers for the skipped leading context
					oldLineNum += skipStart;
					newLineNum += skipStart;
				}

				for (const line of linesToShow) {
					const lineNum = String(oldLineNum).padStart(lineNumWidth, " ");
					output.push(` ${lineNum} ${line}`);
					oldLineNum++;
					newLineNum++;
				}

				// Add ellipsis if we skipped lines at end
				if (skipEnd > 0) {
					output.push(` ${"".padStart(lineNumWidth, " ")} ...`);
					// Update line numbers for the skipped trailing context
					oldLineNum += skipEnd;
					newLineNum += skipEnd;
				}
			} else {
				// Skip these context lines entirely
				oldLineNum += raw.length;
				newLineNum += raw.length;
			}

			lastWasChange = false;
		}
	}

	return { diff: output.join("\n"), firstChangedLine };
}

import { Type, type TSchema } from "typebox";
import type { FileWritePolicy } from "./path-utils.js";
import type { AgentTool } from "@earendil-works/pi-agent-core";


import { constants } from "fs";
import { access as fsAccess, readFile as fsReadFile, writeFile as fsWriteFile } from "fs/promises";
import { resolveToCwd } from "./path-utils.js";
import { checkCrossEditGuard } from "./path-utils.js";
import { withAbortSignal } from "./path-utils.js";

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
	/** Captured trusted installation scope; never read from task text. */
	fileWritePolicy?: FileWritePolicy;
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
			const guard = checkCrossEditGuard(absolutePath, agentName, projectRoot, options?.fileWritePolicy);
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
