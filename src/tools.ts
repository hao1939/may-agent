import { Type } from "@mariozechner/pi-ai";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, resolve, join, isAbsolute, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";

const DEFS_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "workflow-defs.d.ts");

function textResult(text: string): AgentToolResult<string> {
  return {
    content: [{ type: "text", text }],
    details: text,
  };
}

const ReadParams = Type.Object({
  path: Type.String({ description: "Absolute path to the file" }),
  startLine: Type.Optional(Type.Number({ description: "First line to return (1-based, inclusive). Use with endLine to read a specific range without truncation." })),
  endLine: Type.Optional(Type.Number({ description: "Last line to return (1-based, inclusive). Use with startLine to read a specific range without truncation." })),
});

const WriteParams = Type.Object({
  path: Type.String({ description: "Absolute path to the file" }),
  content: Type.String({ description: "Content to write" }),
});

const ExecParams = Type.Object({
  command: Type.String({ description: "Shell command to execute" }),
  timeout: Type.Optional(Type.Number({ description: "Timeout in seconds (default: 30)" })),
});

/** Options for the read tool. */
export interface ReadToolOptions {
  /** If set, ENOENT errors include a hint showing this path as the project root. */
  projectRoot?: string;
  /**
   * Maximum character length for file content returned by the read tool.
   * When a file exceeds this limit, the middle is replaced with a truncation
   * warning showing how many characters were omitted.
   *
   * This prevents large files from consuming excessive context tokens and
   * reduces the risk of agents fabricating information about content they
   * never saw (the #2 evaluation issue pattern).
   *
   * Default: 0 (no truncation). Set to a positive number to enable.
   */
  maxFileLength?: number;
  /**
   * Shared truncation tracker. When a file is truncated during read, the
   * tracker records the original file size. The write tool can then warn
   * when the agent writes back significantly shorter content — a strong
   * signal of data loss from write-after-truncated-read.
   *
   * Created automatically by `createLinkedTools()`, or provide your own
   * `TruncationTracker` instance to share between independently-created
   * read and write tools.
   */
  truncationTracker?: TruncationTracker;
}

/** Options for the write tool. */
export interface WriteToolOptions {
  /**
   * If set, the write tool resolves paths the same way the read tool does:
   * - Relative paths (e.g., "src/foo.ts") → resolved against projectRoot
   * - Hallucinated paths (e.g., "/home/user/repo/src/foo.ts") → rewritten to projectRoot
   * - Correct absolute paths → used as-is
   *
   * Also adds a hint to error messages showing the project root.
   */
  projectRoot?: string;
  /**
   * Shared truncation tracker. When the agent writes to a file that was
   * previously read with truncation, and the new content is significantly
   * shorter than the original, a warning is appended to the write result.
   *
   * This catches the "write-after-truncated-read" anti-pattern where agents
   * read a large file (truncated), then write it back with fabricated or
   * missing content from the truncated section.
   */
  truncationTracker?: TruncationTracker;
}

// ── Truncation Tracker ─────────────────────────────────────────────────

/**
 * Tracks files that were read with truncation, enabling the write tool
 * to warn about potential data loss.
 *
 * When the read tool truncates a file (because it exceeds maxFileLength),
 * it records the path and original size. When the write tool later writes
 * to that same file, it can compare the new content length to the original
 * and warn if significant content may have been lost.
 *
 * This is a simple Map wrapper for clarity and testability.
 */
export class TruncationTracker {
  /** Maps resolved absolute path → original file size in characters */
  private readonly truncatedReads = new Map<string, number>();

  /**
   * Tracks how many times each file has been fully read (non-line-range).
   * Used to detect redundant full-file reads where the agent re-reads
   * a file it already has in context — wasting tokens and turns.
   */
  private readonly fullReadCounts = new Map<string, number>();

  /** Record that a file was read and its content was truncated. */
  recordTruncatedRead(path: string, originalLength: number): void {
    this.truncatedReads.set(path, originalLength);
  }

  /** Clear the record for a path (e.g., after a successful non-truncated read). */
  clearPath(path: string): void {
    this.truncatedReads.delete(path);
  }

  /**
   * Check if writing to this path risks data loss from a prior truncated read.
   *
   * Returns a warning string if:
   * 1. The file was previously read with truncation
   * 2. The new content is significantly shorter than the original
   *
   * The threshold is 80%: if the new content is less than 80% of the original
   * size, it's likely the agent is writing back incomplete content.
   *
   * Returns null if no warning is needed.
   */
  checkWrite(path: string, newContentLength: number): string | null {
    const originalLength = this.truncatedReads.get(path);
    if (originalLength === undefined) return null;

    // If new content is at least 80% of original, it's probably fine
    // (the agent may have legitimately shortened the file)
    const ratio = newContentLength / originalLength;
    if (ratio >= 0.8) return null;

    const pctKept = Math.round(ratio * 100);
    const charsLost = originalLength - newContentLength;
    return (
      `\n⚠️ WARNING: This file was previously read with truncation (original: ${originalLength.toLocaleString()} chars, ` +
      `you saw a truncated version). Your write contains only ${newContentLength.toLocaleString()} chars (${pctKept}% of original, ` +
      `${charsLost.toLocaleString()} chars lost). ` +
      `This may indicate data loss from the truncated section you didn't see. ` +
      `Consider reading specific line ranges with read(path, startLine, endLine) and using exec with sed for targeted edits.`
    );
  }

  /** Get the number of tracked files (for testing). */
  get size(): number {
    return this.truncatedReads.size;
  }

  /** Check if a path is being tracked (for testing). */
  has(path: string): boolean {
    return this.truncatedReads.has(path);
  }

  /** Get original length for a path (for testing). */
  getOriginalLength(path: string): number | undefined {
    return this.truncatedReads.get(path);
  }

  /**
   * Record a full-file read (not a line-range read).
   * Returns the new read count for this path.
   */
  recordFullRead(path: string): number {
    const count = (this.fullReadCounts.get(path) ?? 0) + 1;
    this.fullReadCounts.set(path, count);
    return count;
  }

  /**
   * Build a warning for repeated full-file reads.
   *
   * When an agent reads the same file multiple times without using
   * line-range reads, it wastes context tokens on duplicate content.
   * This nudges the agent toward targeted reads.
   *
   * @param path - The file path
   * @param readCount - How many times this file has been fully read
   * @param totalLines - Total lines in the file
   * @returns A warning string to prepend, or empty string on first read
   */
  buildRepeatedReadWarning(path: string, readCount: number, totalLines: number): string {
    if (readCount <= 1) return "";
    return (
      `\n⚠️ REPEATED READ (${readCount}x): You have already read this file in full. ` +
      `To save context tokens, use line-range reads: read(path, startLine=N, endLine=M) ` +
      `to view only the section you need (this file has ${totalLines} lines). ` +
      `For edits, use exec with sed instead of read+write.\n\n`
    );
  }

  /** Get full-read count for a path (for testing). */
  getFullReadCount(path: string): number {
    return this.fullReadCounts.get(path) ?? 0;
  }

  /** Reset full-read tracking for a path (e.g., after write). */
  resetFullReadCount(path: string): void {
    this.fullReadCounts.delete(path);
  }
}

/**
 * Patterns that match hallucinated project root paths.
 *
 * Agents frequently hallucinate paths like:
 * - /home/user, /home/user/repo, /home/user/repos/my-project
 * - /Users/jdoe/amp-agent, /Users/someone/project
 * - /app (Docker-style)
 *
 * Each pattern captures: (hallucinated_root)(relative_path)
 * Group 1 = the fake root, Group 2 = the relative path to preserve.
 *
 * The patterns are ordered from most specific to least specific
 * so that longer matches win (e.g., /home/user/repo/ before /home/user/).
 */
const HALLUCINATED_PATH_PATTERNS: RegExp[] = [
  // /home/user/repos/<project-name>/... → keep path after project-name
  /^(\/home\/user\/repos\/[^/]+)(\/.*)?$/,
  // /home/user/repo/... → keep path after repo
  /^(\/home\/user\/repo)(\/.*)?$/,
  // /home/user/... → keep path after user
  /^(\/home\/user)(\/.*)?$/,
  // /Users/<name>/<project>/... → keep path after project
  /^(\/Users\/[^/]+\/[^/]+)(\/.*)?$/,
  // /app/... → keep path after app
  /^(\/app)(\/.*)?$/,
];

