/**
 * EXP-109 Phase 3: Behavioral Clustering Analysis
 * 
 * Build feature matrix from production evaluations, run k-means clustering,
 * identify behavioral archetypes, and find the most improvable clusters.
 */
import { Database } from "bun:sqlite";

const db = new Database(".state/may.db", { readonly: true });

// ============================================================================
// 1. Extract feature matrix from non-heuristic evaluations
// ============================================================================

interface RawRow {
  sessionId: string;
  agent: string;
  quality: number;
  efficiency: number;
  productiveCalls: number;
  wastedCalls: number;
  verdict: string;
  issues: string | null;
  overall: string | null;
  usage: string | null;
  failureChains: string | null;
  createdAt: number;
}

interface FeatureVector {
  sessionId: string;
  agent: string;
  // Continuous features
  quality: number;
  efficiency: number;
  wastedCallRatio: number;  // wastedCalls / (productive + wasted) or 0
  // FM code features
  fmCount: number;          // total FM codes in issues
  hasFM_1x: number;         // FM-1.x (understanding failures)
  hasFM_2x: number;         // FM-2.x (execution failures)
  hasFM_3x: number;         // FM-3.x (verification failures)
  hasFM_4x: number;         // FM-4.x (communication failures)
  hasFM_5x: number;         // FM-5.x (meta failures)
  // Failure chain features
  failureChainCount: number;
  failureChainDepth: number; // max recovery steps in any chain
  // Usage features
  cost: number;
  turns: number;
  // Overall features
  resultDelivered: number;  // 0 or 1
  // Derived
  verdictNumeric: number;   // good=3, acceptable=2, needs_improvement=1, skipped=0
}

function extractFMCodes(issues: string | null): { total: number; fm1: number; fm2: number; fm3: number; fm4: number; fm5: number } {
  if (!issues) return { total: 0, fm1: 0, fm2: 0, fm3: 0, fm4: 0, fm5: 0 };
  const fmMatches = issues.match(/FM-(\d+)\.\d+/g) || [];
  let fm1 = 0, fm2 = 0, fm3 = 0, fm4 = 0, fm5 = 0;
  for (const m of fmMatches) {
    const cat = m.charAt(3);
    if (cat === '1') fm1 = 1;
    else if (cat === '2') fm2 = 1;
    else if (cat === '3') fm3 = 1;
    else if (cat === '4') fm4 = 1;
    else if (cat === '5') fm5 = 1;
  }
  return { total: fmMatches.length, fm1, fm2, fm3, fm4, fm5 };
}

function extractFailureChainFeatures(fc: string | null): { count: number; maxDepth: number } {
  if (!fc || fc === '[]') return { count: 0, maxDepth: 0 };
  try {
    const chains = JSON.parse(fc);
    if (!Array.isArray(chains)) return { count: 0, maxDepth: 0 };
    let maxDepth = 0;
    for (const chain of chains) {
      const depth = chain.recovery?.length || 0;
      if (depth > maxDepth) maxDepth = depth;
    }
    return { count: chains.length, maxDepth };
  } catch {
    return { count: 0, maxDepth: 0 };
  }
}

function extractUsage(usage: string | null): { cost: number; turns: number } {
  if (!usage) return { cost: 0, turns: 0 };
  try {
    const u = JSON.parse(usage);
    return { cost: u.cost || 0, turns: u.turns || 0 };
  } catch {
    return { cost: 0, turns: 0 };
  }
}

function extractOverall(overall: string | null): { resultDelivered: number } {
  if (!overall) return { resultDelivered: 0 };
  try {
    const o = JSON.parse(overall);
    return { resultDelivered: o.result_delivered ? 1 : 0 };
  } catch {
    return { resultDelivered: 0 };
  }
}

// Query all non-heuristic evaluations with quality > 0 (meaningful evaluations)
const rows = db.prepare(`
  SELECT sessionId, agent, quality, efficiency, productiveCalls, wastedCalls,
         verdict, issues, overall, usage, failureChains, createdAt
  FROM evaluations
  WHERE evaluatedByHeuristic = 0 AND quality > 0
`).all() as RawRow[];

console.log(`Raw non-heuristic rows with quality > 0: ${rows.length}`);

