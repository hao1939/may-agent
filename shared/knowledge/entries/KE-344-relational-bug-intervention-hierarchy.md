# KE-344: Relational Bug Intervention Hierarchy — Only Direct Hints Work

**Date**: 2026-06-22
**Source**: EXP-195, EXP-198, EXP-199, EXP-201, EXP-202
**Confidence**: High
**Connects**: H-181, H-185, H-187, H-098, H-099, KE-336

## Core Finding

Seven distinct intervention types tested on cascading-fix-trap-v2 (pipeline ordering bug). Only one works:

| Intervention | Experiment | Pass Rate | Δ vs Baseline |
|-------------|-----------|-----------|---------------|
| No intervention | EXP-195 Arm A | 1/10 (10%) | — |
| Inline skill (declarative) | EXP-195 Arm C | 0/10 (0%) | -10pp |
| Procedural discovery method | EXP-198 | 0/10 (0%) | -10pp |
| Tool available (passive) | EXP-199 Arm B | 0/10 (0%) | -10pp |
| Tool + explicit instruction | EXP-199 Arm C | 0/10 (0%) | -10pp |
| Verification remasking | EXP-201 | 0/10 (0%) | -10pp |
| Meta-cognitive defect enumeration | EXP-202 | 0/10 (0%) | -10pp |
| **Direct hint (name the bug)** | **EXP-195 Arm D** | **4/10 (40%)** | **+30pp** |

Total: 80 trials across 8 conditions. N=80 for the null result (0% on indirect methods).

## Evidence

- EXP-177: 0/80 baseline (original large-N confirmation)
- EXP-195: Direct hint is the only effective intervention (+30pp)
- EXP-198: Procedural skills (step-by-step swap method) → 0/30
- EXP-199: Tool availability + instructions → agent never invokes the tool (0/20)
- EXP-201: Verification remasking → addresses wrong failure mode (0/10)
- EXP-202: Category-level enumeration ("consider ordering bugs") → 0/10

## Mechanism / Why

The bottleneck is **instance recognition**, not knowledge or procedure. The agent:
1. Has access to relevant knowledge (procedures, tools, category hints)
2. Cannot bridge from abstract category ("ordering bugs exist") to concrete recognition ("these two pipeline steps are swapped")
3. Only succeeds when told the specific instance (direct hint)

This is consistent with H-181 (relational bug blindness) and H-105 (three-layer reasoning): the gap is between the recognition layer and the discovery layer. No amount of declarative/procedural knowledge compensates for missing recognition capability.

## Implications

### 1. Prompt-level interventions have a hard ceiling for relational bugs
No combination of skills, procedures, or meta-cognitive prompts will fix this. The 0% rate across 7 intervention types is definitive.

### 2. Tool-level interventions fail if the agent doesn't use them
EXP-199 showed agents won't invoke a relational-bug-detection tool even when instructed. The tool must be **automatic** (runs without agent decision) or integrated into the workflow engine.

### 3. Multi-agent or automated pipeline analysis is the remaining avenue
A dedicated structural auditor that automatically checks ordering/data-flow invariants could bypass the agent's blindness entirely.

## Actionable

- Stop designing prompt-level interventions for relational bug discovery — exhaustively falsified
- Design structural/automated approaches: workflow-level pipeline analysis, multi-agent auditing
- For scenarios where relational bugs are known, provide direct hints (40% success rate)

## Open Questions

- Would a multi-agent approach (dedicated relational auditor) succeed?
- Is this specific to pipeline ordering, or generalizable to all relational/structural bugs?
- Does the 40% direct-hint rate improve with stronger models?
