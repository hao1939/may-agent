# Trusted-access TA gateway family task-tree follow-up

Date: 2026-07-15T19:30Z
Task: `ops-apply-repair-trusted-access-ta-gateway-family-state-backbinding-20260715-task-tree-followup`
Attempt: `a_ops-apply-repair-trusted-access-ta-gateway-family-state-backbinding-20260715-task-tree-followup_20260715121605`

## Outcome

Evidence-backed rejection of applying the live task-tree mutation from this worker session.

Reason: task-worker mode allows bounded existing-task metadata repair only when the assigned task explicitly names the supported `task-tree` command(s) to run. This task asks for the metadata outcome, but it does not explicitly authorize a concrete `task-tree update-*` command. I therefore verified the current state, derived the exact safe mutation, and recorded the exact planner-owned command proposal below instead of mutating the live task tree from this session.

## Verified current state

### 1) Shared wait still machine-lists the archived spec wait id

Live `bun run task-tree show wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711` currently shows:

```json
"affectedTaskIds": [
  "hold-compact-trusted-access-ta-gateway-dns-runtime-frontier-20260705",
  "wait-spec-trusted-access-dataplane-token-gateway-runtime-ta-gateway-dns-return-20260703"
]
```

### 2) The listed spec wait id is not live

`bun run task-tree show wait-spec-trusted-access-dataplane-token-gateway-runtime-ta-gateway-dns-return-20260703`
returns:

```text
Task not found: wait-spec-trusted-access-dataplane-token-gateway-runtime-ta-gateway-dns-return-20260703
```

The archived record remains in `.state/tasks/archive/done-leaves-20260711131429831.json` and is the replaced/done lineage for that spec-side wait.

### 3) The app-owned spec-loop carrier already points at the live shared steward

`/app/projects/aks-rp-e2e.app/.state/spec-loop/state.json` now binds:

- `spec.trusted-access.dataplane-token-gateway-runtime.taskId = wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711`
- `review.lastAction` names the shared runtime-family wait
- `successorStateReason` names the shared runtime-family wait

So the remaining gap is only the stale structured `affectedTaskIds` member on the shared wait.

## Exact safe mutation proposal for planner/app-ops

### Proposed command

Use the supported task-tree metadata mechanism with the existing blocker unchanged except for one field:

```bash
cd /app/projects/aks-rp-e2e.app && \
  bun run task-tree update-text wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711 \
    --blocker-json '{"condition":"Rechecked live controller-visible state on 2026-07-15: compact-loop state still binds trusted-access to this exact shared TA gateway DNS/runtime family wait, and current runtime evidence still stops at *.ta.azmk8s.io reachability before any dataplane product assertion. No same-runtime or alternate-surface unblock signal exists yet, so keep this one shared runtime-family wait and advance only its review window.","category":"external-wait","owner":"aks-explorer","blocked_at":"2026-07-11T13:14:11.352Z","waiting_for":{"type":"environment.available","taskId":"wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711","family":"trusted-access-ta-gateway-dns-runtime","boundary":"*.ta.azmk8s.io","affectedTaskIds":["hold-compact-trusted-access-ta-gateway-dns-runtime-frontier-20260705"],"expectedChange":"reviewed same-runtime evidence materially changes TA gateway DNS/runtime reachability, an approved alternate surface supplies equivalent proof, or accepted evidence reclassifies the carrier out of reviewed-exception"},"observed_by":{"workflow":"project-planner","schedule":"blocked-frontier-app-ops-review","trigger":"project.planning.requested"},"observation_method":"Scheduled blocked-frontier app-ops review should treat this as trusted-access runtime-family stewardship, not approval-return closure debt, and should reconcile it only when reviewed same-runtime evidence, an approved alternate surface, or accepted reclassification materially changes the shared *.ta.azmk8s.io blocker.","next_check_at":"2026-07-16T18:45:00Z","resume_condition":"Resume when reviewed same-runtime evidence materially changes *.ta.azmk8s.io reachability or gateway assertion reach, an approved alternate surface supplies equivalent proof, or accepted evidence reclassifies the trusted-access dataplane-token gateway carrier out of reviewed-exception.","fallback_at":"2026-07-17T18:45:00Z","fallback_action":"If the same wait remains true, refresh this one trusted-access runtime-family wait with current runtime evidence and keep it scoped as non-escalation blocker stewardship rather than owner-return debt.","resume_at":"2026-07-16T18:45:00Z"}'
```

### Intended post-mutation value

```json
"affectedTaskIds": [
  "hold-compact-trusted-access-ta-gateway-dns-runtime-frontier-20260705"
]
```

Only substitute a different spec-side member if planner intentionally restores a live same-lineage replacement first.

## Post-application verification checklist

After planner/app-ops runs the mutation, verify all three facts:

1. `bun run task-tree show wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711` no longer lists archived `wait-spec-trusted-access-dataplane-token-gateway-runtime-ta-gateway-dns-return-20260703` in `blocker.waiting_for.affectedTaskIds`.
2. `/app/projects/aks-rp-e2e.app/.state/spec-loop/state.json` still binds `spec.trusted-access.dataplane-token-gateway-runtime.taskId` to `wait-shared-trusted-access-ta-gateway-runtime-family-return-20260711`.
3. The shared wait wording still scopes the blocker to the same TA gateway DNS/runtime reachability family and does not broaden the trusted-access verdict.

## Review conclusion

The requested runtime-family cleanup is fully specified and safe, but this worker session did not apply it because the task did not explicitly authorize the concrete `task-tree update-text` mutation command required by task-worker mode.