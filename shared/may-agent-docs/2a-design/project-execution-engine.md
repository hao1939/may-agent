# Project Execution Engine

## Status

Proposal. This is the execution model for Project App V2. Use `aks-rp-e2e` as
the first proving project before generalizing it into a shared helper.

## Thesis

Large projects should be solved by a breadth-first task tree:

```text
project
  -> top-level task plan
  -> reviewed task tree
  -> execute one ready leaf task
  -> verify the task claim
  -> roll up parent state
  -> replan or continue
```

The engine should not try to fully decompose the project into every possible
leaf task upfront. It should decompose lazily: split only the next task that is
too large or unclear to execute.

## Vocabulary

Keep the model small:

| Term | Meaning |
|------|---------|
| Project | Durable goal container, current truth, gates, and task tree root. |
| Task | Recursive work unit. A subtask is just a task with `parent_id`. |
| Loop task | Standing task for recurring project responsibilities such as planning, hygiene, queue refresh, and blocked-frontier review. |
| Attempt | One agent/session attempt to execute, decompose, or verify a task. |
| Claim | What an agent says happened: done, blocked, partial, decomposed. |
| Verdict | The verifier's decision on a claim: accepted, rejected, blocked. |

Do not add separate terminology such as epic/story/workstream for v1. If a
task is too large, create child tasks.

A loop task is still a task, but it is not a one-shot project deliverable. It
is the visible project responsibility; its `workflow` is the executable
implementation; each workflow execution is a loop run. Loop runs should be
recorded as workflow runs and append-only run records, not as an unbounded list
of root task nodes.

## Core Rule

Only leaf tasks are executable.

```text
task has children -> planning container
task has no children -> executable leaf
```

If a worker receives a non-leaf task, the engine made a scheduling error unless
the task is explicitly a decomposition task.

## Task Tree Principle

The task tree is the project's structured understanding, not a log of every
agent attempt.

Every branch is a claim about how the project should be understood and worked:

- A parent task should explain one meaningful project question, outcome, or
  responsibility.
- Its children should explain how that parent will be resolved.
- A leaf should be small enough to execute, verify, and roll up in one bounded
  attempt.
- Runtime attempts, planner runs, retries, and transient failures should be
  recorded in workflow/session history and linked artifacts, not promoted into
  new top-level project structure.

If the tree contains a bad branch, the right fix is not to hide it or keep
building around it. Mark it `superseded` with a short reason and, when useful,
link the replacement branch. If a parent is still directionally right but too
coarse or misleading, split or rewrite that parent so the tree again represents
the current project understanding.

This keeps the tree useful for both humans and LLMs: reading it should answer
"what do we currently believe the project is, how are we solving it, what is
done, what is active, and what is genuinely blocked?"

## Domain Decomposition Policy

The generic engine only knows how to select, execute, verify, and roll up tasks.
It does not know the domain strategy. Each serious project must encode that
strategy in its own task tree instead of letting recent incidents become the
top-level plan.

For `aks-rp-e2e`, the project strategy is not "handle the latest failing
cases." It is a repeated AKS feature-learning loop:

```text
learn AKS input/expectation space
  -> maintain the knowledge model
  -> maintain the feature inventory and priority queue
  -> run the same learning loop per feature
  -> synthesize cross-feature gaps and execution plans
```

Each feature should then reuse the same local pattern:

```text
feature
  -> reference packet
  -> input-space enumeration
  -> expectation-space enumeration
  -> existing evidence/test mapping
  -> gap analysis
  -> test-spec/probe design
  -> execution gate or execution evidence
  -> model update
  -> feature closeout / next-feature recommendation
```

This keeps task breakdown aligned with the project goal. A blocked live run, a
bug report, or a coverage-gap report is evidence inside the loop; it should not
become the organizing principle of the whole project unless the project goal
has changed.

Project-local planner tasks may add or update concrete child tasks when they
are explicitly marked as planner work. The planner is still bounded: it should
write a reviewable artifact, mutate only its owned project subtree, preserve
safety gates, and create executable leaves rather than broad intentions.

For queue-shaped exploration projects, the queue is part of execution state,
not a one-time planning artifact. In `aks-rp-e2e`, `feature-learning-loop` is a
conveyor:

```text
refresh feature queue
  -> select next safe local feature
  -> create one concrete feature-learning leaf
  -> execute/verify/roll up that feature
  -> return to the queue
```

Accepted or externally gated feature children do not mean the whole learning
loop is complete while the queue still contains safe local feature-learning
items. When the ready frontier is empty, the project-local scheduler should
check the feature queue before declaring the project blocked. If another safe
local feature exists, it should create a bounded domain-planner task that adds
the next feature container and its first executable leaf.

Project-local planners should curate the tree as they plan. If accepted
historical leaves sit at the wrong level, duplicate the current strategy, or
make the project hard to audit, create a small hygiene/review task to move the
understanding forward: supersede obsolete branches, attach replacement work
under the correct domain container, or write a rollup artifact that explains
why the old branch remains only as history. Do this through normal task claims
and verification, not through unreviewed wholesale rewrites.

## Task Lifecycle

Use a small state machine:

```text
proposed
ready
active
decomposed
claimed_done
accepted
rejected
blocked
superseded
```

Meanings:

