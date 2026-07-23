# AKS Task Workspace and Git Lifecycle

**Status:** Implemented AKS pilot; legacy dirty recovery remains visible
**Scope:** AKS-local pilot with one small generic workflow-execution hook
**Evidence date:** 2026-07-21
**Cleanup status:** 466 safe worktrees removed, 15 stale registrations pruned,
96 dirty worktrees retained under one recovery namespace
**Related:**
[AKS App Design](README.md),
[Task Workspace Convention](../../may-agent.app/docs/3-proposals/task-workspace-convention.md),
[Task Resource Engine](../../may-agent.app/docs/2a-design/task-resource-engine.md), and
[Workflows](../../may-agent.app/docs/2a-design/workflows.md)

## Decision summary

Adopt this operating model for `aks-rp-e2e`:

```text
clean canonical checkout on dev
  -> observation and current-domain truth

mutating task
  -> one task-owned worktree from current origin/dev
  -> one task branch
  -> reuse across retries and agent handoff
  -> commit and return branch/commit evidence
  -> remain live while review or integration is pending
  -> converge only after merge or explicit rejection
  -> remove worktree and task branch after terminal closeout

external wait
  -> task Condition plus remote branch/commit identity
  -> no local worktree kept merely to wait
```

The app organizes workspace policy. Infrastructure performs deterministic Git
mechanics around a task attempt. The agent works inside the workspace it is
given and does not invent branches, paths, or cleanup policy.

Do not add a workspace registry, a second controller, a workspace task type,
or workspace fields to every task specification.

## What the audit found

The local Git topology is much larger than the current work frontier:

- 576 registered worktrees: 561 present and 15 stale `/tmp` registrations;
- 374 branch-attached and 202 detached worktrees;
- 397 local branches: 151 merged into the locally observed `origin/dev` and
  246 not merged;
- 147 attached worktree branches already merged into `origin/dev`;
- 185 detached worktree heads already reachable from `origin/dev`;
- 26 present worktrees with tracked changes and 535 tracked-clean;
- approximately 38 GB under `projects/aks-rp-e2e/workspace`; and
- only 10 registered paths or branch names directly referenced in current live
  task text, demonstrating that ownership cannot be reconstructed reliably
  from the task projection.

The live task projection at the same time had 86 resources: 72 waiting, 13
converged, one pending, and no running task. The large worktree population is
therefore historical execution residue, not current execution capacity.

The canonical domain checkout is not canonical in practice:

- it is on
  `aks-explorer/queue-rp-operation-status-polling-managed-cluster-lineage-20260720`;
- that branch is 140 commits behind and 19 commits divergent from the locally
  observed `origin/dev`;
- its working tree has 158 modified, 14 deleted, and 26 untracked entries;
- its tracked diff spans 172 files with multiple unrelated feature families;
  and
- `git cherry origin/dev HEAD` reports four patch-equivalent and fifteen
  apparently unique commits.

The local `dev` branch is itself 142 commits behind `origin/dev` and is not
checked out. Merely switching the dirty root to `dev` would lose the ability to
attribute current residue and still would not produce a current canonical
view.

These counts are a point-in-time local observation. Merge/reachability
classification must be refreshed before cleanup, and tracked-clean is not
enough: untracked files must also be checked before removal.

## Who created the topology

The topology was produced by agent sessions calling Git directly, not by one
workspace lifecycle owner:

- 370 local branch names use the `aks-explorer/*` prefix;
- 19 use `codex/*`;
- 395 of 397 branch tips use the Git author identity `aks-explorer`; and
- 925 retained sessions contain a `git worktree add` command: 637 by
  `aks-explorer`, 65 by `app-ops`, 31 by `aks-reviewer`, and 192 by the
  evaluator. Evaluator instances are usually temporary audit snapshots, so
  this session count is process evidence rather than a count of retained
  worktrees.

