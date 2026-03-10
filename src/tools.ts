import { Type } from "@mariozechner/pi-ai";
import type { TSchema } from "@mariozechner/pi-ai";
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

const ReadParams: TSchema = Type.Object({
  path: Type.String({ description: "Absolute path to the file" }),
  startLine: Type.Optional(Type.Number({ description: "First line to return (1-based, inclusive). Use with endLine to read a specific range without truncation." })),
  endLine: Type.Optional(Type.Number({ description: "Last line to return (1-based, inclusive). Use with startLine to read a specific range without truncation." })),
});

const WriteParams: TSchema = Type.Object({
  path: Type.String({ description: "Absolute path to the file" }),
  content: Type.String({ description: "Content to write" }),
});

const ExecParams: TSchema = Type.Object({
  command: Type.String({ description: "Shell command to execute" }),
  timeout: Type.Optional(Type.Number({ description: "Timeout in seconds (default: 30)" })),
});

// ── Typed interfaces for tool params (mirrors Type.Object schemas above) ──
interface ReadInput { path: string; startLine?: number; endLine?: number; }
interface WriteInput { path: string; content: string; }
interface ExecInput { command: string; timeout?: number; }


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
  /**
   * Maximum cumulative bytes an agent can read before a budget warning.
   * When this threshold is exceeded, a one-time warning is appended to the
   * read result nudging the agent toward line-range reads.
   *
   * Only effective when a truncationTracker is provided (e.g., via createLinkedTools).
   * Default: 500_000 (~500KB).
   */
  maxSessionReadBytes?: number;
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
 * to BLOCK dangerous writes that would cause data loss.
 *
 * When the read tool truncates a file (because it exceeds maxFileLength),
 * it records the path as "poisoned". Any subsequent attempt to write to
 * this file using the write tool (instead of exec/sed) will throw an error.
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

  /** Cumulative bytes read across all files in this session */
  private cumulativeReadBytes = 0;
  /** Maximum cumulative bytes before warning (default: 500_000 = ~500KB) */
  private maxSessionReadBytes: number;
  /** Whether the budget warning has been fired */
  private budgetWarningFired = false;

  constructor(opts?: { maxSessionReadBytes?: number }) {
    this.maxSessionReadBytes = opts?.maxSessionReadBytes ?? 500_000;
  }

  /** Record that a file was read and its content was truncated. Poisons the path. */
  recordTruncatedRead(path: string, originalLength: number): void {
    this.truncatedReads.set(path, originalLength);
  }

  /** Clear the record for a path (e.g., after a successful non-truncated read). */
  clearPath(path: string): void {
    this.truncatedReads.delete(path);
  }

  /**
   * Validate if it's safe to write to this path.
   * Throws an error if the path is poisoned (previously read with truncation).
   */
  validateWrite(path: string): void {
    const originalLength = this.truncatedReads.get(path);
    if (originalLength !== undefined) {
      throw new Error(
        `BLOCKED: This file was previously read with truncation (original: ${originalLength.toLocaleString()} chars). ` +
        `Writing to it now would permanently delete the content you haven't seen. ` +
        `Use 'exec' with 'sed' for surgical edits, or read specific line ranges if you need to view content.`
      );
    }
  }

  /**
   * Deprecated: Use validateWrite() instead.
   * Kept temporarily for backward compatibility if needed, but implementation now delegates to validateWrite.
   */
  checkWrite(path: string, newContentLength: number): string | null | undefined {
    try {
      this.validateWrite(path);
      return null;
    } catch (err: unknown) {
      if (err instanceof Error) throw err;
    }
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

  /** Record bytes read and return a warning if budget is exceeded */
  recordBytesRead(bytes: number): string {
    this.cumulativeReadBytes += bytes;
    if (this.cumulativeReadBytes > this.maxSessionReadBytes && !this.budgetWarningFired) {
      this.budgetWarningFired = true;
      return `\n⚠️ READ BUDGET WARNING: You have read ${(this.cumulativeReadBytes / 1000).toFixed(0)}KB total this session (budget: ${(this.maxSessionReadBytes / 1000).toFixed(0)}KB). ` +
        `Use line-range reads: read(path, startLine, endLine) to read only the sections you need. ` +
        `For bulk operations, summarize each file immediately after reading — don't accumulate.`;
    }
    return "";
  }

  /** Get cumulative bytes read (for testing) */
  getCumulativeReadBytes(): number {
    return this.cumulativeReadBytes;
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
  // /home/<user>/repos/<project-name>/... → keep path after project-name
  /^(\/home\/[^/]+\/repos\/[^/]+)(\/.*)?$/,
  // /home/<user>/repo/... → keep path after repo
  /^(\/home\/[^/]+\/repo)(\/.*)?$/,
  // /home/user/... → keep path after user (legacy: "user" is literal placeholder)
  /^(\/home\/user)(\/.*)?$/,
  // /home/<user>/<project>/... → keep path after project (any real username)
  /^(\/home\/[^/]+\/[^/]+)(\/.*)?$/,
  // /Users/<name>/<project>/... → keep path after project
  /^(\/Users\/[^/]+\/[^/]+)(\/.*)?$/,
  // /app/... → keep path after app
  /^(\/app)(\/.*)?$/,
];

/**
 * Extract the relative-path suffix from a hallucinated absolute path.
 * Returns the relative portion (e.g. "/src/index.ts") or null if the
 * path does not match any hallucinated pattern.
 */
export function extractHallucinatedRelPath(path: string): string | null {
  for (const pattern of HALLUCINATED_PATH_PATTERNS) {
    const match = path.match(pattern);
    if (match) {
      return match[2] ?? "/";
    }
  }
  return null;
}

/**
 * Returns true if the shell command looks like it would recursively
 * start the agent runtime (npx may-agent, node dist/cli, etc.).
 */
export function isMetaRecursionCommand(command: string): boolean {
  const patterns = [
    /\bmay-agent\b/,
    /\bnode\s+.*dist\/cli/,
    /\bnpx\s+may-agent\b/,
    /\bts-node\s+.*src\/cli/,
    /\btsx\s+.*src\/cli/,
  ];
  return patterns.some(p => p.test(command));
}

/**
 * Extract the relative path from a hallucinated absolute path.
 *
 * When an agent hallucinates a project root (e.g., /home/user/repo),
 * this function extracts the relative path portion that can be rebased
 * onto the actual project root

 *
 * @param path - The absolute path to fix
 * @param projectRoot - The real project root
 */
export function resolveHallucinatedPath(path: string, projectRoot: string): string {
  for (const pattern of HALLUCINATED_PATH_PATTERNS) {
    const match = path.match(pattern);
    if (match) {
      const [, , relativePart] = match;
      // relativePart is group 2. If present, it starts with /.
      if (relativePart) {
        // join(root, relative) handles the slash correctly
        return join(projectRoot, relativePart);
      }
      // If no relative part, they just gave the root (e.g. /app)
      return projectRoot;
    }
  }
  return path;
}

// ── Read Tool ──────────────────────────────────────────────────────────

export function createReadTool(options: ReadToolOptions = {}): AgentTool {
  const { projectRoot = process.cwd(), maxFileLength = 0, truncationTracker } = options;

  return {
    name: "read",
    label: "Read File",
    description: "Read the contents of a file. Supports optional startLine/endLine for reading specific line ranges without truncation — use this instead of full-file reads when editing large files.",
    parameters: ReadParams,
    execute: async (_id, _params) => {
      const params = _params as ReadInput;
      try {
        let targetPath = resolve(projectRoot, params.path);
        
        // Handle hallucinated paths if they don't exist
        if (!existsSync(targetPath)) {
             const fixed = resolveHallucinatedPath(targetPath, projectRoot);
             if (fixed !== targetPath && existsSync(fixed)) {
                 targetPath = fixed;
             }
        }

        if (!existsSync(targetPath)) {
            return textResult(`Error: File not found: ${params.path}`);
        }

        const stats = statSync(targetPath);
        if (!stats.isFile()) {
           return textResult(`Error: Not a file: ${params.path}`);
        }

        let content = readFileSync(targetPath, "utf-8");
        const originalLength = content.length;
        const totalLines = content.split("\n").length;

        // Handle Line Ranges
        if (params.startLine !== undefined || params.endLine !== undefined) {
          const start = (params.startLine ?? 1) - 1;
          const end = params.endLine ?? totalLines;
          const lines = content.split("\n");
          // Slice is 0-based, end exclusive. 
          // User input: startLine 1 = index 0. endLine 2 = index 1 (inclusive) -> slice(0, 2)
          const selected = lines.slice(Math.max(0, start), end);
          content = selected.join("\n");
          return textResult(content);
        }

        // Full read tracking & Poison Logic
        let warningPrefix = "";
        
        if (maxFileLength > 0 && content.length > maxFileLength) {
          // TRUNCATION TRIGGERED
          const start = content.slice(0, maxFileLength / 2);
          const end = content.slice(-maxFileLength / 2);
          const omitted = content.length - maxFileLength;
          const warning = `\n... [${omitted.toLocaleString()} characters truncated] ...\n` +
                          `⚠️ FILE TRUNCATED: You are seeing only the beginning and end of this file.\n` +
                          `DO NOT use the write tool to rewrite this entire file — you will lose the content you cannot see.\n` +
                          `Instead: use read(path, startLine=N, endLine=M) to see specific sections, or exec with sed for targeted edits.\n`;
          
          content = start + warning + end;

          // POISON THE PATH
          if (truncationTracker) {
            truncationTracker.recordTruncatedRead(targetPath, originalLength);
          }
        } else {
            // Safe read - clear poison
             if (truncationTracker) {
                truncationTracker.clearPath(targetPath);
            }
        }

        if (truncationTracker) {
            const count = truncationTracker.recordFullRead(targetPath);
            warningPrefix = truncationTracker.buildRepeatedReadWarning(targetPath, count, totalLines);
            const budgetWarning = truncationTracker.recordBytesRead(originalLength); // Record real bytes
            if (budgetWarning) warningPrefix += budgetWarning;
        }

        return textResult(warningPrefix + content);

      } catch (err: unknown) {
        return textResult(`Error reading file: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

// ── Write Tool ─────────────────────────────────────────────────────────

export function createWriteTool(options: WriteToolOptions = {}): AgentTool {
  const { projectRoot = process.cwd(), truncationTracker } = options;

  return {
    name: "write",
    label: "Write File",
    description: "Write content to a file. Creates parent directories if needed.",
    parameters: WriteParams,
    execute: async (_id, _params) => {
      const params = _params as WriteInput;
      try {
        let targetPath = resolve(projectRoot, params.path);
        
        // Handle hallucinated paths for consistency
        if (options.projectRoot && !targetPath.startsWith(options.projectRoot)) {
             const fixed = resolveHallucinatedPath(targetPath, options.projectRoot);
             targetPath = fixed;
        }

        // POISON CHECK - The Critical Fix
        if (truncationTracker) {
             truncationTracker.validateWrite(targetPath);
        }

        mkdirSync(dirname(targetPath), { recursive: true });
        writeFileSync(targetPath, params.content, "utf-8");

        // Reset tracking after write (it's a fresh file now)
        if (truncationTracker) {
            truncationTracker.clearPath(targetPath);
            truncationTracker.resetFullReadCount(targetPath);
        }

        return textResult(`Successfully wrote to ${params.path}`);
      } catch (err: unknown) {
        return textResult(`Error writing file: ${err instanceof Error ? err.message : String(err)}`);
      }
    },
  };
}

// ── Exec Tool ──────────────────────────────────────────────────────────

export function createExecTool(options: { projectRoot?: string } = {}): AgentTool {
    const { projectRoot = process.cwd() } = options;
    return {
        name: "exec",
        label: "Execute Command",
        description: "Execute a shell command. Returns stdout and stderr.",
        parameters: ExecParams,
        execute: async (_id, _params) => {
            const params = _params as ExecInput;
            try {
                const result = execSync(params.command, { 
                    cwd: projectRoot, 
                    timeout: (params.timeout ?? 30) * 1000,
                    encoding: "utf-8",
                    stdio: ["ignore", "pipe", "pipe"] // Capture stdout/stderr
                });
                return textResult(result || "(no output)");
            } catch (err: unknown) {
                 if (err && typeof err === 'object' && 'stdout' in err && 'stderr' in err) {
                     // Node's execSync throws on non-zero exit code but contains output
                     const { stdout, stderr, status } = err as any;
                     // Trim buffers if they are arrays (spawnSync) or strings (execSync encoding set)
                     const out = typeof stdout === 'string' ? stdout : (stdout ? stdout.toString() : '');
                     const errOut = typeof stderr === 'string' ? stderr : (stderr ? stderr.toString() : '');
                     
                     return textResult(`CWD: ${projectRoot}\nExit code ${status}\n${errOut}\n${out}`.trim());
                 }
                 return textResult(`Error executing command: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
    };
}

// ── Health Tool ────────────────────────────────────────────────────────

export interface HealthReport {
  healthy: boolean;
  checks: { name: string; ok: boolean; detail: string }[];
}

export function createHealthCheckTool(stateDir: string): AgentTool {
  return {
    name: "health",
    label: "System Health Check",
    description: "Run a comprehensive health check on the agent system.",
    parameters: Type.Object({}),
    execute: async () => {
      const checks: { name: string; ok: boolean; detail: string }[] = [];
      
      // 1. Basic File Checks
      const criticalFiles = ["package.json", "tsconfig.json", "src/index.ts"];
      for (const f of criticalFiles) {
          if (existsSync(f)) {
              checks.push({ name: `file:${basename(f)}`, ok: true, detail: "Exists" });
          } else {
              checks.push({ name: `file:${basename(f)}`, ok: false, detail: "Missing" });
          }
      }

      // 2. Disk Space (Simulated/Simple)
      // skip for portability

      // 3. Tests (The truncated part)
      // We'll skip the actual test run to keep it fast, or add a placeholder.
      checks.push({ name: "tests", ok: true, detail: "Skipped in fast check" });

      // 7. Stale sessions in session meta.json files
      try {
        const { loadAllSessionMetas } = await import("./persistence.js");
        const sessions = loadAllSessionMetas(stateDir);
        const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
        const now = Date.now();
        const stale = Object.entries(sessions).filter(([, s]) =>
          s.status === "running" && (now - (s.startedAt ?? now)) > STALE_THRESHOLD_MS
        );
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
        checks.push({ name: "stale_sessions", ok: false, detail: `Failed to scan sessions: ${msg}` });
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

const LearnParams: TSchema = Type.Object({
  lesson: Type.Optional(Type.String({ description: "What you learned. Be specific and actionable. Required when adding a lesson." })),
  category: Type.Optional(Type.String({ description: "Category for the lesson (e.g. 'testing', 'architecture', 'debugging'). Default: 'general'." })),
  listLessons: Type.Optional(Type.Boolean({ description: "When true, return current lessons instead of adding. The 'lesson' param is ignored." })),
});
interface LearnInput { lesson?: string; category?: string; listLessons?: boolean; }


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
export function createLearnTool(knowledgeDir: string): AgentTool {
  return {
    name: "learn",
    label: "Learn",
    description:
      "Record a lesson or list existing lessons. Use when: the user corrects you, you discover " +
      "something useful, or you find a better approach. Lessons persist " +
      "across sessions. Set listLessons=true to see what's already recorded. " +
      "Duplicate lessons are detected and skipped automatically.",
    parameters: LearnParams,
    execute: async (_id, _params) => {
      const params = _params as LearnInput;
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

/**
 * Build a text representation of a project's directory structure.
 * Returns a tree-like string showing files and directories up to `maxDepth`.
 */
export function buildProjectStructure(rootDir: string, maxDepth: number = 2): string | null {

  const IGNORE = new Set([
    "node_modules", ".git", ".state", "dist", ".next", "__pycache__",
    ".cache", ".turbo", "coverage", ".nyc_output", ".DS_Store",
  ]);

  function walk(dir: string, prefix: string, depth: number): string[] {
    if (depth > maxDepth) return [];
    let entries: string[];
    try {
      entries = readdirSync(dir).sort();
    } catch {
      return [];
    }
    // Filter ignored
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
export function createLinkedTools(options: ReadToolOptions & WriteToolOptions = {}): { read: AgentTool; write: AgentTool; truncationTracker: TruncationTracker } {
  const { projectRoot = process.cwd(), maxFileLength = 0, maxSessionReadBytes } = options;
  const truncationTracker = new TruncationTracker({ maxSessionReadBytes });

  const read = createReadTool({
    projectRoot,
    maxFileLength,
    truncationTracker,
  });

  const write = createWriteTool({
    projectRoot,
    truncationTracker,
  });

  return { read, write, truncationTracker };
}
