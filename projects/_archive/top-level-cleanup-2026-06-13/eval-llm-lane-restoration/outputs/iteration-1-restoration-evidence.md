# Iteration 1 — eval LLM lane restoration evidence

## Summary

A bounded non-heuristic evaluator lane is active and has already produced a fresh `evaluatedByHeuristic=0` row, bringing `eval.llm-coverage-lag-h` back below its 4h alert threshold without restoring the deleted blocking `eval-poller` path.

## Runtime state observed

- Active cron entry: `agents/may/cron.json` contains `eval-llm-scan`, enabled, interval `1800000`, handler `eval-llm-scan`.
- Handler implementation: `agents/may/handlers/eval-llm-scan.ts` processes at most one candidate per run, uses an evaluator child session with source `eval-llm-scan`, validates an artifact before DB mutation, and writes `evaluatedByHeuristic=0` only after validation.
- Fresh deep evaluation row observed:
  - `sessionId`: `s_1778303460252_554`
  - `agent`: `arc`
  - `verdict`: `acceptable`
  - `evaluatedByHeuristic`: `0`
  - `overall.deepEval`: `1`
  - `created`: `2026-05-09 05:31:40`
- Freshness metric observed after the row was recorded:
  - `eval.llm-coverage-lag-h.current`: `0`
  - threshold: `4`
  - metric status: `active`
  - `updated_at`: `2026-05-09 05:31:55`

## Timeout-safety properties

The restored lane does **not** reintroduce the old `eval-poller` 300s handler-timeout shape:

1. The deleted `eval-poller` handler remains absent; cron does not route to it.
2. `eval-llm-scan` is bounded to one dispatched evaluator candidate per run.
3. The cron config uses `runTimeoutMs: 240000`, keeping the awaited handler window below the old 300s timeout.
4. `hasActiveDeepEval(...)` suppresses new dispatch while a recent `eval-llm-scan` evaluator session is still `running`/`idle`.
5. DB mutation is separated from the LLM judgment: `processArtifacts(...)` can record valid artifacts on a later scan, so a child session that outlives the handler window can still be harvested without requiring the handler to block until completion.

## Verification queries used

```sql
SELECT sessionId, agent, verdict, evaluatedByHeuristic,
       json_extract(overall,'$.deepEval') AS deepEval,
       datetime(createdAt/1000,'unixepoch') AS created
FROM evaluations
WHERE sessionId = 's_1778303460252_554';
```

Observed one row with `evaluatedByHeuristic = 0` and `deepEval = 1`.

```sql
SELECT datetime(MAX(createdAt)/1000,'unixepoch') AS last_deep,
       ROUND((unixepoch()*1000 - MAX(createdAt))/3600000.0,3) AS lag_h
FROM evaluations
WHERE evaluatedByHeuristic = 0;
```

Observed `last_deep = 2026-05-09 05:31:40`, `lag_h = 0.024`.

```sql
SELECT id, current, threshold, status,
       datetime(updated_at/1000,'unixepoch') AS updated_at
FROM metrics
WHERE id = 'eval.llm-coverage-lag-h';
```

Observed `current = 0`, `threshold = 4`, status `active`.

## Remaining hardening recommendation

The current lane is safe enough to restore freshness, but a follow-up iteration should consider making dispatch fully fire-and-forget if the SDK supports it, so even the 240s bounded wait is unnecessary. Keep the artifact-validation gate and one-active-child suppression either way.
