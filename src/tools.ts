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

export function createReadTool(options?: ReadToolOptions): AgentTool<typeof ReadParams> {
  return {
    name: "read",
    label: "Read File",
    description: "Read the contents of a file.",
    parameters: ReadParams,
    execute: async (_id, params) => {
      // Resolve path: relative → projectRoot-based, hallucinated → rewritten, correct → as-is
      const effectivePath = options?.projectRoot
        ? resolveReadPath(params.path, options.projectRoot)
        : params.path;

      try {
        const content = readFileSync(effectivePath, "utf-8");
        return textResult(content);
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
        mkdirSync(dirname(effectivePath), { recursive: true });
        writeFileSync(effectivePath, params.content, "utf-8");
        return textResult(`Wrote ${params.content.length} bytes to ${effectivePath}`);
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
export function truncateOutput(output: string, maxLen: number): string {
  if (!maxLen || maxLen === Infinity || output.length <= maxLen) return output;

  // Reserve space for the marker line itself (~80 chars)
  const markerReserve = 80;
  const available = maxLen - markerReserve;
  if (available <= 0) return output.slice(0, maxLen);

  const headLen = Math.floor(available * 0.6);
  const tailLen = available - headLen;

  const head = output.slice(0, headLen);
  const tail = output.slice(output.length - tailLen);
  const omitted = output.length - headLen - tailLen;

  const marker = `\n\n... [${omitted.toLocaleString()} characters truncated] ...\n\n`;

  return head + marker + tail;
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
        const output = execSync(command, {
          cwd: effectiveCwd,
          encoding: "utf-8",
          timeout,
          maxBuffer: 1024 * 1024,
          stdio: ["pipe", "pipe", "pipe"],
        });
        const result = output || "(no output)";
        return textResult(cwdPrefix + truncateOutput(result, maxOutputLength) + outsideWarning);
      } catch (err: unknown) {
        if (err && typeof err === "object" && "stdout" in err) {
          const e = err as { stdout: string; stderr: string; status: number };
          const output = [e.stdout, e.stderr].filter(Boolean).join("\n");
          return textResult(`${cwdPrefix}Exit code ${e.status}\n${truncateOutput(output, maxOutputLength)}${outsideWarning}`);
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
