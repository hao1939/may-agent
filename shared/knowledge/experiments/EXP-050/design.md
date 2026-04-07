# EXP-050: Workflow Overhead Reduction — implement-and-verify vs implement-and-review

**Hypothesis**: H-070 P3 — reducing C_fixed (workflow overhead) improves net benefit for small tasks
**Status**: Designed — awaiting execution
**Created**: 2026-04-07
**Owner**: Tech-Lead

## Background

H-070 predicts: `Net_benefit = R × N_decisions × benefit_per_elimination - C_fixed`

When tasks are small (few decisions), C_fixed dominates and workflows hurt. EXP-025 showed implement-and-review hurts in 53% of gym scenarios. P3 predicts: a minimal workflow (lower C_fixed) should hurt in fewer scenarios.

## Design

### Independent Variable
Workflow type:
- **Control**: `implement-and-review` (C_fixed ≈ 9-15 ops — coder + QA + retry logic)
- **Treatment**: `implement-and-verify` (C_fixed ≈ 3-5 ops — coder + shell check)
- **Baseline**: No workflow (direct coder call)

### Dependent Variables
1. **Task completion rate** — did the task get done correctly?
2. **Op count** — total operations consumed
3. **C_fixed** — measured overhead per invocation (ops spent on non-task work)
4. **Net benefit** — quality delta vs baseline, adjusted for cost

### Test Scenarios

Select 6-8 gym scenarios where implement-and-review is known to hurt (from EXP-025 data):
- Small tasks (1-2 files, ≤5 decisions)
- Tasks where baseline coder already scores well (≥7/9)
- Convention-verify-multi-edit, simple refactoring, single-file fixes

For each scenario, run all three conditions 2-3 times each.

### Protocol

1. For each scenario:
   a. Run baseline: `agents.call("coder", task)` — record ops, quality
   b. Run implement-and-review: `workflow.run("implement-and-review", task)` — record ops, quality, C_fixed
   c. Run implement-and-verify: `workflow.run("implement-and-verify", task)` — record ops, quality, C_fixed
2. Measure C_fixed by counting ops spent on coordination vs actual task work
3. Score quality using existing gym evaluation criteria

### Success Criteria

H-070 P3 is **supported** if:
- implement-and-verify hurts in **fewer** scenarios than implement-and-review
- C_fixed for implement-and-verify is measurably lower (≤5 ops vs ≥9 ops)
- At least 1 scenario where implement-and-review hurts but implement-and-verify helps

H-070 P3 is **refuted** if:
- implement-and-verify hurts in same or more scenarios than implement-and-review
- OR C_fixed is not meaningfully different

### Key Measurements to Record

| Metric | How to measure |
|--------|---------------|
| C_fixed | Total ops minus coder-step ops |
| Quality | Gym evaluator score (1-9 scale) |
| Completion | Done vs escalated vs error |
| Wall time | Session duration |
| Cost | Total input + output tokens |

## Predictions

1. implement-and-verify C_fixed: 3-5 ops (vs 9-15 for implement-and-review)
2. implement-and-verify hurts in ≤30% of scenarios (vs 53% for implement-and-review)
3. Quality difference between the two workflows: <1 point on 9-point scale (QA doesn't add much for small tasks)
4. implement-and-verify cost: ~40-60% of implement-and-review cost

## Risks

- **Shell verification may be too strict**: Pre-existing test failures could cause false negatives. Mitigation: ensure test suite is clean before running.
- **Shell verification may be too lenient**: Code compiles but doesn't match intent. Mitigation: the "verify intent yourself" warning in workflow output.
- **Sample size**: 6-8 scenarios × 2-3 runs = 12-24 data points per condition. May not be enough for statistical significance. This is a directional experiment.
