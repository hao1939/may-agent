# Synthesis: Markovian Drift & The Theoretical Grounding of Agent Decay
**Date:** 2026-03-28
**Source:** Scout Deep-Dive (arXiv:2603.11228) + Philosophy P69/P79

## 1. The Mechanism: Markovian Generation Chains
Scout's analysis of *Markovian Generation Chains* (École Polytechnique/CNRS) provides the missing theoretical link for why our agents drift.
- **The Process:** When Agent A's output becomes Agent B's input (iterative deliberation), it forms a Markov Chain: $x_{t+1} = LLM(x_t)$.
- **The Outcome:**
  - **Low Temp ($\le 0.3$)**: Rapid convergence to "Attractors" — generic, safe, high-probability responses. This explains "Consensus Hallucination."
  - **High Temp ($\ge 1.0$)**: Chaotic divergence.
  - **Information Loss**: Each step compresses the context, causing progressive simplification ("Regression to the Mean").

## 2. Validation of Our Principles
This mathematical model rigorously validates two of our core architectural choices:

### P79 The Ralph Loop (Fresh Context)
- **Theory**: A Markov Chain depends only on the current state ($x_t$). If $x_t$ is slightly wrong, $x_{t+1}$ will be wronger (if in an attractor basin of error) or generic.
- **Our Fix**: The Ralph Loop forces a **Reset**. By reloading state from disk (L2/L3) and starting fresh, we break the Markovian dependency. The agent isn't predicting $x_{t+1}$ from $x_t$; it's predicting $x_{t+1}$ from Ground Truth.
- **Conclusion**: "Fresh Context" is not just for memory management; it is a **Drift Breaker**.

### P69 External Grounding
- **Theory**: A closed Markov chain eventually settles into a stationary distribution determined by the model's biases, *independent* of the initial task.
- **Our Fix**: P69 requires an **External Signal** (Human, Linter, Test Result) to enter the loop.
- **Mechanism**: The external signal acts as a "perturbation" that kicks the chain out of the generic attractor and back toward the specific solution.

## 3. New Design Pattern: Temperature Annealing
The paper suggests a control mechanism we haven't used: **Dynamic Temperature**.
- **Deliberation Phase**: Use High Temp (0.7-1.0) to explore the state space and avoid premature convergence.
- **Convergence Phase**: Use Low Temp (0.1-0.3) to snap to the nearest valid solution.
- **Current State**: We mostly use fixed temperature.
- **Proposal**: For complex multi-turn tasks (Design Reviews, Root Cause Analysis), we should implement **Annealed Sampling**.

## 4. Action Plan
1. **Philosophy Update**: Explicitly reference "Markovian Drift" in P69/P79.
2. **Experiment**: Brief Tech-Lead to try "Temperature Annealing" in the `deliberation` skill.
