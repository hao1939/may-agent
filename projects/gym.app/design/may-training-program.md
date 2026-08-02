# Autonomous Agent Improvement

**Status:** Accepted target; reconciler model refined (2026-08-01)

## Goal

Gym App autonomously improves agents. For the first milestone it keeps May
evaluated, tries isolated improvements, and brings Hao one verified proposal.

Running benchmarks is a method, not the goal. The goal is better agent behavior
supported by trustworthy evidence and no approved regression.

## Resource model

```text
timer or domain event
  -> resolve the affected task resource
  -> read its desired state, current status, and evidence
  -> take the next bounded action
  -> save status and proof
  -> stop, wait for an exact condition, or emit a domain event
```

There is no central Gym task or pipeline coordinating the whole flywheel. Each
task is a K8s-style resource with its own target, owner, status, evidence, and
optional workflow. Timers own time. Events carry facts and wake the affected
resource. One resource may emit a domain event that wakes another, but it does
not control the other resource's lifecycle.

The regular resources are independent:

| Resource | Typical wakes | Responsibility |
| --- | --- | --- |
| `improve/may` | daily refill, human request, May metric, approval, May revision | Keep May at the best approved behavior |
| `learning/codex-sessions` | hourly timer | Extract strong reusable Hao intent |
| `learning/telegram-field-review` | daily timer | Learn from real deputy conversations |
| `runtime/design-alignment-review` | daily timer or explicit review event | Find design and implementation drift |

Incident and proposal resources are created for one concrete piece of evidence
and reconcile their own bounded outcome. They still follow the same resource
model; they are not phases owned by a master task.

The design follows the project-app reconciliation model:

- A task resource describes one durable target state.
- Events only wake the relevant resource and contribute current evidence. They
  never replace its specification or interrupt an active generation.
- The resource owner owns its goal, interprets evidence, and chooses the next
  priority move.
- Its workflow is learned operational experience: it advances one bounded,
  idempotent stage, saves proof, and emits a continuation event when work
  remains.
- Duplicate wakes, a lost session, and daemon restart are handled by reading
  durable resource state again; they do not need a second recovery lifecycle.

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

Gym runs one daily design-alignment review as a stable, read-only owner task.
The periodic event only wakes the task. The Gym owner compares critical
accepted promises with the relevant code and newest runtime evidence. It first
establishes the latest accepted design and chronological approved-change
lineage. An older approved artifact is historical evidence, not desired state,
when a newer accepted revision supersedes it. The review must inspect the newest
`improve/may` task, result, relevant trigger, approval or revision identity, and
run evidence; source code and tests alone cannot establish alignment. It
explicitly checks wake delivery, one-campaign state, fresh post-evaluator
evidence, the correct consumer benchmark and cases, approval boundaries, and
continuation or truthful exhaustion. Missing live proof is inconclusive, never
aligned. An intentional newer accepted change is not drift. When it finds a
real gap, it names the root cause, impact, smallest repair, proof needed, and
exact human boundary. The review prefers at most three strong gaps over a
catalog of speculation. It does not create another improvement lifecycle or
change benchmark truth or production May.

## May improvement resource

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
owner records a disposition against the campaign and does not invent a child
or sibling recovery task. The repaired source or runtime emits an improvement
wake after it has proof, so the same campaign resumes without a manual bridge.

Task reconciliation supplies only a small recent child summary. Historical
receipts remain durable task evidence, but legacy recovery trees are excluded
from the working prompt beyond the latest decision-ready entries. Campaign
checkpoints, rather than task history, carry Gym's improvement state.

A stored focused baseline with invalid trials means the one bounded retry was
already exhausted. A later wake reuses that disposition; it does not run the
same retry again. A track with such a recorded problem is checkpointed as an
evaluation issue and cannot enter candidate integration merely because its
earlier assessment also contains a May finding.

If calibrated semantic judges disagree on one exact artifact, the disagreement
may be a real human boundary, but it remains an exact wait on `improve/may`.
The owner must never create an adjudication child beneath the campaign.

An exact verification retry names the candidate fingerprint. Gym searches only
the current generation result and its immediate track results and requires one
match. It then reuses that track's assessment and candidate checkpoint, clears
only stale verification and review checkpoints, and verifies the same artifact
again. No match or more than one match stops safely; Gym does not rebuild the
candidate, repeat guided practice, or fall back to broad training. A durable
verification-retry checkpoint preserves the iteration and fingerprint so a
runtime restart resumes the same verification after `result.json` is cleared.

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

A valid failed trial remains classification evidence even when another trial
for the same scenario is invalid. The bounded retry can clear the invalid
status, but it cannot erase an observed valid failure. Only a scenario with no
valid failure after both runs is recorded solely as an evaluation issue.
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

Broad screening, its one invalid retry, and classification form one assessment
stage. Gym saves that assessment before starting the focused reproducibility
baseline. If the execution budget ends during the focused baseline, the next
reconcile resumes there instead of repeating the broad trials. The same rule
applies to release evidence: a completed matching release baseline produced by
an interrupted attempt is recovered and checkpointed before Gym starts another
baseline.

The improvement workflow declares a 120-minute execution budget through the
standard workflow-module timeout field. Ordinary app workflows keep the
platform default. This covers candidate construction plus five-trial semantic
release evaluation on a busy shared host without adding a second scheduler or
weakening the evaluation gates.

`revise-candidate` is an internal workflow decision. It does not mutate the
running task and does not notify Hao. A workflow never remains open across
human approval, an external callback, or a later schedule. The 120-minute limit
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

The submitted approval's `packetPath` is the authoritative recovery pointer.
Gym validates that it is a `result.json` inside the same campaign generation,
then resumes that exact stored proposal before recomputing curriculum or agent
fingerprints. New lessons, changed curriculum order, a daemon restart, or a
timed-out reconcile therefore cannot orphan an approval that Hao already made.
The stored approval id and artifact fingerprint must still match before Gym
applies anything. An approval naming `improve/may` also wakes that stable task
directly, even if a previous timed-out attempt lost its transient Condition.

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
├── candidates/improve-may/<task-generation>/tracks/<track>/iterations/<iteration>/
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

The post-approval confirmation uses a state scope derived from the exact
approved artifact fingerprint. It cannot reuse the campaign root result or an
assessment created before that artifact was applied. Replaying the same event
resumes the same confirmation scope; a different artifact gets a different
scope. The event carries the consumer benchmark and exact non-passing scenarios
that produced the fix, including held-back release cases; it never substitutes
the earlier development focus.

Open-ended intent is judged by the calibrated semantic judges. Deterministic
checks enforce only objective structure and boundaries such as schema, worker
identity and count, asynchronous execution, empty fields, and exact safety or
approval constraints. Do not repair a meaning failure by expanding a list of
phrases or synonyms.

A release comparison also requires exactly one matching framework revision in
both baseline and candidate runs. A mixed-revision run remains useful for
diagnosis, but it cannot authorize promotion; Gym starts fresh evidence after
the workspace settles.

A scorer fix may include scenario-specific calibration or deterministic
expectations under the evaluator benchmark's `scenarios/<scenario>/`
directory. The Gym runner overlays those files onto the canonical scenario
while freezing new run inputs. This lets one exact benchmark artifact repair
its scorer and the controls that scorer owns; it does not rewrite global
scenario history. Applying such an artifact still requires Hao's exact
approval and always starts a fresh baseline.

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
