// EXP-006 Phase 1: Information Regime Analysis
// Tests H-013: Do sessions with more "shared-memory" inputs get worse evaluations?
//
// Methodology:
// 1. For each evaluated session, extract all read/write/edit file paths from session.jsonl
// 2. Classify each file access as "sequential" (task-specific) or "shared-memory" (shared state)
// 3. Compute proportion of shared-memory reads per session
// 4. Correlate with evaluation verdict
//
// Shared-memory files: files that multiple agents read/write regularly
// Sequential files: task-specific files that are inputs or outputs of a specific task

import {Database} from 'bun:sqlite';
import {readFileSync, existsSync, readdirSync} from 'fs';
import {join} from 'path';

const db = new Database('/app/.state/may.db', {readonly: true});

// Shared-memory file patterns (files read by multiple agents as shared state)
const SHARED_PATTERNS = [
  /agents\/shared\/SIGNALS\.md/,
  /agents\/shared\/focus-tasks\.md/,
  /agents\/shared\/common-sense\.md/,
  /agents\/shared\/CONVENTIONS\.md/,
  /agents\/shared\/knowledge\/INDEX\.md/,
  /agents\/shared\/knowledge\/library\//,
  /agents\/shared\/knowledge\/hypotheses\//,
  /agents\/shared\/knowledge\/experiments\//,
  /agents\/shared\/knowledge\/entries\//,
  /agents\/shared\/philosophy\.md/,
  /agents\/shared\/roadmap\.md/,
  /agents\/shared\/best-practices\.md/,
  /agents\/shared\/may-agent-docs\//,
  /journal\.md/,  // own journal = shared state with past self
  /focus-tasks\.md/,
  /heartbeat\.md/,
  /SOUL\.md/,
  /context\.md/,
  /\.state\/.*\.db/,  // DB queries are shared state reads
];

// Sequential patterns: files that are task-specific artifacts
const SEQUENTIAL_PATTERNS = [
  /workspace\/.*brief/,  // task-specific deliverables
  /workspace\/sent\//,
  /workspace\/analysis/,
  /src\//,              // code files (specific artifacts)
  /\.ts$/,
  /\.js$/,
  /\.json$/,
  /\.test\./,
  /gym\//,
  /package\.json/,
];

function classifyAccess(path) {
  for (const pat of SHARED_PATTERNS) {
    if (pat.test(path)) return 'shared';
  }
  for (const pat of SEQUENTIAL_PATTERNS) {
    if (pat.test(path)) return 'sequential';
  }
  // Default: if in agents/shared/ → shared, else sequential
  if (/agents\/shared\//.test(path)) return 'shared';
  return 'sequential';
}

function extractFileAccesses(sessionDir) {
  const sessionFile = join(sessionDir, 'session.jsonl');
  if (!existsSync(sessionFile)) return null;
  
  const lines = readFileSync(sessionFile, 'utf8').split('\n').filter(Boolean);
  const accesses = [];
  
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.role !== 'assistant' || !Array.isArray(obj.content)) continue;
      
      for (const block of obj.content) {
        if (block.type !== 'toolCall') continue;
        
        const args = block.arguments || {};
        
        if (block.name === 'read' && args.path) {
          accesses.push({type: 'read', path: args.path, regime: classifyAccess(args.path)});
        } else if (block.name === 'edit' && args.path) {
          accesses.push({type: 'edit', path: args.path, regime: classifyAccess(args.path)});
        } else if (block.name === 'write' && args.path) {
          accesses.push({type: 'write', path: args.path, regime: classifyAccess(args.path)});
        } else if (block.name === 'bash' && args.command) {
          // Check for DB queries (shared state)
          if (/Database|sqlite|\.db/.test(args.command)) {
            accesses.push({type: 'db_query', path: 'DB', regime: 'shared'});
          }
          // Check for cat/grep of specific files
          const catMatch = args.command.match(/cat\s+(\S+\.md)/);
          if (catMatch) {
            accesses.push({type: 'read_via_bash', path: catMatch[1], regime: classifyAccess(catMatch[1])});
          }
        }
      }
    } catch (e) {}
  }
  
  return accesses;
}

// Get all evaluated sessions from last 7 days
const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
const evals = db.prepare(`
  SELECT e.sessionId, e.agent, e.verdict, e.quality, e.efficiency, 
         e.productiveCalls, e.wastedCalls, e.createdAt
  FROM evaluations e
  WHERE e.createdAt > ? AND e.verdict IN ('good', 'acceptable', 'needs_improvement', 'poor')
  ORDER BY e.createdAt DESC
`).all(cutoff);

