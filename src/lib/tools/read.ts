/**
 * Read tool — adapted from pi-coding-agent.
 *
 * Differences from upstream:
 * - No image support (may-agent doesn't need it)
 * - Kept as a separate maintained file (not auto-synced)
 *
 * Features preserved:
 * - offset/limit pagination with actionable hints
 * - Head truncation (2000 lines / 50KB)
 * - Pluggable ReadOperations interface
 * - Abort signal support
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@mariozechner/pi-ai";
import type { TSchema } from "@mariozechner/pi-ai";
import { constants } from "fs";
import { access as fsAccess, readFile as fsReadFile, stat as fsStat } from "fs/promises";
import { resolveReadPath } from "./path-utils.js";
import { DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES, formatSize, type TruncationResult, truncateHead } from "./truncate.js";
import { withAbortSignal } from "./abort-utils.js";

const readSchema: TSchema = Type.Object({
  path: Type.String({ description: "Path to the file to read (relative or absolute). Use bash with grep/rg to search across files instead of reading them one by one." }),
  offset: Type.Optional(Type.Number({ description: "Line number to start reading from (1-indexed). Use this to continue reading after a truncated response — the truncation message tells you the next offset." })),
  limit: Type.Optional(Type.Number({ description: "Maximum number of lines to read. Use this with offset to read a specific range. If omitted, reads from offset to end of file (subject to truncation)." })),
});

export interface ReadToolInput {
  path: string;
  offset?: number;
  limit?: number;
}

export interface ReadToolDetails {
  truncation?: TruncationResult;
}

export interface ReadOperations {
  readFile: (absolutePath: string) => Promise<Buffer>;
  access: (absolutePath: string) => Promise<void>;
  stat: (absolutePath: string) => Promise<{ size: number; isDirectory: () => boolean }>;
}

const defaultReadOperations: ReadOperations = {
  readFile: (path) => fsReadFile(path),
  access: (path) => fsAccess(path, constants.R_OK),
  stat: (path) => fsStat(path),
};

export interface ReadToolOptions {
  operations?: ReadOperations;
}

export function createReadTool(cwd: string, options?: ReadToolOptions): AgentTool<TSchema> {
  const ops = options?.operations ?? defaultReadOperations;

  return {
    name: "read",
    label: "read",
    description: [
      `Read the contents of a file. Supports text files.`,
      `Output is truncated to ${DEFAULT_MAX_LINES} lines or ${DEFAULT_MAX_BYTES / 1024}KB (whichever is hit first).`,
      `For large files, use offset/limit to paginate — the response tells you the next offset.`,
      `When you need the full file, call repeatedly with increasing offset until no "[N more lines]" hint appears.`,
      `To search within files, prefer bash with grep/rg instead of reading the entire file.`,
    ].join(" "),
    parameters: readSchema,
    execute: async (_toolCallId: string, _params: unknown, signal?: AbortSignal) => {
      const { path, offset, limit } = _params as ReadToolInput;
      const absolutePath = resolveReadPath(path, cwd);

      return withAbortSignal(signal, async (isAborted) => {
        await ops.access(absolutePath);
        if (isAborted()) return { content: [{ type: "text" as const, text: "" }], details: undefined };

        // Safety guards (FM-2.1 / FM-3.1)
        const fileStat = await ops.stat(absolutePath);

        // Guard 1: Directory block
        if (fileStat.isDirectory()) {
          throw new Error("Path is a directory. Use 'bash ls -F' to list contents.");
        }

        // Guard 2: Size cap — block full reads of files > 50KB unless limit is provided
        const SIZE_CAP = 50 * 1024; // 50KB
        if (fileStat.size > SIZE_CAP && limit === undefined) {
          throw new Error(
            `File is too large (${formatSize(fileStat.size)}). Use 'read' with 'offset' and 'limit' to read in chunks, or 'bash' with grep to search.`
          );
        }

        const buffer = await ops.readFile(absolutePath);

        // Guard 3: Binary file detection
        const checkBytes = buffer.subarray(0, 512);
        if (checkBytes.includes(0)) {
          throw new Error("File appears to be binary. Cannot read text content.");
        }

        const textContent = buffer.toString("utf-8");
        const allLines = textContent.split("\n");
        const totalFileLines = allLines.length;

        const startLine = offset ? Math.max(0, offset - 1) : 0;
        const startLineDisplay = startLine + 1;

        if (startLine >= allLines.length) {
          throw new Error(`Offset ${offset} is beyond end of file (${allLines.length} lines total)`);
        }

        let selectedContent: string;
        let userLimitedLines: number | undefined;
        if (limit !== undefined) {
          const endLine = Math.min(startLine + limit, allLines.length);
          selectedContent = allLines.slice(startLine, endLine).join("\n");
          userLimitedLines = endLine - startLine;
        } else {
          selectedContent = allLines.slice(startLine).join("\n");
        }

        const truncation = truncateHead(selectedContent);
        let outputText: string;
        let details: ReadToolDetails | undefined;

        if (truncation.firstLineExceedsLimit) {
          const firstLineSize = formatSize(Buffer.byteLength(allLines[startLine], "utf-8"));
          outputText = `[Line ${startLineDisplay} is ${firstLineSize}, exceeds ${formatSize(DEFAULT_MAX_BYTES)} limit. Use bash: sed -n '${startLineDisplay}p' ${path} | head -c ${DEFAULT_MAX_BYTES}]`;
          details = { truncation };
        } else if (truncation.truncated) {
          const endLineDisplay = startLineDisplay + truncation.outputLines - 1;
          const nextOffset = endLineDisplay + 1;
          outputText = truncation.content;

          if (truncation.truncatedBy === "lines") {
            outputText += `\n\n[Showing lines ${startLineDisplay}-${endLineDisplay} of ${totalFileLines}. Use offset=${nextOffset} to continue.]`;
          } else {
            outputText += `\n\n[Showing lines ${startLineDisplay}-${endLineDisplay} of ${totalFileLines} (${formatSize(DEFAULT_MAX_BYTES)} limit). Use offset=${nextOffset} to continue.]`;
          }
          details = { truncation };
        } else if (userLimitedLines !== undefined && startLine + userLimitedLines < allLines.length) {
          const remaining = allLines.length - (startLine + userLimitedLines);
          const nextOffset = startLine + userLimitedLines + 1;
          outputText = truncation.content;
          outputText += `\n\n[${remaining} more lines in file. Use offset=${nextOffset} to continue.]`;
        } else {
          outputText = truncation.content;
        }

        if (isAborted()) return { content: [{ type: "text" as const, text: "" }], details: undefined };

        return { content: [{ type: "text" as const, text: outputText }], details };
      });
    },
  };
}

export const readTool = createReadTool(process.cwd());
