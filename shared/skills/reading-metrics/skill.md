# Skill: Reading and Reacting to Metrics

## When to Use
Use this when metrics are present in your task, heartbeat, workflow context, or
alert. Also use it when validating whether a change improved system health.

## Core Rule

A metric is a signal, not a judge.

Judge the signal using the project goal, owner context, recent facts, session
evidence, and causal theory. If the metric is stale, malformed, or measuring the
wrong thing, fix the measurement or escalate that fact instead of optimizing the
number.

## The Three States

| Symbol | Meaning | Action |
|--------|---------|--------|
| ✅ | Above target | No action needed. Maintain. |
| 📉 | Below target but not critical | Investigate this heartbeat. Act next if trend continues. |
| 🔴 | Critical breach | Act NOW or escalate. Top priority. |

## Investigation Protocol

### Step 1: Understand what the metric measures
Read the metric name, owner, priority, target, threshold, and latest timestamp.
If unclear, check the metric definition in the project, handler, or config that
owns it.

### Step 2: Prefer injected/live context

If a workflow supplied metric facts, use those first. If not, query through the
safe tool or SDK surface when available:

```sql
SELECT id, owner, priority, current, target, threshold, alert_op, updated_at
FROM metrics
WHERE id = ?;
```

```sql
SELECT id, metric_id, created_at, resolved_at, message
FROM metric_alerts
WHERE metric_id = ?
ORDER BY created_at DESC
LIMIT 5;
```

If you must query manually, inspect the schema or source first. Do not guess DB
columns.

### Step 3: Check recent history
Check whether this is:

- one noisy reading,
- a sustained trend,
- stale measurement,
- measurement failure,
- known accepted exception,
- downstream symptom of another broken path.

### Step 4: Identify the cause
- Single bad session or sustained trend?
- Did something change recently? (new skill deployed, context updated, workflow modified)
- Is it your metric or are you downstream of another agent's output?
- Does transcript/event evidence support the metric's implied story?

### Step 5: Act or escalate
- **You can fix it**: fix the root cause, then re-measure.
- **Another agent owns it**: route to the owner with metric value, evidence, and suspected cause.
- **The metric is wrong/stale**: fix measurement or escalate measurement failure.
- **You don't understand it**: escalate with what you checked and what remains unknown.

### Step 6: Prevent recurrence (close the loop)
Fixing once is not enough. Ask: **will this happen again?**

The prevention ladder:

1. **Skill** teaches agents a recurring process.
2. **Workflow** injects live facts or enforces a repeatable sequence.
3. **Guard** records or intervenes on a mechanical risk.
4. **Handler** automates deterministic reaction.

Move up the ladder only when the lower level has proven insufficient.

## Common Mistakes

| Mistake | Why It's Bad | Fix |
|---------|-------------|-----|
| Ignoring 📉 | Becomes 🔴 if you wait | Investigate same heartbeat |
| Panic on one bad reading | Wastes effort on noise | Check 3+ readings for trend |
| Optimizing green metrics | Opportunity cost | Focus on red/yellow first |
| Not checking staleness | Old data hides real problems | Verify `measured_at` is recent |
| Reporting without acting | "Metric X is red" is not action | Investigate → fix → prevent |
| Treating the value as truth | Bad measurements create bad work | Validate source, owner, and components |

## Example: Full Reaction Sequence

1. See `session-quality: 📉 0.62 (target: 0.75)`
2. Check recent readings: 0.78 last week, then 0.65, then 0.62 -> real trend
3. Check recent changes → new dispatch pattern started 3 days ago
4. Hypothesis: dispatch change caused quality drop
5. Action: revert or fix dispatch, measure next heartbeat
6. Prevention: add workflow/metric context that flags drops >10% within a week
