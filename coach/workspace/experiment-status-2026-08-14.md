# Experiment Status Dashboard — 2026-08-14

## Summary
- **Open experiments**: 5 (4 blocked on evaluator, 1 monitoring)
- **Evaluator status**: DEAD since Apr 30 (105+ days). Re-escalated to may (P0).
- **Actionable now**: 0 measurement tasks possible without evaluator
- **Gym-testable**: EXP-285 (PATH_HALLUCINATION guard effectiveness)

## Open Experiments

| ID | Name | Status | Blocker |
|----|------|--------|---------|
| EXP-300 | Session-Awareness Guard | Deployed, awaiting measurement | Evaluator dead |
| EXP-305 | Pre-Finish Gate | Deployed, awaiting measurement | Evaluator dead |
| EXP-285 | PATH_HALLUCINATION Guard | Phase 1 done, need fresh data | Evaluator dead |
| EXP-250 | Amy Path-Orientation | Needs lab fork recreation | Evaluator dead + lab setup |
| EXP-325 | Self-Scoring Checklist | DEPLOYED 2026-08-14 | Monitoring 10 sessions |

## Closed Recently (Aug 2026)

| ID | Name | Result | Impact |
|----|------|--------|--------|
| EXP-290 | Bob Anti-Shallow | ✅ POSITIVE | +32pp quality (0.349→0.671) |
| EXP-280 | Verify-After-Edit | ❌ NEGATIVE | No change from text skill |
| EXP-275 | Optimizer Quality | BASELINE-REVISED | Already above target |
| EXP-270 | Anti-Shallow Sessions | ✅ POSITIVE (directional) | Shallow rate eliminated |

## Key Insight: Text Coaching Ceiling (KE-338)
All remaining improvements require STRUCTURAL interventions (workflow gates, bash guards, pre-command checks). Text-only skills have hit ceiling for:
- PATH_HALLUCINATION (EXP-251 confirmed)
- verify-after-edit (EXP-280 confirmed)
- partial-verification-trap (EXP-265 confirmed)

## Next Actions When Evaluator Revives
1. Measure EXP-300 ghost completion rate (need 5+ sessions per target agent)
2. Measure EXP-305 pre-finish gate compliance
3. Measure EXP-285 PATH_HALLUCINATION trend
4. Fresh quality scorecard for all agents

## Recommendation
- **P0**: Continue escalating evaluator revival to may
- **P1**: Run gym-based experiments that don't need evaluator (PATH_HALLUCINATION scenarios)
- **P2**: Design next structural intervention for verify-after-edit (workflow-level forced read step)
