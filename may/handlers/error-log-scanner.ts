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

// ── Configuration ─────────────────────────────────────────────────────

/** Minimum repeated errors of the same type to trigger a growth cycle. */
const ERROR_THRESHOLD = 3;

/** How far back to look (7 days in milliseconds). */
const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

/** Cooldown period — don't re-trigger same (agent, errorType) within this window.
 *  Matches LOOKBACK_MS so patterns only re-trigger when new errors occur outside the window. */
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (matches lookback window)

/** Maximum growth-trigger sessions to launch per scan cycle. */
const MAX_TRIGGERS_PER_SCAN = 1; // Reduced from 3 — growth forks not deploying (gym blocked), saves ~2.7MB/day

/** Minimum prior growth-cycle attempts for an agent+errorCode before we suppress triggers.
 *  Counts ANY prior attempt (discard, fail, ceiling, deployed), not just ceiling results. */
const EXPERIMENTS_ATTEMPTS_THRESHOLD = 2;

/** Agent-level fallback: if an agent has this many total experiments (any error pattern)
 *  in the lookback window, suppress ALL new triggers for that agent.
 *  This catches cases where experiments.jsonl doesn't record error_pattern consistently. */
const AGENT_LEVEL_EXPERIMENTS_THRESHOLD = 4;

/** How far back to look in experiments history (14 days in milliseconds). */
const EXPERIMENTS_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;

// ── Experiments-history gate ──────────────────────────────────────────

/**
 * Check if an agent+errorCode combination has enough recent experiments
 * (any outcome) that further growth-trigger cycles would be wasteful.
 *
 * Uses a two-pass approach:
 * 1. Code-specific check: if ≥2 experiments match the exact error_pattern, skip.
 * 2. Agent-level fallback: if ≥4 total coaching experiments exist for the agent
 *    (regardless of error_pattern), skip. This catches the common case where
 *    Coach doesn't consistently populate error_pattern in experiments.jsonl.
 *
 * Only counts actual coaching attempts — baselines, gym tests, and infra
 * experiments are excluded from the count.
 *
 * Returns `{ skip: true, reason }` when suppressed; `{ skip: false }` otherwise.
 */
