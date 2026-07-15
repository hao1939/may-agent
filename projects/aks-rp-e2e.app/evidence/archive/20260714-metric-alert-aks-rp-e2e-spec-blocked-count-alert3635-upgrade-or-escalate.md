# Metric alert triage — `aks-rp-e2e.spec.blocked-count` — alert `3635`

- Metric id: `aks-rp-e2e.spec.blocked-count`
- Alert id: `3635`
- Judged at: `2026-07-14T18:10:00Z`
- Chosen operation: `upgrade_or_escalate`

## Judgment

The breach is still real (`73 > 10`), but another `waiting_with_evidence` refresh would no longer be responsible. This alert has now repeated across **four completed app-ops triage sessions plus a same-day dedicated family review task** without recovery, and the remaining decision is a **metric-policy / app-process design choice**, not a safe worker-side state fix.

Because this session has read-only runtime DB access and filesystem evidence tools only, the correct final operation is `upgrade_or_escalate`: record an explicit project-context escalation asking the owner/human to decide whether `aks-rp-e2e.spec.blocked-count` should stay as an interrupting `P2` signal or be split/calibrated the way `aks-rp-e2e.task.blocked-count` already was.

## Current evidence checked

### Runtime metric rows still show a real breach and clear companion health signals

Fresh runtime inspection confirmed:

- `aks-rp-e2e.spec.blocked-count`: `current=73`, `threshold=10`, `target=0`, `priority=P2`
- `aks-rp-e2e.task.blocked-actionable-count`: `current=0`, `threshold=0`, `priority=P2`
- `aks-rp-e2e.spec.unverified-without-work`: `current=0`, `threshold=0`, `priority=P0`
- `aks-rp-e2e.task.no-work-with-gaps`: `current=0`, `threshold=0`, `priority=P0`

So the blocked-spec inventory is high, but the stronger process-failure signals are all clear.

### The alert is current, not stale

- alert row `3635` is still unresolved
- the latest ten persisted samples are all `73`
- fresh source-command recompute still returns `73`

Commands run:

```bash
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.spec.blocked-count
cd /app/projects/aks-rp-e2e.app && bun scripts/project-metrics.ts aks-rp-e2e.spec.blocked-count --json
```

Results:

- `73`
- `{"measuredAt":1784052589483,"treePath":"/app/projects/aks-rp-e2e.app/.state/tasks/tree.json","value":73}`

### Live task-tree state still shows exact blocked-wait stewardship

Fresh `bun run task-tree summary` showed:

- `counts.blocked = 123`
- `counts.active = 3`
- `counts.review = 1`
- no runnable frontier leaves
- active frontier leaves are domain follow-up work elsewhere in the project, not spec-loop runnable recovery

Fresh `bun run task-tree show aks-spec-verification-loop` showed:

- root state: `blocked`
- `workflowProgress.executionDrained = true`
- `workflowProgress.noRefillNow = true`
- `workflowProgress.blockedWaitChildren = 68`
- `workflowProgress.activeChildren = 0`
- `workflowProgress.reviewChildren = 0`
- `workflowProgress.waitingChildren = 0`
- `workflowProgress.backlogChildren = 0`
- blocker owner: `aks-explorer`
- observer workflow: `spec-loop-controller`
- `next_check_at = 2026-07-14T18:18:55.743Z`
- fallback: rerun rollup/owner review at `2026-07-15T18:08:55.743Z` if the child-blocked stewardship still holds

This remains a truthful represented blocked frontier, not a stale alert caused by missing task state.

### Repetition across owner sessions is now the critical fact

Since alert creation, app-ops has already judged this same alert in these completed triage sessions:

- `s_1784022611201_26`
- `s_1784030292680_16`
- `s_1784037688546_34`
- `s_1784045018485_76`

In addition, same-day task evidence in `evidence/archive/ops-review-spec-blocked-count-alert-family-20260714b.md` already concluded:

- no hidden actionable blocker-burn-down repair is justified from the current snapshot, and
- calibration is **not** worker-safe yet because `aks-rp-e2e.spec.blocked-count` still lacks a companion actionable signal or explicit dashboard-only policy.

That means the repeated wait posture has exhausted its evidentiary usefulness. The unresolved question is now a project-policy decision about metric behavior.

## Why not another operation

- **Not `fix_root_cause`**: current evidence shows no safe app-ops state repair; the frontier is already represented and exact.
- **Not `resolve_stale`**: runtime row, snapshots, and source recompute all still show `73`.
- **Not `waiting_with_evidence`**: this same alert has already been refreshed repeatedly without recovery; repetition is now itself the signal.
- **Not `downgrade_priority`** or **`calibrate_metric`**: those require a deliberate runtime metric-policy change, and this session does not have a safe runtime write path.
- **Not `document_exception`**: there is no approved temporary exception text or expiry on this metric.

## Exact escalation recorded in project context

Owner/human decision requested:

1. **Either keep `aks-rp-e2e.spec.blocked-count` as an interrupting signal**, but then explicitly document the blocker text / review condition that justifies repeated `73`-level exact wait stewardship; **or**
2. **calibrate the metric design** so raw blocked-spec inventory is separated from actionable blocked-spec failure, analogous to the existing split between `aks-rp-e2e.task.blocked-count` and `aks-rp-e2e.task.blocked-actionable-count`.

Minimum acceptable follow-up change after this escalation:

- add an explicit `spec.blocked-actionable`-style companion metric and downgrade raw inventory, **or**
- deliberately retain the current `P2 threshold=10` behavior with explicit blocker/review text explaining why repeated exact waits should continue to interrupt.

This escalation is recorded here because the current session can create durable evidence but cannot safely mutate runtime metric rows.

## Next validation

Validate on the next `metrics-snapshot` after the owner/human policy decision, or immediately if the live metric changes from `73` or any companion health metric rises above `0`.