The current root branch was created by `aks-explorer` session
`s_1784562046935_99` with a direct `git switch -c` in the shared checkout. It
was pushed for an RP operation-status task, then later accumulated unrelated
commits and working-tree changes. The problem is not one agent making a bad
branch. The system allowed every attempt to choose its own workspace topology
and supplied no closeout owner.

## Root cause

Several individually reasonable practices combined into one systemic failure:

1. Tasks often asked for a fresh isolated worktree.
2. Agents created those worktrees themselves under whichever directory was
   convenient.
3. Retries created `redo`, `refresh`, `verify`, and timestamp variants instead
   of resolving the original task workspace.
4. A successful task result closed the task without deterministically closing
   its worktree.
5. Waiting tasks retained local worktrees even when a pushed branch and commit
   were sufficient recovery context.
6. Some sessions switched the shared root to a task branch and then other work
   reused it.
7. No invariant connected a worktree to exactly one live task generation.

Git faithfully retained everything it was asked to retain. The missing piece
is lifecycle ownership.

## Current implementation gap

The runtime already carries `appDir`, `projectDir`, and `workspaceDir`, but the
project task loader currently resolves `workspaceDir` to `projectDir` before
every claim. Workflow modules cannot declare workspace intent, workflow agent
options cannot select an execution directory, and task attempts do not retain
workspace lineage.

Consequently:

- a task prompt can ask for isolation, but infrastructure has not prepared it;
- the agent must call `git worktree add` and choose a path itself;
- nested workflow agents receive workspace information only when workflow
  prose passes it through;
- the reconciler cannot reuse a prior task worktree because the attempt has no
  structured linkage; and
- completion has no deterministic Git finalizer.

The minimum platform hook is therefore not a workspace service. It is:

1. optional workflow metadata declaring shared or task execution;
2. workspace preparation before the handler starts;
3. the resolved directory supplied as both structured execution context and
   the actual tool working directory for nested agent steps;
4. workspace lineage on the current attempt and bounded completion receipt;
5. Git disposition checked after handler verification; and
6. closeout before the reconciler applies the final task result.

The handler/workflow result must already be durably recorded before destructive
closeout. If the process crashes after a clean worktree is removed but before
the task transition is applied, recovery can replay the durable result and
recreate the checkout from the retained branch/head instead of rerunning
judgment from scratch.

## Invariants

The solution should enforce a small set of rules.

### Canonical checkout

`/app/projects/aks-rp-e2e` is the canonical domain view:

- branch `dev`, tracking `origin/dev`;
- fast-forward only;
- clean before and after every non-isolated task attempt;
- never used for `git switch -c`, commits, rebases, or task-local edits; and
- refreshed before an observation that claims current upstream truth.

`origin/dev` plus its exact commit is the comparison authority. The local
`dev` name is the convenient canonical checkout, not a second source of truth.

### Task worktree

A persistent worktree exists only for one live mutating task generation:

- deterministic path derived from app ID and task ID;
- branch created from the current observed `origin/dev` commit;
- task ID, generation, base ref, base commit, branch, and path recorded on the
  attempt;
- the same path reused by retries and replacement agents;
- a generation change cannot silently reuse unresolved dirty work; and
- no agent-private directory is required for handoff.

Recommended path convention:

```text
/app/worktrees/aks-rp-e2e/<safe-task-id>-<short-hash>
```

Recommended branch convention:

```text
task/<safe-task-id>-<short-hash>
```

The hash prevents normalized task-ID collisions. Neither path nor branch uses
an agent name because agent assignment may change.

### Ephemeral snapshot

Read-only work that needs an uncontaminated upstream tree may create a detached
temporary worktree. It must be removed in `finally`, as
`normalize-scenario-frontier` already does. A crashed temporary snapshot may
leave a prunable Git registration, but it must not become durable task context.

### Branch versus worktree

A branch is a durable Git deliverable. A worktree is temporary execution
infrastructure.

After a successful attempt:

