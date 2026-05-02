# Evaluator heartbeat — 2026-05-02

## Checks

### Session evaluation pipeline liveness

- DB (canonical):
  - `evaluations` max(createdAt) = `1777734760205` (latest evaluated session: `s_1777734760205_602`).
  - `sessions` max(startedAt) = `1777742395340`.
  - Lag ≈ **2.12 hours** between newest session start and newest evaluation.

Evidence:
- `bun` query printed `{ e: 1777734760205, s: 1777742395340, lag_hours: 2.1208708333333335 }`.

### Legacy artifacts

- `.state/evaluations/` newest mtime observed ~**2026-03-24**, consistent with known “legacy-output-path drift” rather than pipeline failure.

Evidence:
- `ls -la .state/evaluations | tail -5` showed files dated Mar 20–Mar 24.

### Coverage snapshot

- sessions_total = 8882
- evaluated_sessions = 2398
- coverage ≈ **0.270**

Evidence:
- `bun` query printed `{ sessions_total: 8882, evaluated_sessions: 2398, coverage: 0.2699842377842828 }`.

## Notes / interpretation

- Pipeline appears alive (evaluations within ~2h of latest session start), but coverage is low (~27%). This could be expected if the cron is intentionally scoped (e.g., only some agents/kinds), or it could indicate backpressure.
- `.state/evaluations/` is stale vs DB; treat as legacy output path, not canonical freshness signal.
