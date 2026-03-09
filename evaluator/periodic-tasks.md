# Evaluator's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 4.

## Per heartbeat (do one, rotate)
- [x] **Score distribution check** — Last done: 2026-03-22
  Read last 20 evaluations. What's the distribution?
  All "meets_expectations"? That's a red flag — either we're too lenient or agents are perfect.
  Write observations to workspace/progress.md.

- [ ] **Calibration check** — Last done: never
  Re-read 3 recent evaluations. Are scores consistent? Are verdicts well-justified?
  Compare your scoring across similar sessions — would you give the same score again?
  If drift detected → write calibration note to workspace/calibration.md.

- [ ] **Criteria review** — Last done: never
  Read the evaluation rubric in knowledge/domain.md.
  Are the criteria still relevant? Any new failure modes not covered?
  If changes needed → update domain.md.

## Monthly
- [ ] **Full rubric audit** — Last done: never
  Deep review of all evaluation criteria.
  Check against recent philosophy.md changes.
  Are we measuring what matters?

---

## How to use this file
1. Read this file during heartbeat step 4
2. Find the most overdue task
3. Do it
4. Update "Last done" date
