# Iteration 3 — Fresh incidence and durable tracking

Date: 2026-05-09
Owner: dev

## Scope

This iteration shifts from evaluator-classifier validation to operational incidence tracking for sessions that reach `finish()` with uncommitted/dirty worktree state. Iteration 2 already patched the evaluator classifier; the question here is whether fresh post-patch finish-block attempts are still appearing, whether any are unresolved, and how to make raw hygiene friction visible separately from true low-quality exits.

## Cutoff commit/version

- Cutoff commit: `c052855aaf5b80047ddb54c9ad27225c407429af` (`c052855aa`)
- Commit time: `2026-05-09T15:11:15Z`
- Cutoff used in DB queries: `1778339475000` ms
- Meaning: evaluations at or after this timestamp should include the Iteration 2 classifier behavior that recognizes `finish blocked -> commit -> finish(success)` as a repaired clean exit.

## Fresh post-cutoff grouping query

```sql
WITH latest_digest AS (
  SELECT sd.*
  FROM session_digests sd
  JOIN (
    SELECT sessionId, MAX(created_at) AS max_created_at
    FROM session_digests
    GROUP BY sessionId
  ) m ON m.sessionId = sd.sessionId AND m.max_created_at = sd.created_at
)
SELECT e.verdict,
       s.source,
       s.status,
       s.outcome AS session_outcome,
       COALESCE(ld.outcome, 'no_digest') AS digest_outcome,
       COUNT(*) AS n,
       MIN(datetime(e.createdAt/1000,'unixepoch')) AS first_eval_utc,
       MAX(datetime(e.createdAt/1000,'unixepoch')) AS last_eval_utc
FROM evaluations e
JOIN sessions s ON s.sessionId = e.sessionId
LEFT JOIN latest_digest ld ON ld.sessionId = e.sessionId
WHERE e.createdAt >= 1778339475000
  AND e.issues LIKE '%finish blocked by uncommitted changes%'
GROUP BY e.verdict, s.source, s.status, s.outcome, digest_outcome
ORDER BY n DESC, last_eval_utc DESC;
```

Observed result:

| verdict | source | status | session_outcome | digest_outcome | n | first_eval_utc | last_eval_utc |
|---|---|---|---|---|---:|---|---|
| good | workflow:project | done | done | success | 1 | 2026-05-09 15:14:10 | 2026-05-09 15:14:10 |

## Count split

Query used:

```sql
WITH latest_digest AS (
  SELECT sd.*
  FROM session_digests sd
  JOIN (
    SELECT sessionId, MAX(created_at) AS max_created_at
    FROM session_digests
    GROUP BY sessionId
  ) m ON m.sessionId = sd.sessionId AND m.max_created_at = sd.created_at
), finish_rows AS (
  SELECT e.sessionId, e.verdict, e.createdAt,
         s.source, s.status, s.outcome AS session_outcome,
         COALESCE(ld.outcome, 'no_digest') AS digest_outcome
  FROM evaluations e
  JOIN sessions s ON s.sessionId = e.sessionId
  LEFT JOIN latest_digest ld ON ld.sessionId = e.sessionId
  WHERE e.issues LIKE '%finish blocked by uncommitted changes%'
)
SELECT
  SUM(CASE WHEN createdAt >= 1778339475000 THEN 1 ELSE 0 END) AS post_cutoff_raw_finish_blocked,
  SUM(CASE WHEN createdAt >= 1778339475000 AND verdict = 'needs_improvement' THEN 1 ELSE 0 END) AS post_cutoff_unresolved_or_needs_improvement,
  SUM(CASE WHEN createdAt >= 1778339475000 AND verdict = 'good' AND status = 'done' AND session_outcome = 'done' AND digest_outcome = 'success' THEN 1 ELSE 0 END) AS post_cutoff_repaired_clean_good,
  SUM(CASE WHEN createdAt < 1778339475000 AND createdAt >= (unixepoch('now') * 1000 - 86400000) THEN 1 ELSE 0 END) AS pre_cutoff_stale_rows_in_24h,
  SUM(CASE WHEN createdAt >= (unixepoch('now') * 1000 - 86400000) THEN 1 ELSE 0 END) AS total_24h_finish_blocked
FROM finish_rows;
```

Observed result:

| bucket | count |
|---|---:|
| Raw finish-blocked evaluations post-cutoff | 1 |
| Unresolved dirty exits / still `needs_improvement` post-cutoff | 0 |
| Repaired/clean exits routed `good` post-cutoff | 1 |
| Stale pre-cutoff rows still in the 24h window | 233 |
| Total finish-blocked rows still in the 24h window | 234 |

Interpretation:

- Fresh post-`c052855aa` sample remains very small: only 1 raw finish-blocked evaluation.
- The only fresh row is repaired/clean and now routes to `good`, confirming the Iteration 2 routing direction in live data.
- The visible 24h aggregate is still almost entirely stale relative to the cutoff: 233 of 234 rows were created before `c052855aa`.
- There are currently 0 post-cutoff `needs_improvement` rows with the finish/uncommitted issue, so there is no fresh evidence of unresolved dirty exits after the classifier fix.

## Post-cutoff sample