- no-change task: remove the worktree and its empty local branch;
- committed local result: remove the clean worktree, retain the branch, and
  keep the same task live with an exact review or integration Condition;
- pushed/pipeline result: remove the clean worktree and retain branch and
  commit identity on that live wait;
- already integrated result: remove worktree and delete the merged local
  branch; and
- explicitly rejected result: restore the workspace to no-change with review
  evidence, then remove the worktree and branch; and
- dirty result: do not converge the task. Retain the workspace for recovery
  and move the task to visible attention.

There is no terminal `branch-retained` outcome. `branch-retained` is only an
observation on a live waiting or attention task. A commit, push, pull request,
or pipeline run proves delivery progress; none alone proves the requested
change reached `dev`.

### Legacy branch reconciliation

The pre-pilot branch population is a finite migration frontier. One maintain
task, `legacy-branch-reconciliation`, observes unattached branches whose
patches are absent from current `origin/dev`. It groups them by the convention
of touched `features/<feature>` paths (or an exact multi-feature signature) and
declares one family-review leaf at a time. The single-writer frontier keeps
`origin/dev` integration mechanically serial without adding a merge queue. It
does not schedule agents or store a second branch registry.

Each family leaf uses one task-owned worktree and the reusable
`legacy-branch-family-reconciliation` workflow:

1. revalidate source branch names and heads against current Git state;
2. review redo/repair/publication attempts as one change family;
3. apply and verify the smallest accepted result, or explicitly reject every
   source attempt with evidence;
4. advance `origin/dev` only by a checked fast-forward from the reviewed base;
5. remove the represented local and remote source refs; and
6. let ordinary task-workspace finalization remove the integrated/no-change
   task branch.

Git closeout and task-result admission are two durable boundaries. A process
can therefore merge a verified candidate, remove its source refs, and then
fail before the task result is accepted. That does not create new domain work
and must not strand the old task in attention.

The maintain controller recovers this case through the same task:

1. read the task's exact recorded source branch and commit;
2. prove the recorded commit is an ancestor of current `origin/dev`;
3. prove a same-named local source ref has not moved and that no attached or
   dirty source recovery worktree would be discarded;
4. unblock the existing task, rather than closing it or creating a successor;
5. let the domain workflow re-read local and remote refs, remove only refs that
   still point at the recorded commit, and return ordinary convergence; and
6. let task-workspace finalization perform normal closeout.

A second mechanically equivalent recovery applies when the exact recorded
source ref still exists but its commits are patch-equivalent to current
`origin/dev`. The controller may use `git cherry origin/dev <source>` only as
replay eligibility evidence: the source ref must still point at the recorded
head, every reported commit must be `-`, and no attached or dirty recovery
worktree may own that source. It then unblocks the same task. It does not close
the task, delete refs, or decide that the source intent is semantically
accepted. The domain workflow performs its normal merge/no-diff check and
closeout, so ambiguous, moved, partially represented, or workspace-owned
sources remain visible for agent judgment.

Exact integrated and patch-equivalent postcondition replays take the single
writer slot before ordinary retryable attention. This prevents mechanically
closable tasks from being starved behind a large retry frontier; it does not
change the domain decision or widen the eligibility gate.

Within ordinary retryable attention, the controller orders only by bounded
mechanical cost: fewer represented feature roots, fewer changed files, then
the oldest recorded attempt and stable task ID. This lets the single writer
clear small branches first without code deciding whether a patch is useful.
The reconciliation agent still reviews, repairs, accepts, or rejects each
branch from current Git evidence.

An absent source ref is not itself success. Without exact ancestry proof, or
when a ref moved or recoverable worktree remains, the controller leaves the
task visible for owner judgment. Code gathers and validates these Git facts;
it does not infer whether ambiguous source intent should be accepted.

Reconciled leaf events wake the same maintain task to refill capacity. There is
no cron, branch database, archive state, or separate scheduler. Attached or
dirty recovery worktrees are excluded from this clean-branch workflow and
remain a second, explicit recovery-review phase.

