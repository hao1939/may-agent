# Iteration 5 — Source-specific residual sampling after `c052855aa`

Date: 2026-05-09
Owner: dev

## Scope

Iteration 4 reopened this project because fresh post-`c052855aa` finish/uncommitted evaluations were again routing to `needs_improvement`. This iteration samples the fresh residual rows by source to distinguish true unresolved dirty exits from sessions that repaired/committed but later received review metadata or non-dirty quality penalties.

Cutoff used throughout:

- Commit: `c052855aaf5b80047ddb54c9ad27225c407429af` (`c052855aa`)
- Commit time: `2026-05-09T15:11:15Z`
- Cutoff timestamp: `1778339475000` ms

## Fresh post-cutoff grouping

Query requested by the project prompt was rerun at about `2026-05-09 20:25 UTC`:

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
| good | workflow:scout-explore | done | done | success | 14 | 2026-05-09 15:27:07 | 2026-05-09 20:06:43 |
| good | workflow:scout-heartbeat | done | done | success | 3 | 2026-05-09 15:19:05 | 2026-05-09 17:25:15 |
| needs_improvement | workflow:scout-heartbeat | done | done | success | 2 | 2026-05-09 15:59:51 | 2026-05-09 20:15:15 |
| needs_improvement | workflow:scout-explore | done | done | success | 2 | 2026-05-09 17:37:02 | 2026-05-09 19:52:08 |
| good | workflow:dev-heartbeat | done | done | partial | 1 | 2026-05-09 19:29:58 | 2026-05-09 19:29:58 |
| good | closed-loop-steward | done | done | success | 1 | 2026-05-09 18:36:18 | 2026-05-09 18:36:18 |
| needs_improvement | workflow:dev-heartbeat | done | done | partial | 1 | 2026-05-09 16:54:32 | 2026-05-09 16:54:32 |
| needs_improvement | closed-loop-steward | done | done | success | 1 | 2026-05-09 15:21:54 | 2026-05-09 15:21:54 |

## Count split

The post-cutoff sample has grown from iteration 3's single row to 25 rows:

| bucket | count | interpretation |
|---|---:|---|
| Raw finish-blocked evaluations post-cutoff | 25 | Friction still occurs. |
| Routed `good` | 19 | Repaired/clean exits recognized by the classifier. |
| Verdict `needs_improvement` | 6 | Not all are unresolved dirty exits; see breakdown below. |
| `needs_improvement` with `review override:*` issue | 5 | Repaired sessions whose final verdict was replaced by aftermath review metadata. |
| `needs_improvement` without review override | 1 | Scout heartbeat with `anti-shallow gate not satisfied: 5/10 tool calls`. |
| Strict unresolved dirty exits by terminal state | 0 | Every row has `sessions.status='done'`, `sessions.outcome='done'`, and latest digest outcome in `success`/`partial`. |
| Completed/repaired terminal-state rows | 25 | No sampled row remains terminally dirty/unresolved by session/digest state. |

The current 24h aggregate is still mixed with stale rows: `207` finish/uncommitted rows in the last 24h, of which `182` are pre-cutoff and `25` are post-cutoff.

## Source-specific residuals

Grouped by source, the post-cutoff raw and residual counts are:

| source | raw_n | good_n | needs_improvement_n | review_override_ni_n | non_review_override_ni_n | anti_shallow_ni_n | first_eval_utc | last_eval_utc |
|---|---:|---:|---:|---:|---:|---:|---|---|
| workflow:scout-explore | 16 | 14 | 2 | 2 | 0 | 0 | 2026-05-09 15:27:07 | 2026-05-09 20:06:43 |
| workflow:scout-heartbeat | 5 | 3 | 2 | 1 | 1 | 1 | 2026-05-09 15:19:05 | 2026-05-09 20:15:15 |
| workflow:dev-heartbeat | 2 | 1 | 1 | 1 | 0 | 0 | 2026-05-09 16:54:32 | 2026-05-09 19:29:58 |
| closed-loop-steward | 2 | 1 | 1 | 1 | 0 | 0 | 2026-05-09 15:21:54 | 2026-05-09 18:36:18 |

### Top sampled rows

Because there are more than 10 post-cutoff rows, this samples 10 rows across the residual sources, weighted toward `workflow:scout-explore` because it is the only source with a high raw count.

