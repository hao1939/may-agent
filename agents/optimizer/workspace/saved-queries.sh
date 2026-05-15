#!/usr/bin/env bash
# Optimizer Saved Query Library
# Usage: bash saved-queries.sh <command> [hours] [extra-args...]
# All queries use bun:sqlite against .state/may.db

set -euo pipefail
DB=".state/may.db"
COST_PER_OP=0.047

hours="${2:-6}"
cutoff_expr="(strftime('%s','now') - ${hours}*3600) * 1000"

case "${1:-help}" in

session-stats)
  bun -e "
import{Database}from'bun:sqlite';
const db=new Database('$DB',{readonly:true});
const cutoff = Date.now() - ${hours}*3600*1000;
const rows = db.query(\`
  SELECT agent,
    COUNT(*) as sessions,
    ROUND(AVG(opCount),1) as avg_ops,
    SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as errors,
    SUM(opCount) as total_ops
  FROM sessions WHERE startedAt > \${cutoff}
  GROUP BY agent ORDER BY total_ops DESC
\`).all();
console.table(rows);
console.log('Period: last ${hours}h');
"
  ;;

high-op)
  min_ops="${3:-30}"
  bun -e "
import{Database}from'bun:sqlite';
const db=new Database('$DB',{readonly:true});
const cutoff = Date.now() - ${hours}*3600*1000;
const rows = db.query(\`
  SELECT sessionId, agent, opCount, status,
    SUBSTR(task,1,80) as task_snippet
  FROM sessions
  WHERE startedAt > \${cutoff} AND opCount >= ${min_ops}
  ORDER BY opCount DESC LIMIT 20
\`).all();
console.table(rows);
"
  ;;

error-sessions)
  bun -e "
import{Database}from'bun:sqlite';
const db=new Database('$DB',{readonly:true});
const cutoff = Date.now() - ${hours}*3600*1000;
const rows = db.query(\`
  SELECT sessionId, agent, opCount, 
    SUBSTR(task,1,60) as task_snippet,
    SUBSTR(error,1,80) as error_snippet
  FROM sessions
  WHERE startedAt > \${cutoff} AND status='error'
  ORDER BY startedAt DESC LIMIT 20
\`).all();
console.table(rows);
console.log('Total errors:', rows.length);
"
  ;;

workflow-adoption)
  bun -e "
import{Database}from'bun:sqlite';
const db=new Database('$DB',{readonly:true});
const cutoff = Date.now() - ${hours}*3600*1000;
const rows = db.query(\`
  SELECT agent,
    COUNT(*) as total,
    SUM(CASE WHEN workflowRunId IS NOT NULL THEN 1 ELSE 0 END) as workflow,
    ROUND(100.0 * SUM(CASE WHEN workflowRunId IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*), 1) as pct
  FROM sessions WHERE startedAt > \${cutoff}
  GROUP BY agent ORDER BY total DESC
\`).all();
console.table(rows);
"
  ;;

agent-cost)
  bun -e "
import{Database}from'bun:sqlite';
const db=new Database('$DB',{readonly:true});
const cutoff = Date.now() - ${hours}*3600*1000;
const rows = db.query(\`
  SELECT agent,
    SUM(opCount) as total_ops,
    COUNT(*) as sessions,
    ROUND(SUM(opCount) * ${COST_PER_OP}, 2) as est_cost_usd
  FROM sessions WHERE startedAt > \${cutoff}
  GROUP BY agent ORDER BY est_cost_usd DESC
\`).all();
console.table(rows);
const total = rows.reduce((s,r)=>s+r.est_cost_usd,0);
console.log('Total estimated cost: \$' + total.toFixed(2) + ' (last ${hours}h)');
"
  ;;

quality-scores)
  bun -e "
import{Database}from'bun:sqlite';
const db=new Database('$DB',{readonly:true});
const cutoff = Date.now() - ${hours}*3600*1000;
const rows = db.query(\`
  SELECT e.agent,
    COUNT(*) as evaluated,
    ROUND(AVG(e.quality),2) as avg_quality,
    ROUND(AVG(e.efficiency),2) as avg_efficiency,
    SUM(CASE WHEN e.verdict='good' THEN 1 ELSE 0 END) as good,
    SUM(CASE WHEN e.verdict='bad' THEN 1 ELSE 0 END) as bad
  FROM evaluations e
  JOIN sessions s ON e.sessionId = s.sessionId
  WHERE s.startedAt > \${cutoff}
  GROUP BY e.agent ORDER BY avg_quality DESC
\`).all();
console.table(rows);
"
  ;;

help|*)
  echo "Optimizer Saved Query Library"
  echo ""
  echo "Usage: bash saved-queries.sh <command> [hours=6] [extra]"
  echo ""
  echo "Commands:"
  echo "  session-stats [hours]           Agent session counts, avg ops, errors"
  echo "  high-op [hours] [min-ops=30]    Sessions above op threshold"
  echo "  error-sessions [hours]          Recent errors with task snippets"
  echo "  workflow-adoption [hours]       Workflow usage rates by agent"
  echo "  agent-cost [hours]              Estimated cost by agent"
  echo "  quality-scores [hours]          Avg quality/efficiency by agent"
  ;;
esac