An exact pipeline or repository-ref wait needs `sourceCommit`, remote branch,
base commit, and Condition identity. It does not need a checked-out local copy.

## Workspace selection without per-task configuration

Workspace selection belongs to reusable execution experience, not arbitrary
task data.

Add one optional workflow-module convention:

```ts
export const workspace = "task";
```

The default remains `shared`. A workflow marked `task` receives a prepared
task worktree as `ctx.workspaceDir`. The loader resolves this before workflow
execution and finalizes it after handler verification.

For AKS:

- maintain controllers, focus, stall review, approval dispatch, and other
  observation workflows remain shared and must not mutate the domain checkout;
- deterministic clean-upstream inventory continues to use an internal
  ephemeral detached worktree;
- reusable domain mutation workflows declare `workspace = "task"`; and
- an unbound owner task remains shared/read-only. If owner judgment discovers
  that source mutation is needed, it creates one bounded successor bound to an
  appropriate mutating workflow instead of editing the canonical checkout.

This makes the workflow carry the learned process: clean base, bounded change,
verification, commit, and closeout. It avoids adding `workspaceMode` to every
task or asking the agent to decide topology from prose.

If one generic AKS mutation workflow is needed initially, it should represent
real reusable experience—not merely wrap Git:

```text
prepare current origin/dev task worktree
  -> give aks-explorer the exact bounded task and workspace
  -> require scoped verification
  -> require a clean committed result or explicit no-change
  -> capture branch/commit/pipeline evidence
  -> finalize workspace
```

## Attempt lifecycle

Workspace mechanics extend the existing task attempt; they do not introduce a
new task lifecycle.

```text
task ready
  -> reconciler resolves owner/workflow
  -> workflow metadata requests shared or task workspace
  -> infrastructure prepares/reuses workspace
  -> handler runs with resolved workspaceDir
  -> handler result and optional verifier establish acceptance
  -> infrastructure captures Git disposition and finalizes workspace
  -> reconciler atomically records task result/receipt
```

Preparation and finalization are infrastructure adapters around agent
execution. They do not belong in agent core and do not emit scheduling
decisions.

The attempt observation may record:

```json
{
  "workspace": {
    "kind": "task-worktree",
    "path": "/app/worktrees/aks-rp-e2e/example-a1b2c3",
    "baseRef": "origin/dev",
    "baseCommit": "<sha>",
    "branch": "task/example-a1b2c3",
    "headCommit": "<sha>",
    "disposition": "active | retained-for-recovery | branch-retained | removed"
  }
}
```

This is observed attempt metadata, not desired task specification and not a
workspace registry. Achieve receipts retain only the bounded final Git lineage
needed for audit and dependency handoff.

## Recovery

Recovery becomes deterministic:

- retry of the same generation resolves the same task path;
- replacement agent receives the same `workspaceDir`;
- active or failed attempt with a matching marker may resume;
- missing expected worktree with a retained branch can be recreated from the
  recorded head commit;
- dirty worktree with no matching live task is an orphan requiring owner
  judgment, never automatic deletion; and
- multiple worktrees for the same task generation are an integrity finding.

The worktree is helpful recovery state while edits are uncommitted. Once the
result is committed, the branch and commit are the smaller and more portable
recovery state.

## Observation and events

The app should observe workspace integrity without turning observation into a
second scheduler.

A deterministic inventory compares:

- `git worktree list --porcelain`;
- current task attempts and attention resources;
- completion receipts;
- branch reachability from current `origin/dev`;
- full tracked and untracked status; and
- disk use.

It emits a semantic change event only when an anomaly fingerprint changes, for
example:

```text
aks.workspace.integrity.changed
```

The existing app owner path decides whether to create cleanup work. The
observer does not delete branches, remove worktrees, or complete tasks.

Useful read-model counts are:

