const fs = require('fs');
const path = require('path');

/**
 * SKILL: Delegation Metrics (L3 Defense) — v2 with ISR (P80)
 * 
 * Analyzes `.state/delegations.jsonl` to calculate Cross-Agent Delegation (L3) metrics:
 * 1. **Task Success Rate (TSR)**: % of calls where callee reported success.
 * 2. **Integration Success Rate (ISR)**: % of calls where caller's session also succeeded.
 * 3. **Hallucination Gap**: TSR - ISR (how often agents claim success but callers reject).
 * 4. **Latency (P50/P90)**: Median and 90th percentile duration for successful calls.
 * 5. **Volume**: Total calls per pair.
 * 
 * ISR is calculated by cross-referencing each delegation's parent session outcome
 * from `.state/sessions/history/<sessionId>/meta.json`.
 * 
 * Parameters:
 * - `limit` (number, optional): Max recent entries to analyze (default: 100).
 */
module.exports = async function(params) {
  const limit = params && params.limit ? parseInt(params.limit) : 100;
  const metricsFile = path.resolve(process.cwd(), '.state/delegations.jsonl');

  if (!fs.existsSync(metricsFile)) {
    return "No delegation metrics found (file does not exist).";
  }

  // Read file lines (reverse to get most recent)
  const content = fs.readFileSync(metricsFile, 'utf-8');
  if (!content.trim()) {
    return "No delegation metrics found (empty file).";
  }

  const lines = content.trim().split('\n').filter(Boolean).reverse().slice(0, limit);

  // Parse JSONL
  const entries = lines.map(line => {
    try { 
      return JSON.parse(line); 
    } catch { 
      return null; 
    }
  }).filter(e => e && e.timestamp);

  if (entries.length === 0) {
    return "No valid delegation entries found.";
  }

  // Helper: look up a session's final status from meta.json
  const sessionStatusCache = {};
  function getSessionStatus(sessionId) {
    if (!sessionId) return null;
    if (sessionId in sessionStatusCache) return sessionStatusCache[sessionId];
    
    const metaPath = path.resolve(process.cwd(), '.state/sessions/history', sessionId, 'meta.json');
    try {
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        sessionStatusCache[sessionId] = meta.status || null;
        return sessionStatusCache[sessionId];
      }
    } catch {}
    
    // Also check active sessions
    const activePath = path.resolve(process.cwd(), '.state/sessions/active', sessionId, 'meta.json');
    try {
      if (fs.existsSync(activePath)) {
        const meta = JSON.parse(fs.readFileSync(activePath, 'utf-8'));
        sessionStatusCache[sessionId] = meta.status || 'active';
        return sessionStatusCache[sessionId];
      }
    } catch {}
    
    sessionStatusCache[sessionId] = null;
    return null;
  }

  // Aggregate by Pair (Parent -> Child)
  const pairs = {};

  for (const e of entries) {
    if (e.parent && e.child) {
      const key = `${e.parent}->${e.child}`;
      if (!pairs[key]) {
        pairs[key] = { 
          total: 0, 
          success: 0, 
          integrated: 0,
          parentResolved: 0,
          durations: [],
          callTotal: 0,
          callSuccess: 0,
          sendTotal: 0,
          sendSuccess: 0,
        };
      }
      
      pairs[key].total++;
      
      // TSR: callee completed without error
      // P87: 'send' returning "sent" is a success for the caller (fire-and-forget)
      const calleeSuccess = (e.status === 'success' || e.status === 'sent');
      if (calleeSuccess) {
        pairs[key].success++;
        if (typeof e.durationMs === 'number') {
          pairs[key].durations.push(e.durationMs);
        }
      }

      // Track per-method counts for accurate gap calculation
      if (e.method === 'call') {
        pairs[key].callTotal++;
        if (calleeSuccess) pairs[key].callSuccess++;
      } else {
        pairs[key].sendTotal++;
        if (calleeSuccess) pairs[key].sendSuccess++;
      }
      
      // ISR: check if the parent session ultimately succeeded
      // For 'call': sessionId IS the parent session (parent waits for result)
      // For 'send': sessionId is ALSO the parent session (fire-and-forget, but
      //   we can still check if the parent's overall session succeeded)
      const parentStatus = getSessionStatus(e.sessionId);
      if (parentStatus && parentStatus !== 'active' && parentStatus !== 'running') {
        pairs[key].parentResolved++;
        if (parentStatus === 'done') {
          pairs[key].integrated++;
        }
      }
    }
  }

  // Compute stats
  const results = [];
  let globalTSR = { total: 0, success: 0 };
  let globalISR = { resolved: 0, integrated: 0 };

  for (const key of Object.keys(pairs)) {
    const data = pairs[key];
    const tsr = data.total > 0 ? ((data.success / data.total) * 100) : 0;
    const isr = data.parentResolved > 0 ? ((data.integrated / data.parentResolved) * 100) : null;
    const gap = isr !== null ? (tsr - isr) : null;
    
    // Accumulate globals
    globalTSR.total += data.total;
    globalTSR.success += data.success;
    globalISR.resolved += data.parentResolved;
    globalISR.integrated += data.integrated;

    // Calculate P50/P90
    data.durations.sort((a, b) => a - b);
    
    let p50 = 0;
    let p90 = 0;
    
    if (data.durations.length > 0) {
      const idx50 = Math.floor(data.durations.length * 0.5);
      const idx90 = Math.floor(data.durations.length * 0.9);
      p50 = data.durations[Math.min(idx50, data.durations.length - 1)];
      p90 = data.durations[Math.min(idx90, data.durations.length - 1)];
    }

    // Flag low-confidence ISR (N < 5 resolved parent sessions)
    const isrLowN = data.parentResolved > 0 && data.parentResolved < 5;
    const isrSuffix = isrLowN ? ` (n=${data.parentResolved})` : '';

    results.push({
      pair: key,
      total: data.total,
      successCount: data.success,
      tsr: `${tsr.toFixed(1)}%`,
      isr: isr !== null ? `${isr.toFixed(1)}%${isrSuffix}` : 'n/a',
      gap: gap !== null ? `${gap.toFixed(1)}%` : 'n/a',
      p50: `${(p50/1000).toFixed(1)}s`,
      p90: `${(p90/1000).toFixed(1)}s`,
      callTotal: data.callTotal,
      sendTotal: data.sendTotal,
      parentResolved: data.parentResolved,
      isrLowN,
    });
  }

  // Sort by volume descending
  results.sort((a, b) => b.total - a.total);

  // Global summary
  const globalTSRpct = globalTSR.total > 0 ? ((globalTSR.success / globalTSR.total) * 100) : 0;
  const globalISRpct = globalISR.resolved > 0 ? ((globalISR.integrated / globalISR.resolved) * 100) : null;
  const globalGap = globalISRpct !== null ? (globalTSRpct - globalISRpct) : null;

  // Format output
  let output = `### Delegation Metrics (Last ${entries.length} entries)\n\n`;
  
  // P80 ISR Summary
  output += `**System Health (P80)**\n`;
  output += `- **TSR (Task Success Rate)**: ${globalTSRpct.toFixed(1)}% (${globalTSR.success}/${globalTSR.total} calls succeeded)\n`;
  if (globalISRpct !== null) {
    output += `- **ISR (Integration Success Rate)**: ${globalISRpct.toFixed(1)}% (${globalISR.integrated}/${globalISR.resolved} parent sessions succeeded after call)\n`;
    output += `- **Hallucination Gap (TSR - ISR)**: ${globalGap.toFixed(1)}%`;
    if (globalGap > 20) {
      output += ` ⚠️ CRITICAL — agents claim success but callers are failing (L3 Consensus Hallucination)`;
    } else if (globalGap > 10) {
      output += ` ⚡ WARNING — significant disconnect between callee success and caller acceptance`;
    } else if (globalGap < -20) {
      output += ` 🛡️ NOTE — callers succeed despite callee failures (good error recovery)`;
    }
    output += `\n`;
  } else {
    output += `- **ISR**: n/a (no resolved synchronous calls to measure)\n`;
  }
  output += `\n`;

  // Per-pair table
  output += `| Pair | Total | Calls/Sends | TSR | ISR | Gap | P50 | P90 |\n`;
  output += `|---|---:|---:|---:|---:|---:|---:|---:|\n`;
  
  for (const r of results) {
    const methodBreakdown = `${r.callTotal}/${r.sendTotal}`;
    output += `| ${r.pair} | ${r.total} | ${methodBreakdown} | ${r.tsr} | ${r.isr} | ${r.gap} | ${r.p50} | ${r.p90} |\n`;
  }
  
  if (results.length === 0) {
    output += "\nNo pair data found in recent entries.\n";
  }

  // ISR methodology note
  output += `\n_ISR is computed for both \`call\` and \`send\` delegations by checking whether the **caller's parent session** ultimately succeeded. `;
  output += `The "Calls/Sends" column shows the method breakdown. ISR values with (n=N) have low sample size (N<5) and should be treated as unreliable. `;
  output += `A high TSR but low ISR indicates consensus hallucination (L3 Collective Drift)._\n`;

  return output;
};
