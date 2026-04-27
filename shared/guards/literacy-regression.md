# Guard: Literacy Regression Detection

**Project**: agent-system-literacy
**Created**: 2025-06-25

## Metric Thresholds

| Metric | Threshold | Action |
|--------|-----------|--------|
| Skill read rate | < 10% of active agents reading `skills/` in last 7 days | Reactivate project |
| Escalation quality | < 50% of blocked/failed sessions include structured reason + context | Reactivate project |

## How to Check

```sql
-- Skill read rate: count agents with skills/ references in recent checkpoints
SELECT COUNT(DISTINCT json_extract(data, '$.agent')) 
FROM checkpoints 
WHERE data LIKE '%skills/%' 
AND created_at > datetime('now', '-7 days');

-- Escalation quality: check blocked/failed sessions for structured context
SELECT COUNT(*) 
FROM checkpoints 
WHERE (data LIKE '%blocked%' OR data LIKE '%failure%')
AND data LIKE '%reason%' AND data LIKE '%context%'
AND created_at > datetime('now', '-7 days');
```

## Check Frequency

Weekly (during coach heartbeat or project review cycle).

## Action on Breach

If thresholds are breached:
1. Reactivate `agent-system-literacy` project
2. Re-run investigation to identify new root causes
3. Escalate to coach if skill-read-rate remains 0% after fix attempt
