# Project Planner Contract

Status: implemented contract

## Purpose

`project-planner` is the owner-review adapter for `aks-rp-e2e.app`.

It does not execute AKS tests, refill deterministic loops, or encode project
strategy as workflow code. It wakes the project owner with current state, exposes
safe task-tree tools, drains explicit assignments, and records the wake result.

## Flow

Normal planner wakes follow this shape:

1. Repair task-tree rollups.
2. Assign already-runnable backlog leaves when safe.
3. Build a compact planning packet from the current task tree.
4. Skip the owner agent only for deterministic, structured no-op cases.
5. Otherwise run two bounded owner steps:
   - event review: classify what changed without mutating the tree;
   - planning update: review results, repair tree meaning, create or assign
     concrete leaves, and record exact blockers.
6. Repair rollups again, drain owner-created assignments, emit
   `project.task.assigned`, and append `.state/planner-runs.jsonl`.

Task completion review is split from general planning:

1. `task-worker` completes an assigned task, moves it to `review`, and emits
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

The watchdog remains a fallback for stale review leaves where
`project.task.reviewed` was lost or never emitted.

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
4. The owner agent judges the stall and emits `project.stall.reviewed` with a
   structured `stallReview` object. The workflow validates `judgment`; prose is
   explanation only.
5. `project-planner` consumes the reviewed fact and remains the workflow that
   decides task-tree mutations, assignments, grouped follow-up work, or exact
   external waits.

## Ownership

The planner owns owner-review orchestration:

- apply structured task-review judgments;
- accept, repair, retry, replace, split, or block task leaves;
- keep durable value-loop lanes meaningful;
- assign concrete executable leaves;
- create focused problem-solving work when a shared/local blocker needs
  investigation.
- consume `project.stall.reviewed` facts and turn the agent's stall judgment
  into concrete tree work or exact waits.

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

The reviewer must not mutate `tasks/tree.json`, assign work, create follow-up
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
mechanisms. The project is waiting for the real condition: a GitHub run
completed, approval returned, Azure capacity recovered, source proof arrived,
or an escalation resolved.

Required fields for new blocked state:

- `blockedAt` / `blocker.blocked_at`: when the wait started.
- `reason` / `blocker.condition`: why work cannot continue.
- `waitingFor` / `blocker.waiting_for`: exact condition that must become true.
- `owner` / `blocker.owner`: human, Azure, product, GitHub, project, or other
  responsible owner that can make or explain that condition.
- `observedBy` / `blocker.observed_by`: workflow, event handler, metric, or
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

For GitHub workflow-result waits, the exact workflow run id is required. A
blocked item may say it waits for `github.workflow_run.completed` only when it
includes the run id and enough identity to avoid polling the wrong run:

```json
{
  "waitingFor": {
    "type": "github.workflow_run.completed",
    "runId": "123",
    "runUrl": "https://github.com/.../actions/runs/123",
    "workflow": "aks-rp-e2e-plan-execute.yaml",
    "branch": "dev",
    "successCriteria": "Run completed and uploaded a passing live-azure-run artifact."
  },
  "observedBy": {
    "workflow": "feature-compact-loop-controller",
    "trigger": "project.task.tick"
  },
  "observationMethod": "Poll GitHub Actions run API and inspect artifacts.",
  "nextCheckAt": "2026-07-05T12:10:00.000Z",
  "fallbackAt": "2026-07-05T18:00:00.000Z",
  "fallbackAction": "Create GitHub workflow diagnosis or escalation work if the run is still missing, still running, or missing artifacts."
}
```

If the run id is not known, name the real earlier wait instead:

- `github.workflow_dispatch.allowed`: auth/schema/permission problem before
  dispatch;
- `github.workflow_run.discoverable`: dispatch returned but run lookup failed;
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

Skipping the owner agent is allowed only when the event is stale or already
settled by current structured state. Examples:

- stale watchdog runnable/review packets no longer match the live frontier;
- a routine refill already assigned runnable backlog and there is no review or
  human-steering frontier;
- a blocked-frontier wake contains only exact external waits with future
  structured `resumeAt` timestamps.

If a blocker has only prose text, the planner should run owner review. Prose may
explain the blocker, but it is not a reliable scheduling field.

## Task Tree Contract

`tasks/tree.json` is the project source of truth for current work. The planner
must mutate it through task-tree tools, not direct whole-file edits. Runtime
history belongs in May-agent session/workflow history and compact app-local
state such as `.state/planner-runs.jsonl`.

Task states remain the canonical five-state set:

- `backlog`
- `active`
- `review`
- `done`
- `blocked`

`review` means a worker finished and the task is waiting for owner acceptance.
The preferred path out of `review` is:

```text
project.task.completed -> task-reviewer -> project.task.reviewed -> planner
```

The planner may still directly inspect stale review leaves on watchdog wakes,
but that is recovery behavior, not the normal completion path.

`active` means the current assignment is owned by a worker attempt. If
`trace.current_attempt_id` matches `trace.worker_started_attempt_id`, the
planner must not close that task with `mark-done`, even with
`resolution=replaced` or `resolution=cancelled`. Closing it would bypass the
`project.task.completed` event that closes the assignment pair and feeds
review. The planner should instead wait for completion, use `requeue-active`
only when the attempt is stale or not running, or create separate follow-up or
problem work while leaving the active assignment intact.

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
    "condition": "Waiting for GitHub workflow run 123 to finish live proof.",
    "category": "external-wait",
    "owner": "github",
    "blocked_at": "2026-07-05T00:00:00.000Z",
    "waiting_for": {
      "type": "github.workflow_run.completed",
      "runId": "123",
      "runUrl": "https://github.com/.../actions/runs/123",
      "workflow": "aks-rp-e2e-plan-execute.yaml",
      "branch": "dev",
      "successCriteria": "Run completed and uploaded a passing live-azure-run artifact."
    },
    "observed_by": {
      "workflow": "feature-compact-loop-controller",
      "trigger": "project.task.tick"
    },
    "observation_method": "Poll GitHub Actions run API and inspect artifacts.",
    "next_check_at": "2026-07-05T00:10:00.000Z",
    "resume_condition": "Resume when GitHub run 123 has completed and the artifact verdict is known.",
    "resume_at": "2026-07-05T00:10:00.000Z",
    "fallback_at": "2026-07-05T06:00:00.000Z",
    "fallback_action": "Create GitHub workflow diagnosis or escalation work if run 123 is still running, missing, or missing artifacts.",
    "resume_action": "Inspect run 123 artifacts and update the compact feature result.",
    "evidence": ["https://github.com/.../actions/runs/123"]
  }
}
```

The `resume_at` value is the machine-readable field. The
`resume_condition` value is for humans and LLM review. `waiting_for` says the
real condition. `observed_by` and `observation_method` say who checks it and
how. `fallback_at` and `fallback_action` prevent a blocked item from becoming
silent parked work.

Create or update these fields through the task-tree CLI instead of editing
`tasks/tree.json` by hand:

```bash
bun run task-tree add wait-for-proof --parent project --state blocked \
  --goal "Wait for returned operator proof." \
  --output tasks/tree.json \
  --acceptance "proof reviewed" \
  --blocker "Waiting for returned operator proof." \
  --blocker-category external-wait \
  --blocker-owner human \
  --resume-condition "Resume when proof lands or the follow-up window opens." \
  --resume-at 2099-06-26T00:00:00.000Z
```
