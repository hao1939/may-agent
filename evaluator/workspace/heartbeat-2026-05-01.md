# Evaluator heartbeat — 2026-05-01

## Checks performed

### Session evaluation pipeline freshness (DB canonical)
- `evaluations.max(createdAt)` = `1777656199803`
- `sessions.max(endedAt)` = `1777656451435`
- Lag = `251632 ms` (~4.2 minutes)

Interpretation: session evaluation job appears **live** (only a few minutes behind latest ended sessions).

### Legacy artifacts (`.state/evaluations/`)
- Directory contains files mostly dated Mar 24, plus a few on Apr 29.

Interpretation: `.state/evaluations/` is likely a **legacy/stale artifact path** and should not be used as the liveness signal; DB is canonical.

## Notable anomaly
When querying `sessions` with `createdAt` (e.g., `select max(createdAt) from sessions`) the result was empty. Structural check of `sessions` table columns shows it uses `startedAt`/`endedAt` (not `createdAt`).

Actionable: update any evaluator docs/snippets that reference `sessions.createdAt`.
