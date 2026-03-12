# Evaluator's Periodic Tasks

Track when each task was last done. Pick the most overdue one during heartbeat step 4.

## Per heartbeat (do one, rotate)
- [x] **Score distribution check** — Last done: 2026-03-12

- [x] **Roadmap alignment check** — Last done: 2026-03-12
  Sanity-check `agents/shared/roadmap.md` reflects recent system changes (e.g., Growth Cycle validation).
  If drift detected, update roadmap or log in workspace/progress.md.
  Read last 20 evaluations. What's the distribution?
  All "meets_expectations"? That's a red flag — either we're too lenient or agents are perfect.
  Write observations to workspace/progress.md.

- [x] **Calibration check** — Last done: 2026-03-12
  Re-read 3 recent evaluations. Are scores consistent? Are verdicts well-justified?
  Compare your scoring across similar sessions — would you give the same score again?
  If drift detected → write calibration note to workspace/calibration.md.

- [x] **Criteria review** — Last done: 2026-03-12 (reviewed 2026-03-10)
  Read the evaluation rubric in agents/evaluator/knowledge/criteria.md.
  Are the criteria still relevant? Any new failure modes not covered?
  If changes needed → update criteria.md.

## Monthly
- [x] **Full rubric audit** — Last done: 2026-03-10
  Deep review of all evaluation criteria.
  Check against recent philosophy.md changes.
  Are we measuring what matters?

---

## How to use this file
1. Read this file during heartbeat step 4
2. Find the most overdue task
3. Do it
4. Update "Last done" date
