/**
 * Success criteria for step-limited-triage scenario.
 * Evaluates whether agent made strategic investigation choices under tool-call budget.
 */
module.exports = async function evaluate(environment) {
  const results = [];
  
  // Check 1: BUG-101 fixed (idempotency check added to worker)
  const worker = environment.readFile('src/worker.ts');
  const hasIdempotency = worker.includes('processedIds.has') || 
                          worker.includes('has(task.id)') ||
                          worker.includes('already processed') ||
                          worker.includes('idempoten');
  results.push({
    name: 'BUG-101: Duplicate execution fixed',
    passed: hasIdempotency,
    weight: 30,
  });

  // Check 2: BUG-103 fixed (priority ordering uses sorted result)
  const queue = environment.readFile('src/queue.ts');
  // The fix should use the sorted 'pending' array result instead of queue.find
  const usesFiltered = !queue.includes('queue.find(t => t.status === \'pending\')') ||
                       queue.includes('pending[0]') || 
                       queue.includes('sorted[0]');
  results.push({
    name: 'BUG-103: Priority ordering fixed',
    passed: usesFiltered,
    weight: 30,
  });

  // Check 3: BUG-105 fixed (cleanup filters by 'completed' not 'processing')
  const cleanup = environment.readFile('src/cleanup.ts');
  const correctStatus = cleanup.includes("status === 'completed'") && 
                         !cleanup.includes("status === 'processing'");
  results.push({
    name: 'BUG-105: Cleanup status filter fixed',
    passed: correctStatus,
    weight: 25,
  });

  // Check 4: Dashboard NOT modified (red herring avoided)
  const dashboard = environment.readFile('src/dashboard.ts');
  const dashboardUnchanged = dashboard.includes('NOTE: This is actually correct');
  results.push({
    name: 'BUG-102: Red herring avoided (dashboard unchanged)',
    passed: dashboardUnchanged,
    weight: 15,
  });

  // Calculate score
  const totalWeight = results.reduce((s, r) => s + r.weight, 0);
  const earnedWeight = results.reduce((s, r) => s + (r.passed ? r.weight : 0), 0);
  const score = Math.round((earnedWeight / totalWeight) * 100);

  return { score, results };
};

// CLI wrapper
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const workDir = process.argv[2] || path.join(__dirname, 'environment');
  const env = {
    readFile(relPath) {
      try { return fs.readFileSync(path.join(workDir, relPath), 'utf-8'); } catch { return ''; }
    }
  };
  module.exports(env).then(r => {
    const checks = r.results.map(c => ({ name: c.name, passed: c.passed, message: c.message || '' }));
    const passed = checks.every(c => c.passed);
    console.log(JSON.stringify({ passed, checks }));
  }).catch(e => {
    console.log(JSON.stringify({ passed: false, checks: [{ name: 'error', passed: false, message: e.message }] }));
  });
}
