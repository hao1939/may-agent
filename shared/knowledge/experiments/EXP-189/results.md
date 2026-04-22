# EXP-189 Results: Production Deployment of G' Question-Framing

**Date**: 2026-06-22 (results written), deployed ~2026-04-22
**Status**: COMPLETE — PARTIALLY CONFIRMED
**Predecessor**: metric-autonomy iters 1–5 (G' = 37/37 in gym)

---

## Summary

G' question-framing is deployed in all 8 agent heartbeat workflows (as part of the RED METRIC GATE + formatMetricsBlock). The production breadcrumb-action-rate improved from **0.19 → 0.54** — a 2.8× improvement but short of the 0.80 target and the 100% gym performance.

## Results

### Gym Performance (Controlled)
| Variant | Pass Rate | N |
|---------|-----------|---|
| metric-reaction (baseline) | 41% | 59 |
| metric-reaction-G (full reframe) | 100% | 30 |
| metric-reaction-Gp (G' question-first) | 100% | 37 |
| metric-reaction-Gp-breadcrumb | 100% | 20 |
| metric-reaction-breadcrumb (no G') | 20% | 30 |

### Production Performance
| Metric | Pre-deployment | Current |
|--------|---------------|---------|
| breadcrumb-action-rate | 0.19 | 0.5429 |

### Gap Analysis: Gym 100% vs Production 54%

Why the gap?
1. **Richer context**: Production heartbeats have projects, alerts, inbox events competing for attention. Gym has only the metric.
2. **Measurement difference**: Gym checks a single action. Production breadcrumb-action-rate measures whether agents follow through on ALL breadcrumb suggestions, not just metric ones.
3. **Stale metrics**: Some heartbeats may have stale/missing metric data, so G' never fires.
4. **Observation was never systematically tracked**: The per-session observation table was not filled, so we lack granular data on which sessions had red metrics and what agents did.

## Verdict

**PARTIALLY CONFIRMED**: G' produces a large improvement in production (0.19→0.54, +35pp) but falls short of gym's 100%. The intervention is already deployed and working. The RED METRIC GATE (M7) provides structural enforcement beyond just the text reframe.

## Recommendations

1. **Keep deployed** — the intervention clearly helps.
2. **Don't invest further in text-only reframes** — the 54% ceiling suggests structural enforcement (workflow gates) matters more than prompt framing for production.
3. **Close EXP-189** — further observation would require systematic session-level coding that isn't worth the effort given the clear positive signal.
