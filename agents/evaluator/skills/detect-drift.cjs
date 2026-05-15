// agents/evaluator/skills/detect-drift.cjs
const fs = require('fs');
const path = require('path');

const RECEIPTS_FILE = process.argv[2] || '.state/ops-receipts.jsonl';
const DRIFT_THRESHOLD_PERCENT = 0.15; // 15%
const MIN_SAMPLES = 5;

// Helper to calculate success rate
function calculateSuccessRate(items) {
  if (items.length === 0) return 0;
  // A receipt is successful if it has 'status' === 'success'
  // Or if it lacks 'status' but has 'exitCode' === 0 (for shell commands)
  const successCount = items.filter(i => {
    if (i.status) return i.status === 'success';
    if (i.exitCode !== undefined) return i.exitCode === 0;
    return false; // Default fail if status unknown
  }).length;
  return successCount / items.length;
}

function analyzeDrift(receipts) {
  // 1. Group by Agent:Tool
  const groups = {};
  
  receipts.forEach(r => {
    // Only analyze if agent and tool are present
    if (!r.agent || !r.tool) return;

    const key = `${r.agent}:${r.tool}`;
    if (!groups[key]) {
        groups[key] = {
            agent: r.agent,
            tool: r.tool,
            items: []
        };
    }
    groups[key].items.push(r);
  });

  const results = [];
  let systemDriftDetected = false;

  // 2. Analyze Each Group
  for (const [key, group] of Object.entries(groups)) {
    const totalItems = group.items;
    
    // Skip if not enough data
    if (totalItems.length < MIN_SAMPLES) continue;

    // Split 80/20 (Baseline vs Recent)
    const splitIndex = Math.floor(totalItems.length * 0.8);
    const baselineItems = totalItems.slice(0, splitIndex);
    const recentItems = totalItems.slice(splitIndex);

    if (baselineItems.length === 0 || recentItems.length === 0) continue;

    const baselineRate = calculateSuccessRate(baselineItems);
    const recentRate = calculateSuccessRate(recentItems);
    
    // Avoid division by zero for percentage calculation
    const baselineVal = baselineRate === 0 ? 0.01 : baselineRate;
    const driftPercent = ((recentRate - baselineRate) / baselineVal);

    let status = "stable";
    
    // Check for negative drift (degradation)
    if (driftPercent < -DRIFT_THRESHOLD_PERCENT) {
      status = "drift";
      systemDriftDetected = true;
    } 
    // Check for positive drift (improvement)
    else if (driftPercent > DRIFT_THRESHOLD_PERCENT) {
      status = "improved";
    }

    results.push({
      key: key,
      agent: group.agent,
      tool: group.tool,
      count: totalItems.length,
      baseline: parseFloat(baselineRate.toFixed(2)),
      recent: parseFloat(recentRate.toFixed(2)),
      delta: parseFloat(driftPercent.toFixed(2)),
      status: status
    });
  }

  return {
    verdict: systemDriftDetected ? "drift_detected" : "stable",
    details: results
  };
}

// Main Execution
if (require.main === module) {
  (async () => {
    try {
      if (!fs.existsSync(RECEIPTS_FILE)) {
        console.log(JSON.stringify({ error: `File not found: ${RECEIPTS_FILE}` }));
        process.exit(0);
      }

            // Read only the tail of the receipts file to avoid over-weighting ancient history
      // and to keep runtime bounded (large JSONL files can be MBs).
      const content = fs.readFileSync(RECEIPTS_FILE, 'utf8');
      const allLines = content.split('\n').filter(line => line.trim());

      // Keep last 500 lines (enough for baseline/recent windows in most repos).
      const lines = allLines.slice(-500);

      const receipts = [];
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          receipts.push(parsed);
        } catch (e) {
          // Skip invalid lines
        }
      }

      if (receipts.length === 0) {
        console.log(JSON.stringify({ error: "No valid receipts found." }));
        process.exit(0);
      }

      const report = analyzeDrift(receipts);
      console.log(JSON.stringify(report, null, 2));

    } catch (error) {
      console.error(JSON.stringify({ error: error.message }));
      process.exit(1);
    }
  })();
}

module.exports = { analyzeDrift, calculateSuccessRate };
