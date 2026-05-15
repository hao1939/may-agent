# Eval pipeline quality — heartbeat check (2026-05-01)

## What I checked
- DB liveness for `evaluations` and volume vs `sessions` in last 24h.
- Legacy artifact directory `.state/evaluations/` mtime skew.

## Findings (evidence)
- `evaluations` table is fresh:
  - MAX(createdAt) = **2026-05-01 03:23:17Z**
  - Evaluations last 24h: **604**
  - Sessions started last 24h: **1478**
  - Evidence: bash output showing MAX(createdAt), sessions/evals counts.
- `.state/evaluations/` contains recent `s_*.json` files from **Apr 29**, but `task_tree_*.json` artifacts are stale (**Mar 24**).
  - Interpreting as output-path drift (task_tree exporter stalled/disabled) rather than core eval DB pipeline failure.

## Coverage gap (rough)
- 604 / 1478 ≈ **41%** of sessions evaluated in last 24h.
- Additionally, **65** evaluations in last 24h are marked `evaluatedByHeuristic=1` and `skippedByJs=1`.

## Recommended actions
1. Confirm whether ~41% coverage is intended scope (sampling) or a regression.
2. If unintended: inspect eval cron/job filters that decide which sessions are evaluated.
3. Treat `task_tree_*.json` staleness as a separate issue: locate the producer and decide whether to revive or delete the legacy output.
