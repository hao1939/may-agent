# Iteration 2 — Post-patch evaluator routing validation

Date: 2026-05-09
Owner: dev

## Scope

Validate whether the evaluator self-repair patch for `finish() blocked [uncommitted changes]` is active in live evaluations, then patch the classifier if live post-patch evidence still shows repaired sessions routed to `needs_improvement`.

## Evaluator patch versions

Relevant commits on `agents/main`:

- Self-repair finish hygiene patch: `f2fd305ad30a58f1d9b810681da4171e7df54f0e` (`f2fd305ad`), committed `2026-05-09T14:41:07+00:00`, subject `evaluator: classify self-repaired finish hygiene`.
- Schema recovery follow-up: `cb2e2f5271e14d33f1119564bc6360f01980920c` (`cb2e2f527`), committed `2026-05-09T15:01:02+00:00`, subject `evaluator: stop routing recovered schema query sessions`.
- Schema result-scope follow-up already present at start of this iteration: `42f9a6e92c2801d2a6c4eb397a3872ee268411ee` (`42f9a6e92`), committed `2026-05-09T15:05:27+00:00`, subject `evaluator: scope schema-error aftermath heuristic to query_db results`.
- This iteration's classifier patch: recognizes a post-blocked `finish(success)` retry as self-repair. It keeps unresolved interrupted/error exits downgraded.

The pre/post split below uses the self-repair patch commit time: `2026-05-09T14:41:07Z` = `1778337667000` ms.

## Query 1 — pre-patch vs post-patch split

```sql
WITH latest_digest AS (
  SELECT sd.*
  FROM session_digests sd
  JOIN (SELECT sessionId, MAX(created_at) AS max_created_at FROM session_digests GROUP BY sessionId) m
    ON m.sessionId = sd.sessionId AND m.max_created_at = sd.created_at
), base AS (
  SELECT e.sessionId, e.verdict, e.createdAt AS evaluation_created_at,
         s.status, s.outcome AS session_outcome, s.source,
         COALESCE(ld.outcome, 'no_digest') AS digest_outcome
  FROM evaluations e
  JOIN sessions s ON s.sessionId = e.sessionId
  LEFT JOIN latest_digest ld ON ld.sessionId = e.sessionId
  WHERE e.createdAt >= (strftime('%s','now','-24 hours') * 1000)
    AND e.issues LIKE '%finish blocked by uncommitted changes%'
)
SELECT CASE WHEN evaluation_created_at < 1778337667000
            THEN 'pre_self_repair_patch' ELSE 'post_self_repair_patch' END AS patch_window,
       COUNT(*) AS total,
       SUM(CASE WHEN verdict='needs_improvement' THEN 1 ELSE 0 END) AS needs_improvement,
       SUM(CASE WHEN verdict='good' THEN 1 ELSE 0 END) AS good,
       SUM(CASE WHEN status='done' AND session_outcome='done' AND digest_outcome='success' THEN 1 ELSE 0 END) AS repaired_success_done,
       MIN(datetime(evaluation_created_at/1000,'unixepoch')) AS first_eval_utc,
       MAX(datetime(evaluation_created_at/1000,'unixepoch')) AS last_eval_utc
FROM base
GROUP BY patch_window
ORDER BY patch_window;
```

Result observed in this iteration:

| window | total | needs_improvement | good | repaired_success_done | first_eval_utc | last_eval_utc |
|---|---:|---:|---:|---:|---|---|
| post_self_repair_patch | 5 | 5 | 0 | 4 | 2026-05-09 14:45:36 | 2026-05-09 14:59:08 |
| pre_self_repair_patch | 227 | 227 | 0 | 221 | 2026-05-08 15:25:02 | 2026-05-09 14:16:48 |

Conclusion: the live DB outcome had not improved after the first self-repair patch. Post-patch rows were still all `needs_improvement`, including 4 repaired-success/done rows.

## Query 2 — post-patch rows by verdict/status/outcome/digest/source

```sql
WITH latest_digest AS (
  SELECT sd.*
  FROM session_digests sd
  JOIN (SELECT sessionId, MAX(created_at) AS max_created_at FROM session_digests GROUP BY sessionId) m
    ON m.sessionId = sd.sessionId AND m.max_created_at = sd.created_at
)
SELECT e.verdict, s.status, s.outcome AS session_outcome,
       COALESCE(ld.outcome,'no_digest') AS digest_outcome,
       COALESCE(s.source,'(null)') AS source,
       COUNT(*) AS n,
       MIN(datetime(e.createdAt/1000,'unixepoch')) AS first_eval_utc,
       MAX(datetime(e.createdAt/1000,'unixepoch')) AS last_eval_utc
FROM evaluations e
JOIN sessions s ON s.sessionId = e.sessionId
LEFT JOIN latest_digest ld ON ld.sessionId = e.sessionId
WHERE e.createdAt >= 1778337667000
  AND e.issues LIKE '%finish blocked by uncommitted changes%'
GROUP BY e.verdict, s.status, s.outcome, digest_outcome, source
ORDER BY n DESC, e.verdict, s.status, session_outcome, digest_outcome, source;
```

Result observed in this iteration:

