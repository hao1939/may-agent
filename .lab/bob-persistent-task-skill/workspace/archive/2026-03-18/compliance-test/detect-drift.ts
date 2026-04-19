import { readFileSync } from 'fs';

interface OpsReceipt {
  timestamp: string;
  sessionId: string;
  agent: string;
  tool: string;
  status: string;
  meta: any;
}

const file = process.argv[2];
if (!file) {
  console.error("Usage: tsx detect-drift.ts <file>");
  process.exit(1);
}

const lines = readFileSync(file, 'utf-8').split('\n').filter(l => l.trim());
const receipts: OpsReceipt[] = lines.map(l => JSON.parse(l));

// Group by agent/tool
const groups: Record<string, OpsReceipt[]> = {};
for (const r of receipts) {
  const key = `${r.agent}:${r.tool}`;
  if (!groups[key]) groups[key] = [];
  groups[key].push(r);
}

console.log("## Drift Report");

for (const key in groups) {
  const rs = groups[key];
  if (rs.length < 10) continue; // Need at least 10 for window

  const windowSize = 5; // Use 5 for test data, 10 for prod
  const baseline = rs.slice(0, rs.length - windowSize);
  const current = rs.slice(rs.length - windowSize);

  // Calculate Success Rate
  const baseSuccess = baseline.filter(r => r.status === 'success').length / baseline.length;
  const currSuccess = current.filter(r => r.status === 'success').length / current.length;

  if (currSuccess < baseSuccess - 0.15) {
    console.log(`### Anomaly Detected: ${key}`);
    console.log(`- **Metric**: Success Rate`);
    console.log(`- **Baseline**: ${(baseSuccess * 100).toFixed(1)}%`);
    console.log(`- **Current**: ${(currSuccess * 100).toFixed(1)}%`);
    console.log(`- **Drift**: -${((baseSuccess - currSuccess) * 100).toFixed(1)}% ⚠️`);
  }
}
