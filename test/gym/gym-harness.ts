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
