// EXP-006 Phase 1b: Revised Information Regime Analysis
// 
// The initial file-path classification was too crude. The real question is:
// 1. Input diversity: How many distinct files/sources does the agent read? (more = shared-memory regime)
// 2. Input type: Does it read mostly its own files vs shared files? 
// 3. Task structure: Is the task bounded (clear deliverable) or open-ended (synthesis)?
//
// Better metric: "information scattering" — how many UNIQUE directories the agent reads from.
// Sequential regime: reads from 1-2 directories, produces one artifact
// Shared-memory regime: reads from 3+ directories, synthesizes across sources

import {Database} from 'bun:sqlite';
import {readFileSync, existsSync} from 'fs';
import {join, dirname} from 'path';

const db = new Database('/app/.state/may.db', {readonly: true});

function extractSessionMetrics(sessionDir) {
  const sessionFile = join(sessionDir, 'session.jsonl');
  if (!existsSync(sessionFile)) return null;
  
  const lines = readFileSync(sessionFile, 'utf8').split('\n').filter(Boolean);
  
  const readPaths = [];
  const writePaths = [];
  let dbQueries = 0;
  let totalToolCalls = 0;
  let bashCalls = 0;
  
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.role !== 'assistant' || !Array.isArray(obj.content)) continue;
      
      for (const block of obj.content) {
        if (block.type !== 'toolCall') continue;
        totalToolCalls++;
        const args = block.arguments || {};
        
        if (block.name === 'read' && args.path) {
          readPaths.push(args.path);
        } else if (block.name === 'edit' && args.path) {
          writePaths.push(args.path);
          readPaths.push(args.path); // edit implies read
        } else if (block.name === 'write' && args.path) {
          writePaths.push(args.path);
        } else if (block.name === 'bash') {
          bashCalls++;
          if (/Database|sqlite|\.db/.test(args.command || '')) {
            dbQueries++;
          }
        }
      }
    } catch (e) {}
  }
  
  if (totalToolCalls === 0) return null;
  
  // Metrics
  const uniqueReadDirs = new Set(readPaths.map(p => dirname(p))).size;
  const uniqueReadFiles = new Set(readPaths).size;
  const sharedFileReads = readPaths.filter(p => p.includes('agents/shared/')).length;
  const ownFileReads = readPaths.filter(p => !p.includes('agents/shared/')).length;
  const sharedProportion = readPaths.length > 0 ? sharedFileReads / readPaths.length : 0;
  
  // "Information scattering" = unique dirs read / total reads
  // High = reading from many different places (shared-memory pattern)
  // Low = reading from few places (sequential pattern)
  const infoScatter = readPaths.length > 0 ? uniqueReadDirs / readPaths.length : 0;
  
  // "Cross-agent reads" = reads from other agents' files
  const crossAgentReads = readPaths.filter(p => {
    const m = p.match(/agents\/(\w[\w-]*)\//);
    return m && m[1] !== 'shared'; // exclude shared since that's by-design
  }).length;
  
  return {
    totalToolCalls,
    totalReads: readPaths.length,
    totalWrites: writePaths.length,
    bashCalls,
    dbQueries,
    uniqueReadDirs,
    uniqueReadFiles,
    sharedFileReads,
    ownFileReads,
    sharedProportion: Math.round(sharedProportion * 100) / 100,
    infoScatter: Math.round(infoScatter * 100) / 100,
    crossAgentReads,
    // New: "input complexity" = unique dirs + db queries (proxy for how scattered the information diet is)
    inputComplexity: uniqueReadDirs + dbQueries,
  };
}

const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
const evals = db.prepare(`
  SELECT e.sessionId, e.agent, e.verdict, e.quality, e.efficiency, 
         e.productiveCalls, e.wastedCalls, e.createdAt
  FROM evaluations e
  WHERE e.createdAt > ? AND e.verdict IN ('good', 'acceptable', 'needs_improvement', 'poor')
  ORDER BY e.createdAt DESC
`).all(cutoff);

