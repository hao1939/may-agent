# CR-330: Closing the Verification Self-Awareness Gap — Meta-Verification and Signal Calibration

**Rating**: ★★★★★  
**Sources**: DD-724 (Co-Sight), DD-725 (DeepVerifier), DD-726 (Calibrated Uncertainty)  
**Fills gaps in**: KE-105 (Verification Orchestration Stack)  
**Created**: 2026-04-10 by Scout, Session 577

---

## Executive Summary

Three papers form a coherent stack that fills 3 of the 5 remaining gaps in our verification orchestration architecture (KE-105):

| KE-105 Gap | Paper | How Filled |
|------------|-------|------------|
| **Verification of verifiers** | Co-Sight (DD-724) | Conflict-Aware Meta-Verification — overlapping verifier coverage + disagreement-triggered re-verification |
| **Signal calibration** | DeepVerifier (DD-725) + Calibrated Uncertainty (DD-726) | Rubric decomposition (interpretable sub-scores) + statistical post-hoc calibration (probabilistically meaningful scores) |
| **Cold-start** | Calibrated Uncertainty (DD-726) | Conservative defaults + conformal prediction sets + transfer calibration from similar tasks |

**Remaining unfilled gaps**: Dynamic capability profiles (agents improve over time, routing decisions become stale) and Multi-step attack detection (coordinated attacks spanning requests).

---

## The Verification Self-Awareness Stack

These three papers, together with the existing KE-105 layers, form what I'm calling the **Verification Self-Awareness Stack** — the set of mechanisms that let a verification system know how reliable its own outputs are.

```
┌─────────────────────────────────────────────────┐
│         Layer 5: Meta-Verification (NEW)         │
│   Co-Sight CAMV — inter-verifier conflict        │
│   detection + confidence-weighted resolution     │
├─────────────────────────────────────────────────┤
│         Layer 4.5: Signal Calibration (NEW)      │
│   DeepVerifier rubrics → Calibrated scores →     │
│   Isotonic regression → Calibrated probabilities │
├─────────────────────────────────────────────────┤
│         Layer 4: Skill Evolution (KE-116/CR-329) │
│   SkillClaw collective evolution, trajectory     │
│   feature detection                              │
├─────────────────────────────────────────────────┤
│         Layer 3: Adaptive Rubrics (KE-116/CR-329)│
│   AdaRubric task-adaptive evaluation             │
├─────────────────────────────────────────────────┤
│         Layer 2: Budget Allocation (KE-105)      │
│   DOVA deliberation-first + risk cues            │
├─────────────────────────────────────────────────┤
│         Layer 1: Policy Compilation (KE-105)     │
│   Semantic Router DSL → static guarantees        │
└─────────────────────────────────────────────────┘
```

### What's new:
- **Layer 5 (Meta-Verification)**: Sits ABOVE the existing stack. Doesn't trust any single layer's output. Instead, runs overlapping checks and uses disagreement as signal.
- **Layer 4.5 (Signal Calibration)**: Sits BETWEEN Layers 4 and 5. Transforms raw verification scores into calibrated probabilities before meta-verification compares them.

---

## Three Architectural Patterns

### Pattern A: Rubric-First, Calibrate-Second
**DD-725 + DD-726 combined**

1. DeepVerifier generates task-adaptive rubrics (rubric decomposition)
2. Each rubric dimension produces an interpretable sub-score
3. Sub-scores feed into isotonic regression calibration layer
4. Calibrated probabilities feed budget allocation (DD-702 DOVA)

**When to use**: Established task types with outcome history. Maximum calibration quality.

### Pattern B: Conflict-Driven Deep Verification
**DD-724 + DD-725 combined**

1. Multiple verifiers evaluate the same claim (overlapping coverage)
2. Co-Sight CAMV detects inter-verifier disagreement
3. On disagreement, DeepVerifier launches rubric-based deep verification on the specific conflict
4. Resolution updates verifier confidence weights

**When to use**: High-stakes decisions where verification errors are costly. Worth the compute premium.

### Pattern C: Cold-Start Bootstrapping
**DD-726 + DD-725 combined**

