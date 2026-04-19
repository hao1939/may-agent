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

// Build feature matrix (same as EXP-109 Phase 3)
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
  // Extra fields for analysis
  fmCodes: string[];
  fmCodeDetails: {code: string, severity: string, recovered: boolean, description: string}[];
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
        description: issueStr.substring(0, 200)
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
    resultDelivered: overall.resultDelivered ? 1 : 0,
    fmCodes,
    fmCodeDetails,
    verdict: row.verdict,
    createdAt: row.createdAt,
    issues
  });
}

console.log(`Total sessions: ${sessions.length}`);

// K-means clustering (k=6, same as EXP-109)
const featureNames = ['quality', 'efficiency', 'wastedCallRatio', 'fmCount', 'hasFM_2x', 'hasFM_3x', 'failureChainCount', 'failureChainDepth', 'cost', 'turns', 'resultDelivered'];

// Extract features as numbers
const featureMatrix = sessions.map(s => featureNames.map(f => (s as any)[f] as number));

// Z-score normalize
const means = featureNames.map((_, i) => featureMatrix.reduce((sum, row) => sum + row[i], 0) / featureMatrix.length);
const stds = featureNames.map((_, i) => {
  const m = means[i];
  const variance = featureMatrix.reduce((sum, row) => sum + (row[i] - m) ** 2, 0) / featureMatrix.length;
  return Math.sqrt(variance) || 1;
});

const normalized = featureMatrix.map(row => row.map((v, i) => (v - means[i]) / stds[i]));

// K-means++ initialization
function kmeanspp(data: number[][], k: number): number[][] {
  const centers: number[][] = [];
  const n = data.length;
  const dim = data[0].length;
  
  // First center random
  centers.push([...data[Math.floor(Math.random() * n)]]);
  
  for (let c = 1; c < k; c++) {
    const dists = data.map(p => {
      let minD = Infinity;
      for (const center of centers) {
        let d = 0;
        for (let i = 0; i < dim; i++) d += (p[i] - center[i]) ** 2;
        if (d < minD) minD = d;
      }
      return minD;
    });
    const totalDist = dists.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalDist;
    for (let i = 0; i < n; i++) {
      r -= dists[i];
      if (r <= 0) {
        centers.push([...data[i]]);
        break;
      }
    }
    if (centers.length <= c) centers.push([...data[Math.floor(Math.random() * n)]]);
  }
  return centers;
}

function kmeans(data: number[][], k: number, maxIter: number = 100): {assignments: number[], centers: number[][]} {
  const n = data.length;
  const dim = data[0].length;
  let centers = kmeanspp(data, k);
  let assignments = new Array(n).fill(0);
  
  for (let iter = 0; iter < maxIter; iter++) {
    // Assign
    let changed = false;
    for (let i = 0; i < n; i++) {
      let minD = Infinity;
      let bestC = 0;
      for (let c = 0; c < k; c++) {
        let d = 0;
        for (let j = 0; j < dim; j++) d += (data[i][j] - centers[c][j]) ** 2;
        if (d < minD) { minD = d; bestC = c; }
      }
      if (assignments[i] !== bestC) { changed = true; assignments[i] = bestC; }
    }
    if (!changed) break;
    
    // Update centers
    const newCenters = Array.from({length: k}, () => new Array(dim).fill(0));
    const counts = new Array(k).fill(0);
    for (let i = 0; i < n; i++) {
      const c = assignments[i];
      counts[c]++;
      for (let j = 0; j < dim; j++) newCenters[c][j] += data[i][j];
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        for (let j = 0; j < dim; j++) newCenters[c][j] /= counts[c];
      }
    }
    centers = newCenters;
  }
  return { assignments, centers };
}

