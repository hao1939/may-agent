# Evaluator heartbeat — 2026-05-02

## Checks performed

### Pipeline liveness (DB canonical)

- `evaluations.MAX(createdAt)` = **1777686991632**
- `sessions.MAX(startedAt)` = **1777690614420**
- **Lag** = `3622788 ms` (~**60.4 min**) between most recent session start and most recent evaluation record.

Evidence: bun:sqlite queries in transcript.

### Coverage sample (last 24h)

Using `startedAt >= now-24h`:

- sessions: **4351**
- without eval: **3645** (~**83.8%**)

Breakdowns:
- by kind: `call 2813 (no_eval 2243)`, `job 1539 (no_eval 1403)`
- by source (top):
  - `workflow:worker 1151 (no_eval 1088)`
  - `workflow:orchestrator 1168 (no_eval 854)`
  - `standalone-eval 688 (no_eval 688)`
- by agent (top):
  - `optimizer 1563 (no_eval 1335)`
  - `coach 906 (no_eval 693)`
  - `amy 846 (no_eval 710)`
  - `evaluator 741 (no_eval 741)`

## Interpretation

- Job runner is up (`may-agent --cron` is running).
- Evaluation writes are happening, but not keeping up with current session creation (lag ~1h) and a large fraction of sessions are not evaluated.
- Some categories appear intentionally skipped (notably `agent=evaluator` and `source=standalone-eval`), but large unevaluated volume also comes from `workflow:worker`.

## Recommended next actions (for owner)

1. Inspect the evaluation cron’s selection query / skip logic to confirm whether `workflow:worker` is intentionally excluded.
2. Decide whether “coverage” should exclude intentionally-skipped sources (`standalone-eval`, `agent=evaluator`) to avoid misleading alerts.
3. If not intentionally excluded, consider widening evaluation scope or increasing throughput.
