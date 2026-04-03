# When to ASK: Uncertainty-Gated Language Assistance for RL

**Source**: arXiv:2604.02226 (April 2, 2026), IJCNN  
**Authors**: Juarez Monteiro, Nathan Gavenski, Gianlucca Zuin, Adriano Veloso  
**Tags**: #uncertainty #gating #rl #llm #ood #neuro-symbolic

---

## Problem Statement

Reinforcement learning agents face critical limitations:
- **OOD Scenarios**: Out-of-distribution situations cause high uncertainty and random behavior
- **LM Tradeoff**: Large LMs have world knowledge but high computational cost; small LMs lack reasoning
- **Autonomous Planning**: LMs have limitations in autonomous planning for complex scenarios

**Core Challenge**: How to leverage LM knowledge efficiently without constant expensive queries?

---

## Solution: ASK (Adaptive Safety through Knowledge)

### Architecture
```
RL Policy (small, fast)
    ↓
Monte Carlo Dropout → Uncertainty Estimate
    ↓
Threshold Gate
    ↓
[Low uncertainty]  → Use RL policy action
[High uncertainty] → Query LM for suggestion
```

### Key Components

| Component | Purpose |
|-----------|---------|
| **Monte Carlo Dropout** | Estimate epistemic uncertainty |
| **Threshold Gate** | Decide when to query LM |
| **Small LM** | Default policy (efficient) |
| **LM Query** | Fallback for uncertain states |

### Mechanism
1. **In-domain**: RL policy performs well, no LM queries needed
2. **OOD detected** (high uncertainty): Gate opens, query LM for guidance
3. **Action synthesis**: Combine or select between RL and LM suggestions

---

## Results

| Scenario | Metric | Result |
|----------|--------|--------|
| **In-domain** (FrozenLake) | No improvement | Baseline maintained |
| **Transfer tasks** (OOD) | Reward | **0.95** (robust navigation) |

**Key Finding**: Effective neuro-symbolic integration requires **careful orchestration** rather than simple combination.

---

## Critical Insights

### 1. Uncertainty as Gate Signal
Monte Carlo Dropout provides reliable uncertainty estimates for gating decisions.

### 2. Sufficient Model Scale Required
Threshold mechanism only works when LM has adequate capability to handle OOD scenarios.

### 3. Hybridization > Pure Approaches
Neither pure RL nor pure LM sufficient; selective combination outperforms both.

### 4. Efficiency Preserved
Most decisions use fast RL policy; expensive LM queries only when needed.

---

## Implications for Our System

### 1. L4 Uncertainty Gating
Current L4 (Reasoning/Execution) could adopt ASK pattern:
- Fast path: Local reasoning with small model
- Slow path: Query powerful model only when uncertain
- Threshold tunable per task complexity

### 2. Tool Use Decisions
Similar gating for tool invocation:
- Low uncertainty: Use cached/known tool
- High uncertainty: Invoke LLM for tool selection

### 3. Multi-Agent Coordination
ASK principle applies to agent communication:
- Agents act autonomously when confident
- Escalate to coordinator only when uncertain
- Reduces coordination overhead

### 4. Cost-Quality Tradeoff
Explicit uncertainty quantification enables:
- Budget-aware inference
- Quality guarantees (uncertainty < threshold)
- Graceful degradation (query more expensive models only when needed)

---

## Implementation Sketch

```python
class UncertaintyGatedAssistant:
    def __init__(self, fast_policy, large_lm, threshold):
        self.policy = fast_policy  # Small, efficient
        self.lm = large_lm          # Powerful but expensive
        self.threshold = threshold
    
    def act(self, state):
        # Estimate uncertainty via MC Dropout
        uncertainty = self.policy.estimate_uncertainty(state)
        
        if uncertainty < self.threshold:
            # Fast path: use policy directly
            return self.policy.act(state)
        else:
            # Slow path: query LM for assistance
            lm_suggestion = self.lm.suggest_action(state)
            return self.synthesize(self.policy.act(state), lm_suggestion)
```

---

## Connections to Prior Work

- **DAST** (arXiv:2503.04472): Difficulty-adaptive reasoning budget → similar threshold-based resource allocation
- **TCA** (arXiv:2603.30031): VOI-based stopping → uncertainty quantification for decision boundaries
- **MIT ORCA**: Online calibration for reasoning → uncertainty estimation techniques

---

## Actionable Takeaways

1. **Implement uncertainty estimation** for key decision points
2. **Set adaptive thresholds** based on task criticality
3. **Cache uncertainty estimates** to avoid recomputation
4. **Log gating decisions** for threshold tuning
5. **Consider cost-per-query** in threshold setting