| Status | Meaning |
|--------|---------|
| proposed | Candidate work or decomposition that has not yet been trusted as executable project understanding. |
| ready | Clear, safe, and small enough to run; the tree says this leaf is useful next work. |
| active | Assigned to an attempt. |
| decomposed | Valid parent understanding whose children explain how to resolve it. |
| claimed_done | Worker claims the task is complete; verifier has not accepted it. |
| accepted | Acceptance criteria are verified. |
| rejected | Claim failed verification and needs rework/replan. |
| blocked | A concrete external/input/safety wait prevents direct execution. Local rework, unclear scope, failed validation, stale evidence, and parent bookkeeping are not blocked states. |
| superseded | Replaced by newer understanding, duplicate work, or a corrected strategy; keep a reason and replacement link when possible. |

Important:

```text
artifact produced != task accepted
task accepted != parent accepted
parent accepted != project complete
```

## Blocker Taxonomy

`blocked` is intentionally narrow. It means the project is waiting on a real
condition outside the current local task loop:

- External credential/auth/subscription/capacity/environment is missing.
- Owner rollout/source signal/precondition is missing.
- Human input or approval is needed.
- Safety gate prevents cloud/staging mutation.

Everything else should stay executable or recoverable:

| Case | State/action |
|------|--------------|
| Validation or required check failed | Mark the task `rejected` and create/activate rework. |
| Worker session errored, timed out, was interrupted, or was cancelled | Mark the task `rejected` and create/activate rework. Runtime interruption is not domain blocker evidence, even if an expected output path already exists from an older attempt. |
| Task is vague, too broad, or missing output/acceptance | Reject or split it; create a concrete ready child. |
| Evidence is stale or insufficient | Create a ready audit/verification task. |
| Parent has blocked/rejected children | Keep parent `decomposed`; show descendant status in the tree. |
| Review/planner says "no work" or "waiting" | Reject unless it creates a concrete external blocker, human question, supersession, or follow-up task. |
| Parking-lot/future work | Use `proposed`, `superseded`, or an explicit human-triggered task, not `blocked`. |

A task may remain `blocked` after a review child is attached, but only when the
task itself still carries a concrete external/input/safety wait. Review children
are audit history; they do not make parent rollup blockers legitimate.

## Human Review Surface

The canonical project state is still `tasks/tree.json`, but humans should not
have to read raw JSON to understand what is happening. The platform UI should
provide a shared project Kanban and task-tree projection for any project that
has a v2 task tree. Project-local UI should stay domain-specific and should not
duplicate the generic Kanban unless it needs a domain-specialized workflow.

The shared review surface renders two complementary projections from the same
tree:

```text
Kanban board = execution status
Task tree    = decomposition structure
```

The Kanban board is the primary operational view. It answers:

- What is the project working on now?
- What is ready to run next?
- What is waiting for review?
- What is done?
- What is blocked, and why?

Recommended Kanban lanes:

| Lane | Tree projection |
|------|-----------------|
| Planning | serialized `frontier_replan` and `domain_planner` leaf tasks while they are `proposed`, `ready`, or `active`. |
| Backlog | `proposed` ordinary leaf tasks created by planning but not yet promoted by the planner loop. |
| Ready | executable `ready` leaf tasks. Review-task kind does not change this lane. |
| In Progress | ordinary `active` leaf tasks currently being worked. Serialized planner work stays in Planning. |
| Review | `claimed_done` and `rejected` tasks that need verification, audit, or rework decision. |
| Blocked | Concrete external/input/safety blocked tasks grouped by blocker or unblock trigger. Rework and parent rollup blockers stay in Review or the tree. |
| Done | `accepted` leaf tasks with output/evidence links. |
| Archive | `superseded` leaf tasks, usually collapsed unless auditing history. |

`decomposed` is not a Kanban lane. It is a structural state meaning the parent
task has been split into child tasks. Decomposed parents, feature groups, and
the root project should stay visible in the task tree for audit and rollup, but
they should not appear as Backlog cards unless a separate proposed leaf task
exists under them.

Review is a workflow state, not a task type. A `blocked_review`,
`parent_review`, or `rework_review` task appears in Ready or In Progress when it
is executable. It appears in Review only after it has been claimed and is
waiting for verification or follow-up.

Planning creates backlog; the worker pickup loop creates execution. Frontier replans
and domain planners should add concrete child leaves as `proposed`, not directly
as `ready`, unless they are creating a serialized review/planner task. On the
next planner wake, clear proposed leaves are promoted to `ready` if they have a
goal, output artifact, acceptance criteria, and no closed gate. Then the worker
pickup loop leases ready leaves up to `max_concurrent`.

Planner refill is based on ordinary-work inventory, not all ready leaves.
`blocked_review`, `parent_review`, `rework_review`, `frontier_replan`,
`domain_planner`, and `human_question` leaves do not count as ordinary backlog.
When clear ordinary proposed/ready/active leaves fall below the project
low-watermark, the planner should create a new frontier/domain planner task even
if review work is still ready. Review work recovers branches; it is not a
substitute for future executable backlog.

To keep the project moving quickly, planning should batch work instead of
dripping out one leaf at a time:

- A frontier replan should create 5-10 proposed ordinary leaves when enough
  safe local work exists.
- A domain planner should create 3-7 proposed ordinary leaves for the selected
  feature-learning loop when enough safe local work exists.
