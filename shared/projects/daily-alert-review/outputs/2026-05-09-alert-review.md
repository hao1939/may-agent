# Daily Alert Review — 2026-05-09

**Period:** Last 24 hours  
**Total alerts:** 244  
**Unique metrics alerted:** 30  
**Currently unresolved:** 4 alerts across 4 metrics

---

## 🔴 Unresolved Alerts (Action Required)

| Metric | Message | Since |
|--------|---------|-------|
| `scout.good-session-rate-24h` | Rate 25.4% (threshold: 65%, target: 85%) | ~6h ago |
| `scout.operational-friction-rate-24h` | Rate 74.6% (threshold: 30%, target: 10%) | ~25h ago |
| `v2.spec-coverage-rate` | Coverage 54.5% (threshold: 80%, target: 100%) | ~1h ago |
| `v2.heartbeat-decision-rate` | Rate 0% (threshold: 80%, target: 100%) | ~30min ago |

### Analysis

1. **Scout quality is critically low.** Good session rate at 25% is less than half the 65% threshold. Combined with 75% operational friction, this indicates systemic session quality problems — not transient noise.

2. **v2 spec coverage** has improved (was 27%, now 55%) but still well below 80% threshold. Incremental progress.

3. **Heartbeat decision rate** at 0% is a new alert — may indicate a measurement or deployment issue.

---

## 📊 Top Alert Sources (by frequency)

| Metric | Count | Status |
|--------|-------|--------|
| `system.real-output-24h` | 61 | ✅ Resolved |
| `handler.completed-count` | 61 | ✅ Resolved |
| `project.invalid-format-count` | 24 | ✅ Resolved |
| `project.iterations-24h` | 22 | ✅ Resolved |
| `session.failed-triage-rate-3h` | 11 | ✅ Resolved |
| `project.active-count` | 10 | ✅ Resolved |
| `metric.stale-active-count` | 8 | ✅ Resolved |
| `capability.status-reality-mismatch-count` | 7 | ✅ Resolved |
| `scout.good-session-rate-24h` | 6 | ⚠️ 1 unresolved |

---

## 🔁 Noisy/Flapping Metrics

These metrics fired repeatedly and self-resolved, suggesting thresholds are too tight or the system oscillates around the boundary:

- **`system.real-output-24h`** — 61 alerts, all resolved. Constant churn.
- **`handler.completed-count`** — 61 alerts, all resolved. Same pattern.
- **`project.invalid-format-count`** — 24 alerts. Format issues keep appearing and getting fixed.
- **`project.iterations-24h`** — 22 alerts. Frequent threshold crossings.

**Recommendation:** Consider adding hysteresis/cooldown to these metrics or widening thresholds to reduce alert fatigue.

---

## 🟡 Notable Resolved Alerts

- **`evaluator.false-good-rate-sample`** — Hit 60% (threshold 20%). Evaluator was marking sessions as good that were later overturned. Resolved after ~12h.
- **`evaluator.low-quality-rate-24h`** — 67.6% low-quality sessions (threshold 30%). Resolved.
- **`capability.status-reality-mismatch-count`** — Peaked at 28 mismatches (threshold 3). Resolved.
- **`session.zero-op-error-count-1h`** — 42 zero-op errors in one hour. Resolved quickly.
- **`eval.llm-coverage-lag-h`** — 66h lag before resolution. LLM evals were significantly behind.

---

## Summary

The system is **operationally noisy** — 244 alerts in 24h is excessive. Two structural issues dominate:

1. **Scout session quality** is the most concerning unresolved problem (25% good rate, 75% friction).
2. **Alert fatigue** from flapping metrics (`real-output`, `handler.completed-count`) drowns out signal.

### Recommended Actions
1. Investigate root cause of low scout good-session-rate
2. Add cooldown/debounce to high-frequency alerting metrics
3. Review `v2.heartbeat-decision-rate` — 0% suggests broken measurement
4. Consider raising thresholds for metrics that routinely self-resolve within minutes
