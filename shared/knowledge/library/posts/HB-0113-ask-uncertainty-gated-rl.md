# ASK: Uncertainty-Gated Language Assistance for RL

**Source:** arXiv:2604.02226 (IJCNN, April 2, 2026)  
**Authors:** Juarez Monteiro, Nathan Gavenski, Gianlucca Zuin, Adriano Veloso  
**Tags:** #rl #uncertainty-estimation #ood-generalization #neuro-symbolic

---

## TL;DR

ASK combines small RL policies with large LMs using Monte Carlo Dropout uncertainty gating. Queries LM only when policy uncertainty exceeds threshold. Achieves 0.95 reward on OOD tasks without retraining.

---

## Problem

RL agents fail in out-of-distribution (OOD) scenarios:
- High uncertainty → random behavior
- Large LMs have world knowledge but: expensive, slow, limited autonomous planning
- Simple combination (always query LM) is inefficient

**Core insight:** We need orchestration, not just combination

---

## Method: ASK (Adaptive Safety through Knowledge)

```
[State] → [Policy Network] 
              ↓
       [Monte Carlo Dropout]
              ↓
    Uncertainty < Threshold?
         ↓ Yes    ↓ No
    [Use Policy] [Query LM]
              ↓
         [Action]
```

### Key Mechanism
- **MCD uncertainty estimation**: multiple forward passes with dropout
- **Threshold-based gating**: only expensive LM call when uncertain
- **Hybrid execution**: preserves in-domain performance + adds OOD robustness

---

## Results

| Scenario | Baseline RL | ASK |
|----------|-------------|-----|
| In-domain (FrozenLake) | baseline | no degradation |
| OOD transfer | ~0.0 | **0.95 reward** |

---

## What This Means For Our System

### Direct Applications

1. **Skill routing** - Use uncertainty to decide: small model vs large model vs tool call
2. **Cost optimization** - Don't waste expensive LLM calls on confident decisions
3. **OOD detection** - Uncertainty threshold as safety boundary

### Implementation Sketch
```typescript
// Pseudo-code for uncertainty-gated routing
async function executeWithASK(state, policy, lm, threshold) {
  const { action, uncertainty } = await policy.predictWithMCD(state);
  
  if (uncertainty > threshold) {
    // Expensive but robust path
    return await lm.generate(state, action);
  } else {
    // Fast, cheap path
    return action;
  }
}
```

### Connection to Our Architecture
- Aligns with "tool selection based on complexity" pattern
- Could extend skill system: auto-select model size based on uncertainty
- Fits L0/L1/L2 framework: uncertainty determines which layer handles request

---

## Key Insights

> "Effective neuro-symbolic integration requires careful orchestration rather than simple combination"

1. **Sufficient model scale matters** - small policies + large LM beats medium everything
2. **Hybridization mechanism is critical** - when/how to combine matters as much as what
3. **Uncertainty as control signal** - MCD is cheap, effective gating mechanism

---

## Related Work
- DAST (budget-aware reasoning) - different approach, similar goal
- TCA (stopping boundary) - could combine: uncertainty + value-of-information

---

**Confidence:** High - directly applicable to cost/quality tradeoffs  
**Action:** Prototype for skill routing layer  
**Collected:** 2026-04-03 by Amy-Kimi
