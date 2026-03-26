/**
 * Binary Guard — beforeToolCall hook.
 *
 * Blocks read() and edit() calls targeting binary files. Agents (especially
 * in the behavior-escalation-stubborn scenario) spin repeatedly trying to
 * cat/edit binary files. This guard detects binary files by extension and
 * by checking for null bytes in the first 512 bytes.
 *
 * Source: design-harness-guards.md (Bob brief, req:0eef8ef9).
 */

import { existsSync, openSync, readSync, closeSync } from "node:fs";
import type { BeforeToolCallContext, BeforeToolCallResult } from "../tools/compose-guards.js";

/** File extensions that are almost always binary. */
const BINARY_EXTENSIONS = new Set([
  ".bin", ".exe", ".so", ".dll", ".dylib",
  ".pyc", ".pyo", ".class",
  ".o", ".a", ".obj", ".lib",
  ".zip", ".gz", ".tar", ".bz2", ".xz", ".7z", ".rar",
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".svg",
  ".mp3", ".mp4", ".wav", ".avi", ".mov", ".mkv", ".flac",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
  ".wasm", ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".sqlite", ".db",
]);

/**
 * Check if a file path has a known binary extension.
 */
function hasBinaryExtension(filePath: string): boolean {
  const dotIdx = filePath.lastIndexOf(".");
  if (dotIdx < 0) return false;
  return BINARY_EXTENSIONS.has(filePath.slice(dotIdx).toLowerCase());
}

/**
 * Check if a file's contents appear binary by looking for null bytes
 * in the first 512 bytes. Returns true if null bytes are found.
 * Returns false if the file doesn't exist or can't be read.
 */
function hasBinaryContent(filePath: string): boolean {
  try {
    if (!existsSync(filePath)) return false;
    const buf = Buffer.alloc(512);
    const fd = openSync(filePath, "r");
    try {
      const bytesRead = readSync(fd, buf, 0, 512, 0);
      for (let i = 0; i < bytesRead; i++) {
        if (buf[i] === 0) return true;
      }
    } finally {
      closeSync(fd);
    }
  } catch {
    // Can't read file — don't block
  }
  return false;
}

/**
 * Create a beforeToolCall hook that blocks read/edit on binary files.
 */
export function createBinaryGuard(): (
  context: BeforeToolCallContext,
  signal?: AbortSignal,
) => Promise<BeforeToolCallResult | undefined> {
  return async (ctx: BeforeToolCallContext): Promise<BeforeToolCallResult | undefined> => {
    const toolName = ctx.toolCall.name;

    // Only guard read and edit
    if (toolName !== "read" && toolName !== "edit") return undefined;

    const filePath = ctx.args?.path;
    if (typeof filePath !== "string" || filePath.length === 0) return undefined;

    const isBinary = hasBinaryExtension(filePath) || hasBinaryContent(filePath);
    if (!isBinary) return undefined;

    return {
      block: true,
      reason:
        `🚫 BINARY_FILE: ${toolName}() blocked — file '${filePath}' appears to be binary. ` +
        `You cannot read or edit binary files directly.\n` +
        `Instead, use: ls -l ${filePath} (size/permissions), ` +
        `bash({ command: "file ${filePath}" }) (type detection), ` +
        `or bash({ command: "hexdump -C ${filePath} | head" }) if you need to inspect bytes.`,
    };
  };
}
