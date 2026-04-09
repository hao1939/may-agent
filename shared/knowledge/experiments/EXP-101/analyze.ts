#!/usr/bin/env bun
/**
 * EXP-101: HVR (Hedge-to-Verify Ratio) Retrospective Analysis
 * 
 * Computes HVR scores across all sessions and tests whether HVR predicts
 * session correctness (binary: correct vs incorrect).
 * 
 * Data sources:
 * - session.jsonl files from .state/sessions/ (assistant text for hedge/verify markers)
 * - meta.json files from .state/sessions/ (agent, status, opCount)
 * - ERROR_LOG.jsonl files from agents/ (FM error codes per session)
 */

import { readdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

// ============================================================
// HEDGE & VERIFY PATTERNS (from design.md / DD-656 adapted)
// ============================================================

const HEDGE_PATTERNS: RegExp[] = [
  /\bmaybe\b/i,
  /\bperhaps\b/i,
  /\bpossibly\b/i,
  /\bnot sure\b/i,
  /\bnot certain\b/i,
  /\bI think\b/i,
  /\bI believe\b/i,
  /\bmight be\b/i,
  /\bcould be\b/i,
  /\balternatively\b/i,
  /\bon the other hand\b/i,
  /\bI'm not confident\b/i,
  /\bunclear\b/i,
  /\bI'm unsure\b/i,
  /\bhard to say\b/i,
  /\bdifficult to determine\b/i,
  /\bwait,?\s/i,
  /\bactually,?\s/i,
  /\bhmm\b/i,
  /\blet me reconsider\b/i,
];

const VERIFY_PATTERNS: RegExp[] = [
  /\blet me (check|verify|confirm|validate|test)\b/i,
  /\bchecking\b/i,
  /\bconfirming\b/i,
  /\bverif(?:y|ied|ying)\b/i,
  /\bvalidat(?:e|ed|ing)\b/i,
  /\blooks correct\b/i,
  /\bmatches\b/i,
  /\bconsistent with\b/i,
  /\bas expected\b/i,
  /\bconfirmed\b/i,
  /\bI can see that\b/i,
  /\bthe output shows\b/i,
  /\bthe (?:test|check|result) (?:pass|show|confirm)\b/i,
];

// ============================================================
// TYPES
// ============================================================

interface SessionData {
  sessionId: string;
  agent: string;
  status: string;
  opCount: number;
  // Text extraction
  assistantText: string;
  assistantTokens: number; // approximate word count
  // Marker counts
  hedgeCount: number;
  verifyCount: number;
  // Computed scores
  hvr: number;
  hedgeRate: number; // per 1000 tokens
  verifyRate: number; // per 1000 tokens
  // Labels
  isCorrect: boolean | null; // null = ambiguous
  hasFmErrors: boolean;
  fmCodes: string[];
  hasFm33: boolean;
  // Per-pattern breakdown
  hedgeBreakdown: Record<string, number>;
  verifyBreakdown: Record<string, number>;
}

// ============================================================
// HELPERS
// ============================================================

function countPatternMatches(text: string, patterns: RegExp[]): { total: number; breakdown: Record<string, number> } {
  let total = 0;
  const breakdown: Record<string, number> = {};
  for (const pattern of patterns) {
    const matches = text.match(new RegExp(pattern.source, "gi"));
    const count = matches ? matches.length : 0;
    total += count;
    breakdown[pattern.source] = count;
  }
  return { total, breakdown };
}

function approximateTokenCount(text: string): number {
  // Simple word-based approximation (1 token ≈ 0.75 words for English)
  return Math.ceil(text.split(/\s+/).filter(w => w.length > 0).length / 0.75);
}

async function extractAssistantText(sessionJsonlPath: string): Promise<string> {
  const content = await readFile(sessionJsonlPath, "utf8");
  const lines = content.trim().split("\n");
  const assistantTexts: string[] = [];

  for (const line of lines) {
    try {
      const msg = JSON.parse(line);
      if (msg.role !== "assistant") continue;

      // Extract text content from assistant messages
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === "text" && typeof block.text === "string") {
            assistantTexts.push(block.text);
          }
          // Skip tool_use blocks — those are tool calls, not reasoning text
        }
      } else if (typeof msg.content === "string") {
        assistantTexts.push(msg.content);
      }
    } catch {
      // Skip malformed lines
    }
  }

  return assistantTexts.join("\n\n");
}

