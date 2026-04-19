import { Database } from 'bun:sqlite';

const db = new Database('.state/may.db', { readonly: true });

// Get all non-heuristic sessions with quality > 0
const rows = db.query(`
  SELECT 
    sessionId, agent, quality, efficiency,
    productiveCalls, wastedCalls,
    verdict, issues, overall, usage, failureChains,
    createdAt
  FROM evaluations 
  WHERE evaluatedByHeuristic = 0 AND quality > 0
  ORDER BY createdAt
`).all() as any[];

interface SessionFeatures {
  sessionId: string;
  agent: string;
  quality: number;
  efficiency: number;
  wastedCallRatio: number;
  fmCount: number;
  hasFM_2x: number;
  hasFM_3x: number;
  failureChainCount: number;
  failureChainDepth: number;
  cost: number;
  turns: number;
  resultDelivered: number;
  fmCodes: string[];
  fmCodeDetails: {code: string, recovered: boolean, description: string}[];
  verdict: string;
  createdAt: string;
  issues: any[];
}

const sessions: SessionFeatures[] = [];

for (const row of rows) {
  const issues = JSON.parse(row.issues || '[]');
  const overall = JSON.parse(row.overall || '{}');
  const usage = JSON.parse(row.usage || '{}');
  const failureChains = JSON.parse(row.failureChains || '[]');
  
  const fmCodes: string[] = [];
  const fmCodeDetails: any[] = [];
  
  for (const issue of issues) {
    const issueStr = typeof issue === 'string' ? issue : JSON.stringify(issue);
    const match = issueStr.match(/FM-\d+\.\d+/);
    if (match) {
      fmCodes.push(match[0]);
      const recovered = /recover/i.test(issueStr) || /caught/i.test(issueStr) || /blocked/i.test(issueStr);
      fmCodeDetails.push({
        code: match[0],
        recovered,
        description: issueStr.substring(0, 300)
      });
    }
  }
  
  const totalCalls = (row.productiveCalls || 0) + (row.wastedCalls || 0);
  const wastedCallRatio = totalCalls > 0 ? (row.wastedCalls || 0) / totalCalls : 0;
  
  sessions.push({
    sessionId: row.sessionId,
    agent: row.agent,
    quality: row.quality,
    efficiency: row.efficiency || 0,
    wastedCallRatio,
    fmCount: fmCodes.length,
    hasFM_2x: fmCodes.some(c => c.startsWith('FM-2')) ? 1 : 0,
    hasFM_3x: fmCodes.some(c => c.startsWith('FM-3')) ? 1 : 0,
    failureChainCount: Array.isArray(failureChains) ? failureChains.length : 0,
    failureChainDepth: Array.isArray(failureChains) ? Math.max(0, ...failureChains.map((c: any) => c.recoverySteps || c.depth || 0)) : 0,
    cost: usage.cost || 0,
    turns: usage.turns || 0,
    resultDelivered: overall.result_delivered ? 1 : 0,
    fmCodes,
    fmCodeDetails,
    verdict: row.verdict,
    createdAt: row.createdAt,
    issues
  });
}

// ============================================================
// CLUSTERING (k=6, same as EXP-109 Phase 3)
// ============================================================
const featureNames = ['quality', 'efficiency', 'wastedCallRatio', 'fmCount', 'hasFM_2x', 'hasFM_3x', 'failureChainCount', 'failureChainDepth', 'cost', 'turns', 'resultDelivered'];

const featureMatrix = sessions.map(s => featureNames.map(f => (s as any)[f] as number));

const means = featureNames.map((_, i) => featureMatrix.reduce((sum, row) => sum + row[i], 0) / featureMatrix.length);
const stds = featureNames.map((_, i) => {
  const m = means[i];
  const variance = featureMatrix.reduce((sum, row) => sum + (row[i] - m) ** 2, 0) / featureMatrix.length;
  return Math.sqrt(variance) || 1;
});
const normalized = featureMatrix.map(row => row.map((v, i) => (v - means[i]) / stds[i]));

