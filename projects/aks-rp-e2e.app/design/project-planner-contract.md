# Project Planner Contract

Status: implemented contract

## Purpose

`project-planner` is the app-ops decision adapter for `aks-rp-e2e.app`.

It does not execute AKS tests, refill deterministic loops, or encode project
strategy as workflow code. It wakes `app-ops` with current state, exposes safe
task-tree tools, drains explicit task dispatches, and records the wake result.

Planning is invoked by event:

```text
project.planning.requested -> project-planner workflow
```

The workflow may call the `app-ops` agent when judgment is needed. The agent
judges; the workflow validates structured output and applies the task-tree
decision. Calling "planning" should mean emitting the event or running the
planning workflow, not bypassing the workflow and calling the agent directly.

Think of it as:

```text
project-planner workflow -> mechanism that packages state and applies decisions
app-ops agent            -> judges how the app should move
aks-explorer             -> executes AKS domain work dispatched by planner
aks-reviewer             -> independently reviews completed task output
```

The planner is app operation. It should decide how to keep the task tree closed,
owned, and moving. It should not decide whether an AKS behavior is correct;
that domain judgment belongs in `domain/*` work owned by `aks-explorer`, with
completed task output reviewed by `aks-reviewer`.

## Flow

Normal planner wakes follow this shape:

1. Repair task-tree rollups.
2. Dispatch already-runnable backlog leaves when safe.
3. Build a compact planning packet from the current task tree.
4. Skip `app-ops` only for deterministic, structured no-op cases.
5. Otherwise run two bounded `app-ops` steps:
   - event review: classify what changed without mutating the tree;
   - planning update: review results, repair tree meaning, create or dispatch
     concrete leaves, and record exact blockers.
6. Repair rollups again, drain planner-created dispatches, emit
   `project.task.assigned`, and append `.state/planner-runs.jsonl`.

Task completion review is split from general planning:

1. `task-worker` completes a dispatched task, moves it to `review`, and emits
   `project.task.completed`.
2. `task-reviewer` runs as a read-only independent reviewer, normally through
   app-local agent `aks-reviewer` using the project-available `gpt-5.5` model
   alias.
3. `task-reviewer` emits `project.task.reviewed` with structured judgment. If
   reviewer output is malformed, it emits `decision=escalate` and
   `confidence=low` rather than letting prose drive control flow.
4. `project-planner` consumes `project.task.reviewed`, validates the task is
   still in live `review` state for the same attempt, then applies the decision
   through task-tree tools.
5. Only after pending reviewed decisions are applied should the planner refill
   or widen work.

The watchdog remains a fallback for review leaves where `project.task.reviewed`
was lost, never emitted, or was never the right source. Some workflows can move
work directly to `review` after collecting an objective signal, such as a
terminal Azure DevOps pipeline run for a durable-loop wait. In that case the watchdog must
backfill a `watchdog-review-pending` planner wake with enough context for the
planner to act: task id, parent/loop id, review kind, run id/conclusion/URL when
available, named specs or affected items, and the current task result summary.

Project-level liveness fallback is split from routine planning:

1. `project-execution-watchdog` detects a contradiction that routine planner
   refill has not resolved, such as durable loop state with unfinished work but
   no useful runnable/review/active frontier.
2. `project-stall-review` collects the task tree, durable loop state, recent
   journal context, and safe mechanical repair results.
3. Code does not decide the root cause. In `fallback` mode it may perform
   objective repair such as task-tree rollup repair and pulse durable loop
   controllers only when the normal frontier is empty. In `risk-review` mode it
   is collect-only.
4. `app-ops` judges the stall and emits `project.stall.reviewed` with a
   structured `stallReview` object. The workflow validates `judgment`; prose is
   explanation only.
5. `project-planner` consumes the reviewed fact and remains the workflow that
   decides task-tree mutations, task dispatch, grouped follow-up work, or exact
   external waits.