Because there are <=10 post-cutoff finish/uncommitted rows, this samples every row.

Query used:

```sql
WITH latest_digest AS (
  SELECT sd.*
  FROM session_digests sd
  JOIN (
    SELECT sessionId, MAX(created_at) AS max_created_at
    FROM session_digests
    GROUP BY sessionId
  ) m ON m.sessionId = sd.sessionId AND m.max_created_at = sd.created_at
)
SELECT e.sessionId,
       e.verdict,
       s.source,
       s.status,
       s.outcome AS session_outcome,
       COALESCE(ld.outcome, 'no_digest') AS digest_outcome,
       datetime(e.createdAt/1000,'unixepoch') AS eval_utc,
       substr(e.issues, 1, 500) AS issues_excerpt
FROM evaluations e
JOIN sessions s ON s.sessionId = e.sessionId
LEFT JOIN latest_digest ld ON ld.sessionId = e.sessionId
WHERE e.createdAt >= 1778339475000
  AND e.issues LIKE '%finish blocked by uncommitted changes%'
ORDER BY e.createdAt DESC
LIMIT 10;
```

Observed sample:

| sessionId | verdict | source | status | session_outcome | digest_outcome | eval_utc | issues_excerpt |
|---|---|---|---|---|---|---|---|
| `s_1778339078795_14` | good | workflow:project | done | done | success | 2026-05-09 15:14:10 | `["finish blocked by uncommitted changes"]` |

Conclusion for sampled row: repaired/clean finish-block friction, not an unresolved dirty exit. The evaluator kept the issue string visible for friction tracking but did not route the repaired session to broad low quality.

## Source-specific patch decision

No source has >=3 fresh raw finish-blocked incidents post-cutoff.

Observed post-cutoff source counts:

| source | raw finish-blocked rows post-cutoff |
|---|---:|
| workflow:project | 1 |

Decision: do not patch prompts or closeout paths again in this iteration. The data does not yet identify a recurring fresh source-specific operational path; more post-cutoff sample is needed before another prompt/workflow change would be justified.

## Durable tracking recommendation

No durable split metrics with the proposed IDs are currently registered in the `metrics` table. A read-only check for `session.finish-blocked-uncommitted-count-24h` and `session.finish-blocked-unresolved-count-24h` returned 0 rows.

Recommended metrics:

### 1. Raw finish-blocked friction metric

Metric ID: `session.finish-blocked-uncommitted-count-24h`

Purpose: Count every evaluation in the last 24h whose issue list records `finish blocked by uncommitted changes`, regardless of final repair. This captures raw workflow friction and should not be interpreted as low-quality by itself.

Suggested source query:

```sql
SELECT COUNT(*) AS value
FROM evaluations e
WHERE e.createdAt >= (unixepoch('now') * 1000 - 86400000)
  AND e.issues LIKE '%finish blocked by uncommitted changes%';
```

Suggested configuration:

- owner: `dev`
- type: `gauge`
- unit: `count`
- direction: lower is better
- target: `0`
- threshold: initially `10` while baseline decays; tighten after 24h of post-cutoff data
- alert_op: `>`
- description: Raw count of sessions/evaluations that hit the finish uncommitted-worktree guard in the last 24h, including repaired-good cases.

### 2. Unresolved dirty-exit metric

Metric ID: `session.finish-blocked-unresolved-count-24h`

Purpose: Count finish-blocked rows that still represent true low-quality or unresolved exits. This should be the alerting metric for quality impact, while the raw metric tracks friction.

Suggested source query:

```sql
WITH latest_digest AS (
  SELECT sd.*
  FROM session_digests sd
  JOIN (
    SELECT sessionId, MAX(created_at) AS max_created_at
    FROM session_digests
    GROUP BY sessionId
  ) m ON m.sessionId = sd.sessionId AND m.max_created_at = sd.created_at
)
SELECT COUNT(*) AS value
FROM evaluations e
JOIN sessions s ON s.sessionId = e.sessionId
LEFT JOIN latest_digest ld ON ld.sessionId = e.sessionId
WHERE e.createdAt >= (unixepoch('now') * 1000 - 86400000)
  AND e.issues LIKE '%finish blocked by uncommitted changes%'
  AND (
    e.verdict = 'needs_improvement'
    OR s.status != 'done'
    OR COALESCE(ld.outcome, 'no_digest') NOT IN ('success', 'partial')
  );
```

Suggested configuration:

- owner: `dev`
- type: `gauge`
- unit: `count`
- direction: lower is better
- target: `0`
- threshold: `1`
- alert_op: `>`
- description: Count of finish-blocked sessions/evaluations in the last 24h that remain low-quality or unresolved after latest digest/session outcome, excluding repaired-good hygiene friction.

## Final conclusion

The post-`c052855aa` operational sample is still too small to prove an incidence-rate reduction, but it is directionally healthy: 1 fresh raw finish-blocked row, 0 unresolved/`needs_improvement` rows, and 1 repaired-good row. The current 24h headline count remains misleading because 233 of 234 rows are stale pre-cutoff evaluations. The next useful loop is to register or implement the two split metrics above and revisit after enough post-cutoff sessions accumulate; do not patch source prompts again until a fresh source reaches the >=3 incident threshold.
