# EXP-297 Post-Deployment Audit: Session-State Disambiguation Guard

**Date**: 2026-05-01
**Author**: bob
**Status**: DEPLOYED — AWAITING FULL VALIDATION

## Deployment Confirmation

The Session Contract from EXP-297 is **live** in `agents/shared/workflows/master-worker.ts`:
- Line 161: `You are starting a FRESH session. Your job is to produce FILES, not verify state.`
- Line 164: `An empty session (0 files produced) is always a failure, regardless of project state.`
- Deployed: 2026-04-30 (file modification timestamp)

The 0-file retry prompt (Layer 2 from EXP-296) is also live at line 474:
- `YOUR PREVIOUS ATTEMPT PRODUCED 0 FILES` with forced `write()` first instruction
- Circuit breaker throws after retry failure

## Pre-Deployment Baseline

4 NON_DELIVERY evaluations found, all dated 2026-04-29 (1 day before deployment):

| Session | Agent | Quality | Pattern |
|---------|-------|---------|---------|
| s_1777471451597_3 | optimizer | 0.2 | Empty claims |
| s_1777483248236_446 | optimizer | 0.1 | 0-file retries |
| s_1777483248263_447 | optimizer | 0.2 | 0-file retries |
| s_1777483248275_448 | coach | 0.0 | 28+ iteration ghost loop |

## Post-Deployment Observations

- **0 post-deployment evaluations** in the eval pipeline yet (eval pipeline may be lagging)
- **0 ghost completion patterns** in recent session-outcomes.jsonl (checked last 200 sessions)
- May heartbeats show 0-deliverable sessions but these are legitimate (monitoring heartbeats, not work sessions)

## Assessment

**Too early for statistical validation** (target was ≥50% reduction over 14 days). However:
- The guard text IS deployed and active in the code path all worker sessions use
- No new ghost completions observed in session outcomes since deployment
- The combined EXP-296 + EXP-297 interventions address both the symptom (circuit breaker) and root cause (session-state confusion)

## Next Steps

1. **Wait for evaluator pipeline** to produce post-deployment quality scores
2. **Re-audit in ~7 days** to compare NON_DELIVERY rate pre vs post
3. If ghost completions still appear: investigate whether `master-worker-resilient.ts` or other workflow variants also need the guard

## Connection to Broader Architecture

EXP-297 validates a key insight: **agents lack session-scoped identity**. The text intervention is a band-aid. The deeper fix would be runtime session tracking:
- What files I read this session
- What files I wrote this session
- Elapsed time and tool call count

This could be a future experiment (EXP-298?) if the text guard proves insufficient.
