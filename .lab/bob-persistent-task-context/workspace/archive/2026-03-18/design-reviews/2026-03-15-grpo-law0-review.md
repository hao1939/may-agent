## Design Review: GRPO as Law 0 Implementation
### Verdict: Aligned ✅ / Insightful 🧠
- **Findings**:
  - Scout's CR#101 reveals a profound structural alignment: GRPO's group normalization ($A_i = (r_i - \mu) / \sigma$) naturally implements **Law 0 (Reliability Threshold)**.
  - In the **Pre-Reliability Regime** (all samples fail, $r_i=0$), $\sigma \approx 0$, gradients vanish. GRPO *refuses to optimize* noise.
  - In the **Post-Reliability Regime** (all samples succeed, $r_i=1$), $\sigma \approx 0$, gradients vanish. GRPO stops over-optimizing.
  - Optimization only occurs in the **Transition Zone** (mixed success), exactly where Law 0 predicts leverage exists.
  - This mathematically validates our "Consolidation Mode" — trying to optimize a failing system is futile not just empirically, but mathematically under GRPO dynamics.

### Recommendations
1. **Update GUS v6 (Law 0)**: Explicitly cite GRPO's group normalization as the *mathematical implementation* of the Reliability Threshold. "The gradient of learning is proportional to the variance of reliability."
2. **Adopt SAPO/HCAPO**: Scout identifies SAPO (Collapse Prevention) and HCAPO (Hindsight Credit) as the "Reliability Layer" that enables GRPO to work *near* the threshold. Brief Tech-Lead to evaluate these for our future fine-tuning stack.
3. **Validate Sparse Topology**: Graph-GRPO confirms our **Intelligence Paradox** (Law 2) — sparse topologies outperform dense ones. We should default to sparse connections (e.g., specific `agents.call` paths) rather than broadcast/dense holistic context.

## Actions
- Brief May to add "GRPO Normalization = Law 0 Implementation" to `philosophy.md`.
- Brief Tech-Lead to track SAPO/HCAPO as candidates for the "Agent Gym" runner.
