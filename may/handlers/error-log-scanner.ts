/**
 * error-log-scanner — JS cron handler (Stage 3 graduation).
 *
 * Scans all agents ERROR_LOG files for repeated error patterns.
 * If any agent has ≥3 errors of the same type in the last 7 days,
 * triggers Coach with a focused growth-cycle message.
 * If no agents meet the threshold → no-op (zero LLM cost).
 *
 * Exports create() conforming to HandlerModule.
 */

import { readdirSync, readFileSync, existsSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

// ── Experiments-history check (skip known-bad triggers) ───────────────

/** How far back to consider experiments as "recent" (30 days). */
const EXPERIMENTS_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;

interface ExperimentsCheckResult {
  skip: boolean;
  reason?: string;
}

/**
 * Check experiments.jsonl for prior terminal experiments matching (agent, errorType).
 * If a recent experiment was CEILING, discarded, or skipped → skip the trigger.
 * Returns { skip: false } if the file doesn't exist or can't be read.
 */
export function checkExperimentsHistory(
  experimentsPath: string,
  agent: string,
  errorType: string,
): ExperimentsCheckResult {
  let content: string;
  try {
    if (!existsSync(experimentsPath)) return { skip: false };
    content = readFileSync(experimentsPath, "utf-8");
  } catch {
    return { skip: false };
  }

  const now = Date.now();
  const cutoff = now - EXPERIMENTS_LOOKBACK_MS;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(trimmed);
    } catch {
      continue;
    }

    // Must match the agent
    if (entry.agent !== agent) continue;

    // Must be recent (within last 30 days)
    if (typeof entry.timestamp === "string") {
      const entryTime = new Date(entry.timestamp).getTime();
      if (isNaN(entryTime) || entryTime < cutoff) continue;
    } else {
      // No timestamp — skip this entry (can't determine recency)
      continue;
    }

    // Check if errorType (FM code) appears in relevant fields
    const fieldsToSearch = ["error_pattern", "notes", "method"].map(
      (f) => (typeof entry[f] === "string" ? entry[f] : "") as string,
    );
    const matchesErrorType = fieldsToSearch.some((v) => v.includes(errorType));
    if (!matchesErrorType) continue;

    // Check for terminal outcome
    const result = typeof entry.result === "string" ? entry.result : "";
    const decision = typeof entry.decision === "string" ? entry.decision : "";
    const reason = typeof entry.reason === "string" ? entry.reason : "";

    const isTerminal =
      result === "CEILING" ||
      decision === "discard" ||
      decision === "skipped" ||
      reason.toLowerCase().includes("ceiling");

    if (!isTerminal) continue;

    // Found a matching terminal experiment — skip
    const id = typeof entry.id === "string" ? entry.id : "(no id)";
    const outcome = result || decision || "ceiling";
    return { skip: true, reason: `prior experiment ${id} resulted in ${outcome}` };
  }

  return { skip: false };
}

// ── Configuration ─────────────────────────────────────────────────────

/** Minimum repeated errors of the same type to trigger a growth cycle. */
const ERROR_THRESHOLD = 3;

/** How far back to look (7 days in milliseconds). */
const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

/** Cooldown period — don't re-trigger same (agent, errorType) within this window.
 *  Matches LOOKBACK_MS so patterns only re-trigger when new errors occur outside the window. */
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (matches lookback window)

/** Maximum growth-trigger sessions to launch per scan cycle. */
const MAX_TRIGGERS_PER_SCAN = 3;

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const results = scanErrorLogs({
      agentsRoot: ctx.agentsRoot,
      threshold: ERROR_THRESHOLD,
      lookbackMs: LOOKBACK_MS,
      excludeAgents: ["coach"], // Prevent self-referential loop: coach errors → trigger coach → more errors
    });

    if (results.triggered.length === 0) {
      // No agents exceed threshold — silent no-op
      ctx.log(`[error-log-scanner] Scanned ${results.agentsScanned} agents — no repeated error patterns above threshold (${ERROR_THRESHOLD}).`);
      return;
    }

    // Load cooldown state
    const cooldownFile = join(ctx.agentsRoot, "..", ".state", "growth-trigger-cooldown.json");
    const cooldowns = loadCooldowns(cooldownFile);
    const now = Date.now();

    // Filter out triggers that are still in cooldown
    const eligible = results.triggered.filter((t) => {
      const key = `${t.agent}:${t.errorType}`;
      const lastTriggered = cooldowns[key] || 0;
      if (now - lastTriggered < COOLDOWN_MS) {
        ctx.log(`[error-log-scanner] Skipping ${key} — cooldown active (last triggered ${Math.round((now - lastTriggered) / 3600000)}h ago)`);
        return false;
      }
      return true;
    });

    // Filter out triggers with prior terminal experiments (ceiling/discard/skipped)
    const experimentsPath = join(ctx.agentsRoot, "coach", "workspace", "experiments.jsonl");
    const afterExperimentsCheck = eligible.filter((t) => {
      const check = checkExperimentsHistory(experimentsPath, t.agent, t.errorType);
      if (check.skip) {
        ctx.log(`[error-log-scanner] Skipping ${t.agent}:${t.errorType} — ${check.reason}`);
        return false;
      }
      return true;
    });

    // Cap concurrent triggers to prevent resource overload
    const toTrigger = afterExperimentsCheck.slice(0, MAX_TRIGGERS_PER_SCAN);

    if (toTrigger.length === 0) {
      ctx.log(`[error-log-scanner] ${results.triggered.length} patterns found but all in cooldown or previously attempted. Skipping.`);
      return;
    }

    ctx.log(`[error-log-scanner] ${results.triggered.length} patterns found, ${eligible.length} after cooldown, ${afterExperimentsCheck.length} after experiments check, triggering top ${toTrigger.length}.`);

    // Trigger Coach for eligible triggers (capped)
    for (const trigger of toTrigger) {
      const key = `${trigger.agent}:${trigger.errorType}`;
      const task = `[cron:growth-trigger] Agent "${trigger.agent}" has ${trigger.count} repeated "${trigger.errorType}" errors in the last 7 days. Initiate Growth Cycle: fork → train → verify → promote/discard. Focus on this specific error pattern.`;
      ctx.log(`[error-log-scanner] 🚨 Triggering coach for ${trigger.agent}: ${trigger.count}× ${trigger.errorType}`);
      try {
        await ctx.manager.run("coach", task, { kind: "job" });
        cooldowns[key] = now;
        saveCooldowns(cooldownFile, cooldowns); // Persist immediately to prevent race conditions
      } catch (err) {
        ctx.log(`[error-log-scanner] ⚠️ Failed to trigger coach for ${trigger.agent}: ${err instanceof Error ? err.message : String(err)}`);
        // Still set cooldown on failure to prevent immediate re-trigger of broken patterns
        cooldowns[key] = now;
        saveCooldowns(cooldownFile, cooldowns); // Persist immediately
      }
    }

    ctx.log(`[error-log-scanner] Scan complete. ${toTrigger.length} growth cycle(s) triggered (${results.triggered.length - toTrigger.length} deferred) across ${results.agentsScanned} agents.`);
  };
};

