/**
 * Shared workflow utilities — file extraction from TaskResult messages.
 *
 * Extracted from verify-wrap.ts to be reusable by guards and other workflows.
 * Guards use these to inspect step results for file changes.
 */
import type { TaskResult } from "./types.js";

/**
 * Extract file paths that were written/edited during a session.
 * Reads write()/edit() tool calls from assistant messages, plus
 * "Wrote N bytes to <path>" from tool results.
 */
export function extractWrittenFiles(result: TaskResult): string[] {
  const messages = result.messages ?? [];
  const paths = new Set<string>();

  for (const msg of messages) {
    if (!Array.isArray(msg.content)) continue;

    // Tool call blocks on assistant messages
    if (msg.role === "assistant") {
      for (const block of msg.content) {
        if (
          block.type === "toolCall" &&
          (block.name === "write" || block.name === "edit")
        ) {
          const p = block.arguments?.path;
          if (typeof p === "string" && p.length > 0) paths.add(p);
        }
      }
    }

    // Tool result blocks: "Wrote N bytes to <path>"
    if (msg.role === "toolResult") {
      for (const block of msg.content ?? []) {
        if (block.type === "text" && typeof block.text === "string") {
          const writeMatch = block.text.match(/Wrote \d+ bytes to ([^\s(]+)/);
          if (writeMatch) paths.add(writeMatch[1]);
          const editMatch = block.text.match(/Edit applied to ([^\s(]+)/);
          if (editMatch) paths.add(editMatch[1]);
        }
      }
    }

    // Compacted context: "Files written: path1, path2"
    if (msg.role === "user") {
      for (const block of msg.content) {
        if (block.type === "text" && typeof block.text === "string") {
          for (const label of ["Files written:", "Files edited:"]) {
            const match = block.text.match(new RegExp(`${label}\\s*(.+)`));
            if (match) {
              for (const p of match[1].split(",").map((s: string) => s.trim())) {
                if (p.length > 0) paths.add(p);
              }
            }
          }
        }
      }
    }
  }

  return [...paths];
}

/**
 * Extract changed source files (both written and edited).
 * Same as extractWrittenFiles but also picks up bash commands that
 * modify files (mv, cp, etc.) and finish() deliverables.
 */
export function extractChangedFiles(result: TaskResult): string[] {
  const files = new Set(extractWrittenFiles(result));

  // Also extract from finish() deliverables if available
  const finishResult = (result as any).finishResult;
  if (finishResult?.deliverables) {
    for (const d of finishResult.deliverables) {
      if (typeof d.path === "string" && d.path.length > 0) {
        files.add(d.path);
      }
    }
  }

  return [...files];
}
