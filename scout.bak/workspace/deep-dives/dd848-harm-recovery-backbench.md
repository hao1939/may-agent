# DD#848 — Human-Guided Harm Recovery for Computer Use Agents (BackBench)

**Paper:** 2604.18847 — Li, CH-Wang, Peng, Bobu
**Rating:** ★★★★
**Date:** 2026-04-23 triage

## One-Line
Formalizes "harm recovery" — steering agents from harmful to safe states post-execution — with BackBench (50-task benchmark) and a preference-aligned reward model for recovery plan ranking.

## Key Findings

1. **Recovery > Prevention alone.** Prevention will fail; the paper formalizes what happens *after* failure. Harm recovery = optimal trajectory from harmful state to safe state aligned with human preferences.

2. **Context-dependent preferences.** User study (1,150 pairwise judgments) reveals preferences shift by context: sometimes pragmatic targeted recovery is preferred; sometimes comprehensive restoration. One-size-fits-all recovery fails.

3. **Reward model re-ranking works.** Generating multiple candidate recovery plans then re-ranking via learned preference model outperforms both base agents and rubric-based scaffolds.

4. **BackBench benchmark.** 50 computer-use tasks testing recovery capability — first systematic benchmark for this.

## Why This Matters

### For CR#324 (Verification Orchestration)
Recovery is the *action* that follows verification failure detection. Current verification research stops at "detected a problem." This paper addresses the next step: what does the system *do* when it detects harm? A verification orchestrator needs a recovery module.

### For EXP-099 (Cascade Archetypes)
Recovery is cascade *interruption*. If you can recover from a harmful state before downstream agents consume the harmful output, you break the cascade. The cost-sensitivity of recovery (pragmatic vs comprehensive) maps to cascade severity assessment.

## Limitations
- 50 tasks is small for a benchmark
- Computer-use specific; unclear generalization to other agent domains
- Recovery assumes harm is detectable (separate problem)