console.log(`Found ${evals.length} evaluated sessions in last 7 days`);

const historyDir = '/app/.state/sessions/history';
const results = [];
let processed = 0;
let noTranscript = 0;
let noAccess = 0;

for (const ev of evals) {
  const sessionDir = join(historyDir, ev.sessionId);
  if (!existsSync(sessionDir)) {
    noTranscript++;
    continue;
  }
  
  const accesses = extractFileAccesses(sessionDir);
  if (!accesses || accesses.length === 0) {
    noAccess++;
    continue;
  }
  
  const sharedCount = accesses.filter(a => a.regime === 'shared').length;
  const seqCount = accesses.filter(a => a.regime === 'sequential').length;
  const totalAccess = accesses.length;
  const sharedProportion = totalAccess > 0 ? sharedCount / totalAccess : 0;
  
  results.push({
    sessionId: ev.sessionId,
    agent: ev.agent,
    verdict: ev.verdict,
    quality: ev.quality,
    sharedCount,
    seqCount,
    totalAccess,
    sharedProportion: Math.round(sharedProportion * 100) / 100,
    // Encode verdict numerically: good=4, acceptable=3, needs_improvement=2, poor=1
    verdictScore: ev.verdict === 'good' ? 4 : ev.verdict === 'acceptable' ? 3 : ev.verdict === 'needs_improvement' ? 2 : 1,
  });
  processed++;
}

console.log(`Processed: ${processed}, No transcript: ${noTranscript}, No file access: ${noAccess}`);
console.log('');

// Aggregate by agent
const byAgent = {};
for (const r of results) {
  if (!byAgent[r.agent]) byAgent[r.agent] = [];
  byAgent[r.agent].push(r);
}

console.log('=== PER-AGENT SUMMARY ===');
console.log('Agent           | N   | Avg SharedProp | Avg Quality | Good% | Regime');
console.log('----------------|-----|----------------|-------------|-------|-------');
for (const [agent, sessions] of Object.entries(byAgent).sort((a,b) => b[1].length - a[1].length)) {
  if (sessions.length < 3) continue;
  const avgShared = sessions.reduce((s,r) => s + r.sharedProportion, 0) / sessions.length;
  const avgQuality = sessions.reduce((s,r) => s + r.quality, 0) / sessions.length;
  const goodRate = sessions.filter(r => r.verdict === 'good').length / sessions.length;
  const regime = avgShared > 0.6 ? 'SHARED' : avgShared > 0.3 ? 'MIXED' : 'SEQ';
  console.log(`${agent.padEnd(16)}| ${String(sessions.length).padStart(3)} | ${avgShared.toFixed(2).padStart(14)} | ${avgQuality.toFixed(2).padStart(11)} | ${(goodRate*100).toFixed(0).padStart(4)}% | ${regime}`);
}

// Correlation analysis
console.log('\n=== CORRELATION ANALYSIS ===');
// Pearson correlation between sharedProportion and quality
const n = results.length;
const meanX = results.reduce((s,r) => s + r.sharedProportion, 0) / n;
const meanY = results.reduce((s,r) => s + r.quality, 0) / n;
let sumXY = 0, sumX2 = 0, sumY2 = 0;
for (const r of results) {
  const dx = r.sharedProportion - meanX;
  const dy = r.quality - meanY;
  sumXY += dx * dy;
  sumX2 += dx * dx;
  sumY2 += dy * dy;
}
const pearsonR = sumXY / Math.sqrt(sumX2 * sumY2);
console.log(`Pearson r (sharedProportion vs quality): ${pearsonR.toFixed(4)}`);
console.log(`N = ${n}, Mean shared proportion = ${meanX.toFixed(3)}, Mean quality = ${meanY.toFixed(3)}`);

// Bin analysis: low shared (<0.3), medium (0.3-0.6), high (>0.6)
const bins = {low: [], medium: [], high: []};
for (const r of results) {
  if (r.sharedProportion < 0.3) bins.low.push(r);
  else if (r.sharedProportion < 0.6) bins.medium.push(r);
  else bins.high.push(r);
}