function silhouette(data: number[][], assignments: number[], sampleSize: number = 500): number {
  const n = Math.min(data.length, sampleSize);
  const indices = [...Array(data.length).keys()].sort(() => Math.random() - 0.5).slice(0, n);
  
  let totalS = 0;
  for (const i of indices) {
    const ci = assignments[i];
    const dim = data[0].length;
    
    // Average distance to own cluster
    const ownDists: number[] = [];
    const otherClusterDists: Map<number, number[]> = new Map();
    
    for (let j = 0; j < data.length; j++) {
      if (i === j) continue;
      let d = 0;
      for (let k = 0; k < dim; k++) d += (data[i][k] - data[j][k]) ** 2;
      d = Math.sqrt(d);
      
      if (assignments[j] === ci) {
        ownDists.push(d);
      } else {
        if (!otherClusterDists.has(assignments[j])) otherClusterDists.set(assignments[j], []);
        otherClusterDists.get(assignments[j])!.push(d);
      }
    }
    
    const a = ownDists.length > 0 ? ownDists.reduce((s, v) => s + v, 0) / ownDists.length : 0;
    let b = Infinity;
    for (const [, dists] of otherClusterDists) {
      const avgD = dists.reduce((s, v) => s + v, 0) / dists.length;
      if (avgD < b) b = avgD;
    }
    if (b === Infinity) b = 0;
    
    const s = Math.max(a, b) > 0 ? (b - a) / Math.max(a, b) : 0;
    totalS += s;
  }
  return totalS / n;
}

// Run k=6 with 10 restarts
let bestResult: {assignments: number[], centers: number[][], sil: number} | null = null;
for (let restart = 0; restart < 10; restart++) {
  const result = kmeans(normalized, 6);
  const sil = silhouette(normalized, result.assignments);
  if (!bestResult || sil > bestResult.sil) {
    bestResult = { ...result, sil };
  }
}

console.log(`\nBest silhouette: ${bestResult!.sil.toFixed(3)}`);

// Characterize clusters
const clusterData: Map<number, SessionFeatures[]> = new Map();
for (let i = 0; i < sessions.length; i++) {
  const c = bestResult!.assignments[i];
  if (!clusterData.has(c)) clusterData.set(c, []);
  clusterData.get(c)!.push(sessions[i]);
}

// Print cluster profiles
const clusterProfiles: {id: number, n: number, avgQ: number, avgFM: number, avgCost: number, avgTurns: number, fm2x: number, fm3x: number, delivered: number}[] = [];

for (const [id, sessArr] of clusterData) {
  const avgQ = sessArr.reduce((s, v) => s + v.quality, 0) / sessArr.length;
  const avgFM = sessArr.reduce((s, v) => s + v.fmCount, 0) / sessArr.length;
  const avgCost = sessArr.reduce((s, v) => s + v.cost, 0) / sessArr.length;
  const avgTurns = sessArr.reduce((s, v) => s + v.turns, 0) / sessArr.length;
  const fm2x = sessArr.filter(s => s.hasFM_2x).length / sessArr.length;
  const fm3x = sessArr.filter(s => s.hasFM_3x).length / sessArr.length;
  const delivered = sessArr.filter(s => s.resultDelivered).length / sessArr.length;
  
  clusterProfiles.push({ id, n: sessArr.length, avgQ, avgFM, avgCost, avgTurns, fm2x, fm3x, delivered });
}

// Sort by quality descending
clusterProfiles.sort((a, b) => b.avgQ - a.avgQ);

console.log('\n=== CLUSTER PROFILES ===');
for (const p of clusterProfiles) {
  console.log(`\nCluster ${p.id} (N=${p.n}, ${(100*p.n/sessions.length).toFixed(1)}%)`);
  console.log(`  Quality: ${p.avgQ.toFixed(3)}, FM_count: ${p.avgFM.toFixed(2)}`);
  console.log(`  FM-2.x: ${(100*p.fm2x).toFixed(1)}%, FM-3.x: ${(100*p.fm3x).toFixed(1)}%`);
  console.log(`  Cost: $${p.avgCost.toFixed(2)}, Turns: ${p.avgTurns.toFixed(1)}`);
  console.log(`  Delivered: ${(100*p.delivered).toFixed(1)}%`);
}

// Identify the FM-Heavy Workers cluster: moderate quality (~0.5), high FM count (~3.3)
const fmHeavyCluster = clusterProfiles.find(p => p.avgFM > 2.5 && p.avgQ > 0.4 && p.avgQ < 0.6);
if (!fmHeavyCluster) {
  console.log('\n⚠️ Could not identify FM-Heavy Workers cluster by profile match. Using highest-FM cluster with Q>0.3');
  const fallback = clusterProfiles.filter(p => p.avgQ > 0.3).sort((a,b) => b.avgFM - a.avgFM)[0];
  if (fallback) {
    console.log(`Using cluster ${fallback.id} as FM-Heavy Workers`);
  }
}