function kmeanspp(data: number[][], k: number): number[][] {
  const centers: number[][] = [];
  const n = data.length;
  centers.push([...data[Math.floor(Math.random() * n)]]);
  for (let c = 1; c < k; c++) {
    const dists = data.map(p => {
      let minD = Infinity;
      for (const center of centers) {
        let d = 0;
        for (let i = 0; i < p.length; i++) d += (p[i] - center[i]) ** 2;
        if (d < minD) minD = d;
      }
      return minD;
    });
    const totalDist = dists.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalDist;
    for (let i = 0; i < n; i++) {
      r -= dists[i];
      if (r <= 0) { centers.push([...data[i]]); break; }
    }
    if (centers.length <= c) centers.push([...data[Math.floor(Math.random() * n)]]);
  }
  return centers;
}

function kmeans(data: number[][], k: number, maxIter = 100) {
  const n = data.length, dim = data[0].length;
  let centers = kmeanspp(data, k);
  let assignments = new Array(n).fill(0);
  for (let iter = 0; iter < maxIter; iter++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      let minD = Infinity, bestC = 0;
      for (let c = 0; c < k; c++) {
        let d = 0;
        for (let j = 0; j < dim; j++) d += (data[i][j] - centers[c][j]) ** 2;
        if (d < minD) { minD = d; bestC = c; }
      }
      if (assignments[i] !== bestC) { changed = true; assignments[i] = bestC; }
    }
    if (!changed) break;
    const newCenters = Array.from({length: k}, () => new Array(dim).fill(0));
    const counts = new Array(k).fill(0);
    for (let i = 0; i < n; i++) {
      const c = assignments[i]; counts[c]++;
      for (let j = 0; j < dim; j++) newCenters[c][j] += data[i][j];
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) for (let j = 0; j < dim; j++) newCenters[c][j] /= counts[c];
    }
    centers = newCenters;
  }
  return { assignments, centers };
}

function silhouetteSample(data: number[][], assignments: number[], sampleN = 500): number {
  const indices = [...Array(data.length).keys()].sort(() => Math.random() - 0.5).slice(0, Math.min(sampleN, data.length));
  let total = 0;
  for (const i of indices) {
    const ci = assignments[i];
    const ownDists: number[] = [], otherDists: Map<number, number[]> = new Map();
    for (let j = 0; j < data.length; j++) {
      if (i === j) continue;
      let d = 0;
      for (let k = 0; k < data[0].length; k++) d += (data[i][k] - data[j][k]) ** 2;
      d = Math.sqrt(d);
      if (assignments[j] === ci) ownDists.push(d);
      else {
        if (!otherDists.has(assignments[j])) otherDists.set(assignments[j], []);
        otherDists.get(assignments[j])!.push(d);
      }
    }
    const a = ownDists.length > 0 ? ownDists.reduce((s,v)=>s+v,0)/ownDists.length : 0;
    let b = Infinity;
    for (const [,ds] of otherDists) { const avg = ds.reduce((s,v)=>s+v,0)/ds.length; if (avg < b) b = avg; }
    if (b === Infinity) b = 0;
    const s = Math.max(a,b) > 0 ? (b-a)/Math.max(a,b) : 0;
    total += s;
  }
  return total / indices.length;
}

// 10 restarts
let best: any = null;
for (let r = 0; r < 10; r++) {
  const res = kmeans(normalized, 6);
  const sil = silhouetteSample(normalized, res.assignments);
  if (!best || sil > best.sil) best = {...res, sil};
}

// Map clusters
const clusterData: Map<number, SessionFeatures[]> = new Map();
for (let i = 0; i < sessions.length; i++) {
  const c = best.assignments[i];
  if (!clusterData.has(c)) clusterData.set(c, []);
  clusterData.get(c)!.push(sessions[i]);
}

// Profile each cluster
interface ClusterProfile {
  id: number; n: number; avgQ: number; avgFM: number; fm2x: number; fm3x: number; avgCost: number; avgTurns: number; delivered: number;
}
const profiles: ClusterProfile[] = [];
for (const [id, arr] of clusterData) {
  profiles.push({
    id, n: arr.length,
    avgQ: arr.reduce((s,v)=>s+v.quality,0)/arr.length,
    avgFM: arr.reduce((s,v)=>s+v.fmCount,0)/arr.length,
    fm2x: arr.filter(s=>s.hasFM_2x).length/arr.length,
    fm3x: arr.filter(s=>s.hasFM_3x).length/arr.length,
    avgCost: arr.reduce((s,v)=>s+v.cost,0)/arr.length,
    avgTurns: arr.reduce((s,v)=>s+v.turns,0)/arr.length,
    delivered: arr.filter(s=>s.resultDelivered).length/arr.length,
  });
}
profiles.sort((a,b) => b.avgQ - a.avgQ);

