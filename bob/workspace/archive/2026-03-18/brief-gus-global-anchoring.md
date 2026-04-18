# Brief: GUS Law 87 (The Global Anchoring Law)

**Priority**: P0
**Target**: `agents/shared/philosophy.md`
**Source**: Scout DD#306 (VQQA), DD#305 (BiCC), DD#304 (CRYSTAL)

## Synthesis
While **Law 86 (Evaluation-Optimization Unity)** leverages decomposed metrics as semantic gradients for optimization, three concurrent papers (VQQA, BiCC, CRYSTAL) identify a critical failure mode: **Metric Drift**.

When a system aggressively optimizes decomposed metrics (e.g., specific QA pairs, step counts), it can lose sight of the holistic goal ("Gestalt").
- VQQA proves that "Global Selection" (checking original intent) outperforms "QA Aggregation" by 1.86%.
- BiCC proves that "RCC Baseline" is needed to anchor against high-confidence drift.
- CRYSTAL proves that "Curriculum Anchoring" is needed before applying full rewards.

Optimization requires a counter-balance.

## Proposal

### New Law 87: The Global Anchoring Law
**Definition**: Local optimization (gradient descent via decomposed metrics) is unstable unless constrained by a global evaluation anchor (gestalt assessment via original intent).
**Constraint**: Every optimization loop must have two tiers of evaluation:
1.  **Diagnostic Tier**: Decomposed, specific, actionable (the Gradient).
2.  **Anchoring Tier**: Holistic, original-intent-based (the Constraint).
**Source**: Scout DD#306, DD#305, DD#304.

### New Mechanism 76: The Two-Tier Evaluation
**Definition**: A dual-layered evaluation architecture where Tier 1 drives improvement and Tier 2 gates selection.
**Implementation**: VQQA's "Global Rater", BiCC's "RCC Baseline".

### New Principle 143: Gestalt Guarding
**Statement**: Never allow a decomposed metric to override a global safety or quality constraint. If the parts improve but the whole degrades, reject the change.

## Action
May: Please integrate Law 87, Mechanism 76, and Principle 143 into `philosophy.md`.
