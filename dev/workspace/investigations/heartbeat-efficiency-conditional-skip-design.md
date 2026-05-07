# Heartbeat Efficiency Conditional Skip Design (M2)

## Purpose

M1 established that May `workflow:heartbeat` sessions include real scheduled heartbeats mixed with guard-remediation churn and other reruns. The M2 design goal is therefore not simply to reduce the headline no-op percentage; it is to preserve event-driven responsiveness while cheaply suppressing heartbeats when there has been no meaningful change since the last productive heartbeat, and to route guard follow-up work so it is visible as remediation rather than another ordinary heartbeat.

## Runtime path traced

Evidence reviewed:

- `agents/may/cron.json`: the May heartbeat entry is enabled, named `heartbeat`, has `intervalMs: 1800000`, `agent: "may"`, `handler: "run-workflow"`, and `handlerConfig.workflow: "may-heartbeat"`. It also declares `on: ["heartbeat.trigger"]`, but prior KEs and the current docs indicate interval ticks are the reliable path.
- `agents/may/handlers/run-workflow.ts`: the handler loads the workflow file, builds `workflowCtx`, and calls `wf.execute(workflowCtx)`. Its `workflowCtx.runAgent()` calls `ctx.manager.callAgent(agentName, agentTask, { source: `workflow:${entry.name}`, workflowRunId: runId })`, so the session row for the May heartbeat is `source='workflow:heartbeat'`.
- `agents/may/workflows/may-heartbeat.ts`: the workflow is a thin wrapper: `execute = (ctx) => genericHeartbeat(ctx, "may")`.
- `agents/shared/workflows/heartbeat-data.ts`: `genericHeartbeat()` loads metrics, projects, alerts, heartbeat.md, and inbox; checks circuit breaker and dispatch dedup; optionally runs red metric diagnostics; calls `ctx.runAgent(agent, prompt)`; then runs artifact/anti-shallow/impact/duration gates via `runGates()`.
- `agents/shared/may-agent-docs/cron.md` and `agents/shared/may-agent-docs/heartbeat.md`: docs describe `cron.json -> Cron class -> handlers` and `Cron tick -> heartbeat handler -> loads context -> runs agent session`, with auto-heartbeat notes. Runtime reality for May is the explicit `cron.json` entry overriding any auto-generation.

Current practical path:

```text
Cron interval tick for agents/may/cron.json entry name=heartbeat
  -> run-workflow handler in agents/may/handlers/run-workflow.ts
    -> load agents/may/workflows/may-heartbeat.ts
      -> genericHeartbeat(ctx, "may") in agents/shared/workflows/heartbeat-data.ts
        -> load DB/file context
        -> circuit breaker / dispatch dedup / red metric diagnostics
        -> ctx.runAgent("may", prompt)
          -> manager.callAgent(... source="workflow:heartbeat", workflowRunId=runId)
        -> runGates() may spawn remediation sessions/prompts
```

## Precise definition: meaningful change since last heartbeat

A meaningful change is any persisted signal that could reasonably change May's autonomous decision compared with the last productive May heartbeat. The decision boundary should be based on cheap snapshots, not an LLM classification.

For May, meaningful change since `last_observed_at` means at least one of:

1. **Human input:** a new human-originated task/comment/message/event exists after `last_observed_at`.
2. **Metric breach or alert:** a metric owned by May newly breaches threshold, an unresolved alert is created/reopened, or a previously breaching metric changes enough to require reassessment.
3. **Session failure/interruption:** any agent has a failed/interrupted/error session after `last_observed_at`, or a running session becomes stale.
4. **Project change:** a project status, milestone, comment, owner, health, or actionable project artifact changes after `last_observed_at`.
5. **Inbox event:** an event targeted to May, or a system event May owns, arrives after `last_observed_at` and is not expired by TTL.
6. **Scheduled freshness floor:** no productive heartbeat has run within a maximum interval, even if no signal changed, so May can still perform periodic discovery.

Not meaningful by itself:

- Another ordinary heartbeat tick with the same snapshots as the previous tick.
- Gate-driven artifact/anti-shallow/duration/impact remediation caused by the current heartbeat's own guard checks.
- Handler bookkeeping (`handler.started`/`handler.completed`) for the heartbeat being considered.
- Metric snapshots whose measured values and breach state are unchanged and have no new alert.

## Skip/run decision table

