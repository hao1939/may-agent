# Heartbeat Efficiency Conditional-Skip Design

## Summary

M1 found that the latest conservative classifier does not reproduce the original 92% May heartbeat no-op rate: the measured recent sample was 23 no-op, 38 meaningful, and 21 unclear May `source='workflow:heartbeat'` sessions in the last 24h, or 28.0% no-op. However, M1 also found substantial churn mixed into heartbeat-source sessions, especially guard-remediation / artifact-gate / anti-shallow follow-up work.

The design goal is therefore not only "lower the no-op percentage"; it is to prevent avoidable full heartbeat sessions when nothing meaningful changed, while preserving fast response to real events.

## Meaningful Change Definition

A scheduled May heartbeat should run if any of these changed since the last heartbeat checkpoint:

1. New human/user input.
2. New or newly breached metric/alert.
3. Failed, interrupted, or blocked session needing owner attention.
4. Project status, plan, comment, or review state changed.
5. New event explicitly requiring May orchestration.
6. Prior heartbeat was skipped for too long and a periodic safety run is due.

A scheduled May heartbeat should skip cheaply if none of those changed.

## Skip/Run Decision Table

| Condition since last checkpoint | Decision | Reason |
| --- | --- | --- |
| No new events, no project changes, no metric changes, no failed sessions | Skip | Avoid no-op full agent session |
| New human input | Run | Human-facing responsiveness must be preserved |
| Metric breach or new unresolved alert | Run | May owns orchestration response |
| Failed/interrupted session | Run | Failure recovery should not be suppressed |
| Project status/comment/plan changed | Run | May may need to coordinate next action |
| Guard remediation / artifact-gate rerun only | Suppress or route cheaper | Do not treat remediation fanout as normal heartbeat |
| Explicit event-driven trigger | Run | Conditional skip applies primarily to scheduled heartbeat |
| Safety interval exceeded | Run | Prevent stale state if checkpoint logic misses a signal |

## Required State

The runtime skip decision needs a cheap checkpoint containing:

- Last heartbeat check timestamp.
- Last full heartbeat session timestamp.
- Last productive heartbeat timestamp if available.
- Last observed event id/timestamp.
- Last observed human input timestamp.
- Last observed failed/interrupted session timestamp.
- Last observed metric breach/alert timestamp.
- Last observed project file/status/comment timestamp or digest.
- Count of consecutive skipped scheduled heartbeats.

## Runtime Insertion Point

The safest insertion point is before creating a full May agent session for scheduled heartbeat work, after the trigger type/source is known. The skip check should only intercept scheduled May heartbeat triggers, not explicit human/event-driven work.

The worker must trace the actual runtime path in `src/` before M3 implementation, but the intended placement is:

1. Cron/event trigger identifies a May heartbeat job.
2. Runtime checks whether this is scheduled heartbeat versus explicit event/human input.
3. Conditional-skip guard reads cheap checkpoint/snapshot state.
4. If unchanged, record a cheap skip audit event and do not launch a full session.
5. If changed or bypass rule matches, launch normal heartbeat workflow/session.

## Reusable Existing Logic

Existing non-runtime workflow files should be reviewed for ideas, not assumed active:

- `agents/shared/workflows/circuit-breaker.ts`: likely useful for thresholds, consecutive skip/run safety bounds, and preventing runaway repeated work.
- `agents/shared/workflows/dispatch-dedup-guard.ts`: likely useful for duplicate trigger suppression and cooldown semantics.
- `agents/shared/workflows/heartbeat-data.ts`: likely useful for heartbeat/session/event data gathering and state classification.

M3 should adapt concepts from these files into the actual runtime path rather than adding more unintegrated workflow-only logic.

## Guard Remediation / Artifact-Gate Handling

M1 showed artifact-gate and anti-shallow prompts are a major source of `workflow:heartbeat` churn. These should not be counted as ordinary scheduled heartbeat work.

Preferred behavior:

- Detect remediation/follow-up prompts separately from scheduled heartbeat.
- Suppress duplicate remediation if the same session/artifact has already been remediated recently.
- Route remediation through a cheaper targeted path where possible.
- Preserve auditability by recording why a remediation trigger was suppressed.

## Bypass Rules and Risks

Never skip when:

- Trigger is human/user initiated.
- Trigger is explicitly event-driven.
- There is a new failed/interrupted session.
- There is a new metric breach or unresolved alert.
- Checkpoint state cannot be read safely.
- Consecutive skip count exceeds the configured safety bound.

Risks:

- False skip could delay coordination.
- Poor checkpoint state could miss file/project changes.
- Counting remediation as heartbeat could hide the real source of waste.
- Overly broad skip logic could suppress event-driven responsiveness.

Mitigation:

- Default to run on uncertainty.
- Keep skip logic narrow: scheduled May heartbeat only.
- Record every skip with reason and snapshot fields.
- Add tests for unchanged state, changed state, critical bypass, and checkpoint-read failure.

## M3 Implementation Sketch

Implementation should:

1. Trace the runtime cron/event/session path in `src/`.
2. Add a scheduled-heartbeat preflight guard before full session creation.
3. Compute a cheap current snapshot from events, sessions, metrics/alerts, and project state.
4. Compare it to the prior heartbeat checkpoint.
5. If unchanged, emit/record a skip audit record and return without launching a full May session.
6. If changed, launch the normal heartbeat and update checkpoint after completion.
7. Treat guard remediation/artifact-gate fanout as a separate trigger class, not a normal scheduled heartbeat.

## Skip Audit Record

Each skipped heartbeat should record enough data to audit behavior without launching a full session:

- timestamp
- agent: May
- trigger/job id
- decision: skipped
- reason: no meaningful change
- compared checkpoint timestamp
- current latest event/session/project/metric timestamps
- consecutive skip count
- safety-run due flag

## Verification Needed for M3

Required tests/instrumentation:

- Unchanged state skips.
- New human input runs.
- Metric breach/new alert runs.
- Failed session runs.
- Project change runs.
- Explicit event trigger bypasses skip.
- Checkpoint read failure defaults to run.
- Skipped heartbeat creates cheap audit record.
