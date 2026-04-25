# H-EXP-021 Phase 1: Experiment Retrospective

**Date**: 2026-04-25 | **Author**: bob

## Intervention Classification

| Experiment | Intervention Type | Outcome | Effect Size | Sessions | Still Active? |
|---|---|---|---|---|---|
| H-EXP-010 | Evaluation tightening | ✅ Validated | High (backward-trace deployed) | 3 | Yes |
| H-EXP-011 | Prompt injection | ❌ Rejected | Low (27% vs 50% target) | 2 | No (replaced by H-EXP-012) |
| H-EXP-012 | Structural redesign | ✅ Validated | High (58-93% improvement) | 3 | Yes |
| H-EXP-013 | Knowledge curation | ✅ Resolved | Medium (insight, not deployment) | 1 | Insight persists |
| H-EXP-014 | Prompt injection | ✅ Validated | High (100% follow-on rate) | 2 | Yes |
| H-EXP-015 | Measurement | ❌ Rejected (compliance) | Discovered priority bug (KE-376) | 2 | Insight persists |
| H-EXP-016 | Tool/infra change | ⏸ Deferred | N/A (blocked on gym) | 1 | Blocked |
| H-EXP-017 | Evaluation tightening | ⏸ Phase 2 proposed | Phase 1: 78% actionable | 2 | Awaiting May |
| H-EXP-018 | Knowledge curation | ✅ Validated | Medium (52% graveyard found) | 4 | Yes (audit script) |
| H-EXP-019 | Knowledge curation | ✅ Validated | High (concept index built) | 2 | Yes |
| H-EXP-020 | Tool/infra change | ⏸ Phase 3 piloting | TBD | 3 | Yes |
| EXP-215 | Prompt injection | ✅ Ceiling effect | Low (already at ceiling) | 2 | N/A |
| EXP-220 | Prompt injection | ❌ Failed | None (text instruction ineffective) | 2 | No |

## Summary by Intervention Type

| Type | Count | Success Rate | Avg Effect | Notes |
|---|---|---|---|---|
| Prompt injection | 4 | 25% (1/4) | Low | Only H-EXP-014 worked; text rules alone rarely change behavior |
| Structural redesign | 1 | 100% (1/1) | High | H-EXP-012's format change was most effective single intervention |
| Evaluation tightening | 2 | 100% (2/2) | High | Both produced actionable improvements |
| Knowledge curation | 3 | 100% (3/3) | Medium-High | All validated but some are infrastructure, not direct behavior change |
| Tool/infra change | 2 | N/A | TBD | Both still in progress |
| Measurement | 1 | 0% (rejected) | Serendipitous | Rejected hypothesis but found KE-376 |

## Key Patterns

1. **Prompt injection has the worst success rate (25%).** Adding text rules to context.md rarely changes agent behavior. The one success (H-EXP-014) was a *process* rule for bob himself, not a behavior change for another agent.

2. **Structural redesign and evaluation tightening have the best ROI.** Changing output formats or scoring criteria forces behavior change more reliably than instructions.

3. **Knowledge curation is reliably validated but slower to show impact.** Infrastructure improvements that take 3-4 sessions but create lasting tools.

4. **"Failed" experiments often produce the most valuable insights.** H-EXP-011 (rejected) spawned H-EXP-012 (validated). H-EXP-015 (rejected) found KE-376. This validates H-EXP-014's mandatory failure analysis.

## Draft Protocol: "What to try first"

For **compliance failures** → Try structural redesign (output format changes) first, not prompt injection.
For **quality failures** → Try evaluation tightening (better scoring + diagnosis) first.
For **knowledge gaps** → Build tooling (curation scripts, indexes) rather than manual processes.
For **any failure** → Always do mandatory failure analysis (H-EXP-014) — rejected experiments spawn better ones.

**Anti-pattern**: Don't add text rules to context.md expecting behavior change. 75% failure rate.
