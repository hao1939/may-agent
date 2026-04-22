/// <reference path="../../../src/lib/workflow-defs.d.ts" />

/**
 * error-scan — Sensor-Judge workflow for recurring error pattern detection.
 *
 * Migrated from: agents/may/handlers/error-log-scanner.ts (JS cron handler)
 *
 * Pattern:
 *   Step 1 (sensor): JS scans all agents' ERROR_LOG.jsonl files → structured data (zero LLM cost)
 *   Step 2 (judge):  LLM agent analyzes patterns and decides intervention (LLM cost only when needed)
 *
 * Key improvement over the old handler:
 *   - Old: JS scans → emits raw "agent X has N errors" message to coach
 *   - New: JS scans → LLM sees full context (error texts, counts, history) → makes smarter decision
 *   - Short-circuit: if no patterns exceed threshold, workflow ends immediately (zero LLM cost)
 *   - Guards: auto-test/build-check fire if the coach agent makes code changes
 *
 * Usage via cron.json:
 *   {
 *     "name": "error-scan",
 *     "type": "job",
 *     "handler": "run-workflow",
 *     "handlerConfig": {
 *       "workflow": "error-scan",
 *       "agent": "may",
 *       "task": "Scan error logs for recurring patterns and address them."
 *     }
 *   }
 */

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// ── Configuration ─────────────────────────────────────────────────────

/** Minimum repeated errors of the same type to trigger analysis. */
const ERROR_THRESHOLD = 3;

/** How far back to look (7 days). */
const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

/** Cooldown — don't re-trigger same (agent, errorType) within 7 days. */
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

/** Max triggers per scan cycle. */
const MAX_TRIGGERS_PER_SCAN = 2;

/** Experiments attempts threshold — skip if already investigated. */
const EXPERIMENTS_ATTEMPTS_THRESHOLD = 2;

/** Agent-level fallback — skip if heavily coached recently. */
const AGENT_LEVEL_EXPERIMENTS_THRESHOLD = 4;

/** Experiments lookback (14 days). */
const EXPERIMENTS_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;

// ── Workflow ──────────────────────────────────────────────────────────

export const name: string = "error-scan";

export const description: string =
  "Sensor-judge workflow: JS scans error logs (zero LLM cost), " +
  "LLM analyzes patterns and triggers coach intervention (cost only when needed).";

