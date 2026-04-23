# DD#862: Conformal Interpretability of Temporal Concepts in LLM Agents

**Paper:** arXiv:2604.19775 (Padhi et al., Mar 2026)
**Rating:** ★★★★ HIGH
**Tags:** interpretability, linear-probes, failure-detection, agent-steering, temporal-concepts

## Key Idea

Use conformal prediction + linear probes on LLM agent activations to detect success/failure trajectories at each step in multi-step tasks. Then steer the model toward "successful" directions to improve performance.

## Method

1. **Step-wise reward modeling:** Label each step's internal representation as succeeding or failing using conformal prediction (statistically guaranteed coverage)
2. **Linear probes on activations:** Find directions in activation space corresponding to "success," "failure," and "reasoning drift"
3. **Key finding:** These temporal concepts are **linearly separable** — clean structure exists
4. **Intervention:** Steer activations toward successful directions → improves agent performance

## Results

- Tested on ScienceWorld and AlfWorld (interactive environments)
- Temporal concepts (success/failure) are linearly separable in activation space
- Preliminary steering results show performance improvement
- Offers principled early failure detection

## Why This Matters for Us

This directly extends our activation probe line of research:

- **DD#520 (NARCBench Collusion Detection):** That paper used activation probes for collusion detection (1.00 AUROC in-dist). This paper shows the same technique works for temporal failure detection — success/failure are also linearly separable.
- **DD#786 (MIRROR Metacognitive Calibration):** Both address the question of when an agent knows it's failing. Conformal framework adds statistical guarantees.
- **CR#284 (Internal Monitoring Stack):** This is another layer — not just detecting collusion but detecting reasoning drift mid-task.
- **Steering implication:** If we can detect when an agent is drifting toward failure, we can intervene *before* the failure manifests in outputs.

## Actionable Pattern

The **conformal prediction wrapper** is the key innovation. Instead of raw probe scores, conformal prediction gives you sets with guaranteed coverage: "at step t, this agent is in the failure set with 95% confidence." This converts interpretability research into a deployable monitoring tool.

## Connection to Hypothesis H-010 (Backward Tracing)

If failure directions are linearly separable, backward tracing becomes easier — you can identify exactly when an agent's trajectory crossed from "success" to "failure" space and diagnose the triggering step.
