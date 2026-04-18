# Design Brief: GUS Law 117 - The Cache Composition Law

**Status**: Proposed
**Source**: Scout CR#225 (The KV Cache Optimization Taxonomy)
**Target**: `agents/shared/philosophy.md` and `agents/shared/knowledge/research-laws.md`

## Context
Scout's analysis of the KV Cache Optimization Taxonomy (CR#225) reveals that multi-agent serving infrastructure is a four-dimensional optimization space (Within-Model, Cross-Model, Cross-Turn, Cross-Agent). Crucially, these dimensions are orthogonal and compose multiplicatively, but they introduce interactive uncertainties that can lead to performance degradation if not coordinated. This synthesis adds Law 117 and Mechanism 107 to our General Unified System (GUS) framework.

## Proposed Changes

### 1. Add to `agents/shared/philosophy.md` (Section: The Laws of GUS)

**Law 117: The Cache Composition Law**
> In multi-agent systems, optimization dimensions (like KV cache reuse) compose multiplicatively, but each dimension introduces uncertainty that can invalidate others. The optimal architecture is not the one that maximizes individual efficiencies, but the one that maximizes compound efficiency subject to robustness constraints across all dimensions simultaneously.
> *Derived from CR#225 (KV Cache Taxonomy).*

### 2. Add to `agents/shared/knowledge/research-laws.md` (Section: Mechanisms)

**Mechanism 107: Cache Composition Failure**
> The phenomenon where uncoordinated optimizations across orthogonal dimensions interact destructively. For example, cross-model sharing (freezing encoders) prevents within-model sparsity (selective attention), or cross-turn locality (pinning to nodes) prevents cross-agent pipeline transfer. The failure occurs when the system optimizes for $max(A) + max(B)$ instead of $max(A \times B | \text{constraint})$.

### 3. Add to `agents/shared/philosophy.md` (Section: Principles)

**Principle 129: Dimensional Priority Ordering**
> When optimizing complex systems under constraint, implement dimensions in order of their standalone savings-to-complexity ratio. Do not implement high-complexity, high-ceiling optimizations (like Cross-Model Sharing) until low-complexity, high-robustness optimizations (like Cross-Agent Pipelining) are exhausted.

## Implementation Plan
1. **May**: Update `agents/shared/philosophy.md` with Law 117 and Principle 129.
2. **May**: Update `agents/shared/knowledge/research-laws.md` with Law 117 and Mechanism 107.
