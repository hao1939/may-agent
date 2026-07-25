# Master Validation Reconciliation

Status: implemented AKS workflow contract.

## Goal

Keep one standing task truthful:

> The complete master-validation feature set passes staging from the current
> `main` commit.

The app drives this continuously. A human or long-running agent must not poll
Azure DevOps to keep it moving.

## Mental model

Use the existing app reconciler, provider watcher, workflows, and Conditions:

```text
five-minute reconciliation pulse
  -> queue one due or newly changed origin/main run
  -> sleep on pipeline-run.state

existing pipeline watcher
  -> observe run level
  -> ingest each completed slice atomically
  -> emit pipeline.spec.observed for every verdict
  -> emit pipeline.failure.observed for each nonpassing spec

stable failure task
  -> agent classifies current artifact
  -> test issue: focused branch and PR to main
  -> wrong execution target: one exact spec-live child on the claim-bearing target
  -> product issue: notify human -> wait for later current-main pass

failed aggregate
  -> freeze one campaign branch at the exact tested main commit
  -> merge focused unmerged fix heads into that branch
  -> run -> observe -> fix -> merge another fix head -> rerun
  -> do not rebase the red campaign when main advances
  -> green campaign: wait for its focused PRs to merge
  -> verify latest main once

healthy aggregate completion
  -> passed at current main: record health and sleep until the next due cycle
```

There is no master-validation controller per spec, workflow phase database,
progress tree, or permanently running agent. The task records desired and
observed state; provider facts and compact workflow receipts let each attempt
derive the next action.

The standing cycle and its finite failure tasks are siblings under the domain
group. Each failure carries the standing task identity as structured input, so
the live failure tasks are the current known-issue list without becoming
lifecycle children that prevent the maintain task from recording current
health.

## Responsibilities

- The app defines the standing task, stable failure-task identity, ownership,
  workflow binding, and notification policy.
- `master-validation-cycle` owns the six-hour due rule, exact `main` commit,
  frozen campaign branch, one-active-run invariant, and aggregate convergence
  decision.
- The existing pipeline watcher owns Azure DevOps observation and artifact
  ingestion. It does not read task state.
- `master-validation-failure` owns classification. Product issues wait on a
  semantic later pass. Test issues reuse finite spec live reconciliation with
  integration target `main`. When aggregate staging cannot exercise the
  claim, it reuses the same spec-live implementation through a thin main-based
  workflow binding with the exact intended target. The separate binding exists
  only so infrastructure creates the worktree from `main`; it does not invent a
  second recovery process or wait for an impossible aggregate verdict.
- The agent owns artifact diagnosis and bounded source judgment inside the
  task worktree. It does not queue pipelines, push, create PRs, schedule
  retries, or edit task state.
- Runtime infrastructure owns schedules, EventBus delivery, task workspaces,
  Conditions, persistence, recovery, concurrency, and human delivery.

## Cycle rules

Every due cycle queues pipeline `467665` with these conventions:

- branch `main`;
- exact resolved `origin/main` commit;
- `feature_set=master-validation`;
- `target=staging`;
- `slices=12`;
- `slice_max_parallel=6`.

Only one matching run may be queued or running. A compact receipt preserves
the run across process reloads. The five-minute schedule is a reconciliation
pulse; the receipt owns the six-hour due decision. A full pass means healthy
now, not finished forever: the maintain task remains live and queues another
full run when the six-hour interval becomes due.

Every passing main result is compared with current `origin/main` before it is
accepted. If `main` advanced during a passing run, the app queues the latest
commit immediately. A failed main run is different: its exact tested commit
becomes the immutable base of one repair campaign. Later main advances are
recorded but do not continuously move that red campaign. They coalesce into one
latest-main verification after the campaign is green and its focused PRs merge.