export function checkExperimentsHistory(
  agentsRoot: string,
  agent: string,
  errorCode?: string,
): { skip: boolean; reason: string } {
  const experimentsPath = join(agentsRoot, "coach", "workspace", "experiments.jsonl");

  if (!existsSync(experimentsPath)) {
    return { skip: false, reason: "" };
  }

  let content: string;
  try {
    content = readFileSync(experimentsPath, "utf-8");
  } catch {
    return { skip: false, reason: "" };
  }

  const now = Date.now();
  const cutoff = now - EXPERIMENTS_LOOKBACK_MS;

  // Two-pass approach:
  // 1. errorCode-specific count (entries where error_pattern matches)
  // 2. agent-level count (ALL entries for this agent, regardless of error_pattern)
  // This handles the common case where experiments don't record error_pattern consistently.
  let codeSpecificCount = 0;
  let agentLevelCount = 0;
  const codeSpecificOutcomes: string[] = [];
  const agentLevelOutcomes: string[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(trimmed);
    } catch {
      continue;
    }

    // Agent must match
    if (entry.agent !== agent) continue;

    // Check recency — support both "date" (YYYY-MM-DD) and "timestamp" (ISO)
    let entryTime: number;
    if (typeof entry.date === "string") {
      entryTime = new Date(entry.date).getTime();
    } else if (typeof entry.timestamp === "string") {
      entryTime = new Date(entry.timestamp).getTime();
    } else {
      continue; // No date info — skip
    }
    if (isNaN(entryTime) || entryTime < cutoff) continue;

    // Only count actual coaching attempts (growth-cycle, sprint, learn-method)
    // Skip baselines, infrastructure tests, and gym infra — those aren't coaching attempts
    const entryType = typeof entry.type === "string" ? entry.type : "";
    const infraTypes = ["baseline", "infrastructure-test", "methodology-fix", "gym-test", "scenario-design", "workflow-enforcement-test"];
    if (infraTypes.includes(entryType)) {
      continue;
    }

    // This is a recent coaching attempt for this agent — count at agent level
    const result = typeof entry.result === "string" ? entry.result : "";
    const decision = typeof entry.decision === "string" ? entry.decision : "";
    const outcomeStr = result || decision || "unknown";
    agentLevelCount++;
    agentLevelOutcomes.push(outcomeStr);

    // Also check errorCode-specific match
    if (errorCode) {
      const entryPattern = typeof entry.error_pattern === "string" ? entry.error_pattern : "";
      if (entryPattern && (entryPattern.includes(errorCode) || errorCode.includes(entryPattern))) {
        codeSpecificCount++;
        codeSpecificOutcomes.push(outcomeStr);
      }
    }
  }

  // Check 1: error-code-specific gate (strict, lower threshold)
  if (errorCode && codeSpecificCount >= EXPERIMENTS_ATTEMPTS_THRESHOLD) {
    return {
      skip: true,
      reason: `Agent "${agent}" + error "${errorCode}" has ${codeSpecificCount} prior experiments in last 14 days (outcomes: ${codeSpecificOutcomes.join(", ")}) — already investigated`,
    };
  }

  // Check 2: agent-level fallback gate (catches missing error_pattern fields)
  // If an agent has been heavily coached recently (4+ experiments), suppress all new triggers
  if (agentLevelCount >= AGENT_LEVEL_EXPERIMENTS_THRESHOLD) {
    return {
      skip: true,
      reason: `Agent "${agent}" has ${agentLevelCount} total experiments in last 14 days (agent-level gate) — heavily coached, suppressing "${errorCode || 'any'}"`,
    };
  }

  return { skip: false, reason: "" };
}

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

    // Filter out triggers for agents with prior investigated experiments
    const afterExperimentsGate = eligible.filter((t) => {
      const check = checkExperimentsHistory(ctx.agentsRoot, t.agent, t.errorType);
      if (check.skip) {
        ctx.log(`[error-log-scanner] Skipping ${t.agent}:${t.errorType} — ${check.reason}`);
        return false;
      }
      return true;
    });

    // Cap concurrent triggers to prevent resource overload
    const toTrigger = afterExperimentsGate.slice(0, MAX_TRIGGERS_PER_SCAN);

    if (toTrigger.length === 0) {
      ctx.log(`[error-log-scanner] ${results.triggered.length} patterns found but all filtered (cooldown/experiments gate). Skipping.`);
      return;
    }

    ctx.log(`[error-log-scanner] ${results.triggered.length} patterns found, ${eligible.length} after cooldown, ${afterExperimentsGate.length} after experiments gate, triggering top ${toTrigger.length}.`);

    // Trigger Coach for eligible triggers (capped)
    for (const trigger of toTrigger) {
      const key = `${trigger.agent}:${trigger.errorType}`;
      const task = `[cron:growth-trigger] Agent "${trigger.agent}" has ${trigger.count} repeated "${trigger.errorType}" errors in the last 7 days. Initiate Growth Cycle: fork → train → verify → promote/discard. Focus on this specific error pattern.`;
      ctx.log(`[error-log-scanner] 🚨 Triggering coach for ${trigger.agent}: ${trigger.count}× ${trigger.errorType}`);
      try {
        ctx.emit({
          type: "message_created",
          from: "error-log-scanner",
          to: "coach",
          task,
          requestId: `els-${Date.now()}-${trigger.agent}`,
        });
        cooldowns[key] = now;
        saveCooldowns(cooldownFile, cooldowns);
      } catch (err) {
        ctx.log(`[error-log-scanner] ⚠️ Failed to emit for ${trigger.agent}: ${err instanceof Error ? err.message : String(err)}`);
        cooldowns[key] = now;
        saveCooldowns(cooldownFile, cooldowns);
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