console.log('=== CLUSTER PROFILES (with corrected resultDelivered) ===');
for (const p of profiles) {
  console.log(`Cluster ${p.id}: N=${p.n} (${(100*p.n/sessions.length).toFixed(1)}%) Q=${p.avgQ.toFixed(3)} FM=${p.avgFM.toFixed(2)} FM2x=${(100*p.fm2x).toFixed(0)}% FM3x=${(100*p.fm3x).toFixed(0)}% Cost=$${p.avgCost.toFixed(2)} Turns=${p.avgTurns.toFixed(0)} Delivered=${(100*p.delivered).toFixed(0)}%`);
}

// Identify FM-Heavy Workers cluster
const fmhProfile = profiles.find(p => p.avgFM > 2.5 && p.avgQ > 0.35 && p.avgQ < 0.65) || 
  profiles.filter(p => p.avgQ > 0.3).sort((a,b) => b.avgFM - a.avgFM)[0];
const fmhId = fmhProfile.id;
const fmh = clusterData.get(fmhId)!;

console.log(`\nIdentified FM-Heavy Workers: Cluster ${fmhId} (N=${fmh.length})`);
console.log(`Avg Q=${fmhProfile.avgQ.toFixed(3)}, FM=${fmhProfile.avgFM.toFixed(2)}, Delivered=${(100*fmhProfile.delivered).toFixed(1)}%`);

// ============================================================
// DEEP ANALYSIS OF FM-HEAVY WORKERS
// ============================================================

// Agent breakdown
console.log('\n========================================');
console.log('SECTION 1: AGENT BREAKDOWN');
console.log('========================================');
const agentMap: Map<string, SessionFeatures[]> = new Map();
for (const s of fmh) {
  if (!agentMap.has(s.agent)) agentMap.set(s.agent, []);
  agentMap.get(s.agent)!.push(s);
}

const topAgents = [...agentMap.entries()].sort((a,b) => b[1].length - a[1].length);
for (const [agent, arr] of topAgents) {
  const avgQ = arr.reduce((s,v)=>s+v.quality,0)/arr.length;
  const avgFM = arr.reduce((s,v)=>s+v.fmCount,0)/arr.length;
  const avgE = arr.reduce((s,v)=>s+v.efficiency,0)/arr.length;
  const del = arr.filter(s=>s.resultDelivered).length/arr.length;
  const fm33 = arr.filter(s=>s.fmCodes.includes('FM-3.3')).length/arr.length;
  const fm21 = arr.filter(s=>s.fmCodes.includes('FM-2.1')).length/arr.length;
  const fm22 = arr.filter(s=>s.fmCodes.includes('FM-2.2')).length/arr.length;
  const fm26 = arr.filter(s=>s.fmCodes.includes('FM-2.6')).length/arr.length;
  console.log(`${agent}: N=${arr.length} (${(100*arr.length/fmh.length).toFixed(1)}%) Q=${avgQ.toFixed(3)} FM=${avgFM.toFixed(2)} E=${avgE.toFixed(3)} Del=${(100*del).toFixed(0)}% FM33=${(100*fm33).toFixed(0)}% FM21=${(100*fm21).toFixed(0)}% FM22=${(100*fm22).toFixed(0)}% FM26=${(100*fm26).toFixed(0)}%`);
}

// FM Code Analysis
console.log('\n========================================');
console.log('SECTION 2: FM CODE IMPACT ANALYSIS');
console.log('========================================');

// For each FM code, calculate: sessions with it, quality WITH vs WITHOUT
const allFMCodes = [...new Set(fmh.flatMap(s => s.fmCodes))].sort();
console.log('\nFM Code Impact on Quality (within FM-Heavy Workers):');
console.log(`${'Code'.padEnd(10)} ${'N'.padStart(5)} ${'%'.padStart(6)} ${'Q_with'.padStart(8)} ${'Q_without'.padStart(10)} ${'Delta'.padStart(8)} ${'Recov%'.padStart(8)}`);

