// EXP-101 Phase 2: Refined HVR analysis with better labeling
// Uses 3-tier labeling: quality 4-5 vs quality 1 (needs_improvement)
// Also tests quality 4-5 vs quality 1-2 (binary split at median)

import { Database } from "bun:sqlite";
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

// ─── Marker Patterns ─────────────────────────────────────────────
const HEDGE_PATTERNS: RegExp[] = [
  /\bmaybe\b/gi, /\bperhaps\b/gi, /\bpossibly\b/gi,
  /\bnot sure\b/gi, /\bnot certain\b/gi, /\bI think\b/gi,
  /\bI believe\b/gi, /\bmight be\b/gi, /\bcould be\b/gi,
  /\balternatively\b/gi, /\bon the other hand\b/gi,
  /\bunclear\b/gi, /\bI'm unsure\b/gi,
  /\bwait,?\s/gi, /\bactually,?\s/gi, /\bhmm\b/gi,
  /\blet me reconsider\b/gi,
];

const VERIFY_PATTERNS: RegExp[] = [
  /\blet me (?:check|verify|confirm|validate|test)\b/gi,
  /\bchecking\b/gi, /\bconfirming\b/gi,
  /\bverif(?:y|ied|ying)\b/gi, /\bvalidat(?:e|ed|ing)\b/gi,
  /\blooks correct\b/gi, /\bmatches\b/gi,
  /\bconsistent with\b/gi, /\bas expected\b/gi,
  /\bconfirmed\b/gi, /\bI can see that\b/gi,
  /\bthe output shows\b/gi,
  /\bthe (?:test|check|result) (?:pass|show|confirm)\b/gi,
];

function countMatches(text: string, patterns: RegExp[]): number {
  let total = 0;
  for (const pat of patterns) {
    pat.lastIndex = 0;
    const m = text.match(pat);
    if (m) total += m.length;
  }
  return total;
}

function tokenCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function extractAssistantText(sessionDir: string): string {
  const filePath = join(sessionDir, "session.jsonl");
  if (!existsSync(filePath)) return "";
  const lines = readFileSync(filePath, "utf8").trim().split("\n");
  const parts: string[] = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.role !== "assistant" || !Array.isArray(obj.content)) continue;
      for (const p of obj.content) {
        if (p.type === "text" && typeof p.text === "string") parts.push(p.text);
      }
    } catch {}
  }
  return parts.join("\n");
}

function computeAUROC(data: { score: number; label: boolean }[]): number {
  // label=true is the "positive" class. Higher score => more likely positive.
  // For HVR: we negate (lower HVR = more correct), but first let's be explicit.
  const pos = data.filter(d => d.label).map(d => d.score);
  const neg = data.filter(d => !d.label).map(d => d.score);
  if (pos.length === 0 || neg.length === 0) return NaN;
  
  let conc = 0, tied = 0;
  for (const p of pos) {
    for (const n of neg) {
      if (p > n) conc++;
      else if (p === n) tied++;
    }
  }
  return (conc + 0.5 * tied) / (pos.length * neg.length);
}

function mannWhitneyU(group1: number[], group2: number[]): { U: number; z: number; p: number } {
  // Mann-Whitney U test (normal approximation)
  const n1 = group1.length, n2 = group2.length;
  if (n1 === 0 || n2 === 0) return { U: NaN, z: NaN, p: NaN };
  
  // Rank all values
  const all = [
    ...group1.map(v => ({ v, g: 1 })),
    ...group2.map(v => ({ v, g: 2 })),
  ].sort((a, b) => a.v - b.v);
  
  // Assign ranks (handle ties)
  const N = all.length;
  let i = 0;
  while (i < N) {
    let j = i;
    while (j < N && all[j].v === all[i].v) j++;
    const avgRank = (i + j + 1) / 2; // 1-indexed avg rank
    for (let k = i; k < j; k++) (all[k] as any).rank = avgRank;
    i = j;
  }
  
  const R1 = all.filter(x => x.g === 1).reduce((s, x) => s + (x as any).rank, 0);
  const U1 = R1 - n1 * (n1 + 1) / 2;
  const U2 = n1 * n2 - U1;
  const U = Math.min(U1, U2);
  
  const mu = n1 * n2 / 2;
  const sigma = Math.sqrt(n1 * n2 * (n1 + n2 + 1) / 12);
  const z = sigma > 0 ? (U1 - mu) / sigma : 0;
  
  // Two-tailed p from z (normal approx)
  const absZ = Math.abs(z);
  const p = 2 * (1 - normalCDF(absZ));
  
  return { U, z, p };
}

