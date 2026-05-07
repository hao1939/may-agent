# Heartbeat Efficiency Conditional-Skip Design

## Summary

M1 showed that the original reported 92% May heartbeat no-op rate is not reproduced by the latest conservative classifier: recent data showed 23 no-op, 38 meaningful, and 21 unclear May `source='workflow:heartbeat'` sessions in the last 24h, or 28.0% no-op under that classifier. However, the baseline also found substantial heartbeat-source churn from guard remediation and artifact-gate/anti-shallow follow-up sessions. Therefore the M2 design should focus on reducing avoidable scheduled heartbeat sessions and suppressing/remapping remediation fanout, while preserving responsiveness for real changes.

The proposed conditional-skip behavior is:

1. Run May heartbeat when meaningful state changed since the last heartbeat.
2. Skip scheduled May heartbeat cheaply when no meaningful state changed.
3. Never skip explicit human-triggered, event-driven, failure-recovery, or alert/metric-breach work.
4. Do not treat guard-remediation/artifact-gate reruns as normal scheduled heartbeats; suppress duplicates or route them through a cheaper remediation path.

## Evidence Read

- [x] `agents/may/cron.json` — May has enabled job `name: "heartbeat"`, `agent: "may"`, `handler: "run-workflow"`, `intervalMs: 1800000`, and `handlerConfig.workflow: "may-heartbeat"`; the `on: ["heartbeat.trigger"]` field exists, but the interval job is the concrete scheduled path.
- [x] `agents/may/handlers/run-workflow.ts` — `create(ctx, entry)` loads `entry.handlerConfig`, `findWorkflow()` imports the workflow, creates a `run` with `parentSessionId: "cron:${entry.name}"`, builds `workflowCtx`, and `workflowCtx.runAgent()` calls `ctx.manager.callAgent(agentName, agentTask, { source: `workflow:${entry.name}`, workflowRunId: runId })`.
- [x] `agents/may/workflows/may-heartbeat.ts` — exports `name = "may-heartbeat"` and `execute = (ctx) => genericHeartbeat(ctx, "may")`.
- [x] `agents/shared/workflows/circuit-breaker.ts` — provides `checkCircuitBreaker()` / `recordOutcome()` using `agents/shared/circuit-breaker-state.json` and per-agent `SIGNAL-circuit-breaker.md`; it is a fail-safe before `ctx.runAgent()` inside `genericHeartbeat()`, but not a pre-cron/session skip gate.
- [x] `agents/shared/workflows/dispatch-dedup-guard.ts` — provides `shouldDispatch()`, `recordDispatch()`, and `recordOutcome()` keyed by `agent::taskPrefix` in `.state/dispatch-dedup.json`; it blocks repeated failing/running dispatches after thresholds/windows, including `shouldDispatch(agent, "heartbeat")` inside `genericHeartbeat()` and `shouldDispatch(agentName, agentTask)` in `run-workflow.ts`.
- [x] `agents/shared/workflows/heartbeat-data.ts` — `genericHeartbeat()` loads metrics/projects/alerts/heartbeat.md/inbox, checks circuit breaker and dispatch dedup, runs red metric diagnostics, constructs the heartbeat prompt, calls `ctx.runAgent(agent, prompt)`, then calls `runGates()`. `runGates()` can launch artifact/anti-shallow follow-up prompts through the same `ctx.runAgent()` path.
- [x] Runtime trigger/session path evidence — traced path is `agents/may/cron.json` scheduled job `heartbeat` → `agents/may/handlers/run-workflow.ts:create()` → `findWorkflow(..., "may-heartbeat")` → `agents/may/workflows/may-heartbeat.ts:execute()` → `agents/shared/workflows/heartbeat-data.ts:genericHeartbeat()` → `workflowCtx.runAgent()` → `ctx.manager.callAgent(... source="workflow:heartbeat", workflowRunId=runId)`; gate follow-ups from `runGates()` reuse this source because they call the same `ctx.runAgent()` facade.
- [x] M1 baseline report: `agents/dev/workspace/investigations/heartbeat-efficiency-baseline.md` — baseline used readonly SQLite and found 23 no-op, 38 meaningful, 21 unclear May `source='workflow:heartbeat'` sessions in 24h, plus remediation/artifact-gate churn mixed into the same source.

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

The traced scheduled path is:

```text
agents/may/cron.json entry name=heartbeat, handler=run-workflow, workflow=may-heartbeat
  -> agents/may/handlers/run-workflow.ts:create(ctx, entry)
     -> findWorkflow(agentDir, "may-heartbeat", sharedDir)
     -> agents/may/workflows/may-heartbeat.ts:execute(ctx)
     -> agents/shared/workflows/heartbeat-data.ts:genericHeartbeat(ctx, "may")
        -> loadMetrics/loadProjects/loadAlerts/loadHeartbeatMd/loadInbox
        -> checkCircuitBreaker(agentsRoot, "may")
        -> shouldDispatch("may", "heartbeat") / recordDispatch("may", "heartbeat")
        -> ctx.runAgent("may", prompt)
           -> workflowCtx.runAgent in run-workflow.ts
           -> ctx.manager.callAgent("may", prompt, { source: "workflow:heartbeat", workflowRunId: runId })
        -> runGates(ctx, "may", ...), which may call ctx.runAgent again for artifact/anti-shallow remediation
```