## Ownership

The planner owns app-ops orchestration:

- apply structured task-review judgments;
- accept, repair, retry, replace, split, or block task leaves;
- keep durable value-loop lanes meaningful;
- dispatch concrete executable leaves;
- create focused problem-solving work when a shared/local blocker needs
  investigation.
- consume `project.stall.reviewed` facts and turn the agent's stall judgment
  into concrete tree work or exact waits.

The planner should not do the worker body for either root. When it sees domain
work, it creates or dispatches `domain/*` tasks to `aks-explorer`. When it sees
app machinery work, it creates or dispatches `ops/*` tasks to `app-ops`.

`project.task.assigned` is the task-dispatch event. The planner is not manually
handing work to a person; it is moving a runnable task into execution:

```text
create/update task as backlog
  -> dispatch with project.task.assigned
  -> task-worker consumes the event
  -> scoped agent runs the task
```

A planner wake should end with one of these closed outcomes:

- runnable task dispatched;
- task accepted/done;
- redo or follow-up task created and dispatched;
- exact blocked wait recorded;
- escalation linked;
- accepted no-op with a structured reason.

## Simple Role Boundaries

Keep the architecture small by keeping each workflow boring:

```text
planner decides
worker executes
reviewer judges
loop controllers refill
watchdog observes
stall-review diagnoses process stalls
focus-plan keeps the current mission readable
```

Do not move responsibilities across those lines to fix one incident quickly.
If a workflow needs to do something outside its role, create a concrete task or
emit a structured fact for the planner instead.

- Planner is the only normal task-tree decision writer.
- Worker is the task adapter: it reads the assigned task, runs the scoped
  workflow or default worker, normalizes output, and reports
  completion.
- Reviewer is read-only and emits a structured judgment.
- Loop controllers read their ledger, reconcile children, and fill the next
  bounded window.
- Watchdog is a normal workflow that observes liveness and wakes planner or
  stall-review. It has no special authority beyond closure/liveness detection.
- Stall-review collects a liveness packet and asks the agent to judge process
  stalls; planner applies the result.
- Focus-plan keeps mission-level state readable; child tasks do the work.

Scoped workflows should not generally know task-tree mechanics. They should
receive scoped input and return structured output. Task-tree lookup, assignment
state, parent rollup, review wiring, and retry/blocker bookkeeping belong in
the task adapter, planner, loop controllers, or shared task-tree helpers.

Use visible scope to separate domain work from system ops work. Do not add a
separate `workKind` field. The planner should infer the category from the task
branch/id and workflow route:

```text
domain/* or AKS loop/focus lanes -> AKS feature/spec/test/model/result work
ops/*                            -> watchdog, stall review, recovery,
                                    observability, event closure, integrity
```

If a task's scope does not make the category obvious, rename or move the task
instead of adding metadata. Metrics, UI groups, and escalation text should use
the same convention so humans can understand the project without opening task
payloads.

Use one task tree with two top-level roots:

```text
domain/ -> AKS outcome work
ops/    -> project machinery and health work
```

The planner coordinates both roots. `aks-explorer` owns `domain/*` work,
`app-ops` owns `ops/*` work, and `aks-reviewer` reviews completed task output.
They share the same task tree so blockers and dependencies stay visible in one
place.

Planner dispatch rules:

- Create domain tasks for AKS feature/spec/test/model/result work.
- Create ops tasks for metrics, watchdog, stall-review, recovery, escalation,
  event closure, workflow routing, and UI/observability repair.
- When domain work is stuck because project machinery is broken, create or link
  an ops task and keep the domain task blocked on that exact ops repair.
- When ops finds a real AKS behavior/test gap, create or link a domain task and
  keep the ops task focused on the process issue it discovered.
- Do not let ops tasks accept AKS correctness, and do not make domain tasks own
  whole-project liveness.
