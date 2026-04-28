# Project: System Efficiency

**Status**: blocked
**Owner**: optimizer
**Priority**: P1
**Iteration**: 13

**Stop Reason**: 



— Seven consecutive iterations (7-13) have been comment-only. No worker has executed since iteration 6. The same hao comment keeps replaying. This project cannot make progress without human interventi
**Resume Condition**: A worker iteration executes or hao provides new actionable milestones.
## Goal
Reduce wasted compute: May heartbeat cascade (32% of sessions), missing circuit breaker for provider failures, OpBudget causing lost work.

## Metrics
- may-session-ratio: was 0.32 → target 0.15 (May sessions / total sessions)
- provider-error-recovery: manual → target auto (circuit breaker auto-disables on 429)
- lost-work-rate: unknown → target 0 (sessions hitting OpBudget before saving)

## Current State
Blocked: — Seven consecutive iterations (7-13) have been comment-only. No worker has executed since iteration 6. The same hao comment keeps replaying. This pro
## Plan
- [x] May heartbeat dedup — skip idle LLM sessions when nothing actionable
- [x] Provider circuit breaker — auto-disable agent after N consecutive provider errors
- [x] Budget-aware checkpointing — save work at 80% budget
- [ ] Re-plan: measure post-fix metrics, verify waste actually reduced

## References

**Resources:**
- agents/shared/workflows/circuit-breaker.ts — provider error handling
- agents/shared/workflows/budget-checkpoint.ts — budget-aware save

**Artifacts:**
- outputs/project-closure-summary.md


## Comments
