/**
 * bulk-eval.ts — Standalone bulk heuristic evaluator
 * 
 * Clears the evaluation backlog by processing ALL unevaluated sessions.
 * Uses the same logic as evaluation-sync.ts handler but without the 50-per-run limit.
 * 
 * Usage: bun run agents/may/workspace/audits/bulk-eval.ts
 */

import { Database } from "bun:sqlite";
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = "/app";
const SESSIONS_DIR = join(PROJECT_ROOT, ".state", "sessions");
const DB_PATH = join(PROJECT_ROOT, ".state", "may.db");

interface SessionMeta {
  agent?: string;
  task?: string;
  status?: string;
  kind?: string;
  startedAt?: number;
  endedAt?: number;
  opCount?: number;
  error?: string;
}

interface UsageData {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  cost: number;
}

function loadSessionMeta(metaPath: string): SessionMeta | null {
  try {
    return JSON.parse(readFileSync(metaPath, "utf-8"));
  } catch {
    return null;
  }
}

function loadSessionUsage(sessionDir: string): UsageData {
  const defaults: UsageData = {
    inputTokens: 0, outputTokens: 0, cacheReadTokens: 0,
    cacheWriteTokens: 0, totalTokens: 0, cost: 0,
  };

  const receiptsPath = join(sessionDir, "receipts.jsonl");
  if (!existsSync(receiptsPath)) return defaults;

  try {
    const lines = readFileSync(receiptsPath, "utf-8").split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const r = JSON.parse(line);
        if (r.usage) {
          defaults.inputTokens += r.usage.input_tokens || r.usage.inputTokens || 0;
          defaults.outputTokens += r.usage.output_tokens || r.usage.outputTokens || 0;
          defaults.cacheReadTokens += r.usage.cache_read_input_tokens || r.usage.cacheReadTokens || 0;
          defaults.cacheWriteTokens += r.usage.cache_creation_input_tokens || r.usage.cacheWriteTokens || 0;
          defaults.cost += r.cost || 0;
        }
      } catch { /* skip bad line */ }
    }
    defaults.totalTokens = defaults.inputTokens + defaults.outputTokens + defaults.cacheReadTokens + defaults.cacheWriteTokens;
  } catch { /* ignore read errors */ }

  return defaults;
}

function countToolCalls(sessionDir: string): { productive: number; wasted: number } {
  const jsonlPath = join(sessionDir, "session.jsonl");
  if (!existsSync(jsonlPath)) return { productive: 0, wasted: 0 };

  let productive = 0;
  let wasted = 0;

  try {
    const lines = readFileSync(jsonlPath, "utf-8").split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.type === "toolResult" || entry.role === "tool") {
          const isError = entry.isError === true || entry.content?.some?.((c: any) => c.type === "text" && c.text?.includes?.("Error:"));
          if (isError) wasted++;
          else productive++;
        }
      } catch { /* skip bad line */ }
    }
  } catch { /* ignore read errors */ }

  return { productive, wasted };
}