async function loadFmErrors(): Promise<Map<string, Set<string>>> {
  const fmMap = new Map<string, Set<string>>(); // sessionId -> Set<FM code>
  const agentDirs = await readdir("agents");

  for (const agent of agentDirs) {
    const errorLogPath = join("agents", agent, "ERROR_LOG.jsonl");
    try {
      const content = await readFile(errorLogPath, "utf8");
      const lines = content.trim().split("\n");
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          if (obj.context && typeof obj.error === "string" && obj.error.startsWith("FM-")) {
            const fmCode = obj.error.split(":")[0].trim();
            const sid = obj.context;
            if (!fmMap.has(sid)) fmMap.set(sid, new Set());
            fmMap.get(sid)!.add(fmCode);
          }
        } catch {}
      }
    } catch {
      // No ERROR_LOG for this agent
    }
  }

  return fmMap;
}

function computeAUROC(scores: number[], labels: boolean[]): number {
  // Simple AUROC via trapezoidal approximation
  // Higher score = predicted incorrect (higher HVR = more hedging = more doubt)
  const pairs = scores.map((s, i) => ({ score: s, label: labels[i] }));
  // Sort by score descending (highest HVR first = predicted most incorrect)
  pairs.sort((a, b) => b.score - a.score);

  const positives = labels.filter(l => !l).length; // "incorrect" is positive for prediction
  const negatives = labels.filter(l => l).length; // "correct" is negative

  if (positives === 0 || negatives === 0) return NaN;

  let tp = 0, fp = 0;
  let prevTp = 0, prevFp = 0;
  let auc = 0;
  let prevScore = -Infinity;

  for (const { score, label } of pairs) {
    if (score !== prevScore) {
      // Add trapezoid area
      auc += (fp / negatives - prevFp / negatives) * (tp / positives + prevTp / positives) / 2;
      prevTp = tp;
      prevFp = fp;
      prevScore = score;
    }
    if (!label) tp++; // incorrect = positive
    else fp++; // correct = false positive
  }
  // Final trapezoid
  auc += (fp / negatives - prevFp / negatives) * (tp / positives + prevTp / positives) / 2;

  return auc;
}

function computeCalibration(data: SessionData[], bucketCount: number = 5): { bucket: string; count: number; correctPct: number; meanHvr: number }[] {
  const labeled = data.filter(d => d.isCorrect !== null);
  if (labeled.length === 0) return [];

  // Sort by HVR
  labeled.sort((a, b) => a.hvr - b.hvr);
  const bucketSize = Math.ceil(labeled.length / bucketCount);
  const buckets: { bucket: string; count: number; correctPct: number; meanHvr: number }[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const start = i * bucketSize;
    const end = Math.min(start + bucketSize, labeled.length);
    if (start >= labeled.length) break;
    const slice = labeled.slice(start, end);
    const correct = slice.filter(d => d.isCorrect).length;
    const meanHvr = slice.reduce((s, d) => s + d.hvr, 0) / slice.length;
    buckets.push({
      bucket: `Q${i + 1} (HVR ${slice[0].hvr.toFixed(2)}-${slice[slice.length - 1].hvr.toFixed(2)})`,
      count: slice.length,
      correctPct: Math.round((correct / slice.length) * 1000) / 10,
      meanHvr: Math.round(meanHvr * 100) / 100,
    });
  }
  return buckets;
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

// Wilson score interval for binomial proportion (95% CI)
function wilsonCI(successes: number, total: number): { lower: number; upper: number } {
  if (total === 0) return { lower: 0, upper: 0 };
  const z = 1.96;
  const p = successes / total;
  const denom = 1 + z * z / total;
  const center = (p + z * z / (2 * total)) / denom;
  const halfWidth = (z / denom) * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total));
  return { lower: Math.max(0, center - halfWidth), upper: Math.min(1, center + halfWidth) };
}

// ============================================================
// MAIN ANALYSIS
// ============================================================

