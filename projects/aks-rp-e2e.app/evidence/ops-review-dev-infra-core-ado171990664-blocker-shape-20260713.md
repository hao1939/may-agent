# Ops review: dev-infra-core ADO run 171990664 blocker shape

Date: 2026-07-13
Task: `ops/review-dev-infra-core-ado171990664-blocker-shape-20260713`
Subject wait: `ops/wait-dev-infra-core-ado171990664-live-validation-result-20260713`

## Scope

Review whether the existing blocked wait for Azure DevOps run `171990664` should remain the truthful live representation, or whether it should be replaced by visible environment diagnosis/escalation work.

## Checks performed

1. Inspected the current task-tree record for both the passive wait and this review task.
2. Checked local app artifact path `.state/spec-loop/artifacts/171990664`.
3. Checked domain workspace artifact locations under `workspace/` and `evidence/archive/` for any existing `171990664` result material.
4. Tested Azure DevOps visibility from this environment:
   - `az` CLI is not installed in the domain workspace environment.
   - direct HTTPS requests to the ADO build results/API URL for run `171990664` redirect to Azure sign-in (`302`), so the live run state is not anonymously inspectable here.

## Facts

### Current wait shape in the task tree

The blocked wait already records an exact external dependency:

- run id: `171990664`
- pipeline id: `467665`
- branch: `dev`
- commit: `2c9d7c78a366856b80f6f1cc8165f5757c25bfc8`
- feature set: `dev-infra-core`
- target: `staging`
- run URL: `https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=171990664`
- `next_check_at`: `2026-07-13T13:45:00Z`
- `fallback_at`: `2026-07-13T16:30:00Z`

The wait's own blocker text already says it should be replaced only if this review finds a better active diagnosis/escalation representation.

### Artifact visibility

No local artifact directory or result material for run `171990664` is currently present in the checked locations:

- app path: `.state/spec-loop/artifacts/171990664`
- domain paths: `workspace/**171990664*`, `evidence/archive/**171990664*`

That means there is no local evidence yet that the run is terminal or that result inspection can begin.

### Live ADO visibility from this worker session

This worker session cannot perform an authenticated ADO run-state check:

- `az pipelines runs show --id 171990664` is unavailable because `az` is not installed.
- direct GET requests to the run results/API endpoints return a sign-in redirect, proving the run is private/auth-gated from this environment rather than publicly queryable.

### Baseline blocked-frontier contributor set

Computed as if this review task did not exist, the relevant blocked-frontier contributor remains:

- `ops/wait-dev-infra-core-ado171990664-live-validation-result-20260713`

Post-review represented set is unchanged: the same exact wait still truthfully represents the live dependency.

## Diagnosis

At this review time, there is **no evidence** that the passive wait has gone stale or become misleading:

- the wait was just created at `2026-07-13T13:28:17Z`;
- its first scheduled re-check (`13:45Z`) has not yet expired relative to this review session;
- no terminal artifacts are present locally;
- no authenticated ADO access is available here to prove terminal failure, long-running stall, or environment-specific error details;
- no separate environment incident, escalation packet, or alternate execution surface for this exact run is visible in current checked evidence.

Because of that, replacing the wait now with diagnosis/escalation work would be speculative rather than evidence-backed.

## Planner-facing recommendation

Keep the existing exact wait as the single truthful next step.

Recommended planner action:

1. Preserve `ops/wait-dev-infra-core-ado171990664-live-validation-result-20260713` as the live holder.
2. Refresh only its review timing if needed; do **not** replace it with environment diagnosis/escalation work yet.
3. Re-open diagnosis/escalation only if one of these becomes true:
   - run `171990664` is still active past the recorded fallback window,
   - authenticated ADO inspection shows a stuck/canceled/failed state without usable artifacts,
   - or a concrete environment error signal appears that is stronger than the current exact run wait.

## Conclusion

The current truthful representation is still: **wait for ADO run `171990664` to finish and for artifacts to become available**. No stronger evidence-backed replacement blocker shape was found in this session.