console.log('\n=== BIN ANALYSIS ===');
for (const [label, sessions] of Object.entries(bins)) {
  if (sessions.length === 0) continue;
  const avgQ = sessions.reduce((s,r) => s + r.quality, 0) / sessions.length;
  const goodRate = sessions.filter(r => r.verdict === 'good').length / sessions.length;
  const agents = {};
  for (const s of sessions) agents[s.agent] = (agents[s.agent] || 0) + 1;
  const topAgents = Object.entries(agents).sort((a,b) => b[1] - a[1]).slice(0,3).map(([a,n]) => `${a}(${n})`).join(', ');
  console.log(`${label.toUpperCase().padEnd(7)} (N=${sessions.length}): Avg quality=${avgQ.toFixed(2)}, Good rate=${(goodRate*100).toFixed(1)}%, Top agents: ${topAgents}`);
}

// Within-agent analysis (control for agent identity)
console.log('\n=== WITHIN-AGENT CORRELATION (controlling for agent identity) ===');
let withinCorrelations = [];
for (const [agent, sessions] of Object.entries(byAgent)) {
  if (sessions.length < 10) continue;
  const aN = sessions.length;
  const aMeanX = sessions.reduce((s,r) => s + r.sharedProportion, 0) / aN;
  const aMeanY = sessions.reduce((s,r) => s + r.quality, 0) / aN;
  let aSumXY = 0, aSumX2 = 0, aSumY2 = 0;
  for (const r of sessions) {
    const dx = r.sharedProportion - aMeanX;
    const dy = r.quality - aMeanY;
    aSumXY += dx * dy;
    aSumX2 += dx * dx;
    aSumY2 += dy * dy;
  }
  const aR = (aSumX2 > 0 && aSumY2 > 0) ? aSumXY / Math.sqrt(aSumX2 * aSumY2) : 0;
  console.log(`${agent.padEnd(16)}: r=${aR.toFixed(4)}, N=${aN}, Mean shared=${aMeanX.toFixed(2)}`);
  withinCorrelations.push({agent, r: aR, n: aN});
}

// Weighted average within-agent correlation
const totalW = withinCorrelations.reduce((s,c) => s + c.n, 0);
const weightedR = withinCorrelations.reduce((s,c) => s + c.r * c.n, 0) / totalW;
console.log(`\nWeighted avg within-agent r: ${weightedR.toFixed(4)}`);

// Prediction check: H-013 predicts r > 0.3 between sequential proportion and quality
console.log('\n=== H-013 PREDICTIONS ===');
console.log(`P1 (role swap): Not testable from observational data alone`);
console.log(`P2 (stale-input correlation): Overall r = ${pearsonR.toFixed(4)} (H-013 predicts > 0.3 magnitude)`);
console.log(`   ${Math.abs(pearsonR) > 0.3 ? '✅ SUPPORTED' : Math.abs(pearsonR) > 0.15 ? '⚠️ WEAK SUPPORT' : '❌ NOT SUPPORTED'}`);
console.log(`P3 (freshness effect): Within-agent weighted r = ${weightedR.toFixed(4)}`);
console.log(`   ${Math.abs(weightedR) > 0.2 ? '✅ SUPPORTED' : Math.abs(weightedR) > 0.1 ? '⚠️ WEAK SUPPORT' : '❌ NOT SUPPORTED'}`);

// Verdict distribution by shared proportion quartile
console.log('\n=== VERDICT DISTRIBUTION BY SHARED PROPORTION QUARTILE ===');
const sorted = [...results].sort((a,b) => a.sharedProportion - b.sharedProportion);
const qSize = Math.floor(sorted.length / 4);
const quartiles = [
  {label: 'Q1 (lowest shared)', data: sorted.slice(0, qSize)},
  {label: 'Q2', data: sorted.slice(qSize, 2*qSize)},
  {label: 'Q3', data: sorted.slice(2*qSize, 3*qSize)},
  {label: 'Q4 (highest shared)', data: sorted.slice(3*qSize)},
];
for (const q of quartiles) {
  const good = q.data.filter(r => r.verdict === 'good').length;
  const accept = q.data.filter(r => r.verdict === 'acceptable').length;
  const ni = q.data.filter(r => r.verdict === 'needs_improvement').length;
  const poor = q.data.filter(r => r.verdict === 'poor').length;
  const range = `${q.data[0]?.sharedProportion.toFixed(2)}-${q.data[q.data.length-1]?.sharedProportion.toFixed(2)}`;
  console.log(`${q.label.padEnd(22)} (${range}): good=${good}, accept=${accept}, NI=${ni}, poor=${poor} | Good%=${(good/q.data.length*100).toFixed(1)}%`);
}