- If fewer safe leaves exist, the planner should create every concrete safe
  leaf it can find and explain why the batch is smaller.
- Proposed leaves should include `conflict_scope` whenever possible, so the
  worker pickup loop can safely dispatch independent leaves in parallel.
- Planner verification must enforce this. A planner `CLAIM: done` is rejected
  if it does not create the expected batch of new ordinary leaf tasks, unless it
  creates every concrete safe leaf it can find and explicitly explains why the
  batch is smaller. Artifact existence alone is not enough to accept a planner.

The task tree remains the structural and feature-breakdown view. It answers:

- Why does this task exist?
- What parent goal does it support?
- Which children roll up into a parent?
- Which accepted or blocked leaves explain the parent state?

Large task trees should support collapsing any parent node. When children are
hidden, the parent row should summarize descendant counts by raw task status,
for example `ready 2`, `blocked 1`, and `accepted 6`. This keeps the tree
readable without losing the execution signal needed for steering.

Every task card should expose at least task id, short goal, status, priority,
kind, parent/children count, outputs, latest verification, and blocker/unblock
trigger. Clicking a card should open the node detail: inputs, outputs,
acceptance, forbidden actions, gates, attempts, verification, parent chain, and
steering actions.

Ready and active task cards should also show a derived scheduler reason. The
reason answers why a card is or is not moving now, for example:
`dispatchable on next worker pickup`, `waiting: max concurrent full`,
`waiting: conflicts with <task_id>`, `waiting: serialized task active`, or
`waiting: closed gate`. This is UI projection only; the worker pickup loop
remains the source of scheduling truth for leases.

The UI should also show a derived "current state" banner above both views:

```text
working: active task id and goal
ready: next executable leaf and queued leaf count
review: rejected or claimed task needing audit
blocked/input: concrete blocked frontier, unblock triggers, or human questions
settled: no runnable, blocked, or rejected work remains
```

This keeps the system understandable: the engine owns mutation, the tree owns
truth, Kanban owns execution visibility, and the hierarchy owns audit context.

Mutation must remain event-native. The first shared Kanban projection is
read-only: it reads through a generic platform API such as
`/api/projects/tasks?path=<project>` and does not rewrite `tasks/tree.json`
directly. Steering actions should emit project actions or comments that the
project app converts into planner/reviewer events.

`platform` is the second proving project after `aks-rp-e2e`. Its task tree
should show durable platform workstreams and stable loop tasks, not a new root
task for every replan or signal-intake run. That keeps the board reviewable for
humans while preserving transparent loop history in workflow runs, app
journals, and review artifacts.

## Task Shape

A task must be clear enough for one bounded agent run:

```json
{
  "id": "managedsystem-live-auth-gate",
  "parent_id": "managedsystem-two-path-live-run",
  "status": "ready",
  "priority": "P1",
  "owner": "aks-explorer",
  "gate_status": "closed",
  "goal": "Verify whether live ManagedSystem execution can proceed.",
  "inputs": [
    "decisions/replans/live-selected/",
    ".app/project.md"
  ],
  "outputs": [
    "evidence/outputs/managedsystem-live-auth-gate.md"
  ],
  "acceptance": [
    "Runs `az account get-access-token --resource https://management.azure.com/ -o json` or records that `az` is unavailable.",
    "Does not start cloud mutation.",
    "Writes exact command, exit code, and stdout/stderr summary."
  ],
  "forbidden": [
    "Do not run probes with `AKS_RP_E2E_DRY_RUN=0`."
  ],
  "gates": [
    "Azure CLI exists in the selected execution environment."
  ],
  "trace": {
    "created_by_event": "evt_...",
    "last_updated_by_event": "evt_...",
    "last_session": "s_...",
    "last_workflow_run": "wr_..."
  }
}
```

If an agent cannot fill in goal, inputs, outputs, acceptance, and forbidden
actions, the task is not executable.

`gates` are conservative. A ready leaf with non-empty `gates` is still blocked
unless `gate_status` is explicitly `satisfied`. Resuming gated work should be a
deliberate state change that records what satisfied the gate; do not infer gate
satisfaction from optimistic prose.

## Engine Loop

The engine is a persistent project workflow. Once started, the project should
keep advancing until it reaches a real boundary: all remaining blockers are
confirmed external/human/safety gates, review approval is required, no work
remains, or infra interrupts the wake with a hard budget/runtime guard.

```text
on project event:
  load project frame
  load task tree
  ingest new comments/actions as task proposals or task updates
  if no approved top-level plan exists:
    create top-level task plan
    request/perform review
    stop

  while work remains:
    select next task breadth-first
    if no ready/open work remains:
      review blocked frontier
      if local unblock/replan work exists:
        create ready blocked-review child tasks
        continue
      if the gap is human judgment/input:
        create or keep one concrete human-question task
        stop on that question, not on "no work"
      update project frame
      stop

    if selected task is not clear enough:
      decompose or rewrite selected task
      if decomposition needs review:
        stop
      continue

    execute selected leaf task
    record attempt and claim
    verify claim
    roll up parent state
    audit/review parent state when child state changes
    update task tree and project frame

    if blocked:
      create or run blocked-review work unless the blocker is already confirmed external
      continue

    if unsafe, review-needed, or externally gated with no safe local review work:
      stop

    if infra budget/runtime guard interrupts while ready work remains:
      request continuation with project.execution.requested
      stop this wake, not the project
