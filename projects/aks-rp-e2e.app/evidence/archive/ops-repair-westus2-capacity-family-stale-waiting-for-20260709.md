# ops-repair-westus2-capacity-family-stale-waiting-for-20260709

## Summary

Repaired the supported task-tree mutation path for structured blockers so app-ops can replace a blocked leaf's full `blocker` object, not only merge top-level fields. Then used that supported CLI path to refresh `wait-shared-westus2-managed-cluster-capacity-family-return-20260703` and remove the stale `waiting_for.sourceRunId=28676489009` that remained after the 2026-07-09 family narrowing.

## Root cause

`bun run task-tree update-text` called `updateTaskText(...)`, which only accepted `blocker?: string` in the SDK input shape and merged structured blocker updates into the existing blocker record. That merge behavior preserved nested `waiting_for` fields such as `sourceRunId`, so narrowing the westus2 capacity family away from the completed managementplane-addon run could not clear the stale nested metadata through the existing supported CLI.

## Supported fix

1. Added `--blocker-json` to `scripts/task-tree.ts` for both `add` and `update-text` usage/help.
2. Parsed `--blocker-json` as a full blocker object and passed it through the existing supported `updateTaskText(...)` / `createTask(...)` path.
3. Widened `UpdateTaskTextInput.blocker` in `projects/may-agent/packages/sdk/src/project-task-tree.ts` from `string` to `string | TaskBlocker` so the app CLI typechecks cleanly.
4. Added a CLI regression test proving full structured blocker replacement removes a prior nested `waiting_for.sourceRunId`.
5. Used the supported CLI command below to update the live blocked holder without editing runtime tree files by hand:

```bash
bun run task-tree update-text wait-shared-westus2-managed-cluster-capacity-family-return-20260703 \
  --blocker-json '{
    "condition":"Blocked only while the shared westus2 managed-cluster capacity/headroom family remains unchanged for compact app-monitoring and spec.windows-calico.vm-prerelease-containerd. 2026-07-09 owner-family refresh accepted that managementplane-addon compact/spec branches no longer belong here because reviewed local artifacts already split them into narrower same-path outcomes, while the remaining westus2 capacity family still lacks reviewed same-surface return proof or authoritative headroom recovery.",
    "category":"external-wait",
    "owner":"human",
    "resume_condition":"Resume only when one reviewed return artifact provides same-surface westus2 managed-cluster create-slot recovery proof, authoritative quota/headroom recovery proof for subscription 26fe00f8-9173-4872-9134-bb1d2e00343a in westus2, or an owner-approved replacement target for compact app-monitoring or spec.windows-calico.vm-prerelease-containerd.",
    "resume_at":"2026-07-10T18:00:00Z",
    "blocked_at":"2026-07-03T02:47:04.593Z",
    "waiting_for":{"type":"azure.capacity.available","taskId":"wait-shared-westus2-managed-cluster-capacity-family-return-20260703"},
    "observed_by":{"workflow":"project-planner","schedule":"blocked-frontier-owner-review","trigger":"project.planning.requested"},
    "observation_method":"Scheduled blocked-frontier owner review checks the stated wait condition and must unblock, replace, escalate, or keep the wait with fresh evidence.",
    "next_check_at":"2026-07-10T18:00:00Z",
    "fallback_at":"2026-07-11T18:00:00Z",
    "fallback_action":"If the wait is still true at fallback time, refresh the family with reviewed evidence or create/reuse one exact owner recovery/escalation task for the remaining westus2 capacity members instead of leaving this holder overdue."
  }'
```

## Result on the live holder

Current live holder state now shows:

- `goal` names only `compact app-monitoring` and `spec.windows-calico.vm-prerelease-containerd`
- `acceptance` names only those two remaining truthful members
- `blocker.condition` explicitly says `managementplane-addon` branches no longer belong here
- `blocker.waiting_for` is now:

```json
{
  "type": "azure.capacity.available",
  "taskId": "wait-shared-westus2-managed-cluster-capacity-family-return-20260703"
}
```

Notably absent now:

- `waiting_for.runId`
- `waiting_for.sourceRunId=28676489009`
- any dependency on the already-completed managementplane-addon run artifact as the wait target

## Verification

- `bun test ./scripts/task-tree.test.ts` passed, including the new `update-text supports full structured blocker replacement via --blocker-json` regression.
- `bun run typecheck` passed after widening the SDK input type.
- Live runtime readback from `.state/tasks/tree.json` confirmed `contains stale run? false` for `wait-shared-westus2-managed-cluster-capacity-family-return-20260703`.
- `.state/journal.jsonl` recorded a supported `task_text_updated` event at `2026-07-09T09:40:01.730Z` for the holder, proving the runtime tree changed through tooling rather than hand-editing.
