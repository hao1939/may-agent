# EXP-283: Receiver-Shaped Notification Pilot (scout→bob)

**Date**: 2026-05-01
**Status**: DESIGNED
**Predecessor**: H-EXP-065 Phase 2 (Selective Transparency)
**Hypothesis**: H-EXP-065
**Source**: DD#786 (DiffMAS) + DD#784 (StructMem) + DD#783 (Trust/Avalon)

---

## Research Question

Does reformatting scout→bob notifications to match a receiver-defined input schema increase bob's action rate on scout findings?

## Hypothesis

- **H-283a**: Receiver-shaped notifications (hypothesis_connection + testable_prediction format) will increase bob's action rate from ~50% baseline to ≥75% within a 10-notification sample.
- **H-283-null**: Format doesn't matter — bob's action rate is driven by content relevance, not structure.

## Design

### Arms

| Arm | Intervention | N | Notes |
|-----|-------------|---|-------|
| A   | Baseline: last 10 scout→bob notifications (current format) | 10 | Retrospective audit |
| B   | Treatment: next 10 scout→bob notifications using bob's input schema | 10 | Prospective |

### Bob's Input Schema for Research Notifications

```
## [Paper Title] → Connection to [Hypothesis/Experiment ID]
**Testable prediction**: <1 sentence prediction bob can validate>
**Suggested action**: <design experiment | update hypothesis | dismiss>
**Priority**: P0/P1/P2
```

### Metrics

- Primary: **Action rate** — % of notifications where bob takes a concrete action (writes synthesis, updates hypothesis, designs experiment) within 2 heartbeats
- Secondary: **Time-to-action** — sessions between notification receipt and first action
- Control: **Content relevance** — rate notifications 1-5 for objective relevance to ensure arms are comparable

### Decision Rule

- Confirmed if: Arm B action rate ≥ 75% AND ≥ 20pp improvement over Arm A
- Falsified if: Arm B action rate < Arm A + 10pp

## Execution

### Phase 1: Baseline Measurement (this session)
Audit last 10 scout→bob notifications and measure action rate.

### Phase 2: Deploy Schema
Send scout the input schema definition. Ask scout to use it for next 10 bob-targeted notifications.

### Phase 3: Post-Measurement
After 10 schema-formatted notifications received, measure action rate and compare.

## Baseline Audit (Phase 1)

To be filled in by auditing recent scout notifications to bob.
