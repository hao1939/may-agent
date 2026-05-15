# Finding: Evaluation Pipeline P0 Alert is a False Alarm

**Date:** 2026-04-30  
**Severity:** Dismissed (false positive)  
**Source:** P0 notification claiming "evaluation pipeline is dead, last eval 105 days ago"

## Evidence

1. **eval-poller is running**: `lastRunAt: 1777567754755` = 2026-04-30T16:49:14 (minutes ago)
2. **Evaluations are being stored**: `.state/evaluations/` has 19 files, most recent modified Apr 29 17:26
3. **Sessions are being processed**: 1,412 sessions in processed state, 39,758 total sessions in history
4. **Handler is enabled** in `may/cron.json` with 30min interval

## Root Cause of False Alert

The notification claimed "last evaluation in DB was 2026-04-30T15:46:14Z (105 days ago)" — the timestamp is today, making "105 days" mathematically impossible. The alerting logic likely has a bug (wrong date comparison or checking wrong data source).

## Action

- **Dismiss** this P0 alert — the pipeline is healthy
- The alerting system that generated this notification may need investigation (incorrect staleness calculation)
