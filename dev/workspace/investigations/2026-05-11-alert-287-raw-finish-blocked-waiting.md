# Alert 287 raw finish-blocked triage — waiting_with_evidence

Time: 2026-05-11T07:07Z session
Metric: `session.finish-blocked-uncommitted-count-24h`
Alert: 287
Operation: `waiting_with_evidence`

## Judgment

The alert is a real raw friction breach (`current=58`, `threshold=50`, `target=0`), but it is not currently evidence of unresolved dirty exits. The paired strict metric `session.finish-blocked-unresolved-count-24h` is healthy at `current=0`, and recent strict snapshots are all zero while raw snapshots remain above threshold.

This is being deliberately accepted as a monitoring wait, not resolved or calibrated: the raw metric is intentionally sensitive to repaired finish-block friction, while the strict metric is the resume trigger for root-cause work. Resume `finish-blocked-hygiene-reduction` if the strict metric breaches or a future raw sample exposes a new non-recovered source pattern.

## Evidence checked

Metric rows:

- `session.finish-blocked-uncommitted-count-24h`: `current=58`, `threshold=50`, `target=0`, `priority=P2`, `project=finish-blocked-hygiene-reduction`, `alert_op=>`.
- `session.finish-blocked-unresolved-count-24h`: `current=0`, `threshold=0`, `target=0`, `priority=P1`.
- Open alert 287 remains unresolved for the raw metric.

Recent paired snapshots:

- `2026-05-11 07:44:04Z` raw `58`, strict `0`.
- `2026-05-11 07:39:02Z` raw `58`, strict `0`.
- `2026-05-11 07:34:03Z` raw `57`, strict `0`.
- Latest ten strict snapshots are `0`.

Live 24h raw classification query:

| class | count |
| --- | ---: |
| repaired_success | 55 |
| terminal_no_recovery | 2 |
| repaired_partial | 1 |

No `other_unresolved` rows were present in the live raw 24h classification.

Top raw sources:

| source | count |
| --- | ---: |
| workflow:scout-heartbeat | 18 |
| workflow:scout-explore | 13 |
| workflow:closed-loop-steward | 9 |
| workflow:may-heartbeat | 5 |
| workflow:arc-heartbeat | 5 |
| closed-loop-steward | 4 |
| workflow:metric-alert-triage | 2 |
| workflow:dev-heartbeat | 1 |
| cli | 1 |

Latest raw rows sampled were completed or terminally handled, including repaired successful scout/closed-loop/may exits with `session.status=done`, `outcome=done`, latest digest `success`, plus the existing terminal no-recovery bucket covered by the strict metric exclusion.

## Next validation

Next metrics-snapshot. Continue to watch for either:

1. `session.finish-blocked-unresolved-count-24h > 0`, which should resume project work immediately; or
2. a future raw classification with nonzero `other_unresolved`, which should trigger source-specific sampling and patching.