- Route `domain/*` dispatches to `aks-explorer`.
- Route `ops/*` dispatches to `app-ops`.
- Route completion review to `aks-reviewer`.

The task tree should remain understandable with five states only:

- `backlog`
- `active`
- `review`
- `blocked`
- `done`

If new behavior appears to need another state, first try to express it as
structured context, workflow progress, review feedback, or an exact blocker.

Fallback is for recovery, not normal operation:

- Metrics should catch broken or abnormal patterns.
- Watchdog should recover or wake the owner for one liveness incident.
- Escalation should handle a real outside-owner wait.
- Repeated fallback on the same pattern must become systemic repair work.

Planner policy for repeated signals:

```text
one incident -> recover, requeue, unblock, or create exact wait
same signal repeats -> create repair task for the producing workflow/code path
same family repeats with varied causes -> create grouped diagnosis task
cannot classify locally -> escalate and record exact blocked wait
```

The planner should not keep accepting repeated watchdog wakeups, repeated
metric breaches, or repeated escalation churn as normal progress. If the same
mechanism keeps saving the project, the mechanism has identified a bug to fix.

## Blocked Owner Recovery

A blocked task's `blocker.owner` is not a worker assignment. It names who is
accountable for making or explaining the waited-for condition. It does not
start `task-worker`, and it does not prove anyone is currently acting on the
wait. Work starts only from a runnable task dispatched through
`project.task.assigned`.

Therefore the planner must treat overdue blocked waits as actionable process
work unless a concrete active/review recovery, handoff, or escalation task
already covers the wait:

```text
blocked leaf has a resume/fallback time in the past
fallbackAt has passed
no active/review recovery task, handoff, escalation, or accepted terminal proof
  -> create or reopen one concrete recovery task
```

The `owner` field describes accountability. It is not enough to set
`owner=human`. A true human wait still needs a visible handoff/escalation task,
or a refreshed wait with fresh evidence and the next check time.

Allowed outcomes for an overdue blocked wait:

- `unblock`: the waited-for condition is true; create the smallest runnable
  successor or rerun task.
- `recover`: create/dispatch an `ops/*` or `domain/*` recovery task that can
  actively inspect or repair the wait.
- `handoff`: create/verify a concrete handoff/escalation task for an external
  owner, then link the blocked wait to that proof.
- `refresh`: keep the wait only with new evidence, updated `lastCheckedAt`,
  `nextCheckAt`, and `fallbackAt`.
- `terminal`: mark done only when accepted evidence proves no further
  meaningful project action remains.

Disallowed outcomes:

- leave the blocked leaf unchanged after fallback;
- treat `blocker.owner=aks-explorer` or `blocker.owner=app-ops` as active work;
- keep stale platform owners such as `github-actions` after the execution
  platform has moved to Azure DevOps;
- no-op because unrelated runnable work was assigned while overdue blocked
  owner work remains unrepresented.

When watchdog or a metric reports overdue blocked waits, the planner should
prefer a grouped recovery task for repeated root causes. For example, stale
GitHub-era waits should become one ADO migration/review task rather than many
passive `github-actions` waits. Environment/operator waits should either show
proof of handoff or produce an app-ops handoff/escalation task.

Audit and recovery tasks must not measure their own masking effect as success.
When a task audits overdue waits, its evidence should list the pre-audit
contributors after excluding the audit task itself and any broad recovery scope
on that task. The planner may use the task as active representation while it is
running, but the review decision must verify that every pre-audit contributor
was refreshed, replaced by a concrete successor, handed off/escalated, or proven
terminal before accepting the audit as complete.

## Focus Mission Lifecycle

A focus plan is a bounded mission, not a generic status bucket. The focus parent
stays open while the mission still has unresolved child work. The normal
planner/worker/reviewer loop should drive the child work; the focus branch only
keeps the mission, success criteria, current evidence, and remaining blockers
readable.

The lifecycle is:

