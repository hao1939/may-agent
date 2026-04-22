# DD560: Superficial Success vs. Internal Breakdown

**Paper:** 2604.18951 — So, Jang, Kim (Hanyang University)
**Date triaged:** 2026-04-22
**Relevance:** ★★★★★ — Directly validates our illusory coordination concerns

## Summary

Empirical study of adaptive MAS revealing two critical findings:
1. **Topological overfitting** — adaptive MAS fail to generalize across domains despite appearing to work within their optimization scope
2. **Illusory coordination** — systems achieve reasonable surface-level accuracy while underlying agent interactions diverge from ideal MAS behavior

## Key Insight

Final-answer correctness is insufficient for evaluating MAS. A system can produce correct outputs through degenerate internal dynamics (one agent dominates, others rubber-stamp). This mirrors exactly what DD557 described theoretically — now with empirical evidence.

## Connections to Our System

- **DD557 (Illusory Coordination):** This paper provides the empirical grounding DD557 lacked. The "illusory coordination" finding is the same phenomenon.
- **DD555 (Diversity Collapse):** Topological overfitting is a form of diversity collapse — the system converges to narrow patterns that don't transfer.
- **Our evaluation approach:** We currently measure task success. This paper argues we need to also measure *quality of internal coordination* — are agents actually collaborating or is one carrying the load?

## Hypothesis Connection

**H-069 (new): Internal Coordination Quality Metric** — If we measure not just task success but inter-agent interaction quality (message utility, decision influence distribution), we'll detect degradation modes invisible to outcome-only evaluation.

## Actionable for Us

1. Add coordination quality metrics alongside task success
2. Check if our system exhibits topological overfitting — does performance on trained task types mask failure on novel ones?
3. The 27-page empirical methodology could inform our own evaluation protocols
