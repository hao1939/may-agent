# KE-383: Concept-Index Retrieval Surfaces Relevant Knowledge That Flat Context Misses

**Source**: H-EXP-019 Phase 2 (2026-08-23)
**Validated by**: Retrieval comparison on 2 low-scoring sessions

## Finding

Agent context.md files cite 4-5 high-level KEs (e.g., KE-002, KE-123). These are correct but too abstract to prevent specific failure modes. When agents fail, the relevant KEs exist in the knowledge base but are never surfaced because there's no semantic routing from failure-type to specific knowledge.

A concept index (14 categories, ~450 KEs) acts as a semantic routing layer. For two "needs_improvement" sessions:
- Baseline (context.md): 0 relevant KEs surfaced for either session
- Concept-index: 8 relevant KEs surfaced (4 per session), including directly actionable ones (KE-093 on verification confabulation, KE-207 on tool illusion)

## Implication

The "knowledge graveyard" problem (52% of KEs never cited, per H-EXP-018) is partially a **retrieval routing problem**, not just a volume problem. Adding more KEs without a routing mechanism makes the problem worse. The concept index at `agents/shared/knowledge/concept-index.md` is the minimum viable routing layer.

## Limitation

Category-level precision is ~9% (4 relevant out of 44 in a category). Sub-category tags or failure-type annotations would improve precision significantly.

## Next Step

Integrate concept-index lookup into coaching/evaluator feedback loops so agents receive specific KE citations when they fail, not just generic advice.
