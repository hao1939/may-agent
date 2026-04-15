# H-165: Production-Provision Interference — Self-Generated Analysis Destroys Expert Information on Hard Tasks

**Status**: Proposed  
**P(H)**: 0.85  
**Tier**: 1 (Empirically Grounded)  
**Date**: 2026-04-15  
**Author**: Bob  
**Derived from**: EXP-165, EXP-164, H-161, H-085, KE-186

## Thesis

On tasks where an agent's self-generated analysis is unreliable, **forcing self-production before or instead of receiving expert analysis actively degrades performance** — producing a subadditive interaction, not merely a neutral one. The self-produced (incorrect) analysis anchors the agent's solution path so strongly that correct information received afterward (or embedded in the same workflow) cannot override it.

**Formally**: Let F1 = information provision (expert analysis), F2 = behavioral forcing (self-production). On hard tasks where self-analysis reliability is low (< 25% root-cause identification rate):

- F1 alone: near-ceiling performance (+100pp)
- F2 alone: no benefit (+0pp)
- F1 + F2 combined: no benefit (+0pp) — **F2 eliminates F1's effect entirely**

This is NOT additive failure (100 + 0 = 100). This is **destructive interference**: the combination performs 100pp worse than F1 alone. Self-production actively poisons the agent's reasoning, making it resistant to correct information.

## Operational Definition: "Hard Task"

A task qualifies as "hard" for this hypothesis when:

1. **Self-analysis accuracy < 25%** — the agent fails to correctly identify the root cause in its own unassisted analysis (operationalized as the root-cause check passing in F2-only and baseline arms)
2. **Multiple viable workaround paths exist** — the agent can satisfy surface-level criteria (tests pass) through non-root-cause fixes
3. **Environmental misleads are present** — documentation, changelogs, or code comments actively point away from the true root cause

**Exemplar**: cascading-fix-trap-v2 — CHANGELOG documents the pipeline reorder as an "intentional improvement," leading agents to accept the root cause as correct behavior. Self-analysis accuracy: 0/14 (0%) on pipeline-order-fixed. Multiple workaround paths (pct-field manipulation, grade-threshold hacks) available.

**Counter-exemplar**: misleading-test-fix — the root cause is a mathematical error in a test assertion. Self-analysis forces the agent to do the math, reliably surfacing the correct answer. Self-analysis accuracy: 22/22 (100%). Only one viable fix path. F2 works perfectly here.

**The boundary**: approximately where the root cause requires reasoning beyond the agent's reliable capability — architectural understanding, multi-step causal chains, or resistance to authoritative-sounding misleads.

## Evidence

### Direct Evidence (EXP-165)

| Arm | Design | Pass Rate | Key |
|-----|--------|-----------|-----|
| C (F1-only) | Expert ROOT_CAUSE_ANALYSIS.md provided | 15/15 (100%) | Correct information alone → ceiling |
| D (Baseline) | No intervention | 0/16 (0%) | Agent cannot self-solve |
| B (F2-only) | Forced self-production, artifact deleted | 0/14 (0%) | Self-production provides zero benefit |
| A (Full-gate) | Forced self-production + reads own analysis | 0/16 (0%) | Self-production destroys what F1 would provide |

**The critical comparison**: C vs A. Both arms provide an analysis artifact to the agent during fixing. In C, the artifact is expert-written and correct. In A, the artifact is self-generated and incorrect. The 100pp gap is entirely attributable to **information quality**, not process structure.

**Subadditivity**: F1 alone = 100%, F2 alone = 0%, combined = 0%. The interaction is −100pp (combined − max(F1, F2)). This is the most extreme subadditive result in our knowledge base.

### Comparative Evidence (EXP-164)

On misleading-test-fix (easy, math-verifiable task):
- F1-only: 100%, F2-only: 100%, Full-gate: 100%, Baseline: 0%

No interference on easy tasks because self-analysis is reliable. The interference effect is **difficulty-moderated** — it appears only when self-analysis quality degrades.

### Supporting Evidence (H-085 boundary conditions)

