# KE-342: Relational Bug Blindness Is a Fundamental LLM Capability Gap

**Date**: 2026-04-22
**Source**: H-181, EXP-177, EXP-194, EXP-195, EXP-198, EXP-199, EXP-201
**Confidence**: High
**Connects**: KE-339, H-098, H-099, H-085, H-165

## Core Finding

LLM agents have a **systematic blind spot for relational/ordering bugs** that no prompt-level scaffolding can bridge. Across 6 experiments (~200 trials), agents find value bugs at ~100% but ordering bugs at 0-10%. The complete intervention hierarchy: declarative skills 0%, procedural instructions 0%, tool-assisted discovery 0%, verification remasking 0%, near-explicit hints 40%. Only directly naming the specific bug helps — no scaffolding bridges the gap.

## Evidence

- **EXP-177** (N=40): 40/40 find threshold value bug, 1/40 find pipeline ordering bug. Text hints ±0pp.
- **EXP-194**: Retrospective classification confirms relational-bug scenarios have systematically lower base rates.
- **EXP-195** (N=30): Generic skills 0/6, direct hint 4/10 (+30pp). Bottleneck is discovery, not fixing.
- **EXP-198** (N=20): Step-by-step procedural reordering instructions 0/10 both arms. Dosage interpretation falsified.
- **EXP-199** (N=20): Swap-steps.sh tool + guided use 0/10 both arms. Structural tool intervention also fails.
- **EXP-201** (N=10): Verification remasking 0/10. Fresh-eyes reset doesn't help either.

## Mechanism / Why

Value bugs have local, greppable signatures (Ch1-detectable). Relational bugs require understanding execution flow across components (Ch2 reasoning). Agents can't build the mental model of "what calls what in what order" from code alone. Even with tools that automate the permutation, agents don't interpret the results correctly. This maps to H-098's Ch1/Ch2 channel theory — relational bugs sit firmly in Ch2 territory where current models fail.

## Implications

### 1. Multi-agent or model-level solutions needed
No single-agent prompt engineering will fix this. Options: (a) newer models with better execution-flow reasoning, (b) multi-agent: one agent traces execution, another fixes, (c) runtime instrumentation that makes ordering visible as data (execution traces, not hints).

### 2. Scenario design should account for bug type
Gym scenarios should be tagged by bug type (value vs relational). Base rate differences are expected and meaningful, not noise. Don't treat 0% relational scenarios as "too hard" — they reveal a qualitatively different failure mode.

### 3. Verification workflows can't catch what discovery misses
If the agent can't discover the relational bug, no amount of verification remasking or belief externalization will help. Verification assumes the bug was at least considered; relational bugs are never even on the radar.

## Actionable

- **Tag gym scenarios** with bug type (value/relational/mixed) for stratified analysis
- **Don't invest more in prompt-level interventions** for relational bugs — 6 experiments exhausted the space
- **Investigate multi-agent approaches**: agent A generates execution trace, agent B reasons about it
- **Monitor model upgrades**: retest cascading-fix-trap-v2 baseline when new models deploy — capability may improve at the model level

## Open Questions

- Does the blind spot extend to non-ordering relational bugs (e.g., wrong dependency direction, incorrect data flow)?
- Can execution traces as structured data (not hints) bridge the gap where tools-as-procedures failed?
- Is the 40% direct-hint rate a ceiling or does it improve with more specific naming?