async function main() {
  console.log("EXP-101: HVR Retrospective Analysis");
  console.log("====================================\n");

  // Load FM errors
  console.log("Loading FM error data...");
  const fmErrors = await loadFmErrors();
  console.log(`  Found FM errors for ${fmErrors.size} sessions`);

  // Load sessions
  console.log("Loading session data...");
  const sessionDirs = (await readdir(".state/sessions")).filter(d => d.startsWith("s_"));
  console.log(`  Found ${sessionDirs.length} session directories`);

  const results: SessionData[] = [];
  let skippedNoJsonl = 0;
  let skippedNoMeta = 0;
  let skippedEmpty = 0;

  for (const sid of sessionDirs) {
    const sessionDir = join(".state/sessions", sid);
    const metaPath = join(sessionDir, "meta.json");
    const jsonlPath = join(sessionDir, "session.jsonl");

    // Load meta
    let meta: any;
    try {
      meta = JSON.parse(await readFile(metaPath, "utf8"));
    } catch {
      skippedNoMeta++;
      continue;
    }

    // Load session.jsonl
    let assistantText: string;
    try {
      assistantText = await extractAssistantText(jsonlPath);
    } catch {
      skippedNoJsonl++;
      continue;
    }

    if (assistantText.trim().length === 0) {
      skippedEmpty++;
      continue;
    }

    // Count markers
    const hedgeResult = countPatternMatches(assistantText, HEDGE_PATTERNS);
    const verifyResult = countPatternMatches(assistantText, VERIFY_PATTERNS);
    const tokens = approximateTokenCount(assistantText);

    // Compute HVR
    const hvr = hedgeResult.total / (verifyResult.total + 1);
    const hedgeRate = tokens > 0 ? (hedgeResult.total / tokens) * 1000 : 0;
    const verifyRate = tokens > 0 ? (verifyResult.total / tokens) * 1000 : 0;

    // Labels
    const sessionFmCodes = fmErrors.has(sid) ? [...fmErrors.get(sid)!] : [];
    const hasFmErrors = sessionFmCodes.length > 0;
    const hasFm33 = sessionFmCodes.includes("FM-3.3");

    // Correctness label (Tier 2: session status-based)
    // "error"/"timeout" = incorrect, "done" + no FM errors = correct, "done" + FM errors = incorrect
    let isCorrect: boolean | null = null;
    if (meta.status === "error" || meta.status === "timeout") {
      isCorrect = false;
    } else if (meta.status === "done") {
      // If we have FM errors for this session, it's incorrect despite "done" status
      isCorrect = hasFmErrors ? false : true;
    } else if (meta.status === "interrupted") {
      isCorrect = false; // Interrupted sessions are not correct
    }
    // Running sessions: null (exclude from analysis)

    results.push({
      sessionId: sid,
      agent: meta.agent || "unknown",
      status: meta.status || "unknown",
      opCount: meta.opCount || 0,
      assistantText,
      assistantTokens: tokens,
      hedgeCount: hedgeResult.total,
      verifyCount: verifyResult.total,
      hvr,
      hedgeRate,
      verifyRate,
      isCorrect,
      hasFmErrors,
      fmCodes: sessionFmCodes,
      hasFm33,
      hedgeBreakdown: hedgeResult.breakdown,
      verifyBreakdown: verifyResult.breakdown,
    });
  }

  console.log(`\nProcessed: ${results.length} sessions`);
  console.log(`  Skipped (no jsonl): ${skippedNoJsonl}`);
  console.log(`  Skipped (no meta): ${skippedNoMeta}`);
  console.log(`  Skipped (empty text): ${skippedEmpty}`);

  // ============================================================
  // WRITE CSV
  // ============================================================

  const csvHeader = "session_id,agent,status,opCount,tokens,hedge_count,verify_count,hvr,hedge_rate,verify_rate,is_correct,has_fm_errors,fm_codes,has_fm33\n";
  const csvRows = results.map(r =>
    `${r.sessionId},${r.agent},${r.status},${r.opCount},${r.assistantTokens},${r.hedgeCount},${r.verifyCount},${r.hvr.toFixed(4)},${r.hedgeRate.toFixed(2)},${r.verifyRate.toFixed(2)},${r.isCorrect === null ? "" : r.isCorrect},${r.hasFmErrors},${r.fmCodes.join("|")},${r.hasFm33}`
  ).join("\n");
  await writeFile("agents/shared/knowledge/experiments/EXP-101/hvr-data.csv", csvHeader + csvRows);
  console.log("\nCSV written to agents/shared/knowledge/experiments/EXP-101/hvr-data.csv");

  // ============================================================
  // AGGREGATE STATISTICS
  // ============================================================

  const labeled = results.filter(r => r.isCorrect !== null);
  const correct = labeled.filter(r => r.isCorrect === true);
  const incorrect = labeled.filter(r => r.isCorrect === false);

  console.log("\n========================================");
  console.log("AGGREGATE STATISTICS");
  console.log("========================================");
  console.log(`Total analyzed: ${results.length}`);
  console.log(`Labeled: ${labeled.length} (correct: ${correct.length}, incorrect: ${incorrect.length})`);
  console.log(`Unlabeled (running): ${results.length - labeled.length}`);
  console.log(`Base rate correctness: ${(correct.length / labeled.length * 100).toFixed(1)}%`);

  // Overall hedge/verify stats
  console.log(`\nHedge counts: mean=${mean(results.map(r => r.hedgeCount)).toFixed(1)}, median=${median(results.map(r => r.hedgeCount)).toFixed(1)}, stddev=${stddev(results.map(r => r.hedgeCount)).toFixed(1)}`);
  console.log(`Verify counts: mean=${mean(results.map(r => r.verifyCount)).toFixed(1)}, median=${median(results.map(r => r.verifyCount)).toFixed(1)}, stddev=${stddev(results.map(r => r.verifyCount)).toFixed(1)}`);
  console.log(`HVR: mean=${mean(results.map(r => r.hvr)).toFixed(3)}, median=${median(results.map(r => r.hvr)).toFixed(3)}, stddev=${stddev(results.map(r => r.hvr)).toFixed(3)}`);

  // ============================================================
  // STEP 2: ZERO-HEDGE GATE ANALYSIS
  // ============================================================

  console.log("\n========================================");
  console.log("ZERO-HEDGE GATE ANALYSIS");
  console.log("========================================");

  const zeroHedge = labeled.filter(r => r.hedgeCount === 0);
  const hasHedge = labeled.filter(r => r.hedgeCount > 0);

  const zeroHedgeCorrect = zeroHedge.filter(r => r.isCorrect === true).length;
  const hasHedgeCorrect = hasHedge.filter(r => r.isCorrect === true).length;

  const zeroHedgePrecision = zeroHedge.length > 0 ? zeroHedgeCorrect / zeroHedge.length : 0;
  const zeroHedgeCoverage = zeroHedge.length / labeled.length;
  const hasHedgeCorrectRate = hasHedge.length > 0 ? hasHedgeCorrect / hasHedge.length : 0;

  const zeroHedgeCI = wilsonCI(zeroHedgeCorrect, zeroHedge.length);
  const hasHedgeCI = wilsonCI(hasHedgeCorrect, hasHedge.length);

  console.log(`Zero-hedge sessions: ${zeroHedge.length} (${(zeroHedgeCoverage * 100).toFixed(1)}% coverage)`);
  console.log(`  Correct: ${zeroHedgeCorrect}/${zeroHedge.length} = ${(zeroHedgePrecision * 100).toFixed(1)}% precision`);
  console.log(`  95% CI: [${(zeroHedgeCI.lower * 100).toFixed(1)}%, ${(zeroHedgeCI.upper * 100).toFixed(1)}%]`);
  console.log(`Has-hedge sessions: ${hasHedge.length}`);
  console.log(`  Correct: ${hasHedgeCorrect}/${hasHedge.length} = ${(hasHedgeCorrectRate * 100).toFixed(1)}%`);
  console.log(`  95% CI: [${(hasHedgeCI.lower * 100).toFixed(1)}%, ${(hasHedgeCI.upper * 100).toFixed(1)}%]`);
  console.log(`\nSELFDOUBT baseline: precision 96.1%, coverage 25.4%`);

  // ============================================================
  // STEP 3: HVR DISCRIMINATION (AUROC)
  // ============================================================

  console.log("\n========================================");
  console.log("HVR DISCRIMINATION (AUROC)");
  console.log("========================================");

  const labeledHvrs = labeled.map(r => r.hvr);
  const labeledCorrectness = labeled.map(r => r.isCorrect!);
  const auroc = computeAUROC(labeledHvrs, labeledCorrectness);

  // Also compute AUROC for opCount and session length as baselines
  const aurocOpCount = computeAUROC(labeled.map(r => r.opCount), labeledCorrectness);
  const aurocTokens = computeAUROC(labeled.map(r => r.assistantTokens), labeledCorrectness);
  const aurocHedgeRate = computeAUROC(labeled.map(r => r.hedgeRate), labeledCorrectness);
  const aurocVerifyRate = computeAUROC(
    labeled.map(r => -r.verifyRate), // Negate: more verify = less incorrect
    labeledCorrectness
  );

  console.log(`HVR AUROC (predicting incorrectness): ${auroc.toFixed(4)}`);
  console.log(`Hedge rate AUROC: ${aurocHedgeRate.toFixed(4)}`);
  console.log(`Verify rate AUROC (negated): ${aurocVerifyRate.toFixed(4)}`);
  console.log(`OpCount AUROC: ${aurocOpCount.toFixed(4)}`);
  console.log(`Token count AUROC: ${aurocTokens.toFixed(4)}`);
  console.log(`Random baseline: 0.5000`);

  // Calibration curve
  console.log("\nCalibration curve (HVR quintiles → correctness %):");
  const calibration = computeCalibration(labeled);
  for (const b of calibration) {
    const bar = "█".repeat(Math.round(b.correctPct / 2));
    console.log(`  ${b.bucket.padEnd(30)} n=${String(b.count).padStart(4)}  correct=${String(b.correctPct).padStart(5)}%  ${bar}`);
  }

  // ============================================================
  // STEP 4: FM-3.3 PREDICTION
  // ============================================================

  console.log("\n========================================");
  console.log("FM-3.3 PREDICTION");
  console.log("========================================");

  const fm33Sessions = results.filter(r => r.hasFm33);
  const noFm33Sessions = results.filter(r => !r.hasFm33 && r.hasFmErrors);
  const cleanSessions = results.filter(r => !r.hasFmErrors && r.status === "done");

  console.log(`FM-3.3 sessions: ${fm33Sessions.length}`);
  console.log(`Other FM errors (no FM-3.3): ${noFm33Sessions.length}`);
  console.log(`Clean sessions (done, no FM): ${cleanSessions.length}`);

  if (fm33Sessions.length > 0 && cleanSessions.length > 0) {
    console.log(`\nHVR comparison:`);
    console.log(`  FM-3.3 sessions: mean HVR=${mean(fm33Sessions.map(r => r.hvr)).toFixed(3)}, median=${median(fm33Sessions.map(r => r.hvr)).toFixed(3)}`);
    console.log(`  Other FM sessions: mean HVR=${mean(noFm33Sessions.map(r => r.hvr)).toFixed(3)}, median=${median(noFm33Sessions.map(r => r.hvr)).toFixed(3)}`);
    console.log(`  Clean sessions: mean HVR=${mean(cleanSessions.map(r => r.hvr)).toFixed(3)}, median=${median(cleanSessions.map(r => r.hvr)).toFixed(3)}`);

    console.log(`\nHedge rate comparison:`);
    console.log(`  FM-3.3 sessions: mean=${mean(fm33Sessions.map(r => r.hedgeRate)).toFixed(2)}/1k tokens`);
    console.log(`  Other FM sessions: mean=${mean(noFm33Sessions.map(r => r.hedgeRate)).toFixed(2)}/1k tokens`);
    console.log(`  Clean sessions: mean=${mean(cleanSessions.map(r => r.hedgeRate)).toFixed(2)}/1k tokens`);

    console.log(`\nVerify rate comparison:`);
    console.log(`  FM-3.3 sessions: mean=${mean(fm33Sessions.map(r => r.verifyRate)).toFixed(2)}/1k tokens`);
    console.log(`  Other FM sessions: mean=${mean(noFm33Sessions.map(r => r.verifyRate)).toFixed(2)}/1k tokens`);
    console.log(`  Clean sessions: mean=${mean(cleanSessions.map(r => r.verifyRate)).toFixed(2)}/1k tokens`);

    // AUROC: HVR predicting FM-3.3 (among all sessions with known label)
    const fm33Labeled = results.filter(r => r.hasFm33 || (!r.hasFmErrors && r.status === "done"));
    if (fm33Labeled.length > 10) {
      const fm33Auroc = computeAUROC(
        fm33Labeled.map(r => r.hvr),
        fm33Labeled.map(r => !r.hasFm33) // correct = no FM-3.3
      );
      console.log(`\nAUROC (HVR → FM-3.3 prediction): ${fm33Auroc.toFixed(4)}`);
    }
  }

  // ============================================================
  // STEP 5: AGENT-LEVEL ANALYSIS
  // ============================================================

  console.log("\n========================================");
  console.log("AGENT-LEVEL ANALYSIS");
  console.log("========================================");

  const agents = [...new Set(results.map(r => r.agent))].sort();
  const agentStats: any[] = [];

  for (const agent of agents) {
    const agentResults = results.filter(r => r.agent === agent);
    const agentLabeled = agentResults.filter(r => r.isCorrect !== null);
    const agentCorrect = agentLabeled.filter(r => r.isCorrect === true);
    const agentZeroHedge = agentLabeled.filter(r => r.hedgeCount === 0);
    const agentZeroHedgeCorrect = agentZeroHedge.filter(r => r.isCorrect === true);

    let agentAuroc = NaN;
    if (agentLabeled.length >= 10) {
      agentAuroc = computeAUROC(
        agentLabeled.map(r => r.hvr),
        agentLabeled.map(r => r.isCorrect!)
      );
    }

    const stat = {
      agent,
      total: agentResults.length,
      labeled: agentLabeled.length,
      correctRate: agentLabeled.length > 0 ? (agentCorrect.length / agentLabeled.length * 100).toFixed(1) : "N/A",
      meanHvr: mean(agentResults.map(r => r.hvr)).toFixed(3),
      medianHvr: median(agentResults.map(r => r.hvr)).toFixed(3),
      meanHedgeRate: mean(agentResults.map(r => r.hedgeRate)).toFixed(2),
      meanVerifyRate: mean(agentResults.map(r => r.verifyRate)).toFixed(2),
      zeroHedgeCount: agentZeroHedge.length,
      zeroHedgePrecision: agentZeroHedge.length > 0 ? (agentZeroHedgeCorrect.length / agentZeroHedge.length * 100).toFixed(1) : "N/A",
      zeroHedgeCoverage: agentLabeled.length > 0 ? (agentZeroHedge.length / agentLabeled.length * 100).toFixed(1) : "N/A",
      auroc: isNaN(agentAuroc) ? "N/A" : agentAuroc.toFixed(4),
      fm33Count: agentResults.filter(r => r.hasFm33).length,
    };
    agentStats.push(stat);

    console.log(`\n${agent} (n=${stat.total}, labeled=${stat.labeled}):`);
    console.log(`  Correct rate: ${stat.correctRate}%`);
    console.log(`  Mean HVR: ${stat.meanHvr} (median: ${stat.medianHvr})`);
    console.log(`  Hedge rate: ${stat.meanHedgeRate}/1k tokens, Verify rate: ${stat.meanVerifyRate}/1k tokens`);
    console.log(`  Zero-hedge: ${stat.zeroHedgeCount} (${stat.zeroHedgeCoverage}% coverage, ${stat.zeroHedgePrecision}% precision)`);
    console.log(`  AUROC: ${stat.auroc}`);
    console.log(`  FM-3.3 sessions: ${stat.fm33Count}`);
  }

  // ============================================================
  // MOST COMMON HEDGE/VERIFY PATTERNS
  // ============================================================

  console.log("\n========================================");
  console.log("MOST COMMON PATTERNS");
  console.log("========================================");

  const hedgeTotals: Record<string, number> = {};
  const verifyTotals: Record<string, number> = {};
  for (const r of results) {
    for (const [pat, count] of Object.entries(r.hedgeBreakdown)) {
      hedgeTotals[pat] = (hedgeTotals[pat] || 0) + count;
    }
    for (const [pat, count] of Object.entries(r.verifyBreakdown)) {
      verifyTotals[pat] = (verifyTotals[pat] || 0) + count;
    }
  }

  console.log("\nTop hedge patterns:");
  Object.entries(hedgeTotals).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .forEach(([pat, count]) => console.log(`  ${count.toString().padStart(6)} ${pat}`));

  console.log("\nTop verify patterns:");
  Object.entries(verifyTotals).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .forEach(([pat, count]) => console.log(`  ${count.toString().padStart(6)} ${pat}`));

  // ============================================================
  // PER-PATTERN DISCRIMINATION
  // ============================================================

  // Check if excluding "I think" / "actually" (potentially ubiquitous) changes AUROC
  console.log("\n========================================");
  console.log("SENSITIVITY ANALYSIS: PATTERN EXCLUSIONS");
  console.log("========================================");

  const exclusionSets: { name: string; excludePatterns: string[] }[] = [
    { name: "Exclude 'I think'", excludePatterns: ["\\bI think\\b"] },
    { name: "Exclude 'actually'", excludePatterns: ["\\bactually,?\\s"] },
    { name: "Exclude 'I think' + 'actually'", excludePatterns: ["\\bI think\\b", "\\bactually,?\\s"] },
    { name: "Exclude 'I think' + 'actually' + 'wait'", excludePatterns: ["\\bI think\\b", "\\bactually,?\\s", "\\bwait,?\\s"] },
  ];

  for (const excl of exclusionSets) {
    const adjustedHvrs = labeled.map(r => {
      let adjustedHedge = r.hedgeCount;
      for (const pat of excl.excludePatterns) {
        adjustedHedge -= (r.hedgeBreakdown[pat] || 0);
      }
      return Math.max(0, adjustedHedge) / (r.verifyCount + 1);
    });
    const adjAuroc = computeAUROC(adjustedHvrs, labeled.map(r => r.isCorrect!));
    const adjZeroCount = adjustedHvrs.filter(h => h === 0).length;
    // Recompute zero-hedge precision with adjusted counts
    const adjZeroCorrect = labeled.filter((r, i) => adjustedHvrs[i] === 0 && r.isCorrect === true).length;
    const adjZeroPrecision = adjZeroCount > 0 ? adjZeroCorrect / adjZeroCount : 0;

    console.log(`${excl.name}:`);
    console.log(`  AUROC: ${adjAuroc.toFixed(4)}, Zero-hedge: ${adjZeroCount} (${(adjZeroPrecision * 100).toFixed(1)}% precision, ${(adjZeroCount / labeled.length * 100).toFixed(1)}% coverage)`);
  }

  // ============================================================
  // SUMMARY OUTPUT
  // ============================================================

  const summary = {
    totalSessions: results.length,
    labeledSessions: labeled.length,
    correctCount: correct.length,
    incorrectCount: incorrect.length,
    baseRate: correct.length / labeled.length,
    zeroHedge: {
      count: zeroHedge.length,
      coverage: zeroHedgeCoverage,
      precision: zeroHedgePrecision,
      ci95: zeroHedgeCI,
    },
    hasHedge: {
      count: hasHedge.length,
      correctRate: hasHedgeCorrectRate,
      ci95: hasHedgeCI,
    },
    auroc: {
      hvr: auroc,
      hedgeRate: aurocHedgeRate,
      opCount: aurocOpCount,
      tokenCount: aurocTokens,
    },
    agentStats,
    fm33: {
      count: fm33Sessions.length,
      meanHvr: fm33Sessions.length > 0 ? mean(fm33Sessions.map(r => r.hvr)) : null,
      cleanMeanHvr: cleanSessions.length > 0 ? mean(cleanSessions.map(r => r.hvr)) : null,
    },
  };

  await writeFile(
    "agents/shared/knowledge/experiments/EXP-101/summary.json",
    JSON.stringify(summary, null, 2)
  );
  console.log("\nSummary written to agents/shared/knowledge/experiments/EXP-101/summary.json");

  // Output for results.md generation
  console.log("\n\n========== RAW DATA FOR RESULTS.MD ==========");
  console.log(JSON.stringify(summary));
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
