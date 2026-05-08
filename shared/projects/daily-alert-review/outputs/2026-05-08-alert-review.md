# Daily Alert Review — 2026-05-08

**Period:** 2026-05-08 04:12 – 18:05 UTC  
**Total alerts:** 30  
**Unresolved:** 4  

## Summary by Metric

| Metric | Alerts | Still Open? | Severity |
|--------|--------|-------------|----------|
| project.invalid-format-count | 10 | No (recurring, self-resolving) | Low |
| scout.good-session-rate-24h | 5 | **Yes** (0.46, threshold 0.65) | High |
| evaluator.low-quality-rate-24h | 3 | **Yes** (0.51, threshold 0.30) | High |
| metric.stale-active-count | 3 | No | Low |
| scout.operational-friction-rate-24h | 1 | **Yes** (0.54, threshold 0.30) | High |
| evaluator.false-good-rate-sample | 1 | **Yes** (0.67, threshold 0.20) | High |
| evaluator.triage-closure-rate-24h | 1 | No | Medium |
| evaluator.meaningful-review-rate-24h | 1 | No | Medium |
| session.failed-triage-rate-3h | 1 | No | Medium |
| capability.process-uptime-h | 2 | No | Low |
| capability.self-directed-iteration-rate-24h | 1 | No | Medium |
| v2.spec-coverage-rate | 1 | No | Medium |

## Critical Open Issues

### 1. Scout Good Session Rate — 0.46 (target: 0.85)
- Fired 5 times today; resolved briefly but dropped again
- Currently far below threshold (0.65) and target (0.85)
- **Action needed:** Investigate root causes of poor sessions

### 2. Evaluator Low Quality Rate — 0.51 (target: 0.10)
- Over half of evaluated sessions rated needs-improvement
- Correlated with scout good-session-rate decline
- **Action needed:** Review common failure patterns in recent evaluations

### 3. Scout Operational Friction Rate — 0.54 (target: 0.10)
- Over half of sessions hitting operational friction
- Unresolved since 08:03 UTC
- **Action needed:** Identify friction sources (tooling? context? permissions?)

### 4. Evaluator False Good Rate — 0.67 (target: 0.05)
- 2/3 of reviewed "good" sessions were overturned
- Newest alert (18:05), not yet resolved
- **Action needed:** Evaluator calibration may need tuning

## Recurring Low-Priority Patterns

- **project.invalid-format-count**: 10 alerts, all self-resolved within ~15-30 min. Likely transient format violations during project edits. Not urgent but could benefit from preventive validation.
- **metric.stale-active-count**: Spikes around process restarts. All resolved.

## Recommendations

1. **P0:** Address scout quality/friction — the operational friction rate (54%) is likely causing the poor session quality (46% good). A single root-cause fix could resolve both.
2. **P1:** Recalibrate evaluator — false-good-rate at 67% suggests evaluator is too lenient, then reviews overturn. Tighten scoring criteria.
3. **P2:** Add pre-commit validation for project.md format to prevent recurring noise alerts.
