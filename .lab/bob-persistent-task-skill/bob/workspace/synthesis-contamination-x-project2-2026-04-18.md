# Synthesis: EXP-168 Contamination × Project 2 Experiment Design

**Date**: 2026-04-18 | **Threads**: EXP-168 addendum, EXP-180 design

---

## Thread Summaries

**EXP-168 contamination addendum**: Prior coder runs had modified `cascading-fix-trap-v2` scenario files, invalidating the headline finding that moderate hints provide 0% benefit. Post-fix controls show moderate hints → 100% (not 0%). The binary-threshold model (H-166) is refuted; cheap causal pointers suffice.

**EXP-180 design**: First Project 2 experiment — tests whether a "dead ends" memory file (inspired by EvoHarness) reduces FM-1.3 flailing errors by ≥15pp on gym scenarios including `cascading-fix-trap-v2`.

## Key Connection: Contamination Directly Affects EXP-180

**Critical**: EXP-180 uses `cascading-fix-trap-v2` as one of three test scenarios. The contamination fix is essential — without it, Arm A baselines would be artificially depressed (0% regardless of intervention), making any treatment look effective against a floor effect. The fix is already committed, but this is a **design lesson**: always verify scenario file integrity before running experiments.

## Ranked Findings

1. **[HIGH IMPACT] Cheap causal pointers ≈ expensive analyses.** The EXP-168 reversal (moderate hints 0%→100%) means terse, one-sentence causal framing is nearly as good as full expert write-ups. This reframes the value proposition of context injection: even brief, accurate pointers unlock agent capability.

2. **[HIGH IMPACT / RISK] Dead-ends file may be redundant.** If one causal sentence unlocks 100% performance (EXP-168), then EXP-180's dead-ends file (which provides general anti-patterns, not causal pointers) may operate through a different and weaker mechanism. Dead-ends prevent re-exploration; causal pointers enable first-time success. These are complementary but the EXP-168 finding raises the bar: dead-ends must beat the "just tell the agent what's wrong" baseline.

3. **[MEDIUM] Environment integrity is a prerequisite for all gym experiments.** Two independent lines of work now depend on clean `cascading-fix-trap-v2`. A contamination check should be standard pre-experiment protocol.

## Design Implications for EXP-180

- **Baseline validity**: ✅ Contamination fix is committed. Arm A baselines will reflect true difficulty.
- **Expected baseline for cascading-fix-trap-v2**: ~30-40% (estimated). Post-fix BASE was 0/3, but N=3 is too small and dead-ends content is different from "no hint." EXP-177 BASE N=20 will provide a better prior.
- **Canary consideration**: Run 1-2 trials of `cascading-fix-trap-v2` Arm A first to confirm the scenario works correctly post-fix before committing to full N=5.
- **Interaction with KE-011**: Knowledge files are passive and often skipped. The dead-ends file is passive context. EXP-168 showed that even passive moderate hints work when the environment is clean — but those were task-specific hints, not general advice. KE-011's warning still applies to general anti-patterns.

## Next Steps

1. **Run EXP-180 Phase 1** (baseline arms) — confirm scenario integrity empirically
2. **Wait for EXP-177 BASE results** before interpreting EXP-180 cascading-fix-trap arm
3. **If EXP-180 is inconclusive on cascading-fix-trap**: consider an arm with a brief causal pointer (bridging EXP-168's finding into Project 2's framework)

---

*Cross-reference: EXP-168/results-addendum.md, EXP-180/design.md, H-166 (revised), KE-011, KE-199b*