function normalCDF(x: number): number {
  // Abramowitz & Stegun approximation
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

// ─── Main ────────────────────────────────────────────────────────
console.log("=== EXP-101 Phase 2: Refined HVR Analysis ===\n");

const db = new Database(".state/may.db", { readonly: true });
const sessionsDir = ".state/sessions";
const sessionDirs = readdirSync(sessionsDir).filter(d => d.startsWith("s_"));

// Load evaluations (only non-skipped)
const evalMap = new Map<string, { quality: number; verdict: string; efficiency: number }>();
const evalRows = db.query(
  "SELECT sessionId, quality, verdict, efficiency FROM evaluations WHERE verdict != 'skipped'"
).all() as any[];
for (const r of evalRows) evalMap.set(r.sessionId, r);

console.log(`Sessions: ${sessionDirs.length}, Evaluations: ${evalMap.size}\n`);

// Process all sessions
interface Row {
  id: string; agent: string; tokens: number;
  hedgeCount: number; verifyCount: number;
  hedgeRate: number; verifyRate: number; hvr: number;
  quality: number | null; verdict: string | null;
}

const rows: Row[] = [];

for (const dir of sessionDirs) {
  const text = extractAssistantText(join(sessionsDir, dir));
  const tokens = tokenCount(text);
  if (tokens < 10) continue;
  
  // Get meta
  let agent = "unknown";
  try {
    const meta = JSON.parse(readFileSync(join(sessionsDir, dir, "meta.json"), "utf8"));
    agent = meta.agent || "unknown";
  } catch {}
  
  const hc = countMatches(text, HEDGE_PATTERNS);
  const vc = countMatches(text, VERIFY_PATTERNS);
  const evalData = evalMap.get(dir);
  
  rows.push({
    id: dir, agent, tokens,
    hedgeCount: hc, verifyCount: vc,
    hedgeRate: (hc / tokens) * 1000,
    verifyRate: (vc / tokens) * 1000,
    hvr: hc / (vc + 1),
    quality: evalData?.quality ?? null,
    verdict: evalData?.verdict ?? null,
  });
}

console.log(`Processed ${rows.length} sessions with text\n`);

// ─── Analysis 1: High vs Low Quality (4-5 vs 1) ─────────────────
console.log("=== Analysis 1: High Quality (4-5) vs Low Quality (1) ===\n");

const high = rows.filter(r => r.quality !== null && r.quality >= 4);
const low = rows.filter(r => r.quality !== null && r.quality <= 1);

function groupStats(label: string, group: Row[]) {
  if (group.length === 0) { console.log(`  ${label}: (empty)`); return; }
  const hedgeRates = group.map(r => r.hedgeRate);
  const verifyRates = group.map(r => r.verifyRate);
  const hvrs = group.map(r => r.hvr);
  const tokens = group.map(r => r.tokens);
  const zeroH = group.filter(r => r.hedgeCount === 0).length;
  
  const m = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const med = (arr: number[]) => { const s = [...arr].sort((a,b) => a - b); return s[Math.floor(s.length/2)]; };
  
  console.log(`  ${label} (N=${group.length}):`);
  console.log(`    Hedge/1k:  mean=${m(hedgeRates).toFixed(2)}, median=${med(hedgeRates).toFixed(2)}`);
  console.log(`    Verify/1k: mean=${m(verifyRates).toFixed(2)}, median=${med(verifyRates).toFixed(2)}`);
  console.log(`    HVR:       mean=${m(hvrs).toFixed(3)}, median=${med(hvrs).toFixed(3)}`);
  console.log(`    Tokens:    mean=${m(tokens).toFixed(0)}, median=${med(tokens)}`);
  console.log(`    Zero-hedge: ${zeroH} (${(zeroH/group.length*100).toFixed(1)}%)`);
}

groupStats("HIGH (q>=4)", high);
groupStats("LOW (q=1)", low);

// Mann-Whitney tests
if (high.length > 0 && low.length > 0) {
  const mwHedge = mannWhitneyU(high.map(r => r.hedgeRate), low.map(r => r.hedgeRate));
  const mwVerify = mannWhitneyU(high.map(r => r.verifyRate), low.map(r => r.verifyRate));
  const mwHVR = mannWhitneyU(high.map(r => r.hvr), low.map(r => r.hvr));
  
  console.log(`\n  Mann-Whitney U tests (high vs low):`);
  console.log(`    HedgeRate: z=${mwHedge.z.toFixed(3)}, p=${mwHedge.p.toFixed(4)}`);
  console.log(`    VerifyRate: z=${mwVerify.z.toFixed(3)}, p=${mwVerify.p.toFixed(4)}`);
  console.log(`    HVR: z=${mwHVR.z.toFixed(3)}, p=${mwHVR.p.toFixed(4)}`);
  
  // AUROC: can HVR discriminate high from low?
  // Positive = high quality. Higher AUROC means metric predicts quality.
  // We test: does LOWER hedgeRate predict HIGHER quality?
  const combined = [...high.map(r => ({ score: -r.hedgeRate, label: true })), 
                    ...low.map(r => ({ score: -r.hedgeRate, label: false }))];
  const auroc1 = computeAUROC(combined);
  
  const combined2 = [...high.map(r => ({ score: -r.hvr, label: true })),
                     ...low.map(r => ({ score: -r.hvr, label: false }))];
  const auroc2 = computeAUROC(combined2);
  
  const combined3 = [...high.map(r => ({ score: r.verifyRate, label: true })),
                     ...low.map(r => ({ score: r.verifyRate, label: false }))];
  const auroc3 = computeAUROC(combined3);
  
  // Token count as baseline
  const combined4 = [...high.map(r => ({ score: r.tokens, label: true })),
                     ...low.map(r => ({ score: r.tokens, label: false }))];
  const auroc4 = computeAUROC(combined4);
  
  console.log(`\n  AUROC (high vs low):`);
  console.log(`    -HedgeRate → quality: ${auroc1.toFixed(4)}`);
  console.log(`    -HVR → quality:       ${auroc2.toFixed(4)}`);
  console.log(`    VerifyRate → quality:  ${auroc3.toFixed(4)}`);
  console.log(`    TokenCount (baseline): ${auroc4.toFixed(4)}`);
}

// ─── Analysis 2: Binary split (q>=3 vs q<=2) ────────────────────
console.log("\n\n=== Analysis 2: Binary Split (q>=3 vs q<=2) ===\n");

const above = rows.filter(r => r.quality !== null && r.quality >= 3);
const below = rows.filter(r => r.quality !== null && r.quality <= 2);

groupStats("ABOVE (q>=3)", above);
groupStats("BELOW (q<=2)", below);

if (above.length > 0 && below.length > 0) {
  const mw = mannWhitneyU(above.map(r => r.hedgeRate), below.map(r => r.hedgeRate));
  console.log(`\n  Mann-Whitney (hedgeRate): z=${mw.z.toFixed(3)}, p=${mw.p.toFixed(4)}`);
  
  const comb = [...above.map(r => ({ score: -r.hedgeRate, label: true })),
                ...below.map(r => ({ score: -r.hedgeRate, label: false }))];
  console.log(`  AUROC (-hedgeRate → quality): ${computeAUROC(comb).toFixed(4)}`);
  
  const combH = [...above.map(r => ({ score: -r.hvr, label: true })),
                 ...below.map(r => ({ score: -r.hvr, label: false }))];
  console.log(`  AUROC (-HVR → quality):       ${computeAUROC(combH).toFixed(4)}`);
}

// ─── Analysis 3: Verdict-based (good vs needs_improvement) ──────
console.log("\n\n=== Analysis 3: Verdict-Based (good vs needs_improvement) ===\n");

const good = rows.filter(r => r.verdict === "good");
const bad = rows.filter(r => r.verdict === "needs_improvement");

groupStats("GOOD", good);
groupStats("NEEDS_IMPROVEMENT", bad);

if (good.length > 0 && bad.length > 0) {
  const mw = mannWhitneyU(good.map(r => r.hedgeRate), bad.map(r => r.hedgeRate));
  console.log(`\n  Mann-Whitney (hedgeRate): z=${mw.z.toFixed(3)}, p=${mw.p.toFixed(4)}`);
  
  const comb = [...good.map(r => ({ score: -r.hedgeRate, label: true })),
                ...bad.map(r => ({ score: -r.hedgeRate, label: false }))];
  console.log(`  AUROC (-hedgeRate → good): ${computeAUROC(comb).toFixed(4)}`);
  
  const combH = [...good.map(r => ({ score: -r.hvr, label: true })),
                 ...bad.map(r => ({ score: -r.hvr, label: false }))];
  console.log(`  AUROC (-HVR → good):       ${computeAUROC(combH).toFixed(4)}`);
  
  const combV = [...good.map(r => ({ score: r.verifyRate, label: true })),
                 ...bad.map(r => ({ score: r.verifyRate, label: false }))];
  console.log(`  AUROC (verifyRate → good):  ${computeAUROC(combV).toFixed(4)}`);
}

// ─── Analysis 4: Per-Agent High vs Low ───────────────────────────
console.log("\n\n=== Analysis 4: Per-Agent Comparison ===\n");

const agents = [...new Set(rows.map(r => r.agent))].sort();
console.log("Agent            | N_hi | N_lo | HR_hi | HR_lo | VR_hi | VR_lo | HVR_hi | HVR_lo | AUROC");
console.log("-----------------|------|------|-------|-------|-------|-------|--------|--------|------");

for (const a of agents) {
  const aRows = rows.filter(r => r.agent === a);
  const aHigh = aRows.filter(r => r.quality !== null && r.quality >= 4);
  const aLow = aRows.filter(r => r.quality !== null && r.quality <= 1);
  
  if (aHigh.length < 3 && aLow.length < 3) continue;
  
  const m = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  
  let auroc = "N/A";
  if (aHigh.length >= 2 && aLow.length >= 2) {
    const c = [...aHigh.map(r => ({ score: -r.hedgeRate, label: true })),
              ...aLow.map(r => ({ score: -r.hedgeRate, label: false }))];
    auroc = computeAUROC(c).toFixed(3);
  }
  
  console.log(`${a.padEnd(17)}| ${String(aHigh.length).padStart(4)} | ${String(aLow.length).padStart(4)} | ${m(aHigh.map(r=>r.hedgeRate)).toFixed(1).padStart(5)} | ${m(aLow.map(r=>r.hedgeRate)).toFixed(1).padStart(5)} | ${m(aHigh.map(r=>r.verifyRate)).toFixed(1).padStart(5)} | ${m(aLow.map(r=>r.verifyRate)).toFixed(1).padStart(5)} | ${m(aHigh.map(r=>r.hvr)).toFixed(2).padStart(6)} | ${m(aLow.map(r=>r.hvr)).toFixed(2).padStart(6)} | ${auroc}`);
}

// ─── Analysis 5: Zero-Hedge Gate (refined) ───────────────────────
console.log("\n\n=== Analysis 5: Zero-Hedge Gate (refined with full labels) ===\n");

const evaluated = rows.filter(r => r.quality !== null);
const evalZero = evaluated.filter(r => r.hedgeCount === 0);
const evalNon = evaluated.filter(r => r.hedgeCount > 0);

const m = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

console.log(`Zero-hedge sessions: ${evalZero.length}`);
console.log(`  Mean quality: ${m(evalZero.map(r => r.quality!)).toFixed(2)}`);
console.log(`  Verdict distribution: good=${evalZero.filter(r=>r.verdict==="good").length}, acceptable=${evalZero.filter(r=>r.verdict==="acceptable").length}, needs_improvement=${evalZero.filter(r=>r.verdict==="needs_improvement").length}`);

console.log(`\nHas-hedge sessions: ${evalNon.length}`);
console.log(`  Mean quality: ${m(evalNon.map(r => r.quality!)).toFixed(2)}`);
console.log(`  Verdict distribution: good=${evalNon.filter(r=>r.verdict==="good").length}, acceptable=${evalNon.filter(r=>r.verdict==="acceptable").length}, needs_improvement=${evalNon.filter(r=>r.verdict==="needs_improvement").length}`);

const mwQ = mannWhitneyU(evalZero.map(r => r.quality!), evalNon.map(r => r.quality!));
console.log(`\nMann-Whitney (quality, zero vs non-zero): z=${mwQ.z.toFixed(3)}, p=${mwQ.p.toFixed(4)}`);

// ─── Final P(H) Assessment ──────────────────────────────────────
console.log("\n\n=== FINAL P(H-094) ASSESSMENT ===\n");

// Gather key metrics
const mainAuroc = (good.length > 0 && bad.length > 0)
  ? computeAUROC([
      ...good.map(r => ({ score: -r.hedgeRate, label: true })),
      ...bad.map(r => ({ score: -r.hedgeRate, label: false }))
    ])
  : NaN;

const mainHVRAuroc = (good.length > 0 && bad.length > 0)
  ? computeAUROC([
      ...good.map(r => ({ score: -r.hvr, label: true })),
      ...bad.map(r => ({ score: -r.hvr, label: false }))
    ])
  : NaN;

console.log("Key Findings:");
console.log(`  1. AUROC (-hedgeRate predicting good vs NI): ${mainAuroc.toFixed(4)}`);
console.log(`  2. AUROC (-HVR predicting good vs NI): ${mainHVRAuroc.toFixed(4)}`);
console.log(`  3. Zero-hedge mean quality: ${m(evalZero.map(r => r.quality!)).toFixed(2)} vs non-zero: ${m(evalNon.map(r => r.quality!)).toFixed(2)}`);
console.log(`  4. Quality diff p-value: ${mwQ.p.toFixed(4)}`);

console.log("\nInterpretation:");
if (mainAuroc >= 0.65 && mwQ.p < 0.05) {
  console.log("  STRONG CONFIRMATION: HVR has discriminative power.");
  console.log("  Recommendation: P(H-094) 0.45 → 0.70");
} else if (mainAuroc >= 0.55 && mwQ.p < 0.10) {
  console.log("  MODERATE SIGNAL: HVR shows some discrimination but effect size is small.");
  console.log("  Recommendation: P(H-094) 0.45 → 0.55");
} else if (mainAuroc >= 0.45 && mainAuroc <= 0.55) {
  console.log("  NEAR-RANDOM: HVR does not discriminate better than chance.");
  console.log("  Recommendation: P(H-094) 0.45 → 0.30");
} else {
  console.log("  INVERSE SIGNAL: Higher hedge rate correlates with BETTER outcomes.");
  console.log("  This could mean hedging reflects metacognitive awareness, not uncertainty.");
  console.log("  Recommendation: P(H-094) 0.45 → 0.20 (original hypothesis direction wrong)");
}

// Write results
const results = {
  timestamp: new Date().toISOString(),
  samples: {
    total: rows.length,
    evaluated: evaluated.length,
    high: high.length,
    low: low.length,
    good: good.length,
    bad: bad.length,
  },
  auroc: {
    hedgeRate_good_vs_NI: mainAuroc,
    hvr_good_vs_NI: mainHVRAuroc,
  },
  mannWhitney: {
    zeroVsNonZero_quality: { z: mwQ.z, p: mwQ.p },
  },
  zeroHedgeGate: {
    meanQualityZero: m(evalZero.map(r => r.quality!)),
    meanQualityNonZero: m(evalNon.map(r => r.quality!)),
  },
};

require("fs").writeFileSync("agents/.lab/exp101-phase2-results.json", JSON.stringify(results, null, 2));
console.log("\nResults saved to agents/.lab/exp101-phase2-results.json");

db.close();
