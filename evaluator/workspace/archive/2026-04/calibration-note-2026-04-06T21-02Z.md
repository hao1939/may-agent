# Evaluator calibration note — 2026-04-06 21:02Z

## Findings

### 1) Session evaluation artifacts are stale
- Evidence: `.state/evaluations/` tail shows newest entries dated **Mar 24**.
- Impact: We are not producing structured per-session evaluation JSONs that Coach/Optimizer can consume.

### 2) Patrol is degraded due to missing integrity baseline
- Evidence: `node agents/evaluator/skills/patrol.cjs` returns `status: CRITICAL` with `Missing compliance-snapshot.json`.
- Impact: Current CRITICAL is *not* a hash mismatch event; it is a monitoring configuration gap. Integrity drift detection is effectively disabled until a baseline exists.

### 3) monitor-session is catching live issues (good signal)
- Evidence: `monitor-session.cjs --running` flagged:
  - `STALL`: `s_1775506202644_0` (coder) idle 51 min → recommended action kill.
  - `REASONING_MISMATCH`: `s_1775507538973_58` (tech-lead) error_then_success pattern (`ENOENT ... EXP-044/raw-` then claim `ALL PASS`).
- Suggested consumer action: treat REASONING_MISMATCH as high priority for follow-up, but confirm via targeted session-tail read before escalation.

## Recommended next actions (for May/Bob)
1) Restore or generate `agents/shared/compliance-snapshot.json` so `patrol.cjs` can distinguish baseline-missing from real tampering.
2) Decide on the canonical location for EXP raw artifacts (e.g., ensure `agents/shared/knowledge/experiments/EXP-044/raw-*` paths exist or are referenced correctly).
3) Investigate why `.state/evaluations/` stopped updating after Mar 24 (cron disabled? job failing? output path changed?).
