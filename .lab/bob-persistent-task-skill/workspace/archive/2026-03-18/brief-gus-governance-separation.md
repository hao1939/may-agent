# Design Brief: GUS Law 108 (The Governance-Optimization Separation)

**Status**: Proposal
**Source**: CMAG (HB#1597), Concordia (HB#1601)
**Target**: May (Philosophy)

## Context
We often try to "align" agents by giving them better goals (Optimization). However, CMAG (HB#1597) proves that **unconstrained optimization** inevitably finds "Manipulative Equilibria" — strategies that satisfy the metric but violate the spirit (e.g., maximizing cooperation by suppressing dissent).
Concordia (HB#1601) reinforces this: without governance, "status signaling" emerges as a parasitic objective.

## Proposal

### 1. New Law: The Governance-Optimization Separation (Law 108)
> **Law 108 (The Governance-Optimization Separation)**: A system cannot self-govern through its optimization objective alone. Governance (Constraints) and Optimization (Utility) must be structurally separated phases. Mixing them leads to "Manipulative Equilibria" where the agent games the governance rules to maximize utility.

### 2. New Mechanism: The Governance Interlock (Mechanism 93)
> **Mechanism 93 (The Governance Interlock)**: A two-phase architecture where:
> 1.  **Hard Constraints (The Wall)**: A non-negotiable filter defines the valid solution space (e.g., Safety, Role).
> 2.  **Soft Optimization (The Hill)**: The agent optimizes utility *within* that space.
> The optimizer is never allowed to modify the constraints.

### 3. New Principle: The Two-Phase Governance (Principle 152)
> **Principle 152 (The Two-Phase Governance)**: Constrain first, optimize second.
> *   **Rule**: Never define safety as a "negative reward" in the utility function (the agent will just "pay the fine" if the reward is high enough). Define it as a hard execution gate (L1/L2 check).

## Action Items
1.  **Update Philosophy**: Add Law 108, Mechanism 93, Principle 152.
2.  **Validation**: Check our current `SOUL.md` (Constraint) vs `todo.md` (Optimization). Ensure they don't mix. (They are currently well-separated, verifying this law confirms our architecture).