EXP-047 showed wrong *expert-provided* analysis still yields 100% on sycophants-dilemma. But that's a different mechanism: the agent reads wrong analysis, independently verifies, and corrects it. In EXP-165, the agent reads its own wrong analysis and *follows it* rather than correcting it. This suggests:

- **Wrong analysis from others** → triggers analytical verification → agent overrides → still works
- **Wrong analysis from self** → confirms prior reasoning → agent follows → interference

The self-generation creates a confirmation loop that external wrong analysis does not.

## Mechanism: Cognitive Anchoring via Self-Generation

### Phase 1: Incorrect Analysis Production

The agent explores the codebase during forced analysis. On hard tasks with environmental misleads (e.g., CHANGELOG saying "reordered pipeline for performance"), the agent:
1. Reads the mislead and accepts it as ground truth
2. Searches for alternative explanations consistent with the mislead
3. Identifies workaround paths (pct-field manipulation) as the "fix"
4. Writes this incorrect analysis into ROOT_CAUSE_ANALYSIS.md

The analysis artifact now contains a confident, internally consistent, but **wrong** causal model.

### Phase 2: Anchoring Prevents Correction

When the agent reads its own analysis in Phase 2:
1. The analysis is **self-consistent** — it was written by the same model, in the same reasoning style
2. The analysis has **epistemic authority** — "I analyzed this already and concluded X"
3. The agent's exploration in Phase 2 is **primed by Phase 1** — it has already seen the workaround paths and is drawn toward them
4. There is **no external correction signal** — unlike F1-only, no authoritative "colleague" contradicts the agent's model

The net effect: the agent follows its own wrong analysis with high confidence, foreclosing the (already slim) possibility of stumbling onto the correct fix through undirected exploration.

### Why F1 (Expert Analysis) Escapes This

F1-only provides analysis from "a colleague who already investigated." This has:
- **External authority**: The agent treats it as new information, not self-confirmation
- **Correct content**: The expert analysis identifies the actual root cause (pipeline ordering)
- **No competing self-model**: The agent hasn't formed its own causal model in Phase 1, so there's nothing to anchor against

The expert analysis fills a vacuum rather than competing with an entrenched wrong model.

## Predictions

### P-165a: Order Reversal Should Recover F1's Benefit
**Test**: Run EXP-166 with arms where expert analysis is provided BEFORE self-production (F1 → F2 instead of F2 → F1).
**Prediction**: If the agent receives correct expert analysis first, then is asked to produce its own analysis, the expert information should anchor the agent's production. Pass rate ≥ 70% (vs 0% for F2 → F1 order).
**Rationale**: Anchoring works in temporal order — first information anchors subsequent reasoning.
**Falsification**: If F1→F2 also produces 0%, the mechanism is not ordering-dependent anchoring but something deeper (e.g., the act of production itself destroys any prior information).

### P-165b: Confidence Correlation
**Test**: Measure agent-expressed confidence in their self-generated analysis across easy and hard tasks.
**Prediction**: Agents will express similar confidence levels (high) in both correct analysis (easy tasks) and incorrect analysis (hard tasks). The agent cannot distinguish its own correct from incorrect analysis.
**Falsification**: If agents express lower confidence on hard tasks, there may be a usable internal signal for adaptive gating.

### P-165c: Interference Scales with Analysis Quality Gap
**Test**: Find tasks at intermediate difficulty (self-analysis accuracy ~50%). Run the full 4-arm design.
**Prediction**: Intermediate subadditivity — combined arm performs better than baseline but worse than F1-only. The interference magnitude should be proportional to (1 − self-analysis accuracy).
**Falsification**: If the interference is binary (0% or 100%) with no intermediate regime, the mechanism is more complex than gradual anchoring.

### P-165d: Explicit Contradiction Warning Should Partially Recover
**Test**: In the full-gate arm, add an instruction in Phase 2: "Your Phase 1 analysis may be wrong. Read it critically and consider alternatives."
**Prediction**: Small improvement (10-20pp) but not full recovery. Text instructions have weak behavioral effects (H-085 Ch1/Ch3 ≈ 0% baseline).
**Falsification**: Full recovery (>80pp) would mean the anchoring is shallow and easily overridden by instructions, undermining the mechanistic claim.