export async function execute(ctx: WorkflowContext): Promise<WorkflowResult> {
  // ── Step 1: Sensor — scan error logs (zero LLM cost) ────────────
  const scan = await ctx.runFunction("scan-error-logs", async () => {
    // Resolve agentsRoot from the workflow's working directory
    // The run-workflow handler runs from project root, agents are at ./agents/
    const agentsRoot = join(process.cwd(), "agents");

    const scanResult = scanErrorLogs({
      agentsRoot,
      threshold: ERROR_THRESHOLD,
      lookbackMs: LOOKBACK_MS,
      excludeAgents: ["coach"], // Prevent self-referential loop
    });

    if (scanResult.triggered.length === 0) {
      return JSON.stringify({
        status: "clean",
        agentsScanned: scanResult.agentsScanned,
        triggered: [],
        eligible: [],
      });
    }

    // Apply cooldown filter
    const cooldownFile = join(process.cwd(), ".state", "growth-trigger-cooldown.json");
    const cooldowns = loadCooldowns(cooldownFile);
    const now = Date.now();

    const afterCooldown = scanResult.triggered.filter((t) => {
      const key = `${t.agent}:${t.errorType}`;
      const lastTriggered = cooldowns[key] || 0;
      return now - lastTriggered >= COOLDOWN_MS;
    });

    // Apply experiments gate
    const eligible = afterCooldown.filter((t) => {
      const check = checkExperimentsHistory(agentsRoot, t.agent, t.errorType);
      return !check.skip;
    });

    // Cap concurrent triggers
    const toAnalyze = eligible.slice(0, MAX_TRIGGERS_PER_SCAN);

    // Collect sample error messages for richer context
    const enriched = toAnalyze.map((t) => {
      const samples = getErrorSamples(agentsRoot, t.agent, t.errorType, LOOKBACK_MS, 3);
      return { ...t, samples };
    });

    return JSON.stringify({
      status: enriched.length > 0 ? "patterns_found" : "all_filtered",
      agentsScanned: scanResult.agentsScanned,
      totalTriggered: scanResult.triggered.length,
      afterCooldown: afterCooldown.length,
      eligible: enriched,
    });
  });

  // ── Short-circuit: no patterns = done (zero LLM cost) ───────────
  const scanData = JSON.parse(scan.lastAssistantText ?? "{}");

  if (scanData.status === "clean") {
    return ctx.done(
      `Scanned ${scanData.agentsScanned} agents — no recurring error patterns above threshold (${ERROR_THRESHOLD}).`,
    );
  }

  if (scanData.status === "all_filtered" || !scanData.eligible?.length) {
    return ctx.done(
      `Found ${scanData.totalTriggered} patterns but all filtered by cooldown/experiments gate.`,
    );
  }

  // ── Step 2: Judge — LLM analyzes patterns and decides action ────
  const patterns = scanData.eligible;
  const patternSummary = patterns
    .map((p: any) => {
      const samples = p.samples?.length
        ? `\n  Sample errors:\n${p.samples.map((s: string) => `    - ${s}`).join("\n")}`
        : "";
      return `- Agent "${p.agent}": ${p.count}× "${p.errorType}" in last 7 days${samples}`;
    })
    .join("\n");

  const judgeTask = `You are analyzing recurring error patterns detected by an automated scan.

## Error Patterns Found
${patternSummary}

## Your Task
For each pattern, decide the best intervention:

1. **growth-cycle** — The error pattern suggests a skill gap. Initiate a growth cycle: fork → train → verify → promote/discard. Be specific about what skill to train.
2. **config-fix** — The error is caused by a configuration issue. Describe the fix.
3. **skip** — The error is transient, already being addressed, or not worth coaching on. Explain why.

For each pattern, output your decision as:
### [agent]: [errorType]
**Decision:** growth-cycle | config-fix | skip
**Reasoning:** (1-2 sentences)
**Action:** (specific next step if growth-cycle or config-fix)

Be selective — not every repeated error needs a growth cycle. Prioritize errors that indicate a learnable skill gap.`;

  const analysis = await ctx.runAgent("coach", judgeTask);

  // ── Step 3: Update cooldowns for analyzed patterns ──────────────
  await ctx.runFunction("update-cooldowns", async () => {
    const cooldownFile = join(process.cwd(), ".state", "growth-trigger-cooldown.json");
    const cooldowns = loadCooldowns(cooldownFile);
    const now = Date.now();

    for (const pattern of patterns) {
      const key = `${pattern.agent}:${pattern.errorType}`;
      cooldowns[key] = now;
    }
    saveCooldowns(cooldownFile, cooldowns);

    return `Updated cooldowns for ${patterns.length} pattern(s): ${patterns.map((p: any) => `${p.agent}:${p.errorType}`).join(", ")}`;
  });

  return ctx.done(
    `Analyzed ${patterns.length} error pattern(s). ` +
    `Coach decision: ${analysis.lastAssistantText?.slice(0, 200) ?? "(no output)"}`,
  );
}

// ── Pure scan logic (extracted from error-log-scanner.ts) ─────────────

interface ScanOptions {
  agentsRoot: string;
  threshold: number;
  lookbackMs: number;
  excludeAgents?: string[];
}

interface ScanResult {
  agentsScanned: number;
  triggered: TriggerEntry[];
}

interface TriggerEntry {
  agent: string;
  errorType: string;
  count: number;
}

interface ErrorLogEntry {
  timestamp?: string;
  error?: string;
  message?: string;
  [key: string]: unknown;
}