| Condition since last observed/productive heartbeat | Decision | Reason |
|---|---:|---|
| No new events + no metric/project/session changes | **Skip** | The prompt would be materially identical; running an LLM session is waste. |
| New human input | **Run** | Human input is high-priority and may require coordination or dispatch. |
| Metric breach or new alert | **Run** | May owns system coordination and should react to red metrics/alerts. |
| Failed/interrupted/error session since last heartbeat | **Run** | Failures are a core May accountability signal. |
| Project status/comment/change since last heartbeat | **Run** | Project state changes can require dispatch, review, or escalation. |
| Guard remediation / artifact-gate rerun | **Suppress or route differently** | It should not be counted as a fresh heartbeat trigger. Record as `workflow:heartbeat:<gate>` or a remediation event/session to avoid mixing with original scheduled heartbeat baselines. |
| Stale maximum interval exceeded, e.g. >4h since productive May heartbeat | **Run** | Preserves discovery/autonomy even when explicit signals are quiet. |
| Skip-state read/query fails | **Run** | Fail-open; missed responsiveness is worse than one extra heartbeat. |
| Manual force/bypass flag present | **Run** | Human/operator override. |

## State required for a cheap decision

The skip gate should need O(1) or small bounded queries. Proposed state:

- `last_heartbeat_started_at`: last scheduled heartbeat dispatch time for May.
- `last_productive_heartbeat_at`: last May heartbeat that produced a meaningful artifact/action or handled a meaningful signal.
- `last_observed_at`: high-water mark used for change detection.
- `last_snapshot`: compact JSON containing:
  - latest relevant event id/timestamp for May-owned inbox events;
  - count and max timestamp of unresolved May-owned metric alerts;
  - hash of active May-owned metrics' `{id,current,threshold,alert_op,breached}`;
  - count/max timestamp of failed/interrupted sessions system-wide, optionally grouped by agent;
  - hash/max mtime of May-owned active project files and comments;
  - latest workflow run/session id considered.
- `skip_count_since_run`: counter to enforce a freshness floor and help metrics.
- `last_skip_reason`: diagnostic string.

A DB-backed state table would be ideal, but because agents must not write DB directly, M3 should either add a handler/runtime writer or use existing event emission. Minimal cheap record when skipped: emit an event such as `heartbeat.skipped` with owner `may`, reason, snapshot hash, last productive timestamp, and suppressed trigger path. If event emission is persisted by the runtime, that gives both visibility and measurement without opening a second writer.

## Safest runtime insertion point

The safest insertion point is in `agents/shared/workflows/heartbeat-data.ts` at the start of `genericHeartbeat()`, immediately after cheap context loads (`loadMetrics`, `loadProjects`, `loadAlerts`, `loadInbox`) and before:

- circuit breaker `recordDispatch()`;
- red metric diagnostic command execution;
- `ctx.runAgent()`;
- `runGates()`.

Why this point:

1. It is on the canonical May path (`may-heartbeat.ts -> genericHeartbeat`) and also benefits other generic-heartbeat agents if enabled per-agent.
2. The existing `shouldSkipHeartbeat()` function already lives in this file, but current `genericHeartbeat()` does not call it. M3 can replace/extend this helper rather than adding another hidden mechanism.
3. At this point the workflow already has a `WorkflowContext` with `ctx.getDb()` and `ctx.emit()`, so the decision can be DB-backed and observable.
4. It avoids creating a May LLM session at all, which is where the cost is.

Do **not** put the first implementation inside `run-workflow.ts` unless the workflow context needs to avoid even loading heartbeat-data. `run-workflow.ts` is generic infrastructure for all workflows; heartbeat-specific signal rules there would be harder to reason about and risk blocking non-heartbeat workflows. A later M3/M4 can add an optional preflight hook in `run-workflow` once the heartbeat-local policy is proven.

## Review of reusable logic

### `circuit-breaker.ts`

Reusable pattern:

- Small JSON state file keyed by agent.
- Fail-open/manual reset behavior via SIGNAL file deletion.
- Simple functions: `checkCircuitBreaker()`, `recordOutcome()`, `resetCircuitBreaker()`.

Design implication: the heartbeat skip gate can follow the same explicit state-file pattern if DB writes are not available. However, unlike the circuit breaker, skip state is not an error throttle; it should never create a human-removable blocking file. It should be observable as routine scheduling telemetry.

### `dispatch-dedup-guard.ts`

