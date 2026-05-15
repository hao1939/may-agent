# Evaluator aftermath heuristic-only root cause — 2026-05-09

## Trigger

P1 implementation request from evaluator (event `message.created` id 538267) asked dev to check why last-24h evaluations are all `evaluatedByHeuristic=1` and `skippedByJs=0`, with no JS/LLM scoring, likely driving `evaluator.low-quality-rate-24h` high.

## Findings

### Runtime evidence

Current last-24h `evaluations` distribution:

```sql
SELECT COUNT(*) AS total,
       SUM(CASE WHEN evaluatedByHeuristic=1 THEN 1 ELSE 0 END) AS heuristic,
       SUM(CASE WHEN evaluatedByHeuristic=0 THEN 1 ELSE 0 END) AS nonheuristic,
       SUM(CASE WHEN skippedByJs=1 THEN 1 ELSE 0 END) AS skipped_js
FROM evaluations
WHERE createdAt > unixepoch()*1000 - 86400000;
```

Result at investigation time: `total=486`, `heuristic=486`, `nonheuristic=0`, `skipped_js=0`.

Verdict grouping was only heuristic good/needs-improvement:

- `needs_improvement`, `evaluatedByHeuristic=1`, `skippedByJs=0`: 323
- `good`, `evaluatedByHeuristic=1`, `skippedByJs=0`: 163

All last-24h rows were written by the aftermath workflow family:

```sql
SELECT json_extract(overall,'$.aftermathWorkflow') AS aftermathWorkflow,
       json_extract(overall,'$.heuristicVersion') AS hv,
       evaluatedByHeuristic, skippedByJs, COUNT(*) AS c
FROM evaluations
WHERE createdAt > unixepoch()*1000 - 86400000
GROUP BY aftermathWorkflow, hv, evaluatedByHeuristic, skippedByJs;
```

Observed buckets: aftermathWorkflow=1 for heuristic versions 2, 3, and 4 only.

The last non-heuristic evaluation is stale:

```sql
SELECT datetime(MAX(createdAt)/1000,'unixepoch') AS last_nonheuristic,
       ROUND((unixepoch()*1000 - MAX(createdAt))/3600000.0,2) AS lag_h
FROM evaluations
WHERE evaluatedByHeuristic=0;
```

Result: `last_nonheuristic='2026-05-06 11:23:22'`, `lag_h=64.87`.

### Code path evidence

`agents/evaluator/workflows/evaluator-aftermath.ts` is intentionally heuristic-only for the database row. It computes `const heuristic = classifyVerdict(session, transcript)` and then unconditionally inserts:

```ts
evaluatedByHeuristic = 1,
skippedByJs = 0,
overall.aftermathWorkflow = true,
overall.heuristicVersion = HEURISTIC_VERSION
```

The evaluator child session run by this workflow is a **review/triage artifact producer**, not a JS/LLM scorer that updates the numeric evaluation row. Review can only override false-good cases in narrow circumstances (`heuristicVerdict === "good"` and reviewed verdict is `needs_improvement`/`acceptable`); it does not create `evaluatedByHeuristic=0` rows.

The old JS/LLM standalone-eval lane is not merely failing silently; it was removed from the current tree. Git history shows commit `57ea4876d` deleted `may/handlers/eval-poller.ts` and removed the `eval-poller` cron entry. Before deletion, `eval-poller.ts` already had `MAX_LLM_EVALS_PER_RUN = 0`, disabling LLM evaluations to avoid 300s handler timeouts. The current runtime no longer has an `eval-poller` handler file, and the last 24h handler events show `session-aftermath-scan` firing, not `eval-poller`.

`agents/may/cron.json` now routes evaluation through:

- `evaluator-aftermath` (`run-workflow`, `on: session.completed`), and
- `session-aftermath-scan` (7-minute fallback),

both targeting `evaluator-aftermath`, which writes heuristic rows.

## Root cause

The all-heuristic distribution is expected from the current deployed code: the deep JS/LLM scoring lane was first disabled (`MAX_LLM_EVALS_PER_RUN=0`) and then deleted with the old `eval-poller`/`shared/evaluation/evaluator` path. `evaluator-aftermath` replaced liveness/triage with a deterministic heuristic row plus optional evaluator review artifact, but it never writes non-heuristic evaluation rows.

Therefore `skippedByJs=0` is misleading: the workflow did not attempt and skip JS scoring; it is a heuristic-only producer that hardcodes `skippedByJs=0`.

## Impact

- `evaluator.low-quality-rate-24h` is a broad heuristic hygiene/process-friction signal right now, not a deep task-quality scorer.
- Existing liveness metrics can stay green because `session-aftermath-scan` is active (`206` handler completions in the last 24h) and aftermath coverage is high, even while non-heuristic scoring is stale for ~65h.
- This confirms the evaluator's concern that the high broad low-quality rate is at least partly a pipeline semantics issue.

## Proposed fix

Do **not** simply restore the old blocking `eval-poller` in-handler LLM lane; it was disabled because evaluator child sessions pinned handlers near the 300s timeout.

Recommended safe sequence:

1. Add an explicit metric/alert for non-heuristic scoring freshness, e.g. `evaluator.llm-eval-lag-h = hours since MAX(createdAt) WHERE evaluatedByHeuristic=0`, threshold 4h. This is already proposed in `agents/arc/workspace/proposals/2026-05-07-eval-llm-coverage-lag-metric.md` and should be promoted because current lag is ~65h.
2. Split semantics in the DB row: if `evaluator-aftermath` remains heuristic-only, set/label a field that accurately communicates that no JS/LLM scoring was attempted. Avoid relying on `skippedByJs=0` as proof of JS scoring.
3. Reintroduce deep scoring as an asynchronous child workflow/session outside the cron handler critical path. The cron/fallback should enqueue or dispatch bounded evaluator work and return; the child scorer can write `evaluatedByHeuristic=0` when it succeeds. This avoids recreating the old handler timeout failure.
4. Until deep scoring is restored, page on `evaluator.substantive-low-quality-rate-24h` for substantive failures and treat `evaluator.low-quality-rate-24h` as a broad hygiene/heuristic signal.

## Event disposition

- Acted on P1 implementation request id 538267 with DB, code, and git-history evidence.
- Related evaluator low-quality alert is owner=evaluator; dev investigated root cause and recommends promoting the existing LLM-lag metric proposal plus async deep-scoring restoration.
- Dismissed routine recent session.start/session.end signals as superseded by this investigation.

## 2026-05-09 heartbeat follow-up

Implemented the first recommended visibility fix in `agents/may/handlers/metrics-snapshot.ts`: added built-in metric `eval.llm-coverage-lag-h` (owner `evaluator`, P0, target 1h, threshold 4h, alert when `>` threshold) and a snapshot measurement based on `MAX(createdAt)` where `evaluatedByHeuristic = 0`. At implementation time the read-only verification query reported `lag_h = 65.38` and `last_nonheuristic = 2026-05-06 11:23:22`, so the new metric should breach immediately on the next metrics snapshot instead of letting the heuristic-only pipeline look healthy.