```

The default posture is momentum: keep going until the project is genuinely
unable to advance. A blocked task is not automatically that boundary. It first
becomes review input: is the task too coarse, wrongly marked done, missing
evidence, stale, or locally unblockable? Audit safety comes from task-tree
diffs, claim/verification records, trace links, and explicit stop boundaries,
not from artificially stopping after every small transition.

## Two Event Loops

Keep runtime control flow simple by separating tree maintenance from task
execution.

### Planner / Reviewer Loop

The planner owns task-tree shape and post-work decisions. It never executes
domain work and never leases workers.

It does:

- Read `.app/project.md` and `tasks/tree.json`.
- Normalize the tree and repair stale schema.
- Review finished, blocked, and rejected tasks.
- Roll up parent state.
- Create or promote enough concrete next tasks.
- Emit `project.tasks.ready` when executable leaves exist.

Core invariant:

```text
if project is active and no ready/active work exists:
  planner must either create/promote tasks
  or record one concrete human/external blocker
```

`no_work`, "waiting", and childless accepted planner artifacts are not quiet
terminal states while ordinary blocked/rejected project work remains.

### Worker Loop

The worker owns task pickup and execution. It does not plan the project.

It does:

- Consume `project.tasks.ready`.
- Lease dispatchable ready leaves up to `max_concurrent`.
- Emit `project.task.execution.requested` for each leased leaf.
- Consume `project.task.execution.requested`.
- Execute exactly one leased leaf.
- Record attempt, verification, and completion.
- Emit `project.task.completed`.

Core invariant:

```text
worker may mutate only the leased leaf branch and claim/verification state
worker never decides project completion
worker never creates the next project plan
```

### Event Edges

Use these event edges:

| Event | Handler role | Responsibility |
|-------|--------------|----------------|
| `project.execution.requested` | Planner | Review/refill `tasks/tree.json`; emit `project.tasks.ready` when executable leaves exist. |
| `project.tasks.ready` | Worker pickup | Lease ready leaves up to `max_concurrent`; emit per-task execution events. |
| `project.task.execution.requested` | Worker execution | Execute exactly one leased leaf, verify the claim, update the leaf branch, and emit completion. |
| `project.task.completed` | Native app handler / liveness fallback | Convert completion into a fresh `project.execution.requested` planner wake. |

Standing loops use the same event model:

```text
loop task = durable visible responsibility
workflow = executable implementation
loop run = one workflow run plus optional run-ledger record
```

For example, `project-planning-loop` maps to workflow `project-planner`.
Events such as `project.task.completed`, `project.ready.empty`,
`project.backlog.low`, human comments, and manual advance actions wake that
loop. The loop run may create or update concrete domain tasks, and each created
task should link back through `generated_by` or a run record. Do not create a
new top-level `project-frontier-replan-*` task for each planning run; keep that
history in `.app/planner-runs.jsonl`, workflow runs, and review artifacts.

The planner is the only role that should reshape the task tree globally. The
worker pickup role may lease ready leaves, but it should not create project
strategy. A task execution worker may produce evidence and a claim for one
leaf; it should not decide the next project plan.

The app event should carry the project concurrency budget, and the worker loop
should also accept `maxConcurrent` from the trigger event. Cron/job task text
can still set the same value explicitly. This prevents manual or app-originated
wakes from silently falling back to one worker when the project budget allows
parallel execution.

Dispatch rules:

- Run independent ordinary leaf work in parallel up to `max_concurrent`.
- Globally serialize planner, frontier-replan, domain-planner, loop-task, and
  human-question tasks.
- Serialize blocked-review, parent-review, and rework-review tasks against
  other review tasks, but do not let an active review globally freeze unrelated
  ordinary work. An active shell rework should not stop an independent REST
  replay retarget when their conflict scopes do not overlap.
- Serialized review work runs alone when selected first and no ordinary task or
  other review is active. If ordinary work is already active, ordinary work has
  already been selected in the current pickup pass, or another review is active,
  serialized ready reviews should be left ready while independent ordinary work
  fills the remaining capacity.
- Do not dispatch two tasks with overlapping `conflict_scope` or output paths.
  When a task provides explicit `conflict_scope`, that scope is authoritative
  and may be narrower than its output files. Output paths are the fallback
  conflict scope only when no explicit scope exists. This lets independent
  model-path updates run in parallel even when they all validate and write the
  same model file.
- Store leases in the tree with `status: active`, `claimed_by`, and
  `lease_expires_at`.
- Before dispatching, requeue active leaves whose lease is missing or expired.
  A missing lease is stale state, not evidence of healthy work in progress.
- The watchdog should also recover abandoned worker starts. If the latest
  running infra session for an active task is older than the zero-op threshold
  and still has `opCount: 0`, the watchdog first emits the command event
  `session.cancel.requested` for that session through the raw runtime event
  channel, then passes that active task id to worker pickup as an abandoned
  lease. Worker pickup requeues and
  redispatches that task; if the task-execution cron entry was still in
  flight, the cron queue drains the redispatch after cancellation completes.
  Only the latest running session for the task counts, so an old hung zero-op
  session does not kill a newer real attempt.
- The watchdog's healthy check must be scheduler-aware. A fresh task-tree
  timestamp is healthy only when there is no dispatchable ready leaf, no
  expired or missing active lease, and no unused worker capacity for
  independent ordinary work. If one ordinary leaf is active and two independent
  leaves are ready under `max_concurrent: 3`, the watchdog should wake worker
  pickup instead of skipping.
- If a worker finishes, it emits `project.task.completed`. The project app's
  native event handler turns that into `project.execution.requested`, so the
  planner can review the result and refill from the latest tree state. The
  worker execution loop may also emit the same `project.execution.requested`
  wake directly as a liveness fallback; the planner must be idempotent because
  duplicate completion wakes are possible in an event-based system.
- Because `tasks/tree.json` is the canonical project-local state, worker saves
  must merge their task branch into the latest tree snapshot under a project
  tree lock. A worker completing task A must not overwrite task B's independent
  completion just because both workers started from the same leased snapshot.
- An accepted frontier replan is not a permanent quiet state when it produced
  child work, that child work is now settled, and the active project root still
  has blocked/rejected work. The next planner wake should create the next
  frontier replan. The project may pause only on a concrete blocked replan,
  concrete human/input question, satisfied project goal, or infra guard.
- A childless accepted frontier replan is also not a permanent quiet state.
  Older verifier versions may have accepted planner artifacts that did not link
  their produced work as children. While ordinary blocked/rejected project work
  remains, the planner must create the next frontier replan instead of
  treating that accepted childless planner as proof that no more task breakdown
  is needed.

`no_work`, "no safe local work", "blocked", and "waiting" are not accepted
terminal claims by themselves. They are ambiguous. The verifier should reject
them unless the attempt turns the ambiguity into one of these concrete states:

- A ready follow-up task for safe local work.
- A blocked task with exact external resume condition and evidence.
- A human-question task with one concrete question or decision request.
- A superseded task with the replacement task or strategy linked.

The engine may stop on a concrete blocked/input frontier. It should not stop
because an agent merely says there is no work.

Budget is an infra guard, not project control flow. If a wake reaches its
attempt/time/token slice while ready work remains, the app should request a
continuation event and leave the project `active`.

## Breadth-First Selection

Prefer breadth-first task selection because it keeps the project balanced and
auditable:

1. Finish or block top-level planning before deep execution.
2. Prefer the shallowest ready leaf with the highest priority.
3. Do not descend deeply into one branch while sibling branches are still vague.
4. Respect dependencies before priority.
5. Respect safety gates before all other selection rules.

Selection order:

```text
blocked-by-human? -> stop
ready leaf with unmet dependency? -> skip
ready leaf with closed safety gate? -> blocked with exact gate
shallowest ready leaf -> execute
proposed unclear task -> decompose/rewrite
all children accepted -> verify parent
blocked frontier with no ready work -> create/run blocked-review task
human-question frontier only -> stop on the question
no open tasks -> project done candidate
```

## Blocked Review

Blocked review is how the engine avoids passive waiting while staying safe.

When no ready leaf exists, or when a selected leaf becomes blocked, the workflow
must inspect the blocked frontier breadth-first. For each blocked task it asks:

```text
1. Is the blocker still true?
2. Is the task too coarse to execute or verify?
3. Was the task incorrectly marked blocked or done?
4. Is required evidence missing or stale?
5. Is there safe local work that can refine, split, validate, or unblock it?
6. Is the remaining blocker genuinely external, unsafe, or human-owned?
```

Use a small blocker classification:

| Classification | Meaning |
|----------------|---------|
| external_gate | A real external credential, rollout, owner, capacity, or environment condition is missing. |
| stale | The blocker may no longer be true and needs a fresh non-mutating check. |
| unclear | The blocker is not specific enough to act on. |
| too_coarse | The task mixes multiple branches and should be split. |
| missing_evidence | The task claim may be right, but evidence is insufficient. |
| unsafe | Work could mutate cloud/staging or bypass a product/safety gate. |

The review verdict should be one of:

| Verdict | Engine action |
|---------|---------------|
| confirmed_external | Keep the task blocked with exact resume condition and evidence. |
| can_unblock_locally | Create a ready child task for safe local unblock work. |
| needs_split | Create child tasks and mark the parent decomposed. |
| wrongly_blocked | Correct the task state and continue selection. |
| needs_human | Keep blocked with one concrete question or decision request. |

Blocked-review tasks are ordinary leaf tasks with stricter safety rules. They
write an evidence artifact and recommend accept/block/split/continue outcomes,
but they do not own task-tree mutation. The engine audits the claim and updates
`tasks/tree.json`.

The project should stop only when every remaining blocked task is confirmed
external/human/unsafe with exact resume conditions, or a review changes strategy
enough to require approval.
If an infra wake budget is exhausted while runnable work remains, the workflow
stops that wake after requesting continuation; the project remains active.

## Engine-Owned Rollup

Workers execute one leaf and produce evidence. They do not edit the task tree
directly.

```text
worker executes leaf
  -> worker returns claim and evidence
  -> verifier accepts/rejects/blocks the claim
  -> engine updates the leaf
  -> engine rolls up the parent
  -> engine creates a parent-review task when the parent needs audit/replan
  -> engine continues breadth-first
