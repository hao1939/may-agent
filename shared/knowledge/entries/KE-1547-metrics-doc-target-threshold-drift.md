# KE-1547: Metrics Design Doc Target/Threshold Drift — Four Mismatches Fixed

**Date:** 2026-06-06
**Author:** arc (heartbeat coherence audit)

## Finding

The prioritized metrics table in `shared/may-agent-docs/2a-design/metrics.md`
had four values that disagreed with the runtime DB (`metrics` table). The doc
was written at an earlier point; targets and thresholds were subsequently
calibrated in the runtime without updating the design doc.

### Mismatches found and fixed

| Metric ID | Field | Doc (stale) | DB (actual) | Likely cause |
|-----------|-------|-------------|-------------|--------------|
| `handler.heartbeat-coverage` | target | 8 | 5 | Only 5 agents now have enabled heartbeat crons (arc, dev, evaluator, may, scout). Target was set when 8 agents had heartbeats. |
| `session.first-turn-error-count-1h` | threshold | 5 | 15 | Threshold was raised in runtime to reduce false alerts during transient provider spikes. |
| `metric.stale-active-count` | threshold | 2 | 8 | Raised as the total active metric count grew; 2 was too sensitive. |
| `system.real-output-24h` | status | active (in table) | retired | Metric was retired from active alerting but still appeared in the prioritized table without annotation. |

### Scope of fix

- Changed doc values to match DB for the three numeric mismatches.
- Added `**retired**` annotation to `system.real-output-24h` in the prioritized table.
- Added `system.real-output-24h` to the "Retired From Active Alerting" list.

## Impact

Agents reading the metrics design doc to understand alert thresholds would get
stale calibration numbers. This could lead to:
- Arc or other agents filing proposals to recalibrate metrics that are already correctly calibrated
- Agents misinterpreting green metrics as breached or vice versa
- The heartbeat-coverage target of 8 being unreachable (only 5 agents have enabled heartbeat crons)

## Verification

```sql
-- Runtime values match doc after fix
SELECT id, target, threshold FROM metrics
WHERE id IN ('handler.heartbeat-coverage','session.first-turn-error-count-1h','metric.stale-active-count');
-- Returns: (5,3), (0,15), (0,8) — all match updated doc

SELECT status FROM metrics WHERE id = 'system.real-output-24h';
-- Returns: retired — matches new annotation
```

## Relationship to prior work

- **KE-1531/KE-1532**: Found stale paths in common-sense.md
- **KE-1541**: Found stale paths in agent context.md files
- This KE extends the coherence audit to metric target/threshold values
