# Reusable Business Workflows

Status: proposal for review

## Purpose

The current long-running loops repeat three kinds of AKS RP E2E business work:

```text
feature -> collect official doc/API behavior references
spec    -> create or repair executable scenario test
feature -> create or repair compact execution package
```

These are business workflows. They should be reusable outside the loop that
scheduled them. A loop decides which item needs work next; the business
workflow owns how that work is done, what artifact it writes, and what
structured result it returns.

The target shape is:

```text
loop/manual task
  -> task.workflow=<business workflow>
  -> business workflow updates domain artifacts
  -> business workflow emits structured project.task.completed
  -> task-reviewer judges result
  -> planner applies accept/retry/follow-up/escalation
```

## Workflow Inventory

### feature-reference-research

Purpose:

```text
feature packet + existing specs/tests -> official behavior references
```

Inputs:

- `capabilityId` or `featureKey`;
- feature root packet and branch packets;
- existing feature-owned specs and scenario tests;
- optional source hints, search terms, or fixture directory.

Outputs:

- official Microsoft Learn references;
- Azure REST API spec references;
- supported inputs and constraints;
- unsupported/deprecated behavior;
- gaps or contradictions against current specs/tests;
- proposed feature packet, spec, or note updates.

Durable artifact:

```text
features/<capability>/notes/<topic>.md
features/<capability>/packets/*.yaml
```

Draft or one-off research may still land under `evidence/archive/` until a
review promotes it into the feature-owned layout.

### spec-test-author

Purpose:

```text
feature-owned spec JSON -> executable scenario test
```

Inputs:

- `specId`;
- `features/<capability>/specs/<spec>.json`;
- owning feature packet and reference packets;
- nearby scenario tests under `features/<capability>/tests/`;
- reusable helpers under `../aks-rp-e2e/runner/scenario-lib/`;
- optional failure/result refs when repairing an existing test.

Outputs:

- created or repaired `features/<capability>/tests/<scenario-test>.ts`;
- spec updates when the spec contract is incomplete or misleading;
- validation result for private-source policy, live admission, and check mode;
- live-readiness classification and exact blocker when not ready.

This is the largest missing reusable workflow. Today agents repeatedly do this
work by hand in loop leaves. The reusable workflow should make the standard
path explicit:

```text
read spec
derive setup/operation/assertion/cleanup
choose scenario-lib helpers
create or repair scenario test
verify no private source dependency
verify live gate and cleanup path
run check-mode when possible
return structured authoring result
```

### feature-compact-packager

Purpose:

```text
feature-owned specs -> compact plan -> generated Vitest check -> live proof
```

Inputs:

- `capabilityId`;
- target profile, normally `staging`;
- feature-owned specs;
- knowledge model route/DAG data;
- optional previous compact result or repair reason.

Outputs:

```text
features/<capability>/compact/staging.plan.json
features/<capability>/compact/staging.diagnostics.json
features/<capability>/compact/staging.summary.md
```

The workflow should also record:

- selected spec coverage;
- shared route proof;
- carrier gaps;
- generated check-mode result;
- live GitHub proof result when requested;
- exact environment/product/test/spec blocker when live proof is not achieved.

This workflow should wrap the domain runner command rather than reimplementing
the planner:

```bash
bun runner/feature-compact.ts <capability> --target staging --check
bun run execute features/<capability>/compact/staging.plan.json --check --parallel=<n>
bun run execute features/<capability>/compact/staging.plan.json --parallel=<n>
```

## Shared Result Contract

Every reusable business workflow should finish with the same structured result
shape. Free-form summary text is review material only.

```json
{
  "contractVersion": "business-workflow-v1",
  "workflow": "spec-test-author",
  "subject": {
    "kind": "spec",
    "id": "spec.localdns.cluster-topology",
    "capabilityId": "localdns"
  },
  "decision": "done",
  "classification": "ready",
  "changedFiles": [
    "features/localdns/tests/localdns-cluster-topology.ts"
  ],
  "evidenceRefs": [],
  "resultRefs": [
    "runs/test-results/example/result.json"
  ],
  "checks": [
    {
      "name": "private-source-policy",
      "status": "pass"
    }
  ],
  "nextActions": [],
  "rerunRecommended": true,
  "rerunReason": "scenario test changed and now passes check-mode",
  "blocker": null,
  "reason": "Scenario test is now executable without private source."
}
```

Allowed `decision` values:

- `done`: requested business artifact is complete enough for review.
- `no_change`: artifact was already current for the input fingerprint.
- `needs_repair`: workflow produced a diagnosis but could not safely complete
  the artifact.
- `blocked`: external, product, environment, or permission blocker with a
  resume condition.

