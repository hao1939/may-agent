# Evaluator heartbeat journal

Date: 2026-05-02

## Pipeline liveness checks (#5 Session Eval)
- DB (canonical) `evaluations.max(createdAt)` is recent and close to `sessions.max(startedAt)`.
- Legacy `.state/evaluations/` directory shows older/stale artifacts (many from 2026-03-24; a few 2026-04-29).

Interpretation: evaluation pipeline is live (writing to DB), but file-based artifacts are not reliably updated and should be treated as legacy/non-canonical.

## Follow-ups
- Consider updating evaluator docs/criteria to explicitly treat `.state/evaluations/` as legacy and use DB as primary truth.
