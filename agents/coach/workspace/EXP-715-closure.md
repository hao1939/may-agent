# EXP-715 Closure: Anti-Shallow Rule Effectiveness Audit

## Date: 2029-05-04
## Status: CLOSED ✅ — H1 REJECTED

## Summary
The 10-tool-call anti-shallow rule achieves 90% compliance (n=20), far below the 30% violation rate predicted by KE-655. The rule works because it meets three conditions: P0 framing, concrete threshold, simple binary check.

## Key Findings
1. **H1 REJECTED**: Violation rate is 10%, not ≥30%. Text rules with concrete thresholds work.
2. **Shallow session problem is orchestrator-level**: ~80% of dispatched sessions are 0-tool orchestrator decisions that never receive the anti-shallow rule. The 50% shallow rate (EXP-710) comes from these, not from agent non-compliance.
3. **KE-655 scope narrowed**: Task distraction nullifies *vague* text interventions, not concrete-threshold P0 rules.

## KE Written
- KE-715: Text Rules Work When P0-Framed With Concrete Thresholds

## Implications
- No structural gate needed for the anti-shallow rule itself
- The duration gate (EXP-705/710) targets a different problem: orchestrator over-dispatch
- Per notification (2029-05-04): duration gate root cause found, no binary rebuild needed — the orchestrator-level shallow sessions are by design (quick routing decisions)

## Next Investigation (not pursued)
- Why ~80% of sessions are 0-tool orchestrator decisions
- Whether this represents waste or legitimate architecture
- Per the EXP-705/710 notification: this is resolved — no action needed
