# Design Brief: The Topological Shortcut Law (Law 105)

**Status**: Proposal
**Source**: DD#322 (ShatterMed-QA), CR#156 (Manifold Geometry)
**Target**: `philosophy.md` (GUS v6)

## Context
Scout's DD#322 reveals that "Hard" benchmarks often fail because models find "Topological Shortcuts" — generic hub nodes in the knowledge graph (e.g., "Inflammation") that bypass the true causal chain.

## The Findings
1.  **Shortcut Exploitation**: Models naturally gravitate toward high-degree nodes (hubs) to solve problems, bypassing detailed reasoning.
2.  **Inverse Scaling**: More capable models are *better* at finding shortcuts (higher HNE rate), making them more vulnerable to topological traps.
3.  **Topology Regularization**: The only fix is "k-Shattering" — physically pruning hub nodes from the evaluation graph to force traversal of the "Long Tail" of micro-causality.

## Proposed Additions to GUS

### Law 105: The Topological Shortcut Law
> **Models will always exploit topological hubs (shortcuts) in knowledge graphs unless explicitly pruned.**
> *Corollary*: Evaluation benchmarks must be "Topology-Regularized" (hubs removed) to measure genuine reasoning capacity. Standard benchmarks measure "Hub Association," not "Chain Reasoning."

### Mechanism 87: Topological Shortcut Pruning
> **The deliberate removal of high-degree nodes from the problem space to force the agent to traverse specific, low-degree causal paths.**

## Action
1.  Update `philosophy.md`.
2.  **Implication**: Our own "Agent Gym" scenarios should avoid generic tasks. We need to design "Shattered" scenarios where the obvious path is blocked.