The six-hour interval is the healthy periodic cadence. During repair, the same
five-minute reconciliation pulse observes the campaign branch, fix PR heads,
and active run. A changed campaign head runs immediately. An unchanged red
campaign runs again after six hours so a deployed product or environment
recovery can be observed without changing the source snapshot.
The wait requires a schedule event created after the Condition was admitted;
an older manual wake with an arbitrarily large pulse value cannot be replayed
into an immediate reconciliation loop.

## Frozen repair campaign

The campaign branch is a temporary execution surface, not another task, PR,
controller, or source of truth:

```text
main@M0
  -> fork validation/master-validation-<failed-run-id>
  -> merge exact head of focused PR A
  -> run the branch
  -> merge exact head of focused PR B
  -> rerun the same branch
  -> repeat until green
```

- There is at most one active campaign branch.
- Its base is the exact commit tested by the failed main run.
- That base never moves. Do not merge or rebase newer `main` into the campaign,
  including indirectly through a fix branch forked from newer `main`.
- Each repository-owned issue still has one focused branch and PR targeting
  `main`. The campaign merges the PR head without completing the PR.
- Before new repair work starts, a clean task workspace with no task-only
  commits is aligned to the frozen base. A retained workspace with unmerged
  task work is preserved and reconciled explicitly; it is never reset merely
  because `main` moved.
- A focused fix branch may fork from the frozen base, an ancestor already in
  that base, or existing approved campaign lineage. The campaign controller
  rejects a PR head whose fork point would import newer `main`; the focused
  change must be transplanted back onto the frozen lineage first.
- Merge every available focused fix onto the campaign in stable PR order, then
  test the resulting exact branch head. There is no separate candidate branch,
  dependency plan, or blocker ranking.
- The failed main run already tested the untouched base, so creating the branch
  does not queue a duplicate run. A fix changing the branch head queues the
  next campaign run immediately.
- If no repository fix changes the head, a red campaign reruns that exact head
  every six hours. This is the recovery probe for product and environment
  failures; it does not merge newer `main`.
- Published fix branches are append-only during a campaign. A later repair adds
  a commit; it does not rewrite a head already merged into the campaign.
- The branch history and compact app receipt are the durable composition. No
  task-tree issue ledger or workflow phase database is added.
- A red campaign ignores newer main commits. Once it passes and all included
  PRs merge, one full run from latest main decides health.
- When a campaign first passes, the app sends one deduplicated human message
  listing the focused PRs proven together. Those PRs merge individually; the
  message never asks anyone to merge the campaign branch.
- The campaign branch is deleted after that current-main run passes. It is
  never merged into `main`.
- Queueing uses one short app-local claim around provider submission so daemon
  recovery and a simultaneous wake cannot create duplicate aggregate runs.

## Progressive observation

The watcher downloads each published `slice-XX-test-results` artifact while
the aggregate run is active. Ingestion is retry-safe:

1. download into a temporary sibling directory;
2. require at least one parseable result carrier;
3. atomically rename into the final artifact path;
4. only then record the artifact as observed and emit semantic events.

A failed or interrupted download remains unobserved and is retried on the next
watcher pulse. An empty directory is never accepted as an artifact receipt.

Passes remain provider observations. As soon as one completed slice contains a
parseable nonpassing spec result, the watcher emits its failure without waiting
for the aggregate run. Each failure creates or updates an independently
runnable durable task while the remaining slices continue. The stable identity
is spec plus normalized failure fingerprint, so repeated scans and later runs
do not create duplicate tasks.

The watcher also maintains one replace-in-place provider projection at
`.state/watchers/aks-pipeline-progress.json`. It combines the immutable plan
inputs with completed slice verdicts and reports selected, observed, pending,
pass, fail, error, skipped, and temporarily excluded counts without putting
progress into task state or emitting pass events for presentation. Operators
can read the same model with `bun run master-validation:status [--json]`.
Fine-grained phase reporting inside a still-running slice remains the separate
live-progress proposal.