// Build feature vectors
const features: FeatureVector[] = [];
for (const row of rows) {
  const fm = extractFMCodes(row.issues);
  const fc = extractFailureChainFeatures(row.failureChains);
  const usage = extractUsage(row.usage);
  const overall = extractOverall(row.overall);
  
  const totalCalls = (row.productiveCalls || 0) + (row.wastedCalls || 0);
  const wastedCallRatio = totalCalls > 0 ? (row.wastedCalls || 0) / totalCalls : 0;
  
  let verdictNumeric = 0;
  if (row.verdict === 'good') verdictNumeric = 3;
  else if (row.verdict === 'acceptable') verdictNumeric = 2;
  else if (row.verdict === 'needs_improvement') verdictNumeric = 1;
  
  features.push({
    sessionId: row.sessionId,
    agent: row.agent,
    quality: row.quality || 0,
    efficiency: row.efficiency || 0,
    wastedCallRatio,
    fmCount: fm.total,
    hasFM_1x: fm.fm1,
    hasFM_2x: fm.fm2,
    hasFM_3x: fm.fm3,
    hasFM_4x: fm.fm4,
    hasFM_5x: fm.fm5,
    failureChainCount: fc.count,
    failureChainDepth: fc.maxDepth,
    cost: usage.cost,
    turns: usage.turns,
    resultDelivered: overall.resultDelivered,
    verdictNumeric,
  });
}

console.log(`Feature vectors built: ${features.length}`);

// ============================================================================
// 2. Normalize features for clustering
// ============================================================================

// Features to use for clustering (exclude identifiers and verdict which is outcome)
const clusterFeatureNames = [
  'quality', 'efficiency', 'wastedCallRatio',
  'fmCount', 'hasFM_2x', 'hasFM_3x',
  'failureChainCount', 'failureChainDepth',
  'cost', 'turns', 'resultDelivered'
] as const;

type ClusterFeature = typeof clusterFeatureNames[number];

// Compute mean and std for each feature
function computeStats(data: FeatureVector[], featureName: ClusterFeature) {
  const vals = data.map(d => d[featureName] as number);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
  const std = Math.sqrt(variance);
  return { mean, std: std || 1 }; // avoid division by zero
}

const stats: Record<string, { mean: number; std: number }> = {};
for (const name of clusterFeatureNames) {
  stats[name] = computeStats(features, name);
}

console.log("\n=== Feature Statistics (pre-normalization) ===");
for (const name of clusterFeatureNames) {
  console.log(`  ${name}: mean=${stats[name].mean.toFixed(3)}, std=${stats[name].std.toFixed(3)}`);
}

// Normalize: z-score
function normalize(vec: FeatureVector): number[] {
  return clusterFeatureNames.map(name => {
    const { mean, std } = stats[name];
    return ((vec[name] as number) - mean) / std;
  });
}

const normalizedData = features.map(normalize);

// ============================================================================
// 3. K-means implementation
// ============================================================================

function euclideanDist(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  return Math.sqrt(sum);
}

function kMeans(data: number[][], k: number, maxIter = 100): { assignments: number[]; centroids: number[][]; iterations: number } {
  const n = data.length;
  const dim = data[0].length;
  
  // Initialize centroids using k-means++ 
  const centroids: number[][] = [];
  // Pick first centroid randomly
  centroids.push([...data[Math.floor(Math.random() * n)]]);
  
  for (let c = 1; c < k; c++) {
    // Compute distance from each point to nearest existing centroid
    const dists = data.map(point => {
      let minDist = Infinity;
      for (const cent of centroids) {
        const d = euclideanDist(point, cent);
        if (d < minDist) minDist = d;
      }
      return minDist * minDist;
    });
    const totalDist = dists.reduce((a, b) => a + b, 0);
    // Weighted random selection
    let r = Math.random() * totalDist;
    for (let i = 0; i < n; i++) {
      r -= dists[i];
      if (r <= 0) {
        centroids.push([...data[i]]);
        break;
      }
    }
    if (centroids.length <= c) {
      centroids.push([...data[Math.floor(Math.random() * n)]]);
    }
  }
  
  let assignments = new Array(n).fill(0);
  let iterations = 0;
  
  for (let iter = 0; iter < maxIter; iter++) {
    iterations = iter + 1;
    
    // Assign each point to nearest centroid
    const newAssignments = data.map(point => {
      let minDist = Infinity;
      let minIdx = 0;
      for (let c = 0; c < k; c++) {
        const d = euclideanDist(point, centroids[c]);
        if (d < minDist) {
          minDist = d;
          minIdx = c;
        }
      }
      return minIdx;
    });
    
    // Check convergence
    let changed = false;
    for (let i = 0; i < n; i++) {
      if (newAssignments[i] !== assignments[i]) { changed = true; break; }
    }
    assignments = newAssignments;
    if (!changed) break;
    
    // Update centroids
    for (let c = 0; c < k; c++) {
      const members = data.filter((_, i) => assignments[i] === c);
      if (members.length === 0) continue;
      for (let d = 0; d < dim; d++) {
        centroids[c][d] = members.reduce((sum, m) => sum + m[d], 0) / members.length;
      }
    }
  }
  
  return { assignments, centroids, iterations };
}

