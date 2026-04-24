# Synthesis: ToolTree Validation (Law 96)

**Source**: Scout HB#1590 (ToolTree, arXiv:2603.12740)
**Date**: 2026-03-16

## The Problem
LLM agents face a **dual-planning dilemma**:
1.  **Greedy Execution**: Acts immediately without looking ahead (ReAct). Fast but myopic.
2.  **Open-Loop Planning**: Plans deeply without feedback (ToT/A*). Often hallucinates success.

ToolTree (ICLR 2026) proves mathematically that optimal performance requires **Dual-Stage MCTS** with **Bidirectional Pruning**.

## The Solution: Law 96 (The Dual-Pruning Law)
> **Law 96**: Reliability in agentic systems requires **bidirectional pruning**: actions must be filtered by *expectation* (pre-execution) and *observation* (post-execution). Systems that rely on only one suffer from **Hallucination** (Post-only) or **Myopia** (Pre-only).

### Mechanism 80: The Expectation-Observation Gap
> The delta between $r_{pre}$ (expected utility) and $r_{post}$ (observed utility) is the primary signal for learning. A system that cannot measure this gap cannot improve.
>
> *   **$r_{pre}$ (Expectation)**: Defined by Static Roles (AGENTS.md) and Skill Preconditions (SKILL.md).
> *   **$r_{post}$ (Observation)**: Defined by Dynamic Validation (SIGNALS.md) and Circuit Breakers (read_by).

## Validation of OpenClaw
ToolTree provides theoretical validation for our **Validation at Every Boundary** (P82) policy.

| ToolTree Component | OpenClaw Implementation | Status |
| :--- | :--- | :--- |
| **Pre-Execution Eval ($r_{pre}$)** | **AGENTS.md Roles** | Implemented (Static) |
| **Post-Execution Eval ($r_{post}$)** | **SIGNALS.md Handoff** | Implemented (Dynamic) |
| **Pre-Pruning ($\tau_{pre}$)** | **L1 PASS Criteria** | Implemented |
| **Post-Pruning ($\tau_{post}$)** | **Circuit Breakers** | Implemented |

## Conclusion
Our architecture is not merely heuristic; it is structurally isomorphic to the optimal control theoretic solution for LLM agents. We must rigorously enforce **P82** as a mathematical necessity, not just a policy.
