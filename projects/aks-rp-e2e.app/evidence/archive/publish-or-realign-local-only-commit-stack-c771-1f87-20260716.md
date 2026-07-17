# Publish or realign local-only commit stack `c771` / `1f87` — 2026-07-16

Task: `ops/publish-or-realign-local-only-commit-stack-c771-1f87-20260716`
Attempt: `a_ops_publish-or-realign-local-only-commit-stack-c771-1f87-20260716_20260716104504`
Worker: `app-ops`
Repo checked: `/app/projects/aks-rp-e2e`

## Result

**Success: no narrower successor is needed.**

At task start, prior audit evidence showed both commit objects were still counted as pipeline-invisible local-only residue:

- `c771bb339f4c9a7963f257bb35bc02effd520bad`
- `1f87dd9ad437eb3c7d63a73e5602f7793b9c9c58`

Fresh primary-source git checks during this worker session now show that the tracked origin branch already points at `a0502eae575d42b97badc1993d892a33e608d88a`, and that remote branch contains **both** commits in its ancestry. As a result, the current `HEAD` contributes **no** local-only commit objects to `git rev-list HEAD --not --remotes=origin`.

So the stack has already been published/realigned together, and this task can close on verification alone.

## Baseline from the predecessor audit

The live audit that created this task recorded the earlier state:

```text
/app/projects/aks-rp-e2e/evidence/archive/ops-reconcile-unpublished-change-carriers-p0-20260716.md
```

That evidence sampled:

```bash
git rev-list --oneline HEAD --not --remotes=origin
# c771bb339 checkpoint: land net-integration nonlive-pair model writeback slice
# 1f87dd9ad Fix forward jwt-authenticator spec-loop reconciliation
```

and proposed this exact combined holder because:

- `c771bb339...` was the only unique unpublished content commit (`git cherry` `+`)
- `1f87dd9ad...` was patch-equivalent residue below it
- the two commits needed one combined publication/realignment owner

## Current repo truth

### 1) The tracked origin branch now matches local `HEAD`

```bash
cd /app/projects/aks-rp-e2e && git rev-parse HEAD
# a0502eae575d42b97badc1993d892a33e608d88a

cd /app/projects/aks-rp-e2e && git rev-parse origin/aks-explorer/normalize-rp-cluster-lifecycle-update-tags-20260715
# a0502eae575d42b97badc1993d892a33e608d88a

cd /app/projects/aks-rp-e2e && git branch -vv | sed -n '/\* /p'
# * aks-explorer/normalize-rp-cluster-lifecycle-update-tags-20260715 a0502eae5 [origin/aks-explorer/normalize-rp-cluster-lifecycle-update-tags-20260715] Merge remote feature branch before publication
```

### 2) The actual remote branch also points at that same SHA

```bash
cd /app/projects/aks-rp-e2e && git ls-remote origin refs/heads/aks-explorer/normalize-rp-cluster-lifecycle-update-tags-20260715
# a0502eae575d42b97badc1993d892a33e608d88a	refs/heads/aks-explorer/normalize-rp-cluster-lifecycle-update-tags-20260715
```

This is the decisive proof that the publication is not just a stale local remote-tracking ref.

### 3) Both previously local-only commits are now ancestors of the published origin branch

```bash
cd /app/projects/aks-rp-e2e && git merge-base --is-ancestor c771bb339f4c9a7963f257bb35bc02effd520bad origin/aks-explorer/normalize-rp-cluster-lifecycle-update-tags-20260715 && echo c771_in_origin=yes
# c771_in_origin=yes

cd /app/projects/aks-rp-e2e && git merge-base --is-ancestor 1f87dd9ad437eb3c7d63a73e5602f7793b9c9c58 origin/aks-explorer/normalize-rp-cluster-lifecycle-update-tags-20260715 && echo 1f87_in_origin=yes
# 1f87_in_origin=yes
```

And the remote-containing check now reports the tracked origin ref for both commits.

```bash
cd /app/projects/aks-rp-e2e && git branch -r --contains c771bb339f4c9a7963f257bb35bc02effd520bad
# origin/aks-explorer/normalize-rp-cluster-lifecycle-update-tags-20260715

cd /app/projects/aks-rp-e2e && git branch -r --contains 1f87dd9ad437eb3c7d63a73e5602f7793b9c9c58
# origin/aks-explorer/normalize-rp-cluster-lifecycle-update-tags-20260715
```

### 4) The local-only set is now empty

```bash
cd /app/projects/aks-rp-e2e && git rev-list --oneline HEAD --not --remotes=origin
# <no output>

cd /app/projects/aks-rp-e2e && git cherry -v origin/aks-explorer/normalize-rp-cluster-lifecycle-update-tags-20260715 HEAD
# <no output>
```

This is the acceptance-critical proof: neither `c771...` nor `1f87...` remains in the local-only contributor set.

## What changed in branch shape

Current top history:

```bash
cd /app/projects/aks-rp-e2e && git log --oneline --decorate -5
# a0502eae5 (HEAD -> aks-explorer/normalize-rp-cluster-lifecycle-update-tags-20260715, origin/aks-explorer/normalize-rp-cluster-lifecycle-update-tags-20260715) Merge remote feature branch before publication
# ca2bd6b9a model(localdns): align auto-default threshold contract
# c771bb339 checkpoint: land net-integration nonlive-pair model writeback slice
# eef1d13f0 Fix forward jwt-authenticator spec-loop reconciliation
# 1f87dd9ad Fix forward jwt-authenticator spec-loop reconciliation
```

So the earlier patch-equivalent jwt residue is no longer merely local ancestry; it is now part of the published branch history, and the net-integration checkpoint commit is published with it.

## Acceptance mapping

1. **Single live owner while pipeline-invisible** — satisfied during this worker attempt: this task served as the exact live owner for the stack under `unpublished:commit-stack:c771-1f87` while the publication state was verified.
2. **Prove whether each commit still appears in `git rev-list HEAD --not --remotes=origin`** — satisfied:
   - `c771bb339...`: does **not** appear now
   - `1f87dd9...`: does **not** appear now
3. **Finish with both commits removed from that set or one narrower successor** — satisfied via the stronger outcome: **both commits are already removed from the local-only set**. No replacement wait or successor is truthful or necessary.

## Reviewer / planner proposal

No worker-side task-tree mutation or event emission was performed.

Reviewer/planner should:

- accept this task as **done**,
- record that no narrower successor is needed, and
- treat the `c771` / `1f87` unpublished-stack breach as resolved by published origin ancestry at `a0502eae575d42b97badc1993d892a33e608d88a`.
