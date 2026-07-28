# Autonomous Agent Improvement

**Status:** Accepted target; May is the first agent (2026-07-21)

## Goal

Gym App autonomously improves agents. For the first milestone it keeps May
evaluated, tries isolated improvements, and brings Hao one verified proposal.

Running benchmarks is a method, not the goal. The goal is better agent behavior
supported by trustworthy evidence and no approved regression.

## Mental model

```text
human intent, daily refill check, or May revision
  -> improve/may                         one maintain task
  -> evaluate approved behavior
  -> classify every non-pass independently
  -> choose one bounded May failure family
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

There is no separate evaluation task, failure-family task, candidate job, or
app-specific status machine. Findings and candidate generations are evidence
inside the one task. A workflow attempt is synchronous and ordered; the task
waits only for an exact human decision. While autonomous work keeps making
progress, the same workflow attempt keeps running.

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

A later schedule, user request, approved benchmark change, or May revision
wakes the same task. It does not create another lifecycle.

An autonomous wake drains every approved learning track in sequence. It does
not stop after the first passing track. It stops only when all current material
passes, a verified proposal needs Hao's decision, or progress reaches a real
safety or authority boundary. After exhaustion, a fingerprinted checkpoint
makes the daily refill check a cheap no-op until the curriculum or May's durable
learning surface changes.

Every approved development case in a benchmark must be listed in that track's
autonomous-training manifest and learning unit. Loading the curriculum fails if
an approved case is missing, so a new lesson cannot be reviewed successfully
and then silently skipped by the live training loop.

An evaluator or runtime issue in one track does not block evaluation of later,
independent tracks. Gym finishes the remaining tracks, then reports the issue
and withholds the exhausted checkpoint. A verified candidate, required human
decision, or real authority boundary still stops the sequence immediately.

## One bounded synchronous workflow

`improve-agent` performs one ordered improvement burst:

1. Check benchmark approval before treating a score as truth.
2. Run or reuse a bounded baseline.
3. Retry invalid scenarios once without hiding valid failures.
4. Classify every remaining non-pass as May, benchmark, scorer, runtime, or
   noise. Every scenario appears exactly once.
5. Select one May failure family and freeze a focused development baseline.
6. Ask the isolated implementation agent for one narrow overlay.
7. Verify it against the frozen baseline.
8. If it improves, run the full five-trial release comparison.
9. If it fails, review the observed answer, expected behavior, scorer, and
   runtime before deciding whether May should change again.
10. If the review still establishes a May gap, revise the candidate immediately
    and repeat the implementation and verification steps in the same workflow.

Candidate iterations are sequential, never parallel. Each expensive stage is
checkpointed before the next stage starts, so runtime recovery reuses completed
implementation, verification, baseline, and review evidence. A repeated
artifact fingerprint or the five-iteration safety bound stops the burst as a
truthful no-progress convergence instead of spinning or invoking a second
owner loop.

`revise-candidate` is an internal workflow decision. It does not mutate the
running task and does not notify Hao. A workflow never remains open across
human approval, an external callback, or a later schedule.

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

## Roles

Use explicit names because “Gym” otherwise refers to three different things:

- **Gym runner (`projects/gym`)** owns benchmark source, execution, comparison,
  reports, and immutable run evidence.
- **Gym App (`projects/gym.app`)** owns the autonomous improvement loop.
- **Gym owner agent (`gym`)** is read-only. It judges failure responsibility and
  candidate evidence.
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
- One enabled daily refill check resumes the sequential curriculum drain after
  recovery or newly approved material. The drain itself runs aggressively until
  material is exhausted or approval is required.
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