function scanErrorLogs(opts: ScanOptions): ScanResult {
  const { agentsRoot, threshold, lookbackMs, excludeAgents = [] } = opts;
  const now = Date.now();
  const cutoff = now - lookbackMs;

  const triggered: TriggerEntry[] = [];
  let agentsScanned = 0;

  let agentDirs: string[];
  try {
    agentDirs = readdirSync(agentsRoot).filter((name) => {
      if (name.startsWith(".") || name === "shared" || name.startsWith("_")) return false;
      if (excludeAgents.includes(name)) return false;
      try {
        return statSync(join(agentsRoot, name)).isDirectory();
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

    let content: string;
    try {
      content = readFileSync(errorLogPath, "utf-8");
    } catch {
      continue;
    }

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

      if (entry.timestamp) {
        const entryTime = new Date(entry.timestamp).getTime();
        if (isNaN(entryTime) || entryTime < cutoff) continue;
      } else {
        continue;
      }

      const errorType = entry.error;
      if (!errorType || typeof errorType !== "string") continue;

      const fmMatch = errorType.match(/FM-\d+\.\d+/);
      const normalizedType = fmMatch ? fmMatch[0] : errorType.slice(0, 50);

      errorCounts.set(normalizedType, (errorCounts.get(normalizedType) || 0) + 1);
    }

    for (const [errorType, count] of errorCounts) {
      if (count >= threshold) {
        triggered.push({ agent: agentName, errorType, count });
      }
    }
  }

  triggered.sort((a, b) => b.count - a.count);
  return { agentsScanned, triggered };
}

/** Get sample error messages for richer context in the judge step. */
function getErrorSamples(
  agentsRoot: string,
  agent: string,
  errorType: string,
  lookbackMs: number,
  maxSamples: number,
): string[] {
  const errorLogPath = join(agentsRoot, agent, "ERROR_LOG.jsonl");
  if (!existsSync(errorLogPath)) return [];

  const cutoff = Date.now() - lookbackMs;
  const samples: string[] = [];

  try {
    const content = readFileSync(errorLogPath, "utf-8");
    for (const line of content.split("\n")) {
      if (samples.length >= maxSamples) break;
      const trimmed = line.trim();
      if (!trimmed) continue;

      let entry: ErrorLogEntry;
      try {
        entry = JSON.parse(trimmed);
      } catch {
        continue;
      }

      if (entry.timestamp) {
        const entryTime = new Date(entry.timestamp).getTime();
        if (isNaN(entryTime) || entryTime < cutoff) continue;
      } else {
        continue;
      }

      const type = entry.error;
      if (!type || typeof type !== "string") continue;

      const fmMatch = type.match(/FM-\d+\.\d+/);
      const normalized = fmMatch ? fmMatch[0] : type.slice(0, 50);

      if (normalized === errorType) {
        const msg = entry.message || entry.error || "(no message)";
        samples.push(typeof msg === "string" ? msg.slice(0, 200) : String(msg).slice(0, 200));
      }
    }
  } catch {
    // best-effort
  }

  return samples;
}

/** Check if agent+error has been investigated recently. */
function checkExperimentsHistory(
  agentsRoot: string,
  agent: string,
  errorCode?: string,
): { skip: boolean; reason: string } {
  const experimentsPath = join(agentsRoot, "coach", "workspace", "experiments.jsonl");
  if (!existsSync(experimentsPath)) return { skip: false, reason: "" };

  let content: string;
  try {
    content = readFileSync(experimentsPath, "utf-8");
  } catch {
    return { skip: false, reason: "" };
  }

  const now = Date.now();
  const cutoff = now - EXPERIMENTS_LOOKBACK_MS;

  let codeSpecificCount = 0;
  let agentLevelCount = 0;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let entry: Record<string, unknown>;
    try {
      entry = JSON.parse(trimmed);
    } catch {
      continue;
    }

    if (entry.agent !== agent) continue;

    let entryTime: number;
    if (typeof entry.date === "string") {
      entryTime = new Date(entry.date).getTime();
    } else if (typeof entry.timestamp === "string") {
      entryTime = new Date(entry.timestamp).getTime();
    } else {
      continue;
    }
    if (isNaN(entryTime) || entryTime < cutoff) continue;

    const entryType = typeof entry.type === "string" ? entry.type : "";
    const infraTypes = ["baseline", "infrastructure-test", "methodology-fix", "gym-test", "scenario-design", "workflow-enforcement-test"];
    if (infraTypes.includes(entryType)) continue;

    agentLevelCount++;

    if (errorCode) {
      const entryPattern = typeof entry.error_pattern === "string" ? entry.error_pattern : "";
      if (entryPattern && (entryPattern.includes(errorCode) || errorCode.includes(entryPattern))) {
        codeSpecificCount++;
      }
    }
  }

  if (errorCode && codeSpecificCount >= EXPERIMENTS_ATTEMPTS_THRESHOLD) {
    return {
      skip: true,
      reason: `Agent "${agent}" + error "${errorCode}" has ${codeSpecificCount} prior experiments — already investigated`,
    };
  }

  if (agentLevelCount >= AGENT_LEVEL_EXPERIMENTS_THRESHOLD) {
    return {
      skip: true,
      reason: `Agent "${agent}" has ${agentLevelCount} total experiments — heavily coached, suppressing`,
    };
  }

  return { skip: false, reason: "" };
}

// ── Cooldown persistence ──────────────────────────────────────────────

type CooldownMap = Record<string, number>;

function loadCooldowns(filePath: string): CooldownMap {
  try {
    if (existsSync(filePath)) {
      return JSON.parse(readFileSync(filePath, "utf-8"));
    }
  } catch { /* corrupted — start fresh */ }
  return {};
}

function saveCooldowns(filePath: string, cooldowns: CooldownMap): void {
  const cutoff = Date.now() - 8 * 24 * 60 * 60 * 1000;
  const pruned: CooldownMap = {};
  for (const [key, ts] of Object.entries(cooldowns)) {
    if (ts > cutoff) pruned[key] = ts;
  }
  try {
    writeFileSync(filePath, JSON.stringify(pruned, null, 2), "utf-8");
  } catch { /* best-effort */ }
}
