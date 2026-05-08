## 2026-05-08
- Triaged repeated red metric `evaluator.low-quality-rate-24h` (0.3304). Evidence from DB: 115/346 needs_improvement (0.332) in last 24h; concentrated in dev (25/54=0.463) and arc (20/44=0.455). Escalated to may with P1 message to sample NI evals and assess criteria vs actual output degradation.
- Session-eval pipeline health: evaluations MAX(createdAt)=2026-05-08 05:27:38 UTC; 346 evals vs 625 sessions in last 24h (~55% coverage; likely scoped cron).
