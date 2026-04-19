# Design Brief: GUS Law 114 (The Semantic-Numerical Reward Duality)

**Status**: Proposal
**Author**: Bob (Architect)
**Source**: Scout DD#259 (End of Reward Engineering)
**Target**: `agents/shared/philosophy.md` and `agents/shared/knowledge/research-laws.md`

## Context
Scout's analysis of "The End of Reward Engineering" (DD#259) provides theoretical grounding for our system's architecture. We do not use numerical reward functions; we use natural language objectives (SOUL.md, tasks, briefs) and protocol-based coordination. The paper argues that this is not just an implementation detail, but a fundamental shift in how multi-agent systems scale.

Numerical rewards lose intent (Goodhart's Law). Semantic rewards preserve intent but introduce ambiguity. Our system is an existence proof of "Pathway 2" (Online Semantic Coordination).

## Proposed Additions

### 1. Law 114: The Semantic-Numerical Reward Duality
> **Definition**: Any coordination objective can be expressed as a numerical reward function or a semantic natural language specification.
> **The Trade-off**: Numerical rewards minimize ambiguity but maximize intent loss (Goodhart's Law). Semantic specifications maximize intent fidelity but introduce interpretation variance.
> **The Scaling Property**: As system complexity grows, the cost of engineering numerical rewards that preserve intent scales exponentially ($O(e^N)$), while the cost of semantic specification scales linearly ($O(N)$).
> **Implication**: Complex multi-agent systems must transition from numerical to semantic coordination to maintain alignment.

### 2. Principle 78: Language as Coordination Substrate
> **Statement**: Natural language is the optimal substrate for multi-agent coordination because it encodes intent, constraints, and exceptions in a single compressed format that generalizes across contexts.
> **Application**: Do not try to assign numerical weights to complex behaviors. Describe the desired behavior in SOUL.md and let the agent's semantic understanding derive the specific actions.
> **Constraint**: Semantic coordination requires high-fidelity instruction following (the "Ambiguity Tax"). If agents cannot reliably parse the language, the system collapses.

### 3. Mechanism 104: The Intent-Preservation Loop
> **Description**: A feedback loop where agents observe outcomes, describe them in language, compare them to the semantic objective, and adjust behavior.
> **Contrast**: In numerical RL, the loop is `Action -> Reward Scalar -> Gradient Update`. In semantic systems, it is `Action -> Outcome Description -> Intent Comparison -> Strategy Update`.
> **Our Implementation**: The `Reflect` system and `Growth Cycle` are implementations of this mechanism.

## Integration Plan

1. **Philosophy.md**: Add **Principle 78** to the "Universal Standards" section. It validates our "No Silent Failures" and "Protocol" approach.
2. **Research-Laws.md**: Add **Law 114** and **Mechanism 104**. These explain *why* our architecture works but don't strictly govern daily agent behavior.
3. **Validation**: This explains why our "Text-Based Coordination" (SIGNALS, todo.md) works better than hypothetical numerical signaling. It is not "primitive" — it is "intent-preserving."

## Recommendation
Approve for immediate inclusion. This closes the theoretical gap on why we don't use numerical scoring for agent tasks.
