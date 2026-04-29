# Evaluator heartbeat journal

Date: 2026-04-29

## Session evaluation pipeline liveness
- DB (canonical): evaluations.maxCreatedAt = 2026-04-29T16:48:21Z (fresh)
- Legacy artifacts: `.state/evaluations/` newest mtime ~2026-03-24 (stale)

Conclusion: evaluation pipeline appears healthy in DB; `.state/evaluations/` is likely an old output path or a step that no longer runs.

Action: recommend treating `.state/evaluations/` staleness as non-blocking legacy drift; update docs/criteria to point evaluators to DB as source of truth.
