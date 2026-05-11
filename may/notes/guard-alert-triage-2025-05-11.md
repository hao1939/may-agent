# Guard Alert Triage — 2025-05-11

## Alerts
- guard.triggered-count-24h: 573 (threshold 20)
- guard.warned-count-24h: 442 (threshold 20)

## Root Cause
All triggers come from a single guard: "Uncommitted files exist in agents/".
The agents/ worktree has 10 persistent dirty runtime files (last-session.md × 5,
circuit-breaker-state.json, project files). Every session finish() triggers this guard.

## Judgment
**Calibrate** — the guard logic is correct but the metric is noisy.
Escalated to human with P1 message recommending:
1. Exclude runtime files from guard check, OR
2. Raise metric threshold, OR  
3. Add paths to .gitignore
