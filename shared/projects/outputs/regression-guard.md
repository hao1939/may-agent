# Regression Detection: Agent System Literacy

**Purpose**: Define thresholds that trigger project reactivation if literacy metrics regress.

## Monitored Metrics & Thresholds

| Metric | Current Value | Breach Threshold | Action on Breach |
|--------|--------------|-------------------|-----------------|
| Skill read rate | 8% | Drops below 5% or stays at 0% for 2 weeks | Reactivate project |
| Escalation quality | Near-zero | Stays at zero for 30+ days after fix deployed | Reactivate project |
| Skill file presence | 3 skills × 4 agents | Any target agent missing a deployed skill | Reactivate project |

## Detection Method

Run this check monthly (or on heartbeat):

```bash
# 1. Skill read rate: grep recent checkpoints for skills/ references
find /app/agents/.state/checkpoints/ -name "*.json" -mtime -7 | \
  xargs grep -l "skills/" 2>/dev/null | wc -l
# Breach if result = 0 for 2 consecutive checks

# 2. Skill file presence: verify deployed skills exist
for agent in amy amy-kimi coach tech-lead; do
  for skill in reading-metrics.md escalation.md closing-the-loop.md; do
    test -f /app/agents/$agent/skills/$skill || echo "MISSING: $agent/$skill"
  done
done
# Breach if any output

# 3. Escalation quality: check for structured blocked/failure checkpoints
find /app/agents/.state/checkpoints/ -name "*.json" -mtime -7 | \
  xargs grep -l '"status":"blocked"' 2>/dev/null | head -5
# Breach if zero AND agents had sessions (i.e., they're active but not escalating properly)
```

## Reactivation Trigger

If any metric breaches its threshold, create a new project iteration:
- Set project status back to `active`
- Add milestone: "Investigate regression in [metric name]"
- Reference this file for context
