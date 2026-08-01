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
  -> replay only the task-owned commits onto current origin/dev when needed
  -> live ADO rerun for the replayed commit
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
- Terminal disposition: allowed by default for ordinary finite reconciliation;
  set `input.allowTerminalDisposition: false` when acceptance requires an exact
  passing live result
- Runtime control artifacts: `workspace/tasks/<task-generation>/` in the
  canonical domain workspace
- Terminal run evidence: `workspace/tasks/<task-generation>/runs/<runId>/`;
  evidence for one ADO run must never share a download directory with another
  run
- Source artifacts: only committed files on the task branch

The resolved live target is part of the task's intent, not a repair choice.
Once a reconciliation starts, repair, retry, wait, escalation, and successor
work preserve that exact target and standalone build selection. An agent must
not guess or fall back to another subscription, region, target, or build when
the selected environment is unavailable. A different environment starts as
new explicitly targeted work. Scenario-normalization leaves write
`target: staging` into their task input instead of relying only on the default.
The staging target resolves through the repository's checked-in target
contract; ambient Azure CLI state is never a substitute.

The workflow, not the agent, pushes the branch, discovers or dispatches runs,
integrates verified ancestry into `dev`, creates a PR only for `main`, and
verifies publication. The agent edits source, resolves semantic conflicts, and
judges exact terminal artifacts. The app projects an accepted proof into the
spec-loop read model after the task receipt is persisted.

A successful terminal review must not change the tested source merely to record
that success. Before the receipt is persisted, `ready`, an older accepted run,
or missing `latestLiveResult` fields can still be the correct checked-in source
posture; the app-owned proof projection records the newly accepted run after
integration. When the provider run succeeded and hard proof validation found no
structural gap, the agent returns `accepted-pass` without editing the spec,
model, test, generated views, or an evidence memo. A `committed` decision after
a succeeded run is reserved for an actual behavior or contract defect exposed
by the evidence, and that changed source requires a fresh exact run. This keeps
proof recording from recursively invalidating the commit it is meant to prove.

After the agent judges a terminal run and before any direct `dev` integration,
workflow code validates the hard proof facts from that exact run: pipeline and
source identity, selected spec, resolved staging target, per-spec pass, every
`claim` assertion declared by the tested spec source, and cleanup evidence.
Claim proof is structural: the exact per-spec artifact must contain each
declared assertion id with `verdictImpact: claim` and `ok: true`. A success
summary, an empty claim set, a green provider result, or an agent
`accepted-pass` judgment cannot bypass this gate. Missing proof returns the
declared IDs and the exact observed claim IDs to the same domain workflow for
agent judgment, repair, and a fresh exact run; code does not decide which side
of the contract should change. It is never integrated first and rejected only
by the later task verifier. Cleanup collection is structural too: the verifier
reads cleanup assertions from both the standard top-level per-spec
`assertions` array and the legacy `raw.assertions` array, and accepts an
explicit passing cleanup object from either level. It does not infer cleanup
from summaries or prose. The
post-integration verifier repeats these checks and additionally proves current
`origin/dev` ancestry and the scenario-source invariant.

Before the first exact run for a source commit, the agent reviews that current
commit against the original task and decides whether it is ready for live
execution. This review is required even when an earlier workflow step already
committed a carrier, inventory, merge, or admission repair. A clean changed
branch proves only that source work happened; it does not prove that a blocked
spec, reviewed exception, or intentionally paused execution contract is ready
to spend a live run. Code supplies the current Git and task facts, while the
agent chooses a bounded repair, `test-current`, an exact wait, or an ownership
boundary. Code dispatches only after that judgment and the hard admission
checks both permit it.

Before every ADO dispatch, including a replacement run after a repair or merge
conflict, workflow code runs the repository's own private-source and live
admission checks in the exact task worktree. These are hard dispatch
invariants, not a spec verdict. If either check fails, no run is queued: the
same domain agent receives the exact command output and continues repairing the
same task. A commit produced by that repair is checked again before dispatch.
Direct scenario carriers are loaded by the ADO executor through Vitest. For a
new or repaired direct `.test.ts` carrier, scoped validation therefore uses the
Vitest collection/runtime surface and not only `bun test`; the carrier imports
test APIs from `vitest`, never `bun:test`. This is execution compatibility, not
a product judgment, and a source that has not passed that surface is not ready
for live dispatch.
Uncertainty about a secret or variable on the current ADO execution surface is
not itself proof of an external blocker. Evidence from an older backend,
different source commit, or different target is repair context only. When the
hard admission checks pass and no exact current-surface observation proves the
required input unavailable, the agent marks the source live-ready and lets the
workflow dispatch the bounded run. If that run proves an input is unavailable,
the resulting exact evidence may justify a wait or ownership handoff naming the
real producer and resume condition.
An unsupported product behavior is not automatically nonlive; when the public
API exposes an observable rejection or no-op contract, the agent should model
and verify that behavior as a live negative test. If no truthful staging-
observable contract exists, the agent records an exact external wait or
escalates the ownership boundary. A source-only check is useful diagnostic
evidence, but it is not completion and is never integrated as accepted live
normalization.