- persistent task worktrees;
- active-attempt worktrees;
- retained recovery worktrees;
- unowned clean worktrees;
- unowned dirty worktrees;
- prunable registrations;
- canonical checkout dirty/diverged; and
- workspace bytes.

## Cleanup migration

The existing topology requires a controlled migration, not a bulk delete.

### Phase 0 — Pause mutation

- Pause new AKS domain mutation attempts through the supported project/app
  lifecycle control.
- Keep external pipeline/ref watchers running so facts continue to arrive.
- Drain or explicitly interrupt current mutating attempts.

### Phase 1 — Freeze an inventory

Produce a reviewed inventory row for every registered worktree:

- path, branch/detached head, base and head commits;
- full dirty status including untracked files;
- merged/reachable and patch-equivalent state against refreshed `origin/dev`;
- local/remote branch existence;
- matching task, attempt, receipt, session, pipeline, or wait; and
- proposed disposition with evidence.

The inventory is migration evidence, not a continuing registry.

### Phase 2 — Safe mechanical reduction

After review, remove only entries that satisfy exact mechanical gates:

- prunable registrations whose paths no longer exist;
- clean detached worktrees whose head is reachable from `origin/dev` and which
  have no live attempt;
- clean attached worktrees whose branch is merged and which have no live
  attempt; and
- clean unmerged worktrees whose branch/commit is safely retained locally or
  remotely and whose task does not require uncommitted files.

Removing a clean unmerged worktree does not delete its branch. Remote branch
deletion is a separate, later policy.

### Phase 3 — Recover dirty and ambiguous work

Review the 26 tracked-dirty worktrees and the dirty canonical root
individually:

- if content is already published, prove equivalence and discard residue;
- if content is one coherent unpublished slice, checkpoint it on a task branch
  and restore or create its exact task representation;
- if content mixes tasks, split by feature/task evidence without manufacturing
  one mixed commit;
- if content is generated or reproducible, prove the generator/input authority
  before discarding it; and
- if ownership cannot be established, retain it in visible migration attention
  rather than hiding it in a stash.

The current root is the highest-risk item because it contains fifteen
apparently unique commits plus a broad dirty diff. It must be treated as a
quarantine workspace until every slice has a disposition.

### Phase 4 — Restore the canonical checkout

Once the root is clean and all unique work is represented:

- switch the root to local `dev`;
- fast-forward local `dev` to refreshed `origin/dev`;
- verify zero tracked and untracked changes;
- verify app workflows resolve the same domain path; and
- prohibit direct task branches in the root.

### Phase 5 — Enable lifecycle enforcement

- Add workflow workspace metadata and the infrastructure adapter.
- Bind AKS mutation leaves to mutating workflows.
- Add focused prepare/reuse/finalize/recovery tests.
- Run a canary mutation task and one retry/handoff task.
- Enable integrity observation.
- Resume normal AKS mutation work.

## Acceptance criteria

The migration and lifecycle are successful when:

1. `/app/projects/aks-rp-e2e` is clean `dev` at current `origin/dev`.
2. Every persistent worktree maps to one live task generation or retained
   failed-attempt recovery.
3. No task generation has multiple worktrees.
4. Retries and replacement agents reuse the same worktree.
5. Converged and waiting tasks leave no dirty local worktree.
6. Pipeline/ref waits retain branch/commit lineage without retaining a local
   checkout.
7. Detached temporary worktrees are removed after their workflow.
8. Prunable and unowned-clean worktree counts are zero after migration.
9. Direct `git switch -c` or task commits in the canonical root are rejected or
   surfaced immediately.
10. Task reconciliation, Conditions, and completion receipts remain the only
    work lifecycle; no workspace scheduler or registry is introduced.
11. Every terminal task branch has been integrated into `dev` or explicitly
    rejected, and the branch has been removed.

## Costs and risks

### Cost

- one optional workflow metadata convention;
- one deterministic Git workspace adapter around task workflow execution;
- one AKS mutating workflow or updates to existing mutating workflows;
- migration inventory and careful review of dirty/unmerged residue; and
- focused UI/read-model counts for workspace integrity.

