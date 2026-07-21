# Spec Live Reconciliation

Status: implemented AKS workflow contract.

## Scope

Use `spec-live-reconciliation` only when one finite AKS spec task may require
source mutation, exact live verification, fix-forward retries, and integration
through a pull request. Investigation, approval, observation-only review,
terminal-disposition repair, compact planning, and ordinary app operations keep
their existing owners or workflows.

## Mental model

One task declares the desired result:

> This spec has an accepted live result, and every source change used by that
> result is merged into `dev`.

The owner-owned workflow reconciles current Git and Azure DevOps facts toward
that result:

```text
task-owned branch
  -> edit and commit
  -> push exact commit
  -> live ADO run
  -> fix and rerun when needed
  -> PR into dev
  -> wait for review/merge
  -> verify tested source in origin/dev
  -> converged receipt
```

The task does not store or schedule a mutable phase machine. Each attempt
derives the next step from the task branch, exact-run metadata, PR state, and
`origin/dev`.

## Conventions

- Workflow: `spec-live-reconciliation`
- Owner: `aks-explorer`
- Workspace: runtime-provided task worktree
- Pipeline: Azure DevOps `467665`
- Live target: `staging`
- PR target: `dev`
- Runtime artifacts: `workspace/tasks/<task-generation>/` in the canonical
  domain workspace
- Source artifacts: only committed files on the task branch

The workflow, not the agent, pushes the branch, discovers or dispatches runs,
creates the PR, and verifies merge. The agent edits source and judges exact
terminal artifacts. The app projects an accepted proof into the spec-loop read
model after the task receipt is persisted.

## Durable waits

Live execution waits on:

```text
pipeline-run:<runId> reaches state=completed
```

Review waits on:

```text
pull-request:<prId> reaches completed, abandoned, or conflicted
or its source commit differs from the exact tested commit
```

Pipeline and PR watchers observe provider state and emit repeatable level facts.
They never read the task tree. The generic Condition tracker correlates those
facts and wakes the task.

## Recovery and idempotency

- Run metadata contains task id, generation, spec id, branch, source commit,
  and optional retry parent.
- An attempt discovers an existing exact run before dispatching another.
- An interrupted dirty task worktree is given back to the owner agent to finish,
  validate, and commit or to remove only proven task-generated residue. Ambiguous
  ownership requires owner review; it is never silently discarded.
- One unchanged retry is allowed only after an artifact-backed transient
  diagnosis. Repeated nonpassing runs on the same commit require a fix, exact
  external wait, or owner judgment.
- A PR is discovered by exact source branch and `dev` target before creation.
- Reviewer changes to the source branch invalidate the old proof and trigger a
  live run for the new head.
- An abandoned PR is an owner decision, not permission to recreate it.

## Completion proof

The task context retains one compact proof containing the task generation,
spec, source branch and commit, accepted run, and artifact-backed verdict. A
changed task converges only after its PR completes successfully and the exact
tested source commit is present in `origin/dev` ancestry.

Task-branch PRs therefore use a no-fast-forward merge commit. If a reviewed PR
is squash/rebase merged, the existing exact proof is insufficient; a separate
exact live proof for the merged `dev` revision is required before closeout.

## Non-goals

- No new controller or scheduler.
- No workflow phase database.
- No PR-status database.
- No generic replacement for one-off owner work.
- No conversion of product, environment, or approval waits into source-change
  work.