Immediately before queueing each direct scenario-normalization run, after the
candidate branch is pushed, the workflow fetches `origin/dev` again. The run is
queued only when that latest target commit is already in the candidate's
ancestry. If `dev` advanced while the agent was reviewing or repairing the
source, the workflow replays only the task-owned patches onto the new target
and reviews the new exact commit before spending a live run. The terminal
integration check remains the final race guard, but a target advance already
known at dispatch time must not create a predictably stale live run.

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

A scenario-normalization task must not wait for a later `refs/heads/main`
same-spec pass. That pass would test a different source lineage and therefore
cannot prove or publish the task-owned normalization commit. A normalization
wait must name a fact that can actually advance this task: the exact queued run
for its source commit, an exact external capability/dependency with a real
producer, or an ownership-boundary decision. If direct execution is
intentionally unsupported, the agent implements an observable live negative
contract where possible; otherwise it keeps the same task on an exact external
wait or escalates the genuine external limitation. The current-main same-spec
pass Condition remains a master-validation product-recovery pattern, not a
scenario-normalization escape path.

An arbitrary `origin/dev` advance is not such a fact. A repository wait is
valid only when it names the exact external producer or publication that can
change this row. When current evidence already identifies a same-spec carrier,
model, or test defect, the task remains active repair. If stale task acceptance
text is too narrow for that repair, the owner revises the same task and resumes
`spec-live-reconciliation`; it does not create a successor that wakes after an
unrelated merge.

## Recovery and idempotency

- Run metadata contains task id, generation, spec id, branch, source commit,
  pipeline target, optional standalone build id, and optional retry parent.
- Each terminal review receives a run-specific evidence directory keyed by the
  exact ADO run id. A later review cannot infer checkout lineage, results, or
  cleanup from files downloaded for an earlier run of the same task.
- Before terminal agent judgment, workflow code uses the authenticated Azure
  DevOps CLI to collect exact run metadata, the artifact list, and each
  available artifact into that run-specific directory. Code collects these
  facts; the agent judges the spec verdict and next domain move. Agents do not
  scrape Azure DevOps web pages or treat a sign-in response as missing proof.
- A previously dispatched exact run may be preserved as
  `input.priorVerificationRunId`. The workflow validates its spec, source,
  target, and standalone build, then waits for it before dispatching anything
  else. Its terminal artifact is repair context; proof for a different task
  source commit still requires an exact run.
- An attempt discovers an existing exact run before dispatching another.
- A red strict scenario-source invariant is repaired before broad provider
  history is queried. No ADO history can make a still-plain carrier ready for
  dispatch. Once provider history is relevant, the workflow reads its exact
  saved run receipt first; otherwise it requests a bounded, branch-scoped run
  list. It does not serialize the app on an unscoped scan of the latest 100
  definition runs for every leaf.
- Azure DevOps CLI calls yield the app event loop while provider I/O is in
  flight. Provider collection must not prevent session deadlines, task
  reconciliation, or unrelated leaves from running.
- If `origin/dev` advances after the agent has judged the task patch but before
  dispatch, a conflict-free scenario replay retains that judgment. The
  workflow reruns deterministic admission and requires a fresh exact live run;
  it asks the agent again only when replay conflicts or the replayed source
  fails admission.
- One exact terminal run/source pair is judged at most once during a workflow
  attempt. A dispatch-time target advance must not recursively restart
  reconciliation and present that same terminal evidence to the agent again.
  The workflow preserves the completed judgment, replays only the task-owned
  patches onto current `origin/dev`, reruns deterministic admission, publishes
  the replayed task source, and queues one fresh exact run. Only a replay
  conflict or a red admission result creates new facts that require another
  agent judgment.
