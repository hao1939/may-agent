# domain/enforce-direct-scenario-test-authoring-contract — verification memo

Date: 2026-07-16
Worker attempt: `a_domain_enforce-direct-scenario-test-authoring-contract_20260716121225`
Published commit under review: `2a9eff66e04990ad66ab6636802808b4e4abe4c3`
Published-worktree path: `/app/projects/aks-rp-e2e/workspace/publish-scenario-authoring-guard-dev-20260716`

## What was verified

The direct-scenario authoring guard patch is already published and reviewable on `origin/dev`.

Evidence:

- `git branch -r --contains 2a9eff66e04990ad66ab6636802808b4e4abe4c3` returned both `origin/aks-explorer/publish-scenario-authoring-guard-20260716` and `origin/dev`.
- In the current domain branch, `git cherry -v origin/dev 3779fcd3e7684ff5cda3ec6aa5476729b078596c` marked commit `3779fcd3e` with `-`, which proves the local duplicate patch is already upstream-equivalent on `origin/dev`.

## Verification commands on the exact published commit

All commands below were executed from:

```bash
cd /app/projects/aks-rp-e2e/workspace/publish-scenario-authoring-guard-dev-20260716
```

### 1. Focused scenario-authoring tests

```bash
bun run test:scenario-tests
```

Result:

- passed
- 4/4 tests green
- includes direct `.test.ts` acceptance, new plain-carrier rejection, truthful existing-debt treatment, and direct-to-existing-legacy regression rejection

### 2. Scenario-authoring guard audit

```bash
bun run check:scenario-tests
```

Result: passed.

Key reported counts from the exact published commit:

- active specs with scenario refs: `663`
- referenced scenario files: `658`
- direct `.test.ts` implementation refs: `22`
- active spec refs still pointing at plain `.ts` carriers: `641`
- remaining spec-referenced plain `.ts` carriers: `636`
- repository plain `.ts` carriers: `698`
- missing scenario files: `0`
- new spec-referenced plain `.ts` carriers vs baseline `71cac0bc4eebc8c0d7105c1952d74a01b7c09d02`: `0`
- new repository plain `.ts` carriers vs baseline: `0`

Interpretation:

- the guard truthfully reports current migration debt;
- the monotonic frontier is enforced;
- no new or regressed spec-referenced plain carriers were introduced by this patch.

### 3. Full repo check

```bash
bun run check
```

Result: failed outside the scenario-authoring guard.

Observed failure surface:

- `test:scenario-tests`: passed
- `check:scenario-tests`: passed
- `runner/check.ts`: failed in `runtime-data-policy`

Exact pre-existing offending tracked files reported by `runtime-data-policy`:

- `evidence/archive/cilium-enterprise-addon-vm-prerelease-mounted-lifecycle-implementation-plan-20260629.md`
- `evidence/archive/cilium-enterprise-addon-vm-prerelease-single-spec-live-carrier-repair-20260629.md`
- `evidence/archive/domain-author-storage-csi-file-verify-nfs-live-carrier-20260715.md`
- `evidence/archive/normalize-scenario-net-integration-authorized-ip-ranges-20260716.md`
- `evidence/archive/ops-reconcile-unpublished-change-breach-working-tree-20260715.md`
- `evidence/archive/rp-master-validation-feature-packet-restore-20260715.md`

## Exact pre-existing owner attribution for the unrelated `runtime-data-policy` failure

These files predate this task's review and were already tracked on the published commit. `git log --follow -1` on the published worktree reported:

- `da8f770c7` — `fix(network-cni): track vm prerelease cilium evidence`
  - `evidence/archive/cilium-enterprise-addon-vm-prerelease-mounted-lifecycle-implementation-plan-20260629.md`
  - `evidence/archive/cilium-enterprise-addon-vm-prerelease-single-spec-live-carrier-repair-20260629.md`
- `cb92d29a3` — `Align storage-csi verifyNFS probe with pass status`
  - `evidence/archive/domain-author-storage-csi-file-verify-nfs-live-carrier-20260715.md`
- `735d4cee7` — `test: normalize authorized ip ranges direct carrier`
  - `evidence/archive/normalize-scenario-net-integration-authorized-ip-ranges-20260716.md`
- `46a6c5afe` — `Checkpoint reviewed multinic and verifyNFS surface refresh`
  - `evidence/archive/ops-reconcile-unpublished-change-breach-working-tree-20260715.md`
- `0e7b31848` — `Restore rp-master-validation feature packet`
  - `evidence/archive/rp-master-validation-feature-packet-restore-20260715.md`

So the remaining `bun run check` failure is a pre-existing tracked-evidence hygiene issue owned by those earlier slices, not by the scenario-authoring guard change.

## Review conclusion

This task's requested contract work is complete and verified:

- direct feature-owned `.test.ts` files are accepted;
- new or regressed plain `.ts` spec carriers are rejected by the monotonic guard;
- existing migration debt is reported truthfully instead of hidden;
- the reviewed tooling commit is present on `origin/dev`;
- the only remaining full-check failure is an unrelated, pre-existing `runtime-data-policy` issue with exact file-level attribution above.

## Planner / reviewer proposal

Treat `domain/enforce-direct-scenario-test-authoring-contract` as ready for success/acceptance based on published commit `2a9eff66e04990ad66ab6636802808b4e4abe4c3`.
Do not classify the unrelated `runtime-data-policy` failure as a guard defect in this task; keep ownership with the six pre-existing tracked evidence files and their originating slices listed above.
