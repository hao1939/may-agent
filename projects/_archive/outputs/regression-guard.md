# Regression Detection: Agent System Literacy

**Purpose**: Define thresholds that trigger project reactivation if literacy metrics regress.
**Status**: ACTIVE guard — check on each heartbeat cycle.

## Monitored Metrics & Thresholds

| Metric | Current Baseline | Breach Threshold | Action on Breach |
|--------|-----------------|-------------------|-----------------|
| Skill read rate | ~0-8% | Below 10% after any improvement campaign raises it above 10% | Reactivate project |
| Skill file presence | 3 skills × 4 agents | Any target agent missing a deployed skill | Reactivate project |
| Escalation quality | Near-zero | Stays at zero 30+ days after skills deployed | Reactivate project |

## Detection Script

Run monthly or on heartbeat:

```bash
#!/bin/bash
# === Skill Read Rate ===
TOTAL=$(find /app/.state/checkpoints/ -name "*.json" -mtime -7 2>/dev/null | wc -l)
WITH_SKILL=$(find /app/.state/checkpoints/ -name "*.json" -mtime -7 2>/dev/null | \
  xargs grep -l "skills/" 2>/dev/null | wc -l)
RATE=$(( TOTAL > 0 ? WITH_SKILL * 100 / TOTAL : 0 ))
echo "skill-read-rate: ${RATE}%"

# === Skill File Presence ===
MISSING=0
for agent in amy amy-kimi coach tech-lead; do
  for skill in reading-metrics.md escalation.md closing-the-loop.md; do
    test -f /app/agents/$agent/skills/$skill || { echo "MISSING: $agent/$skill"; MISSING=$((MISSING+1)); }
  done
done

# === Emit metric to activity log ===
echo "{\"ts\":\"$(date -Is)\",\"metric\":\"skill-read-rate\",\"value\":$RATE,\"missing_skills\":$MISSING}" \
  >> /app/.state/metrics/skill-literacy.jsonl

# === Breach check ===
if [ "$MISSING" -gt 0 ]; then
  echo "BREACH: Missing skill files — reactivate project"
fi
# Note: skill-read-rate breach only applies after a successful improvement campaign
# raises the rate above 10%. Until then, 0% is the known baseline.
```

## Metric Storage

Metrics are appended to `/app/.state/metrics/skill-literacy.jsonl` as JSONL:
```json
{"ts":"2025-07-04T12:00:00+00:00","metric":"skill-read-rate","value":0,"missing_skills":0}
```

Future heartbeats can query this file to detect trends/regressions.

## Reactivation Protocol

If any metric breaches its threshold:
1. Set project status back to `active`
2. Add milestone: "Investigate regression in [metric name]"
3. Reference this file for baseline context

## Current Assessment (Final Milestone)

The skill-read-rate baseline is ~0%. Skills are deployed but not yet actively consumed.
This guard establishes the **floor** — once a future campaign lifts the rate, this guard
ensures it doesn't silently drop back. The guard is the safety net; the improvement work
was tracked in earlier milestones.
