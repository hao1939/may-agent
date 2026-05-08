---
id: evaluator-low-quality-rate-calibration
owner: evaluator
status: active
type: calibration
priority: P2
workflow: project
iteration: 1
---

# Evaluator Low Quality Rate Calibration

## Goal
Bring `evaluator.low-quality-rate-24h` below threshold (0.3) and toward target (0.1) by determining whether the breach is caused by (a) evaluator rubric/threshold calibration, or (b) a real system-wide drop in session quality.

## Current State
Iteration 1. Milestones: 0/0 done.
Reviewer: - **I believe**: The breach is largely driven by a **scoring/heuristic shift** (heuristicVersion=2) that marks many sessions as `needs_improvement` (often at quality=0.55) for **process/guard hygiene*
## Signals
- Metric row (2026-05-08): current=0.3889, threshold=0.3, target=0.1.
- Last 24h: 414 evaluations, 161 `needs_improvement`, 0 `fail` => 38.9% low.
- By agent (low/total in last 24h):
  - may 83/232 (35.8%)
  - dev 32/67 (47.8%)
  - scout 22/63 (34.9%)
  - arc 23/47 (48.9%)

## Plan
1. **Validity check (measurement):** confirm metric SQL matches intended definition (verdict mapping, time window on `createdAt`, etc.).
2. **Sample review:** pull a small stratified sample of `needs_improvement` evaluations (e.g., 10 each from may/dev/arc/scout) and manually verify whether verdicts are correct given current `agents/evaluator/knowledge/criteria.md`.
3. **Calibration decision:**
   - If many are borderline/incorrect → update criteria to reduce false NIs and/or adjust metric threshold/target.
   - If most are clearly NI → treat as system-wide quality regression; notify may/coach/optimizer with top recurrent issues.
4. **Metric improvement loop:** after calibration, watch 24h trend for 1–2 cycles.

## Validation
- Metric snapshot falls below 0.3 for at least 3 consecutive snapshots.
- A written artifact exists showing: sample, decision, and rubric/threshold change (if any).

## Journal
### 2026-05-08
Project format normalized to the current shared-project convention: YAML frontmatter owns metadata; body sections carry work context only.


## Artifacts
- outputs/iteration-1-diagnosis.md


## Context
- Heuristic evaluation dominates the last 24h window; heuristicVersion=2 slice has ~0.70 needs_improvement rate vs ~0.165 for heuristicVersion=null.
- Top needs_improvement “issues” are largely hygiene/process/guard failures (finish blocked by uncommitted changes; schema/query error in transcript; interrupted/clean start).
- Next investigation should identify heuristic v2 rule locations + perform a small stratified manual audit to determine false positives vs intended penalties and pick an intervention (rubric vs heuristic tuning vs workflow fixes).