```

Parent review is just another leaf task, but its job is evidence-backed audit of
a parent state. It can recommend `accept`, `remain_blocked`, `split`, or
`continue_with_child`; the engine owns the actual tree mutation after validation.
This keeps complexity out of ordinary workers and gives the UI a visible task
tree for audit.

Parent review is not a replacement for project-local scheduling policy. If a
parent is a conveyor or queue owner, the engine must also ask whether the queue
has another safe item. A parent may be accepted for the currently selected
children and still need a new child because the project goal is broader than the
previous selection.

## Clarity Gate

Before execution, the engine asks whether the task is executable:

```text
1. Goal: exact outcome?
2. Scope: included and excluded?
3. Inputs: files, events, comments, or source context?
4. Output: artifact, state change, decision, or evidence?
5. Acceptance: verifiable done criteria?
6. Safety: forbidden actions and gates?
7. Size: finishable in one bounded agent session?
```

Outcomes:

| Outcome | Engine action |
|---------|---------------|
| clear | Mark ready or execute. |
| too_large | Create child tasks and mark parent decomposed. |
| vague_but_inferable | Rewrite task with sharper fields. |
| needs_human | Mark blocked only with a concrete question. |
| unsafe | Mark blocked only with an explicit safety gate/resume condition. |

The LLM should make reasonable decomposition choices from available context.
Ask the human only when the decision changes scope, cost, safety, or product
direction.

## Decomposition Review

Top-level project decomposition should be reviewed before execution.

Lower-level decomposition needs review only when it changes strategy, creates
high-cost work, opens cloud mutation, or produces many child tasks.

Recommended review policy:

| Event | Review required |
|-------|-----------------|
| Initial project to top-level tasks | Yes |
| Task split with cloud mutation | Yes |
| Task split with more than 7 children | Yes |
| Task split that changes project direction | Yes |
| Low-risk split into local evidence/model tasks | Optional |
| Leaf completion claim | Always verify |
| Parent rollup | Verify when children are accepted/blocked |

Reviewer can be a separate agent or the same model in verifier mode. The role
boundary matters more than the physical agent identity.

## Execution Attempt

A worker attempt receives exactly one leaf task plus minimal project context:

```text
project goal
current state
task id
task goal
inputs
outputs
acceptance
forbidden actions
relevant links
```

The worker must return a claim record:

```json
{
  "task_id": "managedsystem-live-auth-gate",
  "attempt_id": "a_001",
  "agent": "aks-explorer",
  "claim": "blocked",
  "summary": "Azure CLI is unavailable; auth gate could not run.",
  "outputs": [
    "evidence/outputs/managedsystem-live-auth-gate.md"
  ],
  "checks": [
    {
      "command": "az account get-access-token --resource https://management.azure.com/ -o json",
      "result": "fail",
      "exit_code": 127
    }
  ],
  "open_risks": [
    "Live execution not attempted."
  ]
}
```

The engine writes the claim into `tasks/tree.json` and emits an infra event such
as `task.claimed`. The project does not keep a parallel task event log.

## Verification

Every completion claim is verified against acceptance criteria.

Verifier output:

```json
{
  "task_id": "managedsystem-live-auth-gate",
  "attempt_id": "a_001",
  "verdict": "accepted",
  "criteria": [
    {
      "item": "Does not start cloud mutation",
      "result": "pass"
    },
    {
      "item": "Writes exact command and exit code",
      "result": "pass"
    }
  ],
  "reason": "The task was an auth gate check; failing due to missing az is an accepted blocked outcome."
}
```

The verifier updates the task status in `tasks/tree.json` and emits an infra
event such as `task.verified`.

Verification must consider command outcomes, not only artifact existence. If a
task acceptance criterion requires validation to pass, exits 0, or a check to
succeed, then a worker summary containing failed validation/check output cannot
be accepted merely because the worker wrote the requested artifact. The engine
should reject the claim or create a rework-review task that decides whether to
fix the failure, narrow the acceptance criterion, or supersede the task.

If verification fails:

```text
claimed_done -> rejected
```

Then either create a follow-up child task or send the task back through the
clarity gate.

## Parent Rollup

When a child task is accepted, update parent progress but do not automatically
accept the parent.

Parent rollup rules:

```text
all required children accepted
  -> verify parent acceptance
  -> accepted or create missing child task

