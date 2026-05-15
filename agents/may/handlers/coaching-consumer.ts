/**
 * coaching-consumer — Scans recent evaluations and flags sessions that cross
 * coaching thresholds. Writes coaching recommendations to `.state/coaching-queue/`.
 *
 * Thresholds (from score-thresholds.md):
 * - quality < 0.3 → immediate review (P0)
 * - result_delivered = false → P0 alert
 * - quality < 0.5 (3+ times in 7d) → pattern intervention (P1)
 * - efficiency < 0.3 → efficiency coaching (P2)
 *
 * Run via cron every 30 minutes, after eval-poller has produced new evaluations.
 */

import { resolve } from "node:path";
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import type { HandlerContext, HandlerModule, CronEntry } from "../../shared/agent-sdk.js";

const EVAL_DIR = ".state/evaluations";
const QUEUE_DIR = ".state/coaching-queue";
const STATE_FILE = "coaching-consumer-processed.json";
const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface EvalAgent {
  role?: string;
  capability_level?: string;
  efficiency: number;
  quality: number;
  verdict: string;
  issues?: string[];
  metrics?: Record<string, string>;
}

interface EvalFile {
  agents: Record<string, EvalAgent>;
  overall?: {
    verdict: string;
    result_delivered: boolean;
  };
  workflow?: {
    name?: string;
    issues?: string[];
  };
}

interface FlaggedSession {
  id: string;
  quality: number;
  efficiency: number;
  verdict: string;
  failureModes: string[];
}

interface CoachingRecommendation {
  agent: string;
  sessions: FlaggedSession[];
  trigger: "critical_quality" | "result_not_delivered" | "pattern_low_quality" | "low_efficiency";
  recommendedAction: string;
  priority: "P0" | "P1" | "P2";
  createdAt: number;
}

interface ProcessedState {
  lastRunAt: number;
  processedFiles: string[];
}

function loadState(persistDir: string): ProcessedState {
  const path = resolve(persistDir, STATE_FILE);
  if (existsSync(path)) {
    try {
      return JSON.parse(readFileSync(path, "utf-8"));
    } catch {
      // Corrupted, start fresh
    }
  }
  return { lastRunAt: 0, processedFiles: [] };
}

function saveState(persistDir: string, state: ProcessedState): void {
  const path = resolve(persistDir, STATE_FILE);
  mkdirSync(persistDir, { recursive: true });
  state.processedFiles = state.processedFiles.slice(-200);
  writeFileSync(path, JSON.stringify(state, null, 2));
}

function extractSessionId(filename: string): string {
  // eval_s_1774343027581_9.json → s_1774343027581_9
  const match = filename.match(/eval_(s_\d+_\d+)/);
  return match ? match[1] : filename.replace(/^eval_/, "").replace(/\.json$/, "");
}

function parseEvalFile(filepath: string): EvalFile | null {
  try {
    return JSON.parse(readFileSync(filepath, "utf-8"));
  } catch {
    return null;
  }
}

