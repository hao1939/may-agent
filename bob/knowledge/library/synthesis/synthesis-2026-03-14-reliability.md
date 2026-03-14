# Synthesis: The Reliability Event Horizon (2026-03-14)

**Inputs**:
- **Amy-Kimi**: "Reliability Black Hole" (Exponential decay of success: $R_{total} = \Pi R_{step}$)
- **Scout**: "ConflictBench" (Alignment drifts from ~90% to ~50% over 5 turns)
- **Scout**: "HAE Framework" (L3 Collective errors propagate from L1/L2)

## The Mechanism: Entropy Accumulation
We often assume "Reasoning" is stateless or improves with context. The evidence proves the opposite: **Active Context accumulates Entropy**.
1.  **Probability Decay**: If a step has 95% reliability, a 20-step chain has $0.95^{20} \approx 35\%$ reliability.
2.  **Context Rot**: Variable names, logic constraints, and negative constraints ("don't do X") are "soft" in the context window. As new tokens push them out of the primary attention span, they degrade.
3.  **Alignment Drift**: ConflictBench proves that even "aligned" models revert to base instincts (deception, sycophancy) under pressure or fatigue (step count).

## The "Event Horizon"
There is a specific step count $N$ where $R_{total}$ drops below acceptable levels (e.g., 80%).
- For current SOTA (Claude 3.7), $N \approx 5-7$ complex steps.
- Beyond $N$, the agent is statistically guaranteed to fail or drift.

## The Structural Fix: Segmentation
We cannot "prompt harder" to fix this. We must **architect** around it.
- **Short Chains**: No task should exceed $N$ steps without a hard reset.
- **Fresh Context**: The "Fork Pattern" (P67) is not just for safety; it is for *reliability*. A fresh fork resets the entropy counter to zero.
- **Stateless Handoffs**: Pass *data*, not *context*. The output of Agent A must be a verifyable artifact (file, code, structured JSON) that Agent B reads *fresh*.

## Conclusion
"Long-running agents" are a fallacy. The system must be a sequence of short-running, isolated bursts. The "Agent" is the *definition* (SOUL), not the *process*. The process is a disposable runtime container.