function computeEvaluation(meta: SessionMeta, sessionDir: string) {
  const agent = meta.agent || "unknown";
  const status = meta.status || "unknown";
  const opCount = meta.opCount || 0;

  // Skip evaluator sessions (meta agents)
  if (agent === "evaluator") {
    return {
      quality: 0, efficiency: 0,
      productiveCalls: 0, wastedCalls: 0,
      verdict: "skipped",
      issues: [`meta_agent_skipped (${agent})`],
      evaluatedByHeuristic: false,
      skippedByJs: true,
    };
  }

  // Skip 0-op interrupted sessions
  if (status === "interrupted" && opCount === 0) {
    return {
      quality: 0, efficiency: 0,
      productiveCalls: 0, wastedCalls: 0,
      verdict: "skipped",
      issues: [],
      evaluatedByHeuristic: false,
      skippedByJs: true,
    };
  }

  const { productive, wasted } = countToolCalls(sessionDir);

  // Error sessions
  if (status === "error") {
    const issues: string[] = ["session_error"];
    if (opCount <= 2) issues.push("shallow_session");
    return {
      quality: 0.1, efficiency: 0.4,
      productiveCalls: productive, wastedCalls: wasted,
      verdict: "needs_improvement",
      issues,
      evaluatedByHeuristic: true,
      skippedByJs: false,
    };
  }

  // Shallow sessions
  if (opCount <= 2 && status === "done") {
    return {
      quality: 1.0, efficiency: 0.8,
      productiveCalls: productive, wastedCalls: wasted,
      verdict: "good",
      issues: [],
      evaluatedByHeuristic: true,
      skippedByJs: false,
    };
  }

  // Compute efficiency based on waste ratio
  let effScore = 0.8;
  const totalCalls = productive + wasted;
  if (totalCalls > 0) {
    const wasteRatio = wasted / totalCalls;
    if (wasteRatio > 0.3) effScore = 0.3;
    else if (wasteRatio > 0.15) effScore = 0.5;
    else effScore = 0.8;
  }

  const issues: string[] = [];
  let quality = 1.0;
  let verdict = "good";

  if (wasted > 5 && totalCalls > 0 && wasted / totalCalls > 0.2) {
    issues.push("high_waste_ratio");
    quality = 0.75;
    verdict = "acceptable";
  }

  if (opCount > 100) {
    issues.push("high_op_count");
    if (quality > 0.5) quality = 0.75;
  }

  return {
    quality,
    efficiency: effScore,
    productiveCalls: productive,
    wastedCalls: wasted,
    verdict,
    issues,
    evaluatedByHeuristic: true,
    skippedByJs: false,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────

const db = new Database(DB_PATH);

try {
  // Get already-evaluated session IDs
  const evaluatedIds = new Set<string>();
  const rows = db.prepare("SELECT sessionId FROM evaluations").all() as Array<{ sessionId: string }>;
  for (const r of rows) evaluatedIds.add(r.sessionId);

  // Get all eligible sessions
  const sessions = db.prepare(
    "SELECT sessionId, agent, status, opCount FROM sessions WHERE status IN ('done', 'error', 'interrupted')"
  ).all() as Array<{ sessionId: string; agent: string; status: string; opCount: number }>;

  const unevaluated = sessions.filter(s => !evaluatedIds.has(s.sessionId));
  console.log(`Found ${unevaluated.length} unevaluated sessions (of ${sessions.length} total eligible)`);

  if (unevaluated.length === 0) {
    console.log("Nothing to do.");
    process.exit(0);
  }

  const upsert = db.prepare(`
    INSERT OR REPLACE INTO evaluations
      (sessionId, agent, quality, efficiency, productiveCalls, wastedCalls,
       verdict, issues, overall, usage, failureChains,
       evaluatedByHeuristic, skippedByJs, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let synced = 0;
  let skipped = 0;
  let errors = 0;

  const BATCH_SIZE = 100;
  for (let i = 0; i < unevaluated.length; i += BATCH_SIZE) {
    const batch = unevaluated.slice(i, i + BATCH_SIZE);
    
    const transaction = db.transaction(() => {
      for (const session of batch) {
        try {
          let sessionDir = join(SESSIONS_DIR, session.sessionId);
          if (!existsSync(sessionDir)) {
            sessionDir = join(SESSIONS_DIR, "history", session.sessionId);
          }

          const metaPath = join(sessionDir, "meta.json");
          const meta = existsSync(metaPath) ? loadSessionMeta(metaPath) : null;
          
          if (!meta) {
            const isEvaluator = session.agent === "evaluator";
            const isError = session.status === "error";
            upsert.run(
              session.sessionId,
              session.agent,
              isEvaluator ? 0 : isError ? 0.1 : 1.0,
              isEvaluator ? 0 : isError ? 0.4 : 0.8,
              0, 0,
              isEvaluator ? "skipped" : isError ? "needs_improvement" : "good",
              isEvaluator ? JSON.stringify([`meta_agent_skipped (${session.agent})`]) : "[]",
              JSON.stringify({
                quality: isEvaluator ? 0 : isError ? 0.1 : 1.0,
                efficiency: isEvaluator ? 0 : isError ? 0.4 : 0.8,
                verdict: isEvaluator ? "skipped" : isError ? "needs_improvement" : "good",
                result_delivered: !isEvaluator && !isError,
              }),
              JSON.stringify({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, totalTokens: 0, cost: 0 }),
              "[]",
              isEvaluator ? 0 : 1,
              isEvaluator ? 1 : 0,
              Date.now(),
            );
            synced++;
            continue;
          }

          const evaluation = computeEvaluation(meta, sessionDir);
          const usage = loadSessionUsage(sessionDir);

          upsert.run(
            session.sessionId,
            session.agent,
            evaluation.quality,
            evaluation.efficiency,
            evaluation.productiveCalls,
            evaluation.wastedCalls,
            evaluation.verdict,
            JSON.stringify(evaluation.issues),
            JSON.stringify({
              quality: evaluation.quality,
              efficiency: evaluation.efficiency,
              verdict: evaluation.verdict,
              result_delivered: evaluation.verdict !== "skipped" && evaluation.verdict !== "needs_improvement",
            }),
            JSON.stringify(usage),
            "[]",
            evaluation.evaluatedByHeuristic ? 1 : 0,
            evaluation.skippedByJs ? 1 : 0,
            Date.now(),
          );
          synced++;
        } catch (err) {
          errors++;
          console.error(`Error evaluating ${session.sessionId}:`, err);
        }
      }
    });

    transaction();
    console.log(`  Processed batch ${Math.floor(i/BATCH_SIZE) + 1}: ${synced} synced, ${errors} errors`);
  }

  console.log(`\nDone: ${synced} evaluated, ${errors} errors, ${unevaluated.length - synced - errors} skipped`);

  // Verify
  const remaining = db.prepare(
    "SELECT count(*) as cnt FROM sessions WHERE status IN ('done', 'error', 'interrupted') AND sessionId NOT IN (SELECT sessionId FROM evaluations)"
  ).get() as { cnt: number };
  console.log(`Remaining unevaluated: ${remaining.cnt}`);
} finally {
  db.close();
}
