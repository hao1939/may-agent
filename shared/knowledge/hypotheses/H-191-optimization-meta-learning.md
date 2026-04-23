# H-191: Optimization Meta-Learning — Tracking Intervention Outcomes

**Created**: 2026-04-23 by Bob
**Status**: proposed
**Confidence**: ★★★☆ (strong theoretical backing from TPGO)
**Source**: DD#777 (TPGO: arXiv 2604.20714) — GRAO meta-learning concept
**Connects**: KE-123 (don't stack interventions), EXP-212/213 (schema context), H-EXP-014 (failure analysis)

---

## Claim

Tracking which KE interventions worked for which failure types (optimization metadata) will improve future intervention success rate by enabling pattern-based selection instead of ad-hoc design.

## Mechanism

Currently, when we identify a failure (e.g., C1.1 violations), we design an intervention ad-hoc (context edit, guard, workflow change). We don't systematically record: what type of failure, what type of intervention, what was the outcome. TPGO's GRAO insight: a meta-optimizer that learns from past (intervention → outcome) pairs becomes progressively better at proposing updates.

If we build a structured log of (failure_type, intervention_type, metric_before, metric_after, confirmed?), we can:
1. See which intervention *types* work for which failure *types*
2. Avoid repeating failed approaches (e.g., "text rules don't fix judgment failures" is KE-002, but we keep rediscovering it)
3. Provide this log to bob/coach as context for designing future interventions

## Evidence

### Supporting
- TPGO (DD#777): GRAO meta-learning improves optimization quality over time by learning from history
- KE-002 was rediscovered multiple times before being formalized — meta-tracking would have caught this earlier
- EXP-212 → EXP-213 replication: schema context worked for tech-lead, we're now trying it for bob. This *is* pattern-based selection, but informal.

### Against / missing
- Small sample: we have ~213 experiments but many are measurement-only, not interventions
- The meta-learning might not have enough signal — many confounds in production

## Predictions

| Condition | Predicted outcome |
|-----------|-------------------|
| Build intervention-outcome log | Identify ≥3 failure-type / intervention-type patterns |
| Use log to guide next 5 interventions | ≥3/5 succeed (vs historical ~50% rate) |
| Don't build log | Continue ad-hoc design, same success rate |

## Test Plan

- **Phase 1**: Retrospective — catalog last 20 interventions with (failure_type, intervention_type, outcome). Look for patterns.
- **Phase 2**: Prospective — use patterns to guide next 5 intervention designs. Compare success rate.
- **Decision rule**: confirmed if pattern-guided interventions succeed at >60% vs baseline ~50%.

## Implications if true

- Add `intervention_metadata` table to may.db or structured log
- Bob's intervention design process includes "check what worked before for this failure type"
- Eventually: automated recommendation ("for C1.x violations, schema reorganization works 80% of the time")

## Links

- Parent: DD#777 (TPGO)
- Related: KE-123, KE-002, H-EXP-014
