# H-188: Multi-Agent Decomposition Breaks Relational Bug Blindness

**Date**: 2026-06-22
**Status**: PROPOSED
**Prior P(H)**: 0.55
**Connects**: H-181 (relational bug blindness confirmed), KE-344 (intervention hierarchy), H-098 (channel theory)

## Claim

A two-agent architecture — where Agent A traces execution/data flow and produces a structured trace, then Agent B uses that trace to identify bugs — will achieve ≥30% pass rate on cascading-fix-trap-v2, compared to 0% for all single-agent interventions except direct hints (40%).

## Rationale

H-181 shows single agents can't discover relational bugs (ordering, data flow) even with category-level hints. The bottleneck is *recognition in context* — seeing the specific relational defect in code. But EXP-195 showed that near-explicit naming gets 40%, proving the fix itself is within capability once the bug is identified.

**Decomposition hypothesis**: Tracing execution order is a *different cognitive task* than fixing bugs. A dedicated tracer agent that produces a structured execution-order summary converts a Ch2 relational-recognition task into a Ch1 pattern-matching task for the fixer.

## Predictions

- **P-188a**: Two-agent (tracer+fixer) achieves ≥30% on cascading-fix-trap-v2 (vs 0% single-agent baseline)
- **P-188b**: The tracer agent alone produces accurate execution-order traces ≥70% of the time
- **P-188c**: If P-188a succeeds, the improvement is driven by trace quality (trace-accurate trials pass at higher rate than trace-inaccurate)

## EXP-204 Design Sketch

**Arms**:
- A: Baseline single agent (expect 0-10%, replication of prior)
- B: Agent 1 traces execution flow → structured output → Agent 2 fixes bugs
- C: Agent 1 produces execution trace → same Agent 1 fixes bugs (controls for "extra thinking time" vs "decomposition")

**N**: 10 per arm, ~$10 total
**Measure**: Pass rate on cascading-fix-trap-v2 gym scenario
**Decision rule**: P-188a confirmed if Arm B ≥ 3/10 AND Arm B > Arm A

**Blocked on**: Gym infra (`--lab` flag, same as EXP-190/192). Can be tested manually with 3 trials per arm as pilot.

## Literature Grounding (added 2026-04-26)

**SGAgent** (arXiv:2602.23647, Zhang et al., Feb 2026): Multi-agent localize→suggest→fix framework for repo-level repair. Achieves 51.3% on SWE-Bench with 3 specialized sub-agents. The "suggester" agent is structurally analogous to H-188's tracer — it bridges the gap between bug localization and bug fixing by producing an intermediate structured analysis. SGAgent's key finding is that jumping directly from localization to fixing leaves a "fundamental reasoning gap" — exactly H-181's discovery-vs-fix bottleneck. This is strong external evidence supporting the decomposition approach: P(H) could be revised upward from 0.55 to ~0.65 based on this alone. Note: SGAgent operates on real-world SWE-Bench bugs (not specifically relational/ordering bugs), so it validates the general decomposition principle but doesn't directly test the relational-blindness-specific claim of H-188.

## Falsification

If Arm B ≤ 1/10, H-188 is falsified — decomposition doesn't help, the blindness is at the code-comprehension level regardless of architecture.
