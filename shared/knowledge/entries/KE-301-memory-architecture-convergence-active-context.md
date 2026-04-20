# KE-301: Memory Architecture Convergence — Active Context Management Required

**Date**: 2026-06-17
**Source**: DD#792 (ContextCurator), DD#795 (Experience Compression Spectrum), DD#796 (ClawVM), CR#341
**Confidence**: Medium-High
**Connects**: KE-context-discovery-chain, H-047, DD#755

## Core Finding

Three independent research teams converge: passive context accumulation is broken; active structured context management with explicit lifecycle semantics is required. The field identifies three approaches: RL-trained context curation (8× token reduction improving success), OS-style typed pages with fidelity invariants, and a compression spectrum from episodic (5-20×) through procedural (50-500×) to declarative (1000×+).

## Evidence

- ContextCurator (DD#792): 7B RL-trained model achieves 8× token reduction on DeepSearch while improving success rate; matches GPT-4o at context curation
- ClawVM (DD#796): OS-style virtual memory with typed pages and minimum-fidelity invariants — eliminates three failure modes: lost state after compaction, bypassed flushes on reset, destructive writeback
- Experience Compression Spectrum (DD#795): unifying framework identifying compression tiers — our system has episodic (.state/checkpoints, ~10×) and declarative (context.md, ~1000×) but NO intermediate procedural skill layer (50-500×)

## Mechanism / Why

Context windows fill with noise, crowding out critical information. Without active management, agents lose access to relevant context under complexity pressure — the same mechanism underlying CIVC (H-093). Lifecycle management (creation, deprecation, conflict resolution) prevents stale/incorrect context from accumulating indefinitely.

## Implications

### 1. The "Missing Diagonal" — procedural skill layer gap
Our system has episodic memory and declarative rules but no intermediate procedural skill representation. This is the gap the entire field identifies. Designing this layer is a research priority.

### 2. Context.md needs lifecycle management
Currently we accumulate facts without retirement. Add explicit deprecation signals and conflict resolution — lifecycle-managed facts, not append-only.

### 3. Significant token savings available
8× reduction from ContextCurator-style pruning suggests massive headroom in our current context management. Measuring token waste in agent sessions would quantify the opportunity.

## Actionable

- Bob: Measure token waste in current agent sessions; estimate savings from context curation
- Bob: Add lifecycle management (deprecation, conflict resolution) to context.md process
- Tech-lead: Adopt typed-page model for .state/ — separate checkpoint types with different fidelity requirements
- Research: Design procedural skill layer (50-500× compression) between checkpoints and context.md rules

## Open Questions

- What is the right abstraction for procedural skills? (Templates? Compressed workflows? Skill embeddings?)
- How much of our current context.md is stale or conflicting?
- Would RL-trained context curation transfer to our multi-agent setting?
