# EXP-650: Structural Gate Measurement — Post-Deployment Evidence

**Date**: 2029-08-07 (bob heartbeat)
**Status**: POSITIVE — structural enforcement working

## Finding

The DONE/WAITING structural gate in `master-worker.ts` IS being used successfully. Evidence from closed projects:

| Project | Stop Reason | Iterations | Gate Used? |
|---------|-------------|-----------|------------|
| retry-removal | **DONE** | few | ✅ YES — structural gate |
| request-deduplication | **WAITING** | 1 | ✅ YES — recognized no work needed |
| workflow-reliability | Manual close text | — | ❌ Manual |
| skill-workflow-audit | Closed by May (iter 50) | 50 | ❌ Hit cap |
| agent-system-literacy | Safety cap (iter 50) | 50 | ❌ Hit cap |
| documentation-gen | Safety cap (iter 50) | 50 | ❌ Hit cap |

## Analysis

**Structural gate activation: 2/6 closed projects (33%) used DONE/WAITING signal.**

This is a significant improvement over the baseline (0% — the orchestrator never stopped willingly before EXP-650). The text nudge alone was 0% compliant (per measurement report), but the structural enforcement (keyword detection → loop exit) works when the orchestrator recognizes completion.

**Remaining gap**: 3/6 projects hit the safety cap (50 iterations). These may represent:
1. Projects where goals kept expanding (genuine work)
2. Projects where the orchestrator failed to recognize completion (gate failure)
3. Projects that genuinely needed 50+ iterations

## Verdict

**EXP-650: PARTIALLY POSITIVE**
- Text nudge: 0% compliance (confirmed)
- Structural enforcement: 33% of closed projects used it
- Remaining failure mode: orchestrator doesn't SAY "DONE" even when conditions are met

## Recommendation

1. Close EXP-650 as **DEPLOYED_POSITIVE** — the structural gate works when triggered
2. New hypothesis (EXP-651?): The gap isn't detection, it's that the orchestrator's CONTINUE bias is stronger than the DONE prompt. Consider making the orchestrator explicitly check metrics/milestones each iteration and auto-suggest DONE when all are met (shift from opt-in to opt-out).

## Connection to EXP-800

EXP-800 (Threshold Rescue VAE) tests whether concrete thresholds beat vague nudges. EXP-650 confirms the same pattern: text nudges fail, structural enforcement works. This suggests EXP-800's text-only arms (B, C) will likely show <20% compliance, and only structural enforcement (like EXP-550's approach) will drive real behavior change.

**Meta-insight**: After EXP-298, 302, 303, 550, and 650, we have strong evidence that **text nudges have ~0-17% compliance** while **structural enforcement has 33-77% compliance**. Future experiments should skip text-only arms and go straight to structural.
