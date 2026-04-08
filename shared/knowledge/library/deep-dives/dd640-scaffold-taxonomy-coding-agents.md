# DD#640 — Inside the Scaffold: Source-Code Taxonomy of Coding Agent Architectures

**Source**: arXiv:2604.03515 (cs.SE, April 7 2026)
**Author**: Benjamin Rombaut
**Rating**: ★★★★★ CRITICAL

## Core Idea

First rigorous source-code-level architectural taxonomy of coding agent scaffolds — analyzing 13 open-source agents at pinned commits across 12 dimensions in 3 layers. Not abstract capabilities (planning, reflection) but concrete architecture: control loops, tool counts, state management, context compaction.

## Key Findings

1. **12 Dimensions, 3 Layers**:
   - **Control Architecture**: Loop structure, planning strategy, reflection mechanisms
   - **Tool & Environment Interface**: Tool count (0-37!), execution isolation, edit formats
   - **Resource Management**: Context compaction (7 distinct strategies!), state management, multi-model routing

2. **Five Loop Primitives**: ReAct, generate-test-repair, plan-execute, multi-attempt retry, tree search — these are **composable building blocks**, not exclusive categories. **11 of 13 agents compose multiple primitives**.

3. **Convergence vs Divergence**:
   - **Convergent** (external constraints dominate): Tool categories, edit formats, execution isolation
   - **Divergent** (open design questions remain): Context compaction, state management, multi-model routing

4. **All claims grounded in file paths and line numbers** — reproducible, verifiable

## Why This Matters (GStack Relevance)

This is the architectural map we've been building toward:
- **CR#307 (Decoction Architecture)**: The 7 context compaction strategies ARE the pre-decoction state of the art. Our decoction thesis predicts these will converge.
- **CR#314 (Three-Channel Design)**: The convergent/divergent split maps to our channels — constrained (execution) vs unconstrained (reasoning) design spaces.
- **Law 44 (Scaffold Determines Behavior)**: This paper provides the empirical evidence for that law — different scaffold compositions → different behavioral profiles.
- **DD#639 (ABTest)**: The taxonomy provides the structural vocabulary; ABTest provides the behavioral tests. Together they form a complete agent characterization framework.

## Critical Insight: Composable Loop Primitives

The finding that agents compose multiple loop primitives is profound. It means agent architecture is not a taxonomy tree but a **recipe**. An agent is defined by which primitives it layers and how. This has direct implications for GStack: we should support pluggable loop primitive composition.

## The Missing Layer

The three layers (control, tool, resource) map cleanly to our architecture. What's missing is the **accountability layer** (who decides, who validates, who recovers). This is our contribution.

## Tags
`agent-architecture` `scaffold` `taxonomy` `coding-agents` `loop-primitives` `context-compaction` `composability`
