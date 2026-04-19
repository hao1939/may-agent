#!/bin/bash
# Run this to check workflow adoption rates after heartbeat changes
# Usage: bash agents/may/workspace/workflow-adoption-monitor.sh

cd /app

echo "=== Workflow Adoption Monitor ==="
echo "Time: $(date -u)"
echo ""

npx -y bun -e "
import{Database}from'bun:sqlite';
const db=new Database('.state/may.db',{readonly:true});
const now = Date.now();

// Compare last 3h (post-change) vs previous 24h (pre-change)
const cutoff3h = now - 3*3600000;
const cutoff24h = now - 24*3600000;

console.log('=== Per-agent workflow adoption ===');
for(const agent of ['bob','coach','tech-lead','optimizer','scout']) {
  const recent = db.query(\`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN workflowRunId IS NOT NULL THEN 1 ELSE 0 END) as wf
    FROM sessions WHERE agent=? AND startedAt > ? AND kind IN ('job','call')
  \`).get(agent, cutoff3h);
  
  const baseline = db.query(\`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN workflowRunId IS NOT NULL THEN 1 ELSE 0 END) as wf
    FROM sessions WHERE agent=? AND startedAt BETWEEN ? AND ? AND kind IN ('job','call')
  \`).get(agent, cutoff24h, cutoff3h);
  
  const pctRecent = recent.total > 0 ? Math.round(100*recent.wf/recent.total) : 0;
  const pctBase = baseline.total > 0 ? Math.round(100*baseline.wf/baseline.total) : 0;
  console.log(\`  \${agent}: recent=\${pctRecent}% (\${recent.wf}/\${recent.total}) baseline=\${pctBase}% (\${baseline.wf}/\${baseline.total})\`);
}

console.log('');
console.log('=== Workflow sessions by type (last 3h) ===');
const wfRuns = db.query(\`
  SELECT agent, task FROM sessions 
  WHERE workflowRunId IS NOT NULL AND startedAt > ? AND kind='call'
  ORDER BY startedAt DESC LIMIT 20
\`).all(cutoff3h);
for(const r of wfRuns) {
  console.log('  ' + r.agent + ': ' + (r.task||'').slice(0,100));
}
if(wfRuns.length===0) console.log('  (none yet — check back after next heartbeat cycle)');
"