Reusable pattern:

- Cheap task-key hashing/prefixing.
- Windowed attempt records.
- `shouldDispatch()` followed by `recordDispatch()`/`recordOutcome()`.
- `force` override.

Design implication: M3 should mirror `shouldDispatch()` with a `shouldRunHeartbeat(agent, snapshot, opts)` API returning `{ decision: "run"|"skip", reason, snapshotHash }`. Reuse `force` semantics and cleanup/windowing, but do not treat skips as failures.

Important caveat: `genericHeartbeat()` already calls `shouldDispatch(agent, "heartbeat")`, while `run-workflow.ts` also dedups each `ctx.runAgent(agent, prompt)` by the full prompt. The skip gate should be evaluated before recording a heartbeat dispatch, otherwise skipped ticks will pollute dispatch-attempt counters.

### `heartbeat-data.ts`

Reusable/observed logic:

- `loadMetrics()`, `loadAlerts()`, `loadInbox()`, `loadProjects()` already collect much of the signal needed to determine obvious run conditions.
- `shouldSkipHeartbeat()` already exists with a coarse policy: skip only when no red metrics, no alerts, no inbox, no projects, and a recent handler.completed heartbeat exists.
- `genericHeartbeat()` currently does **not** call `shouldSkipHeartbeat()`, so M3 should integrate or replace it.
- `runGates()` currently turns shallow/fast/no-artifact heartbeat sessions into follow-up LLM work. M1 found this churn is mixed into `source='workflow:heartbeat'`; M3 should label or emit these as guard-remediation, not fresh scheduled heartbeats.

## Risks and bypass rules

Risks:

1. **False skip:** a signal exists but is not captured by the snapshot. Mitigation: fail open on query errors, include broad session/project/alert/event checks, and enforce a maximum no-run interval.
2. **Metric staleness:** if metrics are stale but unchanged, skipping may hide the stale-measurement problem. Mitigation: include snapshot freshness; run if metrics have not been measured recently.
3. **Project file mtime ambiguity:** filesystem mtime/hash checks can be noisy. Mitigation: start with shared project files owned by May plus DB project metadata if available; treat comments/status changes as run signals.
4. **Guard loop suppression hides quality failures:** suppressing guard remediation must not erase it. Mitigation: route as `heartbeat.guard_remediation` events or sessions with explicit source labels and metrics.
5. **Agent-specific differences:** May's heartbeat is generic; dev/arc/scout historically had custom workflows. Mitigation: enable policy first for May, then consider opt-in for other agents.

Bypass/run rules:

- Any human/operator/manual force flag runs.
- Any new human input runs.
- Any new unresolved alert or breach runs.
- Any failed/interrupted session runs.
- Any skip-state corruption/query error runs.
- Any agent disabled/circuit-breaker-open state should emit/record the existing circuit-breaker result, not masquerade as an idle skip.
- Maximum silence floor, e.g. run at least once every 4 hours even if all snapshots are identical.

## Concrete M3 implementation sketch

1. **Add a new helper in `heartbeat-data.ts`:**

```ts
export function shouldRunHeartbeat(ctx, agent, inputs, opts?) {
  // inputs: metrics, alerts, inbox, projects loaded by existing helpers
  // returns { decision: "run" | "skip", reason, snapshot, changedSignals }
}
```

2. **Decision inputs:**

- Existing strings: `metrics`, `alerts`, `inbox`, `projects`.
- DB checks using readonly/runtime `ctx.getDb()`:
  - latest relevant `events` row for owner/urgency/human input;
  - unresolved `metric_alerts` joined to May-owned `metrics`;
  - recent `sessions` with status in `error`, `interrupted`, `failed` or stale `running`;
  - latest `metric_snapshots` for May-owned metrics;
  - latest prior `heartbeat.skipped`/`heartbeat.ran_productive` event for state.
- Filesystem project hash/mtime for May-owned active project directories if DB project metadata is insufficient.

3. **Integrate in `genericHeartbeat()` before `recordDispatch(agent, "heartbeat")`:**

```ts
const decision = shouldRunHeartbeat(ctx, agent, { metrics, alerts, inbox, projects });
if (decision.decision === "skip") {
  ctx.emit({
    type: "heartbeat.skipped",
    agent,
    reason: decision.reason,
    snapshotHash: decision.snapshot.hash,
    lastObservedAt: decision.snapshot.lastObservedAt,
    changedSignals: decision.changedSignals,
  });
  ctx.log(`[heartbeat:${agent}] skipped: ${decision.reason}`);
  return ctx.done(`heartbeat skipped: ${decision.reason}`);
}
```

