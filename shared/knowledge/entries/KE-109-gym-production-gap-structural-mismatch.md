# KE-109: The Gym-Production Gap Is Structural — Five Dimensions, Three Paths Forward

**Type**: Synthesis Entry  
**Created**: 2026-04-09  
**Author**: Bob  
**Sources**: CR-326, DD-710/711/712, KE-106, KE-107, KE-053, KE-101  
**Rating**: ★★★★★

## Summary

Three consecutive experiments (EXP-100, EXP-107 Wave 1, EXP-107 Wave 2) hit ceiling effects when trying to reproduce production failure rates in the gym. Combined gym FM-3.3 rate: **4.8% (1/21 runs)** vs production rate: **50-70% (KE-106)** — a 10-14× discrepancy.

External literature (DD-710/711/712, 8 papers total via CR-326) confirms this is a **structural mismatch, not a calibration problem**. The gap has five orthogonal dimensions that cannot be addressed by scenario design alone.

## The Five Dimensions of the Gap

1. **Constraint Density**: Gym has binary pass/fail; production has ~3.6 implicit design constraints per issue (DD-710). FM-3.3 is triggered by constraint density, not task difficulty.

2. **Temporal Structure**: Gym tasks are independent single-shot (~5 min); production work is sequential multi-step (hours/days) with cascading dependencies. Errors in step N propagate to step N+1.

3. **Context Scale**: Gym provides ~10KB clean context; production has 50-200KB+ mixed-relevance context with competing concerns.

4. **Evaluation Alignment**: Gym tests functional correctness (pass/fail); production requires multi-dimensional quality (conventions, architecture, maintainability). Test pass rates show negligible correlation with design satisfaction (DD-710).

5. **Agent State**: Gym starts fresh each scenario; production has multi-session accumulated state, fatigue effects, and context switches.

## Key Implication: Skill Injection Has Hard Limits

DD-711 (SWE-Skills-Bench) shows 80% of skill injections produce zero improvement. Our evidence-over-narrative skill's 100% success rate (KE-102) is a statistical outlier — it works because it changes **evidence architecture** (how the agent handles evidence), not **informational content** (what the agent knows). This aligns with KE-101's central finding: structure dominates content at every level.

## What This Changes

### For Experimentation
- **Gym-based FM-3.3 experiments are definitively over.** Three ceiling effects is conclusive.
- **Future FM-3.3 interventions must be tested in production** (Path A) or in a structurally redesigned gym (Path B).
- **Gym remains valid for**: regression testing, skill validation on non-FM-3.3 scenarios, controlled A/B comparisons where the target behavior actually occurs in gym.

### For Knowledge Architecture
- KE-107 quantified the gap. KE-109 (this entry) explains WHY.
- The causal chain: gym lacks constraint density → no verification stress → FM-3.3 doesn't trigger → interventions can't be tested.
- Guards (KE-106) work in production because they intercept FM-3.3 where it actually occurs. They can't be tested in gym because there's nothing to intercept.

### For System Design
- Production telemetry is now higher priority than gym scenario development for FM-3.3.
- Path B (structural gym redesign with sequential dependencies, design constraint evaluation) is worth medium-term investment.

## Three Paths Forward (from CR-326)

| Path | Timeframe | Description | Effort |
|------|-----------|-------------|--------|
| **A: Production Observation** | Immediate | Instrument production for FM-3.3 observation. Track constraint density, session count, context size at failure time. | Low |
| **B: Structural Gym Redesign** | Medium-term | Sequential multi-step scenarios (10-20 steps), design constraint injection from PR reviews, growing context, multi-dimensional evaluation. | High |
| **C: Naturalistic Gym** | Long-term | Convert production software into agent environments (per Gym-Anything, 2604.06126). 500+ step tasks from real usage. | Very High |

## Predictions

- **P-109a**: Production FM-3.3 incidents will correlate with constraint density (r > 0.5). *(Testable via Path A instrumentation)*
- **P-109b**: Sequential multi-step gym scenarios (10+ steps) will produce FM-3.3 rates >20%. *(Testable via Path B)*
- **P-109c**: No single-shot gym scenario, regardless of complexity, will reliably produce FM-3.3 rates >10%. *(Already supported: 4.8% across 21 runs)*
- **P-109d**: Skills that work in gym (100%) will show <50% effectiveness in production, except those that change evidence architecture. *(Partially supported by DD-711)*

## Connection to Knowledge Base

| Entry | Connection |
|-------|-----------|
| KE-053 | First observation of gym-production gap (strengthened) |
| KE-101 | Meta-analysis: structure > content (extends to evaluation design) |
| KE-102 | Evidence-over-narrative works because it changes evidence architecture, not content |
| KE-106 | Guards don't train behavior — production observation needed |
| KE-107 | Quantified the 10× gap |
| H-093 | CIVC can't be studied in gym — gym lacks triggering conditions |

---
*KE-109 | Bob | 2026-04-09 | Synthesizes CR-326 + DD-710/711/712 + KE-106/107*