Allowed `classification` values:

- `ready`
- `model_gap`
- `spec_gap`
- `test_gap`
- `carrier_gap`
- `planner_gap`
- `product_gap`
- `environment_blocked`
- `infra_blocked`
- `source_gap`
- `unknown`

If a workflow needs deterministic routing, it must emit structured fields in
this result. The planner, reviewer, and loops must not infer control decisions
from prose.

## Task Shape

Business workflows are normal task workflows. They do not need special events.

Example spec authoring task:

```json
{
  "id": "author-spec-localdns-cluster-topology",
  "workflow": "spec-test-author",
  "goal": "Create or repair the scenario test for spec.localdns.cluster-topology.",
  "context": {
    "specId": "spec.localdns.cluster-topology",
    "capabilityId": "localdns",
    "mode": "repair-or-create",
    "target": "staging"
  },
  "conflict_scope": [
    "spec:spec.localdns.cluster-topology",
    "feature:localdns"
  ]
}
```

Example compact package task:

```json
{
  "id": "compact-feature-localdns",
  "workflow": "feature-compact-packager",
  "goal": "Create and live-prove the staging compact package for localdns.",
  "context": {
    "capabilityId": "localdns",
    "target": "staging",
    "liveProof": true,
    "parallel": 50
  },
  "conflict_scope": [
    "feature:localdns",
    "compact:localdns"
  ]
}
```

## Loop Usage

Loops should only schedule business workflows.

```text
feature-reference loop
  -> feature-reference-research tasks

spec loop
  -> single-spec-verifier when a test is live-ready
  -> spec-test-author when the spec/test/carrier is not live-ready

feature-compact loop
  -> feature-compact-packager tasks
  -> spec-test-author tasks for carrier gaps
```

The loop state remains a ledger of item status, attempts, latest proof, and
latest blocker. The business workflow result is the input that updates that
ledger. The loop should not duplicate feature research, test authoring, or
compact planning logic.

## Manual Usage

Each business workflow should be useful without a loop. The operator should be
able to create or assign one task for a specific subject, and the same workflow
should run:

```text
research references for localdns
author test for spec.localdns.cluster-topology
build compact package for workload-identity
```

The domain repo should also expose deterministic commands where possible. The
app workflow may orchestrate the task, call agents, and perform review-friendly
validation, but core domain commands stay in `../aks-rp-e2e`.

## Idempotency

Business workflows should record an input fingerprint in their structured
result:

```json
{
  "inputFingerprint": {
    "workflowVersion": "spec-test-author-v1",
    "spec": "<hash>",
    "featurePacket": "<hash>",
    "existingTest": "<hash>",
    "failureResult": "<hash>"
  }
}
```

If the same fingerprint already produced `needs_repair` or `blocked`, the next
run should not blindly repeat the same work. It should either:

- no-op with the existing blocker;
- run because an input changed;
- run because the task explicitly asks for a different strategy.

## Review And Ownership

Business workflows may edit domain artifacts, but they do not accept their own
work. Normal review still applies:

```text
business workflow -> project.task.completed -> task-reviewer -> planner
```

The reviewer checks:

- did the workflow satisfy the task acceptance criteria?
- are changed files scoped to the subject and conflict scope?
- did validations actually run or give a concrete blocker?
- is the proposed rerun meaningful?
- are model/spec/test changes supported by docs, API, result, or source?

The planner remains the task-tree mutation owner. It accepts the result, asks
for rework, creates follow-up tasks, or records an exact wait.

## Implementation Order

1. Add shared result helpers:

   ```text
   workflows/lib/business-workflow-result.ts
   ```

2. Wrap current feature reference collector as `feature-reference-research`.

3. Implement `spec-test-author` with a conservative first version:

   - load spec and feature context;
   - inspect existing test or nearby tests;
   - repair missing live gate, private-source dependency, result writing,
     cleanup, and check-mode path;
   - return `needs_repair` when full generation needs human/model judgment.

4. Wrap current feature compact planner as `feature-compact-packager`.

5. Update loop controllers to schedule the business workflow when their ledger
   classification indicates that business work is needed, instead of creating
   generic prose repair leaves.

6. Add integrity checks:

   - all registered business workflow names exist;
   - each business workflow can emit `business-workflow-v1`;
   - task examples validate against the task-tree schema;
   - loops do not create business repair leaves without a `workflow`.

## Success Criteria

The design is working when the same workflow can be used in all three places:

```text
manual targeted task
loop-generated child task
planner-generated repair task
```

The repeated human/agent work should shrink to reviewing structured outputs and
scoped diffs, not rediscovering how to collect references, author scenario
tests, or build compact packages for every feature.