const fmImpacts: {code: string, n: number, qWith: number, qWithout: number, delta: number, recovRate: number}[] = [];
for (const code of allFMCodes) {
  const withCode = fmh.filter(s => s.fmCodes.includes(code));
  const withoutCode = fmh.filter(s => !s.fmCodes.includes(code));
  if (withCode.length < 5) continue;
  
  const qWith = withCode.reduce((s,v)=>s+v.quality,0)/withCode.length;
  const qWithout = withoutCode.length > 0 ? withoutCode.reduce((s,v)=>s+v.quality,0)/withoutCode.length : 0;
  const delta = qWith - qWithout;
  
  const totalInstances = fmh.reduce((s,v) => s + v.fmCodeDetails.filter(d => d.code === code).length, 0);
  const recoveredInstances = fmh.reduce((s,v) => s + v.fmCodeDetails.filter(d => d.code === code && d.recovered).length, 0);
  const recovRate = totalInstances > 0 ? recoveredInstances / totalInstances : 0;
  
  fmImpacts.push({code, n: withCode.length, qWith, qWithout, delta, recovRate});
  console.log(`${code.padEnd(10)} ${String(withCode.length).padStart(5)} ${(100*withCode.length/fmh.length).toFixed(1).padStart(5)}% ${qWith.toFixed(3).padStart(8)} ${qWithout.toFixed(3).padStart(10)} ${delta.toFixed(3).padStart(8)} ${(100*recovRate).toFixed(1).padStart(7)}%`);
}

// Sort by impact (most negative delta = most harmful)
console.log('\nMost Harmful FM Codes (by quality delta):');
fmImpacts.sort((a,b) => a.delta - b.delta);
for (const imp of fmImpacts.slice(0, 8)) {
  console.log(`  ${imp.code}: Q drops by ${(-imp.delta).toFixed(3)} when present (N=${imp.n}, ${(100*imp.recovRate).toFixed(1)}% recovery)`);
}

// FM Code chains: Which codes lead to cascades?
console.log('\n========================================');
console.log('SECTION 3: CASCADE ANALYSIS');
console.log('========================================');

// Sessions with 1, 2, 3, 4+ FM codes
const fmCountBuckets: Map<number, SessionFeatures[]> = new Map();
for (const s of fmh) {
  const bucket = Math.min(s.fmCount, 5);
  if (!fmCountBuckets.has(bucket)) fmCountBuckets.set(bucket, []);
  fmCountBuckets.get(bucket)!.push(s);
}

console.log('\nQuality by FM Code Count:');
for (const [count, arr] of [...fmCountBuckets.entries()].sort()) {
  const avgQ = arr.reduce((s,v)=>s+v.quality,0)/arr.length;
  const avgE = arr.reduce((s,v)=>s+v.efficiency,0)/arr.length;
  const del = arr.filter(s=>s.resultDelivered).length/arr.length;
  console.log(`  FM=${count}${count>=5?'+':' '}: N=${String(arr.length).padStart(3)} Q=${avgQ.toFixed(3)} E=${avgE.toFixed(3)} Delivered=${(100*del).toFixed(0)}%`);
}

// Which FM code, when it appears FIRST (lowest position in issues), leads to more cascading?
console.log('\nFM Code as Cascade Initiator:');
const initiatorStats: Map<string, {count: number, avgSubsequent: number}> = new Map();
for (const s of fmh) {
  if (s.fmCodes.length === 0) continue;
  const first = s.fmCodes[0]; // First FM code in issues list
  if (!initiatorStats.has(first)) initiatorStats.set(first, {count: 0, avgSubsequent: 0});
  const stat = initiatorStats.get(first)!;
  stat.count++;
  stat.avgSubsequent += s.fmCodes.length - 1;
}
for (const [code, stat] of [...initiatorStats.entries()].sort((a,b) => b[1].count - a[1].count)) {
  if (stat.count < 5) continue;
  console.log(`  ${code}: appears first in ${stat.count} sessions, avg ${(stat.avgSubsequent/stat.count).toFixed(2)} subsequent FM codes`);
}

// ============================================================
// SECTION 4: INTERVENTION TARGETING
// ============================================================
console.log('\n========================================');
console.log('SECTION 4: INTERVENTION TARGETS');
console.log('========================================');

