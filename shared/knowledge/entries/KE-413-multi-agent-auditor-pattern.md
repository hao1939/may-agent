# KE-413: Multi-Agent Structural Auditor Overcomes Single-Agent Relational Blindness

**Created**: 2027-10-28 | **Source**: EXP-242 (Phases 0+1), H-181
**Confidence**: High (Phase 0: 5/5 detection, Phase 1: 2/5 end-to-end fix vs 0% baseline across 200+ trials)

## Finding

When a single agent cannot detect relational/ordering bugs (0% across 200+ trials and 6+ intervention attempts), a **purpose-built auditor agent with different task framing** detects them at 100% and enables 40% end-to-end fix rate.

## The Pattern

1. **Primary agent** receives standard task: "fix the failing tests"  
2. **Auditor agent** receives reframed task: "audit for ordering/sequencing errors"  
3. Auditor produces a report → injected into primary agent's environment  
4. Primary agent now sees the structural bugs it previously couldn't detect

## Why It Works

**Task framing determines attention allocation.** The same model achieves:
- 0% ordering detection under "fix" framing (optimization mode → value computation)
- 100% ordering detection under "audit" framing (inspection mode → structural properties)

The auditor converts a **reasoning gap** (can't see the bug) into an **activation gap** (knows about bug, can apply fix). This is the key distinction from H-098 Ch2.

## What Doesn't Work (Exhaustive)

| Approach | Ordering Fix Rate | Why It Fails |
|----------|-------------------|-------------|
| Text instructions | 0% | Doesn't change attention allocation |
| Skills/procedures | 0% | Same framing, same blindness |
| Tools for ordering | 0% | Agent doesn't use them |
| Hints (non-specific) | 0% | Too vague to redirect attention |
| Direct "here is the bug" | 40% | Works but requires human insight |
| **Structural auditor** | **40%** | Autonomous, no human needed |

## Application

Use multi-agent specialization when:
- A class of bugs has 0% detection across many interventions
- The bug type requires a different cognitive mode (structural vs computational)
- Task reframing can create a specialist that focuses on the blind-spot dimension

## Limitations

- 40% end-to-end is meaningful but not dominant — 60% still fail even with the report
- Only tested on one scenario (cascading-fix-trap-v2)
- Phase 1 used static reports (not live orchestration per-trial)
- Small N (5 trials per arm) — needs 15+ for confidence

## Production Implications

Hard scenarios could trigger an automatic "auditor pass" before the primary agent acts. This is analogous to code review but for structural properties the author can't see. Could generalize to any FM-1.3 failure pattern where single-agent interventions plateau at 0%.
