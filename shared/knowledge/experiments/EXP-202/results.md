# EXP-202 Results: H-187 Meta-Cognitive Defect Enumeration Checklist

**Date**: 2026-06-22
**Status**: COMPLETE
**Hypothesis**: H-187

---

## Summary

**H-202-null SUPPORTED**: Meta-cognitive defect enumeration (listing 5 bug categories in the task prompt) had zero effect on cascading-fix-trap-v2. Arm B (enumeration) scored 0/10, matching the 0/5 baseline. All 15 trials failed on exactly `pipeline-order-fixed` — the agent always finds the value bug but never the ordering bug.

## Results

| Arm | Condition | N | Overall Pass | pipeline-order-fixed | 
|-----|-----------|---|-------------|---------------------|
| A   | Baseline (amy, no intervention) | 5 | 0/5 (0%) | 0/5 (0%) |
| B   | Defect category enumeration | 10 | 0/10 (0%) | 0/10 (0%) |

All 15 trials: grade-threshold-fixed ✅, pipeline-order-fixed ❌. Identical failure pattern.

## Analysis

The enumeration checklist explicitly listed "ordering bugs" and "operations happening in the wrong sequence" as a category to consider. Despite this, the agent never identified the pipeline ordering bug in any of 10 trials.

This is significant because the checklist was designed to address the *hypothesis generation gap* (the agent never considers "the order might be wrong"). The result shows that even when explicitly told to consider ordering bugs, the agent cannot operationalize this into actual discovery.

### Comparison to prior interventions on cascading-fix-trap-v2

| Intervention | Pass Rate | pipeline-order-fixed |
|-------------|-----------|---------------------|
| No intervention (EXP-195 Arm A) | 1/10 (10%) | 0/10 (0%) |
| Direct hint naming the bug (EXP-195 Arm B) | 4/10 (40%) | 4/10 (40%) |
| Inline skill (EXP-195 Arm C) | 0/10 (0%) | 0/10 (0%) |
| Procedural skill (EXP-198) | 0/10 (0%) | 0/10 (0%) |
| Tool availability (EXP-199 Arm B) | 0/10 (0%) | 0/10 (0%) |
| Tool + instruction (EXP-199 Arm C) | 0/10 (0%) | 0/10 (0%) |
| Verification remasking (EXP-201) | 0/10 (0%) | 0/10 (0%) |
| **Defect enumeration (EXP-202 Arm B)** | **0/10 (0%)** | **0/10 (0%)** |

Only the direct hint (naming the specific bug) achieved any improvement. All indirect approaches — procedures, tools, remasking, AND now meta-cognitive enumeration — score 0%.

## Implications

1. **H-187 FALSIFIED**: Category-level enumeration doesn't bridge the discovery gap. The agent cannot go from "consider ordering bugs" to actually finding the specific ordering bug.
2. **Strengthens H-181**: The relational bug blindness is deeper than hypothesis generation. Even when the correct hypothesis category is suggested, the agent can't operationalize it.
3. **Refines the intervention spectrum**: There's a sharp threshold between "name the specific bug" (40%) and "name the bug category" (0%). The gap isn't about *what to look for* at a taxonomic level — it's about *recognizing a specific instance* of a relational defect in code.
4. **Multi-agent approach remains the most promising direction**: If a single agent can't discover relational bugs even with category hints, perhaps a dedicated "relational bug detector" agent that specifically traces data flow and ordering could succeed.

## Decision

H-187 → **FALSIFIED** (P(H) 0.50 → ≤0.10). Decision rule was "confirmed if ≥2/10" — result was 0/10.

Note: Agent used was `amy` (not `coder` as in prior experiments — `coder` agent no longer registered). Baseline validated at 0/5 with same agent to confirm comparable performance.
