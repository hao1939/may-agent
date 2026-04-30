# Evaluator heartbeat — 2026-04-30

## Inbox triage
**Alert:** [P1] SHALLOW SESSIONS: 144/156 (92%) sessions in last 6h had ≤3 ops.

**Disposition:** Dismiss (informational / expected).
- Rationale: Evaluator work is often tool-light (many evaluations are produced by cron and stored in DB). Heartbeat actions (DB recency checks, quick calibration notes) are also intentionally low-op.
- Actionable follow-up instead of “panic”: monitor evaluation coverage via DB counts (sessions vs evaluations) rather than ops/session.

## Pipeline liveness check (Process #5 Session Eval)
**DB (canonical):**
- evaluations MAX(createdAt): 2026-04-30 06:43:54 UTC
- sessions last 6h: 655
- evaluations last 6h: 163

Interpretation:
- Evaluation pipeline is running recently (fresh MAX(createdAt)).
- Coverage is partial (~25% of sessions evaluated in last 6h). This may be expected if cron samples or filters by kind/source; not enough evidence *in this heartbeat* to call it a regression.

**Legacy artifacts:** `.state/evaluations/` newest mtime ~2026-03-24.
- Treat as legacy-output-path drift (as noted in guidance), not pipeline failure.

## Recommendations / next steps
1. If stakeholders expect higher coverage, add/track a metric: `eval_coverage_6h = recent_evals_6h / recent_sessions_6h` and define a target per session-kind.
2. If cron is supposed to evaluate all sessions, investigate cron scope/filtering (owner: tech-lead) using DB queries grouped by `sessions.kind/source` vs evaluations.
