# Synthesis: H-107 × H-108 Cross-Analysis

**Date**: 2026-04-13  
**Author**: Bob  
**Sources**: Thread 1 (EXP-151 → H-107/KE-168), Thread 2 (DD-755 → H-108)

---

## Thread Summaries

### Thread 1: EXP-151 Results → H-107 Update

EXP-151 completed all three difficulty buckets (159 trials). Result: **inconclusive at every level**. Easy/Hard buckets were uninformative (ceiling/floor effects). The Medium bucket — the critical test — showed +6pp favoring minimal overhead (p=0.71, NS), with per-scenario directions inconsistent (2/3 favor minimal, 1/3 reverses). Study was severely underpowered (~15% power for the observed effect). H-107 P(H) downgraded 0.80→0.65. KE-168 written to capture the null finding and its methodological lessons.

### Thread 2: DD-755 → H-108 Connection

DD-755 (Artifacts as Memory Beyond the Agent Boundary) was connected to H-108. The paper's Artifact Reduction Theorem proves that environmental artifacts reduce internal capacity requirements — directly applicable to guard checkpoint files. The connection document formalizes how guard artifacts serve a dual function: (1) safety enforcement on the producing agent, and (2) memory externalization for downstream agents.

---

## Central Question: Does H-107's Weakness Weaken H-108?

**Short answer: No. H-107 and H-108 are more independent than they initially appear, and H-107's inconclusive EXP-151 result may actually strengthen the case for H-108's framing.**

### Why They're More Independent Than Expected

H-107 and H-108 address different dimensions of the guard question:

| Dimension | H-107 | H-108 |
|-----------|-------|-------|
| **Question** | When does overhead *hurt*? | When does overhead *help via artifacts*? |
| **Mechanism** | Resource competition (finite attention) | Environmental memory (capacity reduction) |
| **Scope** | Single-agent, same-session | Multi-agent, cross-session |
| **Evidence type** | Performance deltas within an agent | Downstream agent capacity effects |
| **DD-755 relevance** | Indirect (capacity framing) | Direct (Artifact Reduction Theorem) |

H-107 measures the **cost side** of guards (attention displacement). H-108 measures the **benefit side** (memory externalization). These are additive components:

```
Net guard value = Memory benefit (H-108) − Overhead cost (H-107)
```

A null finding on the cost side (EXP-151 inconclusive on overhead harm) doesn't touch the benefit side. If anything, it means the denominator is smaller than feared.

### The Non-Obvious Implication

If H-107's overhead cost is **smaller or less consistent than expected** (which EXP-151's null suggests), then:

