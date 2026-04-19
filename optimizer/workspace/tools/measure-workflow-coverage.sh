#!/usr/bin/env bash
# Workflow coverage measurement script
# Run: bash agents/optimizer/workspace/tools/measure-workflow-coverage.sh

bun -e "
import { Database } from 'bun:sqlite';
const db = new Database('.state/may.db');
const days = parseInt(process.argv[0] || '7');
const ms = days * 86400000;

const coverage = db.query(\`
  SELECT 
    count(*) as total_multistep,
    sum(CASE WHEN workflowRunId IS NOT NULL THEN 1 ELSE 0 END) as with_workflow,
    round(100.0 * sum(CASE WHEN workflowRunId IS NOT NULL THEN 1 ELSE 0 END) / count(*), 1) as coverage_pct
  FROM sessions 
  WHERE opCount > 5 
    AND startedAt > (strftime('%s','now')*1000 - \${ms})
    AND status IN ('done','completed')
\`).get();

const effectiveness = db.query(\`
  SELECT 
    count(DISTINCT workflowRunId) as total_runs,
    count(DISTINCT CASE WHEN status IN ('done','completed') THEN workflowRunId END) as successful,
    round(100.0 * count(DISTINCT CASE WHEN status IN ('done','completed') THEN workflowRunId END) / count(DISTINCT workflowRunId), 1) as effectiveness_pct
  FROM sessions 
  WHERE workflowRunId IS NOT NULL
    AND startedAt > (strftime('%s','now')*1000 - \${ms})
\`).get();

const byAgent = db.query(\`
  SELECT agent,
    count(*) as total,
    sum(CASE WHEN workflowRunId IS NOT NULL THEN 1 ELSE 0 END) as with_wf,
    round(100.0 * sum(CASE WHEN workflowRunId IS NOT NULL THEN 1 ELSE 0 END) / count(*), 1) as pct
  FROM sessions 
  WHERE opCount > 5
    AND startedAt > (strftime('%s','now')*1000 - \${ms})
    AND status IN ('done','completed')
  GROUP BY agent ORDER BY pct DESC
\`).all();

console.log('=== Workflow Metrics (' + days + 'd) ===');
console.log('Coverage:', coverage.coverage_pct + '%', '(' + coverage.with_workflow + '/' + coverage.total_multistep + ')');
console.log('Effectiveness:', effectiveness.effectiveness_pct + '%', '(' + effectiveness.successful + '/' + effectiveness.total_runs + ')');
console.log('');
console.log('By Agent:');
for (const a of byAgent) {
  const bar = '█'.repeat(Math.round(a.pct / 5)) + '░'.repeat(20 - Math.round(a.pct / 5));
  console.log('  ' + a.agent.padEnd(12) + bar + ' ' + a.pct + '% (' + a.with_wf + '/' + a.total + ')');
}
" -- "${1:-7}"
