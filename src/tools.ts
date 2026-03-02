import { Type } from "@mariozechner/pi-ai";
import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import { readFileSync, writeFileSync, appendFileSync, mkdirSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, resolve, join } from "node:path";
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

export function createReadTool(options?: ReadToolOptions): AgentTool<typeof ReadParams> {
  return {
    name: "read",
    label: "Read File",
    description: "Read the contents of a file.",
    parameters: ReadParams,
    execute: async (_id, params) => {
      try {
        const content = readFileSync(params.path, "utf-8");
        return textResult(content);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const hint = options?.projectRoot && msg.includes("ENOENT")
          ? `\nHint: project root is ${options.projectRoot} — use paths relative to it, e.g. src/manager.ts not /home/user/repos/.../src/manager.ts`
          : "";
        return textResult(`Error reading file: ${msg}${hint}`);
      }
    },
  };
}

export function createWriteTool(): AgentTool<typeof WriteParams> {
  return {
    name: "write",
    label: "Write File",
    description: "Write content to a file. Creates parent directories if needed.",
    parameters: WriteParams,
    execute: async (_id, params) => {
      try {
        mkdirSync(dirname(params.path), { recursive: true });
        writeFileSync(params.path, params.content, "utf-8");
        return textResult(`Wrote ${params.content.length} bytes to ${params.path}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult(`Error writing file: ${msg}`);
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
}

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
 * Agents frequently emit commands like `cd /home/hao/may-agent && git log`
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

  return {
    name: "exec",
    label: "Execute Command",
    description: "Execute a shell command. Returns stdout and stderr.",
    parameters: ExecParams,
    execute: async (_id, params) => {
      // Strip redundant `cd <cwd> && ` prefix — the cwd is already set
      const command = stripRedundantCd(params.command, effectiveCwd);

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
        return textResult(cwdPrefix + result + outsideWarning);
      } catch (err: unknown) {
        if (err && typeof err === "object" && "stdout" in err) {
          const e = err as { stdout: string; stderr: string; status: number };
          const output = [e.stdout, e.stderr].filter(Boolean).join("\n");
          return textResult(`${cwdPrefix}Exit code ${e.status}\n${output}${outsideWarning}`);
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
  lesson: Type.String({ description: "What you learned. Be specific and actionable." }),
});

/**
 * Create a tool that appends a lesson to the agent's knowledge/lessons.md.
 *
 * This is a dumb append — no consolidation, no dedup. The maintainer
 * agent handles cleanup later. The point is fast capture: when the user
 * corrects you or you discover something, write it down immediately.
 *
 * @param knowledgeDir - path to the agent's knowledge/ directory
 */
export function createLearnTool(knowledgeDir: string): AgentTool<typeof LearnParams> {
  return {
    name: "learn",
    label: "Learn",
    description:
      "Record a lesson. Use when: the user corrects you, you discover " +
      "something useful, or you find a better approach. Lessons persist " +
      "across sessions.",
    parameters: LearnParams,
    execute: async (_id, params) => {
      try {
        const lessonsPath = join(knowledgeDir, "lessons.md");
        mkdirSync(knowledgeDir, { recursive: true });

        const ts = new Date().toISOString().slice(0, 16).replace("T", " ");
        const entry = `- ${ts}: ${params.lesson}\n`;

        if (!existsSync(lessonsPath)) {
          writeFileSync(lessonsPath, `# Lessons\n\n---\n\n${entry}`, "utf-8");
        } else {
          appendFileSync(lessonsPath, entry, "utf-8");
        }

        return textResult("Lesson recorded.");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return textResult(`Error: ${msg}`);
      }
    },
  };
}