/**
 * Extract the relative path from a hallucinated absolute path.
 *
 * When an agent hallucinates a project root (e.g., /home/user/repo),
 * this function extracts the relative path portion that can be rebased
 * onto the actual project root.
 *
 * @returns The relative path (e.g., "/src/tools.ts") or null if not a hallucinated path.
 */
export function extractHallucinatedRelPath(path: string): string | null {
  for (const pattern of HALLUCINATED_PATH_PATTERNS) {
    const match = path.match(pattern);
    if (match) {
      // Return the relative portion, or empty string if it's just the root
      return match[2] ?? "";
    }
  }
  return null;
}

/**
 * Rewrite a hallucinated absolute path to point to the actual project root.
 *
 * Agents commonly hallucinate paths like /home/user/repo/src/tools.ts
 * when the actual path is /home/example-user/may-agent/src/tools.ts. This function
 * detects the hallucinated root and rebases the relative path onto the
 * actual project root.
 *
 * Only rewrites when:
 * 1. The path matches a known hallucination pattern
 * 2. The hallucinated root is NOT the actual root (no false rewrites)
 *
 * @param path - The path to check
 * @param projectRoot - The actual project root
 * @returns The rewritten path, or the original path if no rewrite needed
 */
export function rewriteHallucinatedPath(path: string, projectRoot: string): string {
  const relPath = extractHallucinatedRelPath(path);
  if (relPath === null) return path;

  // Don't rewrite if the path already starts with the actual project root
  if (path === projectRoot || path.startsWith(projectRoot + "/")) return path;

  return projectRoot + relPath;
}

/**
 * Rewrite hallucinated paths in a shell command string.
 *
 * Scans for absolute paths in the command that match hallucination patterns
 * and rewrites them to point to the actual project root.
 *
 * Handles paths appearing in various positions:
 * - As standalone arguments: find /home/user/src -name foo
 * - After cd: cd /home/user && ls
 * - After flags: --root=/home/user/src
 * - In quotes: grep "pattern" "/home/user/file.ts"
 */
export function rewriteHallucinatedCommand(command: string, projectRoot: string): string {
  // Match absolute paths that could be hallucinated.
  // We look for paths starting with /home/user, /Users/<name>, or /app
  // in various command contexts.
  return command.replace(
    /(\/(?:home\/user(?:\/repos?\/[^/\s'"]+)?|Users\/[^/\s'"]+\/[^/\s'"]+|app))(\/?[^)\s'"]*)/g,
    (_match, root: string, relPath: string) => {
      const fullPath = root + relPath;
      // Don't rewrite if it's already the correct root
      if (fullPath === projectRoot || fullPath.startsWith(projectRoot + "/")) return fullPath;
      return projectRoot + relPath;
    },
  );
}

/**
 * Resolve a tool path to an absolute path.
 *
 * Handles three cases:
 * 1. Relative paths (e.g., "src/tools.ts") → resolved against projectRoot
 * 2. Hallucinated absolute paths (e.g., "/home/user/repo/src/tools.ts") → rewritten to projectRoot
 * 3. Correct absolute paths → returned as-is
 *
 * This eliminates the most common failure pattern in evaluations: agents
 * getting an ENOENT error, seeing the hint "use paths like src/manager.ts",
 * then getting another ENOENT because the tool didn't resolve relative paths.
 *
 * Used by both the read and write tools.
 *
 * @param path - The path from the agent (relative or absolute)
 * @param projectRoot - The project root to resolve against
 * @returns An absolute path ready for readFileSync/writeFileSync
 */
export function resolveReadPath(path: string, projectRoot: string): string {
  // 1. Relative paths: resolve against projectRoot
  if (!isAbsolute(path)) {
    return resolve(projectRoot, path);
  }

  // 2. Hallucinated absolute paths: rewrite to projectRoot
  return rewriteHallucinatedPath(path, projectRoot);
}

/**
 * Resolve a write tool path to an absolute path.
 *
 * Identical logic to resolveReadPath — resolves relative paths against
 * projectRoot and rewrites hallucinated absolute paths.
 *
 * Exported separately so callers can use the semantically correct name,
 * but delegates to the same implementation.
 *
 * @param path - The path from the agent (relative or absolute)
 * @param projectRoot - The project root to resolve against
 * @returns An absolute path ready for writeFileSync
 */
export function resolveWritePath(path: string, projectRoot: string): string {
  return resolveReadPath(path, projectRoot);
}

/**
 * Build a helpful ENOENT error hint that includes directory listings.
 *
 * When a file is not found, agents waste calls guessing what exists.
 * This function builds a hint that includes:
 * 1. The project root path
 * 2. What files/dirs exist in the parent directory of the missing file
 * 3. If the parent doesn't exist either, the top-level project structure
 *
 * This eliminates the need for follow-up `ls` or `find` commands.
 *
 * @param effectivePath - The resolved absolute path that was not found
 * @param projectRoot - The project root directory
 * @returns A multi-line hint string
 */
export function buildEnoentHint(effectivePath: string, projectRoot: string): string {
  const lines: string[] = [];
  lines.push(`Project root: ${projectRoot}`);

  // Show the path relative to project root for clarity
  if (effectivePath.startsWith(projectRoot + "/")) {
    const relPath = relative(projectRoot, effectivePath);
    lines.push(`Requested (relative): ${relPath}`);
  }

  // Try to list the parent directory of the missing file
  const parentDir = dirname(effectivePath);
  let parentListed = false;

  if (existsSync(parentDir)) {
    try {
      const entries = listDirEntries(parentDir);
      if (entries.length > 0) {
        const parentLabel = parentDir.startsWith(projectRoot + "/")
          ? relative(projectRoot, parentDir) + "/"
          : parentDir === projectRoot
            ? "(project root)"
            : parentDir + "/";
        lines.push(`Directory ${parentLabel} contains: ${entries.join(", ")}`);
        parentListed = true;
      }
    } catch { /* permission error, etc. — fall through */ }
  } else {
    // Parent dir doesn't exist — tell the agent
    const parentLabel = parentDir.startsWith(projectRoot + "/")
      ? relative(projectRoot, parentDir) + "/"
      : parentDir + "/";
    lines.push(`Directory ${parentLabel} does not exist.`);
  }

  // If we couldn't list the parent (or parent is outside project root),
  // show the top-level project structure
  if (!parentListed || !parentDir.startsWith(projectRoot)) {
    try {
      const topEntries = listDirEntries(projectRoot);
      if (topEntries.length > 0) {
        lines.push(`Top-level entries: ${topEntries.join(", ")}`);
      }
    } catch { /* ignore */ }
  }

  return "\n" + lines.join("\n");
}

/**
 * List directory entries as "name" or "name/" (for directories).
 * Returns at most 30 entries to avoid flooding output.
 * Entries are sorted alphabetically with directories first.
 */
export function listDirEntries(dirPath: string): string[] {
  const raw = readdirSync(dirPath);
  const entries: { name: string; isDir: boolean }[] = [];
  for (const name of raw) {
    try {
      const full = join(dirPath, name);
      const isDir = statSync(full).isDirectory();
      entries.push({ name, isDir });
    } catch {
      entries.push({ name, isDir: false });
    }
  }
  // Sort: directories first, then alphabetically
  entries.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const MAX_ENTRIES = 30;
  const formatted = entries.slice(0, MAX_ENTRIES).map(e => e.isDir ? e.name + "/" : e.name);
  if (entries.length > MAX_ENTRIES) {
    formatted.push(`... and ${entries.length - MAX_ENTRIES} more`);
  }
  return formatted;
}

// ── Project structure for system prompt ────────────────────────────────

/**
 * Directories to skip when building project structure.
 * These are noise — agents never need to browse into them.
 */
const STRUCTURE_SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".state",
  "dist",
  ".cache",
  ".next",
  ".nuxt",
  "coverage",
  ".turbo",
  ".vscode",
  ".idea",
  "__pycache__",
  ".tox",
  "venv",
  ".env",
]);

/**
 * Build a compact project structure tree for injection into system prompts.
 *
 * Eliminates the #1 source of wasted tool calls: agents running `find`, `ls`,
 * and other discovery commands to orient themselves in the codebase. By
 * including the structure upfront, agents can immediately reference correct
 * paths.
 *
 * The output is an indented tree like:
 * ```
 * src/
 *   manager.ts
 *   tools.ts
 *   types.ts
 * test/
 *   tools.test.ts
 * package.json
 * tsconfig.json
 * ```
 *
 * @param rootDir - The project root directory to scan
 * @param maxDepth - Maximum directory depth to recurse (default: 2).
 *   Depth 0 = just top-level entries. Depth 2 covers src/sub/file.ts.
 * @param maxEntries - Maximum total entries to include (default: 200).
 *   Prevents huge monorepos from bloating the prompt.
 * @returns A formatted tree string, or empty string if rootDir doesn't exist.
 */