some child blocked
  -> parent remains decomposed while the child carries the concrete blocker
  -> parent partially complete if optional children remain
  -> queue/conveyor parents ask the project-local queue for another safe child
     before treating the parent as passively blocked

child rejected
  -> parent remains decomposed
  -> create rework task or replan parent
```

The parent is accepted only when its own acceptance criteria are satisfied, not
merely when every child produced an artifact.

## Storage Model

For v1, keep storage simple:

```text
projects/<name>/
  .app/
    project.md
    journal.jsonl
    discussion.jsonl
    workflows/
      project-planner.ts
      task-worker.ts
      project-execution-engine.ts

  tasks/
    tree.json
    README.md
```

`tasks/tree.json` is the canonical current task state. It is a real project
file because agents and humans need a stable, cheap-to-read view of the work
tree as the project evolves.

Do not keep a project-local `events.jsonl` for v1. May-agent infrastructure
already owns event, session, workflow-run, and attempt history. Duplicating
that stream inside the project creates drift and makes audit harder.

Task nodes should carry trace pointers into infra history:

```json
{
  "id": "managedsystem-live-auth-gate",
  "status": "blocked",
  "trace": {
    "created_by_event": "evt_...",
    "last_updated_by_event": "evt_...",
    "last_session": "s_...",
    "last_workflow_run": "wr_..."
  }
}
```

Recommended `tasks/tree.json` envelope:

```json
{
  "version": 1,
  "project": "aks-rp-e2e",
  "updated_at": "2026-05-31T00:00:00Z",
  "root_task_id": "project",
  "active_task_id": "managedsystem-live-auth-gate",
  "tasks": {
    "project": {
      "id": "project",
      "parent_id": null,
      "status": "active",
      "goal": "Build AKS RP input/expectation knowledge map and use it to plan higher-value tests.",
      "children": [
        "managedsystem-two-path-live-run"
      ],
      "acceptance": [
        "No ready or active work remains, or remaining work is explicitly blocked/superseded."
      ]
    },
    "managedsystem-two-path-live-run": {
      "id": "managedsystem-two-path-live-run",
      "parent_id": "project",
      "status": "blocked",
      "goal": "Run the selected ManagedSystem two-path replan when execution gates pass.",
      "children": [
        "managedsystem-live-auth-gate"
      ],
      "progress": {
        "accepted": 0,
        "blocked": 1,
        "total": 1
      }
    }
  }
}
```

Do not use project lifecycle `closed` for a project that still has reviewable
blocked work. Use `active` with a blocked frontier, or `blocked` if the UI needs
a high-level label. Reserve `closed` for an administrative terminal state where
the user intentionally wants no further project work except an explicit
reopen/migration event.

For `aks-rp-e2e`, `tasks/` should be a project-level execution folder:

```text
projects/aks-rp-e2e/
  tasks/
    tree.json
    README.md

  scenarios/
    test-specs/
    run-plans/
    execution/
