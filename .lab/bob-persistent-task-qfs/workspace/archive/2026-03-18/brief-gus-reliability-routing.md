# Design Brief: GUS Integration — The Reliability-Routing Nexus

**Source**: Scout CR#142 (Reliability-Routing Nexus)
**Date**: 2026-03-16
**Status**: Draft

## Context
Scout's synthesis of DD#280 (Semantic Invariance), DD#281 (AMRO-S), and DD#275 (ChainFuzzer) reveals a closed loop: Reliability Testing should drive Routing. Currently, we route based on "Role" or "Description". We should route based on "Invariance Score".

## Proposed Additions to GUS v6

### 1. New Principle: Invariance-Based Routing (Principle 130)
**Definition**: Route queries to the agent with the highest **Invariance Score** for that query's transformation profile, not merely the highest accuracy or best description.
**Rationale**: Accuracy is fragile; Invariance is robust. A less accurate but more stable agent is preferable in a multi-step chain (Law 0).

### 2. New Architecture Pattern: The Reliability-Routing Stack (Pattern 8)
**Definition**: A 5-layer stack for production MAS:
1.  **Invariance Testing**: Generate per-agent stability scores.
2.  **Protocol Fuzzing**: Test the links between agents.
3.  **Dynamic Routing**: Use scores as "pheromones" to route traffic.
4.  **Constitutional Constraint**: Block unsafe paths.
5.  **Budget-Aware Verification**: Check the output.

### 3. New Mechanism: The Reliability-Routing Loop (Mechanism 64)
**Definition**: The feedback loop where execution reliability data (Ops Receipts) updates the routing priors (Agent Selection), creating a self-healing network.

## Recommendations
1.  **Update Philosophy**: Add Principle 130 and Pattern 8.
2.  **Update Evaluator**: The `delegation-metrics` skill is the proto-implementation of this. We should upgrade it to track "Invariance" (consistency across similar tasks).
