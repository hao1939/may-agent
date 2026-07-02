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

`blocked` is a task state for real waits with resume conditions. It should not
be used as the generic spec/test verdict. Spec and compact-test records should
settle as `pass`, `fail`, or `error` and carry the exact root cause and next
retry condition separately.

Blocked tasks should carry an exact `blocker` and, when there is a time-based
wait, structured resume metadata:

```json
{
  "blocker": {
    "condition": "Waiting for returned operator proof.",
    "category": "external-wait",
    "owner": "human",
    "resume_condition": "Resume when proof lands or the follow-up window opens.",
    "resume_at": "2099-06-26T00:00:00.000Z"
  }
}
```

The `resume_at` value is the machine-readable field. The
`resume_condition` value is for humans and LLM review.

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
