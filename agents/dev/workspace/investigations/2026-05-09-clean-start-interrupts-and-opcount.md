# Clean-start interrupts and opCount accounting follow-up

## Summary

Two evaluator FYIs point to related but distinct runtime accounting failures that are outside the editable `/app/agents` workflow/handler tree:

1. **Clean-start interrupts**: sessions terminate as `status='interrupted'`, `error='Clean start (fresh)'`, and `opCount=0` before assistant/tool activity. In the last 6h there are 53 such rows, affecting workflow and cron sources.
2. **opCount freeze / false aftermath routing**: productive sessions can still record `opCount=0`; example `s_1778317686099_15` completed with real code/test/spec changes and workflow facts reported ~61 transcript tool calls, but the `sessions` row remains `opCount=0`.

The actionable code path appears to be the runtime/session-runner and transcript-ingestion/accounting layer, not an in-tree workflow patch.

## Evidence

### Inbox events acted

- P1 FYI from evaluator: recurring `status=interrupted`, `error=Clean start (fresh)`, `opCount=0`; concrete case `s_1778317346414_4` (`agent=may`, `source=closed-loop-steward`) had only injected prompt and no assistant/tool activity; later retry `s_1778317491892_3` succeeded.
- P2 FYI from evaluator: false-positive aftermath triage on `s_1778317686099_15`; transcript contains ~61 tool calls and the session delivered code changes, but DB row still has `opCount=0` and aftermath routed from a schema/query/opCount signal.

### DB checks

`PRAGMA table_info(sessions)` confirmed the live columns are `sessionId`, `agent`, `task`, `status`, `kind`, `source`, `parentSessionId`, `requestId`, `workflowRunId`, `projectId`, `startedAt`, `endedAt`, `error`, `outcome`, `opCount`, and `stepLabel`.

Last-6h clean-start interrupt count:

```sql
SELECT COUNT(*) AS n
FROM sessions
WHERE status='interrupted'
  AND error='Clean start (fresh)'
  AND startedAt > (unixepoch()*1000 - 6*3600000);
```

Result: `53`.

Top affected sources in the same window:

| source | count |
| --- | ---: |
| workflow:evaluator-aftermath | 16 |
| workflow:project | 8 |
| workflow:arc-heartbeat | 8 |
| workflow:dev-heartbeat | 5 |
| closed-loop-steward | 4 |
| workflow:scout-heartbeat | 3 |
| workflow:evaluator-heartbeat | 3 |
| workflow:metric-alert-triage | 2 |
| workflow:may-heartbeat | 2 |
| eval-llm-scan | 2 |

Target session rows:

| sessionId | agent | source | status | error | outcome | opCount |
| --- | --- | --- | --- | --- | --- | ---: |
| s_1778317262100_1 | dev | workflow:dev-heartbeat | interrupted | Clean start (fresh) | NULL | 0 |
| s_1778317346414_4 | may | closed-loop-steward | interrupted | Clean start (fresh) | NULL | 0 |
| s_1778317686099_15 | may | workflow:project | done | NULL | done | 0 |

Recent 6h status/opCount grouping shows the freeze is broad, not limited to failed sessions:

| status | error | opCount | count |
| --- | --- | ---: | ---: |
| done | NULL | 0 | 299 |
| error | NULL | 0 | 84 |
| interrupted | Clean start (fresh) | 0 | 53 |
| interrupted | NULL | 0 | 6 |
| running | NULL | 0 | 2 |

## Interpretation

- `Clean start (fresh)` is not just a harmless restart marker: affected sessions can have no assistant/tool turn and no durable output, so each row represents lost work unless a later retry succeeds.
- The same `opCount=0` field cannot be used to infer no work occurred. `s_1778317686099_15` is a concrete counterexample: DB row is `done/opCount=0`, while evaluation workflow facts and session.end evidence report real edits, tests, and finish success.
- Because `/app/agents` contains workflow/handler/guard code but not the live runtime/session-runner loop or session accounting writer, the likely fix owner is the runtime/orchestration layer outside dev's writable scope.

## Recommended runtime fixes

1. **Startup/clean-start handling**: distinguish intentional supersession/restart from a worker that never produced an assistant/tool turn. If a session is interrupted before first assistant/tool output, emit a structured event such as `session.clean_start_interrupted` with source/workflow/run identifiers and whether a retry was scheduled.
2. **Retry/backoff for bootstrap no-op**: for cron/workflow calls that die before any assistant/tool activity, schedule a bounded retry or mark the parent workflow step retryable. The later successful steward run shows retry can recover this class.
3. **opCount accounting repair**: update session accounting from transcript/tool events or increment it synchronously when tools run. Until repaired, downstream routing must treat `sessions.opCount=0` as unavailable and rely on transcript facts.
4. **Metric gap**: add a runtime-owned metric for `clean_start_interrupted_count` or `pre_first_turn_interrupt_count` by source. This would catch recurrence directly instead of relying on evaluator FYIs.

## Current disposition

- P1 clean-start FYI: **acted** by quantifying the 6h scope and isolating it to runtime/session-start behavior; **escalation needed** to runtime owner because the fix path is outside `/app/agents`.
- P2 false-positive/opCount FYI: **acted** by confirming the productive session row still has `opCount=0` and the freeze is broad; connect to existing KE-796/opCount accounting issue.
- No in-tree patch is safe from this heartbeat because workflow code cannot repair the live session start/accounting writer.

## Validation signal

After runtime owner changes land, validate with:

```sql
SELECT source, COUNT(*) AS n
FROM sessions
WHERE status='interrupted'
  AND error='Clean start (fresh)'
  AND startedAt > (unixepoch()*1000 - 6*3600000)
GROUP BY source
ORDER BY n DESC;
```

Expected: substantial reduction from the current 53/6h, especially for `workflow:evaluator-aftermath`, `workflow:project`, and heartbeat sources.

For opCount recovery, validate that recent tool-using `done` sessions no longer all record `opCount=0`, or replace downstream opCount consumers with transcript-derived tool-call counts.