export function buildProjectStructure(
  rootDir: string,
  maxDepth = 2,
  maxEntries = 200,
): string {
  if (!existsSync(rootDir)) return "";

  const lines: string[] = [];
  let entryCount = 0;

  function walk(dir: string, depth: number, indent: string): void {
    if (entryCount >= maxEntries) return;

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    // Classify entries into dirs and files
    const dirs: string[] = [];
    const files: string[] = [];

    for (const name of entries) {
      // Skip hidden files/dirs (except specific ones we want to show)
      if (name.startsWith(".") && !STRUCTURE_SHOW_DOTFILES.has(name)) continue;
      // Skip known noise directories at any depth
      if (STRUCTURE_SKIP_DIRS.has(name)) continue;

      try {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
          dirs.push(name);
        } else {
          files.push(name);
        }
      } catch {
        files.push(name);
      }
    }

    // Sort: dirs first (alphabetical), then files (alphabetical)
    dirs.sort();
    files.sort();

    // Emit directories
    for (const name of dirs) {
      if (entryCount >= maxEntries) {
        lines.push(`${indent}... (truncated)`);
        return;
      }
      lines.push(`${indent}${name}/`);
      entryCount++;

      if (depth < maxDepth) {
        walk(join(dir, name), depth + 1, indent + "  ");
      }
    }

    // Emit files
    for (const name of files) {
      if (entryCount >= maxEntries) {
        lines.push(`${indent}... (truncated)`);
        return;
      }
      lines.push(`${indent}${name}`);
      entryCount++;
    }
  }

  walk(rootDir, 0, "");

  return lines.join("\n");
}

/**
 * Dotfiles/dotdirs that ARE shown in the project structure.
 * Most dotfiles are noise, but some are important config.
 */
const STRUCTURE_SHOW_DOTFILES = new Set([
  ".github",
  ".gitignore",
  ".env.example",
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.json",
  ".prettierrc",
  ".prettierrc.js",
  ".prettierrc.json",
]);

/**
 * Extract a range of lines from content.
 *
 * Both startLine and endLine are 1-based and inclusive.
 * Returns the selected lines joined with newlines, prefixed with
 * line numbers for easy reference in subsequent edits.
 *
 * @param content - The full file content
 * @param startLine - First line number (1-based, inclusive)
 * @param endLine - Last line number (1-based, inclusive)
 * @returns Object with the extracted text and metadata
 */
export function extractLineRange(
  content: string,
  startLine: number,
  endLine: number,
): { text: string; totalLines: number; linesReturned: number } {
  const allLines = content.split("\n");
  const totalLines = allLines.length;

  // Clamp to valid range
  const start = Math.max(1, Math.min(startLine, totalLines));
  const end = Math.max(start, Math.min(endLine, totalLines));

  // Extract lines (convert from 1-based to 0-based index)
  const selected = allLines.slice(start - 1, end);
  const linesReturned = selected.length;

  // Prefix each line with its line number for easy reference
  const numbered = selected.map((line, i) => {
    const lineNum = start + i;
    const pad = String(end).length; // pad to width of largest line number
    return `${String(lineNum).padStart(pad)}| ${line}`;
  });

  return {
    text: numbered.join("\n"),
    totalLines,
    linesReturned,
  };
}

export function createReadTool(options?: ReadToolOptions): AgentTool<typeof ReadParams> {
  const maxFileLength = options?.maxFileLength ?? 0;
  const tracker = options?.truncationTracker;

  return {
    name: "read",
    label: "Read File",
    description: "Read the contents of a file. Supports optional startLine/endLine for reading specific line ranges without truncation — use this instead of full-file reads when editing large files.",
    parameters: ReadParams,
    execute: async (_id, params) => {
      // Resolve path: relative → projectRoot-based, hallucinated → rewritten, correct → as-is
      const effectivePath = options?.projectRoot
        ? resolveReadPath(params.path, options.projectRoot)
        : params.path;

      try {
        const content = readFileSync(effectivePath, "utf-8");

        // ── Line-range mode ──────────────────────────────────────
        // When startLine or endLine is specified, return only those lines
        // with line numbers. No truncation is applied in this mode because
        // the agent is explicitly requesting a bounded range.
        if (params.startLine !== undefined || params.endLine !== undefined) {
          const totalLines = content.split("\n").length;
          const startLine = params.startLine ?? 1;
          const endLine = params.endLine ?? totalLines;
          const { text, linesReturned } = extractLineRange(content, startLine, endLine);

          // Line-range reads do NOT trigger truncation tracking because
          // the agent is intentionally reading a subset — it knows it
          // doesn't have the full file and shouldn't attempt a full rewrite.

          const header = `[Lines ${startLine}-${Math.min(endLine, totalLines)} of ${totalLines} total (${linesReturned} lines shown)]`;
          return textResult(`${header}\n${text}`);
        }

        // ── Full-file mode (with potential truncation) ────────────
        const truncated = truncateOutput(content, maxFileLength, fileContentTruncationMarker);

        // Track truncation: record when a file was truncated, clear when it wasn't
        if (tracker) {
          if (truncated !== content) {
            tracker.recordTruncatedRead(effectivePath, content.length);
          } else {
            tracker.clearPath(effectivePath);
          }
        }

        // Track repeated full-file reads — warn agent to use line-range reads
        const totalLines = content.split("\n").length;
        const repeatedReadWarning = tracker
          ? tracker.buildRepeatedReadWarning(effectivePath, tracker.recordFullRead(effectivePath), totalLines)
          : "";

        return textResult(repeatedReadWarning + truncated);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const hint = options?.projectRoot && msg.includes("ENOENT")
          ? buildEnoentHint(effectivePath, options.projectRoot)
          : "";
        return textResult(`Error reading file: ${msg}${hint}`);
      }
    },
  };
}

