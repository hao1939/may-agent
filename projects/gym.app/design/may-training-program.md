# Autonomous Agent Improvement

**Status:** Accepted target; reconciler model refined (2026-08-01)

## Goal

Gym App autonomously improves agents. For the first milestone it keeps May
evaluated, tries isolated improvements, and brings Hao one verified proposal.

Running benchmarks is a method, not the goal. The goal is better agent behavior
supported by trustworthy evidence and no approved regression.

## Mental model

```text
human intent, daily refill check, May-owned metric breach, field evidence,
or May revision
  -> wake improve/may                    one stable desired-state task
  -> Gym owner prioritizes current evidence and the next useful focus
  -> evaluate up to two independent hypotheses against one frozen baseline
  -> compare the findings
  -> choose one bounded May failure family for integration
  -> run guided practice when the learning unit requires real tool use
  -> preserve May's calls, lifecycle evidence, result review, and reflection
  -> build one isolated candidate
  -> targeted verification
  -> full approved verification
       -> bad result: review the responsible layer
       -> confirmed May gap: try the next generation
       -> sufficient result: prepare one proposal
  -> Telegram asks Hao to approve the exact artifact
  -> approve: apply it; reject: revise the same task
  -> May revision wakes the loop for confirmation
```

There is no separate evaluation lifecycle, failure-family task, candidate job,
or app-specific task state machine. Findings, experiment records, candidate
generations, and checkpoints are evidence inside the one campaign. The task
waits only for an exact human or external condition.

The design follows the project-app reconciliation model:

- The task describes the durable target state.
- Events only wake the task and contribute current evidence. They never replace
  its specification or interrupt an active generation.
- The Gym owner owns the goal, interprets evidence, and chooses priority and
  the next focus.
- The workflow is learned operational experience: it advances one bounded,
  idempotent stage, saves proof, and wakes the same task again when work remains.

This gives one campaign with bounded parallel exploration and serialized
integration and promotion. At most two independent development assessments run
together. Each experiment has frozen inputs, its own evidence path, and no
permission to change benchmark or scorer truth. The owner chooses one result
for candidate integration. Candidate building, revision, release verification,
approval, application, and confirmation remain ordered.

Gym also runs one daily Telegram field review. It keeps clear successful
behavior as positive evidence and routes only strong actionable failures into
the existing incident and proposal path. The review classifies May behavior,
Telegram context/routing, owner workflow, evaluator, runtime, and noise before
suggesting a learning change. It stays quiet when the day contains no reusable
signal. Gym allows this source review to use a second app task slot while the
ordered `improve/may` workflow is running; candidate iterations inside that
workflow remain sequential.

## One task

```text
id: improve/may
mode: maintain
owner: gym
workflow: improve-agent
outcome:
  Keep May on the best behavior supported by approved Gym evidence and bring
  one verified improvement proposal to Hao when a better candidate is ready.
```

The task is converged when current approved evidence has been reviewed and one
of these is true:

- May has no actionable failure;
- a verified proposal is ready for Hao;
- a non-May evaluation issue has a truthful disposition; or
- an exact external or human decision is represented as a wait.

A later schedule, user request, relevant metric breach, approved benchmark
change, or May revision wakes the same task. It does not create another
lifecycle. Every wake resolves to the same desired-state specification. Its
event-specific reason, metric, revision, or request remains trigger evidence.
If a wake arrives while reconciliation is running, the controller queues it for
the next reconcile instead of superseding the active attempt.

Every workflow attempt also holds an ownership fence made from the task
generation and active attempt id. It checks the fence after each expensive Gym
run and before writing the shared campaign checkpoint or emitting a
continuation. If recovery or a specification change replaces the attempt, the
old call may finish, but the old workflow stops immediately afterward. It
cannot retry, build a candidate, update the campaign, or wake more work.

An autonomous wake keeps reconciling until every approved learning track has
been reviewed. One reconcile explores no more than two independent tracks,
saves their results, selects at most one integration path, and emits a
continuation wake when material remains. It stops only when all current material
passes, a verified proposal needs Hao's decision, or progress reaches a real
safety or authority boundary. After exhaustion, a fingerprinted checkpoint
makes the daily refill check a cheap no-op until the curriculum or May's durable
learning surface changes.

