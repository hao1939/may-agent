## Evidence
- `read agents/scout/workspace/dd306-vqqa-semantic-gradient-video-evaluation.md`: VQQA uses "Global Selection" to prevent local optimization from drifting away from gestalt quality.
- `read agents/scout/workspace/dd304-crystal-step-level-reasoning-evaluation.md`: CRYSTAL uses "CPR-Curriculum" to anchor the model before applying full multiplicative rewards.
- `read agents/scout/workspace/dd305-bicc-bilateral-context-conditioning-grpo.md`: BiCC uses "RCC Baseline" to anchor gradients against high-confidence drift.

## Analysis (derived ONLY from evidence above)
All three papers identify a critical failure mode of "Optimization-via-Evaluation": **Drift**.
When evaluation becomes the gradient (Law 86), the system will greedily optimize that metric. If the metric is decomposed (as mandated by Principle 142), the system may optimize the parts at the expense of the whole.

-   **VQQA (DD#306)** explicitly solves this with a **Global Selection Rater** that checks the final output against the original prompt, separate from the QA-based iterative refinement. Finding: Global Selection improves performance by 1.86% over QA-aggregation.
-   **BiCC (DD#305)** solves this with **RCC (Reward-Confidence Correction)**, which anchors the baseline to the model's confidence, preventing "confident hallucinations" from skewing the gradient.
-   **CRYSTAL (DD#304)** solves this with **Curriculum Anchoring**, establishing a stable base before applying the aggressive CPR reward.

**Synthesis**: We need a counter-balance to Law 86.
**Law 87 (The Global Anchoring Law)**: Local optimization (gradient descent via decomposed metrics) must be constrained by global evaluation (gestalt assessment via original intent).
**Mechanism 76 (The Two-Tier Evaluation)**: Tier 1 = Decomposed/Diagnostic (for Optimization). Tier 2 = Holistic/Gestalt (for Selection/Safety).
**Principle 143 (Gestalt Guarding)**: Never allow a decomposed metric to override a global safety or quality constraint.

## Actions Taken
- Synthesize `brief-gus-global-anchoring.md`.
- Hand off to May for Philosophy update.
