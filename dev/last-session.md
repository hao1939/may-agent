# Last Session
<!-- Auto-generated at session end. Do not edit manually. -->

- **Session:** s_1778128282023_272
- **Status:** done
- **When:** 2026-05-07T04:32:15.005Z
- **Duration:** 52s

## What Happened
PIVOT

(a) Next iteration must stop doing open-ended investigation first. The worker has produced no files for 3 consecutive iterations, so the next iteration must **write the M2 deliverable as the first tool call** using the exact content below.

Create this file:

`agents/dev/workspace/investigations/heartbeat-efficiency-conditional-skip-design.md`

with this exact initial content:

```md
# Heartbeat Efficiency Conditional-Skip Design

## Summary

M1 showed that the original reported 92% May heartbeat no-op rate is not reproduced by the latest conservative classifier: recent data showed 23 no-op, 38 meaningful, and 21 unclear May `source='workflow:heartbeat'` sessions in the last 24h, or 28.0% no-op under that classifier. However, the baseline also found substantial heartbeat-source churn from guard remediation and artifact-gate/anti-shallow follow-up sessions. Therefore the M2 design should focus on reducing avoidable scheduled heartbeat sessions and suppressing/remapping remediation fanout, while preserving responsiveness for real changes.

The proposed conditional-skip behavior is:

1. Run May heartbeat when meaningful state changed since the last heartbeat.
2. Skip scheduled May heartbeat cheaply when no meaningful state changed.
3. Never skip explicit human-triggered, event-driven, failure-recovery, or alert/metric-breach work.
4. Do not treat guard-remediation/artifact-gate reruns as normal scheduled heartbeats; suppress duplicates or route them through a cheaper remediation path.

## Evidence Read

- [ ] `agents/may/cron.json`
- [ ] `agents/shared/workflows/circuit-breaker.ts`
- [ ] `agents/shared/workflows/dispatch-dedup-guard.ts`
- [ ] `agents/shared/workflows/heartbeat-data.ts`
- [ ] Runtime trigger/session path evidence
- [ ] M1 baseline report: `agents/dev/workspace/investigations/heartbeat-efficiency-baseline.md`

## Meaningful Change Definition

A May heartbeat should run when at least one of these changed since the last heartbeat checkpoint:

1. **Human input or direct user-visible request**
   - New user task, project instruction, approval, comment, or operator message.
   - Any event/session source indicating human-initiated work.

2. **Project state changed**
   - Project file modified.
   - Project status changed to active/blocked/waiting/done.
   - New project comment or new plan item.
   - Existing active project has a ready next action that has not been observed by a heartbeat.

3. **Metric or alert changed**
   - New metric breach.
   - Metric moved from healthy to unhealthy.
   - New unresolved alert/event requiring May triage.
   - Previously unresolved alert changed state.

4. **Session failure or interruption occurred**
   - Any recent failed, errored, interrupted, timed-out, or guard-blocked session requiring supervision.
   - A worker produced a deliverable that needs orchestration/review.
   - Repeated no-output worker iterations need intervention.

5. **Relevant event/log state changed**
   - New event in the monitored event tables for May-owned workflows.
   - New workflow run requiring May’s orchestration.
   - New dispatch/fork result or review result.

6. **Periodic minimum liveness interval expired**
   - Even with no changes, run a low-frequency liveness heartbeat after a configurable maximum quiet period, e.g. 4–6 hours, to catch missed signals.

A heartbeat should be considered skippable when all of these are true:

- Trigger is scheduled/cron heartbeat, not direct/event-driven.
- No new human input since last checkpoint.
- No project status/comment/plan change since last checkpoint.
- No new metric breach or unresolved alert since last checkpoint.
- No failed/interrupted/guard-blocked sessions since last checkpoint.
- No worker deliverables pending review since last checkpoint.
- Last successful heartbeat checkpoint is recent enough to satisfy liveness requirements.

## Skip/Run Decision Table

| Condition since last heartbeat checkpoint | Decision | Reason |
|---|---:|---|
| No new events, no project changes, no metric changes, no failed sessions | Skip | Avoid no-op scheduled work |
| New human input or operator message | Run | Human-visible work must not be delayed |
| New task/project instruction | Run | May must orchestrate |
| Project status/comment/plan changed | Run | Project state requires assessment |
| Metric breach or new unresolved alert | Run | May must react to unhealthy state |
| Failed/interrupted/timed-out session | Run | Failure supervision is meaningful |
| Worker deliverable ready for verification | Run | Orchestrator/reviewer action needed |
| Guard remediation or artifact-gate rerun duplicates same source/session | Suppress or route cheaply | Do not inflate heartbeat sessions with remediation churn |
| Explicit event-driven trigger | Run | Preserve responsiveness |
| Scheduled heartbeat after max quiet/liveness interval | Run | Catch missed signals |
| Unknown trigger type or missing checkpoint state | Run and create checkpoint | Fail open until state is reliable |

## Required State

The runtime skip decision needs a cheap checkpoint record for May heartbeat state. Minimal required fields:

- Agent/workflow key, e.g. `may:heartbeat`.
- Last scheduled heartbeat check timestamp.
- Last heartbeat run timestamp.
- Last productive heartbeat timestamp.
- Last skipped heartbeat timestamp.
- Last observed event id/timestamp.
- Last observed human input id/timestamp.
- Last observed project modification timestamp or project snapshot hash.
- Last observed metric breach/alert id/timestamp.
- Last observed failed/interrupted session id/timestamp.
- Last observed worker deliverable/review-needed session id/timestamp.
- Skip reason and trigger id for auditability.

The checkpoint must be cheap to read before creating a full agent session. It should be updated when:

- A heartbeat is skipped.
- A heartbeat is launched.
- A heartbeat finishes and is classified productive/no-op/unclear.
- A bypass condition forces a run.

## Runtime Insertion Point

The safest insertion point is before full May agent session creation for scheduled heartbeat triggers, after the runtime has enough trigger metadata to distinguish scheduled cron heartbeat from explicit event-driven work.

The conditional-skip gate should not live only in `agents/shared/workflows/`, because existing mitigation files there were not integrated into the actual runtime session path and therefore do not reduce production waste. M3 must integrate with the actual runtime heartbeat trigger/handler path in `src/`.

The worker must trace and confirm the exact runtime path, but the intended location is:

1. Cron/event trigger fires.
2. Runtime resolves workflow/job identity.
3. If job is May scheduled heartbeat, call `shouldSkipHeartbeat(trigger, checkpoint, currentSnapshot)`.
4. If skip: write cheap audit record and do not create full May session.
5. If run: create session normally and mark the checkpoint as run-started.
6. On completion: update productive/no-op classification and checkpoint.

## Reusable Existing Logic

The following existing files should be reviewed for reusable concepts, but not assumed to be production-effective until integrated into `src/`:

### `agents/shared/workflows/circuit-breaker.ts`

Potential reuse:
- Repeated-trigger suppression.
- Failure/no-op threshold ideas.
- Cooldown windows.
- Fail-open behavior when state is unavailable.

Risk:
- If only invoked inside workflow execution, it is too late to prevent session creation cost.

### `agents/shared/workflows/dispatch-dedup-guard.ts`

Potential reuse:
- Deduplication key design.
- Duplicate dispatch suppression.
- Guard-remediation/fanout identification.

Risk:
- Deduping dispatches does not necessarily dedupe cron/session creation unless called before session launch.

### `agents/shared/workflows/heartbeat-data.ts`

Potential reuse:
- Heartbeat data snapshot concepts.
- Last-observed state aggregation.
- Productive/no-op classification hints.

Risk:
- Snapshot queries must be cheap enough to run before every scheduled heartbeat.

## Guard Remediation / Artifact-Gate Handling

M1 showed many `source='workflow:heartbeat'` sessions appear to be guard remediation or artifact-gate/anti-shallow follow-up, not ordinary scheduled heartbeat no-ops.

Design rule:

- Do not count remediation fanout as normal heartbeat liveness.
- Use a separate trigger/source or metadata field where possible, e.g. `workflow:guard-remediation` instead of `workflow:heartbeat`.
- Suppress duplicate remediation for the same original session/artifact/guard within a cooldown window.
- If remediation requires a full agent, launch the specific owning agent/workflow instead of May’s generic heartbeat.
- If remediation is only asking for a missing artifact/read-back, prefer a cheap workflow-level correction before forking a full heartbeat.

## Bypass Rules and Risks

### Bypass Rules

Always run, regardless of skip state, when:

- Trigger is explicit human input.
- Trigger is an event-driven alert or metric breach.
- Trigger is a project status/comment/update event.
- Trigger is a failed/interrupted session requiring review.
- Trigger carries `force`, `manual`, `review`, `approval`, or equivalent metadata.
- Checkpoint state is missing/corrupt/ambiguous.
- Max quiet/liveness interval has expired.

### Risks

1. **False skip**
   - Risk: May misses real work.
   - Mitigation: fail open on unknown state, keep liveness runs, record skip audits.

2. **State query too expensive**
   - Risk: skip gate costs nearly as much as heartbeat.
   - Mitigation: store compact checkpoint/counters; avoid scanning large logs each time.

3. **Metric gaming**
   - Risk: no-op rate appears lower because sessions are hidden.
   - Mitigation: record skipped heartbeat attempts with reasons and monitor skip correctness.

4. **Remediation suppression hides real failures**
   - Risk: duplicate suppression blocks needed guard correction.
   - Mitigation: dedupe by original session/guard/artifact and use short cooldowns; fail open after repeated failures.

5. **Implementation in wrong layer**
   - Risk: workflow-only logic still launches full sessions.
   - Mitigation: M3 must integrate before session creation in `src/`.

## M3 Implementation Sketch

M3 should implement a pre-session conditional gate for scheduled May heartbeats:

1. Identify scheduled May heartbeat trigger.
2. Load heartbeat checkpoint for `may:heartbeat`.
3. Load or compute cheap current snapshot:
   - latest relevant event timestamp/id
   - latest human input timestamp/id
   - latest project modification timestamp/hash
   - latest metric breach/alert timestamp/id
   - latest failed/interrupted session timestamp/id
   - latest pending-review/deliverable timestamp/id
4. Compare snapshot to checkpoint.
5. Decide:
   - `run` with reason codes if any meaningful change exists.
   - `skip` with reason code `no_meaningful_change` if unchanged.
   - `run` with reason `fail_open` if state is unavailable.
6. If skipped:
   - record audit row/event
   - update last scheduled check and last skipped timestamp
   - do not create full May session
7. If run:
   - create full May heartbeat session
   - update checkpoint with run-started metadata
8. On session completion:
   - classify productive/no-op/unclear if possible
   - update last productive heartbeat if meaningful
   - record completion outcome

Recommended tests/instrumentation:

- Unchanged state scheduled heartbeat skips.
- New human event bypasses skip and runs.
- New metric breach bypasses skip and runs.
- New failed session bypasses skip and runs.
- Missing checkpoint runs and creates checkpoint.
- Duplicate guard remediation within cooldown suppresses or routes cheaply.
- Skip audit is recorded without full session creation.

## Skip Audit Record

Every skipped heartbeat should leave a cheap audit trail with at least:

- timestamp
- agent
- workflow/job id
- trigger id/source
- decision: `skip`
- reason code, e.g. `no_meaningful_change`
- checkpoint id/version
- current snapshot summary
- last run timestamp
- last productive timestamp

This preserves observability and prevents the metric from being gamed by invisible skips.

## M2 Acceptance Criteria

M2 is complete when:

- This design file exists and has been read back.
- Runtime trigger path evidence has been filled in with actual file/function names.
- Existing shared workflow files have been reviewed and summarized.
- The design includes skip/run rules, required state, insertion point, bypass rules, risks, and M3 implementation sketch.
```

(b) What’s different: the project is no longer asking the worker to discover the structure from scratch. The worker should write the exact M2 design seed first, then only fill in the unchecked evidence section and runtime path details after reading the relevant files.

(c) First step: call `write()` immediately with the exact content above. Then read the new file back. After that, inspect the listed files and update the Evidence Read / Runtime Insertion Point sections with concrete file/function names. Finish only after reading the final file back and listing it in deliverables.

I updated `project.md` to record the third no-output iteration and the requirement to break the loop with exact-content writing.