const fmHeavyId = fmHeavyCluster ? fmHeavyCluster.id : clusterProfiles.filter(p => p.avgQ > 0.3).sort((a,b) => b.avgFM - a.avgFM)[0]?.id;
const fmHeavySessions = clusterData.get(fmHeavyId!)!;

console.log(`\n=== FM-HEAVY WORKERS DEEP DIVE (Cluster ${fmHeavyId}, N=${fmHeavySessions.length}) ===`);

// 1. Agent breakdown
const agentBreakdown: Map<string, number> = new Map();
for (const s of fmHeavySessions) {
  agentBreakdown.set(s.agent, (agentBreakdown.get(s.agent) || 0) + 1);
}
console.log('\n--- Agent Breakdown ---');
[...agentBreakdown.entries()].sort((a,b) => b[1]-a[1]).forEach(([agent, count]) => {
  console.log(`  ${agent}: ${count} (${(100*count/fmHeavySessions.length).toFixed(1)}%)`);
});

// 2. FM Code distribution within cluster
const fmCodeDist: Map<string, number> = new Map();
const fmCodeRecovered: Map<string, number> = new Map();
const fmCodeTotal: Map<string, number> = new Map();
for (const s of fmHeavySessions) {
  const seen = new Set<string>();
  for (const detail of s.fmCodeDetails) {
    if (!seen.has(detail.code)) {
      fmCodeDist.set(detail.code, (fmCodeDist.get(detail.code) || 0) + 1);
      seen.add(detail.code);
    }
    fmCodeTotal.set(detail.code, (fmCodeTotal.get(detail.code) || 0) + 1);
    if (detail.recovered) {
      fmCodeRecovered.set(detail.code, (fmCodeRecovered.get(detail.code) || 0) + 1);
    }
  }
}

console.log('\n--- FM Code Distribution (session-level, % of FM-Heavy sessions) ---');
[...fmCodeDist.entries()].sort((a,b) => b[1]-a[1]).forEach(([code, count]) => {
  const total = fmCodeTotal.get(code) || count;
  const recovered = fmCodeRecovered.get(code) || 0;
  const recRate = total > 0 ? (100 * recovered / total).toFixed(1) : '0.0';
  console.log(`  ${code}: ${count} sessions (${(100*count/fmHeavySessions.length).toFixed(1)}%), total instances: ${total}, recovered: ${recovered} (${recRate}%)`);
});

// 3. FM code pairs (co-occurrence)
const fmPairs: Map<string, number> = new Map();
for (const s of fmHeavySessions) {
  const codes = [...new Set(s.fmCodes)].sort();
  for (let i = 0; i < codes.length; i++) {
    for (let j = i + 1; j < codes.length; j++) {
      const pair = `${codes[i]}+${codes[j]}`;
      fmPairs.set(pair, (fmPairs.get(pair) || 0) + 1);
    }
  }
}
console.log('\n--- Top FM Code Co-occurrence Pairs ---');
[...fmPairs.entries()].sort((a,b) => b[1]-a[1]).slice(0, 15).forEach(([pair, count]) => {
  console.log(`  ${pair}: ${count} (${(100*count/fmHeavySessions.length).toFixed(1)}%)`);
});

// 4. Agent × FM code cross-tabulation
console.log('\n--- Agent × FM Code Cross-tabulation ---');
const topAgents = [...agentBreakdown.entries()].sort((a,b) => b[1]-a[1]).slice(0, 6).map(e => e[0]);
const topFMCodes = [...fmCodeDist.entries()].sort((a,b) => b[1]-a[1]).slice(0, 8).map(e => e[0]);

console.log(`${'Agent'.padEnd(12)} ${topFMCodes.map(c => c.padStart(8)).join('')}  | N`);
for (const agent of topAgents) {
  const agentSessions = fmHeavySessions.filter(s => s.agent === agent);
  const cells = topFMCodes.map(code => {
    const count = agentSessions.filter(s => s.fmCodes.includes(code)).length;
    return `${(100*count/agentSessions.length).toFixed(0)}%`.padStart(8);
  });
  console.log(`${agent.padEnd(12)} ${cells.join('')}  | ${agentSessions.length}`);
}

