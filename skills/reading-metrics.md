# Reading Metrics

How to check system health metrics and act on them.

## Steps

1. **Query the data source** — Run the appropriate SQL or API call to pull recent metric values (e.g., project-creation-rate, escalation-quality from `.state/may.db`).

2. **Compare to baseline** — Check the value against known baselines in `.state/metrics/baseline-report.md`. Is it above or below expected?

3. **Diagnose** — If a metric is off, look at recent sessions, logs, or escalations to understand *why*.

4. **Act or escalate** — If you can fix it, fix it. If not, escalate with:
   - The metric name and current value
   - The expected value / baseline
   - Your diagnosis of the cause
   - What you already tried

5. **If this keeps happening, write a guard/handler/skill to prevent it** — Use the [Closing the Loop](../skills/closing-the-loop.md) decision framework:
   - Same alert 2+ times → write a **guard**
   - Manual steps repeated → write a **skill**
   - Mechanical check needed → write a **handler**

## Example Queries

```bash
# Project creation rate (last 7 days) — count actual project files
find .state/projects/ -name "*.md" -mtime -7 | wc -l

# Escalation quality — check recent escalations for context
# NOTE: outcome field contains narrative text, not enum values. Use LIKE match.
bun -e "
import{Database}from'bun:sqlite';const db=new Database('.state/may.db',{readonly:true});
const rows=db.query(\"SELECT agent,task,error,outcome FROM sessions WHERE outcome LIKE 'BLOCKED%' AND startedAt>? ORDER BY startedAt DESC LIMIT 10\").all(Date.now()-7*86400000);
console.log('Blocked sessions (7d):', rows.length);
const quality = rows.length ? rows.filter(r => r.outcome && r.outcome.length > 100).length / rows.length : null;
console.log('Escalation quality:', quality !== null ? (quality*100).toFixed(0)+'%' : 'N/A (0 blocked sessions)');
for(const r of rows) console.log(r.agent, '|', (r.outcome||'').slice(0,80));
"

# Session health overview
bun -e "
import{Database}from'bun:sqlite';const db=new Database('.state/may.db',{readonly:true});
const total=db.query('SELECT COUNT(*) as n FROM sessions WHERE startedAt>?').all(Date.now()-7*86400000);
const agents=db.query('SELECT agent, COUNT(*) as n FROM sessions WHERE startedAt>? GROUP BY agent ORDER BY n DESC').all(Date.now()-7*86400000);
console.log('Total sessions (7d):', total[0]?.n);
for(const r of agents) console.log(' ', r.agent, '→', r.n);
"
```