function silhouetteScore(data: number[][], assignments: number[], k: number): number {
  const n = data.length;
  if (n < 2 || k < 2) return 0;
  
  // Pre-compute cluster membership
  const clusters: number[][] = Array.from({ length: k }, () => []);
  for (let i = 0; i < n; i++) {
    clusters[assignments[i]].push(i);
  }
  
  let totalSilhouette = 0;
  let validPoints = 0;
  
  // For large datasets, sample to keep runtime reasonable
  const sampleSize = Math.min(n, 500);
  const sampleIndices: number[] = [];
  if (n <= sampleSize) {
    for (let i = 0; i < n; i++) sampleIndices.push(i);
  } else {
    const step = n / sampleSize;
    for (let i = 0; i < sampleSize; i++) {
      sampleIndices.push(Math.floor(i * step));
    }
  }
  
  for (const i of sampleIndices) {
    const ci = assignments[i];
    const myCluster = clusters[ci];
    
    if (myCluster.length <= 1) continue;
    
    // a(i) = average distance to points in same cluster
    let a = 0;
    for (const j of myCluster) {
      if (j !== i) a += euclideanDist(data[i], data[j]);
    }
    a /= (myCluster.length - 1);
    
    // b(i) = minimum average distance to points in other clusters
    let b = Infinity;
    for (let c = 0; c < k; c++) {
      if (c === ci || clusters[c].length === 0) continue;
      let avgDist = 0;
      for (const j of clusters[c]) {
        avgDist += euclideanDist(data[i], data[j]);
      }
      avgDist /= clusters[c].length;
      if (avgDist < b) b = avgDist;
    }
    
    const si = (b - a) / Math.max(a, b);
    totalSilhouette += si;
    validPoints++;
  }
  
  return validPoints > 0 ? totalSilhouette / validPoints : 0;
}

// ============================================================================
// 4. Run clustering for k=3,4,5,6 with multiple restarts
// ============================================================================

console.log("\n=== Running K-Means Clustering ===");

// Set seed for reproducibility (multiple runs, pick best)
const results: { k: number; silhouette: number; assignments: number[]; centroids: number[][] }[] = [];

for (const k of [3, 4, 5, 6]) {
  let bestSil = -1;
  let bestAssign: number[] = [];
  let bestCentroids: number[][] = [];
  
  const numRestarts = 10;
  for (let restart = 0; restart < numRestarts; restart++) {
    const { assignments, centroids, iterations } = kMeans(normalizedData, k);
    const sil = silhouetteScore(normalizedData, assignments, k);
    if (sil > bestSil) {
      bestSil = sil;
      bestAssign = assignments;
      bestCentroids = centroids;
    }
  }
  
  results.push({ k, silhouette: bestSil, assignments: bestAssign, centroids: bestCentroids });
  
  // Count cluster sizes
  const sizes = Array.from({ length: k }, () => 0);
  bestAssign.forEach(a => sizes[a]++);
  
  console.log(`  k=${k}: silhouette=${bestSil.toFixed(4)}, sizes=[${sizes.join(', ')}]`);
}

// Pick best k
const bestResult = results.reduce((a, b) => a.silhouette > b.silhouette ? a : b);
console.log(`\nBest k: ${bestResult.k} (silhouette=${bestResult.silhouette.toFixed(4)})`);

// ============================================================================
// 5. Profile each cluster for the best k
// ============================================================================

console.log(`\n=== Cluster Profiles (k=${bestResult.k}) ===`);

interface ClusterProfile {
  clusterId: number;
  size: number;
  // Raw feature means
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
  verdictNumeric: number;
  // Agent distribution
  agentDist: Record<string, number>;
  // Verdict distribution
  verdictDist: Record<string, number>;
  // FM category rates
  fm1Rate: number;
  fm2Rate: number;
  fm3Rate: number;
  fm4Rate: number;
  fm5Rate: number;
}

const profiles: ClusterProfile[] = [];