```text
create focus
  -> run planned work
  -> review evidence
  -> on failure, create diagnosis/repair/rerun/wait/escalation child work
  -> repeat until the mission succeeds, reaches a known terminal failure, or is
     paused on an exact external wait/escalation
```

When a focus run hits a failure, the planner must not finish the focus just
because the first planned run ended. The failure must become one of:

- diagnosis task with accepted evidence;
- repo-local repair task plus the smallest truthful rerun;
- exact blocked wait with owner, observer, resume condition, and fallback;
- escalation with an owning blocked/wait task;
- terminal known issue with evidence that local repair/rerun paths have been
  exhausted or deliberately bounded.

Allowed focus terminal states:

- `completed`: the focus goal is met and the proof is linked.
- `failed_known_issues`: the focus goal did not pass, every reasonable local
  path has been attempted or bounded, and remaining issues are listed with
  evidence, owner/resume condition, and next retry/escalation path.
- `blocked`: the focus is not terminal; it is paused on a named external wait
  or escalation that still has a watcher and fallback.

`failed_known_issues` is a terminal result for the focus mission, not a task
execution result. It should be used only after all focus children are terminal.
If any child is still `active`, `review`, `backlog`, `waiting`, or `blocked`,
the focus workflow must suppress terminal language and keep planner/app-ops
moving.

The planner should not be the default first-pass reviewer for fresh
`project.task.completed` events once `task-reviewer` is enabled. Its role is to
own the decision and task-tree mutation after the independent reviewer has
provided a structured judgment.

The reviewer owns independent completion judgment only:

- read the task, acceptance criteria, worker result, evidence refs, workflow
  artifacts, and relevant dirty files;
- decide whether the completion should be accepted, redone, followed up,
  blocked, or escalated;
- emit `project.task.reviewed`.

The reviewer must not mutate the live task tree, dispatch work, create follow-up
tasks, edit project files, or commit changes. This keeps the task tree under a
single decision writer while still giving review a fresh model perspective.

## Redo And Follow-Up Policy

`redo` means the same task is still the right unit of work and can reasonably
succeed with the reviewer feedback. It should not become an unbounded loop that
keeps reassigning the same leaf with overwritten rejection history.

Planner policy:

- First same-reason redo: reject the task back to backlog with structured
  feedback.
- Repeated same-reason redo: create a targeted repair/follow-up, split the task,
  or ask for focused problem investigation.
- External or environment wait: record an exact blocked task with owner,
  resume condition, fallback behavior, and optional `resume_at`.
- Ambiguous root cause: request `project.problem.investigation.requested`
  instead of retrying the same leaf.

The planner should preserve enough rejection history for the owner/reviewer to
see churn. If a task has repeated redos, the next planner move should change
the work shape or wait condition, not immediately reassign the unchanged leaf.

The planner does not own deterministic loop refill. Loop roots are durable tasks
with their own controllers. A child workflow may emit both:

- `project.task.completed` for owner review; and
- `project.task.tick` targeted at its loop root for deterministic refill.

Loop controllers are also allowed to perform mechanical acceptance of their own
child attempts when structured loop state already records the result. For
example, a feature-reference collector attempt can be marked done as a terminal
collector attempt once `.state/feature-reference-loop/state.json` records the
exact feature key, output path, and missing-source error. That does not mean the
feature is complete; the loop state remains `error`, and the durable loop root
must stay incomplete until the feature is repaired, suppressed as an accepted
public ceiling, or escalated through an exact successor task.

Loop controllers must also avoid infinite direct retry churn. Once a
feature-reference item has exhausted its direct collector attempt budget, the
controller should keep the item in structured `error` state and expose
`retryBudgetExhausted` in `workflowProgress` instead of creating another generic
collector retry. The planner/owner then decides whether to create a targeted
repair task, accept a public-ceiling suppression, or escalate.

