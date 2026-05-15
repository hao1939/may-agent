# 2026-05-11 Closed-Loop Steward JSON Parse Recheck

## Signal

During dev heartbeat, recent handler failures showed one `closed-loop-steward` dispatch failure at `1778462423525`:

```text
Workflow "metric-alert-triage" error: JSON Parse error: Unterminated string
```

The same heartbeat also had the repeated red `session.finish-blocked-unresolved-count-24h` metric.

## Findings

- The red metric remains a real strict-window breach, but the strict source query returned exactly one row: historical May `closed-loop-steward` session `s_1778432730435_1172` with `status=interrupted`, `outcome=interrupted`, and issues `terminal status: interrupted` plus `finish blocked by uncommitted changes`.
- The latest metric snapshots checked during this heartbeat all remained `1`, and alert `284` was still open.
- The handler failure was not recurring after the process restart: querying `handler.failed` events after timestamp `1778462423525` returned zero rows.
- Fresh closed-loop-steward runs after the failure completed/started normally: `s_1778463380142_0` completed `done`, and later handler events showed `closed-loop-steward` `handler.completed` with no new JSON parse failure.

## Judgment

Metric operation: `waiting_with_evidence` for `session.finish-blocked-unresolved-count-24h`. The alert is still breaching, so it should not be manually resolved, but its only source row is historical and already documented in `finish-blocked-hygiene-reduction`; validation should happen after the 24h window ages out that row.

Handler failure operation: no code patch this heartbeat. The single JSON parse failure was superseded by successful handler/workflow runs after restart, and the checked code already compacts owner sessions in `metric-alert-triage` plus has a regression test for compacting owner session rows. A patch without reproduction would risk changing working routing logic.

## Next validation

- Next metrics snapshot after `2026-05-11T17:15:51.009Z` should drop the historical strict unresolved row if no newer finish-blocked unresolved sessions appear.
- If another `handler.failed` event with `Workflow "metric-alert-triage" error: JSON Parse error: Unterminated string` appears after this heartbeat, inspect workflow result serialization around `ctx.runFunction("load-alert-context")` and add a regression test for malformed/truncated function output.