for (let c = 0; c < bestResult.k; c++) {
  const members = features.filter((_, i) => bestResult.assignments[i] === c);
  const n = members.length;
  if (n === 0) continue;
  
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  
  const agentDist: Record<string, number> = {};
  const verdictDist: Record<string, number> = {};
  
  for (const m of members) {
    agentDist[m.agent] = (agentDist[m.agent] || 0) + 1;
    const v = m.verdictNumeric === 3 ? 'good' : m.verdictNumeric === 2 ? 'acceptable' : m.verdictNumeric === 1 ? 'needs_improvement' : 'skipped';
    verdictDist[v] = (verdictDist[v] || 0) + 1;
  }
  
  profiles.push({
    clusterId: c,
    size: n,
    quality: avg(members.map(m => m.quality)),
    efficiency: avg(members.map(m => m.efficiency)),
    wastedCallRatio: avg(members.map(m => m.wastedCallRatio)),
    fmCount: avg(members.map(m => m.fmCount)),
    hasFM_2x: avg(members.map(m => m.hasFM_2x)),
    hasFM_3x: avg(members.map(m => m.hasFM_3x)),
    failureChainCount: avg(members.map(m => m.failureChainCount)),
    failureChainDepth: avg(members.map(m => m.failureChainDepth)),
    cost: avg(members.map(m => m.cost)),
    turns: avg(members.map(m => m.turns)),
    resultDelivered: avg(members.map(m => m.resultDelivered)),
    verdictNumeric: avg(members.map(m => m.verdictNumeric)),
    agentDist,
    verdictDist,
    fm1Rate: avg(members.map(m => m.hasFM_1x)),
    fm2Rate: avg(members.map(m => m.hasFM_2x)),
    fm3Rate: avg(members.map(m => m.hasFM_3x)),
    fm4Rate: avg(members.map(m => m.hasFM_4x)),
    fm5Rate: avg(members.map(m => m.hasFM_5x)),
  });
}

// Sort profiles by quality descending for readable output
profiles.sort((a, b) => b.quality - a.quality);

// Rename clusters by quality rank
const clusterNames: string[] = [];
for (let i = 0; i < profiles.length; i++) {
  const p = profiles[i];
  let name = '';
  
  // Name based on characteristics
  if (p.quality >= 0.65 && p.fmCount < 1.5 && p.resultDelivered > 0.8) {
    name = 'Clean Performers';
  } else if (p.quality >= 0.55 && p.fmCount >= 1.5) {
    name = 'Capable but Messy';
  } else if (p.quality < 0.4 && p.fmCount >= 2) {
    name = 'Struggling with Process';
  } else if (p.quality < 0.4 && p.fmCount < 1) {
    name = 'Silent Failures';
  } else if (p.quality >= 0.4 && p.quality < 0.65 && p.resultDelivered > 0.5) {
    name = 'Mediocre Deliverers';
  } else if (p.efficiency < 0.3) {
    name = 'Inefficient Workers';
  } else {
    name = `Cluster ${i}`;
  }
  
  // Ensure uniqueness
  if (clusterNames.includes(name)) name = name + ` (${i})`;
  clusterNames.push(name);
}

// Print profiles
for (let i = 0; i < profiles.length; i++) {
  const p = profiles[i];
  console.log(`\n--- ${clusterNames[i]} (N=${p.size}, ${(p.size/features.length*100).toFixed(1)}%) ---`);
  console.log(`  Quality:     ${p.quality.toFixed(3)} | Efficiency:  ${p.efficiency.toFixed(3)}`);
  console.log(`  FM Count:    ${p.fmCount.toFixed(2)} | FM-2.x:      ${(p.fm2Rate*100).toFixed(1)}% | FM-3.x: ${(p.fm3Rate*100).toFixed(1)}%`);
  console.log(`  FC Count:    ${p.failureChainCount.toFixed(2)} | FC Depth:    ${p.failureChainDepth.toFixed(2)}`);
  console.log(`  Cost:        $${p.cost.toFixed(2)} | Turns:       ${p.turns.toFixed(1)}`);
  console.log(`  Result:      ${(p.resultDelivered*100).toFixed(1)}% | Verdict avg: ${p.verdictNumeric.toFixed(2)}`);
  console.log(`  WastedRatio: ${(p.wastedCallRatio*100).toFixed(1)}%`);
  
  // Top agents
  const sortedAgents = Object.entries(p.agentDist).sort((a, b) => b[1] - a[1]);
  const topAgents = sortedAgents.slice(0, 5).map(([a, n]) => `${a}(${n}/${(n/p.size*100).toFixed(0)}%)`).join(', ');
  console.log(`  Top agents:  ${topAgents}`);
  
  // Verdict distribution
  const vd = Object.entries(p.verdictDist).sort((a, b) => b[1] - a[1]).map(([v, n]) => `${v}: ${(n/p.size*100).toFixed(1)}%`).join(', ');
  console.log(`  Verdicts:    ${vd}`);
}