export const create: HandlerModule["create"] = (ctx: HandlerContext, _entry: CronEntry) => {
  return async () => {
    const evalDir = resolve(EVAL_DIR);
    if (!existsSync(evalDir)) {
      ctx.sdk.log("info", "[coaching-consumer] No evaluations directory found");
      return;
    }

    const state = loadState(ctx.sdk.paths.persist);
    const processedSet = new Set(state.processedFiles);
    const now = Date.now();

    // Read all eval files
    const files = readdirSync(evalDir).filter(
      (f) => f.startsWith("eval_") && f.endsWith(".json") && !processedSet.has(f)
    );

    if (files.length === 0) {
      ctx.sdk.log("info", "[coaching-consumer] No new evaluation files to process");
      return;
    }

    ctx.sdk.log("info", `[coaching-consumer] Processing ${files.length} new evaluation files`);

    // Collect per-agent scores across all new evals
    const agentScores: Record<string, FlaggedSession[]> = {};
    const recommendations: CoachingRecommendation[] = [];

    for (const file of files) {
      const filepath = resolve(evalDir, file);
      const eval_ = parseEvalFile(filepath);
      if (!eval_ || !eval_.agents) {
        state.processedFiles.push(file);
        continue;
      }

      const sessionId = extractSessionId(file);
      const resultDelivered = eval_.overall?.result_delivered ?? true;

      for (const [agentName, agentData] of Object.entries(eval_.agents)) {
        const session: FlaggedSession = {
          id: sessionId,
          quality: agentData.quality ?? 0,
          efficiency: agentData.efficiency ?? 0,
          verdict: agentData.verdict ?? "unknown",
          failureModes: agentData.issues ?? [],
        };

        if (!agentScores[agentName]) agentScores[agentName] = [];
        agentScores[agentName].push(session);

        // P0: Critical quality failure
        if (agentData.quality < 0.3) {
          recommendations.push({
            agent: agentName,
            sessions: [session],
            trigger: "critical_quality",
            recommendedAction: `Immediate review required. Quality score ${agentData.quality} is critically low. Issues: ${(agentData.issues || []).slice(0, 2).join("; ")}`,
            priority: "P0",
            createdAt: now,
          });
        }

        // P0: Result not delivered
        if (!resultDelivered) {
          recommendations.push({
            agent: agentName,
            sessions: [session],
            trigger: "result_not_delivered",
            recommendedAction: `Session ${sessionId} did not deliver its result. Review task completion patterns and identify blockers.`,
            priority: "P0",
            createdAt: now,
          });
        }

        // P2: Low efficiency
        if (agentData.efficiency < 0.3) {
          recommendations.push({
            agent: agentName,
            sessions: [session],
            trigger: "low_efficiency",
            recommendedAction: `Efficiency score ${agentData.efficiency} indicates wasted effort. Review tool usage patterns and error recovery.`,
            priority: "P2",
            createdAt: now,
          });
        }
      }

      state.processedFiles.push(file);
    }

    // P1: Pattern detection — 3+ low-quality sessions in the batch for same agent
    for (const [agentName, sessions] of Object.entries(agentScores)) {
      const lowQuality = sessions.filter((s) => s.quality < 0.5);
      if (lowQuality.length >= 3) {
        recommendations.push({
          agent: agentName,
          sessions: lowQuality,
          trigger: "pattern_low_quality",
          recommendedAction: `Agent has ${lowQuality.length} sessions with quality < 0.5 in this batch. Systematic coaching intervention needed. Common issues: ${lowQuality.flatMap((s) => s.failureModes).slice(0, 3).join("; ")}`,
          priority: "P1",
          createdAt: now,
        });
      }
    }

    // Write recommendations to coaching queue
    if (recommendations.length > 0) {
      const queueDir = resolve(QUEUE_DIR);
      mkdirSync(queueDir, { recursive: true });

      // Group by agent for cleaner output
      const byAgent: Record<string, CoachingRecommendation[]> = {};
      for (const rec of recommendations) {
        if (!byAgent[rec.agent]) byAgent[rec.agent] = [];
        byAgent[rec.agent].push(rec);
      }

      for (const [agent, recs] of Object.entries(byAgent)) {
        const filename = `coaching_${agent}_${now}.json`;
        const output = {
          agent,
          generatedAt: new Date(now).toISOString(),
          recommendations: recs.map((r) => ({
            trigger: r.trigger,
            priority: r.priority,
            sessions: r.sessions,
            recommendedAction: r.recommendedAction,
          })),
        };
        writeFileSync(resolve(queueDir, filename), JSON.stringify(output, null, 2));
        ctx.sdk.log("info", `[coaching-consumer] Wrote coaching recommendation for ${agent}: ${filename}`);
      }

      ctx.sdk.log("info", `[coaching-consumer] Generated ${recommendations.length} recommendations for ${Object.keys(byAgent).length} agents`);
    } else {
      ctx.sdk.log("info", "[coaching-consumer] No threshold violations found");
    }

    // Save state
    state.lastRunAt = now;
    saveState(ctx.sdk.paths.persist, state);
  };
};

export const cron: CronEntry = {
  schedule: "*/30 * * * *",
  description: "Scan evaluations and flag sessions needing coaching intervention",
};
