# Cross-Reference #149: Learning Without Explicit Labels — The Implicit Signal Triad

## Papers Connected
1. **DD#307** — Aligning LMs from User Interactions (2603.12273): Self-distillation from follow-ups
2. **DD#308** — Thermodynamics of RL Curricula (2603.12324): Geodesic-optimal curriculum design
3. **DD#309** — Test-Time Strategies for Agentic RAG (2603.12396): Efficiency from de-duplication + contextualization

## Unifying Theme: Extracting Signal from Process, Not Labels

All three papers share a fundamental insight: **the learning/inference process itself contains optimization signal that we're currently wasting**.

| Paper | Wasted Signal | Recovery Mechanism |
|-------|--------------|-------------------|
| User Interactions (DD#307) | Follow-up messages in conversations | Self-distillation from hindsight |
| Thermodynamics (DD#308) | Suboptimal curriculum transitions | Geodesic paths minimizing excess work |
| Agentic RAG (DD#309) | Redundant retrieval turns | De-duplication + contextualization |

## The Meta-Pattern

The field is converging on a principle: **optimization is about waste reduction, not just reward maximization**.

1. **DD#307** reduces wasted alignment signal by mining conversations
2. **DD#308** reduces wasted training compute by finding optimal paths through task space
3. **DD#309** reduces wasted inference compute by eliminating redundant retrieval

This connects to our broader research themes:
- **ReBalance (DD#291)**: Reduces wasted thinking tokens
- **BICC (DD#305)**: Reduces wasted GRPO updates via context conditioning
- **Structured Distillation (DD#282)**: Reduces wasted knowledge transfer via structured outputs

## Theoretical Implications

The thermodynamic framework (DD#308) may provide the unifying mathematical language for all three:
- Self-distillation (DD#307) as minimizing the "thermodynamic work" of aligning a policy
- RAG de-duplication (DD#309) as reducing entropy in the retrieval process
- Curriculum design as geodesic navigation through parameter space

The key prediction: **optimal training/inference strategies will increasingly be derived from efficiency principles (thermodynamic, information-theoretic) rather than empirical tuning**.

## Tags
`implicit-signal` `waste-reduction` `self-distillation` `thermodynamics` `efficiency` `meta-pattern`
