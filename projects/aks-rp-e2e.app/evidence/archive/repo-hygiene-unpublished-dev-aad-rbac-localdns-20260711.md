# Repo hygiene reconciliation — unpublished dev changes in aad-rbac + localdns — 2026-07-11

Task: `ops/reconcile-unpublished-dev-changes-aad-rbac-localdns-20260711`
Attempt: `a_ops_reconcile-unpublished-dev-changes-aad-rbac-localdns-20260711_20260711162455`
Worker: `app-ops`
Scope: classify and reconcile the current dev unpublished surface for the exact six tracked modified files plus two ahead commits named by the task; no task-tree mutation from this worker session

## Result

The current scoped repo-hygiene breach is **8 unpublished units**:

- **6 tracked modified files**
- **2 local-only commits ahead of `origin/dev`**

I did **not** publish or revert anything in this session.

Truthful closure today is:

1. the **aad-rbac dirty feature slice** is durable domain knowledge but is still publication-blocked by existing aad-rbac blocked holders;
2. the **localdns dirty compact slice** is cleanup debt that corrects stale compact residue, but it is still publication-blocked by existing LocalDNS blocked holders;
3. the **two ahead commits** are real local checkpoint commits that still need remote publication, but `git push --dry-run origin dev` currently fails because Azure DevOps auth is unavailable in this environment.

So the repo and tree do **not** agree yet, but the disagreement is now explicit and classified rather than unexplained.

## Current scoped git state

From `/app/projects/aks-rp-e2e`:

```text
## dev...origin/dev [ahead 2]
 M features/aad-rbac/compact/staging.diagnostics.json
 M features/aad-rbac/compact/staging.plan.json
 M features/aad-rbac/compact/staging.summary.md
 M features/aad-rbac/specs/aad-rbac-run-command-access.json
 M features/localdns/compact/staging.diagnostics.json
 M features/localdns/compact/staging.summary.md
```

Scoped count reconciliation:

- 6 modified tracked files
- +2 ahead commits
- = **8 unpublished units**

This exactly matches the task scope.

## File-by-file classification

| Path | Change family | Primary classification | Blocked holders touched | Truthful judgment | Chosen remediation path |
|---|---|---|---|---|---|
| `features/aad-rbac/compact/staging.diagnostics.json` | aad-rbac wording/writeback | durable domain knowledge | `hold-compact-aad-rbac-package-partial-frontier`; `hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706` | Mirrors the accepted unsplit RunCommand wording repair; not transient residue. | Keep as explicit unpublished durable slice pending exact publication ownership isolation and later checkpoint/push. |
| `features/aad-rbac/compact/staging.plan.json` | aad-rbac wording/writeback | durable domain knowledge | same as above | Carries the same repaired RunCommand ceiling language into compact planning output. | Same as above. |
| `features/aad-rbac/compact/staging.summary.md` | aad-rbac wording/writeback | durable domain knowledge | same as above | Human-readable compact summary for the same accepted frontier repair. | Same as above. |
| `features/aad-rbac/specs/aad-rbac-run-command-access.json` | aad-rbac wording/writeback | durable domain knowledge | same as above | Exact spec wording repair: mounted source remains one unsplit lifecycle; direct User-carrier ceiling preserved; ServicePrincipal evidence stays adjacent and non-superseding. | Same as above. |
| `features/localdns/compact/staging.diagnostics.json` | localdns compact frontier normalization | cleanup debt | `hold-compact-localdns-package-partial-frontier`; `hold-spec-localdns-managed-cluster-quota-family-frontier-20260708`; `hold-spec-localdns-reviewed-exception-authoritative-return-family-20260706c`; residual HTTP400 family reflected in content | Removes stale compact exclusions already normalized elsewhere (`cni-matrix`, `vm-prerelease.azurelinux`, `vm-prerelease.enable-disable`) and narrows `network-policy-coexistence` to residual HTTP400 frontier. This is cleanup of tracked artifact drift, not transient loop residue. | Keep as explicit unpublished cleanup slice pending exact publication ownership isolation and later checkpoint/push. |
| `features/localdns/compact/staging.summary.md` | localdns compact frontier normalization | cleanup debt | same as above | Human-readable compact summary matching the same LocalDNS cleanup/normalization. | Same as above. |

## Ahead-commit classification

| Commit | Summary | Primary classification | Holders touched | Truthful judgment | Chosen remediation path |
|---|---|---|---|---|---|
| `be707f363` | `checkpoint: publish rp lifecycle model feedback wording` | durable domain knowledge | none proven in this session beyond model feedback lineage | Real local checkpoint commit, already separated from the dirty worktree; still unpublished to `origin/dev`. | Keep commit intact; publish when remote auth works, or explicitly supersede with a later replacement commit. |
| `9675c05bd` | `checkpoint: land aad-rbac model writeback slice` | durable domain knowledge | same aad-rbac frontier lineage as the remaining dirty aad-rbac feature files | Real local checkpoint commit for the model/view half of the aad-rbac writeback. Repo hygiene is currently split because the feature-half remains dirty while the model/view half is already committed locally. | Keep commit intact; publish only after planner/app-ops accepts the split publication shape or re-isolates publication ownership for the remaining aad-rbac feature files. |

## What the current diffs mean

### AAD-RBAC dirty slice

The aad-rbac diffs are not random churn. They consistently restate the already-accepted repair:

- mounted source still defines one unsplit `Scenario_AAD_RunCommand` lifecycle;
- the accepted direct ceiling remains the User-carrier path;
- ServicePrincipal-adjacent observations remain mixed context, not a source-defined executable branch.

