import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type, type TSchema } from "typebox";
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

import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  formatSize,
  truncateHead,

  type TruncationResult,
} from "@earendil-works/pi-coding-agent";


import { constants } from "fs";
import { existsSync, realpathSync } from "node:fs";
import { access as fsAccess, readFile as fsReadFile } from "fs/promises";
import { resolve } from "node:path";
import { resolveReadPath } from "./path-utils.js";
import { withAbortSignal } from "./path-utils.js";

const readSchema: TSchema = Type.Object({
  path: Type.String({
    description:
      "Path to the file to read (relative or absolute). Use bash with grep/rg to search across files instead of reading them one by one.",
  }),
  offset: Type.Optional(
    Type.Number({
      description:
        "Line number to start reading from (1-indexed). Use this to continue reading after a truncated response — the truncation message tells you the next offset.",
    }),
  ),
  limit: Type.Optional(
    Type.Number({
      description:
        "Maximum number of lines to read. Use this with offset to read a specific range. If omitted, reads from offset to end of file (subject to truncation).",
    }),
  ),
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
}

const defaultReadOperations: ReadOperations = {
  readFile: (path) => fsReadFile(path),
  access: (path) => fsAccess(path, constants.R_OK),
};

export interface ReadToolOptions {
  operations?: ReadOperations;
  /** Optional captured file contents keyed by resolved/canonical path. */
  pinnedFiles?: ReadonlyMap<string, string>;
}

function lookupPinnedFile(pinnedFiles: ReadonlyMap<string, string> | undefined, absolutePath: string): string | undefined {
  if (!pinnedFiles || pinnedFiles.size === 0) return undefined;
  const resolved = resolve(absolutePath);
  const direct = pinnedFiles.get(resolved);
  if (direct !== undefined) return direct;
  if (existsSync(resolved)) {
    try {
      const canonical = realpathSync(resolved);
      return pinnedFiles.get(canonical);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

const BUILTIN_READ_PIN_FACTORY = Symbol("may.builtinReadPinFactory");

type PinnedReadCapableTool = AgentTool<TSchema> & {
  [BUILTIN_READ_PIN_FACTORY]?: (pinnedFiles: ReadonlyMap<string, string>) => AgentTool<TSchema>;
};

export function createReadTool(cwd: string, options?: ReadToolOptions): AgentTool<TSchema> {
  const baseOps = options?.operations ?? defaultReadOperations;
  const pinnedFiles = options?.pinnedFiles;
  const ops: ReadOperations = pinnedFiles
    ? {
        access: async (absolutePath) => {
          if (lookupPinnedFile(pinnedFiles, absolutePath) !== undefined) return;
          return baseOps.access(absolutePath);
        },
        readFile: async (absolutePath) => {
          const pinned = lookupPinnedFile(pinnedFiles, absolutePath);
          if (pinned !== undefined) return Buffer.from(pinned, "utf-8");
          return baseOps.readFile(absolutePath);
        },
      }
    : baseOps;

  const tool: PinnedReadCapableTool = {
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

        const buffer = await ops.readFile(absolutePath);
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
  Object.defineProperty(tool, BUILTIN_READ_PIN_FACTORY, {
    value: (nextPinned: ReadonlyMap<string, string>) => createReadTool(cwd, { ...options, pinnedFiles: nextPinned }),
    enumerable: false,
  });
  return tool;
}

export function withPinnedReadFiles(
  tool: AgentTool,
  cwd: string,
  pinnedFiles: ReadonlyMap<string, string>,
): AgentTool {
  if (pinnedFiles.size === 0) return tool;
  const factory = (tool as PinnedReadCapableTool)[BUILTIN_READ_PIN_FACTORY];
  if (factory) return factory(pinnedFiles);
  const pinnedReadTool = createReadTool(cwd, { pinnedFiles });
  return {
    ...tool,
    execute: async (toolCallId, params, signal, onUpdate) => {
      const customResult = await tool.execute(toolCallId, params, signal, onUpdate);
      if (
        (customResult as { isError?: boolean }).isError ||
        !params ||
        typeof params !== "object" ||
        typeof (params as { path?: unknown }).path !== "string"
      ) {
        return customResult;
      }
      const absolutePath = resolveReadPath((params as { path: string }).path, cwd);
      if (lookupPinnedFile(pinnedFiles, absolutePath) !== undefined) {
        return pinnedReadTool.execute(toolCallId, params, signal, onUpdate);
      }
      return customResult;
    },
  };
}