- When `origin/dev` advances after an exact run passes, code collects the
  merge base, source paths, target paths, exact protected-path overlap, and the
  exact-spec knowledge-model comparison. The domain agent judges whether those
  intervening changes invalidate the live proof. Code may integrate an
  agent-accepted proof only when the merge leaves every tested protected path
  byte-for-byte unchanged; a conflict or changed protected path requires a
  refreshed source and a fresh exact run. File-name allowlists must not make
  this domain judgment. This allows independent normalization leaves to finish
  in parallel without accepting a proof whose tested behavior changed.
- An exact terminal run for the current task source is collected and judged
  before scenario-normalization replay considers a newer `origin/dev`. A failed
  run is domain evidence, not stale source to discard. If that judgment commits
  a repair, the repaired source is then replayed onto current `dev` before its
  next live dispatch; an exact wait or escalation remains attached to the
  reviewed run without another unchanged provider attempt.
- Every new source commit passes `runner/check-private-source-policy.ts` and
  `runner/check-live-admission.ts` for the exact selected spec set before ADO is
  queued. A failed local dispatch gate returns its raw findings to the same
  agent for bounded fix-forward work; it is never spent as a known-failing ADO
  run.
- Every direct scenario-normalization dispatch re-fetches `origin/dev` after
  its source branch push. If current `dev` is not an ancestor of that exact
  source, reconciliation refreshes the candidate before queueing provider work.
- A terminal admission-preflight refusal is repair evidence, not a passing or
  accepted-nonlive result. The same task must become live-admissible, wait on an
  exact external fact, or escalate a genuine ownership boundary.
- If an agent invocation ends before producing a structured judgment, the
  workflow waits through one short provider cooldown and retries that invocation
  once with the same task worktree and hot evidence. An empty or interrupted
  invocation is a runtime failure, not an agent decision and not an
  ownership-boundary handoff. Only a returned `needs-owner` judgment may enter
  the accountable-owner path. Two runtime failures still end the workflow. For
  an otherwise active fix-forward judgment, the workflow permits up to three
  structured judgments so the agent can correct both a missing readiness field
  and a second invalid wait shape without falling into slower recovery. Code
  never supplies the domain verdict. A terminal-run
  `test-current` judgment is invalid because that exact source has already run;
  the workflow feeds the full terminal evidence back to the same agent for a
  corrected verdict or fix-forward move.
- Exhausting those bounded structured-result corrections is also a workflow
  execution failure, not an implicit `needs-owner` judgment. The workflow lets
  the runtime retain the task worktree and mark the iteration for attention.
  When live-execution capacity is available, `normalize-scenario-frontier`
  unblocks that same task generation and the same learned workflow starts a new
  iteration from the retained source and current provider evidence. It does not
  create a successor task or invoke the owner fallback. Only an agent that
  explicitly returns `needs-owner` may cross that ownership boundary.
- If that accountable-owner result is rejected by the declared workflow's
  mechanical verifier, the original task remains unfinished. The normalization
  controller returns the same task generation and retained worktree to
  `spec-live-reconciliation`; it does not leave attention residue or accept a
  replacement task. Code routes the rejected result back to the capable
  workflow, while the domain agent makes the next judgment from current facts.
- Source state and permission to start live execution are separate agent
  judgments. Every initial `committed` or `test-current` result must also carry
  `liveReady: true|false`. Code may queue ADO only when it is explicitly true;
  a commit by itself is never permission to run. When it is false, the agent
  must name one exact observable Condition and the workflow keeps the same task
  waiting on that fact. If no such fact is observable by the app, the agent
  returns `needs-owner` instead of hiding the boundary in prose.
- Instructions that forbid the agent from pushing or queueing provider work do
  not imply `liveReady: false`. They preserve the workflow boundary: the agent
  prepares and judges the source, while workflow code publishes and dispatches
  it. Once the exact source is runnable, the agent returns `liveReady: true` so
  the workflow can perform that mechanical next step.
- A task commit not yet present on `origin/dev` is not an external readiness
  blocker. The workflow owns task-branch publication, current-`dev` replay, live
  dispatch, and final direct integration. Agents must not use a generic repo-ref
  wait for those mechanics: they return `liveReady: true` when the exact source
  is runnable, or `needs-owner` when a reviewed non-runnable disposition needs
  exceptional judgment.
