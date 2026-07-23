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
  -> test issue: exact live proof -> fix-forward -> PR to main -> merge proof
  -> product issue: notify human -> wait for later current-main pass

aggregate completion
  -> stale at any result: immediately verify latest main
  -> failed at current main: keep standing task red while failures repair
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
  one-active-run invariant, and aggregate convergence decision.
- The existing pipeline watcher owns Azure DevOps observation and artifact
  ingestion. It does not read task state.
- `master-validation-failure` owns classification. Product issues wait on a
  semantic later pass. Test issues reuse finite spec live reconciliation with
  integration target `main`.
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

Every completed result is compared with current `origin/main` before its
pass/fail meaning is considered. If `main` advanced while the run queued or
executed, the app queues the latest commit immediately after the active run
finishes, whether the stale result passed or failed. Multiple advances coalesce
into that one latest-main run. The app does not cancel the active run, overlap
aggregate runs, wait another six hours, or call a stale result current-main
proof.

The six-hour interval is the healthy periodic cadence. It never delays a
replacement after `main` changes. The repo-ref watcher emits the change as a
targeted wake; the five-minute reconciliation pulse remains delivery recovery.

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

## Known issues and parallel repair

Live `master-validation-failure` tasks are the known-issue list. No separate
issue ledger or workflow phase database is introduced.

- The task input records `validationTaskId`, spec, normalized fingerprint,
  first/current pipeline evidence, and artifact path.
- The same spec and fingerprint update the same task when observed again.
- A materially different failure fingerprint creates another task.
- If the failure artifact came from an older `main`, the task waits for the
  newer current-main spec verdict instead of editing already-changed source;
  another failure on current `main` updates the task and resumes repair.
- Independent issue tasks may diagnose, run targeted proof, and prepare fixes
  concurrently within normal app capacity while the aggregate run continues.
- A resolved issue leaves the live graph through its ordinary completion
  receipt; reusable lessons belong in workflow/tests/domain evidence.

The standing task owns aggregate health, not issue execution. It does not wait
for the aggregate pipeline to finish before issue work starts, and it does not
serialize unrelated issue tasks.

## Test issue path

Classification alone does not close a failure. For a test issue, the same
task-owned branch and worktree follow the finite live-reconciliation contract:

```text
bounded fix commit
  -> targeted staging run for that exact commit and spec
  -> artifact-backed verdict review
  -> fix and rerun when the carrier still fails
  -> create PR into main only after accepted live proof
  -> wait for merge or source change
  -> require the exact tested commit in origin/main ancestry
  -> converge the failure task
```

The aggregate standing task remains open until a full current-main
master-validation run passes. A PR, merge, targeted pass, classification, or
notification is progress evidence, never aggregate completion.

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
```

The project subject is the routing scope; the expected fields identify the
exact spec and proof. Only a later run may satisfy recovery. The product
failure stays live until the deployed product behavior passes from `main`.

## Queue-delay behavior

Hosted-agent scarcity is a provider condition, not task failure. The app must
preserve queue position and must not automatically cancel or duplicate the
run. When a scheduled master-validation run remains `notStarted` for 90
minutes, the watcher emits one deduplicated `pipeline.queue.overdue` fact. The
app sends one operator notification and continues waiting.

This replaces manual polling while keeping scheduling out of the task tree.

## Recovery and failure handling

- Process reload: discover the receipt and exact active run; do not overlap.
- Late Condition registration: repeat the current run level so the Condition
  can observe it.
- Artifact download failure: retry from a fresh temporary directory.
- Agent interruption: keep the task/worktree; retry through normal runtime
  recovery.
- Ordinary diagnosis, source, verification, and provider-command failures:
  feed exact evidence into the next bounded agent repair iteration on the same
  task. A real external provider state becomes an exact Condition.
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
- Squash/rebase merge that does not preserve the tested commit: require an
  exact merged-revision proof before closeout.

## Acceptance

The design is working when:

- a due cycle survives reloads and never creates overlapping aggregate runs;
- a healthy current-main pass still leads to another full run at the regular
  six-hour cadence;
- each slice is ingested once only after a complete download;
- each failure becomes one stable task before aggregate completion;
- independent known failures can repair while the aggregate run continues;
- a test fix cannot produce a PR before an accepted exact staging proof;
- a test-failure task cannot converge merely because a PR merged;
- a product failure cannot converge without a later passing `main` observation;
- no aggregate result, passing or failing, can delay latest-main verification
  after `origin/main` advances;
- a queue wait produces at most one overdue notification and never an
  automatic duplicate run;
- only a full pass at current `main` converges the standing task.

## Non-goals

- Automatically merging pull requests.
- Treating queue age as test failure.
- Creating tasks for passing specs or progress heartbeats.
- Adding a second watcher, scheduler, controller queue, or task archive.
- Putting session logs or raw provider payloads into the task tree.
