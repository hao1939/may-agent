/**
 * Project structure tree builder — may-agent-specific.
 */

import { readdirSync, statSync } from "node:fs";
import { join, basename } from "node:path";

const IGNORE = new Set([
  "node_modules", ".git", ".state", "dist", ".next", "__pycache__",
  ".cache", ".turbo", "coverage", ".nyc_output", ".DS_Store",
]);

export function buildProjectStructure(rootDir: string, maxDepth: number = 2): string | null {
  function walk(dir: string, prefix: string, depth: number): string[] {
    if (depth > maxDepth) return [];
    let entries: string[];
    try {
      entries = readdirSync(dir).sort();
    } catch {
      return [];
    }
    entries = entries.filter(e => !IGNORE.has(e));
    const lines: string[] = [];
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const fullPath = join(dir, entry);
      const isLast = i === entries.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const childPrefix = isLast ? "    " : "│   ";
      let isDir = false;
      try { isDir = statSync(fullPath).isDirectory(); } catch { continue; }
      lines.push(prefix + connector + entry + (isDir ? "/" : ""));
      if (isDir) {
        lines.push(...walk(fullPath, prefix + childPrefix, depth + 1));
      }
    }
    return lines;
  }

  try {
    const lines = [basename(rootDir) + "/", ...walk(rootDir, "", 1)];
    return lines.join("\n");
  } catch {
    return null;
  }
}
