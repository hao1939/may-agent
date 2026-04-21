/**
 * Active Nudge — detect loops/stalls/ghost deliverables in running sessions
 * and intervene via cancel or workspace nudge file.
 *
 * Runs every 5 minutes. Invokes monitor-session.cjs --running to get
 * intervention payloads, then acts on them:
 *   - "cancel" actions (loops, ghost deliverables) → cancel the session
 *   - "warn"/"nudge" actions (productivity stalls) → write nudge-active.md for heartbeat pickup
 *
 * Cooldown: skips sessions that were already intervened on in the last 10 min
 * to prevent cancel-restart-cancel loops.
 *
 * Exports create() conforming to HandlerModule.
 */

import { existsSync, mkdirSync, appendFileSync, writeFileSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import type { HandlerContext, HandlerModule } from "../../../src/lib/handler-context.js";
import type { CronEntry } from "../../../src/lib/cron-tool.js";

/** Cooldown period — don't re-intervene on the same session within this window. */
const COOLDOWN_MS = 10 * 60 * 1000;

/** Max lines to scan from nudge-log.jsonl for cooldown check. */
const COOLDOWN_SCAN_LINES = 50;

// ── Types ─────────────────────────────────────────────────────────────

export interface ActiveNudgeResult {
  interventions: number;
  cancelled: Array<{ sessionId: string; agent: string; type: string }>;
  nudged: Array<{ sessionId: string; agent: string; type: string }>;
  details: string[];
}

interface MonitorIntervention {
  sessionId: string;
  agent: string;
  status: string;
  type: string;
  message: string;
  action: string;
  confidence: number;
}

// ── Factory ───────────────────────────────────────────────────────────

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const result = runActiveNudge(ctx);
    if (result.interventions > 0) {
      ctx.log(`[active-nudge] 🔔 ${result.interventions} intervention(s): ${result.details.join(", ")}`);
    }
  };
};

// ── Core logic ────────────────────────────────────────────────────────

export function runActiveNudge(ctx: HandlerContext): ActiveNudgeResult {
  const emptyResult: ActiveNudgeResult = {
    interventions: 0,
    cancelled: [],
    nudged: [],
    details: [],
  };

  // 0. Kill zombie sessions (running but 0 ops after 15min)
  try {
    const { DatabaseSync } = require("node:sqlite");
    const dbPath = join(ctx.projectRoot, ".state", "may.db");
    const db = new DatabaseSync(dbPath);
    const cutoff = Date.now() - 15 * 60 * 1000; // 15 minutes
    const zombies = db.prepare(
      "SELECT sessionId, agent, task FROM sessions WHERE status='running' AND opCount=0 AND startedAt < ?"
    ).all(cutoff) as Array<{ sessionId: string; agent: string; task: string }>;
    if (zombies.length > 0) {
      const fixed = db.prepare(
        "UPDATE sessions SET status='interrupted', error='zombie: 0 ops after 15min' WHERE status='running' AND opCount=0 AND startedAt < ?"
      ).run(cutoff);
      ctx.log(`[active-nudge] 🧟 Cleaned ${fixed.changes} zombie session(s): ${zombies.map(z => z.agent + '/' + z.sessionId).join(', ')}`);
    }
    db.close();
  } catch (err: any) {
    ctx.log(`[active-nudge] zombie cleanup error: ${err.message?.slice(0, 100)}`);
  }

  // 1. Run monitor-session.cjs --running
  let monitorOutput: any;
  try {
    monitorOutput = runMonitorSession(ctx);
  } catch (err: any) {
    ctx.log(`[active-nudge] ❌ monitor-session failed: ${err.message?.slice(0, 200)}`);
    return emptyResult;
  }

  // 2. Extract interventions
  const interventions: MonitorIntervention[] = monitorOutput?.interventions ?? [];
  if (interventions.length === 0) {
    return emptyResult;
  }

  // 3. Load cooldown set (sessions intervened on recently)
  const nudgeLogPath = join(ctx.projectRoot, ".state", "nudge-log.jsonl");
  const recentSessions = getRecentlyIntervenedSessions(nudgeLogPath);

  // 4. Process each intervention
  const result: ActiveNudgeResult = {
    interventions: 0,
    cancelled: [],
    nudged: [],
    details: [],
  };

  for (const intervention of interventions) {
    // Cooldown check — skip if we already acted on this session recently
    if (recentSessions.has(intervention.sessionId)) {
      continue;
    }

    const action = intervention.action;

    if (action === "cancel") {
      // Write nudge file BEFORE cancelling so the next session has context
      // about why the previous session was terminated.
      try {
        writeNudgeFile(ctx, intervention);
      } catch (err: any) {
        ctx.log(`[active-nudge] Failed to write pre-cancel nudge for ${intervention.sessionId}: ${err.message?.slice(0, 100)}`);
        // Continue with cancel even if nudge write fails
      }

      // Now cancel the session
      try {
        ctx.manager.cancel(intervention.sessionId, intervention.message);
        result.cancelled.push({
          sessionId: intervention.sessionId,
          agent: intervention.agent,
          type: intervention.type,
        });
        result.details.push(`cancelled ${intervention.agent}/${intervention.sessionId} (${intervention.type})`);
      } catch (err: any) {
        ctx.log(`[active-nudge] Failed to cancel ${intervention.sessionId}: ${err.message?.slice(0, 100)}`);
      }
    } else if (action === "warn" || action === "nudge") {
      // Productivity stalls → write nudge file for heartbeat context injection
      try {
        writeNudgeFile(ctx, intervention);
        result.nudged.push({
          sessionId: intervention.sessionId,
          agent: intervention.agent,
          type: intervention.type,
        });
        result.details.push(`nudged ${intervention.agent}/${intervention.sessionId} (${intervention.type})`);
      } catch (err: any) {
        ctx.log(`[active-nudge] Failed to write nudge for ${intervention.sessionId}: ${err.message?.slice(0, 100)}`);
      }
    } else {
      // Unknown action — log and skip
      ctx.log(`[active-nudge] Unknown action "${action}" for ${intervention.sessionId}, skipping`);
      continue;
    }

    // Log to nudge-log.jsonl
    appendToNudgeLog(nudgeLogPath, intervention);
    result.interventions++;
  }

  return result;
}

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Run monitor-session.cjs --running and return parsed JSON output.
 * monitor-session exits with code 1 when unhealthy sessions are found
 * (this is expected, not an error). We parse stdout either way.
 */
