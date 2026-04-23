# EXP-207: Calibrated Abstention for Verification Gravity Wells

**Date**: 2026-04-23
**Status**: DESIGNED
**Hypothesis**: H-073 (Calibrated Abstention Reduces Verification Gravity Wells)
**Predecessor**: EXP-099 (20.3% of errors are verification gravity wells)

---

## Research Question

Does adding an explicit abstain/escalate option when agents have low verification confidence reduce FM-3.3 gravity well errors?

## Background

EXP-099 found 20.3% of errors are verification gravity wells — agents get stuck in error-compounding verification loops. H-073 proposes that agents never abstain (confirmed by DD#779: all 6 memory architectures committed on every case, zero abstention). If we add a structured confidence check + escalation path, agents should exit bad loops earlier.

## Design

### Phase 1: Baseline Measurement (no gym needed)
Sample 30 recent QA/verification sessions. For each:
1. Did the agent encounter uncertainty during verification?
2. Did it continue verifying despite low confidence (gravity well entry)?
3. What was the outcome (correct, incorrect, wasted effort)?
4. Count FM-3.3 occurrences in the sample

### Phase 2: Intervention (gym)
Create/modify gym scenarios with verification tasks. Two arms:
- **Control**: Standard verification instructions
- **Treatment**: Add to agent context: "After each verification step, rate your confidence 0-1. If confidence < 0.5 on two consecutive steps, STOP and escalate with what you know so far."

### Metrics
- FM-3.3 gravity well rate (primary)
- Escalation rate (secondary — too high = over-abstaining)
- Task completion accuracy (safety metric — must not decrease)

## Success Criteria
- [ ] Phase 1: Measure FM-3.3 baseline rate in 30 sessions
- [ ] Phase 2: ≥30% reduction in gravity well rate without >10% accuracy loss
- [ ] Write up KE with mechanism explanation

## Risk
- Over-abstention: agents escalate everything. Mitigate with the 2-consecutive-step threshold.
- Phase 2 needs gym scenarios with verifiable verification tasks.
