// EXP-101: HVR (Hedge-to-Verify Ratio) Validation on Agent Session Logs
// Parses session.jsonl files, extracts assistant-only text,
// applies hedge/verify regex markers, joins with evaluation data from may.db,
// and computes aggregate statistics + AUROC.

import { Database } from "bun:sqlite";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

// ─── Marker Patterns ─────────────────────────────────────────────
const HEDGE_PATTERNS: RegExp[] = [
  /\bmaybe\b/gi,
  /\bperhaps\b/gi,
  /\bpossibly\b/gi,
  /\bnot sure\b/gi,
  /\bnot certain\b/gi,
  /\bI think\b/gi,
  /\bI believe\b/gi,
  /\bmight be\b/gi,
  /\bcould be\b/gi,
  /\balternatively\b/gi,
  /\bon the other hand\b/gi,
  /\bI'm not confident\b/gi,
  /\bunclear\b/gi,
  /\bI'm unsure\b/gi,
  /\bhard to say\b/gi,
  /\bdifficult to determine\b/gi,
  /\bwait,?\s/gi,
  /\bactually,?\s/gi,
  /\bhmm\b/gi,
  /\blet me reconsider\b/gi,
];

const VERIFY_PATTERNS: RegExp[] = [
  /\blet me (?:check|verify|confirm|validate|test)\b/gi,
  /\bchecking\b/gi,
  /\bconfirming\b/gi,
  /\bverif(?:y|ied|ying)\b/gi,
  /\bvalidat(?:e|ed|ing)\b/gi,
  /\blooks correct\b/gi,
  /\bmatches\b/gi,
  /\bconsistent with\b/gi,
  /\bas expected\b/gi,
  /\bconfirmed\b/gi,
  /\bI can see that\b/gi,
  /\bthe output shows\b/gi,
  /\bthe (?:test|check|result) (?:pass|show|confirm)\b/gi,
];

function countMatches(text: string, patterns: RegExp[]): number {
  let total = 0;
  for (const pat of patterns) {
    // Reset lastIndex for global regexes
    pat.lastIndex = 0;
    const matches = text.match(pat);
    if (matches) total += matches.length;
  }
  return total;
}

// Simple token count (whitespace split)
function tokenCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// ─── Data Types ──────────────────────────────────────────────────
interface SessionData {
  sessionId: string;
  agent: string;
  metaStatus: string; // done/error/interrupted
  assistantText: string;
  tokens: number;
  hedgeCount: number;
  verifyCount: number;
  hvr: number;
  hedgeRate: number; // per 1000 tokens
  verifyRate: number;
  // Labels
  evalQuality: number | null;
  evalVerdict: string | null;
  evalEfficiency: number | null;
  finishStatus: string | null; // success/failure/partial/blocked from finish() call
  // Derived binary label
  label: "correct" | "incorrect" | "ambiguous";
}

// ─── Parse Sessions ──────────────────────────────────────────────
function extractAssistantText(sessionDir: string): string {
  const filePath = join(sessionDir, "session.jsonl");
  if (!existsSync(filePath)) return "";
  
  const lines = readFileSync(filePath, "utf8").trim().split("\n");
  const textParts: string[] = [];
  
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.role !== "assistant") continue;
      if (!Array.isArray(obj.content)) continue;
      
      for (const part of obj.content) {
        // Only extract text content, NOT tool calls or tool results
        if (part.type === "text" && typeof part.text === "string") {
          textParts.push(part.text);
        }
      }
    } catch {
      // Skip malformed lines
    }
  }
  
  return textParts.join("\n");
}

function extractFinishStatus(sessionDir: string): string | null {
  const filePath = join(sessionDir, "session.jsonl");
  if (!existsSync(filePath)) return null;
  
  const lines = readFileSync(filePath, "utf8").trim().split("\n");
  let lastFinishStatus: string | null = null;
  
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.role !== "assistant" || !Array.isArray(obj.content)) continue;
      
      for (const part of obj.content) {
        if (part.type === "toolCall" && part.name === "finish") {
          try {
            const args = typeof part.arguments === "string" 
              ? JSON.parse(part.arguments) 
              : part.arguments;
            if (args?.status) lastFinishStatus = args.status;
          } catch {}
        }
      }
    } catch {}
  }
  
  return lastFinishStatus;
}

