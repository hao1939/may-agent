# Final review bundle — evaluator false-good calibration

## Recommendation
**Ready for review/merge.**

The dominant false-good churn mechanism identified in the audit is now addressed in code, covered by focused regression tests, and validated against representative real audited transcripts. The live 24h `evaluation.false_good` baseline remains elevated, but that should be treated as **pre-merge comparison context**, not evidence that the fix failed.

## 1) Problem statement from the audit
Iteration 1 audited the latest 30 `evaluation.false_good` events and found the dominant issue was **not** threshold tuning:

- `good session with material output: project artifact` — **18**
- `good session with material output: project artifact, knowledge update` — **11**
- `good session with material output: file write/edit, knowledge update` — **1**

So **29/30** recent false-good overturns came from the heuristic believing a session produced a `project artifact` and/or `knowledge update`.

The audit localized the main mechanism to `transcriptOutputSignals()` in `agents/evaluator/workflows/evaluator-aftermath.ts`: raw transcript text, especially `git status --short` output, could mention unrelated dirty `projects/...` or `agents/.../knowledge/...` paths and accidentally create material-output signals. `classifyEvaluationLane()` then promoted those `good` sessions into the `success_candidate` lane, where review later downgraded them.

## 2) Code-level hardening summary
Iteration 2 hardened the routing logic without changing thresholds:

- In `agents/evaluator/workflows/evaluator-aftermath.ts`, `transcriptOutputSignals()` now derives `project artifact` and `knowledge update` only from actual assistant `write` / `edit` / `apply_patch` tool-call paths.
- `classifyEvaluationLane()` still routes true material-output sessions to `success_candidate`, but keeps `good` sessions with only non-material signals in `routine_ok` unless the finish/uncommitted self-repair path applies.
- No threshold changes were made.

Current code evidence:

- `transcriptOutputSignals()` adds `project artifact` only when assistant write/edit/apply_patch paths match `projects/.../(outputs/|project.md|journal.md)`.
- `transcriptOutputSignals()` adds `knowledge update` only when assistant write/edit/apply_patch paths match `agents/.../knowledge/...`.
- `classifyEvaluationLane()` returns `routine_ok` when a `good` session has no material output signal.

## 3) Focused regression test evidence
Focused test file:
- `agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts`

Regression intent:
- prove that dirty-worktree text like `git status --short` no longer creates `project artifact` / `knowledge update`
- retain positive detection for real assistant writes to `projects/...` and `agents/.../knowledge/...`

Exact command:

```bash
cd /app && bun test ./agents/evaluator/workflows/__tests__/evaluator-aftermath.test.ts
```

Recorded output:

```text
42 pass
0 fail
89 expect() calls
Ran 42 tests across 1 file.
```

Key regression expectations now encoded in tests:
- dirty `git status --short` output containing `projects/...` and `agents/.../knowledge/...` yields only non-material signals and routes to `routine_ok`
- a real `write("agents/evaluator/knowledge/new-pattern.md", ...)` still yields `knowledge update` and routes to `success_candidate`

## 4) Real-session replay validation
Iteration 3 replayed representative real audited transcripts through the current `transcriptOutputSignals()` and `classifyEvaluationLane()` code.

### Replay summary table

| Session | Prior issue | Current signals | Current lane |
|---|---|---|---|
| `s_1779066050617_1` | ambient `git status --short` text mentioned `projects/...` and `agents/.../knowledge/...` | `verification command`, `workflow-linked session` | `routine_ok` |
| `s_1779064237055_0` | same ambient dirty-path contamination route | `verification command`, `workflow-linked session` | `routine_ok` |
| `s_1779053381283_494` | same contamination route from unrelated dirty worktree text | `verification command`, `workflow-linked session` | `routine_ok` |
| `s_1779051581305_487` | ambient dirt + runtime-adjacent artifact confusion | `verification command`, `workflow-linked session` | `routine_ok` |
| `s_1773429903935_1211` | positive control: true knowledge write | `file write/edit`, `knowledge update`, `verification command` | `success_candidate` |
| `s_1779098046289_8` | positive control: true project artifact write | `file write/edit`, `git commit`, `project artifact`, `verification command` | `success_candidate` |

Interpretation:
- representative audited false-good sessions that previously looked material due to transcript contamination now emit only non-material signals and route to `routine_ok`
- true knowledge/project writes still route to `success_candidate`

## 5) Current 24h baseline using `events.timestamp`
Current pre-merge baseline query:

```sql
SELECT event_type, COUNT(*) AS count
FROM events
WHERE event_type IN ('evaluation.false_good','evaluation.reviewed','evaluation.success_candidate')
  AND timestamp >= (CAST(strftime('%s','now') AS INTEGER) - 86400) * 1000
GROUP BY event_type
ORDER BY event_type;
```

Current results:
- `evaluation.false_good`: **52**
- `evaluation.reviewed`: **134**
- `evaluation.success_candidate`: **115**

Derived sample false-good rate:
- **38.8%** = `52 / 134`

Important interpretation:
- this is the **pre-merge / pre-deploy comparison baseline**
- it does **not** invalidate the implementation, because the audit + code + tests + replay already show the dominant contamination route is blocked in the current source

## 6) Merge rationale
This bundle is sufficient for review because it closes the loop from problem to fix:

1. **Audit:** identified a specific dominant failure mode (`git status --short` transcript contamination).
2. **Implementation:** constrained material-output signals to real assistant write/edit/apply_patch paths.
3. **Regression tests:** proved the contamination path is blocked and true positives remain.
4. **Real-session replay:** showed representative audited false-good sessions now reroute to `routine_ok` while legitimate project/knowledge writes still qualify as `success_candidate`.
5. **Operational baseline:** captured the exact 24h pre-merge counts for later comparison.

## 7) Post-merge monitoring query
Run this exact query after merge/deploy, then compare the resulting 24h counts against the pre-merge baseline above:

```sql
WITH counts AS (
  SELECT event_type, COUNT(*) AS count
  FROM events
  WHERE event_type IN ('evaluation.false_good','evaluation.reviewed','evaluation.success_candidate')
    AND timestamp >= (CAST(strftime('%s','now') AS INTEGER) - 86400) * 1000
  GROUP BY event_type
)
SELECT
  COALESCE(MAX(CASE WHEN event_type='evaluation.false_good' THEN count END), 0) AS false_good,
  COALESCE(MAX(CASE WHEN event_type='evaluation.reviewed' THEN count END), 0) AS reviewed,
  COALESCE(MAX(CASE WHEN event_type='evaluation.success_candidate' THEN count END), 0) AS success_candidate,
  ROUND(
    1.0 * COALESCE(MAX(CASE WHEN event_type='evaluation.false_good' THEN count END), 0)
    / NULLIF(COALESCE(MAX(CASE WHEN event_type='evaluation.reviewed' THEN count END), 0), 0),
    4
  ) AS false_good_rate_sample
FROM counts;
```

Expected post-merge outcome:
- `evaluation.false_good` should fall relative to `evaluation.reviewed`
- `false_good_rate_sample` should move down from the current **0.3881** baseline
- `evaluation.success_candidate` may also fall somewhat if contaminated no-op heartbeats stop being over-promoted

## Bottom line
The project is now at the right handoff point: **review/merge, then monitor**. More implementation or replay is unlikely to add meaningful confidence compared with this audit → fix → test → replay → baseline chain.