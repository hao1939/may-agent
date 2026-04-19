#!/usr/bin/env node
// Op-Budget Compliance Check
// Queries sessions from last N hours and compares avg ops against known budgets.
// Usage: node op-budget-check.cjs <db_path> [hours=6]

const Database = require('better-sqlite3');

const dbPath = process.argv[2];
const hours = parseInt(process.argv[3] || '6', 10);

if (!dbPath) {
  console.error('Usage: node op-budget-check.cjs <db_path> [hours]');
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

// Known budgets: agent -> { heartbeat: max, work: max }
const BUDGETS = {
  may:        { heartbeat: 12 },
  coach:      { heartbeat: 10, work: 35 },
  optimizer:  { heartbeat: 20, work: null },
  bob:        { heartbeat: 15, work: null },
  'tech-lead':{ heartbeat: 15, work: null },
  qa:         { heartbeat: null, work: null },
  scout:      { heartbeat: null, work: null },
  evaluator:  { heartbeat: null, work: null },
};

const cutoff = Date.now() - hours * 3600 * 1000;

// Query completed sessions in window
const rows = db.prepare(`
  SELECT agent, task, opCount
  FROM sessions
  WHERE startedAt > ? AND endedAt IS NOT NULL AND opCount > 0
  ORDER BY agent, startedAt
`).all(cutoff);

// Classify sessions
function classify(task) {
  if (!task) return 'work';
  // Heartbeat tasks contain [heartbeat] or start with heartbeat-like patterns
  if (task.toLowerCase().includes('[heartbeat]')) return 'heartbeat';
  // Verification/phase tasks from coach workflows are work
  if (task.includes('Phase ') || task.includes('VERIFICATION TASK')) return 'work';
  if (task.includes('[WORK SESSION]')) return 'work';
  // Default: if task mentions heartbeat.md in first 50 chars, it's heartbeat
  if (task.substring(0, 50).toLowerCase().includes('heartbeat')) return 'heartbeat';
  return 'work';
}

// Aggregate: { agent -> { heartbeat: [ops], work: [ops] } }
const agg = {};
for (const row of rows) {
  const type = classify(row.task);
  if (!agg[row.agent]) agg[row.agent] = { heartbeat: [], work: [] };
  agg[row.agent][type].push(row.opCount);
}

// Build output table
const lines = [];
const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
lines.push(`# Op-Budget Compliance Report`);
lines.push(`Generated: ${now} UTC | Window: last ${hours}h`);
lines.push('');
lines.push('| Agent | Type | Sessions | Avg Ops | Max Ops | Budget | Status |');
lines.push('|-------|------|----------|---------|---------|--------|--------|');

const results = [];

// Sort agents alphabetically
const agents = [...new Set([...Object.keys(agg), ...Object.keys(BUDGETS)])].sort();

for (const agent of agents) {
  const data = agg[agent] || { heartbeat: [], work: [] };
  const budgets = BUDGETS[agent] || {};

  for (const type of ['heartbeat', 'work']) {
    const ops = data[type];
    if (ops.length === 0) continue;

    const avg = ops.reduce((a, b) => a + b, 0) / ops.length;
    const max = Math.max(...ops);
    const budget = budgets[type];
    let status;
    if (budget === null || budget === undefined) {
      status = '—';
    } else if (avg <= budget) {
      status = '✅ OK';
    } else {
      status = `🔴 OVER (+${(avg - budget).toFixed(1)})`;
    }

    const row = {
      agent,
      type,
      count: ops.length,
      avg: avg.toFixed(1),
      max,
      budget: budget !== null && budget !== undefined ? `≤${budget}` : '—',
      status,
    };
    results.push(row);
    lines.push(`| ${agent.padEnd(11)} | ${type.padEnd(9)} | ${String(row.count).padStart(8)} | ${row.avg.padStart(7)} | ${String(row.max).padStart(7)} | ${row.budget.padStart(6)} | ${status} |`);
  }
}

lines.push('');

// Summary section — violations
const violations = results.filter(r => r.status.includes('OVER'));
if (violations.length > 0) {
  lines.push('## ⚠️ Budget Violations');
  for (const v of violations) {
    lines.push(`- **${v.agent}** ${v.type}: avg ${v.avg} ops (budget ${v.budget}, ${v.count} sessions)`);
  }
} else {
  lines.push('## ✅ All agents within budget');
}
lines.push('');

// Detail section — individual sessions that exceeded budget
lines.push('## Session Detail (budget exceedances)');
let exceedCount = 0;
for (const row of rows) {
  const type = classify(row.task);
  const budget = (BUDGETS[row.agent] || {})[type];
  if (budget !== null && budget !== undefined && row.opCount > budget) {
    const taskSnip = row.task.substring(0, 70).replace(/\n/g, ' ');
    lines.push(`- **${row.agent}** [${type}] ${row.opCount} ops (budget ≤${budget}): ${taskSnip}…`);
    exceedCount++;
  }
}
if (exceedCount === 0) {
  lines.push('None — all individual sessions within budget.');
}
lines.push('');

console.log(lines.join('\n'));
