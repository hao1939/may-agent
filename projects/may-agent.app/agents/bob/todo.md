
## Next
- [x] **EXP-267 deployment** — DEPLOYED 2025-07-03. Treatment text added to coder, scout, evaluator context.md. Measurement window: 2 weeks (measure after 2025-07-17).
- [x] **EXP-267 measurement** — CONCLUDED 2026-05-02. PARTIALLY SUPPORTED. Treatment group 0 FM-3.3 violations vs 4/4 control. Extend to remaining agents next.
- [x] **EXP-267 rollout** — DONE 2025-05-02. Deployed verification_evidence format nudge to optimizer, coach, amy, tech-lead context.md files.
- [x] **H-300 Evidence Quality Decay** — COMPLETED 2025-05-02. Mean 3.25 (no intervention needed). Workers score 2.5 (monitor). See `EXP-301-evidence-quality-results.md`.
- [x] ~~**Dispatch dedup guard**~~ — CLOSED 2025-05-02. Problem resolved by infrastructure. See `AUDIT-heartbeat-2025-05-02.md`.

## Cleared (2025-05-01)
- [x] **EXP-188 finish-guard** — CLOSED. EXP-188 already CONCLUDED per `agents/shared/knowledge/experiments/EXP-188/results.md`. No finish-guard to ship.
- [x] **Dispatch hygiene audit** — DONE. Root cause identified in `ANALYSIS-session-dormancy-2025-05-01.md`. Fix designed in `DESIGN-dispatch-dedup-guard.md`.

## Done
- [x] **EXP-207 Phase 2 Design** — Designed context intervention for calibrated abstention. See `agents/shared/knowledge/experiments/EXP-207/phase2-design.md`.
- [x] **EXP-247 Multi-Agent Structural Auditor** — COMPLETE. H-247a SUPPORTED (40% fix), H-247b STRONGLY CONFIRMED (100% detection). H-206 promoted to P=0.70.
- [x] **Scorecard update** — Updated SCORECARD-bayesian-2027-11-18.md. H-073 P=0.80, H-206 P=0.70.
- [x] **EXP-207 Phase 1** — FM-3.3 baseline measurement complete. 25% FM-3.3 rate, 53% gravity well rate. Results in `agents/shared/knowledge/experiments/EXP-207/results.md`.
- [x] **EXP-245b Separate Auditor Agent** — Superseded by EXP-247 (properly designed with arms, metrics, decision rules).

## In Progress
- [ ] **EXP-800 Manual Execution** — Dispatch protocol ready at `.state/experiments/EXP-800-manual-dispatch.md`. Next: run Arm A (3 coder forks). Then Arm C. Then score.
- [x] **EXP-600 Bash Waste Reduction** — CLOSED NEGATIVE (2028-09-14). Diagnose-before-retry skill produced 0pp improvement on bash efficiency. Confirms KE-480 extends to efficiency behaviors. See `agents/coach/workspace/EXP-600-treatment-results.md`.
- [x] **EXP-296 Ghost Completion — PARTIALLY_VALIDATED (2027-09-01)** — Layer 2 circuit breaker already in master-worker.ts.
- [x] **EXP-207 Phase 2 — CLOSED DEPLOYED-UNMEASURED (2027-09-01)** — 8 months live, no rollback.
