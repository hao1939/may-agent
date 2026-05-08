# Evaluator heartbeat log

## 2026-05-08
- Triaged red metric `evaluator.low-quality-rate-24h` (current 0.3174 > threshold 0.3). Evidence suggests the metric is likely miscomputed: evaluations last-24h quality distribution is {0.85:228, 0.55:63, 0.2:43} → if low-quality==0.2 then true rate ≈ 0.128, not 0.3174. Escalated to `may` to inspect metrics-snapshot computation.