Every approved development case in a benchmark must be listed in that track's
autonomous-training manifest and learning unit. Loading the curriculum fails if
an approved case is missing, so a new lesson cannot be reviewed successfully
and then silently skipped by the live training loop.

Experiment records are checkpoint files, not child tasks. `improve/may` must
have no owner-recovery, experiment, approval, or worker children. A genuine
workflow exception returns to the Gym owner for goal and priority judgment; the
owner records a disposition against the campaign and does not invent a nested
recovery tree.

The first implementation phase parallelizes the expensive independent
assessment and diagnosis work. It deliberately serializes candidate creation.
After this phase proves stable in live autonomous cycles, Gym may allow two
isolated candidate experiments for different hypotheses, using the same frozen
baseline and evidence version. Even then, the owner must compare them and send
only one integrated candidate through release verification and approval. Gym
must never parallelize revisions of the same hypothesis.

An evaluator or runtime issue in one track does not block evaluation of later,
independent tracks. Gym finishes the remaining tracks, then reports the issue
and withholds the exhausted checkpoint. A verified candidate, required human
decision, or real authority boundary still stops the sequence immediately.

## Bounded reconciliation workflow

`improve-agent` performs one bounded, restart-safe reconciliation stage:

1. Read the stable goal, wake evidence, and campaign checkpoint.
2. Check benchmark approval before treating a score as truth.
3. Run or reuse no more than two independent development assessments in
   parallel.
4. Retry invalid scenarios once without hiding valid failures.
5. Classify every remaining non-pass as May, benchmark, scorer, runtime, or
   noise. Every scenario appears exactly once.
6. Give comparable findings to the Gym owner, who selects the highest-priority
   integration path. Preserve unselected valid evidence for the next reconcile.
7. Select one May failure family and freeze a focused development baseline.
8. Run the unit's guided practice, when present, and checkpoint both successful
   and failed attempts. Practice may use real safe tools and gives feedback.
9. Ask the isolated implementation agent for one narrow overlay, including the
   guided-practice evidence but excluding withheld release truth.
10. Verify it against the frozen baseline.
11. If it improves, run the full five-trial release comparison.
12. If it fails, review the observed answer, expected behavior, scorer, and
    runtime before deciding whether May should change again.
13. If the review still establishes a May gap, revise the candidate immediately
    and repeat the implementation and verification steps in the same workflow.
14. Save the stage checkpoint and wake `improve/may` again when approved work
    remains.

After every benchmark or verification call, confirm that this workflow still
owns the current task attempt. A superseded attempt returns quietly without
using its result. This makes restart recovery safe even though an in-flight
model call cannot always be canceled.

Candidate iterations for the selected hypothesis are sequential, never
parallel. Each expensive stage is
checkpointed before the next stage starts, so runtime recovery reuses completed
implementation, verification, baseline, and review evidence. A repeated
artifact fingerprint or the five-iteration safety bound stops the burst as a
truthful no-progress convergence instead of spinning or invoking a second
owner loop.

The improvement workflow declares a 60-minute execution budget through the
standard workflow-module timeout field. Ordinary app workflows keep the
platform default. This covers multi-trial semantic evaluation without adding a
second scheduler or weakening the evaluation gates.

`revise-candidate` is an internal workflow decision. It does not mutate the
running task and does not notify Hao. A workflow never remains open across
human approval, an external callback, or a later schedule. The 60-minute limit
is a safety ceiling; campaign progress comes from checkpoints and repeated
reconciliation, not from hoping one long attempt finishes.

## Approval through Telegram

Gym uses May-agent's existing human message channel. It does not add an
approval service or a second job model:

```text
verified agent candidate or concrete benchmark/scorer fix
  -> project.approval.requested
  -> message.created to human
  -> Telegram notification
  -> Hao replies approve or reject
  -> project.approval.submitted
  -> the exact Condition wakes improve/may
```

The task returns `waiting` while Hao decides. Its Condition matches the exact
approval id, task generation, and artifact fingerprint. A reply to an older
Telegram message therefore cannot approve a newer candidate.