1. New task type arrives, no calibration history
2. DeepVerifier generates rubrics from first principles (zero-shot, using failure taxonomy)
3. Conformal prediction produces wide prediction sets (conservative)
4. As outcomes accumulate, calibration curves tighten
5. After ~100-500 examples, switch to Pattern A

**When to use**: New agent types, new task categories, or after significant system changes that invalidate existing calibration.

---

## Gap Closure Analysis

### 3 of 5 Gaps Now Addressed:

| Gap | Status | Solution | Confidence |
|-----|--------|----------|------------|
| Signal calibration | ✅ CLOSED | DD-725 rubric decomposition + DD-726 statistical calibration | High — multiple complementary approaches |
| Verification of verifiers | ✅ CLOSED | DD-724 CAMV conflict-aware meta-verification | High — demonstrated at GAIA SOTA |
| Cold-start | ✅ CLOSED | DD-726 conformal prediction + DeepVerifier zero-shot rubrics | Medium — protocol exists, untested in our domain |
| Dynamic capability profiles | ❌ OPEN | Need: online learning of agent capabilities over time | Related leads: skill evolution (DD-722 SkillClaw) is capability evolution at population level, not individual profiling |
| Multi-step attack detection | ❌ OPEN | Need: sequential request analysis for coordinated attacks | No strong leads found. Closest: JAWS-BENCH for jailbreak evaluation, but not multi-step detection |

### Research Debt Remaining
The two unfilled gaps (dynamic capability profiles, multi-step attack detection) are more niche:
- **Dynamic capability profiles** could be addressed by extending SkillClaw (DD-722) from population-level to individual agent-level skill tracking
- **Multi-step attack detection** requires sequential anomaly detection literature, which overlaps with intrusion detection systems more than ML verification literature

**Recommendation**: These are lower priority than the 3 now-filled gaps. The filled gaps (calibration, meta-verification, cold-start) represent the critical "verification self-awareness" capabilities. The remaining gaps are operational robustness concerns.

---

## Predictions

### P-330a: Rubric Decomposition Will Reduce Override Rate
**Claim**: If we implement DeepVerifier-style rubric decomposition in our commit guard, Hao's override rate will decrease because the guard's reasons will be more specific and the agent can address them pre-submission.
**Testable by**: Measuring override rate before/after rubric decomposition implementation.
**Confidence**: Medium-High.

### P-330b: Calibrated Confidence Will Enable Budget Optimization
**Claim**: With calibrated confidence scores, verification budget can be reduced by 30-50% on high-confidence commits without quality degradation.
**Testable by**: A/B test: fixed budget vs. calibration-aware dynamic budget.
**Confidence**: Medium. Depends on calibration quality and distribution of commit difficulties.

### P-330c: Meta-Verification Catches Failures That Single Verification Misses
**Claim**: Inter-verifier conflict detection (CAMV) will catch verification failures that no single verifier detects alone.
**Testable by**: Run dual verification on historical commits, measure disagreement-detection rate.
**Confidence**: High. Co-Sight showed this at 84.4% GAIA SOTA.

---

## Recommendations

### For Bob (Integration)
1. **KE-105 Update**: Add Layers 4.5 (Signal Calibration) and 5 (Meta-Verification) to the verification orchestration stack
2. **Experiment Design**: Design EXP-115 to test rubric decomposition in commit guard (measure interpretability improvement and override rate)
3. **KE-116 Connection**: The Verification Self-Awareness Stack complements the Evaluation Architecture — verification is evaluation of agent outputs

### For Tech-Lead
1. **Calibration Infrastructure**: Implement (prediction, outcome) logging for all verification decisions — this is the prerequisite for all calibration work
2. **Dual Verification Pilot**: Run overlapping verification on 10% of commits to measure disagreement rate and catch verification failures
3. **Never Trust Verbalized Confidence**: System policy — agent self-reported confidence is weak signal, not decision input

### For Scout (Next Research)
1. **Dynamic Capability Profiles**: Search for online learning / continual learning of agent skills and capabilities
2. **Multi-Step Attack Detection**: Search intrusion detection literature for sequential anomaly detection adapted to LLM agents
3. **Friday arXiv triage**: Evening listings will likely surface more evaluation/verification papers given the current publication wave

---

*Scout CR-330 | 2026-04-10 | Session 577 | CR#324 gap filling synthesis*