```

`tasks/` means how the project is decomposed and executed.
`scenarios/` means AKS e2e domain scenarios, specs, plans, and execution
strategy. They should not be mixed.

## Task Tree UI

The user-facing project state should primarily be the task tree, not the
journal.

The project page should show:

- Root project state.
- Breadth-first task tree with status labels.
- Active frontier: the next task the engine will pick.
- Blocked tasks and exact unblock conditions.
- Recently accepted tasks.
- Rejected claims needing rework.
- Evidence/output links per task.
- Trace links to latest session/workflow/event.

Example:

```text
aks-rp-e2e
+-- ManagedSystem two-path live run [blocked]
|   +-- Live auth gate [blocked: az unavailable]
+-- App Routing TLS/Istio follow-up [blocked]
+-- Local model hygiene [ready]
```

The UI should make parent rollup explicit:

```text
ManagedSystem two-path live run
Progress: 0 accepted / 1 blocked / 1 total
Parent verdict: blocked because required child `managedsystem-live-auth-gate` is blocked.
```

## User Steering

User steering should be event-based. The UI should not directly mutate
`tasks/tree.json`.

Preferred event shape:

```json
{
  "type": "project.task.steer",
  "project": "aks-rp-e2e",
  "task_id": "managedsystem-two-path-live-run",
  "action": "split",
  "comment": "Create a child task to identify a credentialed execution host before retrying live execution."
}
```

Useful steering actions:

| Action | Meaning |
|--------|---------|
| comment | Attach human context to a task. |
| create_task | Add a new child task under a parent. |
| split | Ask the planner to decompose a task. |
| reprioritize | Move a task earlier or later in selection order. |
| pause | Pause a task or subtree. |
| resume | Resume a paused/blocked task when the condition changed. |
| block | Mark a task blocked with a reason. |
| supersede | Replace a task or subtree with a new direction. |
| accept | Human accepts a verifier result or task state. |
| reject | Human rejects a claim/verdict and explains why. |

The app handles the steering event by appending the human text to
`.app/discussion.jsonl`, updating `tasks/tree.json` when appropriate, and
emitting infra task events for audit.

Steering should target a task id whenever possible. A task-targeted comment is
much easier for the engine to apply than a project-wide instruction.

## Infra Events And Traceability

The engine should emit infra events for task changes:

```text
task.proposed
task.reviewed
task.ready
task.decomposed
task.started
task.claimed
task.verified
task.accepted
task.rejected
task.blocked
task.superseded
task.parent_rolled_up
```

These events are not stored as project files. They are recorded by May-agent's
normal event/session/workflow observability. `tasks/tree.json` stores only the
current task state plus trace ids that point back to those infra records.

## Project.md Role

`.app/project.md` should summarize, not store the full task history.

It should contain:

- Goal.
- Current state.
- Current frontier.
- Active task pointer.
- Resume/gate conditions.
- Task tree/index links.

Example:

```md
## Active Task
- id: managedsystem-live-auth-gate
- status: blocked
- source: tasks/tree.json
- output: evidence/outputs/managedsystem-live-auth-gate.md

