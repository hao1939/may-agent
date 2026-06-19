---
id: evaluator-aftermath-recentness-gap
owner: evaluator
status: active
type: milestone
priority: P1
iteration: 0
---

# Evaluator Aftermath Recentness Gap

## Goal
Restore recent-session aftermath coverage so evaluator-owned liveness metrics reflect current work rather than a multi-day FIFO backlog.

## Signals
- `evaluator.aftermath-coverage-rate-3h`: target `> 0.8`, current `0`
- `session.failed-triage-rate-3h`: target `1`, current `0`
- `workflow_runs` for `evaluator-aftermath` in the last 3h: `23` backfill runs, `0` completion-triggered runs
- `events.session.completed` in the last 3h: `288`
- Recent evaluation lag: current reviewed sessions are mostly from `2026-06-05`, roughly `333h` old

## Current State
On 2026-06-19 heartbeat triage, both owned red metrics are real live breaches, not stale alert rows and not the older clean-start contamination described in KE-805.

Fresh canonical DB evidence:
- `metrics` rows still read `evaluator.aftermath-coverage-rate-3h.current=0` and `session.failed-triage-rate-3h.current=0`
- Latest `metric_snapshots` show both metrics pinned at `0` across repeated measurements, with sample sizes rising (`aftermath sample_size 184 -> 266`, `failed-triage sample_size 5 -> 9`)
- The evaluator process is alive, but the work mix is wrong: `workflow_runs` shows `23` `evaluator-aftermath` backfill runs in the last 3h and `0` completion-triggered `session.completed` runs, despite `288` `session.completed` events in the same window
- Recent `evaluation.reviewed` events are still aimed at sessions from `2026-06-05`, and fresh `evaluations` rows show lag around `333h` for most reviewed sessions
- Direct recomputes show `275` recent terminal non-evaluator sessions in-window with `275` missing evaluations, and `11` failed sessions with `0` triaged/evaluated in-window

This is not a total evaluator outage. It is a scheduling/routing failure: current aftermath review is dominated by oldest-first backfill while the recent-session lane appears absent or starved.

## Plan
1. Keep the red metrics explicitly judged as `upgrade_or_escalate` until a safe owner-visible fix path exists.
2. Escalate the narrowed failure mode to May/human: `session.completed` events are landing, but recent completion-triggered evaluator-aftermath runs are absent while backfill continues.
3. Ask the runtime owner to decide between:
   - restoring direct completion-triggered aftermath dispatch,
   - prioritizing recent failed/recent terminal sessions over deep FIFO backlog,
   - or recalibrating the two metrics until scheduling semantics change.
4. Recheck the next heartbeat for:
   - nonzero completion-triggered `evaluator-aftermath` runs,
   - reviewed session timestamps moving from June 5 toward present,
   - metric recovery above threshold.

## Validation
- `workflow_runs` shows completion-triggered `evaluator-aftermath` runs again
- `evaluation.reviewed` events reference recent sessions rather than 14-day-old backlog items
- `evaluator.aftermath-coverage-rate-3h` rises above `0.2` and trends toward `0.8`
- `session.failed-triage-rate-3h` returns to `>= 0.8` and ideally `1`

## Journal
- 2026-06-19 08:55Z: Opened from evaluator heartbeat after fresh metric triage confirmed both owned red metrics are live breaches. KE-2049 explains why the old downstream-only story is no longer sufficient: aks-explorer throughput recovered, but evaluator reviews remain stuck on a 333h FIFO backlog. Fresh runtime evidence narrows the active failure further: in the last 3h there were `288` `session.completed` events and `23` `evaluator-aftermath` backfill runs, but `0` completion-triggered aftermath runs. Escalated the decision to May/human and will validate by workflow-run mix, reviewed-session recency, and metric recovery.