The safest immediate insertion point available in the agent-mounted files is inside `agents/may/handlers/run-workflow.ts:create()` after `const { workflow: workflowName, agent, task } = config;` and after the entry is known to be the May scheduled heartbeat (`entry.name === "heartbeat"`, `agent === "may"`, `workflowName === "may-heartbeat"`), but before `findWorkflow()`, `generateRunId()`, guard loading, and any `ctx.manager.callAgent()` path. That location can skip the entire workflow and avoid producing a `workflow:heartbeat` session.

If M3 can edit `src/`, an even safer long-term location is one layer earlier in the cron scheduler/handler dispatcher, before invoking the `run-workflow` handler at all. The gate needs the cron entry metadata (`entry.name`, `handler`, `handlerConfig.workflow`, `agent`) and current cheap snapshot; it does not need the workflow module loaded.

The conditional-skip gate should not live only inside `genericHeartbeat()`, because by that point the runtime has already dispatched the heartbeat workflow and may have emitted/recorded a workflow run. It also should not rely only on `circuit-breaker.ts` or `dispatch-dedup-guard.ts`: those gates suppress known failure loops, not no-meaningful-change scheduled liveness checks.

Concrete intended sequence:

1. Cron interval tick selects `agents/may/cron.json` entry `heartbeat`.
2. Runtime resolves handler `run-workflow` and passes the `CronEntry` to `agents/may/handlers/run-workflow.ts:create()`.
3. Before loading/running `may-heartbeat`, call `shouldSkipHeartbeat({entry, triggerKind:"scheduled"}, checkpoint, currentSnapshot)`.
4. If skip: write cheap audit record/event, update `lastScheduledCheck` and `lastSkippedAt`, and return from the handler without calling `ctx.manager.callAgent()`.
5. If run: proceed with current `findWorkflow()` → `genericHeartbeat()` path and mark checkpoint as run-started.
6. On completion: update productive/no-op/unclear classification and checkpoint using the resulting session/digest/evaluation data.

## Reusable Existing Logic

The following existing files should be reviewed for reusable concepts, but not assumed to be production-effective until integrated into `src/`:

### `agents/shared/workflows/circuit-breaker.ts`

Observed logic:
- `checkCircuitBreaker(agentsRoot, agent)` reads `agents/shared/circuit-breaker-state.json` and blocks only after `THRESHOLD = 3` consecutive errors while a per-agent `SIGNAL-circuit-breaker.md` exists.
- `recordOutcome(agentsRoot, agent, isError, errorDetail)` increments/reset state after the agent run.

Potential reuse:
- Simple JSON checkpoint load/save pattern.
- Fail-safe guard before expensive `ctx.runAgent()`.
- Manual reset semantics through signal state.

Risk:
- It is error-threshold logic, not meaningful-change logic.
- In the current path it is called inside `genericHeartbeat()` after the workflow handler has started; using the same layer is too late to avoid all workflow overhead, though it can still prevent the LLM session.

### `agents/shared/workflows/dispatch-dedup-guard.ts`

Observed logic:
- `makeKey(agent, task)` uses an 80-character normalized prefix and stores records in `.state/dispatch-dedup.json`.
- `shouldDispatch()` allows force overrides, resets outside a 7-day window, blocks explicitly blocked records, blocks after `MAX_FAILURES_BEFORE_BLOCK = 3`, and suppresses apparent still-running attempts for 2 hours.
- `recordDispatch()` and `recordOutcome()` maintain attempts/failures/status.

Potential reuse:
- Deduplication key design for remediation fanout: original session id + guard type + artifact path is safer than prompt prefix alone.
- Cooldown/window semantics and force bypass.
- Cheap state file mechanics if DB-backed checkpointing is unavailable in M3.

Risk:
- Prompt-prefix dedup is too coarse for heartbeat skip correctness and too weak for guard remediation identity.
- Deduping `ctx.runAgent()` calls does not stop the scheduled cron handler from starting unless the check is lifted before workflow execution.

### `agents/shared/workflows/heartbeat-data.ts`

Observed logic:
- `loadMetrics()`, `loadProjects()`, `loadAlerts()`, `loadInbox()`, and `loadHeartbeatMd()` already define the major state surfaces May inspects during heartbeat.
- `genericHeartbeat()` currently computes those surfaces every heartbeat, then checks circuit breaker and dispatch dedup, optionally runs red metric diagnostics, and calls `ctx.runAgent(agent, prompt)`.
- `runGates()` performs artifact/anti-shallow/impact/duration guard handling after the main session and can re-enter `ctx.runAgent()` with remediation prompts.

Potential reuse:
- Snapshot inputs: latest owner events, metric alerts, active owned projects, and heartbeat guidance are the correct domains for “meaningful change.”
- Existing red metric and inbox loaders can inform the run reasons, but should be converted to cheap timestamp/hash checks for a pre-session gate.
- The post-run `runGates()` location explains why remediation churn appears under `workflow:heartbeat` and should be remapped/deduped.

Risk:
- Full text loading/scanning of projects and heartbeat guidance before every skip decision may be too expensive; M3 should prefer mtimes, hashes, or compact DB counters.
- Because `runGates()` uses the same `ctx.runAgent()` facade, remediation sessions inherit `source="workflow:heartbeat"` unless metadata/source is changed.

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
