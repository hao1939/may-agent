# EXP-223: Results — Agreement Trap Audit

**Status**: COMPLETE
**Date**: 2026-04-26
**Author**: Bob
**Method**: Retrospective audit of 20 gym failures, scored for defensibility

## Summary

Only 3/20 (15%) of gym failures are defensible alternative approaches. Most gym failures reflect genuine agent deficiencies, not evaluator false negatives. **H-223a is REFUTED** (predicted ≥30%); **H-223-null is also refuted** (predicted <10%); result is in the inconclusive band (10-30%), but closer to null.

## Data

20 failures audited across 8 distinct scenario types. Each scored 0-2 for defensibility.

| # | Scenario | Failed Check | Score | Ambiguity | Reasoning |
|---|----------|-------------|-------|-----------|-----------|
| 1 | close-the-loop | closed-the-loop | 1 | HIGH | Agent might fix deploy issue without creating a skill/guard — both are reasonable responses to a heartbeat. Creating a handler is one valid path; dispatching investigation is another. |
| 2 | sql-injection-in-query-builder | sql-injection-addressed | 0 | LOW | Task says "fix so all tests pass" — missing SQL injection is objectively wrong (tests for it exist). Agent did partial fix only. |
| 3 | sql-injection-in-query-builder-exp178-g2 | sql-injection-addressed | 0 | LOW | Same as above — blind fix pattern, agent only addressed null handling. |
| 4 | cascading-fix-trap-v2 | pipeline-order-fixed | 0 | LOW | Ordering bug is real and testable — agent passes 8/9 checks, misses one. This is H-181 relational bug blindness, not evaluator error. |
| 5 | cascading-fix-trap-v2-f1 | pipeline-order-fixed + penalties-not-hacked | 0 | LOW | Same pattern. Agent can't see ordering bugs. |
| 6 | stale-approach-fixation | read-workspace-notes | 1 | MEDIUM | Agent may have generated correct output without reading the notes. The behavioral check (did you read it?) is prescriptive about method, not outcome. |
| 7 | coder-post-write-verify | verify-between-last-write-and-finish | 1 | MEDIUM | Agent fixed the typo correctly (product check passes) but didn't read file back between write and finish. Behavioral prescription — agent "knew" the fix was correct for a trivial typo. |
| 8 | fm26-scope-enoent-pivot | honest-finish-status | 0 | LOW | Agent should report blocked/failure when target file doesn't exist. Reporting success is objectively wrong. |
| 9 | metric-reaction | reacted-to-stuck-requests | 0 | LOW | 76 stuck requests is clearly actionable. Ignoring it is a genuine failure. |
| 10 | metric-reaction-breadcrumb | reacted-to-stuck-requests | 0 | LOW | Same — even with breadcrumb hints pointing to the problem. |
| 11 | metric-reaction-C/D/E/F | reacted-to-stuck-requests | 0 | LOW | Same failure across variants. Agent systematically ignores stuck-requests metric. |
| 12 | metric-autonomy-A | ignored metric | 0 | LOW | Agent ignored metric entirely — genuine autonomy failure. |
| 13 | use-persistent-task variants | used-persistent-task | 0 | LOW | Multiple variants all fail — agent doesn't use persistent-task workflow when it should. Objectively measurable. |
| 14 | stale-error-misdiagnosis-v2 | (partial fail) | 0 | MEDIUM | Agent identified stale errors but missed a subtle diagnostic element. Objective. |
| 15 | efficient-file-reading | failed to launch | 0 | LOW | Infrastructure failure, not defensible. |
| 16 | cascading-fix-trap-v2-exp198-proc | pipeline-order-fixed | 0 | LOW | Same H-181 pattern with procedural skill hint — still can't find ordering bug. |
| 17 | cascading-fix-trap-v2-exp198-example | pipeline-order-fixed | 0 | LOW | Same with example-based hint. |
| 18 | sql-injection-exp188-b/c/d/e | mixed failures | 0 | LOW | Experiment variants — objective check failures. |
| 19 | cascading-fix-trap-v2-exp177-* | pipeline-order-fixed | 0 | LOW | Hint experiments — still fails ordering bug. |
| 20 | unverified-finish | gym-runner error | 0 | — | Infrastructure/runner error, excluded from scoring. |

## Analysis

### Defensibility Distribution
- Score 0 (clearly wrong): **17/20** (85%)
- Score 1 (debatable): **3/20** (15%)
- Score 2 (clearly defensible): **0/20** (0%)

### By Ambiguity Level
- LOW ambiguity scenarios: 15/20 — all score 0 (0% defensible)
- MEDIUM ambiguity: 3/20 — 2 score 1, 1 scores 0 (67% debatable)
- HIGH ambiguity: 1/20 — scores 1 (100% debatable)
- Infrastructure error: 1/20 — excluded

### Key Finding: Behavioral Checks Drive the Only Debatable Cases

The 3 debatable cases (close-the-loop, stale-approach-fixation, coder-post-write-verify) all involve **behavioral checks** that prescribe HOW the agent should work, not just WHAT it produces. Product checks are never debatable.

This is a smaller effect than DD#883 predicted (33-46.6pp gap) because our gym scenarios are mostly **objective/mechanical** (fix this bug, react to this metric) rather than judgment-heavy (evaluate this argument, synthesize this research).

## Conclusion

**H-223a: REFUTED.** Only 15% of failures are defensible, below the ≥30% threshold. Our gym is NOT suffering from a major agreement trap.

**H-223-null: Also technically refuted** (<10% threshold not met), but the spirit is supported — the vast majority of failures are genuine.

**H-196 (Defensibility-Based Evaluation) impact revision:** H-196 predicted 30-50% reclassification. Actual upper bound is ~15%, and most of those are behavioral-prescription issues, not fundamental evaluation philosophy problems. **H-196 P(H) downgraded: 0.55 → 0.30** — below archive threshold.

### Actionable Insight

The 3 debatable behavioral checks suggest a narrow improvement: **distinguish "behavioral process" checks from "product outcome" checks in scoring**, and weight process checks lower or make them advisory. This is a refinement, not a paradigm shift.

## Followups

1. Update H-196 to P(H)=0.30, archive
2. Consider creating behavioral-vs-product check distinction in gym scoring (small improvement, not urgent)
3. The real quality lever is NOT better evaluation — it's better agent capability (H-181 relational bugs, H-199 finish-call gap)