- Scenario normalization also supports one explicit
  `terminal-disposition` judgment for a source that is intentionally not
  runnable. This is an agent judgment, not a status inferred by code. The
  same domain agent may use exact terminal live evidence to replace a stale
  positive source posture with the reviewed `status`, `specState`,
  `statusReason`, and latest-live-result fields, commit that bounded source
  change, and return the structured `terminal-disposition` judgment. It does
  not hand this work to the generic owner merely because the spec still said
  ready or pass before the terminal run. `needs-owner` remains available only
  when the evidence cannot support the domain judgment or a real external
  authority must decide it.
- A terminal-disposition result is not a live pass. Ordinary finite work may
  use it to preserve a truthful reviewed product or environment posture. A
  pass-required task sets `input.allowTerminalDisposition: false`; the agent
  decision validator, executor, final verifier, and same-task revision guard
  all enforce that policy. Such a task remains repair or an exact wait until a
  passing proof exists. For scenario normalization, code additionally proves
  that the task worktree is clean, the exact plain-carrier row has disappeared
  from strict inventory, the named spec fields exactly match the structured
  judgment, and the bounded source commit can be integrated directly into
  current `dev`. Completion evidence must say explicitly that no new ADO pass
  was claimed.
- A concurrent `dev` update, replay conflict, or retained task branch that no
  longer descends from the current attempt baseline remains same-task domain
  work. Code reports the exact Git lineage facts with a structured replay
  reason; it does not infer a repair from error prose. The workflow gives that
  state back to the same agent, which replays the task-owned terminal source
  onto current `origin/dev` and resolves any semantic conflict. Code then
  rechecks the clean linear lineage, terminal fields, and strict row before
  integration. A repairable lineage mismatch must not become `needs-owner`, a
  publication child, or another owner handoff for the same reviewed
  disposition.
- Initial source preparation accepts `committed`, `test-current`, one exact
  wait, `needs-owner`, or, when task policy allows it, the structured
  `terminal-disposition` judgment above. It accepts `accepted-pass` only when
  the caller explicitly asks the workflow to validate an existing later
  current-main recovery observation. Any other preparation verdict stays
  inside the same structured correction loop; it does not become an owner
  handoff merely because the verdict shape was invalid.
- The same readiness rule applies after a terminal live failure: a repaired
  commit is queued as a replacement only with `liveReady: true`. A repair that
  still depends on an exact external fact remains attached to the current task
  and does not spend another provider run.
- A terminal live failure that proves a product gap is still same-task domain
  work. The domain agent records the reviewed terminal source posture and
  returns `terminal-disposition`; workflow code then validates the structured
  fields and performs direct `dev` integration. The generic owner fallback
  must not repeat those mechanics and then return a result that loses the
  workflow's terminal-disposition proof contract.
- Accountable-owner fallback supplies exceptional domain judgment only. It does
  not push the task branch, queue ADO, accept live proof, or integrate source on
  behalf of this workflow. Any resulting in-scope repair returns through this
  same workflow so its dispatch and exact-proof invariants still apply.
- An interrupted dirty task worktree is given back to the owner agent to finish,
  validate, and commit or to remove only proven task-generated residue. Ambiguous
  ownership requires owner review; it is never silently discarded. This recovery
  step reports only `committed`, `test-current`, or `needs-owner`. A premature
  domain verdict such as `terminal-disposition` is corrected in the same agent
  invocation loop, then evaluated by the normal domain path so integration and
  terminal-disposition evidence cannot be bypassed.
- A stale task commit may have been rebased or patch-equivalently integrated
  into `dev`, so commit ancestry alone is not authoritative. When `git cherry`
  reports no novel task patches, the workflow resets the dedicated task branch
  to current `origin/dev` and continues the normal structured verification path.
  It does not replay an empty patch or hand the task to the owner merely because
  unrelated target changes make the trees differ.
- One unchanged retry is allowed only after an artifact-backed transient
  diagnosis. Repeated nonpassing runs on the same commit require a fix, exact
  external wait, or owner judgment.
- For `dev`, the workflow fetches current `origin/dev`, preserves the tested
  commit in ancestry, and pushes only a fast-forward remote update. A concurrent
  update causes a bounded refresh/retry, not a wait.
- A scenario-normalization task records the `origin/dev` commit from which its
  task branch was created as a safety fence. When current `origin/dev` has
  advanced outside that branch, the workflow uses Git patch equivalence
  against current `origin/dev` and replays only novel task patches. Commits
  already reachable from or patch-equivalent to current `origin/dev` are not
  replayed merely because they appeared after the old recorded base. It does
  not merge the whole current repository history into a stale task lineage. A
  clean replay still changes commit identity and therefore requires a fresh
  exact ADO run before publication.
