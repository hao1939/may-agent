# Iteration 1 Addendum: Evaluator Self-Repair Classification Patch

## Problem addressed

After the prompt-path patches, fresh source attribution still showed a large 24h finish/uncommitted signature, but the latest-digest breakdown revealed that the evaluator was treating mostly repaired sessions as generic low-quality:

```sql
WITH latest_digest AS (
  SELECT d.*
  FROM session_digests d
  JOIN (
    SELECT sessionId, MAX(id) AS max_id
    FROM session_digests
    GROUP BY sessionId
  ) m ON m.sessionId=d.sessionId AND m.max_id=d.id
)
SELECT COALESCE(ld.outcome,'(no digest)') AS digest_outcome,
       s.status,
       s.outcome AS session_outcome,
       COUNT(*) AS n
FROM evaluations e
JOIN sessions s ON s.sessionId=e.sessionId
LEFT JOIN latest_digest ld ON ld.sessionId=s.sessionId
WHERE e.createdAt > (unixepoch()*1000 - 86400000)
  AND e.issues LIKE '%finish%uncommitted%'
GROUP BY COALESCE(ld.outcome,'(no digest)'), s.status, s.outcome
ORDER BY n DESC;
```

Result at patch time: **230/236** finish/uncommitted evaluations were `digest_outcome=success`, `session.status=done`, `session.outcome=done`. This means the broad low-quality driver is no longer just unresolved dirty exits; it is also stale/generic attribution for sessions that either self-repaired after an initial blocked finish or correctly exited partial/blocked rather than committing ambient dirt.

Fresh 1h attribution was only 3 sessions (`arc-heartbeat=1`, `dev-heartbeat=1`, `workflow:project/dev=1`), which supports the same conclusion: prompt-path pressure is lower, and evaluator classification now needs to separate unresolved dirty exits from repaired friction.

## Patch applied

### `agents/evaluator/workflows/evaluator-aftermath.ts`

- Bumped `HEURISTIC_VERSION` from 4 to 5.
- Added a finish/uncommitted detector over the session-owned transcript view.
- Added `sessionSelfRepairedOrCleanlyExited()`:
  - refuses to forgive terminal `error`/`interrupted` sessions or sessions with `session.error`,
  - only applies when the sole issue is `finish blocked by uncommitted changes`,
  - treats a later explicit `finish(partial|blocked|failure)` as a clean exit from ambient dirty-state pressure,
  - treats a later `git commit` plus `git status` after the blocked finish as self-repair evidence.
- Updated `classifyVerdict()` so finish-only self-repaired/clean-exit sessions remain `good` while retaining the issue string as a routing signal.
- Updated `classifyEvaluationLane()` so good sessions with finish/uncommitted friction route to `success_candidate` for output-quality review rather than generic `needs_triage`.

This does **not** hide unresolved failures: interrupted/error sessions, sessions with schema/query errors, broad generated-runtime commits, forbidden edits, metric-claim issues, or any other issue still route to `needs_triage`.

### `agents/shared/tests/evaluator-aftermath.test.ts`

Added coverage for three cases:

1. Self-repaired dirty-worktree session: blocked finish followed by `git status` and a commit stays `good` and routes to `success_candidate`.
2. Clean partial exit: blocked finish followed by `finish(partial)` stays `good` and routes to `success_candidate`.
3. Unresolved interrupted finish-only dirty-worktree session still downgrades to `needs_improvement` with quality `0.2`.

## Validation

- `bun test shared/tests/evaluator-aftermath.test.ts` passed: **23 pass, 0 fail**.
- Targeted TypeScript syntax/type check passed with no output:

```bash
cd /app/agents && node_modules/.bin/tsc --noEmit --skipLibCheck --allowImportingTsExtensions \
  --moduleResolution bundler --module esnext --target es2022 --types node \
  evaluator/workflows/evaluator-aftermath.ts shared/tests/evaluator-aftermath.test.ts
```

## Expected impact

This patch directly addresses the current live attribution mismatch: finish/uncommitted friction remains visible as a signal, but the evaluator no longer automatically classifies a completed, self-repaired, finish-only session as broad low-quality. Based on the latest digest query, the classification side of the broad low-quality bucket can drop for the large `230/236` repaired-success subset once heuristic v5 evaluations are generated, while true unresolved dirty exits and sessions with additional issues remain actionable.
