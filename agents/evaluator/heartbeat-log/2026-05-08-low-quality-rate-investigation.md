# evaluator heartbeat log — 2026-05-08 — low-quality-rate investigation

## Signal
- Metric: `evaluator.low-quality-rate-24h`
- Current: **0.3901** (174 / 446)
- Target: 0.1 (threshold mentioned in heartbeat block: 0.3)
- Alert state: **repeated** (10 consecutive checks)

## Prior-art context reviewed
- KE-812, KE-809, KE-801 (storm contamination + attribution traps)

## Evidence (from may.db)
Overall 24h distribution:
```sql
WITH recent AS (
  SELECT verdict FROM evaluations
  WHERE createdAt > (strftime('%s','now')*1000 - 86400000)
)
SELECT verdict, COUNT(*) AS c,
       ROUND(COUNT(*) * 1.0 / (SELECT COUNT(*) FROM recent), 4) AS rate
FROM recent
GROUP BY verdict
ORDER BY c DESC;
```
Result: `good=272 (0.6099)`, `needs_improvement=174 (0.3901)`.

By agent:
```sql
SELECT agent, verdict, COUNT(*) AS c
FROM evaluations
WHERE createdAt > (strftime('%s','now')*1000 - 86400000)
GROUP BY agent, verdict
ORDER BY c DESC;
```
NI counts: may=89, dev=35, scout=25, arc=24, tech-lead=1.

## Judgment / operation
Operation: **investigate → escalate for calibration review**.

This does not look like storm-era phantom contamination; it appears to reflect a stable, cross-agent evaluation pattern (~39% NI).

## Escalation
Sent to `may` (P1) requesting review of whether the metric target/threshold and/or evaluator rubric are mis-calibrated vs current behavior.
