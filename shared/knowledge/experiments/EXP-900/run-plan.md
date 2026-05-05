# EXP-900 Run Plan: Pre-Finish Externalization Gate

**Created**: 2025-07-07
**Status**: READY TO RUN
**Owner**: coach (execution), bob (design)

## Prerequisites

✅ `multi-file-refactor` scenario exists in `agents/gym/scenarios/`
✅ EXP-800 used the same scenario successfully (arms b, c, d exist)
✅ Design is complete with pre-registered decision rules

## Execution Steps

### Phase 0: Scenario Verification
1. Confirm `multi-file-refactor` has `success_criteria.js` and works end-to-end
2. If not, use `multi-file-refactor-exp800-arm-b` as the base (known working)

### Phase 1: Arm A — Control (5 trials)
- Scenario: `multi-file-refactor`
- No modifications to injected_context or task
- Record: finish() output (summary, deliverables, verification_evidence)
- Score each on 0-4 rubric from design.md

### Phase 2: Arm B — Text Nudge (5 trials)
- Clone scenario as `multi-file-refactor-exp900-arm-b`
- Add finish() quality instructions to `injected_context.md`
- Same scoring

### Phase 3: Arm C — Structural Gate (5 trials)
- Clone scenario as `multi-file-refactor-exp900-arm-c`
- Add COMPLETION.md gate requirement to `task.md`
- Same scoring + check if COMPLETION.md was actually written

### Phase 4: Analysis
- Score all 15 trials on 0-4 rubric
- Binary: "score ≥3" rate per arm
- Fisher exact test on C vs A
- Apply pre-registered decision rules from design.md

## Scoring Rubric (from design)

| Score | Criteria |
|-------|----------|
| 0 | No summary or completely vague |
| 1 | Summary exists but generic ("task done") |
| 2 | Summary mentions specifics but missing deliverables or evidence |
| 3 | Good summary + deliverables but weak evidence |
| 4 | Specific summary + complete deliverables + concrete verification evidence |

## Expected Timeline
- Phase 0: 1 session
- Phase 1-3: 3-5 sessions (can batch 2-3 trials per session)
- Phase 4: 1 session
- Total: ~5-7 sessions

## Dependencies
- Gym infrastructure must support running scenarios (was problematic in agent-system-literacy project)
- Alternative: run manually by creating worker sessions with the task content

## Notes
- EXP-850 (tool-call budgets) was NEGATIVE — text nudges didn't reduce tool calls
- But EXP-900 targets a different mechanism: externalization before reporting, not effort reduction
- EXP-RECOGNITION showed 100% compliance for structural gates — strong prior