| verdict | status | session_outcome | digest_outcome | source | n | first_eval_utc | last_eval_utc |
|---|---|---|---|---|---:|---|---|
| needs_improvement | done | done | success | workflow:arc-heartbeat | 2 | 2026-05-09 14:45:36 | 2026-05-09 14:59:08 |
| needs_improvement | done | done | partial | workflow:project | 1 | 2026-05-09 14:50:26 | 2026-05-09 14:50:26 |
| needs_improvement | done | done | success | workflow:may-heartbeat | 1 | 2026-05-09 14:57:44 | 2026-05-09 14:57:44 |
| needs_improvement | done | done | success | workflow:scout-explore | 1 | 2026-05-09 14:50:39 | 2026-05-09 14:50:39 |

A stricter post-`42f9a6e92` query using `e.createdAt >= 1778339127000` returned 0 finish/uncommitted rows, so there was no newer live sample yet proving the latest schema result-scope follow-up in live evaluations.

## Sampled post-patch repaired-success `needs_improvement` sessions

Sample query used `e.createdAt >= 1778337667000`, `e.verdict='needs_improvement'`, `s.status='done'`, `s.outcome='done'`, latest digest `outcome='success'`, and `e.issues LIKE '%finish blocked by uncommitted changes%'`.

### 1. `s_1778338460720_5` — arc — `workflow:arc-heartbeat`

- Evaluation: `2026-05-09 14:59:08`, `heuristicVersion=6`, issues `finish blocked by uncommitted changes; schema/query error in transcript`.
- Latest digest: `success`; session `status=done`, `outcome=done`.
- Local reclassification with current code: `good`, lane `success_candidate`, only issue `finish blocked by uncommitted changes`.
- Evidence: transcript line 34 showed the apparent schema error came from a `git diff` of evaluator code, not the session's own failed `query_db` result.
- Conclusion: stale row relative to the schema result-scope follow-up (`42f9a6e92`) / pre-follow-up classifier behavior, not a true unresolved dirty exit.

### 2. `s_1778337146359_2` — may — `workflow:may-heartbeat`

- Evaluation: `2026-05-09 14:57:44`, `heuristicVersion=6`, issues `finish blocked by uncommitted changes; schema/query error in transcript`.
- Latest digest: `success`; session `status=done`, `outcome=done`.
- Local reclassification with current code: `good`, lane `success_candidate`, only issue `finish blocked by uncommitted changes`.
- Evidence: transcript line 14 was an initial `finish()` block for `may/cron.json`, followed by a commit and a clean successful finish. The current classifier no longer sees a session-owned schema/query issue.
- Conclusion: stale row relative to current classifier; not a true unresolved dirty exit.

### 3. `s_1778338039857_18` — scout — `workflow:scout-explore`

- Evaluation: `2026-05-09 14:50:39`, `heuristicVersion=5`, issue `finish blocked by uncommitted changes` only.
- Latest digest: `success`; session `status=done`, `outcome=done`.
- Evidence: transcript line 15 showed `finish()` blocked on uncommitted `shared/knowledge/entries/KE-1200.md`; immediately afterward the session committed it (`114d062f5`) and retried `finish(success)`, which succeeded.
- Initial local reclassification before this iteration's patch still returned `needs_improvement`. Root cause: `sessionSelfRepairedOrCleanlyExited()` only treated post-blocked `partial|blocked|failure` finish calls or `git commit` + `git status` as repaired. It missed the normal path: commit, then retry `finish(success)`.
- Conclusion: classifier bug. Patched this iteration to treat any post-blocked terminal `finish(success|partial|blocked|failure)` retry as clean exit, and added a regression test.

### 4. `s_1778334667176_10` — arc — `workflow:arc-heartbeat`

- Evaluation: `2026-05-09 14:45:36`, `heuristicVersion=5`, issues `finish blocked by uncommitted changes; schema/query error in transcript`.
- Latest digest: `success`; session `status=done`, `outcome=done`.
- Local reclassification with current code: `good`, lane `success_candidate`, only issue `finish blocked by uncommitted changes`.
- Evidence: transcript shows a blocked finish during real KE collision cleanup, then further fixes/commits and successful finish. The apparent schema/query issue is cleared by the schema result-scope/current classifier.
- Conclusion: stale row relative to current classifier; not a true unresolved dirty exit.

## Patch made this iteration

Files changed:

- `agents/evaluator/workflows/evaluator-aftermath.ts`
  - In `sessionSelfRepairedOrCleanlyExited()`, inspect only the text after the last `finish() blocked [uncommitted changes]` marker.
  - Treat a subsequent `finish(success)` as repaired/clean exit, in addition to `partial|blocked|failure`.
  - Preserve failure/interrupted/session-error downgrade behavior.
- `agents/shared/tests/evaluator-aftermath.test.ts`
  - Added regression: a session whose first `finish(success)` is blocked, then commits, then retries `finish(success)` should classify as `good` and route to `success_candidate`.

Verification:

- Local reclassification of all 4 post-patch repaired-success samples now returns `good` and `success_candidate` under the current classifier.
- `bun test shared/tests/evaluator-aftermath.test.ts` passed: 27 tests, 0 failures.

## Final conclusion

The original self-repair patch was active enough for some rows to record `heuristicVersion=6`, but live routing still had two residual problems:

1. Stale/pre-follow-up rows created before the schema result-scope fix remained in the DB as `needs_improvement`.
2. A real classifier bug missed the common repaired path `finish blocked -> commit -> finish(success)` unless a `git status` appeared after the block.

This iteration patched the classifier bug and verified the current classifier routes the sampled repaired-success rows away from `needs_improvement`. There were no live post-`42f9a6e92` finish/uncommitted rows yet, so the next live validation should wait for fresh evaluations after this iteration's commit and rerun the post-commit grouping query.