When a targeted repair fixes the issue behind retry-drained items, the planner
must reopen those items with structured data rather than by editing prose
summaries or blindly clearing all attempts. For feature compact repair tasks,
add `context.compactRetryReset` or `trace.compactRetryReset` to the accepted
repair task:

```json
{
  "errorClass": "live-workflow",
  "featureKeys": ["extension-addon"],
  "reason": "published workflow now points at the repaired compact carrier"
}
```

The compact loop controller consumes that reset only after the repair task is
terminal and newer than the affected feature error record. Matching exhausted
features return to `pending` with attempts reset, while unrelated waits and
newer errors remain untouched.

Retry exhaustion is not loop completion and is not a reason to park a durable
loop root by itself. For every durable loop, non-terminal ledger records must be
represented by current task-tree work:

- direct verifier/planner children for runnable pending records;
- grouped repair or reconciliation leaves for retry-drained `error` or `fail`
  records;
- exact blocked or escalated leaves that name the affected record set and
  resume condition; or
- a structured terminal disposition accepted by the owner.

`workflowProgress` must expose enough structured counters for watchdog,
stall-review, and planner logic to verify that contract. In particular,
`unrepresentedNonTerminalCount > 0` means the loop root is actionable backlog,
not exact wait stewardship, even if the visible child frontier currently
contains blocked waits.

### Shared Blocked Contract

The planner and loop controllers must use the same `blocked` contract. A
blocked task or loop record means:

```text
work is paused
  because a named condition is not true yet
  and a named observer will check that condition
  and a named owner can make it true or explain why it cannot be true
  and the project knows when to stop waiting
```

Do not mix up the wait condition and the watcher. The project is not waiting
for a loop pulse, watchdog tick, or metric breach. Those are observation
mechanisms. The project is waiting for the real condition: an Azure DevOps pipeline run
completed, approval returned, Azure capacity recovered, source proof arrived,
or an escalation resolved.

Required fields for new blocked state:

- `blockedAt` / `blocker.blocked_at`: when the wait started.
- `reason` / `blocker.condition`: why work cannot continue.
- `waitingFor` / `blocker.waiting_for`: exact condition that must become true.
- `owner` / `blocker.owner`: human, Azure, product, pipeline platform,
  project, or other responsible owner that can make or explain that condition.
- `observedBy` / `blocker.observed_by`: workflow, event route, metric, or
  human that checks the condition.
- `observationMethod` / `blocker.observation_method`: how the observer checks.
- `nextCheckAt` / `blocker.next_check_at`: next planned check time.
- `fallbackAt` / `blocker.fallback_at`: when the wait must be rechecked or
  escalated.
- `fallbackAction` / `blocker.fallback_action`: what to do at fallback time.

Recommended fields:

- `scope`: affected task/spec/feature/package/family ids.
- `evidence`: evidence files, run ids, artifacts, API errors, review packets.
- `resumeAction`: first action after the wait clears.
- `fingerprint`: source ref, target environment, plan/spec list, and other
  inputs that make the blocked decision valid.
- `lastCheckedAt`: last time the wait was reviewed and kept blocked.

The planner must not accept a new blocked item that only has prose. If the
owner cannot name what is being waited for, who observes it, how it is checked,
the responsible owner, and the fallback, the item should stay `error`, become a
repair/follow-up task, or become an escalation.

For Azure DevOps pipeline-result waits, the exact pipeline run id is required. A
blocked item may say it waits for `ado.pipeline_run.completed` only when it
includes the run id and enough identity to avoid polling the wrong run:

```json
{
  "waitingFor": {
    "type": "ado.pipeline_run.completed",
    "runId": "123",
    "runUrl": "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
    "pipeline": "467665",
    "branch": "dev",
    "successCriteria": "Run completed and uploaded a passing live-azure-run artifact."
  },
  "observedBy": {
    "workflow": "feature-compact-loop-controller",
    "trigger": "project.task.tick"
  },
  "observationMethod": "Poll Azure DevOps pipeline run API and inspect artifacts.",
  "nextCheckAt": "2026-07-05T12:10:00.000Z",
  "fallbackAt": "2026-07-05T18:00:00.000Z",
  "fallbackAction": "Create Azure DevOps pipeline diagnosis or escalation work if the run is still missing, still running, or missing artifacts."
}
```

