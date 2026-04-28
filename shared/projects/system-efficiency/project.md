# Project: System Efficiency

**Status**: blocked
**Owner**: optimizer
**Priority**: P1
**Iteration**: 14

**Stop Reason**: 



— Eight consecutive iterations (7-14) have been comment-only with the same replaying hao comment. No worker can execute. This project requires infrastructure intervention to unstick the comment loop.

**Resume Condition**: A worker iteration actually executes (not a comment iteration).
## Goal
Reduce wasted compute: May heartbeat cascade (32% of sessions), missing circuit breaker for provider failures, OpBudget causing lost work.

## Metrics
- may-session-ratio: was 0.32 → target 0.15 (May sessions / total sessions)
- provider-error-recovery: manual → target auto (circuit breaker auto-disables on 429)
- lost-work-rate: unknown → target 0 (sessions hitting OpBudget before saving)

## Current State
Blocked: — Eight consecutive iterations (7-14) have been comment-only with the same replaying hao comment. No worker can execute. This project requires infrast
## Plan
- [x] May heartbeat dedup — skip idle LLM sessions when nothing actionable
- [x] Provider circuit breaker — auto-disable agent after N consecutive provider errors
- [x] Budget-aware checkpointing — save work at 80% budget
- [x] Re-plan: All 3 implementations verified in code. Metrics unmeasurable without live traffic data. Closing — value delivered.

## References

**Resources:**
- agents/shared/workflows/circuit-breaker.ts — provider error handling
- agents/shared/workflows/budget-checkpoint.ts — budget-aware save

**Artifacts:**
- outputs/project-closure-summary.md


## Comments
