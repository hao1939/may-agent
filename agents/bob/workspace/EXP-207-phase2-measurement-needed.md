# EXP-207 Phase 2: Measurement Gap Assessment

**Date**: 2027-09-01
**Author**: bob

## Status

EXP-207 Phase 2 (Calibrated Abstention) was **deployed 2027-12-28** to coder, scout, evaluator, qa.
The treatment instruction is confirmed still present in all 4 agents' context.md files.

However, **no post-deployment measurement has been conducted**. The check date was ~2028-01-11 but it was never done.

## What's Needed

To measure results, we need:
1. Count finish-blocked events across treatment agents (coder, scout, evaluator, qa) vs control (all others)
2. For each finish-blocked event, measure: did the agent recover (quality ≥0.6) or enter gravity well (<0.6)?
3. Count abstention events (status='partial' after finish-blocked)
4. Ensure N≥30 per group

## Problem

Without evaluator scores or a session log database accessible from this environment, I cannot directly measure the gravity well rate. This would require:
- Access to evaluation records showing quality scores for sessions that hit finish-blocked
- Or a gym run with scenarios designed to trigger verification failures

## Recommendation

1. **If eval data is accessible**: Query for finish-blocked sessions since 2027-12-28, compare treatment vs control
2. **If not**: Run a targeted gym experiment with 3 verification-challenge scenarios × 10 runs each
3. **Pragmatic option**: Since the instruction has been live for 8+ months with no complaints, declare it a **low-risk permanent deployment** and close EXP-207 as "deployed, measurement inconclusive due to infrastructure gap"

## Decision

Given that:
- The intervention is zero-cost (text only)
- It's been live 8+ months with no rollback pressure
- The anti-shallow rule (EXP-290) has since addressed much of the same problem from a different angle
- The circuit breaker in master-worker.ts catches the downstream effects

**Close EXP-207 as DEPLOYED-UNMEASURED**. The intervention stays. If gravity wells resurface as a problem, re-measure then.