Live-admission drift is isolated, not hidden. A master-validation batch writes
one machine-readable admission report, removes excluded specs from that run's
slice matrix, and lets every admitted spec execute. Each exclusion is observed
from the plan artifact as `pipeline.failure.observed`, so it creates the same
stable repair task as a runtime failure. A closeout job then keeps the aggregate
run non-green while any exclusion exists. Thus one broken carrier cannot block
unrelated coverage, but exclusion can never satisfy the standing goal or lose
its repair obligation. Direct single-spec dispatch remains fail-fast because
there is no unrelated work to preserve.

## Known issues and parallel repair

Live `master-validation-failure` tasks are the known-issue list. No separate
issue ledger or workflow phase database is introduced.

- The task input records `validationTaskId`, spec, normalized fingerprint,
  first/current pipeline evidence, artifact path, source commit, and desired
  terminal verdict. A prepared repair also records its exact commit/files and
  live target; standalone work records the exact build id.
- The same spec and fingerprint update the same task when observed again.
- Once that stable fingerprint has durable product-classification evidence, a
  repeated matching observation preserves the classification and refreshes its
  recovery wait. It does not forget task history and downgrade the same known
  issue to inconclusive unless new contradictory evidence is recorded.
- The stable task itself owns the recovery Condition. Do not create
  `verify-...after-<run>` children; each later failure only revises the task's
  latest observed run, source commit, artifact, and generation.
- The recovery Condition identity includes the blocking pipeline run. A later
  failure must not reuse a previously satisfied pass Condition from an older
  failure episode, even when the normalized failure fingerprint is unchanged.
- When a task enters or re-enters recovery wait, use the latest known aggregate
  run as the lower bound, not merely the original failure run. An older pass
  invalidated by later relevant source changes must not repeatedly satisfy the
  new wait; only a newer main observation may wake it.
- Run ordering is the causal gate for product recovery, not for a source-route
  correction on a frozen branch. A frozen campaign may expose an old misroute
  after current main already contains a newer intended-target proof. In that
  case, reuse the recorded target context to create one current-main
  `spec-live-reconciliation` child. The child must produce a fresh applicable
  live pass (and integrate any repair); the parent must not demand a later
  same-spec event from an aggregate that intentionally cannot select it.
- If a workflow revision or explicit replay wakes an older stable issue after
  an earlier generation integrated an exact live-tested PR, reuse that durable
  run/PR/merged-commit proof when the spec and live target are unchanged. The
  issue returns to its current-main verification wait instead of creating a new
  repair commit or live run. Without integrated proof, owner review may still
  identify an already-recorded later current-main same-spec pass, but code must
  validate its provider run, artifact verdict, ancestry, and intervening
  relevant changes before closeout; this is recovery proof, not ordinary
  preparation readiness.
- Legacy publication/recovery children are migrated into the stable failure
  task when encountered. The parent resumes the finite source lifecycle first
  and absorbs the inactive child only after the parent has integration or
  superseding current-main proof; it must not discard the child's useful branch
  or proof by merely closing it.
- A materially different failure fingerprint creates another task.
- A newer `main` commit does not defer repair inside the frozen campaign. Main
  drift is reconciled once, after the campaign passes; any resulting failure
  becomes the next exact snapshot campaign rather than invalidating work in
  progress.
- Independent issue tasks may diagnose, run targeted proof, and prepare fixes
  concurrently within normal app capacity while the aggregate run continues.
- As soon as a focused fix head is available, the standing workflow may merge
  it into the frozen campaign and continue aggregate discovery without waiting
  for that PR to merge into `main`. This publication wake overrides the
  standing task's current aggregate-run Condition; otherwise a fix published
  while another run is active can be accepted but left asleep until that stale
  run finishes.
- A campaign failure does not require a separate targeted live run before its
  focused PR can join the campaign. The repair workflow runs scoped local
  checks, publishes a draft focused PR, and wakes the campaign immediately.
  Use a targeted live run only when it answers a narrower safety question; the
  full campaign rerun is the required integration proof.
