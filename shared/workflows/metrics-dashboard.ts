/**
 * metrics-dashboard.ts — Programmatic filesystem metrics collector.
 * Scans the project to gather real-time counts of tests, outputs, modules, etc.
 */

import { readdirSync, statSync, existsSync } from "fs";
import { join, resolve } from "path";

export interface DashboardMetrics {
  testCount: number;
  testFileCount: number;
  outputCount: number;
  workflowModuleCount: number;
  integrationTestCount: number;
}

export interface DashboardConfig {
  testsDir: string;
  outputsDir: string;
  workflowsDir: string;
}

const DEFAULT_CONFIG: DashboardConfig = {
  testsDir: resolve(__dirname, "../tests"),
  outputsDir: resolve(__dirname, "../../projects/system-efficiency/outputs"),
  workflowsDir: resolve(__dirname),
};

/**
 * Count files in a directory matching a pattern (non-recursive).
 */
function countFiles(dir: string, filter?: (name: string) => boolean): number {
  if (!existsSync(dir)) return 0;
  try {
    const entries = readdirSync(dir);
    if (!filter) return entries.length;
    return entries.filter(filter).length;
  } catch {
    return 0;
  }
}

/**
 * Recursively find files matching a filter.
 */
function findFilesRecursive(dir: string, filter: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          results.push(...findFilesRecursive(fullPath, filter));
        } else if (filter(entry)) {
          results.push(fullPath);
        }
      } catch {
        // skip inaccessible
      }
    }
  } catch {
    // skip inaccessible
  }
  return results;
}

/**
 * Count test cases by scanning test files for `it(` and `test(` patterns.
 */
function countTestCases(testFiles: string[]): number {
  let count = 0;
  const { readFileSync } = require("fs");
  for (const file of testFiles) {
    try {
      const content = readFileSync(file, "utf-8");
      const matches = content.match(/\b(it|test)\s*\(/g);
      if (matches) count += matches.length;
    } catch {
      // skip unreadable
    }
  }
  return count;
}

/**
 * Collect all dashboard metrics from the filesystem.
 */
export function collectMetrics(config: Partial<DashboardConfig> = {}): DashboardMetrics {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  // Test files
  const testFiles = findFilesRecursive(cfg.testsDir, (name) =>
    /\.(test|spec)\.(ts|js|mjs)$/.test(name)
  );
  const testFileCount = testFiles.length;
  const testCount = countTestCases(testFiles);

  // Integration test files
  const integrationTestCount = testFiles.filter((f) =>
    f.includes("integration")
  ).length;

  // Output artifacts
  const outputCount = countFiles(cfg.outputsDir, (name) => !name.startsWith("."));

  // Workflow modules (non-test .ts files)
  const workflowModuleCount = countFiles(cfg.workflowsDir, (name) =>
    name.endsWith(".ts") && !name.includes(".test.")
  );

  return {
    testCount,
    testFileCount,
    outputCount,
    workflowModuleCount,
    integrationTestCount,
  };
}

/**
 * Format metrics as a human-readable string.
 */
export function formatMetrics(metrics: DashboardMetrics): string {
  return [
    "┌─────────────────────────────────────┐",
    "│      System Metrics Dashboard       │",
    "├─────────────────────┬───────────────┤",
    `│ Test Cases          │ ${String(metrics.testCount).padStart(11)} │`,
    `│ Test Files          │ ${String(metrics.testFileCount).padStart(11)} │`,
    `│ Integration Tests   │ ${String(metrics.integrationTestCount).padStart(11)} │`,
    `│ Output Artifacts    │ ${String(metrics.outputCount).padStart(11)} │`,
    `│ Workflow Modules    │ ${String(metrics.workflowModuleCount).padStart(11)} │`,
    "└─────────────────────┴───────────────┘",
  ].join("\n");
}