// ── Types ─────────────────────────────────────────────────────────────

export interface ScanOptions {
  agentsRoot: string;
  threshold: number;
  lookbackMs: number;
  /** Agent names to exclude from scanning (e.g., 'coach' to prevent self-referential loops). */
  excludeAgents?: string[];
}

export interface ScanResult {
  agentsScanned: number;
  triggered: TriggerEntry[];
}

export interface TriggerEntry {
  agent: string;
  errorType: string;
  count: number;
}

interface ErrorLogEntry {
  timestamp?: string;
  error?: string;
  [key: string]: unknown;
}

// ── Pure logic (exported for testing) ─────────────────────────────────

export function scanErrorLogs(opts: ScanOptions): ScanResult {
  const { agentsRoot, threshold, lookbackMs, excludeAgents = [] } = opts;
  const now = Date.now();
  const cutoff = now - lookbackMs;

  const triggered: TriggerEntry[] = [];
  let agentsScanned = 0;

  // List all agent directories
  let agentDirs: string[];
  try {
    agentDirs = readdirSync(agentsRoot).filter((name) => {
      // Skip hidden dirs, shared, .lab, and excluded agents (e.g., coach to prevent self-referential loops)
      if (name.startsWith(".") || name === "shared") return false;
      if (excludeAgents.includes(name)) return false;
      const dirPath = join(agentsRoot, name);
      try {
        return statSync(dirPath).isDirectory();
      } catch {
        return false;
      }
    });
  } catch {
    return { agentsScanned: 0, triggered: [] };
  }

  for (const agentName of agentDirs) {
    const errorLogPath = join(agentsRoot, agentName, "ERROR_LOG.jsonl");
    if (!existsSync(errorLogPath)) continue;

    agentsScanned++;

    // Read and parse error log
    let content: string;
    try {
      content = readFileSync(errorLogPath, "utf-8");
    } catch {
      continue;
    }

    // Count errors by type within the lookback window
    const errorCounts = new Map<string, number>();

    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let entry: ErrorLogEntry;
      try {
        entry = JSON.parse(trimmed);
      } catch {
        continue;
      }

      // Check timestamp is within lookback window
      if (entry.timestamp) {
        const entryTime = new Date(entry.timestamp).getTime();
        if (isNaN(entryTime) || entryTime < cutoff) continue;
      } else {
        // No timestamp — skip (can't determine recency)
        continue;
      }

      // Extract error type
      const errorType = entry.error;
      if (!errorType || typeof errorType !== "string") continue;

      // Normalize: take the FM-X.X code if present, otherwise use full string
      const fmMatch = errorType.match(/FM-\d+\.\d+/);
      const normalizedType = fmMatch ? fmMatch[0] : errorType.slice(0, 50);

      errorCounts.set(normalizedType, (errorCounts.get(normalizedType) || 0) + 1);
    }

    // Check if any error type exceeds threshold
    for (const [errorType, count] of errorCounts) {
      if (count >= threshold) {
        triggered.push({ agent: agentName, errorType, count });
      }
    }
  }

  // Sort by count descending (most critical first)
  triggered.sort((a, b) => b.count - a.count);

  return { agentsScanned, triggered };
}

// ── Cooldown persistence ──────────────────────────────────────────────

type CooldownMap = Record<string, number>;

function loadCooldowns(filePath: string): CooldownMap {
  try {
    if (existsSync(filePath)) {
      return JSON.parse(readFileSync(filePath, "utf-8"));
    }
  } catch {
    // Corrupted file — start fresh
  }
  return {};
}

function saveCooldowns(filePath: string, cooldowns: CooldownMap): void {
  // Prune expired entries (older than 8 days) to prevent unbounded growth
  const cutoff = Date.now() - 8 * 24 * 60 * 60 * 1000;
  const pruned: CooldownMap = {};
  for (const [key, ts] of Object.entries(cooldowns)) {
    if (ts > cutoff) pruned[key] = ts;
  }
  try {
    writeFileSync(filePath, JSON.stringify(pruned, null, 2), "utf-8");
  } catch {
    // Best-effort — cooldown state loss just means one extra trigger cycle
  }
}
