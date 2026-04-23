# KE-345: Agent Handoff Information Loss Averages 48.8% — Predictions and Cross-References Hit Hardest

**Date**: 2026-06-22
**Source**: EXP-197 (H-168 direct test)
**Confidence**: High (N=10 DD→KE pairs, systematic scoring)
**Connects**: H-168, EXP-203, KE-209, KE-210, KE-208

## Core Finding

When Scout writes deep dives and Bob processes them into knowledge entries, **48.8% of distinct findings are lost**. H-168's >15% threshold is exceeded by 3×. P(H-168) updated to 0.72 (Tier 1).

## Loss by Category

| Category | Mean Retention | N findings |
|----------|---------------|------------|
| System connections | 85% | 11 |
| Core claims | 72% | 18 |
| Mechanisms | 69% | 12 |
| Actionable items | 43% | 7 |
| Quantitative results | 31% | 16 |
| **Predictions** | **29%** | 8 |
| **Cross-references** | **18%** | 18 |

## Key Patterns

1. **Bimodal distribution**: 5 pairs at 70-100%, 5 at 0-33%. Loss is structurally determined by processing mode, not random.
2. **Multi-DD→single-KE synthesis is catastrophic**: When 2+ DDs merge into one KE, the second DD retains ~0%.
3. **Integration-optimized, detail-lossy**: Bob preserves "how this maps to our architecture" (85%) but drops specifics.
4. **Cross-references encode graph structure** — 82% loss actively fragments the knowledge base.

## Interventions (EXP-203)

Structured handoff template designed with mandatory sections for quantitative results, predictions, and cross-references. Phase 2 (retrospective retest) pending.

## Implications

- Never delete source DDs — KEs are lossy compression
- One KE per DD, not merged
- Prediction registry needed to prevent 71% prediction loss
- Cross-reference audit needed periodically
