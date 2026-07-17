# Clear runtime-data-policy blocker for cilium dataplane publication — 2026-07-17

Task: `domain/clear-runtime-data-policy-blocker-for-cilium-dataplane-publication-20260717`
Attempt: `a_domain_clear-runtime-data-policy-blocker-for-cilium-dataplane-publication-20260717_20260717052400`

## Result

The `origin/dev` runtime-data-policy blocker was already cleared on the remote base before this retry: `origin/dev` had advanced to cleanup commit `3249d01328946272c77cd82416bdcc050fe8b356` (`chore: clear tracked runtime-data blockers`).

Using a freshly fetched isolated worktree from that exact base, I retried publication of the already verified `spec.network-cni.cilium-dataplane` normalization commit `f4d2ba463b8d14e92ba770876bcc6cb05e81119a`, reran the required local guards/checks, and fast-forward pushed the publication merge commit to `origin/dev`.

Final remote state:

- `origin/dev` head after push: `e89677f6eaa1cc5e531077c7a1ff54267aaf77cd`
- `origin/dev` now contains `f4d2ba463b8d14e92ba770876bcc6cb05e81119a` as an ancestor

## Runtime-data-policy blocker adjudication

The prior blocker named these seven tracked runtime/generated-data files. On the fresh isolated retry tree after merging the cilium dataplane change, every one of them was **not tracked** and **absent** on disk:

```text
not-tracked | absent | evidence/archive/cilium-enterprise-addon-vm-prerelease-mounted-lifecycle-implementation-plan-20260629.md
not-tracked | absent | evidence/archive/cilium-enterprise-addon-vm-prerelease-single-spec-live-carrier-repair-20260629.md
not-tracked | absent | evidence/archive/domain-author-storage-csi-file-verify-nfs-live-carrier-20260715.md
not-tracked | absent | evidence/archive/finish-rp-cluster-lifecycle-nodeless-rerun-reset-20260717.md
not-tracked | absent | evidence/archive/normalize-scenario-net-integration-authorized-ip-ranges-20260716.md
not-tracked | absent | evidence/archive/ops-reconcile-unpublished-change-breach-working-tree-20260715.md
not-tracked | absent | evidence/archive/rp-master-validation-feature-packet-restore-20260715.md
```

Conclusion: the runtime-data-policy blocker was cleared by removal, not by waiver. No explicit owner allow-list decision was needed for this publication retry.

## Fresh isolated publication proof

- worktree: `/app/projects/aks-rp-e2e/workspace/clear-runtime-data-policy-blocker-for-cilium-dataplane-publication-20260717-wt`
- branch: `aks-explorer/clear-runtime-data-policy-blocker-for-cilium-dataplane-publication-20260717`
- baseRef: `origin/dev`
- baseCommit: `3249d01328946272c77cd82416bdcc050fe8b356`
- reviewed/tested commit merged: `f4d2ba463b8d14e92ba770876bcc6cb05e81119a`
- publication sourceCommit: `e89677f6eaa1cc5e531077c7a1ff54267aaf77cd`

First-parent commits from `baseCommit..sourceCommit`:

```text
e89677f6eaa1cc5e531077c7a1ff54267aaf77cd
```

Changed-file set from `baseCommit..sourceCommit`:

```text
features/network-cni/compact/staging.plan.json
features/network-cni/specs/network-cni-cilium-dataplane.json
features/network-cni/tests/network-cni-cilium-dataplane.test.ts
features/network-cni/tests/network-cni-cilium-dataplane.ts
```

This remained the same four-file cilium dataplane normalization slice; no unrelated runtime-data cleanup files were mixed into the publication merge.

## Merge and exact-content preservation

The fresh-base merge was clean:

```text
Merge made by the 'ort' strategy.
 features/network-cni/compact/staging.plan.json     |   4 +-
 .../specs/network-cni-cilium-dataplane.json        |   9 +-
 .../tests/network-cni-cilium-dataplane.test.ts     | 602 +++++++++++++++++++-
 .../tests/network-cni-cilium-dataplane.ts          | 629 ---------------------
 4 files changed, 591 insertions(+), 653 deletions(-)
 delete mode 100644 features/network-cni/tests/network-cni-cilium-dataplane.ts
```

I also compared the four scenario files in the merged tree against the already live-verified commit `f4d2ba463b8d14e92ba770876bcc6cb05e81119a`; the diff was empty (`tested-vs-merged-status.txt: identical`). This preserved the previously verified scenario content exactly, so no replacement live rerun was needed for this publication retry.

## Required checks on the fresh-base retry

Commands run in the isolated worktree:

```bash
bun scripts/check-scenario-tests.ts --guard --baseline-revision=3249d01328946272c77cd82416bdcc050fe8b356
bun run spec spec.network-cni.cilium-dataplane --check
bun runner/check-private-source-policy.ts --specs spec.network-cni.cilium-dataplane
bun runner/check-live-admission.ts --specs spec.network-cni.cilium-dataplane
bun runner/check-runtime-data-policy.ts
bun run check
```

Observed results:

- scenario migration guard: `passed`
- single-spec check: `result=passed`
- private-source policy: `passed`
- live-admission policy: `passed`
- runtime-data policy: `passed (2910 tracked files checked)`
- repo check: `All checks passed.`

Note: the first `bun run check` attempt in the new worktree failed for a local tooling reason only (`node_modules/.bin/prettier` missing in the worktree-local dependency directory). I replaced the worktree-local `node_modules` with an untracked symlink to the repo root dependency tree and reran `bun run check`, which then passed. No repo content changed for that local bootstrap fix.

## Push proof

Remote push result:

```text
To https://dev.azure.com/msazure/CloudNativeCompute/_git/aks-e2e-spec-runner
   3249d0132..e89677f6e  HEAD -> dev
```

Remote ancestor proof after push:

```text
origin-dev-has-tested-commit-after-push
```

## Artifacts

All run artifacts for this retry are under:

- `workspace/clear-runtime-data-policy-blocker-for-cilium-dataplane-publication-20260717/20260717T052622Z/`

Key files:

- `base-commit.txt`
- `worktree-create.txt`
- `git-merge.txt`
- `source-commit.txt`
- `first-parent-commits.txt`
- `changed-files.txt`
- `tested-vs-merged-status.txt`
- `scenario-guard.txt`
- `spec-check.txt`
- `private-source-policy.txt`
- `live-admission.txt`
- `runtime-data-policy.txt`
- `repo-check.txt`
- `runtime-data-blocker-file-status.txt`
- `git-push.txt`
- `post-push-origin-dev-head.txt`
- `origin-dev-tested-ancestor-after-push.txt`

## Planner/reviewer note

No event emission was performed from this worker session. The factual outcome for review is:

- runtime-data-policy blocker: cleared by prior `origin/dev` cleanup commit `3249d01328946272c77cd82416bdcc050fe8b356`
- cilium dataplane publication retry: completed successfully from a fresh `origin/dev` base
- current remote `origin/dev`: `e89677f6eaa1cc5e531077c7a1ff54267aaf77cd`
