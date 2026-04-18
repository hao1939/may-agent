#!/usr/bin/env bun
/**
 * EXP-101 Phase 1: HVR (Hedge-to-Verify Ratio) Retrospective Analysis
 * 
 * Analyzes 1,446 session traces for hedging/verification patterns
 * and correlates with session outcomes.
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';

// ============= CONFIGURATION =============

const SESSION_DIR = '.state/sessions';
const EVAL_DIR = '.state/evaluations';

// Hedging markers (from DD-656 / SELFDOUBT, adapted for agent context)
const HEDGE_PATTERNS: [RegExp, string][] = [
  [/\bmaybe\b/gi, 'maybe'],
  [/\bperhaps\b/gi, 'perhaps'],
  [/\bpossibly\b/gi, 'possibly'],
  [/\bnot sure\b/gi, 'not_sure'],
  [/\bnot certain\b/gi, 'not_certain'],
  [/\bI think\b/gi, 'I_think'],
  [/\bI believe\b/gi, 'I_believe'],
  [/\bmight be\b/gi, 'might_be'],
  [/\bcould be\b/gi, 'could_be'],
  [/\balternatively\b/gi, 'alternatively'],
  [/\bon the other hand\b/gi, 'on_the_other_hand'],
  [/\bI'm not confident\b/gi, 'not_confident'],
  [/\bunclear\b/gi, 'unclear'],
  [/\bI'm unsure\b/gi, 'unsure'],
  [/\bhard to say\b/gi, 'hard_to_say'],
  [/\bdifficult to determine\b/gi, 'difficult_to_determine'],
  [/\bwait[,.]?\s/gi, 'wait'],
  [/\bactually[,.]?\s/gi, 'actually'],
  [/\bhmm\b/gi, 'hmm'],
  [/\blet me reconsider\b/gi, 'reconsider'],
];

// Verification markers
const VERIFY_PATTERNS: [RegExp, string][] = [
  [/\blet me (check|verify|confirm|validate|test)\b/gi, 'let_me_check'],
  [/\bchecking\b/gi, 'checking'],
  [/\bconfirming\b/gi, 'confirming'],
  [/\bverif(?:y|ied|ying)\b/gi, 'verify'],
  [/\bvalidat(?:e|ed|ing)\b/gi, 'validate'],
  [/\blooks correct\b/gi, 'looks_correct'],
  [/\bmatches\b/gi, 'matches'],
  [/\bconsistent with\b/gi, 'consistent_with'],
  [/\bas expected\b/gi, 'as_expected'],
  [/\bconfirmed\b/gi, 'confirmed'],
  [/\bI can see that\b/gi, 'I_can_see'],
  [/\bthe output shows\b/gi, 'output_shows'],
  [/\bthe (?:test|check|result) (?:pass|show|confirm)\b/gi, 'test_pass'],
];

// ============= TYPES =============

interface SessionData {
  sessionId: string;
  agent: string;
  status: string; // done, error, interrupted, running, idle
  opCount: number;
  durationMs: number;
  
  // Text metrics
  assistantTextLength: number; // chars
  assistantTokenEstimate: number; // rough: chars/4
  turnCount: number;
  
  // HVR metrics
  hedgeCount: number;
  verifyCount: number;
  hvr: number; // hedge / (verify + 1)
  hedgeRate: number; // per 1000 tokens
  verifyRate: number; // per 1000 tokens
  
  // Per-marker counts
  hedgeBreakdown: Record<string, number>;
  verifyBreakdown: Record<string, number>;
  
  // Late-trace hedging (last 25% of assistant text)
  lateHedgeCount: number;
  lateHedgeRate: number;
  
  // Labels
  isError: boolean; // status = error or interrupted
  evalQuality?: number; // from evaluation JSON
  evalVerdict?: string;
  fmErrors?: string[]; // FM error codes from evaluation
  hasFM33?: boolean; // has FM-3.3 verification failure
}

// ============= HELPER FUNCTIONS =============

function countMatches(text: string, patterns: [RegExp, string][]): { total: number; breakdown: Record<string, number> } {
  const breakdown: Record<string, number> = {};
  let total = 0;
  for (const [pattern, name] of patterns) {
    // Reset regex state
    const matches = text.match(pattern);
    const count = matches ? matches.length : 0;
    breakdown[name] = count;
    total += count;
  }
  return { total, breakdown };
}

function extractAssistantText(sessionJsonl: string): { fullText: string; turns: string[] } {
  const lines = sessionJsonl.trim().split('\n');
  const turns: string[] = [];
  
  for (const line of lines) {
    try {
      const msg = JSON.parse(line);
      if (msg.role === 'assistant' && Array.isArray(msg.content)) {
        const texts = msg.content
          .filter((c: any) => c.type === 'text')
          .map((c: any) => c.text || '')
          .join(' ');
        if (texts.trim()) {
          turns.push(texts);
        }
      }
    } catch (e) {
      // Skip malformed lines
    }
  }
  
  return { fullText: turns.join('\n'), turns };
}

// ============= LOAD EVALUATIONS =============

async function loadEvaluations(): Promise<Map<string, { quality: number; verdict: string; fmErrors: string[]; hasFM33: boolean }>> {
  const evalMap = new Map();
  
  try {
    const files = await readdir(EVAL_DIR);
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const data = JSON.parse(await readFile(join(EVAL_DIR, f), 'utf8'));
        // Extract session ID from filename
        const match = f.match(/(s_\d+_\d+)/);
        if (!match) continue;
        const sessionId = match[1];
        
        // Extract quality, verdict, FM errors from evaluation
        const agents = data.agents || {};
        const fmErrors: string[] = [];
        let quality = 0;
        let verdict = 'unknown';
        let count = 0;
        
        for (const [agentName, agentData] of Object.entries(agents) as any) {
          if (agentData.quality !== undefined) {
            quality += agentData.quality;
            count++;
          }
          if (agentData.verdict) verdict = agentData.verdict;
          if (agentData.issues) {
            for (const issue of agentData.issues) {
              const fmMatch = (issue as string).match(/\[FM-[\d.]+\]/g);
              if (fmMatch) fmErrors.push(...fmMatch);
            }
          }
        }
        
        if (count > 0) quality /= count;
        const hasFM33 = fmErrors.some(e => e.includes('FM-3.3'));
        
        evalMap.set(sessionId, { quality, verdict, fmErrors, hasFM33 });
      } catch (e) {}
    }
  } catch (e) {}
  
  return evalMap;
}

// ============= MAIN ANALYSIS =============

async function main() {
  console.log('EXP-101 Phase 1: HVR Retrospective Analysis');
  console.log('============================================\n');
  
  // Load evaluations
  const evaluations = await loadEvaluations();
  console.log(`Loaded ${evaluations.size} evaluation records\n`);
  
  // Process all sessions
  const dirs = (await readdir(SESSION_DIR)).filter(d => d.startsWith('s_'));
  console.log(`Found ${dirs.length} session directories\n`);
  
  const sessions: SessionData[] = [];
  let parseErrors = 0;
  
  for (const d of dirs) {
    try {
      const metaRaw = await readFile(join(SESSION_DIR, d, 'meta.json'), 'utf8');
      const meta = JSON.parse(metaRaw);
      
      const jsonlRaw = await readFile(join(SESSION_DIR, d, 'session.jsonl'), 'utf8');
      const { fullText, turns } = extractAssistantText(jsonlRaw);
      
      if (fullText.length === 0) {
        // Skip sessions with no assistant text
        continue;
      }
      
      const tokenEstimate = Math.max(1, Math.round(fullText.length / 4));
      
      // Count markers on full text
      const hedges = countMatches(fullText, HEDGE_PATTERNS);
      const verifies = countMatches(fullText, VERIFY_PATTERNS);
      
      // Count late-trace hedging (last 25% of text)
      const lateStart = Math.floor(fullText.length * 0.75);
      const lateText = fullText.slice(lateStart);
      const lateTokens = Math.max(1, Math.round(lateText.length / 4));
      const lateHedges = countMatches(lateText, HEDGE_PATTERNS);
      
      const hvr = hedges.total / (verifies.total + 1);
      
      const evalData = evaluations.get(d);
      
      const session: SessionData = {
        sessionId: d,
        agent: meta.agent || 'unknown',
        status: meta.status || 'unknown',
        opCount: meta.opCount || 0,
        durationMs: (meta.endedAt || Date.now()) - (meta.startedAt || 0),
        
        assistantTextLength: fullText.length,
        assistantTokenEstimate: tokenEstimate,
        turnCount: turns.length,
        
        hedgeCount: hedges.total,
        verifyCount: verifies.total,
        hvr,
        hedgeRate: (hedges.total / tokenEstimate) * 1000,
        verifyRate: (verifies.total / tokenEstimate) * 1000,
        
        hedgeBreakdown: hedges.breakdown,
        verifyBreakdown: verifies.breakdown,
        
        lateHedgeCount: lateHedges.total,
        lateHedgeRate: (lateHedges.total / lateTokens) * 1000,
        
        isError: meta.status === 'error' || meta.status === 'interrupted',
        evalQuality: evalData?.quality,
        evalVerdict: evalData?.verdict,
        fmErrors: evalData?.fmErrors,
        hasFM33: evalData?.hasFM33,
      };
      
      sessions.push(session);
    } catch (e) {
      parseErrors++;
    }
  }
  
  console.log(`Processed ${sessions.length} sessions (${parseErrors} parse errors)\n`);
  
  // ============= STEP 2: Zero-Hedge Gate Analysis =============
  console.log('=== STEP 2: Zero-Hedge Gate Analysis ===\n');
  
  const zeroHedge = sessions.filter(s => s.hedgeCount === 0);
  const hasHedge = sessions.filter(s => s.hedgeCount > 0);
  
  const zeroHedgeCorrect = zeroHedge.filter(s => !s.isError).length;
  const hasHedgeCorrect = hasHedge.filter(s => !s.isError).length;
  
  const zeroHedgePrecision = zeroHedge.length > 0 ? zeroHedgeCorrect / zeroHedge.length : 0;
  const hasHedgePrecision = hasHedge.length > 0 ? hasHedgeCorrect / hasHedge.length : 0;
  const coverage = zeroHedge.length / sessions.length;
  
  console.log(`Zero-hedge sessions: ${zeroHedge.length} / ${sessions.length} (coverage: ${(coverage * 100).toFixed(1)}%)`);
  console.log(`Zero-hedge precision (correct among zero-hedge): ${(zeroHedgePrecision * 100).toFixed(1)}% (${zeroHedgeCorrect}/${zeroHedge.length})`);
  console.log(`Has-hedge precision (correct among has-hedge): ${(hasHedgePrecision * 100).toFixed(1)}% (${hasHedgeCorrect}/${hasHedge.length})`);
  console.log(`Precision difference: ${((zeroHedgePrecision - hasHedgePrecision) * 100).toFixed(1)}pp\n`);
  
  // Also check low-hedge vs high-hedge
  const lowHedge = sessions.filter(s => s.hedgeCount > 0 && s.hedgeCount <= 5);
  const highHedge = sessions.filter(s => s.hedgeCount > 20);
  const lowHedgePrec = lowHedge.length > 0 ? lowHedge.filter(s => !s.isError).length / lowHedge.length : 0;
  const highHedgePrec = highHedge.length > 0 ? highHedge.filter(s => !s.isError).length / highHedge.length : 0;
  
  console.log(`Low-hedge (1-5): ${lowHedge.length} sessions, precision ${(lowHedgePrec * 100).toFixed(1)}%`);
  console.log(`High-hedge (>20): ${highHedge.length} sessions, precision ${(highHedgePrec * 100).toFixed(1)}%\n`);
  
  // ============= STEP 3: HVR Discrimination Analysis =============
  console.log('=== STEP 3: HVR Discrimination (AUROC) ===\n');
  
  // Compute AUROC
  // For AUROC: we treat isError=true as "positive" (failure), and test if higher HVR predicts failure
  const positives = sessions.filter(s => s.isError);
  const negatives = sessions.filter(s => !s.isError);
  
  console.log(`Positives (errors): ${positives.length}, Negatives (correct): ${negatives.length}`);
  
  // Mann-Whitney U test approach for AUROC
  let concordant = 0;
  let discordant = 0;
  let ties = 0;
  
  for (const pos of positives) {
    for (const neg of negatives) {
      if (pos.hvr > neg.hvr) concordant++;
      else if (pos.hvr < neg.hvr) discordant++;
      else ties++;
    }
  }
  
  const totalPairs = positives.length * negatives.length;
  const auroc = totalPairs > 0 ? (concordant + 0.5 * ties) / totalPairs : 0.5;
  
  console.log(`AUROC (HVR → failure): ${auroc.toFixed(4)}`);
  console.log(`  Concordant: ${concordant}, Discordant: ${discordant}, Ties: ${ties}\n`);
  
  // Compare with session length as predictor
  let lenConcordant = 0, lenDiscordant = 0, lenTies = 0;
  for (const pos of positives) {
    for (const neg of negatives) {
      if (pos.assistantTokenEstimate > neg.assistantTokenEstimate) lenConcordant++;
      else if (pos.assistantTokenEstimate < neg.assistantTokenEstimate) lenDiscordant++;
      else lenTies++;
    }
  }
  const aurocLen = totalPairs > 0 ? (lenConcordant + 0.5 * lenTies) / totalPairs : 0.5;
  console.log(`AUROC (session length → failure): ${aurocLen.toFixed(4)}`);
  
  // Compare with opCount as predictor
  let opConcordant = 0, opDiscordant = 0, opTies = 0;
  for (const pos of positives) {
    for (const neg of negatives) {
      if (pos.opCount > neg.opCount) opConcordant++;
      else if (pos.opCount < neg.opCount) opDiscordant++;
      else opTies++;
    }
  }
  const aurocOp = totalPairs > 0 ? (opConcordant + 0.5 * opTies) / totalPairs : 0.5;
  console.log(`AUROC (opCount → failure): ${aurocOp.toFixed(4)}`);
  
  // Hedge rate AUROC
  let hrConcordant = 0, hrDiscordant = 0, hrTies = 0;
  for (const pos of positives) {
    for (const neg of negatives) {
      if (pos.hedgeRate > neg.hedgeRate) hrConcordant++;
      else if (pos.hedgeRate < neg.hedgeRate) hrDiscordant++;
      else hrTies++;
    }
  }
  const aurocHR = totalPairs > 0 ? (hrConcordant + 0.5 * hrTies) / totalPairs : 0.5;
  console.log(`AUROC (hedgeRate → failure): ${aurocHR.toFixed(4)}`);
  
  // Late hedge rate AUROC
  let lhConcordant = 0, lhDiscordant = 0, lhTies = 0;
  for (const pos of positives) {
    for (const neg of negatives) {
      if (pos.lateHedgeRate > neg.lateHedgeRate) lhConcordant++;
      else if (pos.lateHedgeRate < neg.lateHedgeRate) lhDiscordant++;
      else lhTies++;
    }
  }
  const aurocLH = totalPairs > 0 ? (lhConcordant + 0.5 * lhTies) / totalPairs : 0.5;
  console.log(`AUROC (lateHedgeRate → failure): ${aurocLH.toFixed(4)}\n`);
  
  // HVR calibration curve
  console.log('HVR Calibration Curve (HVR bucket → error rate):');
  const buckets = [
    { label: 'HVR = 0', filter: (s: SessionData) => s.hvr === 0 },
    { label: 'HVR 0.01-0.5', filter: (s: SessionData) => s.hvr > 0 && s.hvr <= 0.5 },
    { label: 'HVR 0.5-1.0', filter: (s: SessionData) => s.hvr > 0.5 && s.hvr <= 1.0 },
    { label: 'HVR 1.0-2.0', filter: (s: SessionData) => s.hvr > 1.0 && s.hvr <= 2.0 },
    { label: 'HVR 2.0-3.0', filter: (s: SessionData) => s.hvr > 2.0 && s.hvr <= 3.0 },
    { label: 'HVR > 3.0', filter: (s: SessionData) => s.hvr > 3.0 },
  ];
  
  for (const bucket of buckets) {
    const inBucket = sessions.filter(bucket.filter);
    const errors = inBucket.filter(s => s.isError).length;
    const rate = inBucket.length > 0 ? errors / inBucket.length : 0;
    console.log(`  ${bucket.label.padEnd(16)}: N=${String(inBucket.length).padStart(4)}, errors=${String(errors).padStart(3)}, rate=${(rate * 100).toFixed(1)}%`);
  }
  console.log();
  
  // ============= STEP 4: FM-3.3 Prediction =============
  console.log('=== STEP 4: FM-3.3 Prediction Analysis ===\n');
  
  const withEval = sessions.filter(s => s.evalQuality !== undefined);
  console.log(`Sessions with evaluation data: ${withEval.length}`);
  
  if (withEval.length > 0) {
    const withFM33 = withEval.filter(s => s.hasFM33);
    const withoutFM33 = withEval.filter(s => !s.hasFM33);
    
    console.log(`  With FM-3.3: ${withFM33.length}`);
    console.log(`  Without FM-3.3: ${withoutFM33.length}`);
    
    if (withFM33.length > 0 && withoutFM33.length > 0) {
      const avgHVR_FM33 = withFM33.reduce((s, x) => s + x.hvr, 0) / withFM33.length;
      const avgHVR_noFM33 = withoutFM33.reduce((s, x) => s + x.hvr, 0) / withoutFM33.length;
      const avgHR_FM33 = withFM33.reduce((s, x) => s + x.hedgeRate, 0) / withFM33.length;
      const avgHR_noFM33 = withoutFM33.reduce((s, x) => s + x.hedgeRate, 0) / withoutFM33.length;
      
      console.log(`\n  Mean HVR with FM-3.3: ${avgHVR_FM33.toFixed(3)}`);
      console.log(`  Mean HVR without FM-3.3: ${avgHVR_noFM33.toFixed(3)}`);
      console.log(`  Mean hedgeRate with FM-3.3: ${avgHR_FM33.toFixed(3)}`);
      console.log(`  Mean hedgeRate without FM-3.3: ${avgHR_noFM33.toFixed(3)}`);
    }
  }
  console.log();
  
  // ============= STEP 5: Agent-Level Analysis =============
  console.log('=== STEP 5: Agent-Level Analysis ===\n');
  
  const agentNames = [...new Set(sessions.map(s => s.agent))].sort();
  
  console.log('Agent'.padEnd(14) + 'N'.padStart(5) + 'Err%'.padStart(7) + 'AvgHVR'.padStart(8) + 'ZeroCov%'.padStart(10) + 'ZeroPrec%'.padStart(10) + 'AvgHedge'.padStart(10) + 'AvgVerify'.padStart(10));
  console.log('-'.repeat(74));
  
  const agentAUROCs: { agent: string; auroc: number; n: number }[] = [];
  
  for (const agent of agentNames) {
    const agentSessions = sessions.filter(s => s.agent === agent);
    const n = agentSessions.length;
    const errRate = agentSessions.filter(s => s.isError).length / n;
    const avgHVR = agentSessions.reduce((s, x) => s + x.hvr, 0) / n;
    const zeroCount = agentSessions.filter(s => s.hedgeCount === 0).length;
    const zeroCov = zeroCount / n;
    const zeroCorrect = agentSessions.filter(s => s.hedgeCount === 0 && !s.isError).length;
    const zeroPrec = zeroCount > 0 ? zeroCorrect / zeroCount : 0;
    const avgHedge = agentSessions.reduce((s, x) => s + x.hedgeRate, 0) / n;
    const avgVerify = agentSessions.reduce((s, x) => s + x.verifyRate, 0) / n;
    
    console.log(
      agent.padEnd(14) +
      String(n).padStart(5) +
      (errRate * 100).toFixed(1).padStart(7) +
      avgHVR.toFixed(2).padStart(8) +
      (zeroCov * 100).toFixed(1).padStart(10) +
      (zeroPrec * 100).toFixed(1).padStart(10) +
      avgHedge.toFixed(2).padStart(10) +
      avgVerify.toFixed(2).padStart(10)
    );
    
    // Per-agent AUROC
    const aPos = agentSessions.filter(s => s.isError);
    const aNeg = agentSessions.filter(s => !s.isError);
    if (aPos.length > 0 && aNeg.length > 0) {
      let c = 0, d = 0, t = 0;
      for (const p of aPos) for (const n of aNeg) {
        if (p.hvr > n.hvr) c++;
        else if (p.hvr < n.hvr) d++;
        else t++;
      }
      const aAuroc = (c + 0.5 * t) / (aPos.length * aNeg.length);
      agentAUROCs.push({ agent, auroc: aAuroc, n });
    }
  }
  
  console.log('\nPer-Agent AUROC (HVR → failure):');
  for (const { agent, auroc, n } of agentAUROCs.sort((a, b) => b.auroc - a.auroc)) {
    console.log(`  ${agent.padEnd(14)} AUROC=${auroc.toFixed(4)} (N=${n})`);
  }
  console.log();
  
  // ============= STEP 6: Marker Frequency Analysis =============
  console.log('=== STEP 6: Top Hedging Markers ===\n');
  
  const hedgeTotals: Record<string, number> = {};
  const verifyTotals: Record<string, number> = {};
  
  for (const s of sessions) {
    for (const [k, v] of Object.entries(s.hedgeBreakdown)) hedgeTotals[k] = (hedgeTotals[k] || 0) + v;
    for (const [k, v] of Object.entries(s.verifyBreakdown)) verifyTotals[k] = (verifyTotals[k] || 0) + v;
  }
  
  const sortedHedges = Object.entries(hedgeTotals).sort((a, b) => b[1] - a[1]);
  const sortedVerifies = Object.entries(verifyTotals).sort((a, b) => b[1] - a[1]);
  
  console.log('Hedging markers (total across all sessions):');
  for (const [name, count] of sortedHedges) {
    console.log(`  ${name.padEnd(25)} ${count}`);
  }
  
  console.log('\nVerification markers (total across all sessions):');
  for (const [name, count] of sortedVerifies) {
    console.log(`  ${name.padEnd(25)} ${count}`);
  }
  console.log();
  
  // ============= STEP 7: Distribution Statistics =============
  console.log('=== STEP 7: Distribution Statistics ===\n');
  
  const hvrs = sessions.map(s => s.hvr).sort((a, b) => a - b);
  const hedgeCounts = sessions.map(s => s.hedgeCount).sort((a, b) => a - b);
  const verifyCounts = sessions.map(s => s.verifyCount).sort((a, b) => a - b);
  
  function percentile(sorted: number[], p: number): number {
    const idx = Math.floor(sorted.length * p);
    return sorted[Math.min(idx, sorted.length - 1)];
  }
  
  console.log('HVR Distribution:');
  console.log(`  Min: ${hvrs[0]?.toFixed(3)}, P25: ${percentile(hvrs, 0.25).toFixed(3)}, Median: ${percentile(hvrs, 0.5).toFixed(3)}, P75: ${percentile(hvrs, 0.75).toFixed(3)}, P95: ${percentile(hvrs, 0.95).toFixed(3)}, Max: ${hvrs[hvrs.length - 1]?.toFixed(3)}`);
  console.log(`  Mean: ${(hvrs.reduce((a, b) => a + b, 0) / hvrs.length).toFixed(3)}`);
  
  console.log('\nHedge Count Distribution:');
  console.log(`  Min: ${hedgeCounts[0]}, P25: ${percentile(hedgeCounts, 0.25)}, Median: ${percentile(hedgeCounts, 0.5)}, P75: ${percentile(hedgeCounts, 0.75)}, P95: ${percentile(hedgeCounts, 0.95)}, Max: ${hedgeCounts[hedgeCounts.length - 1]}`);
  
  console.log('\nVerify Count Distribution:');
  console.log(`  Min: ${verifyCounts[0]}, P25: ${percentile(verifyCounts, 0.25)}, Median: ${percentile(verifyCounts, 0.5)}, P75: ${percentile(verifyCounts, 0.75)}, P95: ${percentile(verifyCounts, 0.95)}, Max: ${verifyCounts[verifyCounts.length - 1]}`);
  
  // ============= STEP 8: I_think sensitivity analysis =============
  console.log('\n=== STEP 8: Sensitivity Analysis (excluding "I think") ===\n');
  
  // "I think" is ubiquitous in polite agent language — does excluding it change results?
  const HEDGE_NO_ITHINK = HEDGE_PATTERNS.filter(([_, name]) => name !== 'I_think');
  
  const sessionsNoIThink = sessions.map(s => {
    const hCount = s.hedgeCount - (s.hedgeBreakdown['I_think'] || 0);
    return {
      ...s,
      hedgeCount_noIT: hCount,
      hvr_noIT: hCount / (s.verifyCount + 1),
    };
  });
  
  const zeroNoIT = sessionsNoIThink.filter(s => s.hedgeCount_noIT === 0);
  const zeroNoITCorrect = zeroNoIT.filter(s => !s.isError).length;
  const coverageNoIT = zeroNoIT.length / sessionsNoIThink.length;
  const precisionNoIT = zeroNoIT.length > 0 ? zeroNoITCorrect / zeroNoIT.length : 0;
  
  console.log(`Excluding "I think":`);
  console.log(`  Zero-hedge coverage: ${(coverageNoIT * 100).toFixed(1)}% (${zeroNoIT.length}/${sessionsNoIThink.length})`);
  console.log(`  Zero-hedge precision: ${(precisionNoIT * 100).toFixed(1)}%`);
  
  // AUROC without I think
  const posNoIT = sessionsNoIThink.filter(s => s.isError);
  const negNoIT = sessionsNoIThink.filter(s => !s.isError);
  let cNoIT = 0, dNoIT = 0, tNoIT = 0;
  for (const p of posNoIT) for (const n of negNoIT) {
    if (p.hvr_noIT > n.hvr_noIT) cNoIT++;
    else if (p.hvr_noIT < n.hvr_noIT) dNoIT++;
    else tNoIT++;
  }
  const aurocNoIT = totalPairs > 0 ? (cNoIT + 0.5 * tNoIT) / totalPairs : 0.5;
  console.log(`  AUROC (HVR_noIThink → failure): ${aurocNoIT.toFixed(4)}\n`);
  
  // ============= STEP 9: Also exclude "actually" and "wait" =============
  console.log('=== STEP 9: Sensitivity (excluding backtracking signals) ===\n');
  
  // "actually" and "wait" might be normal self-correction, not doubt
  const EXCLUDE_SET = new Set(['I_think', 'actually', 'wait']);
  
  const sessionsStrict = sessions.map(s => {
    let excluded = 0;
    for (const name of EXCLUDE_SET) excluded += (s.hedgeBreakdown[name] || 0);
    const hCount = s.hedgeCount - excluded;
    return {
      ...s,
      hedgeCount_strict: hCount,
      hvr_strict: hCount / (s.verifyCount + 1),
    };
  });
  
  const zeroStrict = sessionsStrict.filter(s => s.hedgeCount_strict === 0);
  const zeroStrictCorrect = zeroStrict.filter(s => !s.isError).length;
  
  console.log(`Excluding "I think", "actually", "wait":`);
  console.log(`  Zero-hedge coverage: ${(zeroStrict.length / sessionsStrict.length * 100).toFixed(1)}% (${zeroStrict.length}/${sessionsStrict.length})`);
  console.log(`  Zero-hedge precision: ${(zeroStrict.length > 0 ? zeroStrictCorrect / zeroStrict.length * 100 : 0).toFixed(1)}%`);
  
  // AUROC strict
  const posStrict = sessionsStrict.filter(s => s.isError);
  const negStrict = sessionsStrict.filter(s => !s.isError);
  let cS = 0, dS = 0, tS = 0;
  for (const p of posStrict) for (const n of negStrict) {
    if (p.hvr_strict > n.hvr_strict) cS++;
    else if (p.hvr_strict < n.hvr_strict) dS++;
    else tS++;
  }
  const aurocStrict = totalPairs > 0 ? (cS + 0.5 * tS) / totalPairs : 0.5;
  console.log(`  AUROC (HVR_strict → failure): ${aurocStrict.toFixed(4)}\n`);
  
  // ============= SUMMARY =============
  console.log('=== SUMMARY ===\n');
  console.log(`Total sessions analyzed: ${sessions.length}`);
  console.log(`Error sessions (labels): ${positives.length} (${(positives.length / sessions.length * 100).toFixed(1)}%)`);
  console.log();
  console.log('PRIMARY METRICS:');
  console.log(`  Zero-hedge precision: ${(zeroHedgePrecision * 100).toFixed(1)}% (target: ≥90%)`);
  console.log(`  Zero-hedge coverage: ${(coverage * 100).toFixed(1)}% (target: ≥15%)`);
  console.log(`  AUROC (HVR → failure): ${auroc.toFixed(4)} (target: ≥0.60)`);
  console.log();
  console.log('COMPARISON AUROCS:');
  console.log(`  HVR: ${auroc.toFixed(4)}`);
  console.log(`  Session length: ${aurocLen.toFixed(4)}`);
  console.log(`  opCount: ${aurocOp.toFixed(4)}`);
  console.log(`  Hedge rate: ${aurocHR.toFixed(4)}`);
  console.log(`  Late hedge rate: ${aurocLH.toFixed(4)}`);
  console.log(`  HVR (no "I think"): ${aurocNoIT.toFixed(4)}`);
  console.log(`  HVR (strict): ${aurocStrict.toFixed(4)}`);
  
  // Determine outcome category per design doc
  console.log('\n=== H-094 P(H) UPDATE ===\n');
  if (zeroHedgePrecision >= 0.95 && auroc >= 0.70) {
    console.log('STRONG CONFIRMATION: P(H-094) 0.45 → 0.75');
  } else if (zeroHedgePrecision >= 0.90 && auroc >= 0.60) {
    console.log('MODERATE CONFIRMATION: P(H-094) 0.45 → 0.65');
  } else if (zeroHedgePrecision >= 0.80 || auroc >= 0.55) {
    console.log('WEAK SIGNAL: P(H-094) 0.45 → 0.50');
  } else if (coverage < 0.05) {
    console.log('INCONCLUSIVE (low coverage): P(H-094) 0.45 → 0.40');
  } else {
    console.log('DISCONFIRMATION: P(H-094) 0.45 → 0.25');
  }
}

main().catch(console.error);
