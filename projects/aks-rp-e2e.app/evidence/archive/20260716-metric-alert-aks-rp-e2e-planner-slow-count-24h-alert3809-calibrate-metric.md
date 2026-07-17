# Metric alert judgment — `aks-rp-e2e.planner.slow-count-24h` — 2026-07-16

- Alert: `3809`
- Chosen final operation: `calibrate_metric`
- Metric row at triage: `current=1`, `threshold=0`, `target=0`, `priority=P2`

## Why this alert was noisy

Direct recompute before the change showed:

- `aks-rp-e2e.planner.slow-count-24h` source command returned `1`
- `aks-rp-e2e.planner.timeout-24h` source command returned `0`
- Parsing `.state/planner-runs.jsonl` found the single qualifying slow wake was actually a timeout-style owner-step planner wake:
  - `2026-07-15T12:30:00.513Z`
  - `status="assigned"`
  - `result="Agent step \"app-ops\" timed out after 360000ms"`
  - `steps=["event-review","planning-update"]`

That proved the slow metric was still carrying timeout residue that should belong to the dedicated timeout metric.

## Calibration applied

Updated `projects/aks-rp-e2e.app/scripts/project-metrics.ts` so that:

1. `aks-rp-e2e.planner.timeout-24h` counts owner-step timeout wakes in the last 24h.
2. `aks-rp-e2e.planner.slow-count-24h` excludes timeout-style wakes and non-owner-step wakes, leaving only non-timeout owner-step slowness (`>=180s` or interrupted/cancelled).

Updated `projects/aks-rp-e2e.app/scripts/register-project-metrics.ts` descriptions to match the corrected split.

## Validation after the change

Post-change source commands returned:

- `aks-rp-e2e.planner.slow-count-24h` → `0`
- `aks-rp-e2e.planner.timeout-24h` → `1`

This moves the current timeout residue onto the correct P1 timeout metric and clears the noisy P2 slow-count alert.

## Next validation signal

- Next `metrics-snapshot` after this code lands.
- Confirm:
  - `aks-rp-e2e.planner.slow-count-24h = 0`
  - `aks-rp-e2e.planner.timeout-24h = 1` until the `2026-07-15T12:30:00.513Z` timeout ages out of the 24h window.