// Top 3 FM codes by: frequency × (1 - recovery_rate) × impact
console.log('\nIntervention Priority Score = Frequency × (1 - RecoveryRate) × |QualityImpact|:');
const interventionScores = fmImpacts.map(imp => ({
  code: imp.code,
  freq: imp.n / fmh.length,
  unrecoveredRate: 1 - imp.recovRate,
  impact: Math.abs(imp.delta),
  score: (imp.n / fmh.length) * (1 - imp.recovRate) * Math.abs(imp.delta),
  n: imp.n,
  recovRate: imp.recovRate,
  qDelta: imp.delta
}));
interventionScores.sort((a,b) => b.score - a.score);

for (const s of interventionScores.slice(0, 10)) {
  console.log(`  ${s.code}: score=${s.score.toFixed(4)} (freq=${(100*s.freq).toFixed(1)}%, unrecov=${(100*s.unrecoveredRate).toFixed(1)}%, |ΔQ|=${s.impact.toFixed(3)})`);
}

// ============================================================
// SECTION 5: WHAT WOULD IT TAKE TO MOVE FM-HEAVY → CLEAN?
// ============================================================
console.log('\n========================================');
console.log('SECTION 5: GAP ANALYSIS (FM-Heavy → Clean)');
console.log('========================================');

const cleanProfile = profiles.sort((a,b) => b.avgQ - a.avgQ)[0];
const cleanArr = clusterData.get(cleanProfile.id)!;

// Compare feature distributions
const compareFeature = (name: string, extract: (s: SessionFeatures) => number) => {
  const fhVals = fmh.map(extract);
  const cpVals = cleanArr.map(extract);
  const fhMean = fhVals.reduce((s,v)=>s+v,0)/fhVals.length;
  const cpMean = cpVals.reduce((s,v)=>s+v,0)/cpVals.length;
  const fhStd = Math.sqrt(fhVals.reduce((s,v)=>s+(v-fhMean)**2,0)/fhVals.length);
  const cpStd = Math.sqrt(cpVals.reduce((s,v)=>s+(v-cpMean)**2,0)/cpVals.length);
  
  // Cohen's d
  const pooledStd = Math.sqrt((fhStd**2 + cpStd**2)/2);
  const d = pooledStd > 0 ? (cpMean - fhMean) / pooledStd : 0;
  
  console.log(`  ${name.padEnd(20)} FMH=${fhMean.toFixed(3).padStart(7)} Clean=${cpMean.toFixed(3).padStart(7)} Δ=${(cpMean-fhMean).toFixed(3).padStart(7)} Cohen's d=${d.toFixed(2).padStart(6)}`);
};

compareFeature('quality', s => s.quality);
compareFeature('efficiency', s => s.efficiency);
compareFeature('fmCount', s => s.fmCount);
compareFeature('hasFM_2x', s => s.hasFM_2x);
compareFeature('hasFM_3x', s => s.hasFM_3x);
compareFeature('cost', s => s.cost);
compareFeature('turns', s => s.turns);
compareFeature('resultDelivered', s => s.resultDelivered);
compareFeature('wastedCallRatio', s => s.wastedCallRatio);
compareFeature('failureChainCount', s => s.failureChainCount);

// ============================================================
// SECTION 6: STATISTICAL TESTS
// ============================================================
console.log('\n========================================');
console.log('SECTION 6: STATISTICAL SIGNIFICANCE');
console.log('========================================');

// Chi-squared test: FM code presence in FM-Heavy vs Clean
const chiSquared = (a: number, b: number, c: number, d: number) => {
  const n = a + b + c + d;
  const expected = [(a+b)*(a+c)/n, (a+b)*(b+d)/n, (c+d)*(a+c)/n, (c+d)*(b+d)/n];
  const observed = [a, b, c, d];
  let chi2 = 0;
  for (let i = 0; i < 4; i++) chi2 += (observed[i] - expected[i])**2 / expected[i];
  return chi2;
};

