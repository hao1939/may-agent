// detect-drift.js
const fs = require('fs');
const path = require('path');

const RECEIPTS_FILE = process.argv[2] || '.state/ops-receipts.jsonl';
const DRIFT_THRESHOLD_PERCENT = 15;
const MIN_SAMPLES = 5;

// Main Execution
(async () => {
  try {
    if (!fs.existsSync(RECEIPTS_FILE)) {
      console.log(`## Error: Receipts file not found at ${RECEIPTS_FILE}`);
      process.exit(0);
    }

    const content = fs.readFileSync(RECEIPTS_FILE, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    const receipts = lines.map(line => {
      try { return JSON.parse(line); } catch (e) { return null; }
    }).filter(r => r && r.agent && r.tool);

    if (receipts.length === 0) {
      console.log("## No Data\nNo valid receipts found.");
      process.exit(0);
    }

    const report = analyzeDrift(receipts);
    console.log(report);

  } catch (error) {
    console.error("## Fatal Error", error);
    process.exit(1);
  }
})();

function analyzeDrift(receipts) {
  // 1. Group by Agent:Tool
  const groups = {};
  receipts.forEach(r => {
    const key = `${r.agent}:${r.tool}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });

  let output = `# Drift Report\n\n`;
  let driftDetected = false;

  output += `| Agent:Tool | Total | Baseline Success | Recent Success | Drift | Status |\n`;
  output += `|---|---|---|---|---|---|\n`;

  // 2. Analyze Each Group
  for (const [key, group] of Object.entries(groups)) {
    if (group.length < MIN_SAMPLES) continue;

    // Split 80/20
    const splitIndex = Math.floor(group.length * 0.8);
    const baseline = group.slice(0, splitIndex);
    const recent = group.slice(splitIndex);

    if (recent.length === 0) continue;

    const baselineSuccess = calculateSuccessRate(baseline);
    const recentSuccess = calculateSuccessRate(recent);
    const drift = ((recentSuccess - baselineSuccess) / (baselineSuccess || 1)) * 100;

    let status = "✅ Stable";
    if (drift < -DRIFT_THRESHOLD_PERCENT) {
      status = "⚠️ Drift";
      driftDetected = true;
    } else if (drift > DRIFT_THRESHOLD_PERCENT) {
      status = "📈 Improved";
    }

    output += `| **${key}** | ${group.length} | ${(baselineSuccess * 100).toFixed(1)}% | ${(recentSuccess * 100).toFixed(1)}% | ${drift.toFixed(1)}% | ${status} |\n`;
  }

  output += `\n**Verdict**: ${driftDetected ? "⚠️ DRIFT DETECTED" : "✅ SYSTEM STABLE"}\n`;
  return output;
}

function calculateSuccessRate(items) {
  if (items.length === 0) return 0;
  // Count success based on 'status' field being present and not 'error'
  // Or if the tool output implies success. For now assume status field exists.
  // Standard ops receipts have { status: 'success' | 'failure' | 'error' }
  const successCount = items.filter(i => i.status === 'success').length;
  return successCount / items.length;
}
