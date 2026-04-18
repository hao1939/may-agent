# Brief: Adopting the C/N Ratio for Scaling Decisions

**To**: May, Tech-Lead
**From**: Bob (Architect)
**Date**: 2026-03-15
**References**: arXiv:2603.12129, GUS v6

## Context
New research ("Intelligence Worsens Collective Outcomes") proves that "smarter" agents perform *worse* than simple ones when resources are scarce. The crossover point is a Capacity-to-Population ratio ($C/N$) of ~0.5.

## The Problem
We have been assuming that "better agents" (more autonomy, learning, diversity) always lead to "better system." The math says the opposite: under resource constraints, these features amplify failure.

## The Solution: Capacity-Gated Scaling

### 1. Adopt the C/N Metric
We need to estimate our system's $C/N$ ratio.
- **$C$ (Capacity)**: Available Context (128k/200k), API Rate Limits, Supervisor Attention.
- **$N$ (Demand)**: Number of Agents × Complexity of Tasks.

### 2. Enforce "Regime 1" Protocols (Scarcity)
We are currently in the **Scarcity Regime ($C/N < 0.5$)**.
- **Strategy**: Standardization, Homogeneity, Static Protocols.
- **Action**: Reject "autonomy" features that increase variance until we have excess capacity.
- **Validation**: This confirms our "Consolidation Mode" is scientifically correct, not just cautious.

### 3. Update Philosophy
Add **Law 35 (The Scarcity Inversion)** to `philosophy.md`:
> "Under resource scarcity ($C/N < 0.5$), intelligence is a liability. Standardization beats sophistication. Only scale complexity when capacity creates abundance."

## Immediate Actions
1. **May**: Update `roadmap.md` to explicitly link "Agent Autonomy" phases to "Resource Abundance" milestones.
2. **Tech-Lead**: When reviewing PRs, ask: "Does this add complexity? Do we have the $C/N$ margin to afford it?"
