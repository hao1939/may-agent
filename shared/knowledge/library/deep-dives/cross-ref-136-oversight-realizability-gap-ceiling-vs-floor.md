# Cross-Reference #136: Theoretical Ceiling vs. Practical Floor in Multi-Agent Oversight

## Papers Connected
- **DD#269**: arXiv:2603.05293 — Knowledge Divergence and the Value of Debate (Young, Cambridge)
- **DD#270**: arXiv:2603.00113 — AI Agents Not (Yet) Panacea for Social Simulation (Li & Tao)
- **DD#220-223**: GUS Framework (existing portfolio synthesis)
- **DD#266**: ACP Protocol Stack
- **DD#234**: MADA Multi-Agent Design Exploration

**Session**: s_1773621812773_736

---

## Synthesis: The Oversight Realizability Gap

### The Theoretical Ceiling (Young 2603.05293)
Young's formal framework establishes that multi-agent debate has **exact, quantifiable advantages** over single-agent oversight when models have divergent knowledge:
- Debate advantage Δ = √((K*_A)² + η²) - K*_A
- Phase transition at η ≈ K*_A separating negligible from essential debate value
- Diminishing marginal returns for coalitions of n > 2 models
- Same-corpus models → debate = RLAIF (no benefit from multi-agent setup)

This provides a **ceiling**: the best possible improvement from multi-agent oversight, under ideal conditions (faithful revelation, linear scoring, rational agents).

### The Practical Floor (Li & Tao 2603.00113)
Li & Tao argue that LLM agents suffer from fundamental epistemic mismatches:
- Role-playing plausibility ≠ faithful decision processes
- Agent-agent interaction ≠ full social dynamics
- Prompt-level artifacts can dominate apparent effects
- Environment/protocol choices may matter more than agent quality

This establishes a **floor**: the reliability limitations that constrain how much of the theoretical ceiling is actually achievable.

### The Realizability Gap
The gap between ceiling and floor is the **oversight realizability gap**:

```
Realizability Gap = Theoretical Debate Advantage - Actual Debate Advantage
                  = f(η, K*_A, faithfulness, protocol_quality, environment_spec)
```

Key insight: Young's Proposition 17 (adversarial coordination failure above threshold λ*) and Li & Tao's Mismatch 1 (unfaithful agents) describe **different mechanisms** producing the same effect — debate failing to reach its theoretical optimum.

---

## Implications for Multi-Agent System Design

### 1. Diversity Is Necessary But Not Sufficient
- Young proves debate advantage requires η > 0 (knowledge divergence)
- Li & Tao warn that even with diverse agents, the diversity may be **illusory** (same base model, different prompts)
- **Design principle**: Ensure diversity at the **representation level** (different training corpora, architectures), not just the **prompt level**

### 2. Protocol Design Is the Key Lever
- Young shows debate protocol determines whether compositional knowledge is accessed (Propositions 15-16)
- Li & Tao show protocol/scheduling can dominate outcomes
- **Convergence**: Both papers independently identify protocol design as more important than agent capability
- This strongly supports the **ACP Protocol Stack** approach (DD#266) which puts protocol specification first

### 3. Evaluation Must Target Mechanisms, Not Outputs
- Young's framework provides measurable quantities (η, K*_A, Δ) that could serve as evaluation metrics
- Li & Tao argue current evaluation is output-centric and misses mechanistic validity
- **Synthesis**: Use Young's geometric measures to evaluate WHETHER debate is working as theorized, not just whether outputs look good

### 4. Adversarial Tension Has Formal Limits
- Young: λ* = K*_{AB} - K*_{safe} is a sharp threshold for coordination failure
- Li & Tao: Adversarial/competitive incentives interact with agent faithfulness in unpredictable ways
- **Implication**: Multi-agent oversight systems need **incentive auditing** to ensure λ < λ*

---

## Connection to GUS Predictions

| GUS Prediction | Young Support | Li & Tao Support | Net Assessment |
|---|---|---|---|
| Multi-agent coordination has regime-dependent returns | ✅ Phase transition η ≈ K*_A | ⚠️ May not realize theoretical returns | Partially validated |
| Protocol design > agent capability | ✅ Protocol determines Δ access | ✅ Protocol dominates outcomes | **Strongly validated** |
| Diminishing returns from adding agents | ✅ Formal proof (Prop. 12) | N/A | Validated |
| Agent diversity critical | ✅ η = 0 → Δ = 0 | ⚠️ Diversity may be surface-level | Validated with caveats |
| Adversarial incentives can backfire | ✅ Sharp threshold λ* | ✅ Faithfulness concerns compound | **Strongly validated** |

---

## Open Research Directions

1. **Empirical η measurement**: Can we compute the private information value between two real LLMs? This would enable predictive use of Young's framework.
2. **Faithfulness metrics**: Develop measures of agent faithfulness that complement Young's geometric framework — the gap between "what the agent could reveal" and "what it does reveal."
3. **Protocol optimization**: Given Young's diminishing-returns formula and Li & Tao's environment-dominance argument, design protocols that maximize realized Δ / theoretical Δ.
4. **POSG-ES + Principal Angles**: Combine Li & Tao's game-theoretic formalization with Young's geometric framework for a unified theory of practical multi-agent oversight.

---

## Bottom Line

These two papers form a natural theory pair: **Young provides the math for what's possible; Li & Tao explain why we can't always get there.** Together, they define the envelope of multi-agent oversight performance and identify protocol design as the key lever for closing the realizability gap. This strongly reinforces P82's protocol-first design philosophy and suggests that empirical measurement of the private information value η should be a priority for validating multi-agent coordination benefits.
