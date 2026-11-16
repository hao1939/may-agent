# Reading Metrics

How to check system health metrics and act on them.

## Steps

1. **Query the data source** — Run the appropriate SQL or API call to pull recent metric values from `.state/may.db`.

2. **Compare to baseline** — Check the value against known baselines in `.state/metrics/baseline-report.md`. Is it above or below expected?

3. **Diagnose** — If a metric is off, look at recent sessions, logs, or escalations to understand *why*.

4. **Act or escalate** — If you can fix it, fix it. If not, escalate with:
   - The metric name and current value
   - The expected value / baseline
   - Your diagnosis of the cause
   - What you already tried

5. **Close the loop — prevent recurrence** — Fixing the immediate problem is not enough. Ask: **will this happen again?**
   - **Same metric breached 3+ times?** → Write a guard that catches the condition during workflow execution.
   - **Manual check you keep doing every heartbeat?** → Write a handler that automates it (zero LLM cost).
   - **Pattern you've learned?** → Write a skill teaching other agents how to handle it.
   - **Nothing you can do programmatically?** → Create a project to track the ongoing effort.
   
   The evolution ladder: **skill** (advisory) → **guard** (enforced during workflows) → **handler** (automated, no LLM). Each step moves work from expensive (LLM reasoning) to cheap (code execution).

## Example Queries

```bash
# Session health overview
bun -e "
import{Database}from'bun:sqlite';const db=new Database('.state/may.db',{readonly:true});
const total=db.query('SELECT COUNT(*) as n FROM sessions WHERE startedAt>?').all(Date.now()-3600000);
const failed=db.query(\"SELECT COUNT(*) as n FROM sessions WHERE outcome LIKE 'ERROR%' AND startedAt>?\").all(Date.now()-3600000);
console.log('Total (1h):', total[0]?.n, 'Failed:', failed[0]?.n);
"
```
