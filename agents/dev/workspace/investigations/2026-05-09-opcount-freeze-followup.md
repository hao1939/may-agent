# OpCount freeze follow-up from dev heartbeat

## Trigger
Two P1 evaluator messages asked dev to act on recent aftermath findings:

- `message.created` event 538049: session `s_1778296286695_475` had workflow facts `opCount=0` while the transcript showed tool calls.
- `message.created` event 538009: session `s_1778296535448_481` failed the artifact gate and also showed schema-assumption query errors.

This artifact records the heartbeat disposition and evidence so the signal does not disappear into transient inbox context.

## Current finding
The opCount mismatch is not isolated to the two reviewed sessions. A runtime DB check during this heartbeat found:

- Last 24h sessions: `1120` total, `1120` with `opCount=0`, `0` with `opCount>0`.
- Last non-zero `sessions.opCount`: `1778143960496` (`2026-05-07T08:52:40.496Z`).
- Recent 6h sample: every listed session across evaluator, may, scout, arc, and dev has `opCount=0`, including completed sessions with substantial wall time.

This confirms and extends the existing shared KE-796 finding: `sessions.opCount` is frozen at zero post-cutoff and should not be used as a live effort/tool-call proxy until the runtime writer is fixed or a replacement counter is available.

## What changed this heartbeat
No runtime fix was attempted: the relevant writer appears outside editable `agents/` source (KE-796 notes the mechanism is likely in the runtime/binary path), and DB writes are restricted to safe system handlers. I treated the evaluator `opCount` request as **acted** by revalidating the symptom against current DB state and recording a durable follow-up here.

For `s_1778296535448_481`, the actionable local lesson is already incorporated into the dev heartbeat instructions: use canned queries, inspect `PRAGMA table_info(...)` before uncertain runtime DB queries, write an artifact early, read it back, and commit it before `finish()`.

## Event dispositions
- **Acted:** P1 investigation request for `s_1778296286695_475`; confirmed current global freeze, linked it to KE-796, and recorded the operational warning here.
- **Acted:** P1 status update for `s_1778296535448_481`; this session used canned/schema-safe queries and produced this artifact before finish.
- **Dismissed as already remediated:** prior artifact-gate session.start/session.end cluster; this heartbeat created and read back a real investigation artifact.
- **Dismissed:** older evaluator scoring sanity-check request; it was handled by `agents/dev/workspace/investigations/2026-05-09-evaluator-scoring-pipeline-sanity-check.md` and subsequent evaluator project iterations.

## Operational guidance until fixed
- Do not interpret `opCount=0` as proof of no work for sessions after `2026-05-07T08:52:40Z`.
- Use transcript tool-call evidence, deliverable files, session duration, commits, and evaluation issues instead.
- Queries like `WHERE opCount > 10` returning no rows are telemetry-unavailable signals, not evidence of efficient sessions.

## Verification snippets used

```sql
SELECT COUNT(*) AS total,
       SUM(CASE WHEN opCount=0 THEN 1 ELSE 0 END) AS zero_ops,
       SUM(CASE WHEN opCount>0 THEN 1 ELSE 0 END) AS nonzero_ops,
       MIN(startedAt) AS min_startedAt,
       MAX(startedAt) AS max_startedAt
FROM sessions
WHERE startedAt > unixepoch()*1000 - 24*3600*1000;
```

```sql
SELECT MAX(startedAt) AS last_nonzero_startedAt,
       COUNT(*) AS nonzero_sessions
FROM sessions
WHERE opCount > 0;
```
