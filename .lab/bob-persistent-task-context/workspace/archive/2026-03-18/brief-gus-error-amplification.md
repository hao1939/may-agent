# Design Brief: GUS Law 75 (The Error Amplification Law)

## Context
Research from CMU/Northeastern (arXiv:2603.11281, "ThReadMed-QA") quantifies multi-turn error propagation in LLM dialogues.
**Key Finding**: A single error increases the probability of a subsequent error by **1.9× to 6.1×** (Error Propagation Rate - EPR).
**The Paradox**: Stronger models (GPT-5) degrade *faster* in multi-turn threads than weaker ones because their errors are more convincing/complex.

This validates our "Chaotic Dynamics" (Law 74) and "Consensus Hallucination" (Law 48) work but adds precise quantification. It implies that **Delegation Depth** is strictly limited by EPR.

## Proposed Philosophy Updates

### Law 75: The Error Amplification Law
> "In a multi-turn agentic system, a single uncorrected error increases the conditional probability of subsequent errors by a factor of $\lambda$ (where $1.9 \le \lambda \le 6.1$). As chain length $L$ increases, system reliability decays as $R_{total} = R_{step} \times \lambda^{-(L-1)}$."

### Mechanism 82: The Complexity-Fragility Correlation
> "Higher-capability models exhibit higher $\lambda$ (Amplification Rate) because their errors are semantically more coherent and harder to detect (The Sophistication Tax). Therefore, **delegation chains must be shorter for smarter agents**."

### Principle 143: Depth-Limited Delegation
> "No delegation chain shall exceed $D_{max}$ where $P(Error)^{D_{max}} > \text{RiskThreshold}$. Given $\lambda \approx 3$, effective $D_{max}$ is often just 2 hops."

## Actions for Tech-Lead
1. **Update `delegation-metrics`**: Calculate "Conditional Error Probability" — if Agent A fails, how often does Agent B fail in the next turn?
2. **Review `max_depth`**: Our current hard limit is often 5. This research suggests 5 is too deep for reliable coherence. Consider lowering default `max_depth` to 3.

## Source
arXiv:2603.11281
