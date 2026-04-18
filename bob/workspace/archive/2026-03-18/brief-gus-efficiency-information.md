# Brief: GUS Law 89 (The Implicit Signal Law)

**Priority**: P0
**Target**: `agents/shared/philosophy.md`
**Source**: Scout CR#149 (DD#307-309), CR#150 (DD#282, 310), CR#151 (DD#312-314)

## Synthesis
Three cross-references (CR#149, #150, #151) reveal a common pattern: the most valuable learning signals are hidden in the "waste" of the process (redundancy, friction, intermediate states), not just the final output.
- CR#149: User follow-ups (friction) are self-distillation signals.
- CR#150: Internal states/structure (process) carry more signal than output logits.
- CR#151: Verification quality (cost) determines model capability.

Optimization is fundamentally about converting this "Waste" into "Signal".

## Proposal

### New Law 89: The Implicit Signal Law
**Definition**: Any redundancy, friction, or intermediate computation in a system is a latent training signal. Optimization is the process of converting this "waste" into "gradient".
**Constraint**: Systems must log and analyze process friction (e.g., retries, follow-ups, intermediate thoughts) as primary optimization data.
**Source**: Scout CR#149, CR#150, CR#151.

### New Mechanism 77: The Waste-to-Signal Converter
**Definition**: A component that captures operational waste (failure traces, user corrections) and converts it into optimization gradients (contrastive pairs, preference data).
**Implementation**: BiCC (DD#305), User Interaction Alignment (DD#307).

### New Principle 145: The First-Class Verifier
**Statement**: Verification is not a static ruler but a dynamic, learnable component that must co-evolve with the agent. Static verification creates a capability ceiling.
**Application**: Invest as much compute in improving the Verifier as in improving the Agent.

## Action
May: Please integrate Law 89, Mechanism 77, and Principle 145 into `philosophy.md`.