### Risks

- an incorrect cleanup classifier could delete unpublished work;
- a task branch based on stale `origin/dev` can still produce stale work unless
  preparation refreshes and records the ref;
- finalization before verifier/readback completion could remove evidence too
  early;
- generation changes may conflict with retained dirty recovery state;
- Git remote deletion is more dangerous than local worktree removal; and
- making every task isolated would recreate the current explosion if closeout
  is not reliable.

Mitigate these by separating inventory from judgment, requiring full dirty
checks, retaining branches before deleting worktrees, finalizing only after
verification, and piloting with AKS before generalizing.

## Rejected alternatives

### Workspace per agent

Rejected because tasks move between agents. It makes recovery depend on
private agent state and repeats the current arbitrary-root problem.

### Worktree for every task

Rejected because maintain controllers, exact waits, reviews, and read-only
observations do not need persistent checkouts. This would recreate hundreds of
idle worktrees.

### Agent creates and cleans its own worktree

Rejected because the current topology is evidence that distributed cleanup has
no reliable terminal owner.

### Persisted workspace registry

Rejected because task attempts plus Git metadata already provide ownership.
A registry would become another mutable authority that can drift.

### One cleanup controller per workspace type

Rejected because preparation/finalization belongs to the existing task attempt
lifecycle. One deterministic observer and the existing app owner are enough
for anomaly recovery.

### Keep the canonical root on the latest task branch

Rejected because branch names then lie about the mixed content, observations
become stale, and concurrent tasks contaminate one another.

## Recommendation

Approve the direction and perform the cleanup as a paused AKS migration. Pilot
workflow-owned task workspace selection and infrastructure-owned lifecycle in
AKS. Do not generalize it to every app until the canary proves:

- canonical-root contamination stops;
- retry/handoff reuses one workspace;
- completed attempts remove their worktrees; and
- no unpublished work is lost during closeout.

This is the bounded follow-up evidence requested by the accepted task workspace
convention. The observed AKS topology justifies an implementation pilot, but
not a universal workspace subsystem.

## Implementation result — 2026-07-21

The pilot is implemented while the app remains paused for final verification:

- workflow modules may export `workspace = "task"`;
- the project reconciler prepares, reuses, and finalizes deterministic Git
  worktrees and records lineage on attempts and receipts;
- nested workflow-agent filesystem tools use the effective worktree as their
  real execution root;
- AKS scenario-adapter leaves bind to the owner workflow
  `domain-task-execution`; shared ledger and observation workflows do not;
- an hourly deterministic integrity watcher emits
  `aks.workspace.integrity.changed` only when its fingerprint changes and asks
  the existing app owner path for judgment; and
- focused tests cover preparation, reuse, clean no-change removal,
  committed-branch retention, dirty-result refusal, metadata admission,
  tool-root rebasing, and observer behavior.

Migration results are retained under `evidence/ops/`:

- `task-workspace-migration-cleanup-20260721.json`: 466 clean worktrees
  removed with zero gate failures and one detached unpublished head preserved
  as a rescue branch;
- `task-workspace-dirty-relocation-20260721.json`: all 95 historical dirty
  non-canonical worktrees relocated to
  `/app/worktrees/aks-rp-e2e/recovery/` without content loss;
- `task-workspace-canonical-restoration-20260721.json`: the shared checkout is
  clean `dev` at `origin/dev`; the former root's 198 status entries, divergent
  branch/commits, and scratch workspace are visible in one quarantine
  worktree; and
- `task-workspace-migration-inventory-20260721.json`: the current
  post-migration topology and full dirty/untracked status.

The 96 dirty recovery worktrees are intentionally not auto-deleted. They are
legacy recovery evidence, not execution capacity. Owner review may later
extract coherent work into normal branches or workflows and remove each
recovery checkout. New task-worktree closeout prevents this population from
growing.
