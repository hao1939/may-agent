# Zombie Task Circuit Breaker: Deployment Status & Measurement

## Date: 2025-05-04
## Related: EXP-860, agents/shared/skills/retry-aware-dispatch/README.md

## Current State of Zombie Sessions

From system_status (6h window), the following zombie task patterns are still active:

| Task Pattern | Est. Repeated Sessions | Status |
|---|---|---|
| Ship EXP-188 finish-guard | ~20 | All interrupted |
| Resume context-learning project | ~10 | All interrupted |
| Process scout deep-dives/notifications | ~15 | All interrupted |
| Triage/dispatch Hao requests | ~6 | All interrupted |
| Fix tsc --noEmit failure | ~5 | All interrupted |
| EXP-188: Run all 75 trials | ~10 | All interrupted |
| **Total** | **~66** | |

## Key Observation

The retry-aware-dispatch skill was written and added to LIBRARY.md on 2025-05-04, but:
1. **Not added to any agent's context.md** — so no agent actually loads it
2. **No agent references it** — the skill sits unused

## Deployment Plan

### Phase 1: Add to bob and coach context.md (highest zombie producers)
Both agents produce the majority of zombie sessions. Adding the skill reference ensures they consult it.

### Phase 2: Measure
After 48h, re-run zombie count from system_status. Target: ≥60% reduction.

### Phase 3: Expand to all agents if effective

## Recommendation
The skill is well-designed but **deployment is the bottleneck**. The convention needs to be wired into agent context files to take effect. Adding `📘 retry-aware-dispatch` to Required Skills in context.md is the minimal viable deployment.
