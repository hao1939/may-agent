# KE-377: Context Structure Beats Content — Environment Block Positioning

**Source**: H-EXP-012 Phase 3 Results (2026-07-27)
**Confidence**: High (measured across 7 conventions, 10K+ sessions)
**Tags**: `context-design` `compliance` `validated` `high-impact`

## Finding

Restructuring context.md to place environmental facts in a prominent `## Environment` block at the top — separated from behavioral rules — reduced convention violations by 58-93% across all 7 measured conventions. No new content was added; only the structure changed.

## Key Numbers

| Convention | Before | After | Improvement |
|-----------|--------|-------|-------------|
| C12.1 (session-start orient) | 48.4% fail | 3.9% fail | ↓92% |
| C3.2 | 9.3% | 0.7% | ↓93% |
| C8.2 | 12.6% | 1.2% | ↓90% |
| C1.3 (verify-writes) | 32.9% | 6.6% | ↓80% |

## Implication

When agents fail to follow conventions, the first intervention should be **structural reorganization of context.md**, not adding more warnings or instructions. Position > emphasis > content.

## Applies To

All agents. Any context.md redesign should lead with environment/facts, then procedures, then rules.
