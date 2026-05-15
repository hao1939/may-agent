# Experiment Pipeline Status — September 2027

**Author**: Bob  
**Updated**: 2027-09-04

## Active Experiments Awaiting Measurement

| ID | Name | Deployed | Measure By | Decision Rule |
|----|------|----------|------------|---------------|
| EXP-298 | Optimizer Confabulation Guard | 2027-09-02 | 2027-09-16 | ≥50% reduction in [SELF_CONTRADICTION] flags → PROMOTE |
| EXP-301 | Verify-After-Write Structural Nudge | Recent | TBD | Compliance ≥80% → PROMOTE |

## Ready to Deploy (Contingent)

| ID | Name | Condition | Action |
|----|------|-----------|--------|
| EXP-299 | Retry-Context Clearing | EXP-298 fails (<50% reduction) | Deploy to retry prompts in master-worker |

## Recently Closed

| ID | Name | Outcome | Key Finding |
|----|------|---------|-------------|
| EXP-296 | Ghost Completion Detection | PARTIALLY_VALIDATED | Circuit breaker already existed; anti-shallow adds defense. Loops capped at 6 (was 28+). |
| EXP-297 | Session-State Disambiguation | DEPLOYED | Agents distinguish system state from session state |
| EXP-295 | Anti-Shallow Replication | DEPLOYED | ≥5 tool calls rule replicated to all agents |
| EXP-300 | Verify-After-Write Compliance Audit | MEASURED | Results written |

## Approved Proposals Awaiting Implementation

| Proposal | Layer | Status | Blocker |
|----------|-------|--------|---------|
| Session Waste Reduction | Layer 3: Smart Preflight Filter | TODO | Needs project cron handler code access (not in this repo) |

## Key Metrics to Watch

1. **Confabulation rate** (EXP-298): Count [SELF_CONTRADICTION] flags in optimizer evals after 2027-09-16
2. **Session waste rate**: Are May no-op sessions still at 30%+ post Layer 1+2?
3. **Verify-after-write compliance**: Is structural nudge working across agents?

## Next Actions (Bob)

1. **2027-09-16**: Measure EXP-298 results. If failed → deploy EXP-299.
2. **Layer 3 escalation**: The preflight filter needs infra code access. Escalate to tech-lead if no progress by 2027-09-10.
3. **EXP-299 contingency**: Design is ready. If EXP-298 inconclusive, deploy immediately.
4. **New experiment opportunity**: Session-state disambiguation (EXP-297) + anti-shallow (EXP-295) have been running long enough — audit whether quality scores improved system-wide.

## Retired/Won't-Do

- Experiments below EXP-270 are generally closed or superseded. Full archive in `.state/experiments/`.
