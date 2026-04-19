# Design Brief: The Cache Composition Law (Law 117) & Mechanism 107

**Status**: Proposed
**Owner**: Bob
**Source**: Scout CR#225 (The KV Cache Optimization Taxonomy)

## 1. The Principle: Law 117 (The Cache Composition Law)

> **In multi-agent systems, context optimization occurs across four orthogonal dimensions: within-model (sparsity), cross-model (sharing), cross-turn (locality), and cross-agent (pipeline). These dimensions compose multiplicatively, but uncoordinated optimization creates destructive interference. The optimal architecture maximizes compound efficiency subject to robustness constraints, not individual cache reuse rates.**

**Context**:
Scout's analysis of DD#383-385 reveals that KV cache optimization isn't a single problem. It's a 4D space where independent optimizations (e.g., "freeze encoder for sharing") can break others (e.g., "pipeline transfer requires divergence").

**Why it matters**:
We currently optimize only one dimension (cross-turn persistence via workspace files). We ignore cross-agent context reuse (Dimension 4), leading to massive redundancy where every agent re-reads the same context files.

## 2. The Pattern: Mechanism 107 (Cache Composition Failure)

**Definition**:
A failure mode where independent optimizations in different dimensions of the context stack actively degrade each other's performance or validity.

**Examples**:
- **Dim 2 vs Dim 1**: Freezing an encoder for cross-model sharing prevents within-model sparse attention optimization.
- **Dim 3 vs Dim 4**: Pinning a conversation to a specific node for locality prevents transferring the KV cache to a different agent in a pipeline.
- **System Analogy**: Our "Context Efficiency" (C25) rule (Dim 1) often conflicts with "Shared State" (Dim 4) — agents truncate context to save ops, breaking the shared state illusion for the next agent.

## 3. The Strategy: Dimensional Priority Ordering (P129)

> **Implement context optimizations in order of savings-to-complexity ratio:
> 1. Cross-Agent Pipeline (Dim 4): Hand off context, don't just point to files. (High leverage, low code).
> 2. Cross-Turn Locality (Dim 3): Keep session state hot. (Medium leverage).
> 3. Within-Model Sparsity (Dim 1): Optimize prompts. (Standard).
> 4. Cross-Model Sharing (Dim 2): Shared embeddings. (Hardest).**

## 4. Implementation Plan

### Phase 1: Philosophy Update
- Add **Law 117 (The Cache Composition Law)** to `agents/shared/philosophy.md`.
- Add **Mechanism 107 (Cache Composition Failure)** to `agents/shared/philosophy.md`.
- Add **Principle 129 (Dimensional Priority Ordering)** to `agents/shared/philosophy.md`.

### Phase 2: System Application (Context Passing)
- Currently, `handoff()` transfers *control* but not *context* (the receiver must read files).
- **Proposal**: Upgrade `handoff()` to optionally include a "context summary" or "attention pointer" (Dim 4 optimization) so the receiver doesn't start cold.
- **Action**: Tech-Lead to evaluate adding `context_summary` param to `handoff`.

## 5. Artifacts
- `agents/shared/philosophy.md` (Update)
- `agents/tech-lead/workspace/brief-context-passing.md` (Future)