If the run id is not known, name the real earlier wait instead:

- `ado.pipeline_dispatch.allowed`: auth/schema/permission problem before
  dispatch;
- `ado.pipeline_run.discoverable`: dispatch returned but run lookup failed;
- `azure.capacity.available`: Azure capacity blocks dispatch or proof.

Durable loop ledgers must preserve `status=blocked` when this contract is
satisfied. They must not normalize `blocked` back to `error`. `error` means the
project still needs diagnosis or repair; `blocked` means the wait is understood
and externally gated.

When a blocked item's fingerprint changes, the next loop pulse or planner wake
must re-evaluate it. Possible outcomes are:

- unblock and create runnable work;
- refresh the blocker with new evidence/fallback;
- mark done only if a terminal disposition or live proof exists;
- escalate if fallback failed.

If `fallbackAt` has passed and `owner` is not `human`, re-evaluation must not
end as a passive wait unless a newer `lastCheckedAt`, `nextCheckAt`, and
`fallbackAt` are written with evidence explaining why no active recovery is
possible. Otherwise create active recovery/handoff work.

## Structured Inputs

Planner control flow must use structured event/task fields, not prose parsing.
Free-form summaries and blocker text are review material only.

Examples:

- Use `event.data.reason` or top-level `reason` for wake class.
- Use `project.task.reviewed.data.decision` for task-review outcome.
- Use `project.task.reviewed.data.feedback` when rejecting/retrying work.
- Use `project.task.reviewed.data.suggestedFollowups` as proposals, not direct
  task-tree mutations.
- Use `blockedTasks[].resumeAt` for future-dated external waits.
- Use `blockedTasks[].resumeCondition` for human-readable resume details.
- Use `blockedTasks[].fallbackAt` and `blockedTasks[].fallbackAction` for
  timeout behavior.
- Use `blockedTasks[].waitingFor`, `blockedTasks[].observedBy`,
  `blockedTasks[].observationMethod`, and `blockedTasks[].nextCheckAt` to
  distinguish the real wait from the mechanism that checks it.
- Use `blockedTasks[].fingerprint` to detect stale waits after source, plan,
  spec, target, or artifact inputs change.
- Use worker completion fields such as `result`, `evidenceRefs`, `review`, and
  `problem` to decide what the owner should inspect.

Do not infer a control decision by scanning prose such as `summary`, `blocker`,
or `last_worker_summary` for magic phrases or dates. If a producer needs a
deterministic branch, it must emit the field that branch requires.

Existing loop controllers may still read legacy summaries while migrating old
worker artifacts into structured loop state, but this is compatibility
behavior, not a contract for new producers. New task completions and loop
artifacts must expose structured fields for live proof, output paths, result
class, root cause, and resume/retry conditions.

## Deterministic No-Ops

Skipping `app-ops` is allowed only when the event is stale or already
settled by current structured state. Examples:

- stale watchdog runnable/review packets no longer match the live frontier;
- a routine refill already dispatched runnable backlog and there is no review or
  human-steering frontier;
- a blocked-frontier wake contains only exact external waits with future
  structured `resumeAt` timestamps.

If a blocker has only prose text, the planner should run owner review. Prose may
explain the blocker, but it is not a reliable scheduling field.

The planner must not skip `app-ops` for a blocked-frontier wake when the live
frontier contains overdue blocked waits without active recovery, handoff,
escalation, or accepted terminal proof. Quick-refill progress on other work is
not closure for that blocked-owner problem.

## Task Tree Contract