- Draft means the fix is still being verified. As soon as the affected spec
  passes from the exact campaign commit containing that PR head, publish the PR
  as non-draft and notify the human merge owner, even if unrelated campaign
  specs remain red. A fully green campaign also publishes any remaining
  included drafts before asking for merges. The app never merges a focused PR
  into `main`; the human remains the merge authority. Draft preparation is an
  internal campaign event, not an actionable human notification. The human is
  notified once, retry-safely, only after the PR is non-draft and ready for
  review. This does not claim repository approval policies are satisfied:
  exact campaign proof and draft publication belong to the app, while policy
  approval and merge belong to the human/provider boundary. This exact
  verified-pass event explicitly wakes the standing cycle through its open
  aggregate-run wait; it does not wait for unrelated slices to finish.
- A resolved issue leaves the live graph through its ordinary completion
  receipt; reusable lessons belong in workflow/tests/domain evidence.

The standing task owns aggregate health, not issue execution. It does not wait
for the aggregate pipeline to finish before issue work starts, and it does not
serialize unrelated issue tasks.

## Test issue path

Classification alone does not close a failure. For a test issue, the same
task-owned branch and worktree follow the finite live-reconciliation contract:

If the investigation says `test_issue` but leaves no clean fix commit, the
workflow gives it one explicit feedback retry. If the retry still produces no
fix, or the session/worktree fails, the same task stays blocked with exact
evidence for runtime recovery. Owner fallback must not turn classification-only
evidence into convergence.

```text
bounded fix commit and focused PR to main
  -> merge the exact unmerged head into the frozen campaign
  -> targeted proof only when useful; full campaign proof is the integration gate
  -> fix and rerun when either path still fails
  -> green campaign may wait for focused PR merge
  -> full latest-main verification after all included PRs merge
  -> converge only after the same spec passes through that main path
```

Targeted branch or standalone proof shows that a repair is safe in isolation;
the campaign proves the accumulated execution context before merge. Neither
proves current main unless it ran from applicable current-main source and the
tested repair is integrated. The issue task remains open after merge until the
same claim passes through its intended execution path. Usually that is the
current-main aggregate. If generic staging cannot exercise the claim, a direct
child runs the same spec from current main on the recorded standalone target;
the parent closes only after that child has real pass and integration proof.
The aggregate plan must independently prove that the misrouted spec is no
longer admitted. The aggregate standing task still remains open until a full
current-main master-validation run passes. A PR, merge, exclusion,
classification, or notification alone is progress evidence, never aggregate
completion.

Source repair and provider dispatch require a workflow-bound task. The
workflow supplies the main-based task worktree, infrastructure Azure CLI/config
convention, exact queue parameters, Conditions, and PR/merge handling. The
agent supplies source and artifact judgment inside that workflow. If a direct
owner attempt discovers that capability is missing, the app revises the same
task to bind the workflow and preserves its repair context; it does not create
clean-carrier, credentialed-session, publish, or review successor chains.

## Product issue path

A product issue must not change source. The workflow sends one deduplicated
human notification with the spec, pipeline run, summary, and exact evidence,
then waits on:

```text
type: pipeline.spec.observed
subject: project:aks-rp-e2e
expected:
  specId: <spec id>
  status: pass
  sourceBranch: refs/heads/main
  pipelineRunId: { gt: <blocking run id> }
```

The project subject is the routing scope; the expected fields identify the
exact spec and require a run later than the blocking observation. This causal
boundary prevents persisted-event replay from satisfying a new wait with an
older pass. The Condition is only a wake. Before convergence, the
workflow fetches `origin/main` and requires the observation's source commit to
be in its history with no later spec, runner, suite, or infrastructure change
that can affect the verdict. Unrelated commits do not invalidate a completed
run, while a run from relevant stale `main` source cannot close the issue. The
product failure stays live until the deployed product behavior passes from
applicable current `main` source.

When that current-main pass arrives, the workflow also abandons any still-open
PR whose description names the exact stable task. The passing main observation
has superseded those proposed repairs; leaving them open creates misleading
work.

## Queue-delay behavior