- A replay conflict returns the in-progress rebase to the same domain agent.
  The agent resolves only conflicts caused by the task-owned commits, completes
  or aborts that rebase, and leaves one clean commit lineage. The workflow then
  force-updates only the dedicated task branch with lease protection and queues
  the fresh exact run. Unrelated generated/model conflicts are evidence that
  the recorded task base or branch ownership is invalid; they are not work to
  resolve by accepting all of either side.
- When the exact tested source commit is already an ancestor of current
  `origin/dev`, preserve that source commit and its run/proof identity and
  converge. Do not fast-forward the task branch to unrelated newer `dev`
  commits before matching its run; doing so discards valid proof and creates an
  endless moving-target rerun loop.
- A task-owned replay conflict with current `origin/dev` returns to the agent on
  the same task; the repaired commit must receive a fresh exact live run before
  integration.
- More generally, if `origin/dev` advances after the accepted live run and is
  no longer in the tested source ancestry, the workflow compares the tested
  task paths with the target advance before deciding whether proof remains
  valid. A target advance is proof-preserving only when every target-side path
  is independent of the tested source and cannot change live execution.
  Independent scenario/model/evidence/design paths are proof-preserving, as
  are documentation, agent guidance under `skills/`, and repository-only
  `*.test.*` / `*.spec.*` files that the selected live run does not load. A
  pipeline definition, dependency manifest or lock, non-test runner file,
  shared runtime library, or overlapping tested path is proof-invalidating and
  requires a replay plus a fresh exact run. Evidence, design, skill, and
  Markdown paths are not tested paths: a clean overlap on those paths may be
  merged without discarding the live proof, provided every execution-relevant
  task path remains byte-for-byte unchanged. The workflow may create a clean
  merge only when the target advance is proof-preserving; that merge preserves
  the exact tested source commit as an ancestor and verifies that it did not
  change any tested task path. The feature-local
  `compact/staging.plan.json` is the merge-safe generated aggregate exception: clean
  Git combination may preserve independent path entries in that file, while a
  conflict still invalidates proof. This lets independent normalization passes
  integrate without repeatedly invalidating one another. Any other overlapping
  execution-relevant path, runner runtime/CI/config change, merge conflict, or
  changed tested path requires replay onto current `dev` and a fresh exact live
  run.
- Generated knowledge-map aggregation must not turn independent live passes
  into an endless moving-target loop. When current `dev` changes
  `model/knowledge-map/model.json`, code compares the structured model records
  used by the exact tested spec (`paths` and `featurePaths` selected by spec id
  or that spec's feature-path ids). The advance is proof-preserving only when
  that projection is unchanged. Generated knowledge-map views are
  proof-preserving for an exact spec dispatch because they are not selected by
  that path. A changed exact-spec projection remains proof-invalidating and
  requires a fresh run. This is a structured equivalence check, not a prose or
  filename guess.
- A task may declare `expectedVitestTestCount` when exact generated-suite
  selection is itself part of the acceptance contract. The workflow reads the
  downloaded `vitest.json` and mechanically requires exactly one observed
  `numTotalTests` value equal to the declaration before accepting live proof.
  This is an optional task-scoped hard invariant, not a general assumption that
  every spec file contains only one test.
- For `main`, a PR is discovered by exact source branch and target before
  creation. Reviewer changes invalidate the old proof, and an abandoned PR is
  an owner decision rather than permission to recreate it.

## Completion proof

The task context retains one compact proof containing the task generation,
spec, live target/build, source branch and commit, accepted run, and
artifact-backed verdict. For `dev`, convergence requires that exact tested
source commit in the integration branch ancestry. For `main`, Azure must report
that the PR used the exact tested source head and produced a completed target
commit that is present in the target branch ancestry.

The workflow verifier enforces this proof after every converged result,
including convergence returned through accountable-owner fallback. It checks
the exact task/generation/spec/target metadata, pipeline `467665` completion on
the tested commit, downloaded aggregate verdict, staging subscription and
`westus2` target, every claim assertion declared by the exact tested spec,
per-spec cleanup evidence, current `origin/dev` ancestry, and the strict
scenario-normalization row when applicable. Owner judgment may resolve an
exceptional domain question, but it cannot bypass these mechanical completion
invariants.

Squash, rebase, and merge-commit completion are all valid because the provider
records both sides of the integration. The PR head itself does not have to
remain in `main` ancestry. A downstream workflow may still require a later live
run from current `main` before it closes its broader goal.

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