// 5. Quality distribution within FM-Heavy Workers
const qualityBuckets = [0, 0.2, 0.4, 0.6, 0.8, 1.01];
console.log('\n--- Quality Distribution within FM-Heavy Workers ---');
for (let i = 0; i < qualityBuckets.length - 1; i++) {
  const lo = qualityBuckets[i];
  const hi = qualityBuckets[i+1];
  const count = fmHeavySessions.filter(s => s.quality >= lo && s.quality < hi).length;
  console.log(`  [${lo.toFixed(1)}, ${hi === 1.01 ? '1.0' : hi.toFixed(1)}): ${count} (${(100*count/fmHeavySessions.length).toFixed(1)}%)`);
}

// 6. Verdict distribution
const verdictDist: Map<string, number> = new Map();
for (const s of fmHeavySessions) {
  verdictDist.set(s.verdict, (verdictDist.get(s.verdict) || 0) + 1);
}
console.log('\n--- Verdict Distribution ---');
[...verdictDist.entries()].sort((a,b) => b[1]-a[1]).forEach(([v, count]) => {
  console.log(`  ${v}: ${count} (${(100*count/fmHeavySessions.length).toFixed(1)}%)`);
});

// 7. Per-agent quality within FM-Heavy Workers
console.log('\n--- Per-Agent Quality in FM-Heavy Workers ---');
for (const agent of topAgents) {
  const agentSessions = fmHeavySessions.filter(s => s.agent === agent);
  const avgQ = agentSessions.reduce((s, v) => s + v.quality, 0) / agentSessions.length;
  const avgFM = agentSessions.reduce((s, v) => s + v.fmCount, 0) / agentSessions.length;
  const avgEff = agentSessions.reduce((s, v) => s + v.efficiency, 0) / agentSessions.length;
  const delivered = agentSessions.filter(s => s.resultDelivered).length / agentSessions.length;
  console.log(`  ${agent.padEnd(12)} N=${String(agentSessions.length).padStart(3)}, Q=${avgQ.toFixed(3)}, FM=${avgFM.toFixed(2)}, Eff=${avgEff.toFixed(3)}, Delivered=${(100*delivered).toFixed(0)}%`);
}

// 8. FM-3.3 specific analysis (since we know the guard addresses this)
console.log('\n--- FM-3.3 Deep Dive within FM-Heavy Workers ---');
const fm33Sessions = fmHeavySessions.filter(s => s.fmCodes.includes('FM-3.3'));
const noFm33Sessions = fmHeavySessions.filter(s => !s.fmCodes.includes('FM-3.3'));
console.log(`  With FM-3.3: N=${fm33Sessions.length} (${(100*fm33Sessions.length/fmHeavySessions.length).toFixed(1)}%)`);
console.log(`    Avg Q: ${(fm33Sessions.reduce((s,v)=>s+v.quality,0)/fm33Sessions.length).toFixed(3)}`);
console.log(`    Avg total FM: ${(fm33Sessions.reduce((s,v)=>s+v.fmCount,0)/fm33Sessions.length).toFixed(2)}`);
console.log(`    Delivered: ${(100*fm33Sessions.filter(s=>s.resultDelivered).length/fm33Sessions.length).toFixed(1)}%`);
console.log(`  Without FM-3.3: N=${noFm33Sessions.length} (${(100*noFm33Sessions.length/fmHeavySessions.length).toFixed(1)}%)`);
console.log(`    Avg Q: ${(noFm33Sessions.reduce((s,v)=>s+v.quality,0)/noFm33Sessions.length).toFixed(3)}`);
console.log(`    Avg total FM: ${(noFm33Sessions.reduce((s,v)=>s+v.fmCount,0)/noFm33Sessions.length).toFixed(2)}`);
console.log(`    Delivered: ${(100*noFm33Sessions.filter(s=>s.resultDelivered).length/noFm33Sessions.length).toFixed(1)}%`);

