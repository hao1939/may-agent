# Agent Failure Pattern Audit — Latest Evaluations

**Date**: 2027-09-01  
**Auditor**: bob

## Summary

Reviewed 5 evaluated sessions with `needs_improvement` verdicts. Two dominant failure modes account for 100% of failures:

### Pattern 1: NON_DELIVERY (5/5 sessions)
Agents state intent, plan work, but produce zero artifacts. Sessions end with nothing written.

**Affected**: optimizer (3 sessions), coach (1 session), coder (1 session)

### Pattern 2: LOOPING (2/5 sessions)  
Agents repeat the same action 20-28+ times without progress. The loop detection doesn't trigger early enough to break the cycle.

**Affected**: optimizer (1 session — stalled on scan/dashboard), coach (1 session — 28+ iterations of "project" loop)

## Root Causes

1. **WRITE-FIRST constraint is ignored**: Multiple sessions had explicit WRITE-FIRST instructions but agents didn't comply. The constraint is in the prompt but not enforced mechanically.

2. **No circuit breaker for non-productive iterations**: An agent can loop 28 times without intervention. The workflow should detect "N iterations with zero file writes" and escalate or abort.

3. **Self-contradiction without correction**: Agents claim results ("all 24 tests pass") without tool evidence. There's no verification gate that blocks claiming success without output.

## Hypothesis: H-LOOP1

**If** the workflow system tracked "files written per iteration" and triggered an escalation after 3 consecutive zero-write iterations, **then** the loop-without-delivery pattern would be caught early, reducing wasted iterations by >50%.

**Test**: Count zero-write iteration streaks in historical session data. If >30% of failed sessions have 3+ consecutive zero-write iterations, the signal is reliable enough for a circuit breaker.

## Hypothesis: H-DELIVER1

**If** the worker evaluation gate required at least one `edit()` or `write()` call in the tool trace before allowing `finish(success)`, **then** NON_DELIVERY failures would be mechanically prevented rather than just prompt-instructed.

## Recommended Actions

1. **Quick win**: Add iteration-level write tracking to `master-worker.ts` — count file operations per iteration
2. **Medium**: Add circuit breaker — after 3 zero-write iterations, inject "WARNING: You have produced no files in 3 iterations. Write something or explain why."
3. **Longer term**: Mechanical `finish()` gate that checks tool trace for file operations before accepting `success` status

## Evidence Sources

- `.state/evaluations/s_1777471451597_3.json` — optimizer NON_DELIVERY
- `.state/evaluations/s_1777483248236_446.json` — optimizer NON_DELIVERY + LOOPING  
- `.state/evaluations/s_1777483248263_447.json` — optimizer NON_DELIVERY + SCOPE_DROP
- `.state/evaluations/s_1777483248275_448.json` — coach NON_DELIVERY + LOOPING (28+ iterations)
- `.state/evaluations/s_1774341220971_1.json` — coder VERIFICATION_FAILURE