// ─── Main ────────────────────────────────────────────────────────
const sessionsDir = ".state/sessions";
const dbPath = ".state/may.db";

console.log("=== EXP-101: HVR Validation Analysis ===\n");

// Load evaluation data from may.db
const db = new Database(dbPath, { readonly: true });
const evalMap = new Map<string, { quality: number; verdict: string; efficiency: number }>();

const evalRows = db.query(
  "SELECT sessionId, quality, verdict, efficiency FROM evaluations WHERE verdict != 'skipped'"
).all() as Array<{ sessionId: string; quality: number; verdict: string; efficiency: number }>;

for (const row of evalRows) {
  evalMap.set(row.sessionId, { quality: row.quality, verdict: row.verdict, efficiency: row.efficiency });
}
console.log(`Loaded ${evalMap.size} evaluations from may.db`);

// Load meta data from may.db sessions table
const metaMap = new Map<string, { agent: string; status: string }>();
const metaRows = db.query("SELECT sessionId, agent, status FROM sessions").all() as Array<{ sessionId: string; agent: string; status: string }>;
for (const row of metaRows) {
  metaMap.set(row.sessionId, { agent: row.agent, status: row.status });
}

// Process all sessions
const sessionDirs = readdirSync(sessionsDir).filter(d => d.startsWith("s_"));
console.log(`Found ${sessionDirs.length} session directories\n`);

const results: SessionData[] = [];
let parseErrors = 0;
let emptyText = 0;

for (const dir of sessionDirs) {
  const sessionPath = join(sessionsDir, dir);
  
  // Get meta (from DB first, then fallback to file)
  let agent = "unknown";
  let metaStatus = "unknown";
  
  const dbMeta = metaMap.get(dir);
  if (dbMeta) {
    agent = dbMeta.agent;
    metaStatus = dbMeta.status;
  } else {
    // Fallback: parse meta.json
    try {
      const meta = JSON.parse(readFileSync(join(sessionPath, "meta.json"), "utf8"));
      agent = meta.agent || "unknown";
      metaStatus = meta.status || "unknown";
    } catch { parseErrors++; }
  }
  
  // Extract assistant text
  const text = extractAssistantText(sessionPath);
  if (!text || text.length < 10) {
    emptyText++;
    continue;
  }
  
  const tokens = tokenCount(text);
  if (tokens < 5) {
    emptyText++;
    continue;
  }
  
  // Count markers
  const hedgeCount = countMatches(text, HEDGE_PATTERNS);
  const verifyCount = countMatches(text, VERIFY_PATTERNS);
  const hvr = hedgeCount / (verifyCount + 1);
  const hedgeRate = (hedgeCount / tokens) * 1000;
  const verifyRate = (verifyCount / tokens) * 1000;
  
  // Get evaluation labels
  const evalData = evalMap.get(dir);
  const finishStatus = extractFinishStatus(sessionPath);
  
  // Derive binary label
  let label: "correct" | "incorrect" | "ambiguous" = "ambiguous";
  if (evalData) {
    if (evalData.quality >= 4 && evalData.verdict === "good") {
      label = "correct";
    } else if (evalData.quality <= 2 && evalData.verdict === "needs_improvement") {
      label = "incorrect";
    } else if (evalData.quality >= 4) {
      label = "correct";
    } else if (evalData.quality <= 1) {
      label = "incorrect";
    }
    // Also use verdict
    if (label === "ambiguous") {
      if (evalData.verdict === "good") label = "correct";
      else if (evalData.verdict === "needs_improvement") label = "incorrect";
    }
  }
  
  // Fallback: use finish status + meta status
  if (label === "ambiguous") {
    if (finishStatus === "failure") label = "incorrect";
    else if (metaStatus === "error") label = "incorrect";
  }
  
  results.push({
    sessionId: dir,
    agent,
    metaStatus,
    assistantText: "", // Don't store full text in memory
    tokens,
    hedgeCount,
    verifyCount,
    hvr,
    hedgeRate,
    verifyRate,
    evalQuality: evalData?.quality ?? null,
    evalVerdict: evalData?.verdict ?? null,
    evalEfficiency: evalData?.efficiency ?? null,
    finishStatus,
    label,
  });
}