console.log('\nFM Code Prevalence: FM-Heavy vs Clean (χ² test, df=1, critical=3.84 for p<0.05):');
for (const code of ['FM-3.3', 'FM-2.1', 'FM-2.2', 'FM-2.6', 'FM-3.1', 'FM-1.1', 'FM-3.2']) {
  const fhWith = fmh.filter(s => s.fmCodes.includes(code)).length;
  const fhWithout = fmh.length - fhWith;
  const cpWith = cleanArr.filter(s => s.fmCodes.includes(code)).length;
  const cpWithout = cleanArr.length - cpWith;
  const chi2 = chiSquared(fhWith, fhWithout, cpWith, cpWithout);
  const fhRate = (100 * fhWith / fmh.length).toFixed(1);
  const cpRate = (100 * cpWith / cleanArr.length).toFixed(1);
  const sig = chi2 > 10.83 ? '***' : chi2 > 6.63 ? '**' : chi2 > 3.84 ? '*' : 'ns';
  console.log(`  ${code}: FMH=${fhRate.padStart(5)}% Clean=${cpRate.padStart(5)}% χ²=${chi2.toFixed(1).padStart(7)} ${sig}`);
}

// Mann-Whitney U test approximation: quality difference
const fhQuals = fmh.map(s => s.quality).sort((a,b) => a-b);
const cpQuals = cleanArr.map(s => s.quality).sort((a,b) => a-b);
const fhMeanQ = fhQuals.reduce((s,v)=>s+v,0)/fhQuals.length;
const cpMeanQ = cpQuals.reduce((s,v)=>s+v,0)/cpQuals.length;
const fhStdQ = Math.sqrt(fhQuals.reduce((s,v)=>s+(v-fhMeanQ)**2,0)/fhQuals.length);
const cpStdQ = Math.sqrt(cpQuals.reduce((s,v)=>s+(v-cpMeanQ)**2,0)/cpQuals.length);

// Welch's t-test
const t = (cpMeanQ - fhMeanQ) / Math.sqrt(fhStdQ**2/fmh.length + cpStdQ**2/cleanArr.length);
console.log(`\nQuality difference (Welch's t-test):`);
console.log(`  FMH mean Q = ${fhMeanQ.toFixed(3)} (SD=${fhStdQ.toFixed(3)}, N=${fmh.length})`);
console.log(`  Clean mean Q = ${cpMeanQ.toFixed(3)} (SD=${cpStdQ.toFixed(3)}, N=${cleanArr.length})`);
console.log(`  t = ${t.toFixed(2)} (p < 0.001 for |t| > 3.29 with these df)`);

// ============================================================
// SECTION 7: PER-AGENT INTERVENTION PRIORITIES
// ============================================================
console.log('\n========================================');
console.log('SECTION 7: PER-AGENT INTERVENTION PRIORITIES');
console.log('========================================');

for (const [agent, arr] of topAgents.slice(0, 5)) {
  console.log(`\n--- ${agent} (N=${arr.length} FM-Heavy sessions) ---`);
  
  // Top FM codes for this agent within FM-Heavy
  const agentFMs: Map<string, number> = new Map();
  for (const s of arr) {
    for (const code of new Set(s.fmCodes)) {
      agentFMs.set(code, (agentFMs.get(code) || 0) + 1);
    }
  }
  console.log('  Top FM codes:');
  [...agentFMs.entries()].sort((a,b) => b[1]-a[1]).slice(0, 5).forEach(([code, count]) => {
    console.log(`    ${code}: ${count}/${arr.length} (${(100*count/arr.length).toFixed(0)}%)`);
  });
  
  // How does this agent's FM-Heavy profile differ from its Clean profile?
  const agentClean = cleanArr.filter(s => s.agent === agent);
  if (agentClean.length >= 5) {
    const cleanQ = agentClean.reduce((s,v)=>s+v.quality,0)/agentClean.length;
    const fhQ = arr.reduce((s,v)=>s+v.quality,0)/arr.length;
    console.log(`  Quality gap: FM-Heavy Q=${fhQ.toFixed(3)} vs Clean Q=${cleanQ.toFixed(3)} (Δ=${(cleanQ-fhQ).toFixed(3)})`);
    
    const cleanFM33 = agentClean.filter(s => s.fmCodes.includes('FM-3.3')).length / agentClean.length;
    const fhFM33 = arr.filter(s => s.fmCodes.includes('FM-3.3')).length / arr.length;
    console.log(`  FM-3.3 gap: FM-Heavy=${(100*fhFM33).toFixed(0)}% vs Clean=${(100*cleanFM33).toFixed(0)}%`);
  }
}

