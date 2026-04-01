/**
 * Supply-chain hardening utilities (P78).
 *
 * Provides static analysis scanning and best-effort sandboxed execution
 * for skill/tool code submitted to the system.
 *
 * Uses only Node.js built-in modules — no external dependencies.
 */

import { createContext, runInNewContext } from "node:vm";

// ── Interfaces ────────────────────────────────────────────────────────

/** Result of a static scan over skill/tool source code. */
export interface ScanResult {
  /** `true` when no dangerous patterns were detected. */
  safe: boolean;
  /** Human-readable descriptions of every detected pattern. */
  warnings: string[];
}

/** Result of a sandboxed execution attempt. */
export interface SandboxResult {
  /** `true` when the code ran to completion without error. */
  success: boolean;
  /** Captured console.log output (newline-joined), present on success. */
  output?: string;
  /** Error message, present on failure. */
  error?: string;
}

// ── Pattern catalogue ─────────────────────────────────────────────────

interface DangerPattern {
  /** RegExp to test against the source code. */
  pattern: RegExp;
  /** Warning string emitted when the pattern matches. */
  message: string;
}

const DANGER_PATTERNS: DangerPattern[] = [
  // Dynamic code execution
  { pattern: /\beval\s*\(/, message: "Dynamic code execution: eval()" },
  { pattern: /\bnew\s+Function\s*\(/, message: "Dynamic code execution: new Function()" },
  { pattern: /(?<!\bnew\s)\bFunction\s*\(/, message: "Dynamic code execution: Function()" },

  // Shell execution
  { pattern: /\bchild_process\b/, message: "Shell execution: child_process module" },
  { pattern: /\bexecSync\s*\(/, message: "Shell execution: execSync()" },
  { pattern: /\bspawnSync\s*\(/, message: "Shell execution: spawnSync()" },
  { pattern: /\bexec\s*\(/, message: "Shell execution: exec()" },

  // Environment variable access
  { pattern: /\bprocess\.env\b/, message: "Environment variable access: process.env" },

  // Dynamic CJS imports
  { pattern: /\brequire\s*\(/, message: "Dynamic import: require()" },

  // Destructive filesystem operations — match both `fs.xxxSync` and bare `xxxSync(`
  // to catch destructured imports like `import { unlinkSync } from "fs"`.
  { pattern: /\bwriteFileSync\b/, message: "Destructive filesystem op: writeFileSync" },
  { pattern: /\bunlinkSync\b/, message: "Destructive filesystem op: unlinkSync" },
  { pattern: /\brmSync\b/, message: "Destructive filesystem op: rmSync" },
  { pattern: /\brmdirSync\b/, message: "Destructive filesystem op: rmdirSync" },

  // Network access
  { pattern: /\bfetch\s*\(/, message: "Network access: fetch()" },
  { pattern: /\bhttp\.request\b/, message: "Network access: http.request" },
  { pattern: /\bhttps\.request\b/, message: "Network access: https.request" },
  { pattern: /\bnet\.connect\b/, message: "Network access: net.connect" },

  // Path traversal via __dirname / __filename combined with ..
  {
    pattern: /(?:__dirname|__filename)[\s\S]{0,40}\.\./,
    message: "Path traversal: __dirname/__filename combined with ..",
  },
  {
    pattern: /\.\.[\s\S]{0,40}(?:__dirname|__filename)/,
    message: "Path traversal: .. combined with __dirname/__filename",
  },
];

/**
 * Regex to detect import/require of a module that is *not*:
 *  - a relative path (starts with `.` or `..`)
 *  - a Node.js built-in (prefixed `node:`)
 *  - a known allowed package
 *
 * We match:
 *   import … from "<specifier>"
 *   import("<specifier>")
 *   require("<specifier>")
 */
const EXTERNAL_IMPORT_RE =
  /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g;

/**
 * Packages considered safe / known.
 *
 * Only includes benign Node built-ins and project tooling.
 * Dangerous modules like `child_process`, `net`, `fs`, `http`, `https`
 * are deliberately excluded — importing them generates an
 * "External import" warning (on top of any danger-pattern hits).
 */
const KNOWN_PACKAGES = new Set([
  "vitest",
  "typescript",
  // Benign Node built-ins
  "path",
  "os",
  "util",
  "assert",
  "events",
  "stream",
  "crypto",
  "url",
  "querystring",
  "zlib",
  "buffer",
  "vm",
  "string_decoder",
  "perf_hooks",
  "worker_threads",
]);

/**
 * Check whether a module specifier is an outside-project import.
 * Returns `true` if the specifier looks external and is not in the allowlist.
 */
function isExternalSpecifier(specifier: string): boolean {
  if (specifier.startsWith(".") || specifier.startsWith("/")) return false;
  if (specifier.startsWith("node:")) return false;
  // Strip subpath for scoped and unscoped packages
  const pkg = specifier.startsWith("@")
    ? specifier.split("/").slice(0, 2).join("/")
    : specifier.split("/")[0];
  return !KNOWN_PACKAGES.has(pkg);
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Statically scan skill/tool source code for dangerous patterns.
 *
 * @param code - The source code string to analyse.
 * @returns A {@link ScanResult} indicating whether the code is safe.
 *
 * @example
 * ```ts
 * const result = scanSkill("const x = 1;");
 * // { safe: true, warnings: [] }
 * ```
 */
export function scanSkill(code: string): ScanResult {
  const warnings: string[] = [];

  // Check every pattern in the catalogue
  for (const { pattern, message } of DANGER_PATTERNS) {
    if (pattern.test(code)) {
      warnings.push(message);
    }
  }

  // Check for external (outside-project) imports
  let match: RegExpExecArray | null;
  // Reset lastIndex since EXTERNAL_IMPORT_RE is global
  EXTERNAL_IMPORT_RE.lastIndex = 0;
  while ((match = EXTERNAL_IMPORT_RE.exec(code)) !== null) {
    const specifier = match[1];
    if (isExternalSpecifier(specifier)) {
      warnings.push(`External import: "${specifier}"`);
    }
  }

  return { safe: warnings.length === 0, warnings };
}

/** Sandbox execution timeout in milliseconds. */
const SANDBOX_TIMEOUT_MS = 5_000;

/**
 * Execute code in a best-effort sandbox using `node:vm`.
 *
 * The sandbox provides **no** access to `require`, `process`, `fs`,
 * `child_process`, or other Node.js globals. Console output is captured
 * and returned as {@link SandboxResult.output}.
 *
 * @param code - JavaScript code to execute (must be valid JS, not TS).
 * @returns A {@link SandboxResult} with captured output or error.
 *
 * @example
 * ```ts
 * const result = sandboxExecute("console.log(1 + 1)");
 * // { success: true, output: "2" }
 * ```
 */
export function sandboxExecute(code: string): SandboxResult {
  const lines: string[] = [];

  // Build a minimal sandbox context — intentionally sparse.
  const sandbox: Record<string, unknown> = {
    console: {
      log: (...args: unknown[]) => {
        lines.push(args.map(String).join(" "));
      },
    },
    // Provide safe globals that most JS expects
    Array,
    Boolean,
    Date,
    Error,
    JSON,
    Map,
    Math,
    Number,
    Object,
    Promise,
    RegExp,
    Set,
    String,
    Symbol,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    undefined,
    NaN,
    Infinity,
  };

  const context = createContext(sandbox);

  try {
    runInNewContext(code, context, {
      timeout: SANDBOX_TIMEOUT_MS,
      filename: "sandbox.js",
    });
    return { success: true, output: lines.join("\n") };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}
