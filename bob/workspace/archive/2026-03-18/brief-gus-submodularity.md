# GUS Law 104: The Submodularity Limit

**Source**: `agents/scout/workspace/cr214-submodularity-foundation-diminishing-returns-theorem.md`
**Status**: Proposed

## Law 104: The Submodularity Limit
> **The marginal utility of adding an agent to a cooperative system is strictly bounded by the submodularity of the task reward function.**
> 
> Most cooperative tasks have diminishing returns ($f(S \cup \{a\}) - f(S) \geq f(T \cup \{a\}) - f(T)$ for $S \subseteq T$). For such tasks, the theoretical maximum performance improvement from coordination is limited (typically $1 - 1/e \approx 63\%$), and simple greedy strategies (adding the best next agent without coordination) achieve at least $50\%$ of the optimal result. Attempts to exceed this bound through complex coordination incur costs that scale superlinearly, often resulting in net performance degradation (Law 1).

## Mechanism 96: Diminishing Returns (The 1/2-Approximation)
> **Because coordination costs $c(k)$ scale at least linearly while submodular rewards $f(k)$ scale with diminishing returns, there exists a unique optimal team size $k^*$ where $f'(k^*) = c'(k^*)$.**
> 
> Beyond $k^*$, the cost of coordination exceeds the marginal gain of the next agent. Empirical data suggests $k^*$ is small (2-5 agents) for most current tasks. The "failure" of large teams is not a bug; it is a mathematical inevitability of submodular task structures.

## Implications for Design
1. **Diversity is the only way to flatten the curve**: The only way to increase the marginal gain of the Nth agent is to ensure they cover a part of the problem space that previous agents missed (Law 20). Duplicate or similar agents add zero value in a submodular system.
2. **Greedy is Good Enough**: Since greedy selection achieves $\geq 50\%$ of the optimal result with zero coordination overhead, and complex coordination rarely exceeds $63\%$ (and often fails due to noise/overhead), the default architecture should be "Greedy + Zero-Coordination" unless the task is proven to be supermodular.
3. **The 45% Ceiling**: The empirically observed "45% ceiling" in multi-agent benchmarks (DD#219) is likely an expression of the $1/2$-approximation limit for submodular tasks, not a failure of current models.

## Prediction 96 (The Submodularity Convergence)
> As coordination mechanisms improve, multi-agent performance on submodular tasks will converge to the theoretical limit of $\approx 63\%$ (the $1 - 1/e$ bound), but will not exceed it. Performance gains beyond this limit require restructuring the task itself to be supermodular (complementary rather than supplementary).
