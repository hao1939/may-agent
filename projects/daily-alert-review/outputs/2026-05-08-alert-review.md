# Daily Alert Review — 2026-05-08

**Period:** Last 24 hours (approx 1778194000000–1778280593000 epoch ms)
**Total alerts fired:** 43
**Currently unresolved:** 4

---

## Summary by Metric

| Metric | Fires | Unresolved | Severity |
|--------|-------|------------|----------|
| `project.invalid-format-count` | 17 | 0 | 🟡 Noisy |
| `scout.good-session-rate-24h` | 6 | **1** | 🔴 Critical |
| `evaluator.false-good-rate-sample` | 5 | **1** | 🔴 Critical |
| `metric.stale-active-count` | 3 | 0 | 🟢 Resolved |
| `evaluator.low-quality-rate-24h` | 3 | **1** | 🔴 Critical |
| `session.failed-triage-rate-3h` | 2 | 0 | 🟢 Resolved |
| `capability.process-uptime-h` | 2 | 0 | 🟢 Resolved |
| `scout.operational-friction-rate-24h` | 1 | **1** | 🔴 Critical |
| `evaluator.triage-closure-rate-24h` | 1 | 0 | 🟢 Resolved |
| `evaluator.meaningful-review-rate-24h` | 1 | 0 | 🟢 Resolved |
| `capability.self-directed-iteration-rate-24h` | 1 | 0 | 🟢 Resolved |
| `v2.spec-coverage-rate` | 1 | 0 | 🟢 Resolved |

---

## Unresolved Alerts (Require Attention)

### 1. `scout.good-session-rate-24h` — Good session rate at 34.3% (threshold: 65%, target: 85%)
- **Alert ID:** 225, created ~8h ago
- **Impact:** Over half of sessions are not meeting quality bar. This has been persistently below threshold with 6 fires in 24h.
- **Recommendation:** Investigate root causes of poor session outcomes. Check for pattern in failing sessions (specific agents, task types).

### 2. `evaluator.false-good-rate-sample` — False-good rate at 46.7% (threshold: 20%, target: 5%)
- **Alert ID:** 229, created ~7h ago
- **Impact:** Nearly half of sessions evaluated as "good" are overturned on review. Evaluator quality is severely degraded.
- **Recommendation:** Review evaluator prompts/criteria. The rate spiked from 50% → 60% → 46.7%, showing instability. May need evaluator calibration.

### 3. `evaluator.low-quality-rate-24h` — Low-quality rate at 62% (threshold: 30%, target: 10%)
- **Alert ID:** 195, created ~15h ago
- **Impact:** Majority of evaluated sessions are low-quality. Combined with the false-good rate, evaluation reliability is very poor.
- **Recommendation:** This is the broadest quality signal. Correlates with scout good-session-rate. Systemic quality issue.

### 4. `scout.operational-friction-rate-24h` — Operational friction at 65.7% (threshold: 30%, target: 10%)
- **Alert ID:** 197, created ~14h ago
- **Impact:** Two-thirds of sessions hit operational friction (tool errors, config issues, etc.).
- **Recommendation:** Audit recent sessions for common friction patterns (missing tools, DB errors, config drift).

---

## Noise Analysis

### `project.invalid-format-count` — 17 fires, all resolved
This metric fires and self-resolves repeatedly (threshold=0 means any invalid format triggers it). It fired 17 times in 24h, making it the noisiest alert. 

**Recommendation:** Either fix the recurring invalid project.md formats at the source, or raise the threshold from 0 to reduce noise.

---

## Key Patterns

1. **Quality crisis:** 3 of 4 unresolved alerts relate to session/evaluation quality. The scout good-session-rate (34%), evaluator false-good-rate (47%), and low-quality-rate (62%) paint a picture of systemic quality degradation.

2. **Operational friction is high:** 65.7% friction rate suggests infrastructure/tooling issues are a major contributor to poor session outcomes.

3. **Alert noise:** `project.invalid-format-count` and `handler.completed-count` (from earlier in the window) produce many transient alerts that self-resolve within minutes. Consider tuning thresholds or adding debounce.

4. **Positive signals:** Process uptime, stale metrics, triage closure, and meaningful review rate all resolved within the period.

---

## Recommended Actions (Priority Order)

1. **P0:** Investigate operational friction sources — this likely drives the quality metrics down
2. **P0:** Review evaluator calibration — 47% false-good rate means evaluations are unreliable
3. **P1:** Analyze failing sessions to find common patterns in the 66% that aren't "good"
4. **P2:** Tune `project.invalid-format-count` threshold to reduce alert noise
