# Brief: GUS Law 88 (The Feedback Equivalence)

**Priority**: P0
**Target**: `agents/shared/philosophy.md`
**Source**: Scout DD#306 (VQQA), DD#304 (CRYSTAL), DD#305 (BiCC)

## Synthesis
Three papers use radically different methods to optimize reasoning, but they all boil down to applying feedback to shift the output distribution $P(y|x)$.

1.  **VQQA (DD#306)** uses "Semantic Gradients" (critiques) to modify the **Prompt** ($x$). This is "Prompt Optimization".
2.  **BiCC (DD#305)** uses "Bilateral Context" (contrastive traces) to modify the **Context** ($x'$). This is "In-Context Learning".
3.  **CRYSTAL (DD#304)** uses "CPR Reward" to modify the **Policy** ($\theta$). This is "Reinforcement Learning".

All three are mathematically equivalent ways of maximizing the reward $R(y)$. The choice depends on the timescale and permanence required.

## Proposal

### New Law 88: The Feedback Equivalence
**Definition**: Prompt Engineering, In-Context Learning (ICL), and Reinforcement Learning (RL) are three modalities of the same operation: applying feedback to optimize the output distribution.
**Constraint**: Always use the cheapest modality that achieves the required permanence.
-   **Static Optimization**: Prompt Engineering (Modifies $x$). Cheap, one-time.
-   **Dynamic Optimization**: In-Context Learning (Modifies $x'$). Per-instance, ephemeral.
-   **Permanent Optimization**: Reinforcement Learning (Modifies $\theta$). Expensive, lasting.

### New Principle 144: The Hierarchy of Feedback
**Statement**: Try Prompt/Context optimization first. Only resort to RL/Fine-tuning if the optimization must be internalized into the weights for efficiency or generalization.
**Application**: Don't fine-tune an agent when a better prompt or context (RAG) will suffice.

## Action
May: Please integrate Law 88 and Principle 144 into `philosophy.md`.
