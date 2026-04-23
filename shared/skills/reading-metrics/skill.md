# Skill: Reading Metrics

## When to Use
Every heartbeat. Metrics are at the top of your heartbeat prompt.

## The Three States

| Symbol | Meaning | Action |
|--------|---------|--------|
| ✅ | Above target | No action needed. Maintain. |
| 📉 | Below target but not critical | Investigate. Is it trending down? Act soon. |
| 🔴 | Critical breach | Act NOW or escalate. This is your top priority. |

## How to Investigate a Bad Metric

### 1. Understand what the metric measures
Read the metric name carefully. If unsure, check `agents/shared/may-agent-docs/design/` for the metric definition.

### 2. Check recent history
```bash
bun -e "
import {Database} from 'bun:sqlite';
const db = new Database('.state/may.db', {readonly:true});
const rows = db.query(\"SELECT value, timestamp FROM metrics WHERE name = ? ORDER BY timestamp DESC LIMIT 10\").all('<metric.name>');
console.log(rows);
"
```

### 3. Find the cause
- Is it a single bad session or a trend?
- Did something change recently? (new intervention, context change, workflow update)
- Is it your metric or are you downstream of another agent's problem?

### 4. Act or escalate
- **You can fix it**: Create a task, fix it this session or next
- **It's another agent's problem**: Notify them with context
- **You don't understand it**: `finish(status='blocked')` with what you know

## Common Mistakes
- **Ignoring 📉**: It becomes 🔴 if you wait
- **Panic on one bad reading**: Check if it's a trend before acting
- **Optimizing a green metric**: Focus on red/yellow first
- **Not checking if the metric is stale**: Old data can show green when reality is red