## Task Index
- tasks/README.md
- tasks/tree.json
```

The full current task tree lives in `tasks/tree.json`. Audit history lives in
May-agent infra events, sessions, and workflow runs referenced by each task's
trace fields.

## aks-rp-e2e V1 Plan

Implement this first as app-local workflows:

```text
projects/aks-rp-e2e/.app/workflows/project-planner.ts
projects/aks-rp-e2e/.app/workflows/task-worker.ts
projects/aks-rp-e2e/.app/workflows/project-execution-engine.ts
```

`project-execution-engine.ts` remains the compatibility/helper implementation
for planner refill/review and single-task execution while the runtime-facing
workflows expose the simpler two-loop model. Ready-task pickup is owned directly
by `task-worker.ts`: it reads `tasks/tree.json`, requeues stale leases, leases
dispatchable ready leaves up to `max_concurrent`, writes the task tree under the
project lock, then emits `project.task.execution.requested` for each persisted
lease. It must not synthesize a `project.execution.requested` event to reach the
old coordinator path.

Legacy timer triggers such as `timer.tick` must be ignored by the compatibility
engine. They are pre-v2 control-plane entries and must not enter the old
`maxAttempts` direct execution loop. The only event triggers accepted by the
compatibility engine are `project.execution.requested` for planner/refill checks
and `project.task.execution.requested` for one leased leaf execution.

Initial scope:

1. Read `.app/project.md`.
2. Read `tasks/tree.json`.
3. Planner loop creates, reviews, promotes, and refills task-tree work.
4. Planner loop emits `project.tasks.ready` when ready leaves exist.
5. Worker pickup loop directly leases dispatchable ready leaves up to
   `max_concurrent`.
6. Worker execution loop runs exactly one leased leaf per
   `project.task.execution.requested`.
7. Worker records attempt/verification and emits `project.task.completed`.
8. Native app handler, or the worker execution liveness fallback, turns
   completion into the next planner wake.
9. Continue until the planner records only concrete human/external blockers,
   the project goal is satisfied, or infra budget interrupts a wake.

For `aks-rp-e2e`, the project-local `aks-explorer` trigger entry listens for
`project.execution.requested` and dispatches the planner workflow. The planner
emits `project.tasks.ready`, which dispatches the task-worker pickup workflow.
Project app actions and comments should emit the planner event rather than
starting lane-specific ad hoc
sessions.

Do not replace the existing `aks-rp-e2e-iteration.ts` immediately. Run the new
engine on a narrow branch of work first, such as local model-hygiene or a
non-mutating replan task, then migrate the older workflow once the task tree and
verification loop are proven.

## Stop Conditions

The workflow stops when one of these is true:

- A task, subtree, or project remains blocked by a concrete external condition
  after blocked-review, with exact resume condition and evidence.
- A human-question task records the exact input or decision needed.
- A blocked-review pass converts the frontier into concrete blocked tasks,
  human-question tasks, or ready follow-up tasks.
- It created or revised a decomposition that needs review.
- It hit a human/safety gate.
- It detects a strategy change that should not proceed unreviewed.
- It cannot make the selected task clear enough without human input.
- All root tasks are accepted or intentionally blocked/superseded.
- Budget for this wake is exhausted.

## Simplicity Constraints

To keep v1 straightforward:

- Maximum decomposition depth: 5.
- Maximum rework-review depth: 2. At depth >2, mark the original task
  as `blocked` (blocker: "exceeded rework depth limit — requires manual
  triage or root-cause investigation") rather than spawning another
  review layer. This prevents the rework recursion trap (KE-1566,
  KE-1574) where each interrupted rework spawns a deeper review with a
  larger prompt, higher interrupt probability, and no new information.
- Maximum horizontal retries per task: 3. When a rework-review task is
  reset to `ready` (via the isReviewTask guard) for a 4th time, mark it
  as `blocked` (blocker: "exceeded retry limit — task requires different
  approach or manual decomposition") instead of retrying. This prevents
  horizontal retry churn where the same task loops without new
  information (KE-1580).
- Maximum planning loop runs per project: 15. When
  `createPlanningLoopRun()` would create the 16th run (counting all
  runs regardless of status), mark the planning loop task as `blocked`
  (blocker: "exceeded planning loop run limit — 15 runs created, requires
  human review of task tree strategy") instead of creating another run.
  This prevents the meta-retry amplification loop where each superseded
  planning run triggers a fresh run, which proposes tasks, which get
  interrupted, which trigger another planning run (KE-1654, KE-1655).
  The cap of 15 allows 2–3× the number of productive runs observed in
  healthy projects (typically 5–10 decomposed runs needed) while
  preventing runaway accumulation (88 runs / 88.6% superseded observed
  in aks-rp-e2e as of 2026-06-08).
- Maximum consecutive failed planning loop runs: 5. When N consecutive
  planning runs end in `superseded` without any reaching `accepted` or
  `decomposed`, mark the planning loop as `blocked` (blocker: "Planning
  loop exhausted after N consecutive failed runs — requires human review
  or scope reduction") rather than creating run N+1. The budget resets
  any time a planning run reaches `accepted` or `decomposed` status
  (evidence of genuine progress). This is implemented in
  `recoverStalledPlanningLoopRework()` and complements the absolute cap
  above by catching rapid cycling sooner (KE-1654).
- Maximum children per split: 7.
- One primary output per leaf task.
- Keep executing ready leaf tasks in one wake until blocked or stopped by a
  boundary.
- Maximum worker attempts per wake is budget/policy controlled, not fixed at
  one.
- No execution of non-leaf tasks.
- No cloud mutation unless the task has an explicit gate and the gate passes.
- No project completion from worker claim alone; completion requires verifier
  acceptance and parent rollup.

## Final Principle

```text
Plan breadth-first.
Execute ready leaves until truly blocked.
Review blocked frontiers before waiting.
Verify every claim.
Roll up only accepted work.
Replan from evidence, not optimism.
```