## Practical Implications

### 1. Never Pre-Poison with Self-Analysis on Hard Tasks

If you have expert analysis available, deliver it **without** requiring the agent to first generate its own competing analysis. The 2-phase gate pattern (analyze-then-fix) is actively harmful when:
- The task is beyond the agent's reliable self-analysis capability
- Expert analysis is available for the fixing phase

### 2. Difficulty-Adaptive Gate Design

| Task Difficulty | Self-Analysis Reliability | Recommended Approach |
|----------------|--------------------------|---------------------|
| Easy (>80% baseline) | High | No gate needed — agent self-solves |
| Medium (30-70% baseline) | Moderate | F2 gate useful — self-analysis partially reliable |
| Hard (<25% baseline) | Low | F1-only — inject expert analysis, skip self-production |

### 3. The Expert Analysis Pipeline Problem

F1's effectiveness (+100pp) creates urgent demand for expert analysis at scale. Sources:
- Pre-written scenario-specific skills (current approach — doesn't scale)
- Multi-model pipeline (stronger model diagnoses, working model fixes)
- Accumulated knowledge base (past correct diagnoses retrieved by similarity)
- Human expert input (reliable but expensive)

The constraint: F1 only works when the expert analysis is **correct**. Incorrect "expert" analysis would presumably trigger the same anchoring failure as incorrect self-analysis.

## Related Hypotheses

- **H-161** (Artifacts Dual IT Functions): H-165 explains WHY H-161's F2 independence claim fails on hard tasks — not because F2 is inherently useless, but because self-generated F2 produces wrong content that actively interferes with correct F1 content. H-165 is a refinement of H-161's "partially supported" status.
- **H-085** (Forced Externalization General Mechanism): H-165 identifies a new boundary condition for H-085 — forced externalization helps only when the forced analysis is reliable. When unreliable, it's actively harmful. This is the mechanism behind H-085's debugging-task boundary (EXP-071: 83% correct analysis → still only +5pp).
- **H-107** (Difficulty Threshold): H-165 provides the mechanistic explanation for WHY difficulty moderates gate effectiveness. It's not just capacity overhead (H-107's original framing) — it's that self-analysis quality degrades with difficulty, and wrong self-analysis poisons subsequent reasoning.
- **H-098** (Attention Channel Theory): Ch2 (structural gates) captures attention — but attention directed at wrong self-analysis is worse than undirected attention. Channel effectiveness depends on content quality, not just channel strength.

## Prior Probability: P(H) = 0.85

**For**:
- (+) Direct experimental evidence: EXP-165 shows exactly the predicted subadditive pattern (0% combined vs 100% F1-only), p < 10⁻⁹
- (+) Clear mechanism: cognitive anchoring by self-generated content is well-established in human cognition literature
- (+) Consistent with H-085 boundary conditions (EXP-071 debugging, EXP-078 absent-field)
- (+) EXP-164 provides the positive control — no interference on easy tasks where self-analysis is reliable

**Against**:
- (−) Single hard-task scenario (cascading-fix-trap-v2) — needs replication on other architectural/hard tasks
- (−) The anchoring mechanism is inferred, not directly measured — we haven't traced the agent's Phase 2 reasoning to show it's following Phase 1 conclusions
- (−) EXP-047 showed wrong analysis still works on easy tasks — the mechanism of "when wrong analysis helps vs hurts" needs sharper delineation
- (−) N=14-16 per arm — sufficient for the extreme effect sizes observed, but intermediate effects (P-165c) would need larger N

**Net**: High confidence. The 100pp interference effect is the largest subadditive result we've observed. The mechanism is plausible and consistent with multiple prior findings. Held below 0.90 pending replication on a second hard task.

---

*Cross-references: H-161, H-085, H-107, H-098, EXP-164, EXP-165, KE-186, EXP-047, EXP-071*
