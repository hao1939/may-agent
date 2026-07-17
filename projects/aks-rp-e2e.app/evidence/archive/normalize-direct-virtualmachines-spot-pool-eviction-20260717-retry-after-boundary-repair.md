# Re-verify `spec.virtualmachines.spot-pool-eviction` after boundary repair

Date: 2026-07-16
Task: `normalize-direct-virtualmachines-spot-pool-eviction-20260717-retry-after-boundary-repair`
Attempt: `a_normalize-direct-virtualmachines-spot-pool-eviction-20260717-retry-after-boundary-repair_20260716191111`

## Read order used

1. `model/knowledge-map/README.md`
2. `design/archive/legacy-replay-execution/automation.md` (`replays/execution/automation.md` is absent in this checkout)
3. `/app/projects/aks-rp-e2e.app/evidence/archive/ops-repair-normalization-virtualmachines-agentpool-review-boundary-20260716.md`
4. prior domain evidence:
   - `evidence/archive/normalize-direct-virtualmachines-spot-pool-eviction-20260717-current-validation.md`
   - `evidence/archive/normalize-direct-virtualmachines-spot-pool-eviction-20260717-domain-followup-proposal.md`
5. isolated-worktree spec/test artifacts under `workspace/normalize-direct-virtualmachines-spot-pool-eviction-20260717-wt/`

## Boundary precondition

This retry assumes the app-side normalization-root repair already landed. The current controlling app memo says reviewer/planner validation now unions feature roots inferred from task outputs with the `spec:` token root, so `spec.virtualmachines.*` tasks pointing at `features/virtualmachines-agentpool/...` are no longer rejected solely for using the repo's real feature folder.

Source: `/app/projects/aks-rp-e2e.app/evidence/archive/ops-repair-normalization-virtualmachines-agentpool-review-boundary-20260716.md`

## Reviewed isolated-worktree proof

Executed in:
`/app/projects/aks-rp-e2e/workspace/normalize-direct-virtualmachines-spot-pool-eviction-20260717-wt`

Command:
```bash
git rev-parse HEAD
git merge-base HEAD origin/dev
git rev-parse origin/dev
git status --short
git rev-list --first-parent --reverse $(git merge-base HEAD origin/dev)..HEAD
git diff --name-only origin/dev...HEAD | sort
```

Observed proof:

- `baseRef`: `origin/dev`
- `baseCommit`: `ed9bcf570e84a874d6117bf20f68f759fe5cd476`
- `sourceCommit`: `cbd263dec702348ae8352ab9c39ffce3c70a18a0`
- `sourceVersion`: `cbd263dec702348ae8352ab9c39ffce3c70a18a0`
- `firstParentCommits`:
  - `cbd263dec702348ae8352ab9c39ffce3c70a18a0`
- `worktreePath`: `/app/projects/aks-rp-e2e/workspace/normalize-direct-virtualmachines-spot-pool-eviction-20260717-wt`
- `changedFiles`:
  - `features/virtualmachines-agentpool/compact/staging.plan.json`
  - `features/virtualmachines-agentpool/notes/virtualmachines-spot-pool-eviction-mounted-boundary-20260629.md`
  - `features/virtualmachines-agentpool/specs/virtualmachines-spot-pool-eviction.json`
  - `features/virtualmachines-agentpool/tests/virtualmachines-spot-pool-eviction-live.ts`
  - `features/virtualmachines-agentpool/tests/virtualmachines-spot-pool-eviction.test.ts`
  - `features/virtualmachines-agentpool/tests/virtualmachines-spot-pool-eviction.ts`

Interpretation:
- `BASE == ORIGIN_DEV`
- the worktree is clean
- first-parent lineage is one task commit
- the reviewed commit remains isolated to the expected `virtualmachines-agentpool` family

## Exact normalized spec/test state on the reviewed commit

Primary files:
- `features/virtualmachines-agentpool/specs/virtualmachines-spot-pool-eviction.json`
- `features/virtualmachines-agentpool/tests/virtualmachines-spot-pool-eviction.test.ts`

Observed key facts:
- spec id remains `spec.virtualmachines.spot-pool-eviction`
- `implementation.path` = `features/virtualmachines-agentpool/tests/virtualmachines-spot-pool-eviction.test.ts`
- `probeRef` = `features/virtualmachines-agentpool/tests/virtualmachines-spot-pool-eviction.test.ts`
- `mutationGate` = `virtualmachines-spot-pool-eviction`
- source scenario remains `Scenario_Machines_Spot`
- legacy wrapper files are absent on this reviewed commit:
  - `features/virtualmachines-agentpool/tests/virtualmachines-spot-pool-eviction-live.ts`
  - `features/virtualmachines-agentpool/tests/virtualmachines-spot-pool-eviction.ts`

## Local re-verification on the reviewed isolated commit

### 1) Direct local check

Command:
```bash
bun features/virtualmachines-agentpool/tests/virtualmachines-spot-pool-eviction.test.ts --check
```

Result: pass.

Key pass signals:
- direct Vitest carrier path is the only active implementation/probe ref
- compact plan points at the direct `.test.ts` carrier only
- exact eight-step `Scenario_Machines_Spot` sequence remains documented
- legacy `.ts` / `-live.ts` wrappers are absent

### 2) Direct Vitest execution in non-mutating mode

Command:
```bash
bun x vitest run features/virtualmachines-agentpool/tests/virtualmachines-spot-pool-eviction.test.ts --root .
```

Result:
```text
Test Files  1 passed (1)
Tests       1 passed (1)
```