// ============================================================================
// 6. Improvability Analysis
// ============================================================================

console.log("\n=== Improvability Analysis ===");
console.log("Improvable = decent quality (>0.4) OR result delivered (>50%) BUT high FM codes (>1.5)");
console.log("These are sessions that succeed despite process issues — fixing the process could push them to 'good'.\n");

for (let i = 0; i < profiles.length; i++) {
  const p = profiles[i];
  const improvable = (p.quality > 0.4 || p.resultDelivered > 0.5) && p.fmCount > 1.5;
  const lowHanging = p.quality >= 0.5 && p.fmCount >= 2;
  
  let label = '❌ Not improvable (already good or too broken)';
  if (lowHanging) label = '🟢 LOW-HANGING FRUIT — decent quality + many fixable FM codes';
  else if (improvable) label = '🟡 IMPROVABLE — delivers results but process is messy';
  
  console.log(`${clusterNames[i]} (N=${p.size}): ${label}`);
  if (improvable || lowHanging) {
    console.log(`  → Quality: ${p.quality.toFixed(2)}, FM count: ${p.fmCount.toFixed(1)}, Top FM categories: 2x=${(p.fm2Rate*100).toFixed(0)}%, 3x=${(p.fm3Rate*100).toFixed(0)}%`);
    console.log(`  → If FM codes reduced by 50%, these ${p.size} sessions could move to higher quality cluster`);
  }
}

// ============================================================================
// 7. Also run k=3,4,5,6 and output all silhouette scores for comparison
// ============================================================================

console.log("\n=== Silhouette Score Comparison ===");
for (const r of results) {
  const bar = '█'.repeat(Math.round(r.silhouette * 50));
  console.log(`  k=${r.k}: ${r.silhouette.toFixed(4)} ${bar}`);
}

// ============================================================================
// 8. Cross-tabulate: cluster × agent
// ============================================================================

console.log("\n=== Cluster × Agent Cross-Tabulation ===");

const agents = [...new Set(features.map(f => f.agent))].sort();
const header = ['Cluster', ...agents].map(s => s.padEnd(12)).join(' | ');
console.log(header);
console.log('-'.repeat(header.length));

for (let i = 0; i < profiles.length; i++) {
  const p = profiles[i];
  const row = [clusterNames[i].substring(0, 12).padEnd(12)];
  for (const agent of agents) {
    const count = p.agentDist[agent] || 0;
    const pct = p.size > 0 ? (count / p.size * 100).toFixed(0) : '0';
    row.push(`${count}(${pct}%)`.padEnd(12));
  }
  console.log(row.join(' | '));
}

// ============================================================================
// 9. Per-cluster FM code detailed breakdown
// ============================================================================

console.log("\n=== Per-Cluster FM Code Distribution ===");

const fmCodes = ['FM-1', 'FM-2.1', 'FM-2.2', 'FM-2.3', 'FM-2.6', 'FM-3.1', 'FM-3.3', 'FM-4', 'FM-5'];

for (let i = 0; i < profiles.length; i++) {
  const p = profiles[i];
  const members = features.filter((_, idx) => bestResult.assignments[idx] === profiles[i].clusterId);
  
  // Count specific FM codes
  const fmCounts: Record<string, number> = {};
  for (const code of fmCodes) fmCounts[code] = 0;
  
  for (const m of members) {
    const rawRow = rows.find(r => r.sessionId === m.sessionId);
    if (!rawRow?.issues) continue;
    for (const code of fmCodes) {
      if (rawRow.issues.includes(code)) fmCounts[code]++;
    }
  }
  
  const topFMs = Object.entries(fmCounts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => `${code}: ${count} (${(count / p.size * 100).toFixed(1)}%)`)
    .join(', ');
  
  console.log(`${clusterNames[i]}: ${topFMs || 'none'}`);
}

// ============================================================================
// 10. Output JSON for results.md generation
// ============================================================================

const output = {
  bestK: bestResult.k,
  bestSilhouette: bestResult.silhouette,
  allSilhouettes: results.map(r => ({ k: r.k, silhouette: r.silhouette })),
  profiles: profiles.map((p, i) => ({
    name: clusterNames[i],
    ...p,
  })),
  featureCount: features.length,
  featureNames: [...clusterFeatureNames],
};

await Bun.write('agents/coach/workspace/exp109-phase3-output.json', JSON.stringify(output, null, 2));
console.log("\nOutput written to agents/coach/workspace/exp109-phase3-output.json");

db.close();