4. **Record productive runs:** after `ctx.runAgent()` and gate handling, emit a `heartbeat.completed` or `heartbeat.productive` event with `agent`, `sessionId`, `workflowRunId`, `snapshotHash`, `changedSignals`, `status`, and `gateTriggered` if known. If the current workflow cannot know productivity reliably, initially record `heartbeat.ran` and let M4 improve productivity labeling.

5. **Route guard remediation differently:** in `runGates()`, when artifact/anti-shallow/impact/duration gates re-prompt, emit structured events with `type: "heartbeat.guard_remediation"`, `gate`, `agent`, original session id if available, elapsed seconds/tool calls, and action. If changing session `source` for gate follow-ups is possible, use `source='workflow:heartbeat:<gate>'`; otherwise event telemetry at least makes the churn separable.

6. **Tests/smoke checks:** update `agents/shared/tests/heartbeat-data.test.ts` for:

- no changes -> skip and emits `heartbeat.skipped`;
- human input -> run;
- red metric/new alert -> run;
- failed session -> run;
- project present/changed -> run;
- DB error -> run;
- force option -> run;
- skipped heartbeat does not call `ctx.runAgent()` or `recordDispatch()`.

## What should be recorded when skipped

At minimum, every skipped heartbeat should create observable telemetry equivalent to:

```json
{
  "type": "heartbeat.skipped",
  "agent": "may",
  "reason": "idle-no-meaningful-change",
  "trigger": "cron:heartbeat",
  "lastProductiveHeartbeatAt": 1778120000000,
  "lastObservedAt": 1778120000000,
  "snapshotHash": "...",
  "skipCountSinceRun": 1,
  "checkedSignals": ["events", "metric_alerts", "metrics", "sessions", "projects"],
  "changedSignals": []
}
```

This preserves accountability: skipped ticks are visible, measurable, and auditable, without spending an LLM call.

## Recommendation

For M3, implement a conservative May-only skip gate inside `genericHeartbeat()` using the existing loaders plus DB high-water checks. Start by suppressing only the safest case: no inbox, no active alerts/breaches, no failed/interrupted/stale sessions, no May-owned project changes, no new human input, and a productive heartbeat within the freshness floor. Separately label guard remediation so future baselines can distinguish scheduled heartbeat demand from quality-gate churn.

## Verification

This report was updated and re-verified in the current iteration after reading the required runtime and workflow evidence. Concrete evidence checked:

- `agents/may/cron.json` confirms the May `heartbeat` cron entry is enabled, runs every 1,800,000 ms, uses handler `run-workflow`, and passes `handlerConfig.workflow: "may-heartbeat"`.
- `agents/may/handlers/run-workflow.ts` confirms the workflow handler creates `workflowCtx.runAgent()` and calls `ctx.manager.callAgent(...)` with a source template equivalent to `workflow:<entry.name>`, so May scheduled heartbeat sessions appear with `source='workflow:heartbeat'`.
- `agents/may/workflows/may-heartbeat.ts` confirms the May workflow delegates directly to `genericHeartbeat(ctx, "may")`.
- `agents/shared/workflows/heartbeat-data.ts` confirms `shouldSkipHeartbeat()` exists but `genericHeartbeat()` does not call it; the actual path loads metrics/projects/alerts/inbox, checks circuit breaker and dispatch dedup, records dispatch, runs red-metric diagnostics, calls `ctx.runAgent()`, and then calls `runGates()`.
- `agents/shared/workflows/circuit-breaker.ts` and `agents/shared/workflows/dispatch-dedup-guard.ts` confirm reusable patterns for cheap state, fail-open/manual override, force semantics, windowed attempts, and record-before/after APIs.
- `agents/shared/may-agent-docs/cron.md` and `agents/shared/may-agent-docs/heartbeat.md` confirm the documented cron-to-handler-to-heartbeat data flow and auto-heartbeat behavior, with explicit cron entries overriding auto-generated heartbeats.

Structural check: the report contains the requested sections for meaningful-change definition, skip/run table, required state, runtime insertion point, reusable logic review, guard-remediation handling, bypass risks, M3 implementation sketch, and skip audit record.