function runMonitorSession(ctx: HandlerContext): any {
  const cmd = "node agents/evaluator/skills/monitor-session.cjs --running";
  let stdout: string;

  try {
    stdout = execSync(cmd, {
      cwd: ctx.projectRoot,
      timeout: 30_000,
      stdio: "pipe",
    }).toString();
  } catch (err: any) {
    // Exit code 1 with stdout → unhealthy sessions found (expected)
    if (err.stdout) {
      stdout = err.stdout.toString();
    } else {
      throw err; // Genuine failure (timeout, missing file, etc.)
    }
  }

  try {
    return JSON.parse(stdout);
  } catch {
    throw new Error(`Failed to parse monitor-session output: ${stdout?.slice(0, 200)}`);
  }
}

/**
 * Write a nudge-active.md file to the agent's workspace directory.
 * This gets picked up by heartbeat context injection.
 */
function writeNudgeFile(ctx: HandlerContext, intervention: MonitorIntervention): void {
  const agentWorkspace = join(ctx.agentsRoot, intervention.agent, "workspace");
  mkdirSync(agentWorkspace, { recursive: true });

  const nudgePath = join(agentWorkspace, "nudge-active.md");
  const content = [
    `# Active Nudge — ${new Date().toISOString().slice(0, 16)}`,
    "",
    `**Session:** ${intervention.sessionId}`,
    `**Type:** ${intervention.type}`,
    `**Confidence:** ${intervention.confidence}`,
    "",
    intervention.message,
    "",
    `---`,
    `*Auto-generated by active-nudge handler. This file is consumed by heartbeat context injection.*`,
    "",
  ].join("\n");

  writeFileSync(nudgePath, content);
}

/**
 * Append an intervention record to the JSONL nudge log.
 */
function appendToNudgeLog(nudgeLogPath: string, intervention: MonitorIntervention): void {
  const dir = dirname(nudgeLogPath);
  mkdirSync(dir, { recursive: true });

  const record = {
    timestamp: new Date().toISOString(),
    sessionId: intervention.sessionId,
    agent: intervention.agent,
    type: intervention.type,
    status: intervention.status,
    action: intervention.action,
    confidence: intervention.confidence,
    message: intervention.message.slice(0, 300),
  };

  appendFileSync(nudgeLogPath, JSON.stringify(record) + "\n");
}

/**
 * Read the last N lines of nudge-log.jsonl and return sessionIds
 * that were intervened on within the cooldown window.
 */
function getRecentlyIntervenedSessions(nudgeLogPath: string): Set<string> {
  const recent = new Set<string>();
  if (!existsSync(nudgeLogPath)) return recent;

  const cutoff = Date.now() - COOLDOWN_MS;

  try {
    const raw = readFileSync(nudgeLogPath, "utf-8");
    const allLines = raw.trim().split("\n");
    // Only check the last N lines for performance
    const lines = allLines.slice(-COOLDOWN_SCAN_LINES);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const entry = JSON.parse(trimmed);
        if (entry.timestamp && new Date(entry.timestamp).getTime() > cutoff) {
          recent.add(entry.sessionId);
        }
      } catch {
        // Skip malformed lines
      }
    }
  } catch {
    // File unreadable — treat as empty
  }

  return recent;
}
