# Stale Running Session Activity Calibration

## Trigger

May sent dev a P1 implementation request on 2026-05-13: `evaluator.stale-running-session-count` flagged active long-running session `s_1778677139537_139` as stale because the metric only checks `startedAt < cutoff` for `status IN ('running','idle')`, without checking recent transcript activity.

## Findings

- `agents/may/handlers/metrics-snapshot.ts` currently measures `evaluator.stale-running-session-count` with:
  - `SELECT COUNT(*) ... WHERE status IN ('running', 'idle') AND agent NOT IN ('evaluator', 'judge', 'master') AND startedAt < ?`
- The same `startedAt`-only pattern also exists for `capability.zombie-session-count`:
  - `SELECT COUNT(*) ... WHERE status IN ('running', 'idle') AND startedAt < ?`
- Helper `sessionJsonlPath(persistDir, sessionId)` already resolves both active and archived transcript paths, and `statSync` is already imported in this handler, so the safe fix does not need new dependencies.

## Proposed Fix

Replace the pure SQL count for `evaluator.stale-running-session-count` with a bounded candidate query plus transcript activity filter:

1. Query running/idle candidates older than `staleRunningCutoff` with `sessionId, agent, startedAt`.
2. Resolve the transcript with `sessionJsonlPath(persistDir, sessionId)`.
3. Treat a candidate as stale only when the transcript is missing/unstatable or `statSync(path).mtimeMs < staleRunningCutoff`.
4. Record the stale count with `candidate.length` as sample size.

Apply the same activity-aware filter to `capability.zombie-session-count`, because that metric has the identical false-positive risk.

## Validation Plan

- Run TypeScript syntax check for `agents/may/handlers/metrics-snapshot.ts` after patching.
- Add or run a small static check proving both stale-running and zombie-session metrics reference transcript mtime rather than only `startedAt`.
- Recheck DB metric values after the next snapshot if runtime pickup is available.
