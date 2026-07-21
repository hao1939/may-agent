# Local merged branch cleanup — 2026-07-21

## Scope

Clean local branches in `/app/projects/aks-rp-e2e` that were fully merged into the refreshed `origin/dev` at `c7db615eab90d868a567ff5d8702cb87a580e974`.

The cleanup deliberately excluded:

- `dev`, `main`, and `master`;
- every branch checked out by a registered worktree;
- all remote-tracking branches;
- every local branch not merged into `origin/dev`.

## Result

| Check                                       | Before | After |
| ------------------------------------------- | -----: | ----: |
| Local branches                              |    399 |   275 |
| Deletable branches merged into `origin/dev` |    124 |     0 |
| Registered worktree branches                |     64 |    64 |
| Missing worktree branch refs                |      0 |     0 |

All 124 eligible local branches were removed with non-force `git branch -d`. Git initially refused one branch because it tracked an obsolete remote feature branch. Its tip was verified as an ancestor of `origin/dev`, its stale upstream association was removed, and the same non-force deletion then succeeded.

Twenty-five merged feature branches remain because they are attached to recovery worktrees. `dev` remains checked out in the canonical worktree, and the protected local `main` branch also remains. No remote branch was deleted.

## Verification

- `origin/dev` remained at `c7db615eab90d868a567ff5d8702cb87a580e974`.
- The canonical checkout remained on `dev`.
- Every one of the 64 registered worktree branch refs still resolves.
- No unprotected, unattached local branch merged into `origin/dev` remains.
- Pre-existing modified and untracked working-tree files in the canonical checkout were preserved unchanged by this ref-only operation.

## Integration correction and first reconciliation wave

Remote recoverability is not task completion. After the initial local-ref
cleanup, the branch lifecycle rule was tightened:

> A task branch remains live until its accepted change is integrated into
> `dev`, or the change is explicitly rejected. Terminal closeout removes the
> branch.

The first reconciliation wave selected the eight branches referenced by live
repo-ref waiting tasks. They were merged together from the exact prior
`origin/dev`, their targeted repository-local checks passed, and `origin/dev`
was advanced by fast-forward from `c7db615eab90d868a567ff5d8702cb87a580e974`
to `0b8318d9ed2b320b4b2edd39804cfeddf011a146`.

The wave integrated:

- RP regional quota public create-path normalization;
- LocalDNS enable/disable normalization;
- deprecated-API upgrade adapter restoration;
- app-monitoring metrics result-contract repair;
- Azure Key Vault dual-pool normalization;
- RP spot-pool normalization;
- virtual-machines spot-eviction live adapter; and
- Windows mixed-OS readiness/live-admission repair.

Verification passed nine targeted scenario/adapter tests and three runner
target tests. The broad scenario migration guard still reports two pre-existing
plain-carrier violations already present on the prior `origin/dev`; this wave
does not touch those files.

After integration:

- the eight source branches and three integrated intermediate branches were
  removed locally;
- ten corresponding `origin` refs were removed (one intermediate branch had no
  remote ref);
- 36 additional unattached branches whose patches were already represented in
  the new `dev` were removed locally, with 30 corresponding `origin` refs; and
- the temporary clean integration worktree and branch were removed.

Local branches now total 228. The unresolved migration queue is intentionally
not bulk-deleted: 163 unattached branches still contain patches not represented
in `dev`, 32 worktree-attached branches contain such patches, and six more
patch-equivalent branches remain attached to dirty recovery worktrees. Those
changes require explicit integrate-or-reject review together with the recovery
workspace contents.

May-agent commit `7204f22b` enforces the rule for new task workspaces: an
unintegrated clean branch may remain while its task is waiting, but the task
cannot converge until the branch is integrated or deliberately restored to
no-change and removed.

The finite legacy frontier is now represented by the live maintain task
`legacy-branch-reconciliation`. Its deterministic controller observes 163
unattached branches with patches outside `origin/dev`, groups them by touched
feature signature, and keeps one family-review leaf actionable so `origin/dev`
has a single integration writer.
The family workflow revalidates heads, uses a task-owned worktree, advances
`origin/dev` only by checked fast-forward after review and verification, and
then removes the represented local and remote source refs. Leaf reconciliation
events refill the same task; attached dirty recovery work is deliberately
excluded from automatic cleanup.

The first live family review proved the full path. The `aad-rbac` review kept
the useful Automatic SKU direct-carrier normalization, passed its focused
diagnostics and check-mode verification, advanced `origin/dev` from
`0b8318d9ed2b320b4b2edd39804cfeddf011a146` to
`fb2ee5770a3040c9f4e41b871e571d929d840d67`, and removed its represented source
ref. Two sibling reviews from the initial three-writer rollout stopped safely
when they observed that base movement. The corrected controller now permits
one actionable family only and retries that known transient attention outcome
on the same task generation; other attention outcomes still require owner
review.