### 3) Affected spec dry-run

Command:
```bash
bun run spec spec.virtualmachines.spot-pool-eviction --dry-run
```

Result: pass.

Observed generated run:
- plan `single-virtualmachines-spot-pool-eviction`
- Vitest ran `features/virtualmachines-agentpool/tests/virtualmachines-spot-pool-eviction.test.ts`
- executor reported `result=passed`

### 4) Required live-dispatch local policies

Commands:
```bash
bun runner/check-private-source-policy.ts --specs spec.virtualmachines.spot-pool-eviction
bun runner/check-live-admission.ts --specs spec.virtualmachines.spot-pool-eviction
```

Results:
- `Live execution dependency policy passed for 1 selected spec(s).`
- `Live admission policy passed for 1 selected spec(s).`

### 5) Safety behavior

Commands:
```bash
bun features/virtualmachines-agentpool/tests/virtualmachines-spot-pool-eviction.test.ts --execute
AKS_RP_E2E_VITEST_MODE=live AKS_RP_E2E_ALLOW_CLOUD_MUTATION=virtualmachines-spot-pool-eviction bun features/virtualmachines-agentpool/tests/virtualmachines-spot-pool-eviction.test.ts --check
```

Results:
- ungated `--execute` returned `Status: gated`
- `--check` still passed even with the mutation env present

## Strict audit / frontier non-regression evidence

### Strict audit

Command:
```bash
bun scripts/check-scenario-tests.ts --strict
```

Observed result:
- `Direct-authoring strict contract: FAILED`
- `direct .test.ts implementation refs: 24`
- `remaining spec-referenced plain .ts carriers: 634`
- `remaining repository plain .ts carriers: 695`

Important scope fact:
- the `Direct .test.ts implementation refs` output now includes this exact scenario unit under `features/virtualmachines-agentpool/tests/virtualmachines-spot-pool-eviction.test.ts`

Interpretation:
- this leaf's direct-carrier normalization is present
- repo-wide strict-zero still fails because of unrelated frontier debt, not because this spec regressed back to a plain carrier

### Guard against the frontier baseline

Command:
```bash
bun scripts/check-scenario-tests.ts --guard
```

Observed result:
- `Migration frontier guard vs 71cac0bc4eebc8c0d7105c1952d74a01b7c09d02: passed`
- `new spec-referenced plain .ts carriers vs baseline: 0`
- `new repository plain .ts carriers vs baseline: 0`
- `remaining spec-referenced plain .ts carriers: 634`
- `remaining repository plain .ts carriers: 695`

Interpretation:
- this reviewed commit adds no new plain-carrier regressions versus the accepted frontier baseline
- the remaining debt is inherited repo-wide backlog, not new regression from this leaf

## ADO rerun judgment

A fresh Azure DevOps rerun was **not required** in this worker retry.

Reason:
- the repaired boundary for this leaf is now satisfied by same-commit isolated-lineage proof plus local re-verification
- the reviewed commit already has same-commit queue metadata if reviewer/planner need it
- re-queueing the same commit would not add new input-path or expectation-path coverage beyond the already reviewed direct-carrier normalization

Existing same-commit queue artifact retained for audit only:

```json
{
  "backend": "ado",
  "runId": "172557989",
  "runUrl": "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=172557989&view=results",
  "specIds": ["spec.virtualmachines.spot-pool-eviction"],
  "target": "staging",
  "branch": "aks-explorer/normalize-direct-virtualmachines-spot-pool-eviction-20260717",
  "sourceVersion": "cbd263dec702348ae8352ab9c39ffce3c70a18a0",
  "metadataPath": "workspace/normalize-direct-virtualmachines-spot-pool-eviction-20260717/20260716T184101Z/metadata.json",
  "baseRef": "origin/dev",
  "baseCommit": "ed9bcf570e84a874d6117bf20f68f759fe5cd476",
  "sourceCommit": "cbd263dec702348ae8352ab9c39ffce3c70a18a0",
  "firstParentCommits": ["cbd263dec702348ae8352ab9c39ffce3c70a18a0"],
  "changedFiles": [
    "features/virtualmachines-agentpool/compact/staging.plan.json",
    "features/virtualmachines-agentpool/notes/virtualmachines-spot-pool-eviction-mounted-boundary-20260629.md",
    "features/virtualmachines-agentpool/specs/virtualmachines-spot-pool-eviction.json",
    "features/virtualmachines-agentpool/tests/virtualmachines-spot-pool-eviction-live.ts",
    "features/virtualmachines-agentpool/tests/virtualmachines-spot-pool-eviction.test.ts",
    "features/virtualmachines-agentpool/tests/virtualmachines-spot-pool-eviction.ts"
  ],
  "worktreePath": "/app/projects/aks-rp-e2e/workspace/normalize-direct-virtualmachines-spot-pool-eviction-20260717-wt"
}
```

## Conclusion

This retry re-verified the reviewed isolated commit `cbd263dec702348ae8352ab9c39ffce3c70a18a0` under the repaired normalization-root rule and the revised per-leaf non-regression boundary.

Accepted facts from this session:
- isolated-worktree lineage is still clean and task-scoped
- the active spec now points only at the direct feature-owned `.test.ts` carrier
- direct local check, direct Vitest run, spec dry-run, private-source policy, and live-admission policy all pass on the reviewed commit
- strict audit still shows repo-wide frontier debt, but this exact spec is in the direct `.test.ts` implementation set
- frontier guard passes with zero new plain-carrier regressions versus baseline
- no fresh ADO rerun was needed for this bounded retry
