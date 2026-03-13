/**
 * Agent Gym Harness — Adversarial Scenario Testing
 *
 * Provides utilities to:
 * 1. Fork a fixture to a temp directory
 * 2. Run detection/fix logic against it
 * 3. Verify the outcome
 *
 * Design: P80 Environment Diversity + P13 Harness Engineering
 */

import { mkdtempSync, cpSync, rmSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync, type ExecSyncOptionsWithStringEncoding } from "node:child_process";

const FIXTURES_DIR = join(import.meta.dirname, "fixtures");

export interface ScenarioResult {
  /** Scenario name */
  name: string;
  /** Whether the detection/fix was successful */
  passed: boolean;
  /** What the harness detected */
  detection: string;
  /** Path to the temp directory (cleaned up after test) */
  workDir: string;
  /** Duration in ms */
  durationMs: number;
}

/**
 * Fork a fixture directory to a fresh temp directory.
 * Returns the temp dir path. Caller is responsible for cleanup.
 */
export function forkScenario(scenarioName: string): string {
  const fixtureDir = join(FIXTURES_DIR, scenarioName);
  if (!existsSync(fixtureDir)) {
    throw new Error(`Fixture not found: ${fixtureDir}`);
  }

  const tempDir = mkdtempSync(join(tmpdir(), `gym-${scenarioName}-`));
  cpSync(fixtureDir, tempDir, { recursive: true });
  return tempDir;
}

/**
 * Clean up a forked scenario directory.
 */
export function cleanupScenario(workDir: string): void {
  if (existsSync(workDir)) {
    rmSync(workDir, { recursive: true, force: true });
  }
}

/**
 * Run a Node.js file in the scenario directory with a timeout.
 * Returns { stdout, stderr, exitCode }.
 */
export function runWithTimeout(
  workDir: string,
  entryFile: string,
  timeoutMs: number = 3000
): { stdout: string; stderr: string; exitCode: number } {
  const opts: ExecSyncOptionsWithStringEncoding = {
    cwd: workDir,
    timeout: timeoutMs,
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  };

  try {
    const stdout = execSync(`node ${entryFile}`, opts);
    return { stdout: stdout || "", stderr: "", exitCode: 0 };
  } catch (err: any) {
    // execSync throws on non-zero exit or timeout
    // When killed by timeout: status=null, signal=SIGTERM
    const timedOut = err.signal === "SIGTERM" || err.killed === true;
    return {
      stdout: err.stdout || "",
      stderr: err.stderr || "",
      exitCode: timedOut ? 124 : (err.status ?? 1),
    };
  }
}

/**
 * Detect circular dependencies in a JS project by analyzing require() calls.
 * Returns the cycle chain if found, or null if no cycle.
 */
export function detectCircularDependency(workDir: string): string[] | null {
  const files = readdirSync(workDir).filter((f) => f.endsWith(".js"));
  const graph = new Map<string, string[]>();

  for (const file of files) {
    const content = readFileSync(join(workDir, file), "utf-8");
    const requires: string[] = [];
    const requireRegex = /require\(["']\.\/([^"']+)["']\)/g;
    let match;
    while ((match = requireRegex.exec(content)) !== null) {
      const dep = match[1].endsWith(".js") ? match[1] : match[1] + ".js";
      requires.push(dep);
    }
    graph.set(file, requires);
  }

  // DFS cycle detection
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const path: string[] = [];

  function dfs(node: string): string[] | null {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      return [...path.slice(cycleStart), node];
    }
    if (visited.has(node)) return null;

    visited.add(node);
    inStack.add(node);
    path.push(node);

    for (const dep of graph.get(node) || []) {
      const cycle = dfs(dep);
      if (cycle) return cycle;
    }

    path.pop();
    inStack.delete(node);
    return null;
  }

  for (const file of graph.keys()) {
    const cycle = dfs(file);
    if (cycle) return cycle;
  }

  return null;
}

/**
 * Detect missing file imports in a JS project.
 * Returns list of { file, missingImport } pairs.
 */
export function detectMissingFiles(workDir: string): Array<{ file: string; missingImport: string }> {
  const files = readdirSync(workDir).filter((f) => f.endsWith(".js"));
  const missing: Array<{ file: string; missingImport: string }> = [];

  for (const file of files) {
    const content = readFileSync(join(workDir, file), "utf-8");
    const requireRegex = /require\(["']\.\/([^"']+)["']\)/g;
    let match;
    while ((match = requireRegex.exec(content)) !== null) {
      const dep = match[1];
      const depPath = dep.endsWith(".js") ? dep : dep + ".js";
      if (!existsSync(join(workDir, depPath))) {
        missing.push({ file, missingImport: dep });
      }
    }
  }

  return missing;
}

