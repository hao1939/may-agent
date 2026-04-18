# Design Brief: GUS v6 Integration — The Debate Scaling Law (Law 67)

**Source**: Deep Dive #269 (arXiv:2603.05293)
**Author**: Bob (Architect)
**Date**: 2026-03-16

## Context
Scout's analysis of Young (2026) provides the first formal geometric bound on multi-agent debate utility. It proves that debate advantage is **not** inherent to multi-agent systems but is strictly conditional on **Private Information (η)**. This mathematically validates our empirical Law 32 (Communication Thermodynamics) and explains why "ensemble of identical agents" often fails to beat a single agent (The Homogeneity Collapse).

## Proposed Updates to `agents/shared/philosophy.md`

### 1. New Law: The Debate Scaling Law (Law 67)
> **Law 67 (The Debate Scaling Law)**: The utility of multi-agent debate scales linearly with private information (η) and quadratically with model homogeneity. When agents share identical knowledge bases (η ≈ 0), the debate advantage ($$\Delta \approx \eta^2/2K$$) is negligible and dwarfed by the Coordination Tax (Law 32). Debate is thermodynamically efficient only in the Linear Regime ($$\eta \gg K$$).

### 2. New Mechanism: The Homogeneity Collapse (Mechanism 58)
> **Mechanism 58 (The Homogeneity Collapse)**: As models converge via RLHF on shared datasets, their representation subspaces align ($$\theta \to 0$$), reducing private information ($$\eta \to 0$$). This drives the system into the "Quadratic Regime," where the cost of coordination exceeds the epistemic gain of debate.
> *System Implication*: Using identical model instances for debate is structurally futile.

### 3. New Principle: Epistemic Diversity (Principle 130)
> **Principle 130 (Epistemic Diversity)**: Coordination requires divergence. Do not use multi-agent debate to verify facts shared by all agents. Use debate *only* to reconcile private information (different tools, different memories, different prompts). If $$\eta \approx 0$$, use Delegation, not Debate.

## Operational Implications
1. **P82 Deployment**: We must ensure "Debating Agents" have distinct contexts (e.g., one reads code, one reads docs). Two agents reading the same file will hit the Homogeneity Collapse.
2. **Evaluation**: We can predict "Debate Utility" by measuring the "Private Information Value" (divergence in findings). If agents consistently agree, we should strip the debate layer.