console.log(`Parsed ${results.length} sessions (${parseErrors} meta errors, ${emptyText} empty/short texts)\n`);

// ─── Step 2: Zero-Hedge Gate Analysis ────────────────────────────
console.log("=== STEP 2: Zero-Hedge Gate Analysis ===\n");

const labeled = results.filter(r => r.label !== "ambiguous");
const zeroHedge = labeled.filter(r => r.hedgeCount === 0);
const hasHedge = labeled.filter(r => r.hedgeCount > 0);

const zeroHedgeCorrect = zeroHedge.filter(r => r.label === "correct").length;
const zeroHedgePrecision = zeroHedge.length > 0 ? zeroHedgeCorrect / zeroHedge.length : 0;
const zeroHedgeCoverage = labeled.length > 0 ? zeroHedge.length / labeled.length : 0;

const hasHedgeCorrect = hasHedge.filter(r => r.label === "correct").length;
const hasHedgePrecision = hasHedge.length > 0 ? hasHedgeCorrect / hasHedge.length : 0;

console.log(`Labeled sessions: ${labeled.length} (correct: ${labeled.filter(r => r.label === "correct").length}, incorrect: ${labeled.filter(r => r.label === "incorrect").length})`);
console.log(`Zero-hedge sessions: ${zeroHedge.length} (${(zeroHedgeCoverage * 100).toFixed(1)}% coverage)`);
console.log(`  Precision (correct given zero-hedge): ${(zeroHedgePrecision * 100).toFixed(1)}% (${zeroHedgeCorrect}/${zeroHedge.length})`);
console.log(`Has-hedge sessions: ${hasHedge.length}`);
console.log(`  Correctness rate: ${(hasHedgePrecision * 100).toFixed(1)}% (${hasHedgeCorrect}/${hasHedge.length})`);
console.log(`  Lift (zero-hedge - has-hedge): ${((zeroHedgePrecision - hasHedgePrecision) * 100).toFixed(1)}pp`);

// ─── Step 3: HVR Discrimination (AUROC) ─────────────────────────
console.log("\n=== STEP 3: HVR AUROC Analysis ===\n");

// AUROC: probability that a randomly chosen correct session has LOWER HVR than a randomly chosen incorrect session
// (lower HVR = more confident = more likely correct)
function computeAUROC(data: { score: number; label: boolean }[]): number {
  // label: true = correct (positive)
  // We want: P(score_correct < score_incorrect) — lower HVR should mean correct
  // So we NEGATE the score: use -HVR so higher = more likely correct
  const positives = data.filter(d => d.label).map(d => -d.score);
  const negatives = data.filter(d => !d.label).map(d => -d.score);
  
  if (positives.length === 0 || negatives.length === 0) return 0.5;
  
  let concordant = 0;
  let tied = 0;
  
  for (const p of positives) {
    for (const n of negatives) {
      if (p > n) concordant++;
      else if (p === n) tied++;
    }
  }
  
  return (concordant + 0.5 * tied) / (positives.length * negatives.length);
}

// Use hedge rate (per 1000 tokens) as the score for AUROC
const aurocData = labeled.map(r => ({
  score: r.hedgeRate,
  label: r.label === "correct",
}));

const auroc = computeAUROC(aurocData);
console.log(`AUROC (hedgeRate vs correctness): ${auroc.toFixed(4)}`);

// Also compute for HVR
const aurocHVR = computeAUROC(labeled.map(r => ({
  score: r.hvr,
  label: r.label === "correct",
})));
console.log(`AUROC (HVR vs correctness): ${aurocHVR.toFixed(4)}`);

// Compare against baselines
const aurocTokens = computeAUROC(labeled.map(r => ({
  score: r.tokens, // longer sessions might be worse
  label: r.label === "correct",
})));
console.log(`AUROC (session length vs correctness): ${aurocTokens.toFixed(4)}`);

const aurocVerifyRate = computeAUROC(labeled.map(r => ({
  score: -r.verifyRate, // more verification → more correct? (negate since higher=better)
  label: r.label === "correct",
})));
console.log(`AUROC (verifyRate vs correctness): ${aurocVerifyRate.toFixed(4)}`);