The live task tree is the project source of truth for current work. The planner
must mutate it through task-tree tools, not direct whole-file edits. Runtime
history belongs in May-agent session/workflow history and compact app-local
state such as `.state/planner-runs.jsonl`.

Task states remain the canonical five-state set:

- `backlog`
- `active`
- `review`
- `done`
- `blocked`

`review` means work has produced a result or signal and is waiting for owner
acceptance. The preferred path for worker completions is:

```text
project.task.completed -> task-reviewer -> project.task.reviewed -> planner
```

The planner may also directly inspect watchdog-backfilled review leaves. For
worker completions this is recovery behavior; for controller-created review
leaves it is the normal path because there may be no `project.task.completed`
event.

`active` means the current dispatch is owned by a worker attempt. If
`trace.current_attempt_id` matches `trace.worker_started_attempt_id`, the
planner must not close that task with `mark-done`, even with
`resolution=replaced` or `resolution=cancelled`. Closing it would bypass the
`project.task.completed` event that closes the dispatch pair and feeds
review. The planner should instead wait for completion, use `requeue-active`
only when the attempt is stale or not running, or create separate follow-up or
problem work while leaving the active dispatch intact.

`blocked` is a task state for real waits with resume conditions. It should not
be used as the generic spec/test verdict. Spec and compact-test records should
settle as `pass`, `fail`, or `error` and carry the exact root cause and next
retry condition separately.

For durable loop records, `blocked` is allowed and preferred when the record
itself satisfies the shared blocked contract. This prevents repeated
reconciliation churn where a loop repeatedly rediscovers that the same feature
or spec is still waiting on the same external signal.

Blocked tasks should carry an exact `blocker` and, when there is a time-based
wait, structured resume metadata:

```json
{
  "blocker": {
    "condition": "Waiting for Azure DevOps pipeline run 123 to finish live proof.",
    "category": "external-wait",
    "owner": "ado",
    "blocked_at": "2026-07-05T00:00:00.000Z",
    "waiting_for": {
      "type": "ado.pipeline_run.completed",
      "runId": "123",
      "runUrl": "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123",
      "pipeline": "467665",
      "branch": "dev",
      "successCriteria": "Run completed and uploaded a passing live-azure-run artifact."
    },
    "observed_by": {
      "workflow": "feature-compact-loop-controller",
      "trigger": "project.task.tick"
    },
    "observation_method": "Poll Azure DevOps pipeline run API and inspect artifacts.",
    "next_check_at": "2026-07-05T00:10:00.000Z",
    "resume_condition": "Resume when Azure DevOps pipeline run 123 has completed and the artifact verdict is known.",
    "resume_at": "2026-07-05T00:10:00.000Z",
    "fallback_at": "2026-07-05T06:00:00.000Z",
    "fallback_action": "Create Azure DevOps pipeline diagnosis or escalation work if run 123 is still running, missing, or missing artifacts.",
    "resume_action": "Inspect run 123 artifacts and update the compact feature result.",
    "evidence": [
      "https://dev.azure.com/msazure/CloudNativeCompute/_build/results?buildId=123"
    ]
  }
}
```

The `resume_at` value is the machine-readable field. The
`resume_condition` value is for humans and LLM review. `waiting_for` says the
real condition. `observed_by` and `observation_method` say who checks it and
how. `fallback_at` and `fallback_action` prevent a blocked item from becoming
silent parked work.

Create or update these fields through the task-tree CLI instead of editing the
task tree file by hand:

```bash
bun run task-tree add wait-for-proof --parent project --state blocked \
  --goal "Wait for returned operator proof." \
  --acceptance "proof reviewed" \
  --blocker "Waiting for returned operator proof." \
  --blocker-category external-wait \
  --blocker-owner human \
  --resume-condition "Resume when proof lands or the follow-up window opens." \
  --resume-at 2099-06-26T00:00:00.000Z
```
