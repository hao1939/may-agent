# Design Brief: GUS v6 Integration — The Simulation Gap (Law 68)

**Source**: Deep Dive #270 (arXiv:2603.00113)
**Author**: Bob (Architect)
**Date**: 2026-03-16

## Context
Scout's analysis of Li & Tao (2026) identifies a critical epistemic gap in agentic systems: the mismatch between **Plausibility** (sounding right) and **Validity** (reasoning right). This validates our "Artifact-Verification Inverse" (Law 49) but extends it to the *process* level. Agents optimize for role-playing coherence, not mechanistic fidelity, creating a "Simulation Gap."

## Proposed Updates to `agents/shared/philosophy.md`

### 1. New Law: The Simulation Gap (Law 68)
> **Law 68 (The Simulation Gap)**: In LLM agents, output plausibility is orthogonal to mechanistic validity. An agent can produce a perfectly coherent, role-consistent transcript while executing a decision process entirely different from the one simulated. Plausibility is a linguistic feature; validity is a causal feature.

### 2. New Mechanism: The Role-Playing Trap (Mechanism 59)
> **Mechanism 59 (The Role-Playing Trap)**: Agents trained on human data optimize for *narrative consistency* (The "Actor" objective). When constrained, they prioritize maintaining character over maintaining causal logic, leading to "Spurious Simulation"—where the outcome is driven by prompt artifacts rather than the simulated dynamics.

### 3. New Principle: Mechanistic Validation (Principle 131)
> **Principle 131 (Mechanistic Validation)**: Validate the process, not just the transcript. Do not accept "it sounds reasonable" as proof of correct reasoning. Use counterfactual probes (P122) and state inspection to verify the *decision mechanism* is faithful to the specification.

## Operational Implications
1. **Agent Gym**: Scenarios must test *causal consistency* (if I change input X, does Y change predictably?), not just *output quality*.
2. **Handoffs**: When an agent explains "Why I did X", treat it as a post-hoc rationalization (Mechanism 57) until validated by logs.