| source | sessionId | verdict | eval_utc | issues_excerpt |
|---|---|---|---|---|
| closed-loop-steward | `s_1778351129615_156` | good | 2026-05-09 18:36:18 | `["finish blocked by uncommitted changes"]` |
| closed-loop-steward | `s_1778340047294_1` | needs_improvement | 2026-05-09 15:21:54 | `["finish blocked by uncommitted changes","review override: needs_improvement"]` |
| workflow:dev-heartbeat | `s_1778354765274_204` | good | 2026-05-09 19:29:58 | `["finish blocked by uncommitted changes"]` |
| workflow:dev-heartbeat | `s_1778343965279_64` | needs_improvement | 2026-05-09 16:54:32 | `["finish blocked by uncommitted changes","review override: acceptable"]` |
| workflow:scout-explore | `s_1778357168529_233` | good | 2026-05-09 20:06:43 | `["finish blocked by uncommitted changes"]` |
| workflow:scout-explore | `s_1778356268434_217` | needs_improvement | 2026-05-09 19:52:08 | `["finish blocked by uncommitted changes","review override: needs_improvement"]` |
| workflow:scout-explore | `s_1778354707411_199` | good | 2026-05-09 19:51:18 | `["finish blocked by uncommitted changes"]` |
| workflow:scout-explore | `s_1778355368415_211` | good | 2026-05-09 19:36:43 | `["finish blocked by uncommitted changes"]` |
| workflow:scout-heartbeat | `s_1778356311866_219` | needs_improvement | 2026-05-09 20:15:15 | `["finish blocked by uncommitted changes","review override: acceptable"]` |
| workflow:scout-heartbeat | `s_1778347311858_106` | good | 2026-05-09 17:25:15 | `["finish blocked by uncommitted changes"]` |

## Interpretation of residual `needs_improvement`

Detailed sampling of the six post-cutoff `needs_improvement` rows shows:

1. `s_1778356311866_219` (`workflow:scout-heartbeat`) has latest digest `success`; the classifier route reason says finish/uncommitted friction was self-repaired or cleanly exited. Final issues include `review override: acceptable`, and `overall.reviewOverride=true`.
2. `s_1778356268434_217` (`workflow:scout-explore`) has latest digest `success`; the classifier route reason is the repaired-clean route. Final issues include `review override: needs_improvement`, so the low-quality verdict is review output quality, not unresolved dirty work.
3. `s_1778348168426_122` (`workflow:scout-explore`) has latest digest `success`; final issues include `review override: acceptable` despite the repaired-clean route.
4. `s_1778343965279_64` (`workflow:dev-heartbeat`) has latest digest `partial`; the digest explicitly says no file changes were made and the agent could not finish success because unrelated dirty paths were already present. Final issues include `review override: acceptable`.
5. `s_1778340111148_0` (`workflow:scout-heartbeat`) has latest digest `success`; this is the only post-cutoff `needs_improvement` without review override. It was penalized for `anti-shallow gate not satisfied: 5/10 tool calls`, not for unresolved dirty exit.
6. `s_1778340047294_1` (`closed-loop-steward`) has latest digest `success`; the session committed an orphaned file to clear the finish gate, but final issues include `review override: needs_improvement`, so the residual verdict is review-quality metadata rather than terminal dirty state.

Conclusion: iteration 4's residual `needs_improvement` signal is real as broad evaluator output, but it is not evidence of unresolved dirty exits. It is a mix of (a) repaired finish hygiene plus review overrides and (b) one unrelated anti-shallow violation.

## Patch decision

A single source, `workflow:scout-explore`, has >=3 fresh raw finish-blocked incidents post-cutoff (`16`). However, source-specific sampling did **not** identify unresolved dirty exits: all 16 scout-explore rows ended `done/done` with latest digest `success`, and 14/16 already route `good`. The 2 residual `needs_improvement` rows are review overrides after the repaired-clean route.

Therefore I am not patching scout-explore in this iteration. The remaining problem is raw operational friction, not a source-specific unrepaired closeout path. Another prompt patch would likely increase instruction clutter without reducing the dominant cause visible in the data.

## Durable tracking recommendation

The two split metrics proposed in iteration 3 are still not registered in the live `metrics` table (`SELECT ... WHERE id IN (...)` returned 0 rows). They remain the right next step because a single low-quality metric conflates three different conditions:

1. raw finish-block friction,
2. repaired-clean finish-block attempts, and
3. true unresolved dirty exits.

Recommended metric IDs remain:

- `session.finish-blocked-uncommitted-count-24h`: raw friction count, target trending toward 0, threshold initially high enough to avoid stale post-cutoff noise.
- `session.finish-blocked-unresolved-count-24h`: strict quality-impact count, counting finish-blocked rows that are not completed/repaired by terminal session + digest state and excluding review overrides/non-dirty quality penalties.

A stricter unresolved metric source query should avoid counting review overrides as dirty exits:

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
  AND e.issues NOT LIKE '%review override:%'
  AND e.issues NOT LIKE '%anti-shallow gate not satisfied%'
  AND (
    s.status != 'done'
    OR s.outcome != 'done'
    OR COALESCE(ld.outcome, 'no_digest') NOT IN ('success', 'partial')
  );
```

## Final conclusion

Fresh post-`c052855aa` data now shows persistent raw finish-block friction (`25` rows), led by scout-explore (`16`). But the original low-quality driver is much smaller than the raw count implies: strict unresolved dirty exits are `0`, and the six post-cutoff `needs_improvement` rows are review overrides or one anti-shallow violation. The next iteration should register or otherwise implement the split metrics rather than patch prompts again; if raw scout-explore friction remains high after metric split, investigate transcript-level causes for why routine Scout commits are attempted only after an initial blocked finish.
