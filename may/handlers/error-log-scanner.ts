/**
 * error-log-scanner.ts — Scans agent ERROR_LOG.jsonl files for recurring error patterns.
 *
 * Exports scanErrorLogs() which reads each agent's ERROR_LOG.jsonl,
 * groups errors by FM-X.X code, and triggers when a code exceeds the threshold.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export interface ScanErrorLogsOptions {
  agentsRoot: string;
  threshold: number;
  lookbackMs: number;
  excludeAgents?: string[];
}

export interface TriggeredError {
  agent: string;
  errorType: string;
  count: number;
}

export interface ScanResult {
  agentsScanned: number;
  triggered: TriggeredError[];
}

const SKIP_DIRS = new Set([".lab", "shared"]);

export function scanErrorLogs(opts: ScanErrorLogsOptions): ScanResult {
  const { agentsRoot, threshold, lookbackMs, excludeAgents = [] } = opts;
  const excludeSet = new Set(excludeAgents);
  const now = Date.now();
  const cutoff = now - lookbackMs;

  let agentsScanned = 0;
  const allTriggered: TriggeredError[] = [];

  let entries: string[];
  try {
    entries = readdirSync(agentsRoot);
  } catch {
    return { agentsScanned: 0, triggered: [] };
  }

  for (const agentName of entries) {
    if (SKIP_DIRS.has(agentName)) continue;
    if (excludeSet.has(agentName)) continue;

    const agentDir = join(agentsRoot, agentName);
    try {
      if (!statSync(agentDir).isDirectory()) continue;
    } catch {
      continue;
    }

    const logPath = join(agentDir, "ERROR_LOG.jsonl");
    if (!existsSync(logPath)) continue;

    agentsScanned++;

    // Parse error log lines
    const content = readFileSync(logPath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());

    // Group by FM-X.X error code
    const errorCounts = new Map<string, number>();

    for (const line of lines) {
      let entry: { timestamp?: string; error?: string };
      try {
        entry = JSON.parse(line);
      } catch {
        continue; // skip malformed lines
      }

      if (!entry.timestamp) continue;

      const ts = new Date(entry.timestamp).getTime();
      if (isNaN(ts) || ts < cutoff) continue;

      const errorStr = entry.error ?? "";
      const match = errorStr.match(/FM-\d+\.\d+/);
      if (!match) continue;

      const code = match[0];
      errorCounts.set(code, (errorCounts.get(code) ?? 0) + 1);
    }

    // Check threshold
    for (const [errorType, count] of errorCounts) {
      if (count >= threshold) {
        allTriggered.push({ agent: agentName, errorType, count });
      }
    }
  }

  // Sort by count descending
  allTriggered.sort((a, b) => b.count - a.count);

  return { agentsScanned, triggered: allTriggered };
}
