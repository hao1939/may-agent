# Coach Metric Source Queries

Defined 2026-04-18. These are set as `source_query` in the `metrics` table so May's snapshot cron auto-measures them.

## instruction-compliance (current: 50.4%)
```sql
SELECT ROUND(AVG(passed)*100, 1) FROM gym_runs WHERE scenario LIKE 'metric-reaction%' OR scenario LIKE 'metric-autonomy%'
```
Pass rate across all instruction-testing gym scenarios.

## intervention-hit-rate (current: 52.7%)
```sql
SELECT ROUND(AVG(passed)*100, 1) FROM gym_runs WHERE lab_fork IS NOT NULL AND timestamp > datetime('now', '-30 days')
```
Pass rate of lab-fork experiments in the last 30 days (proxy for intervention success).

## skill-effectiveness (current: 42.1%)
```sql
SELECT ROUND(100.0 * SUM(CASE WHEN rate >= 60 THEN 1 ELSE 0 END) / COUNT(*), 1) FROM (SELECT lab_fork, AVG(passed)*100 as rate FROM gym_runs WHERE lab_fork IS NOT NULL GROUP BY lab_fork HAVING COUNT(*) >= 3)
```
% of lab forks (with ≥3 runs) that achieve ≥60% pass rate.

## knowledge-to-action-latency (manual)
Tracked manually after each growth cycle. Time from KE creation to first experiment.