// ─── HVR Calibration Buckets ────────────────────────────────────
console.log("\n=== HVR Calibration Buckets ===\n");
const buckets = [
  { name: "HVR=0 (zero-hedge)", min: 0, max: 0.001 },
  { name: "HVR 0-0.5 (verify-dominant)", min: 0.001, max: 0.5 },
  { name: "HVR 0.5-1.0 (balanced)", min: 0.5, max: 1.0 },
  { name: "HVR 1.0-3.0 (hedge-dominant)", min: 1.0, max: 3.0 },
  { name: "HVR >3.0 (heavy hedging)", min: 3.0, max: Infinity },
];

for (const bucket of buckets) {
  const inBucket = labeled.filter(r => r.hvr >= bucket.min && r.hvr < bucket.max);
  const correct = inBucket.filter(r => r.label === "correct").length;
  const pct = inBucket.length > 0 ? (correct / inBucket.length * 100).toFixed(1) : "N/A";
  console.log(`  ${bucket.name}: ${inBucket.length} sessions, ${pct}% correct (${correct}/${inBucket.length})`);
}

// ─── Step 4: FM-3.3 Analysis ────────────────────────────────────
console.log("\n=== STEP 4: FM-3.3 Analysis (from finish status) ===\n");

// We can use finish status as a proxy: sessions where finish was "failure" or "blocked" 
// may relate to verification failures
const withFinish = results.filter(r => r.finishStatus !== null);
const successFinish = withFinish.filter(r => r.finishStatus === "success");
const failFinish = withFinish.filter(r => r.finishStatus !== "success");

console.log(`Sessions with finish() calls: ${withFinish.length}`);
console.log(`  Success: ${successFinish.length}, Non-success: ${failFinish.length}`);

if (successFinish.length > 0 && failFinish.length > 0) {
  const successHedgeRate = successFinish.reduce((s, r) => s + r.hedgeRate, 0) / successFinish.length;
  const failHedgeRate = failFinish.reduce((s, r) => s + r.hedgeRate, 0) / failFinish.length;
  const successVerifyRate = successFinish.reduce((s, r) => s + r.verifyRate, 0) / successFinish.length;
  const failVerifyRate = failFinish.reduce((s, r) => s + r.verifyRate, 0) / failFinish.length;
  const successHVR = successFinish.reduce((s, r) => s + r.hvr, 0) / successFinish.length;
  const failHVR = failFinish.reduce((s, r) => s + r.hvr, 0) / failFinish.length;
  
  console.log(`\nFinish-success: mean hedgeRate=${successHedgeRate.toFixed(2)}, verifyRate=${successVerifyRate.toFixed(2)}, HVR=${successHVR.toFixed(3)}`);
  console.log(`Finish-fail:    mean hedgeRate=${failHedgeRate.toFixed(2)}, verifyRate=${failVerifyRate.toFixed(2)}, HVR=${failHVR.toFixed(3)}`);
}

// Check sessions with "needs_improvement" verdict specifically — closest proxy to FM-3.3
const needsImprove = results.filter(r => r.evalVerdict === "needs_improvement");
const goodVerdict = results.filter(r => r.evalVerdict === "good");

if (needsImprove.length > 0 && goodVerdict.length > 0) {
  const niHedgeRate = needsImprove.reduce((s, r) => s + r.hedgeRate, 0) / needsImprove.length;
  const goodHedgeRate = goodVerdict.reduce((s, r) => s + r.hedgeRate, 0) / goodVerdict.length;
  const niVerifyRate = needsImprove.reduce((s, r) => s + r.verifyRate, 0) / needsImprove.length;
  const goodVerifyRate = goodVerdict.reduce((s, r) => s + r.verifyRate, 0) / goodVerdict.length;
  const niHVR = needsImprove.reduce((s, r) => s + r.hvr, 0) / needsImprove.length;
  const goodHVR = goodVerdict.reduce((s, r) => s + r.hvr, 0) / goodVerdict.length;
  
  console.log(`\nNeeds-improvement (N=${needsImprove.length}): mean hedgeRate=${niHedgeRate.toFixed(2)}, verifyRate=${niVerifyRate.toFixed(2)}, HVR=${niHVR.toFixed(3)}`);
  console.log(`Good verdict (N=${goodVerdict.length}):         mean hedgeRate=${goodHedgeRate.toFixed(2)}, verifyRate=${goodVerifyRate.toFixed(2)}, HVR=${goodHVR.toFixed(3)}`);
  
  // AUROC: needs_improvement as "positive" (we want to detect these)
  const fmData = [...needsImprove, ...goodVerdict].map(r => ({
    score: r.hedgeRate,
    label: r.evalVerdict === "needs_improvement",
  }));
  const fmAuroc = computeAUROC(fmData);
  console.log(`AUROC (hedgeRate predicting needs_improvement vs good): ${fmAuroc.toFixed(4)}`);
}

