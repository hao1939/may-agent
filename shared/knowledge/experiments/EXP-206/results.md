# EXP-206 Results: Do Surface Metrics Mask Coordination Breakdown?

**Date**: 2026-06-28
**Status**: COMPLETE
**Hypothesis**: H-075 (Surface Metrics May Mask Coordination Breakdown)

## Summary

Retrospective audit of 16 DD-sourced KEs (KE-292 through KE-362) shows that **56% of scout→bob citations are cosmetic** (no measurable impact on decisions), **19% weakly influenced** (nudge/reinforce), and **25% strongly influenced** decisions (changed experiment design or hypothesis priority). H-075 is **CONFIRMED** at the 30% cosmetic threshold.

## Method

Sampled 16 knowledge entries created by bob from scout deep-dives (DD-800 series). For each KE, searched the entire agents/ tree for downstream references (excluding the entry itself and INDEX files). Scored each on 0-2 scale based on whether citations appeared in decision-making contexts (experiments, hypotheses, designs) vs. only in other KEs or todo lists.

## Data

| Score | Category | N | % | Examples |
|-------|----------|---|---|----------|
| 0 | Cosmetic (no influence) | 9 | 56% | KE-362 (0 refs), KE-322 (1 ref, same-batch KE only), KE-296, KE-295, KE-321, KE-331, KE-332, KE-334, KE-335 |
| 1 | Weak (nudge/reinforce) | 3 | 19% | KE-320 (cross-ref chain, no decision), KE-294 (todo only), KE-337 (2 refs, KE-only) |
| 2 | Strong (changed decision) | 4 | 25% | KE-330 → EXP-192 design + H-179, KE-293 → EXP-197 results, KE-292 → EXP-197 + priority tracker, KE-333 → H-180 + priority tracker |

## Analysis

The `findings-used` metric (currently 0.541) counts citation presence, which overstates genuine coordination quality by ~2x. Only 25% of citations represent findings that demonstrably changed a downstream decision. The remaining 75% are either cosmetic (56%) or weak reinforcement (19%).

**Pattern**: Strong-influence KEs share a trait — they introduced a **novel concept or data point** not already in bob's mental model (e.g., KE-330 introduced verbal reinforcement as a learning paradigm, leading to EXP-192). Cosmetic KEs tend to **restate patterns already implicit** in bob's context (e.g., KE-322 semantic drift — already addressed by existing monitoring patterns).

**Implication**: The metric isn't broken — it measures citation activity correctly. But citation ≠ coordination. A "decision-delta" metric would better capture whether scout's output actually shapes the system.

## Conclusion

**H-075 CONFIRMED**: 56% of "used" findings had no measurable impact on decisions, exceeding the 30% threshold. Current surface metrics mask coordination breakdown.

**However**: The 25% strong-influence rate is not zero — some scout findings genuinely change bob's direction. The problem is distinguishing signal from noise in the metric.

## Recommendations

1. **Don't change the metric yet** — it's still useful as a floor indicator (if it drops below 0.3, something is definitely wrong)
2. **Add a decision-delta tag** to KEs that directly spawn experiments or change hypotheses (e.g., `impact: decision-change` in frontmatter)
3. **Focus scout output on novelty** — findings that restate known patterns are low-value; findings that introduce new concepts or challenge existing beliefs are high-value
4. **Design EXP-210**: A/B test where bob processes scout findings with vs. without "novelty signal" annotation to see if pre-filtering improves decision impact rate

## Followups

- Write H-076: "Pre-filtering scout findings by novelty signal increases decision impact rate"
- Update H-075 status to CONFIRMED (P=0.85)
- Propose decision-delta tag to evaluator for future measurement