The Telegram card states what will change, why it is ready, the artifact
fingerprint, and the review packet path. Approval applies only that artifact.
Rejection keeps production unchanged, records Hao's reply, and revises the
same `improve/may` task. Ordinary failures, retries, classifications, and bad
candidate generations do not notify Hao.

An approved review does not mean “run the default benchmark.” Its benchmark
labels must point back to that exact review with source
`<request-key>-approved-review`. Gym starts only those approved scenarios. If
the cases do not exist yet, Gym stops at case creation instead of falling back
to unrelated learning material. This keeps one incident, its replay and
controls, and its training evidence in the same bounded lineage.

## Roles

Use explicit names because “Gym” otherwise refers to three different things:

- **Gym runner (`projects/gym`)** owns benchmark source, execution, comparison,
  reports, and immutable run evidence.
- **Gym App (`projects/gym.app`)** owns the autonomous improvement loop.
- **Gym owner agent (`gym`)** owns the campaign outcome and priority. It is
  read-only: it interprets wake evidence, judges failure responsibility,
  selects the next focus, compares candidate evidence, and identifies a real
  authority boundary without directly changing task or benchmark state.
- **Implementation agent (`gym-implementer`)** writes only an isolated May
  overlay. It cannot change production, benchmark truth, or promotion state.

Candidate execution uses app-owned scratch space outside Git. Verified overlays
are copied into durable, fingerprinted app artifacts before scratch is cleaned.
Git worktrees are reserved for changes that are intended to become branches;
Gym candidates are artifacts, not branches.

May never builds or judges its own candidate. The Gym owner never edits the
candidate it judges.

## Evidence

The Gym runner remains the authority for immutable runs:

```text
projects/gym/.state/benchmarks/<run-id>/
```

Gym App stores only controller-owned assessment and candidate evidence:

```text
projects/gym.app/.state/
├── assessments/
├── candidates/improve-may/<task-generation>/iterations/<iteration>/
└── scratch/improve-may/<task-generation>/<iteration>/
```

An assessment records the screening and retry runs, one disposition for every
non-pass, the selected failure family, and the focused baseline. A candidate
record identifies its exact overlay fingerprint, verification runs,
recommendation, and review. Scratch is outside Git and is removed after each
completed iteration; only immutable run evidence and durable candidate
checkpoints survive recovery.

Historical evidence is append-only. Changing benchmark truth, labels, or a
scorer requires a fresh baseline.

## Human boundaries

Gym continues autonomously through ordinary evaluation, classification,
candidate revision, and verification. It asks Hao only when:

- a concrete benchmark or scorer fix is ready to apply; or
- a verified agent candidate is ready for production promotion; or
- progress requires authority or information Gym does not own.

Gym does not silently modify production May, approve subjective truth, merge a
candidate, or rewrite evidence.

## Public interface

The default interface is plain intent:

> Improve May using the current approved benchmark.

The project-comment receipt is asynchronous. The owner wakes or updates
`improve/may`; the user follows that task and does not wait on the HTTP request.

The optional typed shortcut is `improve-may-now`. It emits
`gym.improvement.requested` and wakes the same task. It does not create a job.

The standalone Gym CLI remains the developer and CI interface. Gym App calls
the same typed `runLoop` and `verifyLoop` implementation rather than invoking
the CLI and parsing its output.

## Triggers

- `improve-may-now` or free-form project intent starts an immediate cycle.
- One enabled daily refill check resumes bounded curriculum reconciliation after
  recovery or newly approved material. Continuation wakes keep it moving until
  material is exhausted or approval is required.
- A May-owned `metric.breach` wakes the campaign as evidence to investigate; a
  metric never decides the repair by itself.
- `agent.revision.changed` for May confirms the actual promoted behavior.

Do not connect broad session-evaluation events until Gym can consume their
evidence directly. A signal that merely causes an unrelated full rerun adds
cost without improving diagnosis.

## First milestone

Keep the implementation May-specific until one complete loop works:

1. migrate the live task tree to `improve/may`;
2. run benchmark version 4 through the installed app;
3. produce and verify one isolated May candidate;
4. present one proposal to Hao;
5. confirm the promoted May revision; and
6. generalize to another agent only after this proof.