Hosted-agent scarcity is a provider condition, not task failure. The app must
preserve queue position and must not automatically cancel or duplicate the
run. After 90 minutes, the watcher emits one deduplicated
`pipeline.queue.overdue` fact when either the aggregate has not started or its
planning job completed while every test slice still awaits an agent. The app
sends one operator notification and continues waiting.

This replaces manual polling while keeping scheduling out of the task tree.

## Recovery and failure handling

- Process reload: discover the receipt and exact active run; do not overlap.
- Unresponsive shared runtime: the independent infrastructure maintenance
  process probes the control socket and requests the existing supervisor-owned
  restarter after a bounded consecutive-failure threshold. App task state is
  untouched; ordinary controller recovery resumes it after restart.
- Late Condition registration: repeat the current run level so the Condition
  can observe it.
- Artifact download failure: retry from a fresh temporary directory.
- Agent interruption: keep the task/worktree; retry through normal runtime
  recovery.
- A test-issue classification without a clean fix commit receives one bounded
  feedback retry, then remains blocked for runtime recovery; it never falls
  through to owner convergence.
- Failed pipeline execution before any parseable spec verdict: create a stable
  repository-owned pipeline/bootstrap failure task. It is actionable repair,
  never a reason to wait for a hypothetical current-main spec pass.
- A deliberately canceled duplicate or stale run is not a pipeline failure and
  does not create or revise repair work.
- Ordinary diagnosis, source, verification, and provider-command failures:
  feed exact evidence into the next bounded agent repair iteration on the same
  task. A real external provider state becomes an exact Condition.
- A repeated identical missing-capability result waits or escalates on that
  task. It never creates an equivalent successor task.
- The agent chooses whether an external wait is meaningful. Code validates
  that its Condition has a typed subject and only supported exact-match
  operators. Invalid Condition structure is returned to the agent for one
  correction round on the same task; it is never silently inferred from prose.
- Exhausted same-owner judgment: return bare `needs-owner` with exact evidence.
  Escalate only after the agent identifies a required action outside
  `aks-explorer` ownership; generic infrastructure routes the escalation but
  does not decide that one is needed.
- PR conflict or changed source: invalidate the old proof, repair the same
  branch, and run the new exact commit.
- Squash/rebase merge is normal: Azure must report the exact tested PR head and
  a resulting merged commit present in `main`. Do not require the PR head
  itself to remain in `main` ancestry. Integration is progress evidence; the
  issue still waits for the later current-main spec pass before closeout.

## Acceptance

The design is working when:

- a due cycle survives reloads and never creates overlapping aggregate runs;
- a healthy current-main pass still leads to another full run at the regular
  six-hour cadence;
- a failed main run freezes one campaign at the tested commit and does not chase
  later main commits while red;
- each focused test fix remains one PR to main while its exact head can be
  tested immediately in the campaign;
- a red campaign reruns after accumulated fix heads change and never waits only
  because those PRs are unmerged;
- only a green campaign may wait for its focused PRs to merge;
- each slice is ingested once only after a complete download;
- each failure becomes one stable task before aggregate completion;
- independent known failures can repair while the aggregate run continues;
- a focused fix PR can be opened before aggregate proof so the campaign can
  consume it; proof determines readiness, not whether the repair may be tested;
- a test-failure task cannot converge merely because a PR merged;
- a wrong-target failure neither waits for an impossible generic-staging pass
  nor closes on exclusion alone: one current-main intended-target child must
  pass and integrate;
- a product failure cannot converge without a later passing `main` observation;
- a passing stale-main result triggers latest-main verification immediately,
  while a failed snapshot finishes its frozen campaign before one coalesced
  latest-main verification;
- a queue wait produces at most one overdue notification and never an
  automatic duplicate run;
- only a full pass at current `main` converges the standing task.

## Non-goals

- Automatically merging pull requests.
- Merging the campaign branch into `main`.
- Treating queue age as test failure.
- Creating tasks for passing specs or progress heartbeats.
- Adding a second watcher, scheduler, controller queue, or task archive.
- Putting session logs or raw provider payloads into the task tree.