So the aad-rbac dirty slice is **durable domain knowledge**.

### LocalDNS dirty slice

The LocalDNS diffs remove stale compact exclusions and tighten the compact frontier to match newer spec-loop truth:

- `spec.localdns.cni-matrix` moves out of the quarantined compact set;
- `spec.localdns.vm-prerelease.azurelinux` moves out of the quarantined compact set;
- `spec.localdns.vm-prerelease.enable-disable` moves out of the quarantined compact set;
- `spec.localdns.network-policy-coexistence` moves from reviewed-exception framing to residual create-time HTTP400 framing.

So the LocalDNS dirty slice is **cleanup debt** on tracked artifacts, not transient loop residue.

## Publication-safety checks

### 1. Exact aad-rbac slice helper result

Bounded helper rerun on the exact four aad-rbac dirty files still returns **`recommendation: hold`** and still matches blocked holders including:

- `hold-compact-aad-rbac-package-partial-frontier`
- `hold-spec-aad-rbac-run-command-access-authorization-branch-ceiling-20260706`

### 2. Exact localdns slice helper result

Bounded helper rerun on the exact two LocalDNS dirty files still returns **`recommendation: hold`** and still matches blocked holders including:

- `hold-compact-localdns-package-partial-frontier`
- `hold-spec-localdns-managed-cluster-quota-family-frontier-20260708`
- `hold-spec-localdns-reviewed-exception-authoritative-return-family-20260706c`

### 3. Remote publication blocker

`git push --dry-run origin dev` fails in this environment with:

```text
/app/.state/.local/bin/git-credential-azdevops: line 28: az: command not found
fatal: could not read Username for 'https://dev.azure.com/msazure/CloudNativeCompute/_git/aks-e2e-spec-runner': No such device or address
```

So even the already-created local commits cannot be truthfully claimed as published.

## Remediation decision by change family

### Family A — aad-rbac dirty feature files

**Decision:** do not revert; do not silently leave dirty; carry forward as an explicit blocked publication slice.

Reason:

- content is durable and explained;
- helper still says `hold` because blocked aad-rbac holders remain authoritative;
- publishing from this worker session would overstep the current blocked-holder ownership story.

### Family B — localdns compact dirty files

**Decision:** do not revert; do not treat as transient residue; carry forward as an explicit blocked cleanup slice.

Reason:

- content repairs stale tracked compact residue;
- helper still says `hold` because active LocalDNS blocked holders still own the frontier surface;
- publishing from this worker session would bypass the current compact/frontier ownership story.

### Family C — ahead commits `be707f363` and `9675c05bd`

**Decision:** keep both commits intact as real local checkpoint commits, but do not claim publication until remote auth is restored and the remaining split ownership questions are settled.

Reason:

- both commits are durable local history already;
- current environment cannot push to `origin/dev`;
- `9675c05bd` is still coupled to unpublished aad-rbac feature-half drift.

## Exact follow-up waits/tasks the planner should add

Because this worker session may not reshape the task tree, the exact follow-up records are proposed here for planner/app-ops review.

### Proposed wait 1

- **id:** `wait-dev-origin-push-auth-for-unpublished-checkpoints-20260711`
- **owner:** human repo steward
- **observer:** app-ops
- **resume condition:** rerun `git push --dry-run origin dev` from `/app/projects/aks-rp-e2e` and get a successful auth path instead of the current `az: command not found` / username-read failure
- **check method:** exact command above
- **fallback if overdue:** either restore Azure DevOps credential helper support in this environment or designate an alternate authorized publication path
- **affected commits:** `be707f363`, `9675c05bd`

### Proposed task 2

- **id:** `domain/publish-aad-rbac-run-command-access-wording-slice-20260711`
- **owner:** `aks-explorer`
- **resume condition:** after push-auth wait clears, rerun bounded checkpoint eligibility for
  - `features/aad-rbac/compact/staging.diagnostics.json`
  - `features/aad-rbac/compact/staging.plan.json`
  - `features/aad-rbac/compact/staging.summary.md`
  - `features/aad-rbac/specs/aad-rbac-run-command-access.json`
  and only checkpoint/publish once planner/app-ops accepts the blocked-holder publication story or the helper stops returning `hold`
- **affected files:** the four aad-rbac files above
- **affected commit linkage:** `9675c05bd`

### Proposed task 3

- **id:** `domain/publish-localdns-compact-frontier-normalization-slice-20260711`
- **owner:** `aks-explorer`
- **resume condition:** after push-auth wait clears, rerun bounded checkpoint eligibility for
  - `features/localdns/compact/staging.diagnostics.json`
  - `features/localdns/compact/staging.summary.md`
  and only checkpoint/publish once planner/app-ops accepts the compact-holder publication story or the helper stops returning `hold`
- **affected files:** the two LocalDNS compact files above
- **required truth to preserve:** keep `cni-matrix`, `vm-prerelease.azurelinux`, and `vm-prerelease.enable-disable` out of the blocked compact frontier unless newer evidence genuinely reopens them

## Bottom line

- The scoped breach is now exactly **8 units**: 6 modified files + 2 ahead commits.
- None of the six modified files are unexplained.
- The aad-rbac changes are **durable domain knowledge**.
- The LocalDNS changes are **cleanup debt** correcting stale tracked compact residue.
- The two ahead commits are real local checkpoint commits, but they remain unpublished.
- The truthful next step is **not** blind commit/revert from this session; it is exact follow-up on publication ownership plus restored remote push capability.