// ============================================================
// SECTION 8: POST-GUARD RESIDUAL ANALYSIS
// ============================================================
console.log('\n========================================');
console.log('SECTION 8: POST-GUARD RESIDUAL ANALYSIS');
console.log('========================================');

// Guard deployed ~2026-04-07. Sessions after that are post-guard
const guardDate = new Date('2026-04-07T00:00:00Z');
const postGuardFMH = fmh.filter(s => new Date(s.createdAt) >= guardDate);
const preGuardFMH = fmh.filter(s => new Date(s.createdAt) < guardDate);

console.log(`Pre-guard FM-Heavy sessions: ${preGuardFMH.length}`);
console.log(`Post-guard FM-Heavy sessions: ${postGuardFMH.length}`);

if (postGuardFMH.length > 0) {
  console.log('\nPost-guard FM-Heavy FM distribution:');
  const postFMs: Map<string, number> = new Map();
  for (const s of postGuardFMH) {
    for (const code of new Set(s.fmCodes)) {
      postFMs.set(code, (postFMs.get(code) || 0) + 1);
    }
  }
  [...postFMs.entries()].sort((a,b) => b[1]-a[1]).forEach(([code, count]) => {
    console.log(`  ${code}: ${count}/${postGuardFMH.length} (${(100*count/postGuardFMH.length).toFixed(0)}%)`);
  });
  
  console.log('\nPost-guard FM-Heavy agents:');
  const postAgents: Map<string, number> = new Map();
  for (const s of postGuardFMH) postAgents.set(s.agent, (postAgents.get(s.agent) || 0) + 1);
  [...postAgents.entries()].sort((a,b) => b[1]-a[1]).forEach(([agent, count]) => {
    console.log(`  ${agent}: ${count}`);
  });
}

// ============================================================
// SECTION 9: PORTFOLIO IMPACT CALCULATIONS
// ============================================================
console.log('\n========================================');
console.log('SECTION 9: PORTFOLIO IMPACT');
console.log('========================================');

const totalN = sessions.length;
const currentQ = sessions.reduce((s,v) => s+v.quality, 0) / totalN;
console.log(`Current portfolio: N=${totalN}, avg Q=${currentQ.toFixed(3)}`);
console.log(`FM-Heavy Workers: N=${fmh.length} (${(100*fmh.length/totalN).toFixed(1)}%), avg Q=${fhMeanQ.toFixed(3)}`);
console.log(`Clean Performers: N=${cleanArr.length} (${(100*cleanArr.length/totalN).toFixed(1)}%), avg Q=${cpMeanQ.toFixed(3)}`);

// Scenarios
const scenarios = [
  {name: 'FM-3.3 recovery (guard effect)', lift: 0.08, affected: fmh.filter(s=>s.fmCodes.includes('FM-3.3')).length},
  {name: 'FM-2.1 guard (approach checking)', lift: 0.06, affected: fmh.filter(s=>s.fmCodes.includes('FM-2.1')).length},
  {name: 'FM-2.2 guard (completeness)', lift: 0.05, affected: fmh.filter(s=>s.fmCodes.includes('FM-2.2')).length},
  {name: 'All three combined', lift: 0.15, affected: fmh.filter(s=>s.fmCodes.includes('FM-3.3') || s.fmCodes.includes('FM-2.1') || s.fmCodes.includes('FM-2.2')).length},
  {name: 'FM-Heavy → Q=0.65', lift: 0.65 - fhMeanQ, affected: fmh.length},
  {name: 'FM-Heavy → Q=0.70', lift: 0.70 - fhMeanQ, affected: fmh.length},
];

for (const s of scenarios) {
  const newPortfolioQ = (currentQ * totalN + s.lift * s.affected) / totalN;
  const portfolioDelta = newPortfolioQ - currentQ;
  console.log(`  ${s.name}: affects ${s.affected} sessions, lift +${s.lift.toFixed(2)} → portfolio ΔQ = +${portfolioDelta.toFixed(4)} (${(100*portfolioDelta/currentQ).toFixed(2)}% relative)`);
}

