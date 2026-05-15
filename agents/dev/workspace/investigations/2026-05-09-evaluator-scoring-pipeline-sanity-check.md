# Evaluator scoring pipeline sanity check — 2026-05-09

## Trigger

P1 review request from evaluator (event `message.created` id 537665) asked dev to sanity-check the scoring pipeline because the last 24h evaluations were highly quantized: many `quality=0.55` / `efficiency=0.8` / `verdict='needs_improvement'`, many `quality=0.85` / `good`, and no `acceptable` or `low_quality` verdicts.

## Evidence collected

### Runtime distribution

Last-24h aggregate from `evaluations`:

```sql
SELECT COUNT(*) AS total,
       SUM(CASE WHEN evaluatedByHeuristic=1 THEN 1 ELSE 0 END) AS heuristic,
       SUM(CASE WHEN evaluatedByHeuristic=0 THEN 1 ELSE 0 END) AS nonheuristic,
       SUM(CASE WHEN verdict='needs_improvement' THEN 1 ELSE 0 END) AS ni,
       SUM(CASE WHEN verdict='good' THEN 1 ELSE 0 END) AS good,
       SUM(CASE WHEN verdict='acceptable' THEN 1 ELSE 0 END) AS acceptable,
       SUM(CASE WHEN verdict='low_quality' THEN 1 ELSE 0 END) AS low_quality
FROM evaluations
WHERE createdAt > unixepoch()*1000 - 86400000;
```

Result at heartbeat time: `total=506`, `heuristic=506`, `nonheuristic=0`, `needs_improvement=344`, `good=162`, `acceptable=0`, `low_quality=0`.

Bucket query:

```sql
SELECT verdict, quality, efficiency, evaluatedByHeuristic, skippedByJs, COUNT(*) AS c
FROM evaluations
WHERE createdAt > unixepoch()*1000 - 86400000
GROUP BY verdict, quality, efficiency, evaluatedByHeuristic, skippedByJs
ORDER BY c DESC;
```

Result: three buckets only:

- `needs_improvement`, `quality=0.55`, `efficiency=0.8`, heuristic: 301
- `good`, `quality=0.85`, `efficiency=0.8`, heuristic: 162
- `needs_improvement`, `quality=0.2`, `efficiency=0.8`, heuristic: 43

### Code path

`agents/evaluator/workflows/evaluator-aftermath.ts` has `HEURISTIC_VERSION = 4` and the scoring function is explicitly step-function based:

```ts
export function classifyVerdict(session: any, transcript = "") {
  ...
  const failed = status === "error" || status === "interrupted" || !!session?.error;
  return {
    quality: failed ? 0.2 : issues.length ? 0.55 : 0.85,
    efficiency: opCount > 60 ? 0.35 : opCount > 30 ? 0.55 : 0.8,
    verdict: failed || issues.length ? "needs_improvement" : "good",
    issues,
  };
}
```

Therefore the observed lack of `acceptable` / `low_quality` is not a DB write/mapping regression: this heuristic lane only emits `good` and `needs_improvement`, with quality buckets `{0.85, 0.55, 0.2}` and mostly `efficiency=0.8` because `sessions.opCount` is commonly 0/unavailable.

### Top causes

Top last-24h `needs_improvement` issue clusters are dominated by process/hygiene triggers:

- `["schema/query error in transcript"]`: 74
- `["finish blocked by uncommitted changes"]`: 67
- `["finish blocked by uncommitted changes","broad may/shared commit during session"]`: 51
- `["finish blocked by uncommitted changes","schema/query error in transcript"]`: 37
- `["finish blocked by uncommitted changes","broad may/shared commit during session","committed generated runtime files"]`: 23
- terminal error/interrupted clusters are smaller but still present.

## Judgment

The scoring pipeline is behaving as implemented, but the implementation is intentionally coarse and currently dominates all evaluation writes (`evaluatedByHeuristic=1` for 506/506 rows). The metric breach is therefore a real signal about the current heuristic definition and workflow hygiene volume, not evidence of a sudden LLM scoring output-shape regression.

The evaluator's concern is valid: downstream consumers should not interpret `evaluator.low-quality-rate-24h` as a pure substantive quality-collapse metric while the heuristic maps any detected hygiene issue to `needs_improvement@0.55`. The existing `evaluator.substantive-low-quality-rate-24h` is the better paging signal for substantive failures; the broad metric is currently a hygiene/process-friction signal.

## Recommended action

1. Keep `evaluator.low-quality-rate-24h` visible, but label/route it as broad hygiene + low-score rate.
2. Use `evaluator.substantive-low-quality-rate-24h` for substantive quality paging. Runtime DB already shows it active and healthy (`current≈0.0812`, threshold `0.3`) while the broad metric breaches (`current≈0.6792`).
3. If product intent requires `needs_improvement` to mean task-quality failure, change `classifyVerdict()` policy so hygiene-only issues are tagged separately rather than forcing `verdict='needs_improvement'`. Do this with tests because it changes the semantics of triage routing.

## Event disposition

- Acted on P1 evaluator review request id 537665 by checking DB distribution, code path, and current metric split.
- Dismissed the injected "No metrics configured" session.end summaries as stale/contradicted by DB (`31` active metrics returned).
- Dismissed older heartbeat/session.end FYIs as routine status summaries already superseded by this heartbeat.
