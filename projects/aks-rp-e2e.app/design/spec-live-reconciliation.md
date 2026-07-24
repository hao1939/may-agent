# Spec Live Reconciliation

Status: implemented AKS workflow contract.

## Scope

Use `spec-live-reconciliation` only when one finite AKS spec task may require
source mutation, exact live verification, fix-forward retries, and integration
into a shared branch. Investigation, approval, observation-only review,
terminal-disposition repair, compact planning, and ordinary app operations keep
their existing owners or workflows.

## Mental model

One task declares the desired result:

> This spec has an accepted live result, and every source change used by that
> result is merged into its integration branch.

The owner-owned workflow reconciles current Git and Azure DevOps facts toward
that result:

```text
task-owned branch
  -> edit and commit
  -> push exact commit
  -> live ADO run
  -> fix and rerun when needed
  -> merge current origin/dev into the tested branch when needed
  -> push the verified ancestry directly to dev
  -> verify tested source in origin/dev
  -> converged receipt
```

Promotion from `dev` to `main` uses a pull request and its normal review/merge
wait. A verified task branch does not open a PR merely to reach `dev`.

The task does not store or schedule a mutable phase machine. Each attempt
derives the next step from the task branch, exact-run metadata, PR state, and
`origin/dev`.

## Conventions

- Workflow: `spec-live-reconciliation`
- Owner: `aks-explorer`
- Workspace: runtime-provided task worktree
- Pipeline: Azure DevOps `467665`
- Pipeline target parameter: `input.target`, defaulting to `staging`
- Standalone RP selection: optional exact `input.standaloneBuildId`; this is
  the authoritative override while the literal pipeline target remains
  `staging`
- Integration target: direct push to `dev` by convention
- PR target: `main` when a workflow explicitly requests main promotion
- Runtime artifacts: `workspace/tasks/<task-generation>/` in the canonical
  domain workspace
- Source artifacts: only committed files on the task branch

The workflow, not the agent, pushes the branch, discovers or dispatches runs,
integrates verified ancestry into `dev`, creates a PR only for `main`, and
verifies publication. The agent edits source, resolves semantic conflicts, and
judges exact terminal artifacts. The app projects an accepted proof into the
spec-loop read model after the task receipt is persisted.

A source- or provider-mutating repair must use this workflow (or another
workflow that explicitly declares the same capabilities). Its task input keeps
the decision context—spec, failure, prior proof, and desired result—while the
workflow supplies the execution context—task worktree, provider tooling,
exact dispatch parameters, Conditions, and publication. Direct owner handling
is for judgment and organization; it must not replace that execution context.

## Durable waits

Live execution waits on:

```text
pipeline-run:<runId> reaches state=completed
```

Main-promotion review waits on:

```text
pull-request:<prId> reaches completed, abandoned, or conflicted
or its source commit differs from the exact tested commit
```

Pipeline and PR watchers observe provider state and emit repeatable level facts.
They never read the task tree. The generic Condition tracker correlates those
facts and wakes the task. Direct `dev` integration has no review wait: push
failure is retried from refreshed remote facts, while a merge conflict returns
to the agent for repair and a fresh exact live run.

## Recovery and idempotency

- Run metadata contains task id, generation, spec id, branch, source commit,
  pipeline target, optional standalone build id, and optional retry parent.
- A previously dispatched exact run may be preserved as
  `input.priorVerificationRunId`. The workflow validates its spec, source,
  target, and standalone build, then waits for it before dispatching anything
  else. Its terminal artifact is repair context; proof for a different task
  source commit still requires an exact run.
- An attempt discovers an existing exact run before dispatching another.
- An interrupted dirty task worktree is given back to the owner agent to finish,
  validate, and commit or to remove only proven task-generated residue. Ambiguous
  ownership requires owner review; it is never silently discarded.
- One unchanged retry is allowed only after an artifact-backed transient
  diagnosis. Repeated nonpassing runs on the same commit require a fix, exact
  external wait, or owner judgment.
- For `dev`, the workflow fetches current `origin/dev`, preserves the tested
  commit in ancestry, and pushes only a fast-forward remote update. A concurrent
  update causes a bounded refresh/retry, not a wait.
- A conflict with current `origin/dev` returns to the agent on the same task;
  the repaired commit must receive a fresh exact live run before integration.
- For `main`, a PR is discovered by exact source branch and target before
  creation. Reviewer changes invalidate the old proof, and an abandoned PR is
  an owner decision rather than permission to recreate it.

## Completion proof

The task context retains one compact proof containing the task generation,
spec, live target/build, source branch and commit, accepted run, and
artifact-backed verdict. A changed task converges only after the exact tested
source commit is present in the integration branch ancestry. For `dev`, this is
proved after direct integration; for `main`, it is proved after PR completion.

Main-promotion PRs therefore use a no-fast-forward merge commit. If a reviewed
PR is squash/rebase merged, the existing exact proof is insufficient; a
separate exact live proof for the merged integration revision is required
before closeout.

## Repair-task rule

Keep repair, rerun, review, and publication in one task. If execution context
is missing, revise that task to bind the capable workflow and preserve its
input; do not create an equivalent successor. A repeated identical capability
blocker waits or escalates on the same task instead of growing the task tree.

## Non-goals

- No new controller or scheduler.
- No workflow phase database.
- No PR-status database.
- No generic replacement for one-off owner work.
- No conversion of product, environment, or approval waits into source-change
  work.