/**
 * Detect if a script hangs (infinite loop) by running it with a short timeout.
 * Returns true if the process was killed due to timeout.
 */
export function detectInfiniteLoop(workDir: string, entryFile: string, timeoutMs: number = 2000): boolean {
  const result = runWithTimeout(workDir, entryFile, timeoutMs);
  // exitCode 124 indicates the process was killed due to timeout
  return result.exitCode === 124;
}

/**
 * Detect permission-denied errors by checking if a file is read-only
 * when the program needs to write to it.
 * Returns { hasPermissionIssue, file } if the target file is not writable.
 */
export function detectPermissionDenied(
  workDir: string,
  entryFile: string
): { hasPermissionIssue: boolean; file: string; error: string } {
  const result = runWithTimeout(workDir, entryFile, 3000);
  if (result.exitCode !== 0 && result.stderr.includes("EACCES")) {
    // Extract the file path from the error message
    const match = result.stderr.match(/open '([^']+)'/);
    return {
      hasPermissionIssue: true,
      file: match ? match[1] : "unknown",
      error: result.stderr.trim(),
    };
  }
  return { hasPermissionIssue: false, file: "", error: "" };
}

/**
 * Detect a broken/flaky tool by running the build and checking for
 * tool-specific error patterns (SEGFAULT, internal compiler error, etc).
 * Returns { isBroken, errorPattern, failedSource }.
 */
export function detectBrokenTool(
  workDir: string,
  entryFile: string
): { isBroken: boolean; errorPattern: string; failedSource: string } {
  const result = runWithTimeout(workDir, entryFile, 3000);
  if (result.exitCode !== 0) {
    const errText = result.stderr;
    const match = errText.match(/Build failed on (\S+): (.+)/);
    if (match) {
      return { isBroken: true, errorPattern: match[2], failedSource: match[1] };
    }
    // Check for generic flaky patterns
    if (errText.includes("SEGFAULT") || errText.includes("internal compiler error")) {
      return { isBroken: true, errorPattern: "SEGFAULT", failedSource: "" };
    }
  }
  return { isBroken: false, errorPattern: "", failedSource: "" };
}

/**
 * Detect resource exhaustion (e.g., too many temp files, disk full simulation).
 * Returns { isExhausted, resource, message }.
 */
export function detectResourceExhaustion(
  workDir: string,
  entryFile: string
): { isExhausted: boolean; resource: string; message: string } {
  const result = runWithTimeout(workDir, entryFile, 3000);
  if (result.exitCode !== 0) {
    const errText = result.stderr;
    if (errText.includes("DISK_FULL") || errText.includes("storage exhausted")) {
      return { isExhausted: true, resource: "disk", message: errText.trim() };
    }
    if (errText.includes("RATE_LIMIT") || errText.includes("Too Many Requests")) {
      return { isExhausted: true, resource: "api", message: errText.trim() };
    }
  }
  return { isExhausted: false, resource: "", message: "" };
}

/**
 * Detect conflicting configuration by checking if two config sources
 * have contradictory values for the same keys.
 * Returns { hasConflict, conflicts } with details of each mismatch.
 */
export function detectConfigConflict(
  workDir: string
): { hasConflict: boolean; conflicts: Array<{ key: string; valueA: unknown; valueB: unknown }> } {
  const conflicts: Array<{ key: string; valueA: unknown; valueB: unknown }> = [];

  // Look for pairs of config-like JSON files
  const jsonFiles = readdirSync(workDir).filter(
    (f) => f.endsWith(".json") && f !== "package.json"
  );
  if (jsonFiles.length < 2) return { hasConflict: false, conflicts };

  const configs: Array<{ name: string; data: Record<string, unknown> }> = [];
  for (const f of jsonFiles) {
    try {
      const data = JSON.parse(readFileSync(join(workDir, f), "utf-8"));
      configs.push({ name: f, data });
    } catch {
      // Skip unparseable files
    }
  }

  // Compare all pairs
  for (let i = 0; i < configs.length; i++) {
    for (let j = i + 1; j < configs.length; j++) {
      const a = configs[i].data;
      const b = configs[j].data;
      for (const key of Object.keys(a)) {
        if (key in b && JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
          conflicts.push({ key, valueA: a[key], valueB: b[key] });
        }
      }
    }
  }

  return { hasConflict: conflicts.length > 0, conflicts };
}