// 9. Compare FM-Heavy Workers to Clean Performers for reference
const cleanCluster = clusterProfiles.sort((a,b) => b.avgQ - a.avgQ)[0];
const cleanSessions = clusterData.get(cleanCluster.id)!;
console.log('\n--- Comparison: FM-Heavy Workers vs Clean Performers ---');
console.log(`  Metric            FM-Heavy          Clean             Delta`);
const fhQ = fmHeavySessions.reduce((s,v)=>s+v.quality,0)/fmHeavySessions.length;
const cpQ = cleanSessions.reduce((s,v)=>s+v.quality,0)/cleanSessions.length;
console.log(`  Quality           ${fhQ.toFixed(3)}             ${cpQ.toFixed(3)}             ${(cpQ-fhQ).toFixed(3)}`);
const fhFM = fmHeavySessions.reduce((s,v)=>s+v.fmCount,0)/fmHeavySessions.length;
const cpFM = cleanSessions.reduce((s,v)=>s+v.fmCount,0)/cleanSessions.length;
console.log(`  FM Count          ${fhFM.toFixed(2)}              ${cpFM.toFixed(2)}              ${(cpFM-fhFM).toFixed(2)}`);
const fhD = fmHeavySessions.filter(s=>s.resultDelivered).length/fmHeavySessions.length;
const cpD = cleanSessions.filter(s=>s.resultDelivered).length/cleanSessions.length;
console.log(`  Delivered         ${(100*fhD).toFixed(1)}%            ${(100*cpD).toFixed(1)}%            ${(100*(cpD-fhD)).toFixed(1)}pp`);

// 10. Temporal analysis - are FM-Heavy Workers concentrated in any period?
console.log('\n--- Temporal Distribution of FM-Heavy Workers ---');
const weekMap = (dateStr: string) => {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `W${String(week).padStart(2, '0')}`;
};

const weeklyFMH: Map<string, {fmh: number, total: number}> = new Map();
for (let i = 0; i < sessions.length; i++) {
  const week = weekMap(sessions[i].createdAt);
  if (!weeklyFMH.has(week)) weeklyFMH.set(week, {fmh: 0, total: 0});
  weeklyFMH.get(week)!.total++;
  if (bestResult!.assignments[i] === fmHeavyId) weeklyFMH.get(week)!.fmh++;
}
[...weeklyFMH.entries()].sort().forEach(([week, data]) => {
  if (data.total >= 10) {
    console.log(`  ${week}: ${data.fmh}/${data.total} FM-Heavy (${(100*data.fmh/data.total).toFixed(1)}%)`);
  }
});

// 11. What would happen if FM-Heavy Workers improved to match Clean Performers?
console.log('\n--- Portfolio Impact Estimation ---');
const totalSessions = sessions.length;
const currentAvgQ = sessions.reduce((s,v) => s+v.quality, 0) / totalSessions;
console.log(`  Current portfolio avg quality: ${currentAvgQ.toFixed(3)}`);

// Scenario 1: FM-Heavy Workers improve to Q=0.65
const scenario1Q = (currentAvgQ * totalSessions - fhQ * fmHeavySessions.length + 0.65 * fmHeavySessions.length) / totalSessions;
console.log(`  If FM-Heavy Q → 0.65: portfolio Q = ${scenario1Q.toFixed(3)} (Δ = +${(scenario1Q 
- currentAvgQ).toFixed(3)})`);

// Scenario 2: FM-Heavy Workers improve to Q=0.70
const scenario2Q = (currentAvgQ * totalSessions - fhQ * fmHeavySessions.length + 0.70 * fmHeavySessions.length) / totalSessions;
console.log(`  If FM-Heavy Q → 0.70: portfolio Q = ${scenario2Q.toFixed(3)} (Δ = +${(scenario2Q - currentAvgQ).toFixed(3)})`);

// Scenario 3: Half move to Clean Performers
const scenario3Q = (currentAvgQ * totalSessions - fhQ * (fmHeavySessions.length/2) + cpQ * (fmHeavySessions.length/2)) / totalSessions;
console.log(`  If 50% become Clean Performers: portfolio Q = ${scenario3Q.toFixed(3)} (Δ = +${(scenario3Q - currentAvgQ).toFixed(3)})`);