console.log(`Processing ${evals.length} evaluated sessions...`);

const results = [];
const historyDir = '/app/.state/sessions/history';

for (const ev of evals) {
  const dir = join(historyDir, ev.sessionId);
  const metrics = extractSessionMetrics(dir);
  if (!metrics) continue;
  
  results.push({
    sessionId: ev.sessionId,
    agent: ev.agent,
    verdict: ev.verdict,
    quality: ev.quality,
    efficiency: ev.efficiency,
    ...metrics,
  });
}

console.log(`Got metrics for ${results.length} sessions\n`);

// === Analysis 1: Input Complexity vs Quality ===
console.log('=== INPUT COMPLEXITY vs QUALITY ===');
const complexityBins = {
  'simple (0-2 dirs)': results.filter(r => r.inputComplexity <= 2),
  'moderate (3-5 dirs)': results.filter(r => r.inputComplexity >= 3 && r.inputComplexity <= 5),
  'complex (6+ dirs)': results.filter(r => r.inputComplexity >= 6),
};

for (const [label, sessions] of Object.entries(complexityBins)) {
  if (sessions.length === 0) continue;
  const avgQ = sessions.reduce((s,r) => s + r.quality, 0) / sessions.length;
  const goodRate = sessions.filter(r => r.verdict === 'good').length / sessions.length;
  const niRate = sessions.filter(r => r.verdict === 'needs_improvement' || r.verdict === 'poor').length / sessions.length;
  const agents = {};
  for (const s of sessions) agents[s.agent] = (agents[s.agent] || 0) + 1;
  const topAgents = Object.entries(agents).sort((a,b) => b[1] - a[1]).slice(0,4).map(([a,n]) => `${a}(${n})`).join(', ');
  console.log(`${label.padEnd(22)} N=${String(sessions.length).padStart(3)} | AvgQ=${avgQ.toFixed(2)} | Good=${(goodRate*100).toFixed(1)}% | NI/Poor=${(niRate*100).toFixed(1)}% | ${topAgents}`);
}

// === Analysis 2: Shared file proportion vs Quality (corrected) ===
console.log('\n=== SHARED-FILE PROPORTION vs QUALITY ===');
// Only include sessions with >0 reads
const withReads = results.filter(r => r.totalReads > 0);
const sorted = [...withReads].sort((a,b) => a.sharedProportion - b.sharedProportion);
const qSize = Math.floor(sorted.length / 4);
const quartiles = [
  {label: 'Q1 (least shared)', data: sorted.slice(0, qSize)},
  {label: 'Q2', data: sorted.slice(qSize, 2*qSize)},
  {label: 'Q3', data: sorted.slice(2*qSize, 3*qSize)},
  {label: 'Q4 (most shared)', data: sorted.slice(3*qSize)},
];
for (const q of quartiles) {
  const good = q.data.filter(r => r.verdict === 'good').length;
  const ni = q.data.filter(r => r.verdict === 'needs_improvement' || r.verdict === 'poor').length;
  const range = `${q.data[0]?.sharedProportion.toFixed(2)}-${q.data[q.data.length-1]?.sharedProportion.toFixed(2)}`;
  console.log(`${q.label.padEnd(22)} (${range}): N=${q.data.length} | Good=${(good/q.data.length*100).toFixed(1)}% | NI/Poor=${(ni/q.data.length*100).toFixed(1)}%`);
}

