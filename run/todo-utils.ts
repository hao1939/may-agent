/**
 * Shared utility for appending items to a # TODO section in markdown files.
 * Used by reactive triggers in evaluate-sessions and system-status handlers.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Append an item to the # TODO section of a markdown file.
 * Creates the file with a # TODO header if it doesn't exist.
 * If the file exists but has no # TODO section, prepends one.
 */
export function appendToTodoSection(todoPath: string, item: string): void {
  mkdirSync(dirname(todoPath), { recursive: true });

  if (!existsSync(todoPath)) {
    writeFileSync(todoPath, `# TODO\n\n${item}\n`);
    return;
  }

  let content = readFileSync(todoPath, "utf-8");
  const todoIdx = content.indexOf("# TODO");
  if (todoIdx === -1) {
    // No TODO section — prepend one
    content = `# TODO\n\n${item}\n\n${content}`;
  } else {
    // Find end of "# TODO" line, insert item after it
    const lineEnd = content.indexOf("\n", todoIdx);
    const insertAt = lineEnd === -1 ? content.length : lineEnd + 1;
    content = content.slice(0, insertAt) + "\n" + item + content.slice(insertAt);
  }
  writeFileSync(todoPath, content);
}