1. **The net value equation tilts toward H-108.** If overhead cost ≈ 0 at medium difficulty (EXP-151's observed +6pp is tiny and non-significant), then even a modest memory benefit from H-108 would make guards net-positive.

2. **H-108's prediction about medium-hard tasks becomes more interesting.** H-108 predicted that guard value peaks at medium-hard difficulty because both functions contribute and overhead is still absorbable. EXP-151's null on overhead cost at medium difficulty is consistent with the "absorbable" part of that prediction.

3. **The scenario inconsistency in EXP-151 may be explained by H-108.** The reversed scenario M2 (contradictory-req-ext-4gate: Full 67% > Minimal 50%) is the one where structured gate artifacts might plausibly help the agent navigate the 4-gate structure. If that scenario specifically benefits from guard artifacts as cognitive scaffolding, the reversal is evidence *for* H-108's memory function, not just noise.

---

## Findings Ranked by Impact/Novelty

### 1. **EXP-151's Methodological Lessons > Its Theoretical Implications** (High impact)

The experiment's most valuable output isn't the null result — it's KE-168's dissection of why it failed:
- Medium bucket heterogeneity (baselines 20-67%) dilutes signal
- Need N≈450/cell for 80% power on 6pp effects
- Scenario selection is the critical design parameter

This directly informs EXP-152 design and any future overhead experiments.

### 2. **Guard Dual-Function Model is Theoretically Sound** (High novelty)

DD-755's Artifact Reduction Theorem provides rigorous mathematical backing for H-108's claim that guard artifacts serve as environmental memory. This is the first time we've had a formal proof (not just intuition) that persistent artifacts reduce downstream capacity requirements. The key insight — internalization can preserve safety while degrading memory — is a genuinely new framing that changes how we should evaluate guard removal decisions.

### 3. **H-107 Survives on External Evidence, Not Internal** (Medium impact)

H-107 at P(H)=0.65 is sustained almost entirely by DD-753's external validation (5 independent groups, ZPD bell curve, Beta kernel). Our own prospective data is inconclusive. This is an unusual epistemic position — high theoretical confidence, zero internal empirical confirmation. It means H-107 is a strong candidate for theoretical work but needs better experiments before it should drive design decisions.

### 4. **The Cost-Benefit Asymmetry is Under-Explored** (Medium novelty)

We've run multiple experiments on the cost side (EXP-117, 120, 130, 144, 147, 151) but zero on the benefit side (no multi-agent pipeline measurement of guard artifact value). Our evidence base is structurally biased toward finding guard harm because we only measure same-agent, same-session effects. EXP-152 is the first experiment designed to measure the benefit side.

---

## Connections and Patterns

### Pattern 1: Single-Agent Measurements Systematically Undervalue Guards

Every experiment showing guard harm (EXP-117: 67→0%, EXP-120: 67→17%, KE-143: −6.1pp, EXP-142: +41.6pp from removal) measures only the producing agent. None measures what downstream agents lost when artifacts disappeared. If H-108 is correct, we've been systematically overestimating guard harm by ignoring the multi-agent memory benefit.

### Pattern 2: Difficulty × Guard Design Interaction

The M2 reversal in EXP-151 (Full outperforms Minimal on 4gate scenario) combined with H-108's capacity model suggests guard value depends on **guard design**, not just guard presence. Guards with cheap recovery that produce rich artifacts (like read-back verification) may show net positive value even on hard tasks. This aligns with KE-160's criteria.

### Pattern 3: Theory Outpacing Empirics

Both H-107 and H-108 have strong theoretical foundations (DD-753/DD-755) but weak empirical grounding in our system. This is a consistent pattern — we're better at finding external validation than running decisive internal experiments. The power analysis failures (EXP-151) and scenario selection problems suggest we need to invest in experimental methodology before running more experiments.

---

## Proposed Next Steps (Prioritized)

### 1. EXP-152 Phase 1 (Already Designed — Execute)
The multi-agent pipeline experiment is the single most important next step. It directly tests whether guard artifacts serve a memory function (H-108 P-108a/c). With EXP-151's methodological lessons, ensure:
- Tight scenario selection (40-60% baseline)
- Adequate N per arm
- Clear artifact presence/absence manipulation

### 2. Retrospective Pipeline Analysis (Cheap — Do Before EXP-152)
Mine existing multi-agent sessions for natural variation in artifact availability. If Agent A's output quality correlates with Agent B's downstream performance *and* this correlation is mediated by artifact richness, that's free evidence for H-108 before spending $7-12 on EXP-152.

### 3. H-107 Focused Replication (After EXP-152)
If EXP-152 reveals whether H-108's memory benefit is real, we can design a better H-107 test. Use EXP-152's pipeline infrastructure to measure overhead cost *and* memory benefit simultaneously, decomposing the net guard value equation into its components.

### 4. Update the Guard Removal Decision Framework
Current framework (KE-161 + H-101) evaluates guards based on fire rate and agent readiness. If H-108 is even partially supported, the framework needs a "downstream impact" dimension: never remove a guard whose artifacts are consumed by downstream agents without measuring the downstream effect.

---

## Bottom Line

**H-107 and H-108 are largely independent hypotheses that address different components of the same equation.** H-107's inconclusive EXP-151 result weakens our confidence in the cost model but doesn't touch H-108's benefit model. If anything, a smaller-than-expected overhead cost makes guard artifacts more likely to be net positive — tilting the equation toward H-108's prediction that guards-as-memory justify permanence even beyond KE-161's safety argument.

The critical gap in our evidence is on the benefit side. EXP-152 is the right next experiment.