// ─── Step 5: Per-Agent Breakdown ─────────────────────────────────
console.log("\n=== STEP 5: Per-Agent Breakdown ===\n");

const agents = [...new Set(results.map(r => r.agent))].sort();
console.log("Agent           |  N  | Hedge/1k | Verify/1k |  HVR  | Zero-H% | Labeled | Correct% | AUROC");
console.log("----------------|-----|----------|-----------|-------|---------|---------|----------|------");

for (const a of agents) {
  const agentSessions = results.filter(r => r.agent === a);
  const n = agentSessions.length;
  const avgHedge = agentSessions.reduce((s, r) => s + r.hedgeRate, 0) / n;
  const avgVerify = agentSessions.reduce((s, r) => s + r.verifyRate, 0) / n;
  const avgHVR = agentSessions.reduce((s, r) => s + r.hvr, 0) / n;
  const zeroH = agentSessions.filter(r => r.hedgeCount === 0).length;
  const zeroHPct = (zeroH / n * 100).toFixed(0);
  
  const agentLabeled = agentSessions.filter(r => r.label !== "ambiguous");
  const agentCorrect = agentLabeled.filter(r => r.label === "correct").length;
  const correctPct = agentLabeled.length > 0 ? (agentCorrect / agentLabeled.length * 100).toFixed(0) : "N/A";
  
  let agentAuroc = "N/A";
  if (agentLabeled.length >= 10) {
    const d = agentLabeled.map(r => ({ score: r.hedgeRate, label: r.label === "correct" }));
    const hasPos = d.some(x => x.label);
    const hasNeg = d.some(x => !x.label);
    if (hasPos && hasNeg) {
      agentAuroc = computeAUROC(d).toFixed(3);
    }
  }
  
  const name = a.padEnd(16);
  console.log(`${name}| ${String(n).padStart(3)} | ${avgHedge.toFixed(2).padStart(8)} | ${avgVerify.toFixed(2).padStart(9)} | ${avgHVR.toFixed(2).padStart(5)} | ${zeroHPct.padStart(6)}% | ${String(agentLabeled.length).padStart(7)} | ${String(correctPct).padStart(7)}% | ${agentAuroc}`);
}

// ─── Summary Statistics ──────────────────────────────────────────
console.log("\n=== SUMMARY STATISTICS ===\n");

const allHedgeRates = results.map(r => r.hedgeRate).sort((a, b) => a - b);
const allVerifyRates = results.map(r => r.verifyRate).sort((a, b) => a - b);
const allHVRs = results.map(r => r.hvr).sort((a, b) => a - b);
const allTokens = results.map(r => r.tokens).sort((a, b) => a - b);

function percentile(arr: number[], p: number): number {
  const idx = Math.floor(arr.length * p / 100);
  return arr[Math.min(idx, arr.length - 1)];
}

function median(arr: number[]): number {
  return percentile(arr, 50);
}

function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

console.log(`Total sessions analyzed: ${results.length}`);
console.log(`Sessions with eval labels: ${results.filter(r => r.evalQuality !== null).length}`);
console.log(`Sessions with finish() status: ${results.filter(r => r.finishStatus !== null).length}`);
console.log(`Labeled (correct/incorrect): ${labeled.length}`);
console.log();
console.log(`Tokens:     mean=${mean(allTokens).toFixed(0)}, median=${median(allTokens)}, p25=${percentile(allTokens, 25)}, p75=${percentile(allTokens, 75)}`);
console.log(`Hedge/1k:   mean=${mean(allHedgeRates).toFixed(2)}, median=${median(allHedgeRates).toFixed(2)}, p25=${percentile(allHedgeRates, 25).toFixed(2)}, p75=${percentile(allHedgeRates, 75).toFixed(2)}`);
console.log(`Verify/1k:  mean=${mean(allVerifyRates).toFixed(2)}, median=${median(allVerifyRates).toFixed(2)}, p25=${percentile(allVerifyRates, 25).toFixed(2)}, p75=${percentile(allVerifyRates, 75).toFixed(2)}`);
console.log(`HVR:        mean=${mean(allHVRs).toFixed(3)}, median=${median(allHVRs).toFixed(3)}, p25=${percentile(allHVRs, 25).toFixed(3)}, p75=${percentile(allHVRs, 75).toFixed(3)}`);
console.log(`Zero-hedge sessions: ${results.filter(r => r.hedgeCount === 0).length} (${(results.filter(r => r.hedgeCount === 0).length / results.length * 100).toFixed(1)}%)`);

