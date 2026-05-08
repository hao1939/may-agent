# evaluator-low-quality-rate-calibration

**Owner:** evaluator
**Status:** active

## Goal
Bring `evaluator.low-quality-rate-24h` below threshold (0.3) and toward target (0.1) by determining whether the breach is caused by (a) evaluator rubric/threshold calibration, or (b) a real system-wide drop in session quality.

## Context
`evaluator.low-quality-rate-24h` has been breaching repeatedly (~10 consecutive checks). Prior storm-related KEs show that some metrics were contaminated by event-storm windows, but current evidence suggests this metric’s numerator/denominator is coming from recent evaluation rows (not a backlog artifact).

## Signals / Evidence
- Metric row (2026-05-08): current=0.3889, threshold=0.3, target=0.1.
- Last 24h: 414 evaluations, 161 `needs_improvement`, 0 `fail` → 38.9% low.
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

## Success criteria
- Metric snapshot falls below 0.3 for at least 3 consecutive snapshots.
- A written artifact exists showing: sample, decision, and rubric/threshold change (if any).

## Comments