// === Analysis 3: Per-agent breakdown with information diet ===
console.log('\n=== PER-AGENT INFORMATION DIET ===');
console.log('Agent           | N   | AvgReads | AvgDirs | AvgDB | Shared% | AvgQ  | Good%');
console.log('----------------|-----|----------|---------|-------|---------|-------|------');
const byAgent = {};
for (const r of results) {
  if (!byAgent[r.agent]) byAgent[r.agent] = [];
  byAgent[r.agent].push(r);
}
for (const [agent, sessions] of Object.entries(byAgent).sort((a,b) => b[1].length - a[1].length)) {
  if (sessions.length < 3) continue;
  const avg = (arr, fn) => arr.reduce((s,r) => s + fn(r), 0) / arr.length;
  const avgReads = avg(sessions, r => r.totalReads);
  const avgDirs = avg(sessions, r => r.uniqueReadDirs);
  const avgDB = avg(sessions, r => r.dbQueries);
  const avgShared = avg(sessions, r => r.sharedProportion);
  const avgQ = avg(sessions, r => r.quality);
  const goodRate = sessions.filter(r => r.verdict === 'good').length / sessions.length;
  console.log(`${agent.padEnd(16)}| ${String(sessions.length).padStart(3)} | ${avgReads.toFixed(1).padStart(8)} | ${avgDirs.toFixed(1).padStart(7)} | ${avgDB.toFixed(1).padStart(5)} | ${(avgShared*100).toFixed(0).padStart(5)}%  | ${avgQ.toFixed(2).padStart(5)} | ${(goodRate*100).toFixed(0).padStart(4)}%`);
}

// === Analysis 4: Correlation matrix ===
console.log('\n=== CORRELATION WITH QUALITY ===');
function pearson(arr, xfn, yfn) {
  const n = arr.length;
  if (n < 3) return NaN;
  const mx = arr.reduce((s,r) => s + xfn(r), 0) / n;
  const my = arr.reduce((s,r) => s + yfn(r), 0) / n;
  let sxy = 0, sx2 = 0, sy2 = 0;
  for (const r of arr) {
    const dx = xfn(r) - mx;
    const dy = yfn(r) - my;
    sxy += dx * dy;
    sx2 += dx * dx;
    sy2 += dy * dy;
  }
  return sx2 > 0 && sy2 > 0 ? sxy / Math.sqrt(sx2 * sy2) : 0;
}

const metrics = [
  ['totalReads', r => r.totalReads],
  ['uniqueReadDirs', r => r.uniqueReadDirs],
  ['dbQueries', r => r.dbQueries],
  ['sharedProportion', r => r.sharedProportion],
  ['infoScatter', r => r.infoScatter],
  ['inputComplexity', r => r.inputComplexity],
  ['totalToolCalls', r => r.totalToolCalls],
  ['bashCalls', r => r.bashCalls],
];

for (const [name, fn] of metrics) {
  const r_overall = pearson(results, fn, r => r.quality);
  
  // Within-agent (weighted)
  let totalW = 0, weightedR = 0;
  for (const [agent, sessions] of Object.entries(byAgent)) {
    if (sessions.length < 10) continue;
    const r_within = pearson(sessions, fn, r => r.quality);
    if (!isNaN(r_within)) {
      weightedR += r_within * sessions.length;
      totalW += sessions.length;
    }
  }
  const r_within = totalW > 0 ? weightedR / totalW : NaN;
  console.log(`${name.padEnd(20)} | Overall r=${r_overall.toFixed(4).padStart(8)} | Within-agent r=${r_within.toFixed(4).padStart(8)}`);
}

// === Analysis 5: Task type classification ===
console.log('\n=== TASK TYPE ANALYSIS ===');
// Classify sessions by task structure based on initial prompt
for (const ev of evals.slice(0, 5)) {
  const dir = join(historyDir, ev.sessionId);
  const f = join(dir, 'session.jsonl');
  if (!existsSync(f)) continue;
  const firstLine = readFileSync(f, 'utf8').split('\n')[0];
  try {
    const obj = JSON.parse(firstLine);
    const text = Array.isArray(obj.content) ? obj.content[0]?.text : obj.content;
    const taskSnippet = (text || '').slice(0, 200).replace(/\n/g, ' ');
    console.log(`${ev.agent.padEnd(12)} ${ev.verdict.padEnd(12)} ${taskSnippet.slice(0, 120)}`);
  } catch(e) {}
}