// ─── P(H) Update Assessment ─────────────────────────────────────
console.log("\n=== P(H-094) UPDATE ASSESSMENT ===\n");

const zhPrec = zeroHedgePrecision;
const zhCov = zeroHedgeCoverage;

console.log(`Zero-hedge precision: ${(zhPrec * 100).toFixed(1)}%`);
console.log(`Zero-hedge coverage: ${(zhCov * 100).toFixed(1)}%`);
console.log(`AUROC (hedgeRate): ${auroc.toFixed(4)}`);
console.log(`AUROC (HVR): ${aurocHVR.toFixed(4)}`);

if (zhPrec >= 0.95 && auroc >= 0.70) {
  console.log("\n→ STRONG CONFIRMATION: P(H-094) 0.45 → 0.75");
} else if (zhPrec >= 0.90 && auroc >= 0.60) {
  console.log("\n→ MODERATE CONFIRMATION: P(H-094) 0.45 → 0.65");
} else if (zhPrec >= 0.80 || auroc >= 0.55) {
  console.log("\n→ WEAK SIGNAL: P(H-094) 0.45 → 0.50");
} else if (zhCov < 0.05) {
  console.log("\n→ INCONCLUSIVE (low coverage): P(H-094) 0.45 → 0.40");
} else {
  console.log("\n→ DISCONFIRMATION: P(H-094) 0.45 → 0.25");
}

// ─── Output JSON for further analysis ────────────────────────────
const outputPath = "agents/.lab/exp101-results.json";
const output = {
  metadata: {
    totalSessions: results.length,
    labeledSessions: labeled.length,
    parseErrors,
    emptyText,
    timestamp: new Date().toISOString(),
  },
  zeroHedgeGate: {
    precision: zhPrec,
    coverage: zhCov,
    zeroHedgeCount: zeroHedge.length,
    zeroHedgeCorrect: zeroHedgeCorrect,
  },
  auroc: {
    hedgeRate: auroc,
    hvr: aurocHVR,
    sessionLength: aurocTokens,
    verifyRate: aurocVerifyRate,
  },
  perAgent: agents.map(a => {
    const s = results.filter(r => r.agent === a);
    const l = s.filter(r => r.label !== "ambiguous");
    return {
      agent: a,
      n: s.length,
      hedgeRate: mean(s.map(r => r.hedgeRate)),
      verifyRate: mean(s.map(r => r.verifyRate)),
      hvr: mean(s.map(r => r.hvr)),
      zeroHedgePct: s.filter(r => r.hedgeCount === 0).length / s.length,
      labeled: l.length,
      correctPct: l.length > 0 ? l.filter(r => r.label === "correct").length / l.length : null,
    };
  }),
  distributions: {
    hedgeRate: { mean: mean(allHedgeRates), median: median(allHedgeRates), p25: percentile(allHedgeRates, 25), p75: percentile(allHedgeRates, 75) },
    verifyRate: { mean: mean(allVerifyRates), median: median(allVerifyRates), p25: percentile(allVerifyRates, 25), p75: percentile(allVerifyRates, 75) },
    hvr: { mean: mean(allHVRs), median: median(allHVRs), p25: percentile(allHVRs, 25), p75: percentile(allHVRs, 75) },
    tokens: { mean: mean(allTokens), median: median(allTokens), p25: percentile(allTokens, 25), p75: percentile(allTokens, 75) },
  },
};

require("fs").writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`\nDetailed results written to ${outputPath}`);

db.close();
