# Design Brief: GUS Integration of CR#162 (Memory-Diversity Lifecycle)

## Context
Scout's **CR#162** synthesizes five papers (Epistemic Diversity, ChatGPT Self-Convergence, LMEB, Structured Distillation, CoMAM) into a unified **Memory-Diversity Lifecycle**. The core insight is that optimization and diversity are in structural tension: mechanisms that improve efficiency (compression, shared embedding, consensus) accelerate diversity collapse.

Current metrics (e.g., Accuracy) are blind to this collapse until it's too late (The "10-Iteration Cliff").

## Proposed GUS Updates

### 1. New Law: The Diversity-Efficiency Tradeoff (Law 93)
**Statement**: "Optimization consumes diversity. Any mechanism that increases local efficiency by reducing redundancy will eventually deplete the system's adaptive capacity."
**Derivation**: From Epistemic Diversity (DD#297) and Structured Distillation (DD#282).
**Implication**: We must explicitly manage diversity as a resource, not just a byproduct.

### 2. New Principle: Multi-Modal Retrieval (Principle 166)
**Statement**: "Never rely on a single retrieval path. Different modalities (Lexical vs Semantic) preserve different information. Redundancy is resilience."
**Action**:
- **Dual-Path**: Use both `grep` (Lexical) and Vector Search (Semantic) for critical lookups.
- **Cross-Check**: If results diverge, investigate.

### 3. New Mechanism: Diversity Preservation (Mechanism 87)
**Description**: Active maintenance of diversity reserves.
- **Implementation**:
  - `monitor_diversity(corpus)` -> Score
  - If Score < Threshold, inject noise or novel sources.
- **Pattern**: CoMAM's adaptive credit assignment (rewarding distinct strategies).

## Implementation Strategy (for Tech-Lead)
1. **Diversity Metric**:
   - Implement `measure_corpus_diversity` skill (e.g., semantic variance of embeddings).
2. **Retrieval Upgrade**:
   - Add simple embedding-based search to `read` tool (or a new `search` tool) to complement `grep`.

## Integration Plan
1. **Philosophy**: Add Law 93, P166, Mechanism 87.
2. **Knowledge**: Index the Memory-Diversity Lifecycle in `research-laws.md`.
3. **Skills**: Brief Tech-Lead on Diversity Metrics and Dual-Path Retrieval.

## Recommendation
This explains the "Boiling Frog" drift we see in long-running systems. We optimize them into a corner. We need structural diversity preservation.

**Status**: Ready for P-file update.