export function createWriteTool(options?: WriteToolOptions): AgentTool<typeof WriteParams> {
  const tracker = options?.truncationTracker;

  return {
    name: "write",
    label: "Write File",
    description: "Write content to a file. Creates parent directories if needed.",
    parameters: WriteParams,
    execute: async (_id, params) => {
      // Resolve path: relative → projectRoot-based, hallucinated → rewritten, correct → as-is
      const effectivePath = options?.projectRoot
        ? resolveWritePath(params.path, options.projectRoot)
        : params.path;

      try {
        // Check for write-after-truncated-read data loss BEFORE writing
        const truncationWarning = tracker
          ? tracker.checkWrite(effectivePath, params.content.length)
          : null;

        // Block writes that would lose >50% of content from a truncated file
        if (truncationWarning && tracker) {
          const originalLength = tracker.getOriginalLength(effectivePath);
          if (originalLength && params.content.length < originalLength * 0.5) {
            return textResult(
              `❌ BLOCKED: Write to ${effectivePath} rejected to prevent data loss.\n` +
              `This file was previously read with truncation (original: ${originalLength.toLocaleString()} chars). ` +
              `Your write contains only ${params.content.length.toLocaleString()} chars (${Math.round(params.content.length / originalLength * 100)}% of original).\n\n` +
              `To edit this file safely, use one of these approaches:\n` +
              `  1. read(path, startLine=N, endLine=M) to see the specific section you need to change\n` +
              `  2. exec with sed: sed -i 's/old_text/new_text/g' ${effectivePath}\n` +
              `  3. exec with awk for multi-line changes\n` +
              `  4. Use exec with a heredoc to append/replace specific sections`
            );
          }
        }

        mkdirSync(dirname(effectivePath), { recursive: true });
        writeFileSync(effectivePath, params.content, "utf-8");

        // Clear the tracker entry after write (the file has been rewritten)
        if (tracker) {
          tracker.clearPath(effectivePath);
        }

        return textResult(`Wrote ${params.content.length} bytes to ${effectivePath}${truncationWarning ? truncationWarning : ""}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const hint = options?.projectRoot
          ? buildEnoentHint(effectivePath, options.projectRoot)
          : "";
        return textResult(`Error writing file: ${msg}${hint}`);
      }
    },
  };
}

/**
 * Create linked read and write tools that share a truncation tracker.
 *
 * When the read tool truncates a file (because it exceeds maxFileLength),
 * the write tool will warn if the agent subsequently writes back significantly
 * shorter content — catching the "write-after-truncated-read" data loss pattern.
 *
 * This is the recommended way to create read/write tools for agents.
 *
 * @param options - Combined options for both tools
 * @returns An object with `read`, `write`, and `tracker` properties
 */
export function createLinkedTools(options: {
  projectRoot: string;
  maxFileLength?: number;
}): {
  read: AgentTool<typeof ReadParams>;
  write: AgentTool<typeof WriteParams>;
  tracker: TruncationTracker;
} {
  const tracker = new TruncationTracker();
  return {
    read: createReadTool({
      projectRoot: options.projectRoot,
      maxFileLength: options.maxFileLength,
      truncationTracker: tracker,
    }),
    write: createWriteTool({
      projectRoot: options.projectRoot,
      truncationTracker: tracker,
    }),
    tracker,
  };
}

/** Options for the exec tool. */
export interface ExecToolOptions {
  /** Working directory for commands. */
  cwd?: string;
  /** Regex patterns that block commands. Matched commands return an error hint instead of executing. */
  denyPatterns?: RegExp[];
  /** Message shown when a command is blocked. */
  denyMessage?: string;
  /** If true, prefix exec output with "CWD: <path>" so the agent always knows where it is. Included on both success and error output. */
  echoCwd?: boolean;
  /** If set, commands referencing absolute paths outside this root get a warning appended to output. */
  warnOutsideRoot?: string;
  /**
   * Maximum character length for exec output. When output exceeds this limit,
   * the middle is replaced with a truncation marker showing how many characters
   * were omitted, keeping the head and tail visible.
   *
   * This prevents large outputs (git diff, find, cat) from consuming excessive
   * tokens. The head typically contains headers/structure and the tail contains
   * summaries/final results — the middle is usually repetitive.
   *
   * Default: 20000 (~5K tokens). Set to 0 or Infinity to disable.
   */
  maxOutputLength?: number;
}

/**
 * Truncate output that exceeds maxLen by keeping the head and tail,
 * replacing the middle with a marker showing how much was omitted.
 *
 * The split is 60% head / 40% tail so the beginning (which usually
 * contains structure, headers, or the first results) gets more space.
 *
 * @param output - The raw output string
 * @param maxLen - Maximum allowed length (0 or Infinity = no truncation)
 * @returns The original string if within limits, or a truncated version
 */
export function truncateOutput(output: string, maxLen: number, markerFn?: (omitted: number) => string): string {
  if (!maxLen || maxLen === Infinity || output.length <= maxLen) return output;

  // Reserve space for the marker line itself (~300 chars with guidance)
  const markerReserve = 320;
  const available = maxLen - markerReserve;
  if (available <= 0) return output.slice(0, maxLen);

  const headLen = Math.floor(available * 0.6);
  const tailLen = available - headLen;

  const head = output.slice(0, headLen);
  const tail = output.slice(output.length - tailLen);
  const omitted = output.length - headLen - tailLen;

  const marker = markerFn
    ? markerFn(omitted)
    : `\n\n... [${omitted.toLocaleString()} characters truncated — DO NOT fabricate content from the truncated section. Only reference what is shown above and below.] ...\n\n`;

  return head + marker + tail;
}

/**
 * Like truncateOutput but also returns whether truncation occurred.
 *
 * Used when callers need to append additional context (like suffix warnings)
 * only when output was actually truncated.
 *
 * @param output - The raw output string
 * @param maxLen - Maximum allowed length (0 or Infinity = no truncation)
 * @param markerFn - Optional custom marker builder
 * @returns Object with truncated text and whether truncation was applied
 */
export function truncateOutputWithFlag(
  output: string,
  maxLen: number,
  markerFn?: (omitted: number) => string,
): { text: string; wasTruncated: boolean } {
  if (!maxLen || maxLen === Infinity || output.length <= maxLen) {
    return { text: output, wasTruncated: false };
  }

  return { text: truncateOutput(output, maxLen, markerFn), wasTruncated: true };
}



/**
 * Build a truncation marker for file content read by the read tool.
 *
 * Unlike the generic marker, this includes actionable guidance telling
 * the agent to use line-range reads or targeted editing (exec with sed)
 * instead of full-file writes — the #1 remaining quality issue in evals.
 *
 * @param omitted - Number of characters that were omitted
 * @returns A marker string to insert between head and tail
 */
export function fileContentTruncationMarker(omitted: number): string {
  return (
    `\n\n... [${omitted.toLocaleString()} characters truncated] ...\n` +
    `⚠️ FILE TRUNCATED: You are seeing only the beginning and end of this file.\n` +
    `DO NOT use the write tool to rewrite this entire file — you will lose the content you cannot see.\n` +
    `Instead: use read(path, startLine=N, endLine=M) to see specific sections, or exec with sed for targeted edits.\n\n`
  );
}

/**
 * Build a truncation marker for exec command output.
 *
 * Includes guidance to re-run with narrower scope rather than fabricating
 * claims about counts or results from the truncated section.
 *
 * @param omitted - Number of characters that were omitted
 * @returns A marker string to insert between head and tail
 */
export function execOutputTruncationMarker(omitted: number): string {
  return (
    `\n\n... [${omitted.toLocaleString()} characters truncated] ...\n` +
    `⚠️ OUTPUT TRUNCATED: Do NOT fabricate or assume content from the truncated section.\n` +
    `If you need the full output, re-run with narrower scope (e.g., grep -c for counts, | head/tail, or filter args).\n\n`
  );
}

/**
 * Build an end-of-output suffix warning when exec output was truncated.
 *
 * This addresses the #1 remaining quality issue in evaluations: agents see
 * truncated exec output (test results, file lists, git diff) and then make
 * specific quantitative claims about data they never saw, e.g.:
 * - "All 718 tests pass across 48 test files" (test output was truncated)
 * - "42 files found" (file listing was truncated)
 * - "9 files, +300/-68 lines" (git output was truncated)
 *
 * The middle-of-output truncation marker is often ignored because agents
 * focus on the tail. This suffix appears at the very END of the output,
 * making it the last thing the agent reads before responding.
 *
 * The warning is tailored to the detected output type (test runner, file
 * listing, git) for maximum relevance.
 *
 * @param command - The original command string (used to detect output type)
 * @param output - The original (pre-truncation) output string
 * @returns A suffix warning string, or empty string if no special warning needed
 */
export function buildExecTruncationSuffix(command: string, output: string): string {
  const lines: string[] = [];

  lines.push("\n⚠️ IMPORTANT: This output was truncated. You did NOT see the complete output.");

  // Detect test runner output
  const isTestRunner = /\b(vitest|jest|mocha|pytest|npm test|npx test|yarn test|pnpm test|bun test)\b/i.test(command) ||
    /\b(Tests?|PASS|FAIL|✓|✗|✘)\b/.test(output.slice(0, 2000));

  // Detect file listing commands
  const isFileListing = /\b(find|ls|tree|glob|dir)\b/.test(command) ||
    /\bwc\b.*-[lw]/.test(command);

  // Detect git output  
  const isGitOutput = /\bgit\s+(diff|log|show|status|stash)\b/.test(command);

  // Detect counting/aggregation commands
  const isCounting = /\bwc\b|\bgrep\s+-c\b|\bcount\b|\|\s*wc\b/.test(command);

  if (isTestRunner) {
    lines.push("You MUST NOT claim a specific number of passing/failing tests or test files.");
    lines.push("Say \"tests were run but output was truncated — re-run with `| tail -20` to see the summary\" instead.");
  } else if (isFileListing) {
    lines.push("You MUST NOT claim a total file count or assert the listing is complete.");
    lines.push("Say \"file listing was truncated\" and re-run with `| wc -l` for counts or `| grep <pattern>` for specific files.");
  } else if (isGitOutput) {
    lines.push("You MUST NOT claim specific line counts (+N/-M) or file counts from truncated diff/log output.");
    lines.push("Use `git diff --stat` for a summary, or `git diff <specific-file>` for targeted diffs.");
  } else if (isCounting) {
    lines.push("The count output may be incomplete. Verify by re-running with a narrower scope.");
  } else {
    lines.push("Do NOT make specific quantitative claims (counts, totals, completeness) about the truncated output.");
    lines.push("Re-run with narrower scope (| head, | tail, | grep, -c flag) to get the specific data you need.");
  }

  return lines.join("\n");
}



/** Default max output length for exec tool (~5K tokens). */
const DEFAULT_MAX_OUTPUT_LENGTH = 20_000;

/**
 * Detect whether a command string contains absolute paths outside the given root.
 * Matches common top-level dirs like /home, /app, /work, /usr, /etc, /tmp, /var, /opt.
 */
export function detectsOutsidePaths(command: string, root: string): boolean {
  const absPathRegex = /(?:^|\s|['";=])(\/(?:home|app|work|usr|etc|tmp|var|opt)(?:\/\S*)?)/g;
  let match;
  while ((match = absPathRegex.exec(command)) !== null) {
    const path = match[1];
    if (path !== root && !path.startsWith(root + "/")) {
      return true;
    }
  }
  return false;
}

/**
 * Strip redundant `cd <root> && ` or `cd <root>;` prefix from a command.
 *
 * Agents frequently emit commands like `cd /home/example-user/may-agent && git log`
 * even though the exec tool's cwd is already set to that directory. This
 * wastes tokens (the cd output + absolute path echoed back) and indicates
 * the agent doesn't trust the CWD. Silently stripping the prefix:
 * 1. Saves tokens on every invocation
 * 2. Makes the echoed CWD the only source of truth
 * 3. Removes a source of confusion when the path is slightly wrong
 *
 * Only strips when the cd target exactly matches `root`.
 */
export function stripRedundantCd(command: string, root: string): string {
  // Match: cd /path/to/root && rest  or  cd /path/to/root; rest
  // Also handles: cd "/path/to/root" && rest  and  cd '/path/to/root' && rest
  const escapedRoot = root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `^\\s*cd\\s+["']?${escapedRoot}["']?\\s*(?:&&|;)\\s*`,
  );
  return command.replace(pattern, "");
}


/**
 * Extract a failing path from exec error output and build a helpful hint.
 *
 * When exec commands fail with "No such file or directory", the agent typically
 * wastes 2-3 follow-up calls running `ls` and `find` to discover what exists.
 * This function detects the failing path from the error output and appends
 * the same directory-listing hint that the read tool provides.
 *
 * @param output - The combined stdout+stderr from the failed command
 * @param projectRoot - The project root for building hints
 * @returns A hint string to append, or empty string if no ENOENT detected
 */
export function buildExecEnoentHint(output: string, projectRoot: string): string {
  if (!output.includes("No such file or directory")) return "";

  // Extract the failing path from common error formats:
  //   head: cannot open '/path/to/file' for reading: No such file or directory
  //   ls: cannot access '/path/to/dir': No such file or directory
  //   cat: /path/to/file: No such file or directory
  //   bash: cd: /path/to/dir: No such file or directory
  const pathMatch = output.match(
    /(?:cannot (?:open|access|stat)|cd:|cat:?)\s*['"]*([^'":\n]+?)['"]*(?:\s*(?:for reading)?\s*:\s*No such file or directory|':\s*No such file)/
  );
  if (!pathMatch) return "";

  const failedPath = pathMatch[1].trim();
  if (!failedPath || !failedPath.startsWith("/")) return "";

  return "\n" + buildEnoentHint(failedPath, projectRoot);
}

/**
 * Build actionable recovery hints for common exec failure patterns.
 *
 * When exec commands fail, agents often waste 2-5 follow-up calls blindly
 * retrying or probing the filesystem. This function detects the failure
 * pattern from the command + output and provides specific guidance.
 *
 * Covers the top failure patterns from evaluation data:
 * - Empty output on non-zero exit (glob/ls with no matches, grep no match)
 * - Module not found (wrong import path or missing build)
 * - Syntax errors in sed/node/shell
 * - Command not found
 * - Permission denied
 * - cd to non-existent directory
 *
 * @param command - The command that was executed
 * @param output - The combined stdout+stderr (may be empty)
 * @param exitCode - The exit code
 * @param projectRoot - The project root directory
 * @returns A hint string to append, or empty string if no pattern matched
 */
export function buildExecErrorHint(
  command: string,
  output: string,
  exitCode: number,
  projectRoot: string,
): string {
  const hints: string[] = [];

  // ── Pattern 1: Empty output on non-zero exit ──────────────────────
  // This is the #1 wasted-call pattern. Glob expansions like
  // `ls agents/*/skills/` or `cat *.test.ts` silently fail with exit 2
  // when nothing matches, leaving the agent with zero information.
  if (!output.trim()) {
    // Detect glob patterns in the command
    const hasGlob = /[*?]/.test(command);
    const hasRedirectedStderr = /2>\s*\/dev\/null/.test(command);

    if (hasGlob || hasRedirectedStderr) {
      hints.push(
        `Hint: command produced no output (exit ${exitCode}). ` +
        `This usually means a glob pattern matched nothing` +
        (hasRedirectedStderr ? ` or errors were redirected to /dev/null` : ``) +
        `. Try listing the parent directory first to see what exists.`,
      );
    } else if (exitCode === 1 && /\bgrep\b/.test(command)) {
      hints.push(
        `Hint: grep exited with code 1 (no matches found). ` +
        `The pattern may not exist in the searched files, or the file paths may be wrong.`,
      );
    } else {
      hints.push(
        `Hint: command failed with exit code ${exitCode} and no output. ` +
        `Check that the command syntax is correct and all paths exist.`,
      );
    }

    // Try to identify a directory path in the command and list it
    const dirMatch = command.match(/(?:ls|cat|head|tail|find|cd)\s+['"]*([^\s'"*?|;&]+)/);
    if (dirMatch) {
      const targetPath = dirMatch[1];
      const resolvedPath = targetPath.startsWith("/")
        ? targetPath
        : projectRoot + "/" + targetPath;
      // Try to find the parent directory that exists
      const parts = resolvedPath.split("/");
      for (let i = parts.length; i > 0; i--) {
        const candidate = parts.slice(0, i).join("/");
        if (candidate && candidate !== "/" && existsSyncSafe(candidate)) {
          try {
            const entries = listDirEntries(candidate);
            if (entries.length > 0) {
              const label = candidate.startsWith(projectRoot + "/")
                ? candidate.slice(projectRoot.length + 1) + "/"
                : candidate === projectRoot
                  ? "(project root)"
                  : candidate + "/";
              hints.push(`Directory ${label} contains: ${entries.join(", ")}`);
            }
          } catch { /* ignore */ }
          break;
        }
      }
    }
  }

  // ── Pattern 2: Module/package not found ───────────────────────────
  if (/Cannot find module|ERR_MODULE_NOT_FOUND|MODULE_NOT_FOUND/.test(output)) {
    const moduleMatch = output.match(/Cannot find module ['"]([^'"]+)['"]/);
    const moduleName = moduleMatch ? moduleMatch[1] : "unknown";
    if (moduleName.includes("./dist/") || moduleName.includes("./build/")) {
      hints.push(
        `Hint: module "${moduleName}" not found — the project may need to be built first. ` +
        `Try: npx tsc (or check package.json for the build command).`,
      );
    } else if (moduleName.startsWith("./") || moduleName.startsWith("../")) {
      hints.push(
        `Hint: local module "${moduleName}" not found. Check if the file exists ` +
        `and use the correct extension (.js for ESM, .ts for source).`,
      );
    } else {
      hints.push(
        `Hint: module "${moduleName}" not found. It may need to be installed: npm install ${moduleName}`,
      );
    }
  }

  // ── Pattern 3: Command not found ──────────────────────────────────
  if (/command not found|not found$/.test(output)) {
    const cmdMatch = output.match(/(?:bash|sh|\/bin\/sh):\s*(?:line \d+:\s*)?(?:\d+:\s*)?(\S+):\s*(?:command )?not found/);
    if (cmdMatch) {
      hints.push(
        `Hint: "${cmdMatch[1]}" is not installed or not in PATH. ` +
        `Use npx to run Node.js tools (e.g., npx tsc, npx vitest).`,
      );
    }
  }

  // ── Pattern 4: sed "old text not found" ───────────────────────────
  if (/old text not found|unterminated.*substitute|invalid command code/.test(output)) {
    hints.push(
      `Hint: sed command failed. Common causes: the search text doesn't match exactly ` +
      `(check whitespace, special chars), or the delimiter conflicts with the replacement text. ` +
      `Consider using the write tool to replace the entire file content instead.`,
    );
  }

  // ── Pattern 5: TypeScript / compilation errors ────────────────────
  if (/error TS\d+:|Cannot find name|Property .* does not exist/.test(output)) {
    hints.push(
      `Hint: TypeScript compilation error. Read the specific file and line number ` +
      `from the error to understand the type mismatch.`,
    );
  }

  // ── Pattern 6: cd to non-existent directory ───────────────────────
  if (/can't cd to|cd:.*No such/.test(output)) {
    const cdMatch = output.match(/cd:\s*(?:can't cd to\s+)?([^:]+?)(?::|$)/m);
    if (cdMatch) {
      const failedDir = cdMatch[1].trim();
      hints.push(
        `Hint: directory "${failedDir}" does not exist. ` +
        `Your working directory is already ${projectRoot} — use relative paths.`,
      );
    }
  }

  if (hints.length === 0) return "";
  return "\n" + hints.join("\n");
}

/**
 * Safe existsSync wrapper that won't throw on permission errors.
 */
function existsSyncSafe(p: string): boolean {
  try { return existsSync(p); } catch { return false; }
}


// ── Git commit guardrails ──────────────────────────────────────────────

/**
 * Detect whether a shell command contains a blanket `git add` that stages
 * everything (e.g., `git add -A`, `git add .`, `git add --all`).
 *
 * Returns a warning string to prepend to the exec result, or empty string
 * if the command uses specific file paths (which is fine).
 */
export function warnBlanketGitAdd(command: string, cwd: string): string {
  const subcommands = command.split(/\s*(?:&&|;)\s*/);
  for (const sub of subcommands) {
    const trimmed = sub.trim();
    if (/^\s*#/.test(trimmed)) continue;
    if (/^\s*(?:echo|grep|printf)\b/.test(trimmed)) continue;
    // Match: git add -A, git add --all, git add .
    if (/\bgit\s+add\s+(-A|--all|\.)\s*$/.test(trimmed) ||
        /\bgit\s+add\s+(-A|--all|\.)\s*(?=&&|;|\|)/.test(trimmed)) {
      // Determine effective cwd for git status
      let gitCwd = cwd;
      const cdMatch = command.match(/^\s*cd\s+["']?([^"';&]+?)["']?\s*(?:&&|;)/);
      if (cdMatch) {
        const cdTarget = cdMatch[1].trim();
        gitCwd = cdTarget.startsWith("/") ? cdTarget : join(cwd, cdTarget);
      }

      // Show what would be staged
      try {
        const status = execSync("git status --short", {
          cwd: gitCwd,
          encoding: "utf-8",
          timeout: 5000,
          stdio: ["pipe", "pipe", "pipe"],
        }).trim();

        if (status) {
          const lines = status.split("\n");
          const preview = lines.slice(0, 10).join("\n  ");
          const more = lines.length > 10 ? `\n  (+${lines.length - 10} more files)` : "";
          return `⚠️ BLANKET GIT ADD: This command stages ALL changes. ${lines.length} file(s) will be staged:\n  ${preview}${more}\nUse \`git add <specific-files>\` to stage only the files you changed.\n\n`;
        }
      } catch {
        // Not a git repo — skip
      }
      return "";
    }
  }
  return "";
}

/**
 * Detect whether a shell command contains a `git commit` invocation.
 *
 * Matches patterns like:
 * - `git commit -m "msg"`
 * - `git add -A && git commit -m "msg"`
 * - `git commit --amend`
 * - `cd agents && git commit -m "..."`
 *
 * Does NOT match `git commit` inside comments, echo, or grep.
 *
 * @param command - The shell command string (after stripRedundantCd/rewrite)
 * @returns true if the command will execute a git commit
 */
export function isGitCommitCommand(command: string): boolean {
  // Split on && and ; to check each subcommand
  const subcommands = command.split(/\s*(?:&&|;)\s*/);
  for (const sub of subcommands) {
    const trimmed = sub.trim();
    // Skip if it's inside echo/grep/comment
    if (/^\s*#/.test(trimmed)) continue;
    if (/^\s*(?:echo|grep|printf)\b/.test(trimmed)) continue;
    // Match: git commit (with optional flags)
    if (/\bgit\s+commit\b/.test(trimmed)) return true;
  }
  return false;
}

/**
 * Gather post-commit context to append after a git commit's output.
 *
 * Runs `git status --short` to show what remains uncommitted in the
 * working tree after the commit completes. This addresses evaluation
 * failure patterns:
 * - "Committed unintended changes from dirty working tree"
 * - "Claims about commit stats contradict actual output"
 * - "Did not run git status after committing"
 *
 * @param cwd - Working directory for git commands
 * @param command - The original command, used to detect cd target
 * @returns A context string to append, or empty string if clean/not a git repo
 */
export function buildGitCommitContext(cwd: string, command: string): string {
  // Determine the effective git directory — the command may cd elsewhere first
  let gitCwd = cwd;
  const cdMatch = command.match(/^\s*cd\s+["']?([^"';&]+?)["']?\s*(?:&&|;)/);
  if (cdMatch) {
    const cdTarget = cdMatch[1].trim();
    if (cdTarget.startsWith("/")) {
      gitCwd = cdTarget;
    } else {
      gitCwd = join(cwd, cdTarget);
    }
  }

  const lines: string[] = [];

  // Check for remaining unstaged/untracked changes AFTER the commit
  try {
    const status = execSync("git status --short", {
      cwd: gitCwd,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    if (status) {
      // Parse status lines — format is "XY filename" where XY are 2 status chars
      // Note: .trim() on the full output can eat the leading space of the first line
      // (e.g., " M file.txt" becomes "M file.txt"), so we use a regex that handles
      // both 2-char and 1-char prefixes gracefully.
      const statusLines = status.split("\n");
      const modified: string[] = [];
      const untracked: string[] = [];

      for (const line of statusLines) {
        // Match: optional leading whitespace + XY + space + filename
        const match = line.match(/^(.{1,2})\s+(.+)$/);
        if (!match) continue;
        const code = match[1].trim();
        const file = match[2].trim();
        if (code === "??") {
          untracked.push(file);
        } else {
          modified.push(file);
        }
      }

      const warnings: string[] = [];
      if (modified.length > 0) {
        warnings.push(`${modified.length} modified/staged file(s) not in this commit: ${modified.slice(0, 5).join(", ")}${modified.length > 5 ? ` (+${modified.length - 5} more)` : ""}`);
      }
      if (untracked.length > 0) {
        warnings.push(`${untracked.length} untracked file(s): ${untracked.slice(0, 5).join(", ")}${untracked.length > 5 ? ` (+${untracked.length - 5} more)` : ""}`);
      }

      if (warnings.length > 0) {
        lines.push(`\n⚠️ POST-COMMIT: Working tree is not clean.`);
        for (const w of warnings) {
          lines.push(`  - ${w}`);
        }
        lines.push(`  Run \`git status\` and \`git diff\` to review remaining changes.`);
      }
    }
  } catch {
    // Not a git repo or git not available — skip silently
  }

  return lines.join("\n");
}



export function createExecTool(cwdOrOpts?: string | ExecToolOptions): AgentTool<typeof ExecParams> {
  const opts: ExecToolOptions = typeof cwdOrOpts === "string" ? { cwd: cwdOrOpts } : (cwdOrOpts ?? {});
  const effectiveCwd = opts.cwd ?? process.cwd();
  const denyPatterns = opts.denyPatterns ?? [];
  const denyMessage = opts.denyMessage ?? "Use relative paths from the project root instead.";
  const warnOutsideRoot = opts.warnOutsideRoot;
  const cwdPrefix = opts.echoCwd ? `CWD: ${effectiveCwd}\n` : "";
  const maxOutputLength = opts.maxOutputLength ?? DEFAULT_MAX_OUTPUT_LENGTH;

  return {
    name: "exec",
    label: "Execute Command",
    description: "Execute a shell command. Returns stdout and stderr.",
    parameters: ExecParams,
    execute: async (_id, params) => {
      // Strip redundant `cd <cwd> && ` prefix — the cwd is already set
      let command = stripRedundantCd(params.command, effectiveCwd);

      // Rewrite hallucinated paths to actual project root
      if (warnOutsideRoot) {
        command = rewriteHallucinatedCommand(command, warnOutsideRoot);
      }

      // Check deny patterns (on the cleaned command)
      for (const pattern of denyPatterns) {
        if (pattern.test(command)) {
          return textResult(
            `Blocked: command matches a denied pattern.\n${denyMessage}\nHint: your working directory is ${effectiveCwd}`,
          );
        }
      }

      const outsideWarning = warnOutsideRoot && detectsOutsidePaths(command, warnOutsideRoot)
        ? `\nWARNING: Your command references paths outside the project root (${warnOutsideRoot}). Use relative paths from the project root instead.`
        : "";

      try {
        const timeout = (params.timeout ?? 30) * 1000;
        // Pre-exec: warn about blanket git add BEFORE the command runs
        // (after execution, git add -A && git commit leaves a clean tree — too late to warn)
        const gitAddWarning = warnBlanketGitAdd(command, effectiveCwd);
        const output = execSync(command, {
          cwd: effectiveCwd,
          encoding: "utf-8",
          timeout,
          maxBuffer: 1024 * 1024,
          stdio: ["pipe", "pipe", "pipe"],
        });
        const result = output || "(no output)";
        const gitContext = isGitCommitCommand(command) ? buildGitCommitContext(effectiveCwd, command) : "";
        const { text: truncatedResult, wasTruncated } = truncateOutputWithFlag(result, maxOutputLength, execOutputTruncationMarker);
        const truncSuffix = wasTruncated ? buildExecTruncationSuffix(command, result) : "";
        return textResult(cwdPrefix + gitAddWarning + truncatedResult + truncSuffix + gitContext + outsideWarning);
      } catch (err: unknown) {
        if (err && typeof err === "object" && "stdout" in err) {
          const e = err as { stdout: string; stderr: string; status: number };
          const output = [e.stdout, e.stderr].filter(Boolean).join("\n");
          const enoentHint = warnOutsideRoot ? buildExecEnoentHint(output, warnOutsideRoot) : "";
          const errorHint = warnOutsideRoot ? buildExecErrorHint(command, output, e.status ?? 1, warnOutsideRoot) : "";
          const { text: truncatedErr, wasTruncated: errTruncated } = truncateOutputWithFlag(output, maxOutputLength);
          const errTruncSuffix = errTruncated ? buildExecTruncationSuffix(command, output) : "";
          return textResult(`${cwdPrefix}Exit code ${e.status}\n${truncatedErr}${errTruncSuffix}${enoentHint}${errorHint}${outsideWarning}`);
        }
        const msg = err instanceof Error ? err.message : String(err);
        return textResult(`${cwdPrefix}Error: ${msg}${outsideWarning}`);
      }
    },
  };
}

// ── Workflow validation tool ───────────────────────────────────────────

const ValidateWorkflowParams = Type.Object({
  path: Type.String({ description: "Absolute path to the workflow .ts file to validate" }),
});

/**
 * Create a tool that type-checks a workflow .ts file against the WorkflowContext types.
 *
 * The workflow file must include:
 *   /// <reference path="<path-to>/workflow-defs.d.ts" />
 *
 * If the reference directive is missing, the tool prepends it before checking
 * and reports whether the file needs it.
 */
export function createValidateWorkflowTool(): AgentTool<typeof ValidateWorkflowParams> {
  return {
    name: "validate_workflow",
    label: "Validate Workflow",
    description:
      "Type-check a workflow .ts file. Validates that the file exports " +
      "name (string), description (string), and execute (WorkflowContext => Promise<WorkflowResult>). " +
      "Returns type errors if any, or 'valid' if the file passes.",
    parameters: ValidateWorkflowParams,
    execute: async (_id, params) => {
      try {
        // Read the file first to check for reference directive
        let content: string;
        try {
          content = readFileSync(params.path, "utf-8");
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          return textResult(`Error reading file: ${msg}`);
        }

        const hasRef = content.includes("/// <reference path=") && content.includes("workflow-defs.d.ts");
        let needsRefNote = "";

        if (!hasRef) {
          // Create a temp file with the reference prepended
          const refLine = `/// <reference path="${DEFS_PATH}" />\n`;
          const tmpPath = params.path + ".__validate_tmp__.ts";
          try {
            writeFileSync(tmpPath, refLine + content, "utf-8");
            const output = execSync(
              `npx tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext "${tmpPath}" 2>&1`,
              { encoding: "utf-8", timeout: 30000, cwd: dirname(params.path) },
            );
            // Clean up and report
            try { execSync(`rm -f "${tmpPath}"`, { encoding: "utf-8" }); } catch { /* ignore */ }
            needsRefNote = `Note: file is missing the reference directive. Add this line at the top:\n  /// <reference path="${DEFS_PATH}" />\n\n`;
            return textResult(needsRefNote + (output.trim() || "Valid — no type errors."));
          } catch (err: unknown) {
            try { execSync(`rm -f "${tmpPath}"`, { encoding: "utf-8" }); } catch { /* ignore */ }
            if (err && typeof err === "object" && "stdout" in err) {
              const e = err as { stdout: string; stderr: string };
              const output = [e.stdout, e.stderr].filter(Boolean).join("\n");
              // Replace tmp filename with original in error messages
              const cleaned = output.replace(new RegExp(tmpPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), params.path);
              needsRefNote = `Note: file is missing the reference directive. Add this line at the top:\n  /// <reference path="${DEFS_PATH}" />\n\n`;
              return textResult(needsRefNote + "Type errors:\n" + cleaned);
            }
            const msg = err instanceof Error ? err.message : String(err);
            return textResult(`Validation failed: ${msg}`);
          }
        }

        // File has the reference directive, validate directly
        const output = execSync(
          `npx tsc --noEmit --strict --target ES2022 --module NodeNext --moduleResolution NodeNext "${params.path}" 2>&1`,
          { encoding: "utf-8", timeout: 30000, cwd: dirname(params.path) },
        );
        return textResult(output.trim() || "Valid — no type errors.");
      } catch (err: unknown) {
        if (err && typeof err === "object" && "stdout" in err) {
          const e = err as { stdout: string; stderr: string };
          const output = [e.stdout, e.stderr].filter(Boolean).join("\n");
          return textResult("Type errors:\n" + output);
        }
        const msg = err instanceof Error ? err.message : String(err);
        return textResult(`Validation failed: ${msg}`);
      }
    },
  };
}

// ── Health check tool ──────────────────────────────────────────────────

/** A single check result in the health report. */
export interface HealthCheck {
  name: string;
  ok: boolean;
  detail: string;
}

/** Structured health report returned by the health_check tool. */
export interface HealthReport {
  healthy: boolean;
  checks: HealthCheck[];
}

const HealthCheckParams = Type.Object({});

export interface HealthCheckOptions {
  /** Project root directory. Defaults to process.cwd(). */
  projectRoot?: string;
  /** Path to .state directory. Defaults to <projectRoot>/.state */
  stateDir?: string;
  /** Whether to run tsc type-check. Defaults to true. */
  runTypeCheck?: boolean;
  /** Whether to run vitest. Defaults to true. */
  runTests?: boolean;
}

/**
 * Create a health check tool that verifies the project environment is sane.
 *
 * Checks:
 * 1. package.json exists (project root is correct)
 * 2. agents/ directory exists
 * 3. .state/ directory exists (creates if missing)
 * 4. node_modules/ exists
 * 5. TypeScript compiles cleanly (npx tsc --noEmit)
 * 6. Tests pass (npx vitest --run)
 * 7. No stale sessions stuck in "running" status
 */
export function createHealthCheckTool(options?: HealthCheckOptions): AgentTool<typeof HealthCheckParams, HealthReport> {
  const projectRoot = options?.projectRoot ?? process.cwd();
  const stateDir = options?.stateDir ?? join(projectRoot, ".state");
  const runTypeCheck = options?.runTypeCheck ?? true;
  const runTests = options?.runTests ?? true;

  return {
    name: "health_check",
    label: "Health Check",
    description:
      "Run a startup health check on the project environment. " +
      "Verifies project root, directories, dependencies, type-checking, tests, and session state. " +
      "Returns a structured report with { healthy: boolean, checks: [{name, ok, detail}] }.",
    parameters: HealthCheckParams,
    execute: async () => {
      const checks: HealthCheck[] = [];

      // 1. package.json exists
      const pkgPath = join(projectRoot, "package.json");
      if (existsSync(pkgPath)) {
        checks.push({ name: "package.json", ok: true, detail: `Found at ${pkgPath}` });
      } else {
        checks.push({ name: "package.json", ok: false, detail: `Missing: ${pkgPath} — project root may be wrong` });
      }

      // 2. agents/ directory exists
      const agentsDir = join(projectRoot, "agents");
      if (existsSync(agentsDir)) {
        checks.push({ name: "agents/", ok: true, detail: `Found at ${agentsDir}` });
      } else {
        checks.push({ name: "agents/", ok: false, detail: `Missing: ${agentsDir}` });
      }

      // 3. .state/ directory exists (create if missing)
      if (existsSync(stateDir)) {
        checks.push({ name: ".state/", ok: true, detail: `Found at ${stateDir}` });
      } else {
        try {
          mkdirSync(stateDir, { recursive: true });
          checks.push({ name: ".state/", ok: true, detail: `Created ${stateDir} (was missing)` });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          checks.push({ name: ".state/", ok: false, detail: `Failed to create ${stateDir}: ${msg}` });
        }
      }

      // 4. node_modules/ exists
      const nodeModules = join(projectRoot, "node_modules");
      if (existsSync(nodeModules)) {
        checks.push({ name: "node_modules/", ok: true, detail: `Found at ${nodeModules}` });
      } else {
        checks.push({ name: "node_modules/", ok: false, detail: `Missing: ${nodeModules} — run npm install` });
      }

      // 5. TypeScript type-check
      if (runTypeCheck) {
        try {
          execSync("npx tsc --noEmit", {
            cwd: projectRoot,
            encoding: "utf-8",
            timeout: 60000,
            stdio: ["pipe", "pipe", "pipe"],
          });
          checks.push({ name: "tsc", ok: true, detail: "Type-check passed" });
        } catch (err: unknown) {
          let detail = "Type-check failed";
          if (err && typeof err === "object" && "stdout" in err) {
            const e = err as { stdout: string; stderr: string };
            const output = [e.stdout, e.stderr].filter(Boolean).join("\n").trim();
            if (output) detail += ":\n" + output;
          }
          checks.push({ name: "tsc", ok: false, detail });
        }
      }

      // 6. Tests
      if (runTests) {
        try {
          execSync("npx vitest --run", {
            cwd: projectRoot,
            encoding: "utf-8",
            timeout: 120000,
            stdio: ["pipe", "pipe", "pipe"],
          });
          checks.push({ name: "tests", ok: true, detail: "All tests passed" });
        } catch (err: unknown) {
          let detail = "Tests failed";
          if (err && typeof err === "object" && "stdout" in err) {
            const e = err as { stdout: string; stderr: string };
            const output = [e.stdout, e.stderr].filter(Boolean).join("\n").trim();
            if (output) detail += ":\n" + output;
          }
          checks.push({ name: "tests", ok: false, detail });
        }
      }

      // 7. Stale sessions in registry.json
      const registryPath = join(stateDir, "registry.json");
      if (existsSync(registryPath)) {
        try {
          const raw = readFileSync(registryPath, "utf-8");
          const registry = JSON.parse(raw) as { sessions?: Record<string, { status: string; agent?: string; task?: string }> };
          const sessions = registry.sessions ?? {};
          const stale = Object.entries(sessions).filter(([, s]) => s.status === "running");
          if (stale.length === 0) {
            checks.push({ name: "stale_sessions", ok: true, detail: "No sessions stuck in running state" });
          } else {
            const details = stale
              .map(([id, s]) => `  ${id}: agent=${s.agent ?? "?"}, task=${s.task ?? "?"}`)
              .join("\n");
            checks.push({
              name: "stale_sessions",
              ok: false,
              detail: `${stale.length} session(s) stuck in "running" status:\n${details}`,
            });
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          checks.push({ name: "stale_sessions", ok: false, detail: `Failed to read registry: ${msg}` });
        }
      } else {
        checks.push({ name: "stale_sessions", ok: true, detail: "No registry.json yet (clean state)" });
      }

      const healthy = checks.every((c) => c.ok);
      const report: HealthReport = { healthy, checks };

      // Format a human-readable summary
      const lines = checks.map((c) => `${c.ok ? "✓" : "✗"} ${c.name}: ${c.detail}`);
      const summary = `Health check: ${healthy ? "HEALTHY" : "UNHEALTHY"}\n\n${lines.join("\n")}`;

      return {
        content: [{ type: "text", text: summary }],
        details: report,
      };
    },
  };
}


// ── Learn tool ─────────────────────────────────────────────────────────

const LearnParams = Type.Object({
  lesson: Type.Optional(Type.String({ description: "What you learned. Be specific and actionable. Required when adding a lesson." })),
  category: Type.Optional(Type.String({ description: "Category for the lesson (e.g. 'testing', 'architecture', 'debugging'). Default: 'general'." })),
  listLessons: Type.Optional(Type.Boolean({ description: "When true, return current lessons instead of adding. The 'lesson' param is ignored." })),
});

/**
 * Parse a lessons.md file into a map of category → lesson lines.
 *
 * Expected format:
 *   # Lessons
 *
 *   ## category-name
 *
 *   - 2024-01-01 12:00: Some lesson
 *   - 2024-01-02 13:00: Another lesson
 *
 *   ## another-category
 *   ...
 *
 * Returns a Map preserving insertion order.
 * Lessons not under any ## header go into the "general" category.
 */
function parseLessons(content: string): Map<string, string[]> {
  const categories = new Map<string, string[]>();
  let currentCategory = "general";
  categories.set(currentCategory, []);

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      currentCategory = trimmed.slice(3).trim().toLowerCase();
      if (!categories.has(currentCategory)) {
        categories.set(currentCategory, []);
      }
    } else if (trimmed.startsWith("- ")) {
      const list = categories.get(currentCategory);
      if (list) list.push(trimmed);
      else categories.set(currentCategory, [trimmed]);
    }
    // Skip # Lessons header, ---, and blank lines
  }

  return categories;
}

/**
 * Serialize a category map back to markdown.
 */
function serializeLessons(categories: Map<string, string[]>): string {
  const sections: string[] = ["# Lessons\n"];

  for (const [cat, lessons] of categories) {
    if (lessons.length === 0) continue;
    sections.push(`## ${cat}\n`);
    for (const lesson of lessons) {
      sections.push(lesson);
    }
    sections.push(""); // blank line after section
  }

  return sections.join("\n");
}

/**
 * Check whether a similar lesson already exists in any category.
 *
 * Uses case-insensitive substring matching: if the new lesson text
 * is contained in an existing entry (or vice versa), it's a duplicate.
 */
function isDuplicate(categories: Map<string, string[]>, lessonText: string): boolean {
  const needle = lessonText.toLowerCase();
  for (const lessons of categories.values()) {
    for (const existing of lessons) {
      const existingLower = existing.toLowerCase();
      // Extract the lesson text after the timestamp prefix "- YYYY-MM-DD HH:MM: "
      const match = existingLower.match(/^- \d{4}-\d{2}-\d{2} \d{2}:\d{2}: (.+)$/);
      const existingText = match ? match[1] : existingLower;
      if (existingText.includes(needle) || needle.includes(existingText)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Create a tool that records lessons to the agent's knowledge/lessons.md.
 *
 * Features:
 * - **Categories**: lessons are organized under markdown ## headers
 * - **Deduplication**: before adding, checks if a similar lesson exists (substring match)
 * - **Listing**: set listLessons=true to retrieve current lessons
 *
 * @param knowledgeDir - path to the agent's knowledge/ directory
 */
export function createLearnTool(knowledgeDir: string): AgentTool<typeof LearnParams> {
  return {
    name: "learn",
    label: "Learn",
    description:
      "Record a lesson or list existing lessons. Use when: the user corrects you, you discover " +
      "something useful, or you find a better approach. Lessons persist " +
      "across sessions. Set listLessons=true to see what's already recorded. " +
      "Duplicate lessons are detected and skipped automatically.",
    parameters: LearnParams,
    execute: async (_id, params) => {
      try {
        const lessonsPath = join(knowledgeDir, "lessons.md");
        mkdirSync(knowledgeDir, { recursive: true });

        // ── List mode ──────────────────────────────────────────────
        if (params.listLessons) {
          if (!existsSync(lessonsPath)) {
            return textResult("No lessons recorded yet.");
          }
          const content = readFileSync(lessonsPath, "utf-8");
          return textResult(content);
        }

        // ── Add mode ───────────────────────────────────────────────
        if (!params.lesson) {
          return textResult("Error: 'lesson' parameter is required when adding a lesson.");
        }

        const category = (params.category ?? "general").toLowerCase().trim();
        const ts = new Date().toISOString().slice(0, 16).replace("T", " ");
        const entry = `- ${ts}: ${params.lesson}`;

        // Load existing lessons or start fresh
        let categories: Map<string, string[]>;
        if (existsSync(lessonsPath)) {
          const content = readFileSync(lessonsPath, "utf-8");
          categories = parseLessons(content);
        } else {
          categories = new Map();
        }

        // Dedup check
        if (isDuplicate(categories, params.lesson)) {
          return textResult("Lesson already exists (duplicate skipped).");
        }

        // Add to the right category
        if (!categories.has(category)) {
          categories.set(category, []);
        }
        categories.get(category)!.push(entry);

        // Write back
        writeFileSync(lessonsPath, serializeLessons(categories), "utf-8");

        return textResult("Lesson recorded.");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult(`Error: ${msg}`);
      }
    },
  };
}
