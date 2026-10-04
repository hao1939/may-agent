# 2026-07-19 False-Good Cohort Calibration

## Decision

Criteria/scoring guidance changes are accepted from this batch and absorbed into `criteria/criteria.md` plus `criteria/scoring.md`. The existing Success-Candidate Calibration guard correctly described the broad false-good pattern, but the current cohort justified making five repeat gates explicit: finish-status, canonical-output placement, final-validation-wins, metric/code repair safety, and blocked publication/result-review distinction.

The calibration result is retained here as regression evidence for those gates. The live task batch should be closed/removed from the active graph rather than kept as an open criteria-change task.

## Cohort boundaries

- Evaluation time anchor: `2026-07-19T12:11:23.399Z`.
- Primary event window: current-day slice `2026-07-19T00:00:00Z` through `2026-07-19T12:11:23.399Z` (epoch ms `1784419200000..1784463083399`).
- Source event type: `evaluation.false_good`.
- False-good event count in primary window: **16**.
- False-good event id range in primary window: `3530368..3569872`.
- Rolling-24h cross-check ending at the same cutoff: **37** false-good events, id range `3485094..3569872`.
- Runtime metric after the window: `evaluator.false-good-rate-sample = 0.0554`, above target `0.05` but far below alert threshold `0.6`.

## Disagreement tested

The batch tested cases where original routing marked sessions as `good` on the `success_candidate` lane, usually because of `file write/edit` plus verification/project/workflow signals, while independent review emitted `evaluation.false_good` and downgraded the reviewed verdict to `acceptable` or `needs_improvement`.

Observed routed pattern for the 16-event primary false-good cohort:

- All 16 false-good rows had a prior `evaluation.routed` event with `lane = success_candidate`, `verdict = good`.
- Each false-good row recorded `originalVerdict = good` and `heuristicVerdict = good`, while independent aftermath review emitted `reviewedVerdict = acceptable` or `needs_improvement`.
- Independent reviewed verdicts in the false-good cohort: 9 `acceptable`, 7 `needs_improvement`.
- Agent/verdict distribution:
  - `aks-explorer`: 5 acceptable, 1 needs_improvement.
  - `app-ops`: 4 acceptable, 1 needs_improvement.
  - `scout`: 4 needs_improvement.
  - `tech-lead`: 1 needs_improvement.

## Sampled session/review comparisons

| false_good event | target session | agent | original route | independent review | review session | calibration finding |
|---:|---|---|---|---|---|---|
| `3530368` | `s_task_ops_apply-overdue-spec-owner-return-followups-20260719-send-and-refresh_-owner-return-followups-20260719-send-and-refresh_20260719004208` | app-ops | `good` / `success_candidate` | `acceptable` | `s_1784421864990_147` | Finish/status and result-review shape made the work useful but not clean `good`; accepted finish-status and blocked/result-review gates. |
| `3535476` | `s_1784425685273_222` | scout | `good` / `success_candidate` | `needs_improvement` | `s_1784425870081_227` | Artifact-shaped output was not enough when canonical placement/verification failed; accepted canonical-output and final-validation-wins gates. |
| `3547847` | `s_1784436836668_65` | tech-lead | `good` / `success_candidate` | `needs_improvement` | `s_1784437156038_72` | Patch removed expected owner-inbox pair behavior and broke targeted tests; accepted metric/code repair safety and final-validation-wins gates. |
| `3569872` | `s_focus_plan_strategy_20260719094043_hm6rpv` | aks-explorer | `good` / `success_candidate` | `acceptable` | `s_1784454941486_25` | Operationally useful review/strategy work still needed partial/blocked-value scoring rather than automatic `good` from artifact-shaped signals. |

## Criteria calibration result

### Guard result

The false-good guard was sufficient as a review-stage detector: each sampled disagreement produced an `evaluation.false_good` event and a reviewed verdict that contradicted the original `good` route. However, the original success-candidate route was still too permissive, because all 16 primary-window false-good rows had been routed `lane = success_candidate`, `verdict = good` before review.

The prior rubric already named the broad anti-pattern:

- `criteria/criteria.md` said commit/file-write evidence is not sufficient when output is weak, unsupported, malformed, or merely restates existing knowledge.
- It also said malformed tool invocations, validation errors, and verification mismatches must count against top-level quality/efficiency rather than being hidden in metadata.
- Builder criteria already required correctness, side-effect safety, and tests; researcher criteria already required source verification and mechanism calibration.

### Accepted criteria/scoring changes

The batch justified converting the broad guard into explicit scoring gates now recorded in `criteria/criteria.md` and `criteria/scoring.md`:

1. Finish-status gate for success candidates.
2. Canonical-output gate.
3. Final-validation-wins gate.
4. Metric/code repair safety gate.
5. Blocked publication/result-review distinction.

### Regression evidence retained

Future evaluator regressions should use this batch as a regression set: any criteria/routing change that would score the sampled sessions as unqualified `good` should be rejected unless it cites stronger transcript evidence than the reviewed artifacts above.
