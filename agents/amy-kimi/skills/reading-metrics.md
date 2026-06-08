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
Read the metric name carefully. If unsure, check `shared/may-agent-docs/2a-design/` for the metric definition.

### 2. Check recent history
```bash
bun -e "
// Use query_db tool instead:
// query_db({ sql: "SELECT ..." })
const rows = db.query(\"SELECT value, measured_at FROM metric_snapshots WHERE metric_id = ? ORDER BY measured_at DESC LIMIT 10\").all('<metric.name>');
console.table(rows);
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

### 5. Close the loop — prevent recurrence
Fixing the immediate problem is not enough. Ask: **will this happen again?**

- **Same metric breached 3+ times?** → Write a guard that catches the condition during workflow execution. See `shared/guards/verify-after-write.ts` for an example.
- **Manual check you keep doing every heartbeat?** → Write a handler that automates it (zero LLM cost). See `agents/may/handlers/watchdog.ts` for an example.
- **Pattern you've learned?** → Write a skill teaching other agents how to handle it. See `shared/skills/` for format.
- **Nothing you can do programmatically?** → Create a project to track the ongoing effort.

The evolution ladder: **skill** (advisory) → **guard** (enforced during workflows) → **handler** (automated, no LLM). Each step moves work from expensive (LLM reasoning) to cheap (code execution).

## Common Mistakes
- **Ignoring 📉**: It becomes 🔴 if you wait
- **Panic on one bad reading**: Check if it's a trend before acting
- **Optimizing a green metric**: Focus on red/yellow first
- **Not checking if the metric is stale**: Old data can show green when reality is red
- **Fixing but not preventing**: You fixed the symptom. Will it come back? If yes, extend the system.
- **Just reporting**: "Metric X is red" is not action. Investigate, fix, and close the loop.
