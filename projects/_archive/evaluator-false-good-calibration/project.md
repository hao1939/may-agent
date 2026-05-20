---
id: evaluator-false-good-calibration
owner: evaluator
status: closed
type: archive
priority: P2
iteration: 4
---

# Archived Project: Evaluator False-Good Calibration

## Current State

Closed: merged into `projects/agent-system-evolution` on 2026-05-20.

The active owner lane is now:

`projects/agent-system-evolution/project.md`

## Moved Artifacts

- `outputs/2026-05-18-iteration-1-false-good-audit.md` -> `projects/agent-system-evolution/outputs/evaluator/false-good-calibration/2026-05-18-iteration-1-false-good-audit.md`
- `outputs/2026-05-18-iteration-2-hardening.md` -> `projects/agent-system-evolution/outputs/evaluator/false-good-calibration/2026-05-18-iteration-2-hardening.md`
- `outputs/2026-05-18-iteration-3-replay-validation.md` -> `projects/agent-system-evolution/outputs/evaluator/false-good-calibration/2026-05-18-iteration-3-replay-validation.md`
- `outputs/2026-05-18-final-review-bundle.md` -> `projects/agent-system-evolution/outputs/evaluator/false-good-calibration/2026-05-18-final-review-bundle.md`
- `journal.md` -> `projects/agent-system-evolution/outputs/evaluator/false-good-calibration/history.md`

## Original Purpose

Reduce evaluator false-good churn by hardening success-candidate scoring so
sessions initially marked `good` are not frequently overturned to `acceptable`
or `needs_improvement` during review.

## Merge Rationale

False-good calibration is evaluator judgment calibration, which is core
agent-system evolution scope. The merge-ready evidence bundle is complete; the
remaining work is a watch item in the evolution umbrella:

- after the evaluator aftermath hardening is merged/deployed, compare the same
  24h `evaluation.false_good` / `evaluation.reviewed` /
  `evaluation.success_candidate` counts against the recorded baseline.
