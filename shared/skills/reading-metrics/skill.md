# Skill: Reading and Reacting to Metrics

## When to Use
Every heartbeat when metrics are present in your prompt. Also when investigating performance regressions or validating experiment outcomes.

## The Three States

| Symbol | Meaning | Action |
|--------|---------|--------|
| ✅ | Above target | No action needed. Maintain. |
| 📉 | Below target but not critical | Investigate this heartbeat. Act next if trend continues. |
| 🔴 | Critical breach | Act NOW or escalate. Top priority. |

## Investigation Protocol

### Step 1: Understand what the metric measures
Read the metric name. If unclear, check the metric definition in the project or config that owns it.

### Step 2: Check recent history
Query the metrics DB to see if this is a blip or a trend:

```bash
bun -e "
import {Database} from 'bun:sqlite';
const db = new Database('.state/may.db', {readonly:true});
const rows = db.query(\"SELECT value, measured_at FROM metric_snapshots WHERE metric_id = ? ORDER BY measured_at DESC LIMIT 10\").all('<metric-name-here>');
console.table(rows);
"
```

If `may.db` doesn't exist or the table is empty, check `.state/metrics/` for markdown-based metric logs.

### Step 3: Identify the cause
- Single bad session or sustained trend?
- Did something change recently? (new skill deployed, context updated, workflow modified)
- Is it your metric or are you downstream of another agent's output?

### Step 4: Act or escalate
- **You can fix it**: Create a task, fix it now or next heartbeat
- **Another agent's problem**: Notify them with metric value + context
- **Don't understand it**: `finish(status='blocked')` with what you know

### Step 5: Prevent recurrence (close the loop)
Fixing once is not enough. Ask: **will this happen again?**

The evolution ladder for prevention:
1. **Skill** (advisory text) → teaches agents what to watch for
2. **Guard** (enforced check) → blocks bad outputs during workflows
3. **Handler** (automated code) → runs without LLM, zero cost

Move problems UP this ladder when they recur.

## Common Mistakes

| Mistake | Why It's Bad | Fix |
|---------|-------------|-----|
| Ignoring 📉 | Becomes 🔴 if you wait | Investigate same heartbeat |
| Panic on one bad reading | Wastes effort on noise | Check 3+ readings for trend |
| Optimizing green metrics | Opportunity cost | Focus on red/yellow first |
| Not checking staleness | Old data hides real problems | Verify `measured_at` is recent |
| Reporting without acting | "Metric X is red" is not action | Investigate → fix → prevent |

## Example: Full Reaction Sequence

1. See `session-quality: 📉 0.62 (target: 0.75)`
2. Query DB → was 0.78 last week, dropped to 0.65, 0.62 over 3 readings → real trend
3. Check recent changes → new dispatch pattern started 3 days ago
4. Hypothesis: dispatch change caused quality drop
5. Action: revert or fix dispatch, measure next heartbeat
6. Prevention: add a guard that flags quality drops >10% within a week
