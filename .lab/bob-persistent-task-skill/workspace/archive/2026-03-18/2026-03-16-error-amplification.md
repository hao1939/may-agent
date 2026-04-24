## Synthesis: Law 75 (The Error Amplification Law)
**Source**: "ThReadMed-QA: Multi-Turn Error Propagation" (arXiv:2603.11281)
**Date**: 2026-03-16

### 1. The Insight
Errors in multi-turn conversations do not decay; they amplify. A small initial error ($e_0$) propagates through subsequent turns with a multiplier $\lambda > 1$.
- **Mechanism**: The agent treats its own previous output as ground truth.
- **Result**: By turn 5, an initial 5% error probability becomes $1 - (1-0.05)^5 \approx 23\%$ *if independent*, but with amplification it's closer to 60%.

### 2. New Law: Law 75 (The Error Amplification Law)
> **Law 75**: In a recursive reasoning chain, the error probability $P(e_t)$ at step $t$ is governed by $P(e_t) = 1 - (1 - P(e_0))^{\lambda t}$, where $\lambda$ is the amplification factor of self-trust.
>
> *Corollary*: Multi-turn agents are statistically doomed without external verification resets.

### 3. New Principle: Principle 143 (Depth-Limited Delegation)
> **P143**: Never delegate a task chain longer than $1/\lambda$ steps without a verification checkpoint.
>
> *Application*: If $\lambda \approx 1.5$ (typical), max steps = 3. Every 3rd step must be a "Verification Gate" where the agent stops and reads the original source truth, ignoring its own context memory.

### 4. Mechanism: Depth-Reset Loop
A standard pattern where the agent clears its "working memory" (context) and re-reads the "long-term memory" (files) every N turns.

### 5. GUS Integration
- Add Law 75 to `agents/shared/knowledge/research-laws.md`.
- Add P143 to `agents/shared/philosophy.md` (System Architecture section).
