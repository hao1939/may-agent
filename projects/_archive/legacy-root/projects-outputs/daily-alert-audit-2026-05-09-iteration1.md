# Daily Alert Audit — Iteration 1 (2026-05-09)

## Summary

Audited all 4 open alerts with full evidence chain. Root cause analysis shows evaluation verdicts (not session miscalibration) drive the majority of alerts. All remaining remediation depends on upstream human decision in `evaluator-low-quality-rate-calibration` project.

## Open Alerts (4 unresolved)

### 1. `scout.good-session-rate-24h` — CRITICAL
- **Alert ID**: 225
- **Current**: 0.265 (threshold: 0.65, target: 0.85)
- **Open since**: 2026-05-09T01:04:53Z (10+ hours)
- **Root cause**: Evaluator heuristic scoring assigns quality ~0.55 to sessions with `schema/query error in transcript` or `productiveCalls=0`. 100% of recent evaluations use heuristic (no LLM eval running). The heuristic labels substantive sessions as low-quality due to conservative placeholder logic.
- **Action needed**: Human decision on `evaluator-low-quality-rate-calibration` project — approve metric split (`evaluator.substantive-low-quality-rate-24h`) or choose heuristic v2 tuning path.
- **Status**: BLOCKED on upstream decision

### 2. `scout.operational-friction-rate-24h` — CRITICAL
- **Alert ID**: 197
- **Current**: 0.735 (threshold: 0.3, target: 0.1)
- **Open since**: 2026-05-08T11:43:47Z (22+ hours)
- **Root cause**: Inverse of alert #1. Sessions classified as "not good" by heuristic evaluator get counted as operational friction. Same evaluation verdict issue — heuristic conflates pipeline/guard failures with genuine agent quality problems.
- **Action needed**: Same as alert #1 — resolving evaluator calibration will directly reduce this metric.
- **Status**: BLOCKED on upstream decision

### 3. `v2.spec-coverage-rate` — MODERATE
- **Alert ID**: 255
- **Current**: 0.7727 (threshold: 0.8, target: 1.0)
- **Open since**: 2026-05-09T13:50:02Z (recent)
- **Root cause**: v2 spec measurement coverage dropped slightly below 80%. Related to `v2-spec-coverage-buildout` project which has been iterating on adding missing spec measurements.
- **Action needed**: Continue v2-spec-coverage-buildout iterations to add remaining measurements.
- **Status**: ACTIONABLE (independent of evaluator decision)

### 4. `project.blocked-count` — MODERATE
- **Alert ID**: 256
- **Current**: 5 blocked projects (threshold: 4, target: 2)
- **Open since**: 2026-05-09T14:00:02Z (recent)
- **Root cause**: Multiple projects waiting on human decisions or external dependencies. The evaluator-low-quality-rate-calibration project being blocked cascades to other projects that depend on evaluation quality.
- **Action needed**: Human triage of blocked projects; unblock evaluator calibration decision.
- **Status**: BLOCKED on human decisions

## Root Cause Analysis

**Corrected finding**: The original hypothesis was "session miscalibration" — agents producing bad sessions. Evidence shows the real issue is **evaluation verdicts**: the heuristic evaluator (100% of evals are heuristic, 0% LLM) applies conservative scoring that misclassifies substantive sessions as low-quality.

**Evidence chain**:
1. DB shows 518 evaluations in last 24h, ALL with `evaluatedByHeuristic=1`
2. 353/518 (68.15%) marked not-ideal, mostly with placeholder quality score ~0.55
3. Top NI reasons: `schema/query error in transcript`, `productiveCalls=0` — these catch pipeline artifacts, not genuine quality failures
4. LLM evaluation lane (`evaluate-session-llm`) appears non-functional or disabled

## Dependency Map

```
evaluator-low-quality-rate-calibration (BLOCKED on human decision)
  ├── scout.good-session-rate-24h (will resolve when eval fixed)
  ├── scout.operational-friction-rate-24h (will resolve when eval fixed)
  └── project.blocked-count (partially resolves)

v2-spec-coverage-buildout (ACTIONABLE independently)
  └── v2.spec-coverage-rate (will resolve with continued iterations)
```

## Recommendations

1. **P0**: Human to decide on evaluator metric split proposal (see `evaluator-low-quality-rate-calibration/outputs/iteration-5-approval-packet.md`)
2. **P1**: Investigate why LLM evaluation lane is not running — this is the root enabler for accurate quality scoring
3. **P1**: Continue v2-spec-coverage-buildout to close the 0.7727 → 0.80 gap
4. **P2**: Consider raising `project.blocked-count` threshold from 4 to 6 temporarily while evaluator decision is pending
